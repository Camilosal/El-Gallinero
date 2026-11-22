import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farms, sessions, users } from "@/db/schema";
import { hashPassword, sessionCookieName } from "@/lib/auth";
import { safeParseJson, withErrorHandler } from "@/lib/api-handler";
import { describeFarmCodeError, isValidFarmCode, normalizeFarmCode } from "@/lib/farm-code";
import { isRequestRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { username, farmCode, recoveryCode, newPassword } = await safeParseJson(req);
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
  const rawFarmCode = typeof farmCode === "string" ? farmCode.trim() : "";
  const normalizedFarmCode = rawFarmCode ? normalizeFarmCode(rawFarmCode) : "";

  if (rawFarmCode && !isValidFarmCode(normalizedFarmCode)) {
    return NextResponse.json(
      {
        code: "INVALID_FARM_CODE",
        error: describeFarmCodeError(rawFarmCode) || "Código de granja inválido.",
      },
      { status: 400 },
    );
  }

  if (
    isRequestRateLimited(req, {
      namespace: "recover-ip",
      windowMs: 15 * 60 * 1000,
      maxAttempts: 8,
    }) ||
    isRequestRateLimited(req, {
      namespace: "recover-user",
      key: `user:${normalizedFarmCode || "global"}:${normalizedUsername}`,
      windowMs: 15 * 60 * 1000,
      maxAttempts: 8,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera 15 minutos y vuelve a intentarlo." },
      { status: 429 },
    );
  }

  const outcome = await db.transaction(async (tx) => {
    let farmIdFilter: string | null = null;
    if (normalizedFarmCode) {
      const [farm] = await tx
        .select({ id: farms.id })
        .from(farms)
        .where(eq(farms.code, normalizedFarmCode))
        .limit(1);
      if (!farm) return "failed" as const;
      farmIdFilter = farm.id;
    }

    const matches = await tx
      .select({
        id: users.id,
        role: users.role,
        recoveryCodeHash: users.recoveryCodeHash,
        recoveryCodeIssuedAt: users.recoveryCodeIssuedAt,
      })
      .from(users)
      .where(
        farmIdFilter
          ? and(eq(users.farmId, farmIdFilter), sql`lower(${users.username}) = ${normalizedUsername}`)
          : sql`lower(${users.username}) = ${normalizedUsername}`,
      )
      .limit(2)
      .for("update");

    if (!farmIdFilter && matches.length > 1) {
      return "farm_code_required" as const;
    }

    const [user] = matches;
    const supplied = Buffer.from(sha256(recoveryCode.trim()), "hex");
    const expected = Buffer.from(user?.recoveryCodeHash || sha256("missing-recovery-code"), "hex");
    const codeAge = user?.recoveryCodeIssuedAt
      ? Date.now() - user.recoveryCodeIssuedAt.getTime()
      : Number.POSITIVE_INFINITY;
    const currentCode = codeAge >= 0 && codeAge <= 365 * 24 * 60 * 60 * 1000;
    const valid = timingSafeEqual(supplied, expected) && Boolean(user?.recoveryCodeHash) && currentCode;

    if (!user || !valid) return "failed" as const;

    await tx
      .update(users)
      .set({
        passwordHash: await hashPassword(newPassword),
        recoveryCodeHash: null,
        recoveryCodeIssuedAt: null,
      })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return "ok" as const;
  });

  if (outcome === "farm_code_required") {
    return NextResponse.json(
      {
        code: "FARM_CODE_REQUIRED",
        error:
          "Hay más de una cuenta con este usuario. Ingresa el Código de Granja (6 caracteres, ej. 7K4M2P) para identificar tu finca.",
      },
      { status: 409 },
    );
  }

  if (outcome !== "ok") {
    return NextResponse.json(
      { error: "No se pudo restablecer el acceso. Revisa el usuario, código de granja y código de recuperación." },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(sessionCookieName);
  return res;
});
