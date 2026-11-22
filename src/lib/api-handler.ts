import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { offlineMutationReceipts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canPerformAction, forbiddenResponse, isReadOnlyRole } from "@/lib/rbac";
import { canReadApi, getApiPermission, hasApiPermission } from "@/lib/api-rbac";

type Handler = (req: NextRequest, ...args: any[]) => Promise<NextResponse>;

export class ApiHttpError extends Error {
  statusCode: number;
  details?: Record<string, unknown>;
  constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiHttpError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

const FINANCE_ONLY_FIELDS = new Set([
  "acquisitioncost", "totalproductioncost", "cost", "costperunit", "unitcost", "totalcost",
  "estimatedvalue", "totalvalue", "foodvalue", "eggvalue", "birdsvalue", "suppliesvalue",
  "meatvalue", "manurevalue", "maintenancecost", "estimatedfeedcost", "weightedcostperkg",
  "costperkggain", "costperegg", "costperkgmeat", "costperlivkgmeat", "totalexpenses",
  "proratedcostsinperiod", "expensebycategory", "operatingcontext", "operatingnetprofitcop",
  "accruedoperatingexpensecop", "cashnetflowcop", "warehousefeedassetcop", "netequipmentbookvaluecop",
  "biologicalportfoliovaluecop", "totalproductivewealthcop", "capexrecoverypct",
  "totalcapex", "roiannualizedpct", "paybackmonths", "costlast30d", "payroll", "payrollcost",
  "salary", "wage", "withholding", "taxamount", "subtotalamount", "income", "expenses", "profit", "netprofit",
  "feedcostperkgcop", "initialunitcostcop", "pointoflayunitvaluecop", "breederunitvaluecop",
  "acquisitioncostcop", "costoalimentototal", "costoalimentoporcabeza", "costototal", "margenneto", "margenporcentaje",
]);

const SALES_OR_FINANCE_FIELDS = new Set([
  "amount", "totalamount", "totalrevenue", "priceperkg", "priceperunit", "unitprice",
  "buyer", "saleshistory",
  "saleslast30d", "eggrevenue", "sales",
]);

function redactRoleFinancialFields(value: unknown, canReadFinance: boolean, canReadSales: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactRoleFinancialFields(item, canReadFinance, canReadSales));
  }
  if (!value || typeof value !== "object") return value;

  const safe: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");
    if (!canReadFinance && FINANCE_ONLY_FIELDS.has(normalizedKey)) continue;
    if (!canReadFinance && !canReadSales && SALES_OR_FINANCE_FIELDS.has(normalizedKey)) continue;
    safe[key] = redactRoleFinancialFields(fieldValue, canReadFinance, canReadSales);
  }
  return safe;
}

