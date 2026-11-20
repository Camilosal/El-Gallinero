import crypto from "node:crypto";
import { and, desc, eq, gt, inArray, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { billingPayments, broilerBatches, farmLocations, farmSubscriptionEvents, farmSubscriptions, farms } from "@/db/schema";
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

export type SubscriptionApprovalEventType =
  | "subscription_activated"
  | "subscription_renewed"
  | "subscription_reactivated";

export function getSubscriptionApprovalEventType(
  existingSubscription: Pick<typeof farmSubscriptions.$inferSelect, "planCode" | "status" | "currentPeriodEnd"> | undefined,
  now: Date,
): SubscriptionApprovalEventType {
  if (
    existingSubscription &&
    existingSubscription.planCode !== "FREEMIUM_SEMILLA" &&
    (existingSubscription.status === "active" || existingSubscription.status === "grace") &&
    existingSubscription.currentPeriodEnd &&
    existingSubscription.currentPeriodEnd.getTime() > now.getTime()
  ) {
    return "subscription_renewed";
  }

  if (existingSubscription?.planCode !== "FREEMIUM_SEMILLA" && existingSubscription?.status === "expired") {
    return "subscription_reactivated";
  }

  return "subscription_activated";
}

/** Legacy limits and periods remain for existing subscription IDs; public labels and new offers use current entitlements. */
export const PLAN_CATALOG: Record<Exclude<BillingPlanCode, "FREEMIUM_SEMILLA">, BillingPlanDefinition> = {
  CICLO_60D: {
    code: "CICLO_60D",
    name: "Productor",
    amountCop: 45000,
    durationDays: 60,
    maxActiveBatches: null,
    maxUsers: 3,
  },
  SEMESTRAL_PONEDORA: {
    code: "SEMESTRAL_PONEDORA",
    name: "Productor",
    amountCop: 120000,
    durationDays: 180,
    maxActiveBatches: null,
    maxUsers: 3,
  },
  ANUAL_20: {
    code: "ANUAL_20",
    name: "Productor",
    amountCop: 210000,
    durationDays: 365,
    maxActiveBatches: null,
    maxUsers: 5,
  },
  MEDIANO_MENSUAL: {
    code: "MEDIANO_MENSUAL",
    name: "Productor",
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
    createdAtCursor: string;
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
    eventsSecret: process.env.WOMPI_EVENTS_SECRET?.trim() || null,
  };
}

function getWompiEnvironment(): { app: "sandbox" | "production"; event: "test" | "prod" } | null {
  const configured = process.env.WOMPI_ENVIRONMENT?.trim().toLowerCase();
  const appEnvironment = process.env.NODE_ENV === "production" ? "production" : "sandbox";
  if (configured !== appEnvironment) return null;
  return appEnvironment === "production"
    ? { app: "production", event: "prod" }
    : { app: "sandbox", event: "test" };
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
      .select({
        id: billingPayments.id,
        externalReference: billingPayments.externalReference,
        method: billingPayments.method,
        amountCop: billingPayments.amountCop,
        planCode: billingPayments.planCode,
        status: billingPayments.status,
        paidAt: billingPayments.paidAt,
        createdAt: billingPayments.createdAt,
        createdAtCursor: sql<string>`${billingPayments.createdAt}::text`,
      })
      .from(billingPayments)
      .where(eq(billingPayments.farmId, farmId))
      .orderBy(desc(billingPayments.createdAt), desc(billingPayments.id))
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

  const hasExpiredPaidSubscription = Boolean(
    subRow &&
    subRow.planCode !== "FREEMIUM_SEMILLA" &&
    (subRow.status === "expired" || (subRow.status === "active" && periodExpired)),
  );

  const isPostTrialFreemium =
    !isLegacyOrSelfHosted &&
    !isPaidActive &&
    !isActiveTrial &&
    (subRow?.status === "expired" || periodExpired || trialExpired || Boolean(subRow));

  const effectiveStatus: FarmSubscriptionStatus["status"] = isPaidActive
    ? "active"
    : isActiveTrial
      ? "trial"
      : hasExpiredPaidSubscription
        ? "expired"
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
      createdAtCursor: p.createdAtCursor,
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
  const secret = eventsSecretOverride?.trim() || getWompiSecrets().eventsSecret;
  if (!secret) return false;
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
  environment: "sandbox" | "production";
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
    (data.environment !== "sandbox" && data.environment !== "production") ||
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
    environment: data.environment,
    quote: {
      segment: "producer",
      users: quoteData.users as number,
      periodMonths: quoteData.periodMonths as number,
      totalBeforeLogisticsAndTaxCop: quoteData.totalBeforeLogisticsAndTaxCop as number,
    },
  };
}

