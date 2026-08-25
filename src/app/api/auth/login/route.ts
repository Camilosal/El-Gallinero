import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyPassword, createSession, getSessionUser, destroySession, sessionCookieName } from "@/lib/auth";
import { withErrorHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const MAX_AGE = 7 * 24 * 60 * 60; // seconds

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { username, password } = await safeParseJson(req);
  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.username, username));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  const token = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });

  return NextResponse.json({ id: user.id, username: user.username, name: user.name, role: user.role });
});
