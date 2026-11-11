import { createHash, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword, sessionCookieName } from "@/lib/auth";
import { safeParseJson, withErrorHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attemptsByAddress = new Map<string, { count: number; expiresAt: number }>();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRateLimited(address: string): boolean {
  const now = Date.now();
  for (const [key, value] of attemptsByAddress) if (value.expiresAt <= now) attemptsByAddress.delete(key);
  const current = attemptsByAddress.get(address);
  if (current && current.expiresAt > now && current.count >= MAX_ATTEMPTS) return true;
  attemptsByAddress.set(address, current && current.expiresAt > now
    ? { ...current, count: current.count + 1 }
    : { count: 1, expiresAt: now + WINDOW_MS });
  return false;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { username, recoveryCode, newPassword } = await safeParseJson(req);
  if (typeof username !== "string" || typeof recoveryCode !== "string" || typeof newPassword !== "string" || newPassword.length < 12) {
    return NextResponse.json({ error: "No se pudo restablecer el acceso. Revisa los datos y usa una contraseña de al menos 12 caracteres." }, { status: 400 });
  }
  const address = (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "local").split(",")[0].trim().slice(0, 100);
  if (isRateLimited(address) || isRateLimited(`user:${username.trim().toLowerCase()}`)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos y vuelve a intentarlo." }, { status: 429 });
  }

  const success = await db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id, role: users.role, recoveryCodeHash: users.recoveryCodeHash, recoveryCodeIssuedAt: users.recoveryCodeIssuedAt })
      .from(users).where(eq(users.username, username.trim())).limit(1).for("update");
    const supplied = Buffer.from(sha256(recoveryCode.trim()), "hex");
    const expected = Buffer.from(user?.recoveryCodeHash || sha256("missing-recovery-code"), "hex");
    const codeAge = user?.recoveryCodeIssuedAt ? Date.now() - user.recoveryCodeIssuedAt.getTime() : Number.POSITIVE_INFINITY;
    const currentCode = codeAge >= 0 && codeAge <= 30 * 24 * 60 * 60 * 1000;
    const valid = timingSafeEqual(supplied, expected) && user?.role === "admin" && !!user.recoveryCodeHash && currentCode;
    if (!user || !valid) return false;

    await tx.update(users).set({ passwordHash: await hashPassword(newPassword), recoveryCodeHash: null, recoveryCodeIssuedAt: null }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return true;
  });

  if (!success) return NextResponse.json({ error: "No se pudo restablecer el acceso. Revisa el usuario y el código de recuperación." }, { status: 400 });
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  return NextResponse.json({ ok: true });
});