/** Marks a paid subscription expired at its existing end date and records that transition once. */
export async function expirePaidSubscriptionForFarm(farmId: string, now = new Date()): Promise<boolean> {
  return runWithFarmContext(farmId, () => db.transaction(async (tx) => {
    const [existingSubscription] = await tx
      .select()
      .from(farmSubscriptions)
      .where(and(
        eq(farmSubscriptions.farmId, farmId),
        ne(farmSubscriptions.planCode, "FREEMIUM_SEMILLA"),
        eq(farmSubscriptions.status, "active"),
        lte(farmSubscriptions.currentPeriodEnd, now),
      ))
      .limit(1);
    if (!existingSubscription?.currentPeriodEnd) return false;

    const [expiredSubscription] = await tx
      .update(farmSubscriptions)
      .set({ status: "expired", updatedAt: now })
      .where(and(
        eq(farmSubscriptions.id, existingSubscription.id),
        eq(farmSubscriptions.status, "active"),
        lte(farmSubscriptions.currentPeriodEnd, now),
      ))
      .returning();
    if (!expiredSubscription) return false;

    const [latestPayment] = await tx
      .select({
        id: billingPayments.id,
        externalReference: billingPayments.externalReference,
        rawPayload: billingPayments.rawPayload,
      })
      .from(billingPayments)
      .where(and(
        eq(billingPayments.farmId, farmId),
        eq(billingPayments.planCode, existingSubscription.planCode),
        eq(billingPayments.status, "approved"),
      ))
      .orderBy(desc(billingPayments.paidAt), desc(billingPayments.createdAt))
      .limit(1);
    const purchase = getProductorPurchaseSnapshot(latestPayment?.rawPayload ?? null);
    const beforeSnapshot = {
      planCode: existingSubscription.planCode,
      status: existingSubscription.status,
      maxUsers: existingSubscription.maxUsers,
      maxActiveBatches: existingSubscription.maxActiveBatches,
      currentPeriodStart: existingSubscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: existingSubscription.currentPeriodEnd.toISOString(),
    };
    const afterSnapshot = { ...beforeSnapshot, status: expiredSubscription.status };

    await tx.insert(farmSubscriptionEvents).values({
      farmId,
      subscriptionId: existingSubscription.id,
      eventKey: `subscription-expired:${existingSubscription.id}:${existingSubscription.currentPeriodEnd.toISOString()}`,
      eventType: "subscription_expired",
      actorType: "system",
      source: "subscription_expiry_cron",
      reason: "Terminó el período contratado. El plan vuelve a Gratis y no se renueva automáticamente.",
      beforeSnapshot,
      afterSnapshot,
      policyVersion: purchase?.policyVersion ?? null,
      termsVersion: purchase?.termsVersion ?? null,
      paymentId: latestPayment?.id ?? null,
      externalReference: latestPayment?.externalReference ?? null,
      resultStatus: "applied",
      occurredAt: now,
    });

    return true;
  }));
}

export function addCalendarMonths(value: Date, months: number): Date {
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
  const eventsSecret = getWompiSecrets().eventsSecret;
  if (!eventsSecret) {
    return { ok: false as const, status: 503, error: "El webhook de pagos no está configurado." };
  }
  if (!verifyWompiWebhookSignature(payload, headerChecksum, eventsSecret)) {
    return { ok: false as const, status: 401, error: "Firma de webhook Wompi inválida." };
  }
  return processVerifiedWompiPaymentPayload(payload);
}

