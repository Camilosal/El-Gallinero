import crypto from "node:crypto";
import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { billingPayments, broilerBatches, farmSubscriptions, farms } from "@/db/schema";
import { DEFAULT_FARM_ID, getCurrentFarmId, runWithFarmContext } from "@/db/tenant-context";

export type BillingPlanCode =
  | "FREEMIUM_SEMILLA"
  | "CICLO_60D"
  | "SEMESTRAL_PONEDORA"
  | "ANUAL_20"
  | "MEDIANO_MENSUAL";

export type BillingPaymentMethod = "nequi" | "daviplata" | "pse";

export interface BillingPlanDefinition {
  code: Exclude<BillingPlanCode, "FREEMIUM_SEMILLA">;
  name: string;
  tagline: string;
  amountCop: number;
  durationDays: number;
  maxActiveBatches: number | null;
  maxUsers: number;
  paymentMethods: BillingPaymentMethod[];
  recommendedFor: string;
}

export const PLAN_CATALOG: Record<Exclude<BillingPlanCode, "FREEMIUM_SEMILLA">, BillingPlanDefinition> = {
  CICLO_60D: {
    code: "CICLO_60D",
    name: "Ciclo Pollo / Engorde (60 días)",
    tagline: "Cubre un ciclo completo de engorde o crianza sin ataduras mensuales.",
    amountCop: 45000,
    durationDays: 60,
    maxActiveBatches: null,
    maxUsers: 3,
    paymentMethods: ["nequi", "daviplata", "pse"],
    recommendedFor: "Productores de pollo, pato, conejo o cuy",
  },
  SEMESTRAL_PONEDORA: {
    code: "SEMESTRAL_PONEDORA",
    name: "Semestral Ponedora (180 días)",
    tagline: "6 meses continuos de control de postura, empaque NTC 1240 y utilidad diaria.",
    amountCop: 120000,
    durationDays: 180,
    maxActiveBatches: null,
    maxUsers: 3,
    paymentMethods: ["nequi", "daviplata", "pse"],
    recommendedFor: "Granjas de postura y codornices",
  },
  ANUAL_20: {
    code: "ANUAL_20",
    name: "Anual Cosecha Segura (365 días)",
    tagline: "2 meses gratis al pagar el año completo con soporte prioritario.",
    amountCop: 210000,
    durationDays: 365,
    maxActiveBatches: null,
    maxUsers: 5,
    paymentMethods: ["nequi", "daviplata", "pse"],
    recommendedFor: "Pequeños y medianos productores establecidos",
  },
  MEDIANO_MENSUAL: {
    code: "MEDIANO_MENSUAL",
    name: "Plan Escala Mediano (Mensual)",
    tagline: "Multi-galpón, roles completos, analítica anti-subsidio y hasta 15 usuarios.",
    amountCop: 149000,
    durationDays: 30,
    maxActiveBatches: null,
    maxUsers: 15,
    paymentMethods: ["nequi", "daviplata", "pse"],
    recommendedFor: "Granjas medianas con varios operarios y galpones",
  },
};

export interface FarmSubscriptionStatus {
  farmId: string;
  farmName: string;
  deploymentMode: string;
  planCode: string;
  status: "trial" | "active" | "grace" | "expired" | "freemium";
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
  isTrialExpired: boolean;
  isPaidActive: boolean;
  isPostTrialFreemium: boolean;
  activeBatchesCount: number;
  closedBatchesCount: number;
  maxActiveBatches: number | null;
  maxUsers: number;
  canCreateNewBatch: boolean;
  promptPostHarvestRenewal: boolean;
  recentPayments: Array<{
    id: string;
    externalReference: string;
    method: string;
    amountCop: number;
    planCode: string;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }>;
}

function getWompiSecrets() {
  return {
    publicKey: process.env.WOMPI_PUBLIC_KEY || "pub_test_iwage_sandbox",
    integritySecret: process.env.WOMPI_INTEGRITY_SECRET || "test_integrity_iwage_default_secret",
    eventsSecret: process.env.WOMPI_EVENTS_SECRET || "test_events_iwage_default_secret",
    checkoutBaseUrl: process.env.WOMPI_CHECKOUT_URL || "https://checkout.wompi.co/p/",
    sandbox: !process.env.WOMPI_PUBLIC_KEY || process.env.WOMPI_PUBLIC_KEY.startsWith("pub_test_"),
  };
}

