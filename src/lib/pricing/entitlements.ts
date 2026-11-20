import policy from "./iwagranja-pricing-v2.3.2.json";
import type { PricingPlanKey } from "./types";

/**
 * Roles answer which modules/actions a person can use. These entitlements
 * answer how much the farm can use under its contracted commercial plan.
 */
export interface PlanEntitlements {
  plan: PricingPlanKey;
  planName: string;
  policyVersion: string;
  maxUserSeats: number | null;
  maxBeneficiaries: number | null;
  maxActiveBatchesPerSpecies: number | null;
  maxActiveLocations: number | null;
  gina: {
    messagesPerMonth: number;
    audiosPerMonth: number;
    attachmentsPerMonth: number;
    maxAudioSeconds: number;
    audioOrAttachmentUsesMessage: boolean;
    rollover: boolean;
  };
  farmModulesAvailable: true;
  aggregatorControlAvailable: false;
}

const HISTORICAL_PRODUCER_CODES = new Set([
  "CICLO_60D",
  "SEMESTRAL_PONEDORA",
  "ANUAL_20",
  "MEDIANO_MENSUAL",
  "COMERCIAL_MEDIANO",
]);

export function resolveCommercialPlan(
  planCode: string | null | undefined,
  paidAccess: boolean,
): PricingPlanKey {
  const code = String(planCode || "FREEMIUM_SEMILLA").trim().toUpperCase();
  if (code === "AGREGADOR" || code === "AGGREGATOR") return paidAccess ? "aggregator" : "free";
  if (code === "PRODUCTOR") return paidAccess ? "producer" : "free";
  if (HISTORICAL_PRODUCER_CODES.has(code)) return paidAccess ? "producer" : "free";
  return "free";
}

export function getPlanEntitlements(
  plan: PricingPlanKey,
  configuredUserSeats?: number | null,
): PlanEntitlements {
  const isFree = plan === "free";
  const gina = isFree ? policy.gina.free : policy.gina.paid;
  const maxUserSeats = isFree
    ? policy.free.users
    : plan === "producer"
      ? Math.max(1, Math.min(policy.producer.max_self_serve_users, configuredUserSeats || policy.producer.max_self_serve_users))
      : configuredUserSeats && configuredUserSeats > 0
        ? configuredUserSeats
        : null;

  return {
    plan,
    planName: plan === "free" ? "Gratis" : plan === "producer" ? "Productor" : "Organización",
    policyVersion: policy.policy_version,
    maxUserSeats,
    // Beneficiaries are not user seats. No beneficiary roster/contract quantity
    // exists in the current subscription schema, so it cannot be enforced here.
    maxBeneficiaries: null,
    maxActiveBatchesPerSpecies: isFree ? policy.free.active_batches_per_species : null,
    // Productor's location bands determine the included QR kit, not an app-wide
    // location cap. Only the Gratis plan limits active locations.
    maxActiveLocations: isFree ? policy.free.locations : null,
    gina: {
      messagesPerMonth: gina.messages,
      audiosPerMonth: gina.audios,
      attachmentsPerMonth: gina.attachments,
      maxAudioSeconds: isFree ? policy.gina.audio_max_seconds_free : policy.gina.audio_max_seconds_paid,
      audioOrAttachmentUsesMessage: policy.gina.audio_and_attachment_also_use_a_message,
      rollover: policy.gina.quotas_rollover,
    },
    farmModulesAvailable: true,
    // The commercial offer cannot unlock a module that does not exist in the app.
    aggregatorControlAvailable: false,
  };
}

export function resolveMaxUserSeats(
  planCode: string | null | undefined,
  paidAccess: boolean,
  configuredUserSeats?: number | null,
): number {
  return getPlanEntitlements(resolveCommercialPlan(planCode, paidAccess), configuredUserSeats).maxUserSeats ?? 1;
}