export async function processReservationsPaymentResult(event: Record<string, unknown>) {
  if (event.sourceApp !== "iwagranja" || event.purpose !== "subscription" || event.provider !== "wompi") {
    const reference = typeof event.reference === "string" ? event.reference.trim() : "";
    const providerTxId = typeof event.providerTransactionId === "string" ? event.providerTransactionId.trim() : "";
    if (reference && providerTxId && providerTxId.length <= 120) {
      const [payment] = await db
        .select()
        .from(billingPayments)
        .where(eq(billingPayments.externalReference, reference))
        .limit(1);
      if (payment) {
        await recordPaymentReviewRequired(
          payment,
          providerTxId,
          typeof event.status === "string" ? event.status : "UNKNOWN",
          "reservas_delivery",
          "El mensaje firmado de Reservas tiene datos de origen o propósito inesperados; requiere conciliación.",
          { envelopeValid: false },
        );
        return {
          ok: true as const,
          reviewRequired: true,
          paymentStatus: payment.status,
        };
      }
    }
    return { ok: false as const, status: 400, error: "El resultado no corresponde a una suscripción de IwaGranja." };
  }

  const transaction = {
    id: event.providerTransactionId,
    reference: event.reference,
    status: event.status,
    amount_in_cents: event.amountInCents,
    currency: event.currency,
    finalized_at: event.paidAt,
  };
  return processVerifiedWompiPaymentPayload({
    environment: event.environment,
    timestamp: Math.floor(Date.now() / 1000),
    data: { transaction },
    sourceApp: event.sourceApp,
    eventId: event.eventId,
  });
}

function isUniqueConstraintViolation(error: unknown): boolean {
  const seen = new Set<object>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as {
      code?: unknown;
      cause?: unknown;
      original?: unknown;
      parent?: unknown;
    };
    if (candidate.code === "23505") return true;
    current = candidate.cause ?? candidate.original ?? candidate.parent;
  }

  return false;
}

async function recordPaymentReviewRequired(
  payment: typeof billingPayments.$inferSelect,
  providerTxId: string,
  providerStatus: string,
  source: "reservas_delivery" | "wompi_webhook",
  reason: string,
  details: Record<string, unknown> = {},
) {
  await runWithFarmContext(payment.farmId, () => db
    .insert(farmSubscriptionEvents)
    .values({
      farmId: payment.farmId,
      eventKey: `payment-review:${payment.id}:${providerTxId}`,
      eventType: "payment_review_required",
      actorType: "system",
      source,
      reason,
      beforeSnapshot: { paymentStatus: payment.status },
      afterSnapshot: {
        paymentStatus: payment.status,
        reviewRequired: true,
        providerStatus: providerStatus.replace(/[^A-Z0-9_-]/g, "_").slice(0, 64) || "UNKNOWN",
        providerTxId,
        ...details,
      },
      paymentId: payment.id,
      externalReference: payment.externalReference,
      resultStatus: "review_required",
    })
    .onConflictDoNothing());
}

