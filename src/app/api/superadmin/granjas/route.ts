import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import {
  appSettings,
  billingPayments,
  broilerBatches,
  farmLocations,
  farmSubscriptions,
  farms,
  hens,
  roosters,
  users,
} from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { getSessionUser, hashPassword, switchUserSessionFarm } from "@/lib/auth";
import {
  createDefaultProgressiveConfig,
  sanitizeProgressiveConfig,
  PROGRESSIVE_CONFIG_SETTING_KEY,
  type ProducerScale,
} from "@/lib/onboarding";
import { forbiddenResponse, normalizeRole } from "@/lib/rbac";
import { invalidateSettingsCache } from "@/lib/settings";
import { PLAN_CATALOG } from "@/lib/subscription";

export const dynamic = "force-dynamic";

function parseProgressiveConfigSafe(raw: string | null) {
  if (!raw) return createDefaultProgressiveConfig("PEQUENO");
  try {
    return sanitizeProgressiveConfig(JSON.parse(raw));
  } catch {
    return createDefaultProgressiveConfig("PEQUENO");
  }
}

export const SUPERADMIN_PLAN_OPTIONS = [
  {
    code: "FREEMIUM_SEMILLA",
    name: "Freemium Semilla (1 lote activo)",
    durationDays: 30,
    amountCop: 0,
    maxUsers: 2,
    maxActiveBatches: 1 as number | null,
  },
  ...Object.values(PLAN_CATALOG).map((p) => ({
    code: p.code,
    name: p.name,
    durationDays: p.durationDays,
    amountCop: p.amountCop,
    maxUsers: p.maxUsers,
    maxActiveBatches: null as number | null,
  })),
];

export function canManagePlatformTenants(
  user:
    | {
        role?: string | null;
        farmId?: string | null;
        homeFarmId?: string | null;
        username?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  const rawRole = String(user.role || "")
    .trim()
    .toLowerCase();
  if (rawRole === "admin") return true;
  if (
    String(user.username || "")
      .trim()
      .toLowerCase() === "admin"
  ) {
    return true;
  }
  const effectiveHomeFarmId = user.homeFarmId || user.farmId;
  if (effectiveHomeFarmId === DEFAULT_FARM_ID && normalizeRole(user.role) === "propietario") {
    return true;
  }
  return false;
}

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

function resolvePlanMetadata(planCode: string) {
  if (planCode in PLAN_CATALOG) {
    const p = PLAN_CATALOG[planCode as keyof typeof PLAN_CATALOG];
    return {
      code: p.code,
      name: p.name,
      durationDays: p.durationDays,
      amountCop: p.amountCop,
      maxUsers: p.maxUsers,
      maxActiveBatches: null as number | null,
    };
  }
  if (planCode === "COMERCIAL_MEDIANO") {
    return {
      code: "COMERCIAL_MEDIANO",
      name: "Comercial Mediano Productor",
      durationDays: 30,
      amountCop: 149000,
      maxUsers: 15,
      maxActiveBatches: null as number | null,
    };
  }
  return {
    code: "FREEMIUM_SEMILLA",
    name: "Freemium Semilla",
    durationDays: 30,
    amountCop: 0,
    maxUsers: 2,
    maxActiveBatches: 1 as number | null,
  };
}

function computeEffectiveSubscription(
  farm: typeof farms.$inferSelect,
  sub: typeof farmSubscriptions.$inferSelect | undefined,
) {
  const now = new Date();
  const planCode = sub?.planCode || farm.planCode || "FREEMIUM_SEMILLA";
  const meta = resolvePlanMetadata(planCode);
  const rawStatus = sub?.status || "trial";
  const periodEnd = sub?.currentPeriodEnd || farm.trialEndsAt || null;
  const periodStart = sub?.currentPeriodStart || farm.createdAt || now;
  const maxUsers = sub?.maxUsers ?? meta.maxUsers;
  const maxActiveBatches =
    sub !== undefined ? sub.maxActiveBatches : meta.maxActiveBatches;

  let effectiveStatus: "trial" | "active" | "grace" | "expired" | "freemium" =
    rawStatus as "trial" | "active" | "grace" | "expired" | "freemium";
  let daysRemaining: number | null = null;

  if (periodEnd) {
    const diffMs = new Date(periodEnd).getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / 86400000));
    if (diffMs < 0) {
      effectiveStatus =
        planCode === "FREEMIUM_SEMILLA" ? "freemium" : "expired";
    }
  } else if (planCode === "FREEMIUM_SEMILLA" && rawStatus !== "active") {
    effectiveStatus = "freemium";
  }

  return {
    planCode,
    planName: meta.name,
    rawStatus,
    effectiveStatus,
    maxUsers,
    maxActiveBatches,
    currentPeriodStart: periodStart ? new Date(periodStart).toISOString() : null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd).toISOString() : null,
    daysRemaining,
  };
}

