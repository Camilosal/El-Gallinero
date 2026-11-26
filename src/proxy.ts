import { NextRequest, NextResponse } from "next/server";
import { APP_ROUTE_PREFIXES } from "@/lib/app-routes";
import { getPaymentReturnLoginUrl } from "@/lib/billing-return";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot)$).*)"],
};

const SESSION_COOKIE = "galli_session";

/** Routes that do not require a session cookie */
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/v1/integrations/",
  // API v1 de herramientas del agente: valida token de integración o sesión dentro de la ruta.
  "/api/v1/agent/",
  // Confirmar/cancelar acciones pendientes: acepta sesión o token agent:write (agente externo).
  "/api/asistente/acciones/",
  "/lote/",
  "/guia/",
  "/manual/",
  "/bitacora/",
  "/planes/",
];

/** Routes that are public without allowing prefix-sharing paths through. */
const PUBLIC_EXACT = [
  "/",
  "/terminos",
  "/retracto",
  "/privacidad",
  "/contacto",
  "/ayuda",
  "/open-source",
  "/realidad-campo",
  "/planes",
  "/nosotros",
  "/bitacora",
  "/login",
  "/login/recuperar",
  "/registro",
  "/api/health",
  "/api/pricing/offer",
  "/api/pricing/matrix",
  "/api/pricing/quote",
  // These endpoints validate their own Bearer CRON_SECRET.
  "/api/cron/fuentes-externas",
  "/api/cron/agente-proactivo",
  "/api/cron/suscripciones-vencidas",
  // Telegram valida su propio header X-Telegram-Bot-Api-Secret-Token.
  "/api/telegram/webhook",
  "/api/contacto",
  "/api/busqueda/sugerir",
  "/api/billing/webhook",
  // Reservas valida HMAC, timestamp y tamaño del cuerpo dentro del handler.
  "/api/billing/reservas",
  // Exportación: valida cookie de sesión o token de solo lectura dentro de la ruta.
  "/api/export",
  // Servidor MCP: valida el token de integración (Bearer) dentro de la ruta.
  "/api/mcp",
  "/guia",
  "/manual",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
];

const PROTECTED_PREFIXES = [...APP_ROUTE_PREFIXES, "/dashboard", "/api", "/admin"];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Legacy public manual path redirect
  if (pathname === "/dashboard/guia" || pathname.startsWith("/dashboard/guia/")) {
    const suffix = pathname.slice("/dashboard/guia".length);
    return NextResponse.redirect(new URL(`/manual${suffix}${search}`, req.url), 308);
  }

  // Let public and static routes through
  if (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // Only enforce session auth on private app/API prefixes so unknown URLs
  // render not-found.tsx with HTTP 404 instead of 401 or a /login soft-404.
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  // Lightweight session-cookie presence check
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    // Browser-like requests → redirect to login
    if (req.headers.get("accept")?.includes("text/html")) {
      if (pathname === "/escanear" || pathname === "/dashboard/escanear") {
        const rawFarm = req.nextUrl.searchParams.get("f") || req.nextUrl.searchParams.get("granja") || "";
        const rawQr = req.nextUrl.searchParams.get("qr") || "";
        if (rawFarm || rawQr) {
          const loginUrl = new URL("/login", req.url);
          const normalizedFarm = rawFarm.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
          if (normalizedFarm) {
            loginUrl.searchParams.set("granja", normalizedFarm);
          }
          const canonicalPath = pathname === "/dashboard/escanear" ? "/escanear" : pathname;
          loginUrl.searchParams.set("next", `${canonicalPath}${search}`);
          return NextResponse.redirect(loginUrl);
        }
      }
      return NextResponse.redirect(getPaymentReturnLoginUrl(new URL(req.url)) ?? new URL("/login", req.url));
    }
    // API requests → 401
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Legacy /dashboard/* routes redirect permanently once authenticated
  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL(`/inicio${search}`, req.url), 308);
  }
  if (pathname.startsWith("/dashboard/")) {
    const targetPath = pathname.slice("/dashboard".length) || "/inicio";
    return NextResponse.redirect(new URL(`${targetPath}${search}`, req.url), 308);
  }

  return NextResponse.next();
}
