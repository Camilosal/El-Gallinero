import crypto from "node:crypto";
import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { billingPayments, broilerBatches, farmLocations, farmSubscriptions, farms } from "@/db/schema";
import { DEFAULT_FARM_ID, getCurrentFarmId, runWithFarmContext } from "@/db/tenant-context";
import { notifyPaymentApproved } from "@/lib/notifications";
import { getPlanEntitlements, resolveCommercialPlan } from "@/lib/pricing/entitlements";
import { isSupportedPricingTerm } from "@/lib/pricing/quote";
import type { PricingPlanKey } from "@/lib/pricing/types";

export type BillingPlanCode =
  | "FREEMIUM_SEMILLA"
  | "CICLO_60D"
  | "SEMESTRAL_PONEDORA"
  | "ANUAL_20"
  | "MEDIANO_MENSUAL";

export interface BillingPlanDefinition {
  code: Exclude<BillingPlanCode, "FREEMIUM_SEMILLA">;
  name: string;
  amountCop: number;
  durationDays: number;
  maxActiveBatches: number | null;
  maxUsers: number;
}

/** Historical metadata for existing subscription IDs and payment callbacks; new offers use the v2.3 pricing policy. */
export const PLAN_CATALOG: Record<Exclude<BillingPlanCode, "FREEMIUM_SEMILLA">, BillingPlanDefinition> = {
  CICLO_60D: {
    code: "CICLO_60D",
    name: "Ciclo Pollo / Engorde (60 días)",
    amountCop: 45000,
    durationDays: 60,
    maxActiveBatches: null,
    maxUsers: 3,
  },
  SEMESTRAL_PONEDORA: {
    code: "SEMESTRAL_PONEDORA",
    name: "Semestral Ponedora (180 días)",
    amountCop: 120000,
    durationDays: 180,
    maxActiveBatches: null,
    maxUsers: 3,
  },
  ANUAL_20: {
    code: "ANUAL_20",
    name: "Anual Cosecha Segura (365 días)",
    amountCop: 210000,
    durationDays: 365,
    maxActiveBatches: null,
    maxUsers: 5,
  },
  MEDIANO_MENSUAL: {
    code: "MEDIANO_MENSUAL",
    name: "Plan Escala Mediano (Mensual)",
    amountCop: 149000,
    durationDays: 30,
    maxActiveBatches: null,
    maxUsers: 15,
  },
};

export interface FarmSubscriptionStatus {
  farmId: string;
  farmName: string;
  deploymentMode: string;
  planCode: string;
  planKey: PricingPlanKey;
  planName: string;
  entitlements: ReturnType<typeof getPlanEntitlements>;
  status: "trial" | "active" | "grace" | "expired" | "freemium";
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  daysRemaining: number | null;
  isTrialExpired: boolean;
  isPaidActive: boolean;
  isPostTrialFreemium: boolean;
  activeBatchesCount: number;
  activeBatchesBySpecies: Record<string, number>;
  activeLocationsCount: number;
  closedBatchesCount: number;
  maxActiveBatches: number | null;
  maxActiveBatchesPerSpecies: number | null;
  maxActiveLocations: number | null;
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

export class PlanLimitExceededError extends Error {
  statusCode = 402;
  details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "PlanLimitExceededError";
    this.details = details;
  }
}

function getWompiSecrets() {
  return {
    eventsSecret: process.env.WOMPI_EVENTS_SECRET || "test_events_iwage_default_secret",
  };
}

