import { createHash, timingSafeEqual } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword, sessionCookieName } from "@/lib/auth";
import { safeParseJson, withErrorHandler } from "@/lib/api-handler";
import { isRequestRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { username, recoveryCode, newPassword } = await safeParseJson(req);
  if (
    typeof username !== "string" ||
    typeof recoveryCode !== "string" ||
    typeof newPassword !== "string" ||
    newPassword.length < 8
  ) {
    return NextResponse.json(
      {
        error:
          "No se pudo restablecer el acceso. Revisa los datos y usa una contraseña de al menos 8 caracteres.",
      },
      { status: 400 },
    );
  }

  const normalizedUsername = username.trim().toLowerCase();
  const rawUsername = username.trim();

  if (
    isRequestRateLimited(req, {
      namespace: "recover-ip",
      windowMs: 15 * 60 * 1000,
      maxAttempts: 8,
    }) ||
    isRequestRateLimited(req, {
      namespace: "recover-user",
      key: `user:${normalizedUsername}`,
      windowMs: 15 * 60 * 1000,
      maxAttempts: 8,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera 15 minutos y vuelve a intentarlo." },
      { status: 429 },
    );
  }

  const success = await db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        id: users.id,
        role: users.role,
        recoveryCodeHash: users.recoveryCodeHash,
        recoveryCodeIssuedAt: users.recoveryCodeIssuedAt,
      })
      .from(users)
      .where(
        normalizedUsername === rawUsername
          ? eq(users.username, normalizedUsername)
          : or(eq(users.username, normalizedUsername), eq(users.username, rawUsername)),
      )
      .limit(1)
      .for("update");

    const supplied = Buffer.from(sha256(recoveryCode.trim()), "hex");
    const expected = Buffer.from(user?.recoveryCodeHash || sha256("missing-recovery-code"), "hex");
    const codeAge = user?.recoveryCodeIssuedAt
      ? Date.now() - user.recoveryCodeIssuedAt.getTime()
      : Number.POSITIVE_INFINITY;
    const currentCode = codeAge >= 0 && codeAge <= 365 * 24 * 60 * 60 * 1000;
    const valid = timingSafeEqual(supplied, expected) && Boolean(user?.recoveryCodeHash) && currentCode;

    if (!user || !valid) return false;

    await tx
      .update(users)
      .set({
        passwordHash: await hashPassword(newPassword),
        recoveryCodeHash: null,
        recoveryCodeIssuedAt: null,
      })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return true;
  });

  if (!success) {
    return NextResponse.json(
      { error: "No se pudo restablecer el acceso. Revisa el usuario y el código de recuperación." },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(sessionCookieName);
  return res;
});