export async function getFarmSubscriptionStatus(targetFarmId?: string): Promise<FarmSubscriptionStatus> {
  const farmId = targetFarmId || getCurrentFarmId();

  const [[farmRow], [subRow], [activeBatchAgg], [closedBatchAgg], paymentsRows] = await Promise.all([
    db.select().from(farms).where(eq(farms.id, farmId)).limit(1),
    db.select().from(farmSubscriptions).where(eq(farmSubscriptions.farmId, farmId)).limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(broilerBatches)
      .where(
        and(
          eq(broilerBatches.farmId, farmId),
          inArray(broilerBatches.status, ["activo", "listo_sacrificio"]),
          gt(broilerBatches.currentQuantity, 0),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(broilerBatches)
      .where(
        and(
          eq(broilerBatches.farmId, farmId),
          or(inArray(broilerBatches.status, ["vendido", "faena"]), eq(broilerBatches.currentQuantity, 0)),
        ),
      ),
    db
      .select()
      .from(billingPayments)
      .where(eq(billingPayments.farmId, farmId))
      .orderBy(desc(billingPayments.createdAt))
      .limit(10),
  ]);

  const now = new Date();
  const activeBatchesCount = Number(activeBatchAgg?.count || 0);
  const closedBatchesCount = Number(closedBatchAgg?.count || 0);
  const deploymentMode = farmRow?.deploymentMode || "saas";
  const planCode = subRow?.planCode || farmRow?.planCode || "FREEMIUM_SEMILLA";

  const rawPeriodEnd = subRow?.currentPeriodEnd || farmRow?.trialEndsAt || null;
  const periodExpired = rawPeriodEnd ? rawPeriodEnd.getTime() < now.getTime() : false;
  const trialExpired = farmRow?.trialEndsAt ? farmRow.trialEndsAt.getTime() < now.getTime() : false;

  const isLegacyOrSelfHosted =
    deploymentMode === "self_hosted" ||
    (farmId === DEFAULT_FARM_ID && !subRow && !farmRow?.trialEndsAt);

  const isPaidActive =
    isLegacyOrSelfHosted ||
    (subRow?.status === "active" && (!subRow.currentPeriodEnd || !periodExpired));

  const isActiveTrial =
    !isPaidActive &&
    (subRow?.status === "trial" || (!subRow && Boolean(farmRow?.trialEndsAt))) &&
    !periodExpired &&
    !trialExpired;

  const isPostTrialFreemium =
    !isLegacyOrSelfHosted &&
    !isPaidActive &&
    !isActiveTrial &&
    (subRow?.status === "expired" || periodExpired || trialExpired || Boolean(subRow));

  const effectiveStatus: FarmSubscriptionStatus["status"] = isPaidActive
    ? "active"
    : isActiveTrial
      ? "trial"
      : subRow?.status === "grace"
        ? "grace"
        : isPostTrialFreemium
          ? "freemium"
          : "trial";

  const maxActiveBatches = isPostTrialFreemium
    ? Math.max(1, subRow?.maxActiveBatches ?? 1)
    : isPaidActive
      ? null
      : (subRow?.maxActiveBatches ?? null);

  const canCreateNewBatch = maxActiveBatches === null || activeBatchesCount < maxActiveBatches;
  const daysRemaining =
    rawPeriodEnd && rawPeriodEnd.getTime() > now.getTime()
      ? Math.max(0, Math.ceil((rawPeriodEnd.getTime() - now.getTime()) / 86400000))
      : rawPeriodEnd
        ? 0
        : null;

  return {
    farmId,
    farmName: farmRow?.name || "Mi Granja",
    deploymentMode,
    planCode,
    status: effectiveStatus,
    trialEndsAt: farmRow?.trialEndsAt ? farmRow.trialEndsAt.toISOString() : null,
    currentPeriodStart: subRow?.currentPeriodStart ? subRow.currentPeriodStart.toISOString() : null,
    currentPeriodEnd: rawPeriodEnd ? rawPeriodEnd.toISOString() : null,
    daysRemaining,
    isTrialExpired: trialExpired || periodExpired,
    isPaidActive,
    isPostTrialFreemium,
    activeBatchesCount,
    closedBatchesCount,
    maxActiveBatches,
    maxUsers: subRow?.maxUsers ?? 2,
    canCreateNewBatch,
    promptPostHarvestRenewal: isPostTrialFreemium && closedBatchesCount > 0,
    recentPayments: paymentsRows.map((p) => ({
      id: p.id,
      externalReference: p.externalReference,
      method: p.method,
      amountCop: p.amountCop,
      planCode: p.planCode,
      status: p.status,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export async function assertCanCreateActiveBatch(targetFarmId?: string): Promise<{
  allowed: boolean;
  code?: "UPGRADE_REQUIRED";
  error?: string;
  status: FarmSubscriptionStatus;
}> {
  const status = await getFarmSubscriptionStatus(targetFarmId);
  if (!status.canCreateNewBatch) {
    return {
      allowed: false,
      code: "UPGRADE_REQUIRED",
      error:
        "Tu periodo de prueba terminó y el plan Freemium permite 1 lote activo simultáneo (puedes consultar histórico y cerrar/vender tu lote actual sin restricciones). Renueva por ciclo con Nequi, Daviplata o PSE para abrir otro lote.",
      status,
    };
  }
  return { allowed: true, status };
}

export function computeWompiIntegritySignature(params: {
  reference: string;
  amountInCents: number;
  currency?: string;
  integritySecret?: string;
}): string {
  const currency = params.currency || "COP";
  const secret = params.integritySecret || getWompiSecrets().integritySecret;
  return crypto
    .createHash("sha256")
    .update(`${params.reference}${params.amountInCents}${currency}${secret}`)
    .digest("hex");
}

export async function createWompiCheckoutSession(input: {
  farmId?: string;
  planCode: string;
  method: string;
}) {
  const farmId = input.farmId || getCurrentFarmId();
  const plan = PLAN_CATALOG[input.planCode as keyof typeof PLAN_CATALOG];
  if (!plan) {
    throw new Error("Plan de suscripción no válido.");
  }
  const method = input.method as BillingPaymentMethod;
  if (!["nequi", "daviplata", "pse"].includes(method)) {
    throw new Error("Método de pago inválido. Usa nequi, daviplata o pse.");
  }

  const secrets = getWompiSecrets();
  const externalReference = `IWG-${farmId.slice(0, 8)}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`.toUpperCase();
  const amountInCents = plan.amountCop * 100;
  const integritySignature = computeWompiIntegritySignature({
    reference: externalReference,
    amountInCents,
    currency: "COP",
    integritySecret: secrets.integritySecret,
  });

  const [payment] = await db
    .insert(billingPayments)
    .values({
      farmId,
      provider: "wompi",
      externalReference,
      method,
      amountCop: plan.amountCop,
      planCode: plan.code,
      status: "pending",
      rawPayload: {
        sandbox: secrets.sandbox,
        requestedMethod: method,
        planDurationDays: plan.durationDays,
      },
    })
    .returning();

  const checkoutUrl =
    `${secrets.checkoutBaseUrl}?public-key=${encodeURIComponent(secrets.publicKey)}` +
    `&currency=COP&amount-in-cents=${amountInCents}` +
    `&reference=${encodeURIComponent(externalReference)}` +
    `&signature%3Aintegrity=${encodeURIComponent(integritySignature)}`;

  return {
    paymentId: payment.id,
    externalReference,
    plan,
    method,
    amountCop: plan.amountCop,
    amountInCents,
    currency: "COP",
    publicKey: secrets.publicKey,
    integritySignature,
    sandbox: secrets.sandbox,
    checkoutUrl,
  };
}

function getNestedValue(obj: unknown, dotPath: string): string {
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }
  return current == null ? "" : String(current);
}

export function verifyWompiWebhookSignature(
  payload: Record<string, unknown>,
  headerChecksum?: string | null,
  eventsSecretOverride?: string,
): boolean {
  const secret = eventsSecretOverride || getWompiSecrets().eventsSecret;
  const sigObj = payload.signature as { checksum?: string; properties?: string[] } | undefined;
  const provided = (headerChecksum || sigObj?.checksum || "").trim().toLowerCase();
  if (!provided || !/^[a-f0-9]{64}$/.test(provided)) {
    return false;
  }

  const timestamp = String(payload.timestamp ?? "");
  const properties = Array.isArray(sigObj?.properties) && sigObj.properties.length > 0
    ? sigObj.properties
    : ["transaction.id", "transaction.status", "transaction.amount_in_cents"];

  const dataNode = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
  const concatenated = properties.map((prop) => getNestedValue(dataNode, prop)).join("") + timestamp + secret;
  const expected = crypto.createHash("sha256").update(concatenated).digest("hex").toLowerCase();

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

export async function processWompiWebhookEvent(
  payload: Record<string, unknown>,
  headerChecksum?: string | null,
) {
  if (!verifyWompiWebhookSignature(payload, headerChecksum)) {
    return { ok: false as const, status: 401, error: "Firma de webhook Wompi inválida." };
  }

  const dataNode = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
  const txNode = (dataNode.transaction && typeof dataNode.transaction === "object"
    ? dataNode.transaction
    : dataNode) as Record<string, unknown>;

  const reference = String(txNode.reference || "").trim();
  const providerTxId = txNode.id ? String(txNode.id) : null;
  const rawStatus = String(txNode.status || "").trim().toUpperCase();

  if (!reference) {
    return { ok: false as const, status: 400, error: "Referencia de transacción ausente." };
  }

  const [payment] = await db
    .select()
    .from(billingPayments)
    .where(eq(billingPayments.externalReference, reference))
    .limit(1);

  if (!payment) {
    return { ok: false as const, status: 404, error: "Pago no encontrado para la referencia enviada." };
  }

  // Idempotencia: si ya fue aprobado previamente, devolver éxito sin extender dos veces el periodo.
  if (payment.status === "approved") {
    const currentStatus = await getFarmSubscriptionStatus(payment.farmId);
    return {
      ok: true as const,
      idempotent: true,
      paymentStatus: "approved",
      subscription: currentStatus,
    };
  }

  const mappedStatus =
    rawStatus === "APPROVED" ? "approved" : rawStatus === "DECLINED" || rawStatus === "ERROR" || rawStatus === "VOIDED" ? "declined" : "pending";

  await db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(billingPayments)
      .set({
        status: mappedStatus,
        providerTxId: providerTxId || payment.providerTxId,
        rawPayload: payload,
        paidAt: mappedStatus === "approved" ? now : payment.paidAt,
      })
      .where(eq(billingPayments.id, payment.id));

    if (mappedStatus === "approved") {
      const plan = PLAN_CATALOG[payment.planCode as keyof typeof PLAN_CATALOG] || PLAN_CATALOG.CICLO_60D;
      const [existingSub] = await tx
        .select()
        .from(farmSubscriptions)
        .where(eq(farmSubscriptions.farmId, payment.farmId))
        .limit(1);

      const baseDate =
        existingSub?.currentPeriodEnd && existingSub.currentPeriodEnd.getTime() > now.getTime()
          ? existingSub.currentPeriodEnd
          : now;
      const nextPeriodEnd = new Date(baseDate.getTime() + plan.durationDays * 86400000);

      await tx
        .insert(farmSubscriptions)
        .values({
          farmId: payment.farmId,
          planCode: plan.code,
          status: "active",
          maxActiveBatches: plan.maxActiveBatches,
          maxUsers: plan.maxUsers,
          currentPeriodStart: now,
          currentPeriodEnd: nextPeriodEnd,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [farmSubscriptions.farmId],
          set: {
            planCode: plan.code,
            status: "active",
            maxActiveBatches: plan.maxActiveBatches,
            maxUsers: plan.maxUsers,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd,
            updatedAt: now,
          },
        });

      await tx
        .update(farms)
        .set({
          planCode: plan.code,
          updatedAt: now,
        })
        .where(eq(farms.id, payment.farmId));
    }
  });

  const subscription = await runWithFarmContext(payment.farmId, () =>
    getFarmSubscriptionStatus(payment.farmId),
  );

  return {
    ok: true as const,
    idempotent: false,
    paymentStatus: mappedStatus,
    subscription,
  };
}

