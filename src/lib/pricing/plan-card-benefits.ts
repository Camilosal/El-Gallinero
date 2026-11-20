import type { PricingCatalogBenefit, PricingPlanKey, PublicPricingOffer } from "@/lib/pricing/types";

const CARD_BENEFITS: Record<PricingPlanKey, string[]> = {
  free: ["farm-operations", "gina-monthly-quotas", "training-portal", "support-channel"],
  producer: ["farm-operations", "gina-monthly-quotas", "physical-qr-kit", "training-portal", "support-channel"],
  aggregator: ["farm-operations", "gina-monthly-quotas", "physical-qr-kit", "training-portal", "support-channel"],
};

export function getPricingPlanCardBenefits(
  offer: PublicPricingOffer,
  plan: PricingPlanKey,
): string[] {
  return CARD_BENEFITS[plan]
    .map((key) => offer.catalog.benefits.find((benefit) => benefit.id === key))
    .filter((benefit): benefit is PricingCatalogBenefit => benefit !== undefined)
    .map((benefit) => benefit.coverage[plan].summary);
}
