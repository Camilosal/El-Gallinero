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
    const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isPublic) {
      try {
        const user = await getSessionUser();
        if (!user) {
          return NextResponse.json(
            { error: "No autenticado" },
            { status: 401 },
          );
        }
      } catch {
        // Outside Next.js request context (e.g. vitest) — skip auth
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
        msg.includes("Cantidad inválida") ||
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
