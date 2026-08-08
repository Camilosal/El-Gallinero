import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, sessionCookieName } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await destroySession();
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, "", { httpOnly: true, path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
