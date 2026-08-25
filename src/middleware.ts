import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot)$).*)"],
};

const SESSION_COOKIE = "galli_session";

/** Routes that do not require a session cookie */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/api/health",
  "/lote/",
  "/dashboard/guia",
];

/** Exact paths that are public (no prefix matching) */
const PUBLIC_EXACT = ["/"];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let public and static routes through
  if (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
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
