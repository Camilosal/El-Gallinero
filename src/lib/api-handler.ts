import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { offlineMutationReceipts } from "@/db/schema";
import { eq } from "drizzle-orm";

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

/** Paths that do not require authentication */
const PUBLIC_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/me",
  "/api/billing/webhook",
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
            return NextResponse.json(existingReceipt.responseBody ?? { ok: true }, {
              status: existingReceipt.statusCode,
              headers: { "X-Idempotent-Replay": "1" },
            });
          }
        } catch (receiptError) {
          console.warn("Offline receipt lookup skipped:", receiptError);
        }
      }

      // ─── Error-handling wrapper ───
      try {
        const response = await handler(req, ...args);
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