async function processVerifiedWompiPaymentPayload(payload: Record<string, unknown>) {
  const expectedEnvironment = getWompiEnvironment();
  if (!expectedEnvironment) {
    return { ok: false as const, status: 503, error: "El ambiente del canal de pagos no está configurado correctamente." };
  }
  const dataNode = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>;
  const txNode = (dataNode.transaction && typeof dataNode.transaction === "object"
    ? dataNode.transaction
    : dataNode) as Record<string, unknown>;

  const reference = String(txNode.reference || "").trim();
  const providerTxId = txNode.id ? String(txNode.id) : null;
  const rawStatus = String(txNode.status || "").trim().toUpperCase();

  if (!reference) {
    if (payload.environment !== expectedEnvironment.event) {
      return { ok: false as const, status: 409, error: "El evento pertenece a otro ambiente de Wompi." };
    }
    return { ok: false as const, status: 400, error: "Referencia de transacción ausente." };
  }
  if (!providerTxId || providerTxId.length > 120) {
    if (payload.environment !== expectedEnvironment.event) {
      return { ok: false as const, status: 409, error: "El evento pertenece a otro ambiente de Wompi." };
    }
    return { ok: false as const, status: 400, error: "Identificador de transacción ausente." };
  }

  const [payment] = await db
    .select()
    .from(billingPayments)
    .where(eq(billingPayments.externalReference, reference))
    .limit(1);

  if (!payment) {
    return { ok: false as const, status: 404, error: "Pago no encontrado para la referencia enviada." };
  }
  if (payload.environment !== expectedEnvironment.event) {
    await recordPaymentReviewRequired(
      payment,
      providerTxId,
      rawStatus,
      typeof payload.eventId === "string" ? "reservas_delivery" : "wompi_webhook",
      "El resultado firmado pertenece a un ambiente distinto del configurado; requiere conciliación.",
      {
        environmentMatches: false,
        receivedEnvironment: typeof payload.environment === "string"
          ? payload.environment.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 16)
          : "missing",
      },
    );
    return {
      ok: true as const,
      reviewRequired: true,
      paymentStatus: payment.status,
    };
  }
  const eventAmountInCents = Number(txNode.amount_in_cents);
  const eventCurrency = String(txNode.currency ?? "").toUpperCase();
  if (
    !Number.isSafeInteger(eventAmountInCents) ||
    eventAmountInCents !== payment.amountCop * 100 ||
    eventCurrency !== "COP"
  ) {
    await recordPaymentReviewRequired(
      payment,
      providerTxId,
      rawStatus,
      typeof payload.eventId === "string" ? "reservas_delivery" : "wompi_webhook",
      "El importe o la moneda informados por el procesador no coinciden con el pago registrado; requiere conciliación.",
      {
        amountMatches: Number.isSafeInteger(eventAmountInCents) && eventAmountInCents === payment.amountCop * 100,
        currencyMatches: eventCurrency === "COP",
      },
    );
    return {
      ok: true as const,
      reviewRequired: true,
      paymentStatus: payment.status,
    };
  }
  const mappedStatus = rawStatus === "APPROVED"
    ? "approved"
    : rawStatus === "PENDING"
      ? "pending"
      : rawStatus === "DECLINED"
        ? "declined"
        : rawStatus === "ERROR"
          ? "error"
          : rawStatus === "VOIDED"
            ? "voided"
            : "review";

  type TransitionResult =
    | { kind: "error"; status: number; error: string }
    | { kind: "reviewed"; paymentStatus: string }
    | { kind: "accepted"; paymentStatus: string; idempotent: boolean; activated: boolean; reviewRequired?: boolean };

  let transition: TransitionResult;
  try {
    transition = await runWithFarmContext(payment.farmId, () => db.transaction(async (tx) => {
      const [currentPayment] = await tx
        .select()
        .from(billingPayments)
        .where(eq(billingPayments.id, payment.id))
        .limit(1);
      if (!currentPayment) {
        return { kind: "error", status: 404, error: "El pago ya no está disponible para actualizar." };
      }

      const recordReview = async (reason: string, afterPaymentStatus = currentPayment.status) => tx
        .insert(farmSubscriptionEvents)
        .values({
          farmId: currentPayment.farmId,
          eventKey: `payment-review:${currentPayment.id}:${providerTxId}`,
          eventType: "payment_review_required",
          actorType: "system",
          source: typeof payload.eventId === "string" ? "reservas_delivery" : "wompi_webhook",
          reason,
          beforeSnapshot: { paymentStatus: currentPayment.status },
          afterSnapshot: {
            paymentStatus: afterPaymentStatus,
            reviewRequired: true,
            providerStatus: (rawStatus || "UNKNOWN").replace(/[^A-Z0-9_-]/g, "_").slice(0, 64),
            providerTxId,
          },
          paymentId: currentPayment.id,
          externalReference: currentPayment.externalReference,
          resultStatus: "review_required",
        })
        .onConflictDoNothing();

      if (currentPayment.providerTxId && currentPayment.providerTxId !== providerTxId) {
        await recordReview("La referencia ya tiene otra transacción asociada; el resultado requiere conciliación.");
        return { kind: "reviewed", paymentStatus: currentPayment.status };
      }

      const [transactionOwner] = await tx
        .select({ id: billingPayments.id })
        .from(billingPayments)
        .where(and(
          eq(billingPayments.provider, currentPayment.provider),
          eq(billingPayments.providerTxId, providerTxId),
          ne(billingPayments.id, currentPayment.id),
        ))
        .limit(1);
      if (transactionOwner) {
        await recordReview("La transacción ya está asociada a otro pago; se requiere revisión manual.");
        return { kind: "reviewed", paymentStatus: currentPayment.status };
      }

      if (payment.planCode === "PRODUCTOR") {
        const productorPurchase = getProductorPurchaseSnapshot(currentPayment.rawPayload);
        if (
          !productorPurchase ||
          productorPurchase.environment !== expectedEnvironment.app ||
          productorPurchase.quote.totalBeforeLogisticsAndTaxCop !== currentPayment.amountCop
        ) {
          await recordReview("No se pudo validar el snapshot aceptado de la compra; la suscripción no se modificó.");
          return { kind: "reviewed", paymentStatus: currentPayment.status };
        }
      }

      if (currentPayment.status === "approved") {
        if (mappedStatus === "approved" || mappedStatus === "pending") {
          return { kind: "accepted", paymentStatus: "approved", idempotent: true, activated: false };
        }
        await recordReview("Wompi notificó un estado distinto después de la aprobación; se conserva el acceso hasta revisar el caso.");
        return { kind: "reviewed", paymentStatus: currentPayment.status };
      }

      const terminalStatuses = new Set(["declined", "error", "voided", "refunded"]);
      if (terminalStatuses.has(currentPayment.status) && currentPayment.status !== mappedStatus) {
        await recordReview("El pago ya tenía un estado final distinto; se requiere revisión antes de cambiar el acceso.");
        return { kind: "reviewed", paymentStatus: currentPayment.status };
      }

      if (currentPayment.status === mappedStatus) {
        if (!currentPayment.providerTxId) {
          const [linkedPayment] = await tx
            .update(billingPayments)
            .set({
              providerTxId,
              rawPayload: { ...(currentPayment.rawPayload ?? {}), latestWebhook: payload },
            })
            .where(and(
              eq(billingPayments.id, currentPayment.id),
              eq(billingPayments.status, currentPayment.status),
              sql`${billingPayments.providerTxId} IS NULL`,
            ))
            .returning();

          if (!linkedPayment) {
            const [latestPayment] = await tx
              .select()
              .from(billingPayments)
              .where(eq(billingPayments.id, currentPayment.id))
              .limit(1);
            if (latestPayment?.providerTxId !== providerTxId) {
              await recordReview("La referencia ya tiene otra transacción asociada; el resultado requiere conciliación.");
              return { kind: "reviewed", paymentStatus: latestPayment?.status ?? currentPayment.status };
            }
          }
        }
        return { kind: "accepted", paymentStatus: currentPayment.status, idempotent: true, activated: false };
      }

      // Compare-and-set makes payment approval and subscription activation a single winner under concurrent webhooks.
      const [claimedPayment] = await tx
        .update(billingPayments)
        .set({
          status: mappedStatus,
          providerTxId,
          rawPayload: { ...(currentPayment.rawPayload ?? {}), latestWebhook: payload },
          paidAt: mappedStatus === "approved"
            ? (typeof txNode.finalized_at === "string" && Number.isFinite(Date.parse(txNode.finalized_at))
              ? new Date(txNode.finalized_at)
              : new Date())
            : currentPayment.paidAt,
        })
        .where(and(eq(billingPayments.id, currentPayment.id), eq(billingPayments.status, currentPayment.status)))
        .returning();

      if (!claimedPayment) {
        const [latestPayment] = await tx
          .select()
          .from(billingPayments)
          .where(eq(billingPayments.id, currentPayment.id))
          .limit(1);
        if (
          latestPayment?.status === "approved" &&
          latestPayment.providerTxId === providerTxId &&
          mappedStatus === "pending"
        ) {
          return { kind: "accepted", paymentStatus: "approved", idempotent: true, activated: false };
        }
        if (latestPayment?.status === mappedStatus && latestPayment.providerTxId === providerTxId) {
          return { kind: "accepted", paymentStatus: latestPayment.status, idempotent: true, activated: false };
        }
        await recordReview("El estado del pago cambió durante la confirmación; el caso requiere conciliación.");
        return { kind: "reviewed", paymentStatus: latestPayment?.status ?? currentPayment.status };
      }

      if (mappedStatus === "review") {
        await recordReview("El estado del pago requiere revisión; la suscripción no se modifica hasta confirmar el resultado.", claimedPayment.status);
        return { kind: "accepted", paymentStatus: "review", idempotent: false, activated: false, reviewRequired: true };
      }

      if (mappedStatus !== "approved") {
        return { kind: "accepted", paymentStatus: mappedStatus, idempotent: false, activated: false };
      }

      const productorPurchase = payment.planCode === "PRODUCTOR"
        ? getProductorPurchaseSnapshot(claimedPayment.rawPayload)
        : null;
      const legacyPlan = PLAN_CATALOG[payment.planCode as keyof typeof PLAN_CATALOG] || PLAN_CATALOG.CICLO_60D;
      const now = new Date();
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
        .set({ planCode, updatedAt: now })
        .where(eq(farms.id, payment.farmId));

      const [updatedSubscription] = await tx
        .select()
        .from(farmSubscriptions)
        .where(eq(farmSubscriptions.farmId, payment.farmId))
        .limit(1);
      if (!updatedSubscription) {
        throw new Error("No se pudo reconstruir la suscripción después de aplicar el pago aprobado.");
      }

      const previousSnapshot = existingSub
        ? {
            planCode: existingSub.planCode,
            status: existingSub.status,
            maxUsers: existingSub.maxUsers,
            maxActiveBatches: existingSub.maxActiveBatches,
            currentPeriodStart: existingSub.currentPeriodStart?.toISOString() ?? null,
            currentPeriodEnd: existingSub.currentPeriodEnd?.toISOString() ?? null,
          }
        : null;
      const nextSnapshot = {
        planCode: updatedSubscription.planCode,
        status: updatedSubscription.status,
        maxUsers: updatedSubscription.maxUsers,
        maxActiveBatches: updatedSubscription.maxActiveBatches,
        currentPeriodStart: updatedSubscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: updatedSubscription.currentPeriodEnd?.toISOString() ?? null,
      };
      const eventType = getSubscriptionApprovalEventType(existingSub, now);

      await tx.insert(farmSubscriptionEvents).values({
        farmId: payment.farmId,
        subscriptionId: updatedSubscription.id,
        eventKey: `wompi-approved:${claimedPayment.id}`,
        eventType,
        actorType: "system",
        source: typeof payload.eventId === "string" ? "reservas_delivery" : "wompi_webhook",
        reason: "Pago confirmado. La suscripción quedó actualizada.",
        beforeSnapshot: previousSnapshot,
        afterSnapshot: nextSnapshot,
        policyVersion: productorPurchase?.policyVersion ?? null,
        termsVersion: productorPurchase?.termsVersion ?? null,
        paymentId: claimedPayment.id,
        externalReference: claimedPayment.externalReference,
        resultStatus: "applied",
        occurredAt: claimedPayment.paidAt ?? now,
      });

      return { kind: "accepted", paymentStatus: "approved", idempotent: false, activated: true };
    }));
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      await recordPaymentReviewRequired(
        payment,
        providerTxId,
        rawStatus,
        typeof payload.eventId === "string" ? "reservas_delivery" : "wompi_webhook",
        "La transacción ya está asociada a otro pago; se requiere revisión manual.",
      );
      return {
        ok: true as const,
        reviewRequired: true,
        paymentStatus: payment.status,
      };
    }
    throw error;
  }

  if (transition.kind === "error") {
    return { ok: false as const, status: transition.status, error: transition.error };
  }

  if (transition.kind === "reviewed") {
    return {
      ok: true as const,
      reviewRequired: true,
      paymentStatus: transition.paymentStatus,
    };
  }

  const subscription = await runWithFarmContext(payment.farmId, () =>
    getFarmSubscriptionStatus(payment.farmId),
  );

  if (transition.activated) {
    void notifyPaymentApproved({
      farmId: payment.farmId,
      farmName: subscription.farmName,
      planName: payment.planCode === "PRODUCTOR"
        ? "Productor"
        : getPlanEntitlements(resolveCommercialPlan(payment.planCode, true)).planName,
      amountCop: payment.amountCop,
      externalReference: payment.externalReference,
      periodEnd: subscription.currentPeriodEnd,
    });
  }

  return {
    ok: true as const,
    idempotent: transition.idempotent,
    ...(transition.reviewRequired ? { reviewRequired: true as const } : {}),
    paymentStatus: transition.paymentStatus,
    subscription,
  };
}