export async function getFarmSubscriptionStatus(targetFarmId?: string): Promise<FarmSubscriptionStatus> {
  const farmId = targetFarmId || getCurrentFarmId();

  const [[farmRow], [subRow], [activeBatchAgg], activeBatchSpeciesRows, [activeLocationAgg], [closedBatchAgg], paymentsRows] = await Promise.all([
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
      .select({ species: broilerBatches.species, count: sql<number>`count(*)::int` })
      .from(broilerBatches)
      .where(
        and(
          eq(broilerBatches.farmId, farmId),
          inArray(broilerBatches.status, ["activo", "listo_sacrificio"]),
          gt(broilerBatches.currentQuantity, 0),
        ),
      )
      .groupBy(broilerBatches.species),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(farmLocations)
      .where(and(eq(farmLocations.farmId, farmId), eq(farmLocations.status, "activa"))),
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
  const activeLocationsCount = Number(activeLocationAgg?.count || 0);
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
          : planCode === "FREEMIUM_SEMILLA" && !subRow && !farmRow?.trialEndsAt
            ? "freemium"
            : "trial";

  const planKey = resolveCommercialPlan(planCode, isPaidActive || effectiveStatus === "grace");
  const entitlements = getPlanEntitlements(planKey, subRow?.maxUsers);
  const activeBatchesBySpecies = Object.fromEntries(
    activeBatchSpeciesRows.map((row) => [row.species, Number(row.count || 0)]),
  );
  const maxActiveBatchesPerSpecies = entitlements.maxActiveBatchesPerSpecies;
  const maxActiveBatches = maxActiveBatchesPerSpecies;
  // Species is needed to decide the Gratis quota; this aggregate flag only
  // means the plan itself has not disabled lot creation globally.
  const canCreateNewBatch = maxActiveBatchesPerSpecies === null || maxActiveBatchesPerSpecies > 0;
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
    planKey,
    planName: entitlements.planName,
    entitlements,
    status: effectiveStatus,
    trialEndsAt: farmRow?.trialEndsAt ? farmRow.trialEndsAt.toISOString() : null,
    currentPeriodStart: subRow?.currentPeriodStart ? subRow.currentPeriodStart.toISOString() : null,
    currentPeriodEnd: rawPeriodEnd ? rawPeriodEnd.toISOString() : null,
    daysRemaining,
    isTrialExpired: trialExpired || periodExpired,
    isPaidActive,
    isPostTrialFreemium,
    activeBatchesCount,
    activeBatchesBySpecies,
    activeLocationsCount,
    closedBatchesCount,
    maxActiveBatches,
    maxActiveBatchesPerSpecies,
    maxActiveLocations: entitlements.maxActiveLocations,
    maxUsers: entitlements.maxUserSeats ?? subRow?.maxUsers ?? 1,
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

export async function assertCanCreateActiveBatch(
  species: string,
  targetFarmId?: string,
  transaction?: any,
): Promise<{
  allowed: boolean;
  code?: "UPGRADE_REQUIRED";
  error?: string;
  planKey: PricingPlanKey;
  planName: string;
  activeCount?: number;
  limit?: number | null;
}> {
  const farmId = targetFarmId || getCurrentFarmId();
  const check = async (client: any) => {
    const entitlements = await getFarmPlanEntitlements(farmId, client);
    const limit = entitlements.maxActiveBatchesPerSpecies;
    if (limit === null) {
      return { allowed: true as const, planKey: entitlements.plan, planName: entitlements.planName, limit };
    }
    await acquireActiveBatchQuotaLock(client, farmId, species);
    const [row] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(broilerBatches)
      .where(and(
        eq(broilerBatches.farmId, farmId),
        eq(broilerBatches.species, species as typeof broilerBatches.$inferSelect.species),
        inArray(broilerBatches.status, ["activo", "listo_sacrificio"]),
        gt(broilerBatches.currentQuantity, 0),
      ));
    const activeCount = Number(row?.count || 0);

    if (activeCount >= limit) {
      return {
        allowed: false as const,
        code: "UPGRADE_REQUIRED" as const,
        error:
          `El plan Gratis permite ${limit} lote activo por especie. Puedes consultar el histórico y cerrar o vender tus lotes; para ampliar capacidad, revisa los planes de IwaGranja.`,
        planKey: entitlements.plan,
        planName: entitlements.planName,
        activeCount,
        limit,
      };
    }
    return { allowed: true as const, planKey: entitlements.plan, planName: entitlements.planName, activeCount, limit };
  };
  return transaction ? check(transaction) : db.transaction(check);
}

async function acquireActiveBatchQuotaLock(transaction: any, farmId: string, species: string) {
  await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`batch-limit:${farmId}:${species}`}))`);
}

export async function lockActiveBatchQuota(transaction: any, species: string, targetFarmId?: string) {
  const farmId = targetFarmId || getCurrentFarmId();
  const entitlements = await getFarmPlanEntitlements(farmId, transaction);
  if (entitlements.maxActiveBatchesPerSpecies !== null) {
    await acquireActiveBatchQuotaLock(transaction, farmId, species);
  }
}

export async function getFarmPlanEntitlements(targetFarmId?: string, transaction: any = db) {
  const farmId = targetFarmId || getCurrentFarmId();
  const [[farmRow], [subRow]] = await Promise.all([
    transaction.select().from(farms).where(eq(farms.id, farmId)).limit(1),
    transaction.select().from(farmSubscriptions).where(eq(farmSubscriptions.farmId, farmId)).limit(1),
  ]);
  const now = new Date();
  const periodEnd = subRow ? subRow.currentPeriodEnd : farmRow?.trialEndsAt || null;
  const periodIsCurrent = !periodEnd || periodEnd.getTime() >= now.getTime();
  const isLegacyAccess = farmRow?.deploymentMode === "self_hosted" ||
    (farmId === DEFAULT_FARM_ID && !subRow && !farmRow?.trialEndsAt);
  const paidAccess = isLegacyAccess ||
    (subRow?.status === "grace" || (subRow?.status === "active" && periodIsCurrent));
  const planCode = subRow?.planCode || farmRow?.planCode || "FREEMIUM_SEMILLA";
  const planKey = resolveCommercialPlan(planCode, paidAccess);
  return getPlanEntitlements(planKey, subRow?.maxUsers);
}

export async function assertCanCreateFarmLocation(transaction?: any, targetFarmId?: string): Promise<{
  allowed: boolean;
  code?: "UPGRADE_REQUIRED";
  error?: string;
  activeCount?: number;
  limit?: number | null;
}> {
  const farmId = targetFarmId || getCurrentFarmId();
  const check = async (client: any) => {
    const entitlements = await getFarmPlanEntitlements(farmId, client);
    const limit = entitlements.maxActiveLocations;
    if (limit === null) return { allowed: true as const, limit };
    await client.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`location-limit:${farmId}`}))`);
    const [row] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(farmLocations)
      .where(and(eq(farmLocations.farmId, farmId), eq(farmLocations.status, "activa")));
    const activeCount = Number(row?.count || 0);
    if (activeCount >= limit) {
      return {
        allowed: false as const,
        code: "UPGRADE_REQUIRED" as const,
        error: `El plan Gratis permite ${limit} localización activa. Revisa los planes de IwaGranja para ampliar el alcance.`,
        activeCount,
        limit,
      };
    }
    return { allowed: true as const, activeCount, limit };
  };
  return transaction ? check(transaction) : db.transaction(check);
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