export const GET = withApiHandler(async () => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canManagePlatformTenants(user)) {
    return forbiddenResponse(
      "Acceso exclusivo para Super-Administración de la plataforma Iwagé.",
    );
  }

  const [allFarms, allSubs, allUsers, allPayments] = await Promise.all([
    db.select().from(farms).orderBy(desc(farms.createdAt)),
    db.select().from(farmSubscriptions),
    db
      .select({
        id: users.id,
        farmId: users.farmId,
        username: users.username,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users),
    db
      .select()
      .from(billingPayments)
      .orderBy(desc(billingPayments.createdAt)),
  ]);

  const subByFarmId = new Map(allSubs.map((s) => [s.farmId, s]));
  const usersByFarmId = new Map<string, typeof allUsers>();
  for (const u of allUsers) {
    const list = usersByFarmId.get(u.farmId) || [];
    list.push(u);
    usersByFarmId.set(u.farmId, list);
  }

  const paymentsByFarmId = new Map<string, typeof allPayments>();
  for (const p of allPayments) {
    const list = paymentsByFarmId.get(p.farmId) || [];
    list.push(p);
    paymentsByFarmId.set(p.farmId, list);
  }

  const enrichedFarms = await Promise.all(
    allFarms.map(async (f) => {
      const sub = subByFarmId.get(f.id);
      const farmUsers = usersByFarmId.get(f.id) || [];
      const owner =
        farmUsers.find((u) => u.id === f.ownerUserId) ||
        farmUsers.find((u) => normalizeRole(u.role) === "propietario") ||
        farmUsers[0] ||
        null;

      const operational = await runWithFarmContext(f.id, async () => {
        const [settingsRows, locCountRows, batchStatsRows, hensCountRows, roostersCountRows] =
          await Promise.all([
            db
              .select({ key: appSettings.key, value: appSettings.value })
              .from(appSettings)
              .where(eq(appSettings.farmId, f.id)),
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(farmLocations)
              .where(eq(farmLocations.farmId, f.id)),
            db
              .select({
                activeBatches: sql<number>`count(*) filter (where ${broilerBatches.status} = 'activo')::int`,
                batchAnimals: sql<number>`coalesce(sum(case when ${broilerBatches.status} = 'activo' then ${broilerBatches.currentQuantity} else 0 end), 0)::int`,
              })
              .from(broilerBatches)
              .where(eq(broilerBatches.farmId, f.id)),
            db
              .select({
                count: sql<number>`count(*) filter (where ${hens.status} in ('activa', 'empollando', 'enferma'))::int`,
              })
              .from(hens)
              .where(eq(hens.farmId, f.id)),
            db
              .select({
                count: sql<number>`count(*) filter (where ${roosters.status} in ('activo', 'enfermo'))::int`,
              })
              .from(roosters)
              .where(eq(roosters.farmId, f.id)),
          ]);

        const settingsMap = new Map(settingsRows.map((r) => [r.key, r.value]));
        const progConfig = parseProgressiveConfigSafe(
          settingsMap.get(PROGRESSIVE_CONFIG_SETTING_KEY) ?? null,
        );
        const municipality = settingsMap.get("farm.city") || null;

        const locationsCount = Number(locCountRows[0]?.count ?? 0);
        const activeBatchesCount = Number(batchStatsRows[0]?.activeBatches ?? 0);
        const animalsCount =
          Number(batchStatsRows[0]?.batchAnimals ?? 0) +
          Number(hensCountRows[0]?.count ?? 0) +
          Number(roostersCountRows[0]?.count ?? 0);

        return {
          municipality,
          scale: progConfig.scale,
          onboardingCompleted: Boolean(progConfig.onboardingCompleted),
          locationsCount,
          activeBatchesCount,
          animalsCount,
        };
      });

      const computedSub = computeEffectiveSubscription(f, sub);
      const farmPayments = paymentsByFarmId.get(f.id) || [];
      const approvedPaymentsCop = farmPayments
        .filter((p) => p.status === "approved")
        .reduce((acc, p) => acc + Number(p.amountCop || 0), 0);

      return {
        id: f.id,
        slug: f.slug,
        name: f.name,
        isDefaultFarm: f.id === DEFAULT_FARM_ID,
        deploymentMode: f.deploymentMode,
        qrSource: f.qrSource,
        allyCode: f.allyCode,
        municipality: operational.municipality,
        scale: operational.scale,
        onboardingCompleted: operational.onboardingCompleted,
        owner: owner
          ? {
              id: owner.id,
              name: owner.name,
              username: owner.username,
              role: owner.role,
            }
          : null,
        usersCount: farmUsers.length,
        locationsCount: operational.locationsCount,
        activeBatchesCount: operational.activeBatchesCount,
        animalsCount: operational.animalsCount,
        subscription: computedSub,
        billing: {
          approvedPaymentsCop,
          paymentsCount: farmPayments.length,
          lastPaymentAt: farmPayments[0]?.paidAt || farmPayments[0]?.createdAt || null,
        },
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      };
    }),
  );

  const summary = {
    totalFarms: enrichedFarms.length,
    activePaidFarms: enrichedFarms.filter(
      (f) =>
        f.subscription.effectiveStatus === "active" &&
        f.subscription.planCode !== "FREEMIUM_SEMILLA",
    ).length,
    trialFarms: enrichedFarms.filter(
      (f) => f.subscription.effectiveStatus === "trial",
    ).length,
    expiredFarms: enrichedFarms.filter(
      (f) => f.subscription.effectiveStatus === "expired",
    ).length,
    freemiumFarms: enrichedFarms.filter(
      (f) => f.subscription.effectiveStatus === "freemium",
    ).length,
    totalUsers: enrichedFarms.reduce((acc, f) => acc + f.usersCount, 0),
    totalAnimals: enrichedFarms.reduce((acc, f) => acc + f.animalsCount, 0),
    totalRevenueCop: enrichedFarms.reduce(
      (acc, f) => acc + f.billing.approvedPaymentsCop,
      0,
    ),
  };

  return NextResponse.json({
    currentContext: {
      activeFarmId: user.farmId || DEFAULT_FARM_ID,
      homeFarmId:
        ("homeFarmId" in user && user.homeFarmId) || user.farmId || DEFAULT_FARM_ID,
      defaultFarmId: DEFAULT_FARM_ID,
    },
    summary,
    plans: SUPERADMIN_PLAN_OPTIONS,
    farms: enrichedFarms,
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canManagePlatformTenants(user)) {
    return forbiddenResponse(
      "Acceso exclusivo para Super-Administración de la plataforma Iwagé.",
    );
  }

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const farmName = typeof body.farmName === "string" ? body.farmName.trim() : "";
  const municipality =
    typeof body.municipality === "string" && body.municipality.trim()
      ? body.municipality.trim().slice(0, 120)
      : null;
  const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
  const ownerUsername =
    typeof body.ownerUsername === "string"
      ? body.ownerUsername.trim().toLowerCase()
      : "";
  const ownerPassword =
    typeof body.ownerPassword === "string" ? body.ownerPassword : "";
  const deploymentMode =
    body.deploymentMode === "dedicated" || body.deploymentMode === "self_hosted"
      ? body.deploymentMode
      : "saas";
  const scale: ProducerScale =
    body.scale === "MEDIANO" ? "MEDIANO" : "PEQUENO";
  const planCode =
    typeof body.planCode === "string" && body.planCode.trim()
      ? body.planCode.trim()
      : scale === "MEDIANO"
        ? "MEDIANO_MENSUAL"
        : "FREEMIUM_SEMILLA";
  const planMeta = resolvePlanMetadata(planCode);
  const status =
    body.status === "active" || body.status === "trial" || body.status === "grace"
      ? body.status
      : planCode === "FREEMIUM_SEMILLA"
        ? "trial"
        : "active";
  const durationDays =
    typeof body.durationDays === "number" && body.durationDays > 0
      ? Math.min(3650, Math.round(body.durationDays))
      : planMeta.durationDays;
  const maxUsers =
    typeof body.maxUsers === "number" && body.maxUsers >= 1
      ? Math.min(200, Math.round(body.maxUsers))
      : planMeta.maxUsers;
  const maxActiveBatches =
    body.maxActiveBatches === null
      ? null
      : typeof body.maxActiveBatches === "number" && body.maxActiveBatches >= 1
        ? Math.round(body.maxActiveBatches)
        : planMeta.maxActiveBatches;
  const allyCode =
    typeof body.allyCode === "string" && body.allyCode.trim()
      ? body.allyCode.trim().slice(0, 120)
      : null;
  const qrSource =
    typeof body.qrSource === "string" && body.qrSource.trim()
      ? body.qrSource.trim().slice(0, 120)
      : null;
  const registerManualPayment = Boolean(body.registerManualPayment);

  if (farmName.length < 2) {
    return NextResponse.json(
      { error: "Ingresa el nombre de la granja o predio (mínimo 2 caracteres)" },
      { status: 400 },
    );
  }
  if (ownerName.length < 2) {
    return NextResponse.json(
      { error: "Ingresa el nombre del titular o propietario" },
      { status: 400 },
    );
  }
  if (ownerUsername.length < 3) {
    return NextResponse.json(
      { error: "Ingresa un usuario, celular o correo para el propietario (mínimo 3 caracteres)" },
      { status: 400 },
    );
  }
  if (ownerPassword.length < 8) {
    return NextResponse.json(
      { error: "La contraseña inicial debe tener al menos 8 caracteres" },
      { status: 400 },
    );
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, ownerUsername))
    .limit(1);

  if (existingUser) {
    return NextResponse.json(
      { error: `El usuario "${ownerUsername}" ya existe en la plataforma.` },
      { status: 409 },
    );
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + durationDays * 86400000);
  const passwordHash = await hashPassword(ownerPassword);
  const slug = toFarmSlug(farmName);

  const created = await db.transaction(async (tx) => {
    const [farm] = await tx
      .insert(farms)
      .values({
        slug,
        name: farmName,
        deploymentMode,
        qrSource,
        allyCode,
        planCode,
        trialEndsAt: periodEnd,
      })
      .returning();

    const [owner] = await tx
      .insert(users)
      .values({
        farmId: farm.id,
        username: ownerUsername,
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
      .set({ ownerUserId: owner.id, updatedAt: now })
      .where(eq(farms.id, farm.id));

    const [subscription] = await tx
      .insert(farmSubscriptions)
      .values({
        farmId: farm.id,
        planCode,
        status,
        maxActiveBatches,
        maxUsers,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      })
      .returning();

    if (registerManualPayment && planMeta.amountCop > 0) {
      const extRef = `SA-${farm.slug.slice(0, 24)}-${Date.now()}`;
      await tx.insert(billingPayments).values({
        farmId: farm.id,
        provider: "manual_superadmin",
        externalReference: extRef,
        method:
          typeof body.paymentMethod === "string" && body.paymentMethod.trim()
            ? body.paymentMethod.trim().slice(0, 30)
            : "transferencia",
        amountCop:
          typeof body.amountCop === "number" && body.amountCop > 0
            ? Math.round(body.amountCop)
            : planMeta.amountCop,
        planCode,
        status: "approved",
        paidAt: now,
      });
    }

    return { farm, owner, subscription };
  });

  await runWithFarmContext(created.farm.id, async () => {
    const initialConfig = {
      ...createDefaultProgressiveConfig(scale),
      onboardingCompleted: false,
    };

    const settingsEntries: Array<{ farmId: string; key: string; value: string }> = [
      {
        farmId: created.farm.id,
        key: PROGRESSIVE_CONFIG_SETTING_KEY,
        value: JSON.stringify(initialConfig),
      },
      {
        farmId: created.farm.id,
        key: "farm.name",
        value: farmName,
      },
      {
        farmId: created.farm.id,
        key: "farm.admin_name",
        value: ownerName,
      },
    ];

    if (municipality) {
      settingsEntries.push({
        farmId: created.farm.id,
        key: "farm.city",
        value: municipality,
      });
    }

    for (const entry of settingsEntries) {
      await db
        .insert(appSettings)
        .values(entry)
        .onConflictDoUpdate({
          target: [appSettings.farmId, appSettings.key],
          set: { value: entry.value, updatedAt: new Date() },
        });
    }
  });

  invalidateSettingsCache();

  return NextResponse.json(
    {
      ok: true,
      farm: {
        id: created.farm.id,
        slug: created.farm.slug,
        name: created.farm.name,
        deploymentMode: created.farm.deploymentMode,
        planCode: created.farm.planCode,
        scale,
        municipality,
      },
      owner: created.owner,
      subscription: computeEffectiveSubscription(
        created.farm,
        created.subscription,
      ),
    },
    { status: 201 },
  );
});

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canManagePlatformTenants(user)) {
    return forbiddenResponse(
      "Acceso exclusivo para Super-Administración de la plataforma Iwagé.",
    );
  }

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  // Modo A: Cambiar contexto activo de sesión (Soporte / Inspección de Granja)
  if (body.action === "switch_context") {
    const targetFarmId =
      typeof body.farmId === "string" && body.farmId.trim()
        ? body.farmId.trim()
        : DEFAULT_FARM_ID;

    const [targetFarm] = await db
      .select()
      .from(farms)
      .where(eq(farms.id, targetFarmId))
      .limit(1);

    if (!targetFarm) {
      return NextResponse.json(
        { error: "La granja seleccionada no existe" },
        { status: 404 },
      );
    }

    await switchUserSessionFarm(user.id, targetFarm.id);
    invalidateSettingsCache();

    return NextResponse.json({
      ok: true,
      action: "switch_context",
      activeFarmId: targetFarm.id,
      farmName: targetFarm.name,
      slug: targetFarm.slug,
    });
  }

  // Modo B: Actualizar Granja, Plan, Vencimiento, Cupos, Escala o Pago Manual
  const farmId = typeof body.farmId === "string" ? body.farmId.trim() : "";
  if (!farmId) {
    return NextResponse.json(
      { error: "farmId es obligatorio" },
      { status: 400 },
    );
  }

  const [existingFarm] = await db
    .select()
    .from(farms)
    .where(eq(farms.id, farmId))
    .limit(1);

  if (!existingFarm) {
    return NextResponse.json(
      { error: "Granja no encontrada" },
      { status: 404 },
    );
  }

  const [existingSub] = await db
    .select()
    .from(farmSubscriptions)
    .where(eq(farmSubscriptions.farmId, farmId))
    .limit(1);

  const now = new Date();
  const nextPlanCode =
    typeof body.planCode === "string" && body.planCode.trim()
      ? body.planCode.trim()
      : existingSub?.planCode || existingFarm.planCode || "FREEMIUM_SEMILLA";
  const planMeta = resolvePlanMetadata(nextPlanCode);

  const nextStatus =
    typeof body.status === "string" &&
    ["trial", "active", "grace", "expired"].includes(body.status)
      ? body.status
      : existingSub?.status || "trial";

  const nextMaxUsers =
    typeof body.maxUsers === "number" && body.maxUsers >= 1
      ? Math.min(200, Math.round(body.maxUsers))
      : body.planCode && body.planCode !== existingSub?.planCode
        ? planMeta.maxUsers
        : existingSub?.maxUsers ?? planMeta.maxUsers;

  const nextMaxActiveBatches =
    body.maxActiveBatches === null
      ? null
      : typeof body.maxActiveBatches === "number" && body.maxActiveBatches >= 1
        ? Math.round(body.maxActiveBatches)
        : body.planCode && body.planCode !== existingSub?.planCode
          ? planMeta.maxActiveBatches
          : existingSub !== undefined
            ? existingSub.maxActiveBatches
            : planMeta.maxActiveBatches;

  let nextPeriodEnd: Date | null =
    existingSub?.currentPeriodEnd || existingFarm.trialEndsAt || null;

  if (typeof body.extendDays === "number" && body.extendDays !== 0) {
    const baseTime =
      nextPeriodEnd && nextPeriodEnd.getTime() > now.getTime() && !body.extendFromNow
        ? nextPeriodEnd.getTime()
        : now.getTime();
    nextPeriodEnd = new Date(baseTime + Math.round(body.extendDays) * 86400000);
  } else if (typeof body.currentPeriodEnd === "string" && body.currentPeriodEnd.trim()) {
    const parsed = new Date(body.currentPeriodEnd);
    if (!Number.isNaN(parsed.getTime())) {
      nextPeriodEnd = parsed;
    }
  } else if (body.currentPeriodEnd === null) {
    nextPeriodEnd = null;
  }

  const nextName =
    typeof body.name === "string" && body.name.trim().length >= 2
      ? body.name.trim()
      : existingFarm.name;
  const nextDeploymentMode =
    body.deploymentMode === "saas" ||
    body.deploymentMode === "dedicated" ||
    body.deploymentMode === "self_hosted"
      ? body.deploymentMode
      : existingFarm.deploymentMode;
  const nextAllyCode =
    body.allyCode !== undefined
      ? typeof body.allyCode === "string" && body.allyCode.trim()
        ? body.allyCode.trim().slice(0, 120)
        : null
      : existingFarm.allyCode;
  const nextQrSource =
    body.qrSource !== undefined
      ? typeof body.qrSource === "string" && body.qrSource.trim()
        ? body.qrSource.trim().slice(0, 120)
        : null
      : existingFarm.qrSource;

  const [updatedFarm] = await db
    .update(farms)
    .set({
      name: nextName,
      deploymentMode: nextDeploymentMode,
      allyCode: nextAllyCode,
      qrSource: nextQrSource,
      planCode: nextPlanCode,
      trialEndsAt: nextPeriodEnd,
      updatedAt: now,
    })
    .where(eq(farms.id, farmId))
    .returning();

  const [updatedSub] = await db
    .insert(farmSubscriptions)
    .values({
      farmId,
      planCode: nextPlanCode,
      status: nextStatus,
      maxUsers: nextMaxUsers,
      maxActiveBatches: nextMaxActiveBatches,
      currentPeriodStart: existingSub?.currentPeriodStart || now,
      currentPeriodEnd: nextPeriodEnd,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: farmSubscriptions.farmId,
      set: {
        planCode: nextPlanCode,
        status: nextStatus,
        maxUsers: nextMaxUsers,
        maxActiveBatches: nextMaxActiveBatches,
        currentPeriodEnd: nextPeriodEnd,
        updatedAt: now,
      },
    })
    .returning();

  if (body.registerManualPayment) {
    const amountCop =
      typeof body.amountCop === "number" && body.amountCop > 0
        ? Math.round(body.amountCop)
        : planMeta.amountCop;
    if (amountCop > 0) {
      await db.insert(billingPayments).values({
        farmId,
        provider: "manual_superadmin",
        externalReference: `SA-${existingFarm.slug.slice(0, 24)}-${Date.now()}`,
        method:
          typeof body.paymentMethod === "string" && body.paymentMethod.trim()
            ? body.paymentMethod.trim().slice(0, 30)
            : "transferencia",
        amountCop,
        planCode: nextPlanCode,
        status: "approved",
        paidAt: now,
      });
    }
  }

  if (
    body.name !== undefined ||
    body.municipality !== undefined ||
    body.scale === "PEQUENO" ||
    body.scale === "MEDIANO"
  ) {
    await runWithFarmContext(farmId, async () => {
      if (typeof body.name === "string" && body.name.trim().length >= 2) {
        await db
          .insert(appSettings)
          .values({
            farmId,
            key: "farm.name",
            value: body.name.trim(),
          })
          .onConflictDoUpdate({
            target: [appSettings.farmId, appSettings.key],
            set: { value: body.name.trim(), updatedAt: now },
          });
      }

      if (body.municipality !== undefined) {
        const cityVal =
          typeof body.municipality === "string" ? body.municipality.trim() : "";
        await db
          .insert(appSettings)
          .values({
            farmId,
            key: "farm.city",
            value: cityVal,
          })
          .onConflictDoUpdate({
            target: [appSettings.farmId, appSettings.key],
            set: { value: cityVal, updatedAt: now },
          });
      }

      if (body.scale === "PEQUENO" || body.scale === "MEDIANO") {
        const [existingProg] = await db
          .select({ value: appSettings.value })
          .from(appSettings)
          .where(eq(appSettings.key, PROGRESSIVE_CONFIG_SETTING_KEY))
          .limit(1);

        const currentProg = parseProgressiveConfigSafe(existingProg?.value ?? null);
        const baseForScale = createDefaultProgressiveConfig(body.scale);
        const updatedProg = {
          ...currentProg,
          scale: body.scale as ProducerScale,
          flags:
            body.scale === "MEDIANO"
              ? { ...baseForScale.flags }
              : { ...currentProg.flags, ...baseForScale.flags },
          updatedAt: now.toISOString(),
        };

        await db
          .insert(appSettings)
          .values({
            farmId,
            key: PROGRESSIVE_CONFIG_SETTING_KEY,
            value: JSON.stringify(updatedProg),
          })
          .onConflictDoUpdate({
            target: [appSettings.farmId, appSettings.key],
            set: { value: JSON.stringify(updatedProg), updatedAt: now },
          });
      }
    });
    invalidateSettingsCache();
  }

  return NextResponse.json({
    ok: true,
    farmId,
    farm: updatedFarm,
    subscription: computeEffectiveSubscription(updatedFarm, updatedSub),
  });
});

