import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

type Handler = (req: NextRequest, ...args: any[]) => Promise<NextResponse>;

/** Paths that do not require authentication */
const PUBLIC_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
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
    if (!isPublic) {
      try {
        const user = await getSessionUser();
        if (!user) {
          return NextResponse.json(
            { error: "No autenticado" },
            { status: 401 },
          );
        }
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

    // ─── Error-handling wrapper ───
    try {
      return await handler(req, ...args);
    } catch (e: any) {
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