interface ProductorPurchaseSnapshot {
  policyVersion: string;
  termsVersion: string;
  acceptedAt: string;
  quote: {
    segment: "producer";
    users: number;
    periodMonths: number;
    totalBeforeLogisticsAndTaxCop: number;
  };
}

function getProductorPurchaseSnapshot(rawPayload: Record<string, unknown> | null): ProductorPurchaseSnapshot | null {
  const purchase = rawPayload?.pricingPurchase;
  if (!purchase || typeof purchase !== "object" || Array.isArray(purchase)) return null;
  const data = purchase as Record<string, unknown>;
  const quote = data.quote;
  if (!quote || typeof quote !== "object" || Array.isArray(quote)) return null;
  const quoteData = quote as Record<string, unknown>;
  if (
    typeof data.policyVersion !== "string" ||
    typeof data.termsVersion !== "string" ||
    typeof data.acceptedAt !== "string" ||
    data.acceptedTerms !== true ||
    !Array.isArray(data.acceptedDocuments) ||
    !data.acceptedDocuments.includes("terminos") ||
    !data.acceptedDocuments.includes("retracto") ||
    quoteData.segment !== "producer" ||
    quoteData.policyVersion !== data.policyVersion ||
    typeof quoteData.users !== "number" ||
    !Number.isSafeInteger(quoteData.users) ||
    (quoteData.users as number) < 1 ||
    typeof quoteData.periodMonths !== "number" ||
    !Number.isSafeInteger(quoteData.periodMonths) ||
    !isSupportedPricingTerm("producer", quoteData.periodMonths as number) ||
    typeof quoteData.totalBeforeLogisticsAndTaxCop !== "number" ||
    !Number.isSafeInteger(quoteData.totalBeforeLogisticsAndTaxCop) ||
    (quoteData.totalBeforeLogisticsAndTaxCop as number) <= 0
  ) {
    return null;
  }
  return {
    policyVersion: data.policyVersion,
    termsVersion: data.termsVersion,
    acceptedAt: data.acceptedAt,
    quote: {
      segment: "producer",
      users: quoteData.users as number,
      periodMonths: quoteData.periodMonths as number,
      totalBeforeLogisticsAndTaxCop: quoteData.totalBeforeLogisticsAndTaxCop as number,
    },
  };
}

