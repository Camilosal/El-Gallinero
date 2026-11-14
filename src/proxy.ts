import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot)$).*)"],
};

const SESSION_COOKIE = "galli_session";

/** Routes that do not require a session cookie */
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/lote/",
  "/guia/",
  "/dashboard/guia/",
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
  "/api/contacto",
  "/api/billing/webhook",
  // Exportación: valida cookie de sesión o token de solo lectura dentro de la ruta.
  "/api/export",
  "/guia",
  "/dashboard/guia",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
];

const PROTECTED_PREFIXES = ["/dashboard", "/api", "/admin"];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
      return NextResponse.redirect(new URL("/login", req.url));
    }
    // API requests → 401
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.next();
}
