import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const config = {
  matcher: ["/api/:path*", "/((?!login|_next/static|_next/image|favicon.ico).*)"],
};

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const publicApi =
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/health";

  if (isApi && publicApi) return NextResponse.next();

  const user = await getSessionUser();
  if (user) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}
