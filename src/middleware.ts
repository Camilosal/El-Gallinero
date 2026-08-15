import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/api/:path*", "/((?!login|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-192.png|icon-512.png|lote).*)"],
};

export default async function proxy(req: NextRequest) {
  // For now, allow everything through to test the landing page
  return NextResponse.next();
}