function addCalendarMonths(value: Date, months: number): Date {
  const result = new Date(value);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
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
  const eventAmountInCents = Number(txNode.amount_in_cents);
  const eventCurrency = String(txNode.currency ?? "").toUpperCase();
  if (
    !Number.isSafeInteger(eventAmountInCents) ||
    eventAmountInCents !== payment.amountCop * 100 ||
    eventCurrency !== "COP"
  ) {
    return {
      ok: false as const,
      status: 409,
      error: "El valor o la moneda confirmados por Wompi no coinciden con el pago registrado.",
    };
  }
  const productorPurchase = payment.planCode === "PRODUCTOR"
    ? getProductorPurchaseSnapshot(payment.rawPayload)
    : null;
  if (
    payment.planCode === "PRODUCTOR" &&
    (!productorPurchase || productorPurchase.quote.totalBeforeLogisticsAndTaxCop !== payment.amountCop)
  ) {
    return {
      ok: false as const,
      status: 409,
      error: "La compra no conserva un cálculo y una aceptación válidos; no se activó la suscripción.",
    };
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
        rawPayload: { ...(payment.rawPayload ?? {}), latestWebhook: payload },
        paidAt: mappedStatus === "approved" ? now : payment.paidAt,
      })
      .where(eq(billingPayments.id, payment.id));

    if (mappedStatus === "approved") {
      const legacyPlan = PLAN_CATALOG[payment.planCode as keyof typeof PLAN_CATALOG] || PLAN_CATALOG.CICLO_60D;
      const [existingSub] = await tx
        .select()
        .from(farmSubscriptions)
        .where(eq(farmSubscriptions.farmId, payment.farmId))
        .limit(1);

      const baseDate =
        existingSub?.currentPeriodEnd && existingSub.currentPeriodEnd.getTime() > now.getTime()
          ? existingSub.currentPeriodEnd
          : now;
      const planCode = productorPurchase ? "PRODUCTOR" : legacyPlan.code;
      const maxUsers = productorPurchase?.quote.users ?? legacyPlan.maxUsers;
      const nextPeriodEnd = productorPurchase
        ? addCalendarMonths(baseDate, productorPurchase.quote.periodMonths)
        : new Date(baseDate.getTime() + legacyPlan.durationDays * 86400000);

      await tx
        .insert(farmSubscriptions)
        .values({
          farmId: payment.farmId,
          planCode,
          status: "active",
          maxActiveBatches: legacyPlan.maxActiveBatches,
          maxUsers,
          currentPeriodStart: now,
          currentPeriodEnd: nextPeriodEnd,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [farmSubscriptions.farmId],
          set: {
            planCode,
            status: "active",
            maxActiveBatches: legacyPlan.maxActiveBatches,
            maxUsers,
            currentPeriodStart: now,
            currentPeriodEnd: nextPeriodEnd,
            updatedAt: now,
          },
        });

      await tx
        .update(farms)
        .set({
          planCode,
          updatedAt: now,
        })
        .where(eq(farms.id, payment.farmId));
    }
  });

  const subscription = await runWithFarmContext(payment.farmId, () =>
    getFarmSubscriptionStatus(payment.farmId),
  );

  if (mappedStatus === "approved") {
    void notifyPaymentApproved({
      farmId: payment.farmId,
      farmName: subscription.farmName,
      planName: productorPurchase
        ? "Productor"
        : (PLAN_CATALOG[payment.planCode as keyof typeof PLAN_CATALOG] || PLAN_CATALOG.CICLO_60D).name,
      amountCop: payment.amountCop,
      externalReference: payment.externalReference,
      periodEnd: subscription.currentPeriodEnd,
    });
  }

  return {
    ok: true as const,
    idempotent: false,
    paymentStatus: mappedStatus,
    subscription,
  };
}

