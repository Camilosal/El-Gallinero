import { db } from "@/db";
import { farms, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSession, sessionCookieName } from "@/lib/auth";
import { withErrorHandler, safeParseJson } from "@/lib/api-handler";
import { describeFarmCodeError, isValidFarmCode, normalizeFarmCode } from "@/lib/farm-code";

export const dynamic = "force-dynamic";

const MAX_AGE = 7 * 24 * 60 * 60; // seconds

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const rawUsername = typeof body?.username === "string" ? body.username.trim() : "";
  const normalizedUsername = rawUsername.toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";
  const rawFarmCode = typeof body?.farmCode === "string" ? body.farmCode.trim() : "";

  if (!normalizedUsername || !password) {
    return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
  }

  let authenticatedUser: typeof users.$inferSelect | null = null;
  let activeFarm: { id: string; code: string; name: string } | null = null;

  if (rawFarmCode) {
    const normalizedCode = normalizeFarmCode(rawFarmCode);
    if (!isValidFarmCode(normalizedCode)) {
      return NextResponse.json(
        {
          code: "INVALID_FARM_CODE",
          error: describeFarmCodeError(rawFarmCode) || "Código de granja inválido.",
        },
        { status: 400 },
      );
    }

    const [farm] = await db
      .select({ id: farms.id, code: farms.code, name: farms.name })
      .from(farms)
      .where(eq(farms.code, normalizedCode))
      .limit(1);

    if (farm) {
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.farmId, farm.id), sql`lower(${users.username}) = ${normalizedUsername}`))
        .limit(1);
      if (user && (await verifyPassword(password, user.passwordHash))) {
        authenticatedUser = user;
        activeFarm = farm;
      }
    }

    if (!authenticatedUser || !activeFarm) {
      return NextResponse.json(
        { error: "Usuario, código de granja o contraseña incorrectos" },
        { status: 401 },
      );
    }
  } else {
    const matches = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${normalizedUsername}`)
      .limit(2);

    if (matches.length > 1) {
      return NextResponse.json(
        {
          code: "FARM_CODE_REQUIRED",
          error:
            "Hay más de una cuenta con este usuario. Ingresa el Código de Granja (6 caracteres, ej. 7K4M2P).",
        },
        { status: 409 },
      );
    }

    const [user] = matches;
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
    }

    authenticatedUser = user;
    const [farm] = await db
      .select({ id: farms.id, code: farms.code, name: farms.name })
      .from(farms)
      .where(eq(farms.id, user.farmId))
      .limit(1);
    activeFarm = farm || null;
  }

  const token = await createSession(authenticatedUser.id, authenticatedUser.farmId);
  const response = NextResponse.json({
    id: authenticatedUser.id,
    username: authenticatedUser.username,
    name: authenticatedUser.name,
    role: authenticatedUser.role,
    farmId: authenticatedUser.farmId,
    farmCode: activeFarm?.code || null,
    farmName: activeFarm?.name || null,
  });
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });

  return response;
});
