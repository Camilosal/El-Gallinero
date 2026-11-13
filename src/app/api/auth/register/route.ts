import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import { appSettings, farmSubscriptions, farms, users } from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { createSession, hashPassword, sessionCookieName } from "@/lib/auth";
import { createDefaultProgressiveConfig, PROGRESSIVE_CONFIG_SETTING_KEY } from "@/lib/onboarding";
import { invalidateSettingsCache } from "@/lib/settings";

export const dynamic = "force-dynamic";

function toFarmSlug(farmName: string): string {
  const base = farmName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base || "granja"}-${suffix}`;
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const farmName = typeof body.farmName === "string" ? body.farmName.trim() : "";
  const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const qrSource = typeof body.qrSource === "string" && body.qrSource.trim() ? body.qrSource.trim().slice(0, 120) : null;
  const allyCode = typeof body.allyCode === "string" && body.allyCode.trim() ? body.allyCode.trim().slice(0, 120) : null;

  if (farmName.length < 2) {
    return NextResponse.json({ error: "Ingresa el nombre de tu finca o granja" }, { status: 400 });
  }
  if (ownerName.length < 2) {
    return NextResponse.json({ error: "Ingresa tu nombre completo" }, { status: 400 });
  }
  if (username.length < 3) {
    return NextResponse.json(
      { error: "Ingresa un usuario, celular o correo (mínimo 3 caracteres)" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 },
    );
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser) {
    return NextResponse.json(
      { error: "Ese usuario o correo ya está registrado. Intenta iniciar sesión." },
      { status: 409 },
    );
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 30 * 86400000);
  const passwordHash = await hashPassword(password);
  const slug = toFarmSlug(farmName);

  const created = await db.transaction(async (tx) => {
    const [farm] = await tx
      .insert(farms)
      .values({
        slug,
        name: farmName,
        deploymentMode: "saas",
        qrSource,
        allyCode,
        planCode: "FREEMIUM_SEMILLA",
        trialEndsAt,
      })
      .returning();

    const [owner] = await tx
      .insert(users)
      .values({
        farmId: farm.id,
        username,
        passwordHash,
        name: ownerName,
        role: "propietario",
      })
      .returning({
        id: users.id,
        farmId: users.farmId,
        username: users.username,
        name: users.name,
        role: users.role,
      });

    await tx
      .update(farms)
      .set({ ownerUserId: owner.id, updatedAt: new Date() })
      .where(eq(farms.id, farm.id));

    await tx.insert(farmSubscriptions).values({
      farmId: farm.id,
      planCode: "FREEMIUM_SEMILLA",
      status: "trial",
      maxActiveBatches: 1,
      maxUsers: 2,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    });

    const initialConfig = {
      ...createDefaultProgressiveConfig("PEQUENO"),
      onboardingCompleted: false,
    };

    const initialSettings = [
      {
        farmId: farm.id,
        key: PROGRESSIVE_CONFIG_SETTING_KEY,
        value: JSON.stringify(initialConfig),
      },
      {
        farmId: farm.id,
        key: "farm.name",
        value: farmName,
      },
      {
        farmId: farm.id,
        key: "farm.admin_name",
        value: ownerName,
      },
    ];

    for (const entry of initialSettings) {
      await tx
        .insert(appSettings)
        .values(entry)
        .onConflictDoUpdate({
          target: [appSettings.farmId, appSettings.key],
          set: { value: entry.value, updatedAt: new Date() },
        });
    }

    return { farm, owner };
  });

  invalidateSettingsCache();

  const rawToken = await runWithFarmContext(created.farm.id, () =>
    createSession(created.owner.id, created.farm.id),
  );

  const response = NextResponse.json(
    {
      ok: true,
      farmId: created.farm.id,
      farm: {
        id: created.farm.id,
        slug: created.farm.slug,
        name: created.farm.name,
        planCode: created.farm.planCode,
        trialEndsAt: created.farm.trialEndsAt,
      },
      user: created.owner,
      redirectTo: "/dashboard?wizard=1",
    },
    { status: 201 },
  );

  response.cookies.set(sessionCookieName, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: req.nextUrl.protocol === "https:",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
});