async function redactApiResponseForRole(response: NextResponse, role: string | null, pathname: string): Promise<NextResponse> {
  if (!response.ok || !role) return response;
  // These endpoints build their own role-aware aggregate projection.
  if (pathname === "/api/dashboard" || pathname === "/api/finanzas/resumen" || pathname.startsWith("/api/analisis/")) {
    return response;
  }
  if (!response.headers.get("content-type")?.includes("application/json")) return response;

  const canReadFinance = canPerformAction(role, "finance:read");
  const canReadSales = canPerformAction(role, "sales:read");
  if (canReadFinance && canReadSales) return response;

  const payload = await response.clone().json().catch(() => undefined);
  if (payload === undefined) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return NextResponse.json(redactRoleFinancialFields(payload, canReadFinance, canReadSales), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Paths that do not require authentication */
const PUBLIC_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/me",
  "/api/billing/webhook",
  "/api/billing/reservas",
  "/api/contacto",
  "/api/health",
];

/**
 * Wraps an API handler with authentication + centralized error handling.
 * All data routes should use this wrapper.
 * Auth/public routes use `withErrorHandler` with `{ requireAuth: false }` instead.
 */
export function withApiHandler(handler: Handler): Handler {
  return async (req: NextRequest, ...args: any[]) => {
    // ─── Authentication gate ───
    const pathname = req?.nextUrl?.pathname ?? (req?.url ? new URL(req.url).pathname : "");
    const isPublic = PUBLIC_PREFIXES.includes(pathname);
    let sessionFarmId: string = DEFAULT_FARM_ID;
    let sessionRole: string | null = null;
    if (!isPublic) {
      try {
        const user = await getSessionUser();
        if (!user) {
          return NextResponse.json(
            { error: "No autenticado" },
            { status: 401 },
          );
        }
        sessionFarmId = (user as { farmId?: string | null }).farmId || DEFAULT_FARM_ID;
        sessionRole = user.role;
      } catch (error) {
        // Authentication failures must fail closed. A missing request context or
        // an unavailable session store must never grant access to a data route.
        console.error("API authentication check failed:", error);
        return NextResponse.json(
          { error: "No se pudo validar la sesión" },
          { status: 503 },
        );
      }
    }

    const executeInFarmScope = async () => {
      // ─── Idempotencia para mutaciones offline (X-Client-Mutation-Id) ───
      const method = req?.method?.toUpperCase?.() ?? "GET";
      if (!isPublic && pathname.startsWith("/api/")) {
        if (["GET", "HEAD", "OPTIONS"].includes(method)) {
          if (!canReadApi(sessionRole, pathname)) {
            return forbiddenResponse("Tu rol solo puede consultar el tablero y los análisis agregados");
          }
          const permission = getApiPermission(pathname, method);
          if (!hasApiPermission(sessionRole, permission)) {
            return forbiddenResponse();
          }
        }

        if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
          const isBugReport = pathname === "/api/soporte/fallas" && method === "POST";
          if (isReadOnlyRole(sessionRole) && !isBugReport) {
            return forbiddenResponse("El rol Directivo es de solo consulta");
          }

          let requestBody: unknown;
          if (
            (pathname === "/api/pagos" || pathname === "/api/produccion/alimentacion/movimientos") &&
            method !== "DELETE"
          ) {
            requestBody = await req.clone().json().catch(() => undefined);
          }
          const permission = getApiPermission(pathname, method, requestBody);
          if (!hasApiPermission(sessionRole, permission)) {
            return forbiddenResponse();
          }
        }
      }

      const rawMutationId = req?.headers?.get?.("x-client-mutation-id")?.trim() ?? "";
      const shouldDedupe =
        Boolean(rawMutationId) &&
        rawMutationId.length <= 100 &&
        (method === "POST" || method === "PUT" || method === "DELETE") &&
        !pathname.startsWith("/api/sync/") &&
        !pathname.startsWith("/api/asistente/");

      if (shouldDedupe) {
        try {
          const [existingReceipt] = await db
            .select()
            .from(offlineMutationReceipts)
            .where(eq(offlineMutationReceipts.mutationId, rawMutationId))
            .limit(1);
          if (existingReceipt && existingReceipt.method === method && existingReceipt.path === pathname.slice(0, 255)) {
            const replay = NextResponse.json(existingReceipt.responseBody ?? { ok: true }, {
              status: existingReceipt.statusCode,
              headers: { "X-Idempotent-Replay": "1" },
            });
            return await redactApiResponseForRole(replay, sessionRole, pathname);
          }
        } catch (receiptError) {
          console.warn("Offline receipt lookup skipped:", receiptError);
        }
      }

      // ─── Error-handling wrapper ───
      try {
        const handlerResponse = await handler(req, ...args);
        const response = await redactApiResponseForRole(handlerResponse, sessionRole, pathname);
        if (shouldDedupe && response.ok) {
          try {
            const responseBody = await response.clone().json().catch(() => null);
            await db
              .insert(offlineMutationReceipts)
              .values({
                mutationId: rawMutationId,
                method,
                path: pathname.slice(0, 255),
                statusCode: response.status,
                responseBody,
              })
              .onConflictDoNothing();
          } catch (persistError) {
            console.warn("Offline receipt persist skipped:", persistError);
          }
        }
        return response;
      } catch (e: any) {
        if (e instanceof ApiHttpError || typeof e?.statusCode === "number") {
          return NextResponse.json(
            { error: e.message, ...(e.details || {}) },
            { status: e.statusCode },
          );
        }

        // Malformed JSON
        if (e instanceof SyntaxError) {
          return NextResponse.json(
            { error: "JSON inválido en el cuerpo de la petición" },
            { status: 400 },
          );
        }

        // PostgreSQL error codes
        const code = e.code as string | undefined;

        if (code === "23503") {
          return NextResponse.json(
            { error: "Referencia a registro inexistente" },
            { status: 400 },
          );
        }

        if (code === "23505") {
          return NextResponse.json(
            { error: "Registro duplicado" },
            { status: 409 },
          );
        }

        if (code === "23502") {
          return NextResponse.json(
            { error: "Campo requerido faltante" },
            { status: 400 },
          );
        }

        // Known application errors (thrown from within transactions)
        const msg: string = e.message || "";
        if (msg.toLowerCase().includes("duplicado")) {
          return NextResponse.json({ error: msg }, { status: 409 });
        }
        if (msg.includes("ya tiene una incubación activa") || msg.includes("ya completada")) {
          return NextResponse.json({ error: msg }, { status: 409 });
        }
        if (msg.includes("pagos o cobros registrados") || msg.includes("pagos registrados") || msg.includes("cobros registrados")) {
          return NextResponse.json({ error: msg }, { status: 409 });
        }
        if (msg.startsWith("Transacción vinculada")) {
          return NextResponse.json({ error: msg }, { status: 409 });
        }
        if (msg.startsWith("Registro ligado a control sanitario")) {
          return NextResponse.json({ error: msg }, { status: 409 });
        }
        if (msg.includes("El registro cambió mientras se")) {
          return NextResponse.json({ error: msg }, { status: 409 });
        }
        if (
          msg.includes("no encontrad") ||
          msg === "No encontrado" ||
          msg === "No encontrada"
        ) {
          return NextResponse.json({ error: msg }, { status: 404 });
        }
        if (
          msg.startsWith("Stock insuficiente") ||
          msg.includes("excede") ||
          msg.includes("no puede quedar por debajo") ||
          msg.includes("No hay suficientes huevos") ||
          msg.includes("No se puede convertir a contado") ||
          msg.startsWith("No se puede reducir") ||
          msg.startsWith("No se puede eliminar") ||
          msg.includes("Cantidad inválida") ||
          msg.includes("cantidad nacida") ||
          msg.includes("Cantidad de machos inválida") ||
          msg.includes("Cantidad de hembras inválida") ||
          msg.includes("suma de machos y hembras") ||
          msg.includes("Fecha inválida") ||
          msg.includes("Fecha de nacimiento inválida") ||
          msg.includes("Tipo de adquisición inválido") ||
          msg.includes("Tipo de ave inválido") ||
          msg.includes("Costo unitario inválido") ||
          msg.includes("costo unitario debe ser mayor") ||
          msg.includes("Código requerido") ||
          msg.includes("La cantidad de huevos") ||
          msg.includes("Estado de eclosión inválido") ||
          msg.toLowerCase().includes("capacidad") ||
          msg.toLowerCase().includes("lugar de destino") ||
          msg.toLowerCase().includes("lugar seleccionado") ||
          msg.includes("no está disponible")
        ) {
          return NextResponse.json({ error: msg }, { status: 400 });
        }

        // Generic error
        console.error("API error:", e);
        return NextResponse.json(
          { error: msg || "Error interno del servidor" },
          { status: 500 },
        );
      }
    };

    return isPublic
      ? executeInFarmScope()
      : runWithFarmContext(sessionFarmId, executeInFarmScope);
  };
}

/**
 * Wraps an API handler with error handling only (no auth).
 * Use this for auth endpoints (login, logout, me) and health checks.
 */
export function withErrorHandler(handler: Handler): Handler {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      return await handler(req, ...args);
    } catch (e: any) {
      const msg: string = e.message || "";
      console.error("API error:", e);
      return NextResponse.json(
        { error: msg || "Error interno del servidor" },
        { status: 500 },
      );
    }
  };
}

/**
 * Safely parse JSON body from request. Throws SyntaxError on invalid JSON.
 */
export async function safeParseJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new SyntaxError("JSON inválido");
  }
}
