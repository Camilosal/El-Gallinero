import "server-only";

import { randomUUID } from "node:crypto";
import { buildPublicPricingCatalog } from "./catalog";
import policy from "./iwagranja-pricing-v2.3.2.json";
import { getPrivatePricingFinancialPolicy, type PrivatePricingFinancialPolicy } from "./financial-policy";
import type {
  PricingMatrix,
  PricingMatrixCell,
  PricingQuote,
  PricingSegment,
  PublicPricingOffer,
  PricingTermOption,
  PricingTierOption,
} from "./types";

export type { PricingQuote, PricingSegment } from "./types";

type QuoteInput =
  | {
      segment: "producer";
      users: number;
      months: number;
      renewal: boolean;
      locations: number;
      areasPerLocation: number;
      extraPlates: number;
      extraTrainingPackages: number;
    }
  | {
      segment: "aggregator";
      beneficiaries: number;
      months: number;
      renewal: boolean;
      farmId?: string;
      platesPerBeneficiary: number;
      extraPlates: number;
      extraTrainingPackages: number;
    };

const ALLOWED_PRODUCER_TERMS = [3, 6, 12, 18] as const;
const ALLOWED_AGGREGATOR_TERMS = [3, 6, 12] as const;

/** Plazos publicados en la política comercial vigente para cada segmento. */
export function isSupportedPricingTerm(segment: PricingSegment, months: number): boolean {
  if (!Number.isSafeInteger(months)) return false;
  const allowedTerms: readonly number[] = segment === "producer" ? ALLOWED_PRODUCER_TERMS : ALLOWED_AGGREGATOR_TERMS;
  return allowedTerms.includes(months);
}
const MAX_AGGREGATOR_ESTIMATE_BENEFICIARIES = policy.interface_limits.max_aggregator_estimate_beneficiaries;
const MAX_EXTRA_PLATES = policy.interface_limits.max_extra_plates_per_quote;
const MAX_EXTRA_TRAINING_PACKAGES = policy.interface_limits.max_extra_training_packages;
const COP_PERCENT_BASE = BigInt(10_000);

export function isSupportedPricingTerm(segment: PricingSegment, months: number): boolean {
  if (!Number.isSafeInteger(months)) return false;
  const allowedTerms: readonly number[] = segment === "producer" ? ALLOWED_PRODUCER_TERMS : ALLOWED_AGGREGATOR_TERMS;
  return allowedTerms.includes(months);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integerField(
  input: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  fallback?: number,
): number {
  const value = input[key] === undefined ? fallback : input[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${key} debe ser un entero entre ${min} y ${max}.`);
  }
  return value;
}

function booleanField(input: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = input[key] === undefined ? fallback : input[key];
  if (typeof value !== "boolean") {
    throw new Error(`${key} debe ser verdadero o falso.`);
  }
  return value;
}

function requireTerm(term: number, allowed: readonly number[], segment: string): void {
  if (!allowed.includes(term)) {
    throw new Error(`El plazo para ${segment} debe ser ${allowed.join(", ")} meses.`);
  }
}

function parseInput(value: unknown): QuoteInput {
  if (!isRecord(value)) {
    throw new Error("Los datos para calcular el costo del plan no son válidos.");
  }

  const extraPlates = integerField(value, "extraPlates", 0, MAX_EXTRA_PLATES, 0);
  const extraTrainingPackages = integerField(value, "extraTrainingPackages", 0, MAX_EXTRA_TRAINING_PACKAGES, 0);
  const months = integerField(value, "months", 1, 18);
  const renewal = booleanField(value, "renewal", false);

  if (value.segment === "producer") {
    const users = integerField(value, "users", 1, policy.producer.max_self_serve_users);
    requireTerm(months, ALLOWED_PRODUCER_TERMS, "Productor");
    const locationsEligible = Math.min(
      policy.producer.locations_per_five_users_max,
      Math.ceil(users / 5),
    );
    return {
      segment: "producer",
      users,
      months,
      renewal,
      locations: integerField(value, "locations", 0, locationsEligible, locationsEligible),
      areasPerLocation: integerField(
        value,
        "areasPerLocation",
        0,
        policy.producer.included_areas_per_location,
        policy.producer.included_areas_per_location,
      ),
      extraPlates,
      extraTrainingPackages,
    };
  }

  if (value.segment === "aggregator") {
    requireTerm(months, ALLOWED_AGGREGATOR_TERMS, "Organización");
    return {
      segment: "aggregator",
      beneficiaries: integerField(
        value,
        "beneficiaries",
        policy.aggregator.minimum_paid_beneficiaries,
        MAX_AGGREGATOR_ESTIMATE_BENEFICIARIES,
      ),
      months,
      renewal,
      platesPerBeneficiary: integerField(
        value,
        "platesPerBeneficiary",
        1,
        policy.aggregator.assumed_locations_per_beneficiary * (1 + policy.aggregator.assumed_areas_per_location),
        policy.aggregator.assumed_locations_per_beneficiary * (1 + policy.aggregator.assumed_areas_per_location),
      ),
      extraPlates,
      extraTrainingPackages,
    };
  }

  throw new Error("Selecciona Mi granja u Organización y proyectos.");
}

function tierSum(
  quantity: number,
  tiers: Array<{ count: number | null; [key: string]: number | null }>,
  priceKey: string,
): number {
  let remaining = quantity;
  let total = 0;
  for (const tier of tiers) {
    const available = tier.count;
    const taken = available === null ? remaining : Math.min(remaining, available);
    total += taken * (tier[priceKey] ?? 0);
    remaining -= taken;
    if (remaining === 0) return total;
  }
  if (remaining !== 0) throw new Error("La política de precios no cubre esa cantidad.");
  return total;
}

function discountBasisPoints(value: number): number {
  return Math.round(value * Number(COP_PERCENT_BASE));
}

function applyDiscounts(amount: number, ...discounts: number[]): number {
  let numerator = BigInt(amount);
  let denominator = BigInt(1);
  for (const discount of discounts) {
    numerator *= COP_PERCENT_BASE - BigInt(discount);
    denominator *= COP_PERCENT_BASE;
  }
  return Number((numerator + denominator / BigInt(2)) / denominator);
}

function roundDivisionHalfUp(amount: number, divisor: number): number {
  const bigDivisor = BigInt(divisor);
  return Number((BigInt(amount) + bigDivisor / BigInt(2)) / bigDivisor);
}

function ceilToStep(amount: number, step: number): number {
  return Math.ceil(amount / step) * step;
}

function qrBatchCost(quantity: number, financialPolicy: PrivatePricingFinancialPolicy): number {
  if (quantity === 0) return 0;
  const tier = financialPolicy.qr_supplier_whole_batch_tiers.find(
    (item) => item.max_quantity === null || quantity <= item.max_quantity,
  );
  if (!tier) throw new Error("No hay un tramo de impresión configurado para esta cantidad.");
  return quantity * tier.cost_each_cop;
}

function extraPlateSale(quantity: number): number {
  return tierSum(quantity, policy.qr.extra_plate_customer_marginal_tiers, "price_each");
}

function ginaQuota(paid: boolean) {
  const quota = paid ? policy.gina.paid : policy.gina.free;
  return {
    queriesPerUser: quota.messages,
    audiosPerUser: quota.audios,
    attachmentsPerUser: quota.attachments,
    maxAudioSeconds: paid ? policy.gina.audio_max_seconds_paid : policy.gina.audio_max_seconds_free,
    audioOrAttachmentUsesQuery: policy.gina.audio_and_attachment_also_use_a_message,
  };
}

function producerLocationCapacity(users: number): number {
  return Math.min(policy.producer.locations_per_five_users_max, Math.ceil(users / 5));
}

function tierOptions(
  tiers: Array<{ count: number | null; [key: string]: number | null }>,
  priceKey: string,
): PricingTierOption[] {
  let nextFrom = 1;
  return tiers.map((tier) => {
    const option = {
      from: nextFrom,
      to: tier.count === null ? null : nextFrom + tier.count - 1,
      priceCop: tier[priceKey] ?? 0,
    };
    if (tier.count !== null) nextFrom += tier.count;
    return option;
  });
}

function termOptions(
  discounts: Record<string, number>,
): PricingTermOption[] {
  return Object.entries(discounts).map(([months, discount]) => ({
    months: Number(months),
    discountPct: Math.round(discount * 100),
  }));
}

function locationBands(): PublicPricingOffer["producer"]["locationBands"] {
  const bands: PublicPricingOffer["producer"]["locationBands"] = [];
  let start = 1;
  let current = producerLocationCapacity(start);
  for (let users = 2; users <= policy.producer.max_self_serve_users; users += 1) {
    const capacity = producerLocationCapacity(users);
    if (capacity !== current) {
      bands.push({ minUsers: start, maxUsers: users - 1, maxLocations: current });
      start = users;
      current = capacity;
    }
  }
  bands.push({ minUsers: start, maxUsers: policy.producer.max_self_serve_users, maxLocations: current });
  return bands;
}

function calculateSubscription(
  segment: PricingSegment,
  quantity: number,
  effectiveUnits: number,
  months: number,
  renewal: boolean,
) {
  const planPolicy = segment === "producer" ? policy.producer : policy.aggregator;
  const tiers = segment === "producer" ? policy.producer.seat_tiers : policy.aggregator.tiers;
  const monthlyAfterVolume = tierSum(quantity, tiers, "unit_price");
  const firstTierPrice = tiers[0]?.unit_price ?? 0;
  const baseReferenceMonthly = quantity * firstTierPrice;
  const baseReferencePeriod = baseReferenceMonthly * months;
  const volumeAdjustedPeriod = monthlyAfterVolume * months;
  const durationDiscount = discountBasisPoints(
    planPolicy.duration_discounts[String(months) as keyof typeof planPolicy.duration_discounts],
  );
  const afterDuration = applyDiscounts(volumeAdjustedPeriod, durationDiscount);
  const loyaltyEligible = renewal && planPolicy.renewal_discount_terms.includes(months);
  const loyaltyDiscount = loyaltyEligible
    ? discountBasisPoints(planPolicy.renewal_discount)
    : 0;
  // Apply the renewal incentive to the already duration-discounted subtotal.
  // Rounding at each contractual step keeps the disclosed savings additive in COP.
  const periodTotal = applyDiscounts(afterDuration, loyaltyDiscount);
  const volumeSavings = baseReferencePeriod - volumeAdjustedPeriod;
  const durationSavings = volumeAdjustedPeriod - afterDuration;
  const loyaltySavings = afterDuration - periodTotal;
  const combinedSavings = baseReferencePeriod - periodTotal;

  return {
    baseReferencePeriodTotalCop: baseReferencePeriod,
    baseReferenceMonthlyCop: baseReferenceMonthly,
    volumeSavingsCop: volumeSavings,
    volumeAdjustedMonthlyCop: monthlyAfterVolume,
    durationSavingsCop: durationSavings,
    durationAdjustedMonthlyCop: roundDivisionHalfUp(afterDuration, months),
    loyaltySavingsCop: loyaltySavings,
    combinedSavingsCop: combinedSavings,
    combinedSavingsPct: baseReferencePeriod > 0
      ? Math.round((combinedSavings / baseReferencePeriod) * 10_000) / 100
      : 0,
    effectiveUnitMonthlyCop: roundDivisionHalfUp(periodTotal, effectiveUnits * months),
    grossPeriodTotalCop: volumeAdjustedPeriod,
    totalDiscountCop: volumeAdjustedPeriod - periodTotal,
    periodTotalCop: periodTotal,
    monthlyEquivalentCop: roundDivisionHalfUp(periodTotal, months),
    durationDiscountPct: Math.round(durationDiscount / 100),
    loyaltyDiscountPct: Math.round(loyaltyDiscount / 100),
  };
}

export function getPublicPricingMatrix(segment: PricingSegment): PricingMatrix {
  const offer = getPublicPricingOffer();
  const terms = segment === "producer" ? offer.producer.terms : offer.aggregator.terms;
  // These four reference quantities mark the approved volume comparisons used
  // in the commercial acceptance cases; every amount is still calculated by
  // the same backend quote engine as the selected subscription.
  const quantityOptions = segment === "producer" ? [1, 3, 10, 25] : [25, 50, 150, 500];
  const cells: PricingMatrixCell[] = quantityOptions.flatMap((quantity) => {
    const bonus = segment === "aggregator" ? bonusForBeneficiaries(quantity) : null;
    const totalActivated = quantity + (bonus?.count ?? 0);
    return terms.map(({ months }) => {
      // The comparison needs only public subscription prices. Keep it independent
      // of institutional implementation costs and private financial settings.
      const subscription = calculateSubscription(segment, quantity, totalActivated, months, false);
      return {
        quantity,
        months,
        subscriptionTotalCop: subscription.periodTotalCop,
        monthlyEquivalentCop: subscription.monthlyEquivalentCop,
        effectiveUnitMonthlyCop: subscription.effectiveUnitMonthlyCop,
        volumeSavingsCop: subscription.volumeSavingsCop,
        durationSavingsCop: subscription.durationSavingsCop,
        loyaltySavingsCop: subscription.loyaltySavingsCop,
        combinedSavingsCop: subscription.combinedSavingsCop,
        combinedSavingsPct: subscription.combinedSavingsPct,
        bonusActivations: bonus?.count,
        totalActivated: bonus ? totalActivated : undefined,
      };
    });
  });

  return { segment, quantityOptions, terms, cells, policyVersion: offer.policyVersion };
}

export function getPublicPricingOffer(): PublicPricingOffer {
  const extraPlateTiers = policy.qr.extra_plate_customer_marginal_tiers;
  const producerGina = ginaQuota(true);
  const aggregatorGina = ginaQuota(true);

  const offer: Omit<PublicPricingOffer, "catalog"> = {
    policyVersion: policy.policy_version,
    productName: policy.product_identity.official_product_name,
    ecosystemName: policy.product_identity.ecosystem_brand,
    currency: "COP",
    taxPolicy: {
      version: policy.tax_policy.version,
      ivaCharged: policy.tax_policy.iva_charged,
      amountCop: policy.tax_policy.amount_cop,
      publicLabel: policy.tax_policy.public_label,
    },
    maxExtraPlates: MAX_EXTRA_PLATES,
    maxExtraTrainingPackages: MAX_EXTRA_TRAINING_PACKAGES,
    free: {
      users: policy.free.users,
      locations: policy.free.locations,
      activeBatchesPerSpecies: policy.free.active_batches_per_species,
      kitIncluded: policy.free.physical_kit_included,
      gina: ginaQuota(false),
    },
    producer: {
      maxUsers: policy.producer.max_self_serve_users,
      userTiers: tierOptions(policy.producer.seat_tiers, "unit_price"),
      terms: termOptions(policy.producer.duration_discounts),
      renewalDiscountPct: Math.round(policy.producer.renewal_discount * 100),
      renewalTerms: [...policy.producer.renewal_discount_terms],
      maxLocations: policy.producer.locations_per_five_users_max,
      locationBands: locationBands(),
      includedAreasPerLocation: policy.producer.included_areas_per_location,
      physicalKitMinMonths: policy.producer.physical_kit_min_months,
      gina: producerGina,
    },
    aggregator: {
      minPaidBeneficiaries: policy.aggregator.minimum_paid_beneficiaries,
      maxEstimatorBeneficiaries: MAX_AGGREGATOR_ESTIMATE_BENEFICIARIES,
      beneficiaryTiers: tierOptions(policy.aggregator.tiers, "unit_price"),
      terms: termOptions(policy.aggregator.duration_discounts),
      bonusTiers: policy.aggregator.bonus_rates.map((item) => ({
        minimum: item.minimum,
        ratePct: Math.round(item.rate * 100),
      })),
      assumedPlatesPerBeneficiary:
        policy.aggregator.assumed_locations_per_beneficiary *
        (1 + policy.aggregator.assumed_areas_per_location),
      maxPlatesPerBeneficiary:
        policy.aggregator.assumed_locations_per_beneficiary *
        (1 + policy.aggregator.assumed_areas_per_location),
      training: {
        includedHours: policy.aggregator.initial_training_hours_total,
        virtualLiveHours: policy.aggregator.initial_training_split.virtual_live,
        portalHours: policy.aggregator.initial_training_split.portal_self_study,
        inPersonHours: policy.aggregator.initial_training_split.onsite_group,
      },
      renewalDiscountPct: Math.round(policy.aggregator.renewal_discount * 100),
      renewalTerms: [...policy.aggregator.renewal_discount_terms],
      gina: aggregatorGina,
    },
    extraPlates: extraPlateTiers.map((item) => ({
      upTo: item.count,
      priceCop: item.price_each,
    })),
    extraTraining: {
      packageHours: policy.training.extra_package_hours,
      packagePriceCop: policy.training.extra_package_sale_price,
    },
  };

  return { ...offer, catalog: buildPublicPricingCatalog(offer) };
}

function quoteProducer(input: Extract<QuoteInput, { segment: "producer" }>): PricingQuote {
  const subscription = calculateSubscription("producer", input.users, input.users, input.months, input.renewal);
  const subscriptionTotal = subscription.periodTotalCop;
  const kitIncluded = input.months >= policy.producer.physical_kit_min_months && !input.renewal;
  const includedPlates = kitIncluded
    ? input.locations * (input.areasPerLocation + 1)
    : 0;
  const extraPlatesTotal = extraPlateSale(input.extraPlates);
  const extraTrainingTotal = input.extraTrainingPackages * policy.training.extra_package_sale_price;
  const totalBeforeLogisticsAndTax = subscriptionTotal + extraPlatesTotal + extraTrainingTotal;
  const policyVersion = policy.policy_version;

  return {
    quoteId: randomUUID(),
    snapshotSchemaVersion: "iwagranja-plan-calculation-v1",
    policyVersion,
    generatedAt: new Date().toISOString(),
    currency: "COP",
    segment: "producer",
    users: input.users,
    periodMonths: input.months,
    renewal: input.renewal,
    subscription,
    implementationOnceCop: 0,
    extraPlates: { quantity: input.extraPlates, totalCop: extraPlatesTotal },
    extraTraining: {
      packages: input.extraTrainingPackages,
      hours: input.extraTrainingPackages * policy.training.extra_package_hours,
      totalCop: extraTrainingTotal,
    },
    totalBeforeLogisticsAndTaxCop: totalBeforeLogisticsAndTax,
    logistics: {
      physicalMaterials: includedPlates > 0 || input.extraPlates > 0,
      includedDispatches: includedPlates > 0 || input.extraPlates > 0 ? 1 : 0,
      coverage: includedPlates > 0 || input.extraPlates > 0
        ? "Un despacho a un punto en ciudad capital; zonas apartadas, visitas o puntos adicionales se confirman aparte antes de contratar."
        : "Este cálculo no incluye materiales físicos ni despacho.",
      additionalOrRemoteNeedsQuote: includedPlates > 0 || input.extraPlates > 0,
    },
    taxes: {
      calculated: true,
      applicable: policy.tax_policy.iva_charged,
      includedInTotal: true,
      amountCop: policy.tax_policy.amount_cop,
      policyVersion: policy.tax_policy.version,
      status: policy.tax_policy.public_label,
    },
    contracting: {
      prepaidPeriod: true,
      autoRenewal: false,
      conditionsAccepted: false,
      conditionsRecorded: false,
      note: "El cálculo por sí solo no inicia el cobro ni activa la suscripción. Al continuar se solicitará aceptación expresa y pago.",
    },
    gina: ginaQuota(true),
    kit: {
      locationsEligible: producerLocationCapacity(input.users),
      locationsSelected: input.locations,
      locationsIncludedNow: kitIncluded ? input.locations : 0,
      areasPerLocation: input.areasPerLocation,
      includedPlates,
    },
    training: { includedHours: 0, virtualLiveHours: 0, portalHours: 0, inPersonHours: 0 },
    notes: [
      "La suscripción se prepaga por el plazo elegido; el equivalente mensual es informativo.",
      input.months < policy.producer.physical_kit_min_months
        ? "El plazo de un mes no incluye kit físico."
        : input.renewal
          ? "La renovación no repite activación ni kit; las ampliaciones se calculan por separado."
          : "El kit se calcula con las localizaciones y áreas declaradas, hasta el máximo del tramo.",
    ],
  };
}

function bonusForBeneficiaries(paid: number): { count: number; percent: number } {
  const tier = [...policy.aggregator.bonus_rates]
    .reverse()
    .find((item) => paid >= item.minimum);
  if (!tier) throw new Error("Organización: se requieren al menos 25 beneficiarios pagos.");
  const rateBasisPoints = discountBasisPoints(tier.rate);
  return {
    count: Math.max(1, Math.floor((paid * rateBasisPoints) / Number(COP_PERCENT_BASE))),
    percent: Math.round(tier.rate * 100),
  };
}

function quoteAggregator(input: Extract<QuoteInput, { segment: "aggregator" }>): PricingQuote {
  const financialPolicy = getPrivatePricingFinancialPolicy(policy.financial_policy_version);
  const bonus = bonusForBeneficiaries(input.beneficiaries);
  const totalActivated = input.beneficiaries + bonus.count;
  const subscription = calculateSubscription("aggregator", input.beneficiaries, totalActivated, input.months, input.renewal);
  const subscriptionTotal = subscription.periodTotalCop;
  const kitPlates = input.renewal ? 0 : totalActivated * input.platesPerBeneficiary;
  const extraPlatesTotal = extraPlateSale(input.extraPlates);
  const extraTrainingTotal = input.extraTrainingPackages * policy.training.extra_package_sale_price;

  const recurringCost =
    totalActivated *
    input.months *
    (financialPolicy.cost_assumptions.gina_monthly_per_user_cop +
      financialPolicy.cost_assumptions.infrastructure_and_virtual_support_monthly_per_user_cop);
  const activationCost = input.renewal
    ? 0
    : totalActivated * financialPolicy.cost_assumptions.initial_activation_cost_once_per_new_user_cop;
  const kitAndExtraPlateCost = qrBatchCost(kitPlates + input.extraPlates, financialPolicy);
  const trainingCost = input.renewal ? 0 : financialPolicy.aggregator.initial_training_internal_cost_cop;
  const directCost = recurringCost + activationCost + kitAndExtraPlateCost + trainingCost;

  let implementation = 0;
  if (!input.renewal) {
    const requiredRevenue = Math.ceil(
      (directCost * Number(COP_PERCENT_BASE)) /
        (Number(COP_PERCENT_BASE) - financialPolicy.aggregator.minimum_direct_margin_basis_points),
    );
    const minimumImplementation = Math.max(
      0,
      requiredRevenue - (subscriptionTotal + extraPlatesTotal),
    );
    const roundedMinimum = ceilToStep(minimumImplementation, financialPolicy.aggregator.implementation_rounding_step_cop);
    const reference =
      financialPolicy.aggregator.implementation_fee_reference_cop[String(input.beneficiaries)] ?? 0;
    implementation = Math.max(roundedMinimum, reference);
  }

  const contractTotal = subscriptionTotal + implementation + extraPlatesTotal;
  const policyVersion = policy.policy_version;
  return {
    quoteId: randomUUID(),
    snapshotSchemaVersion: "iwagranja-plan-calculation-v1",
    policyVersion,
    generatedAt: new Date().toISOString(),
    currency: "COP",
    segment: "aggregator",
    periodMonths: input.months,
    renewal: input.renewal,
    subscription,
    implementationOnceCop: implementation,
    extraPlates: { quantity: input.extraPlates, totalCop: extraPlatesTotal },
    extraTraining: {
      packages: input.extraTrainingPackages,
      hours: input.extraTrainingPackages * policy.training.extra_package_hours,
      totalCop: extraTrainingTotal,
    },
    totalBeforeLogisticsAndTaxCop: contractTotal + extraTrainingTotal,
    logistics: {
      physicalMaterials: kitPlates > 0 || input.extraPlates > 0,
      includedDispatches: kitPlates > 0 || input.extraPlates > 0 ? 1 : 0,
      coverage: kitPlates > 0 || input.extraPlates > 0
        ? "Un despacho consolidado a un punto en ciudad capital; zonas apartadas, visitas o puntos adicionales se confirman aparte antes de contratar."
        : "Este cálculo no incluye materiales físicos ni despacho.",
      additionalOrRemoteNeedsQuote: kitPlates > 0 || input.extraPlates > 0,
    },
    taxes: {
      calculated: true,
      applicable: policy.tax_policy.iva_charged,
      includedInTotal: true,
      amountCop: policy.tax_policy.amount_cop,
      policyVersion: policy.tax_policy.version,
      status: policy.tax_policy.public_label,
    },
    contracting: {
      prepaidPeriod: true,
      autoRenewal: false,
      conditionsAccepted: false,
      conditionsRecorded: false,
      note: input.renewal
        ? "El cálculo no inicia el cobro. La renovación y el tamaño de la cohorte se confirman al revisar el contrato institucional asociado al FarmID."
        : "El cálculo por sí solo no inicia el cobro ni activa la suscripción. La contratación de Organización requiere validación institucional.",
    },
    gina: ginaQuota(true),
    kit: {
      locationsIncludedNow: 0,
      includedPlates: 0,
      estimatedPlates: kitPlates,
      platesPerBeneficiary: input.platesPerBeneficiary,
      assumedLocationsPerBeneficiary: policy.aggregator.assumed_locations_per_beneficiary,
      assumedAreasPerLocation: policy.aggregator.assumed_areas_per_location,
    },
    beneficiaries: {
      paid: input.beneficiaries,
      bonus: bonus.count,
      totalActivated,
      bonusPct: bonus.percent,
    },
    training: {
      includedHours: input.renewal ? 0 : policy.aggregator.initial_training_hours_total,
      virtualLiveHours: input.renewal ? 0 : policy.aggregator.initial_training_split.virtual_live,
      portalHours: input.renewal ? 0 : policy.aggregator.initial_training_split.portal_self_study,
      inPersonHours: input.renewal ? 0 : policy.aggregator.initial_training_split.onsite_group,
    },
    notes: [
      "La suscripción se prepaga por el plazo elegido; el equivalente mensual es informativo.",
      input.renewal
        ? "La renovación de la misma cohorte no repite implementación, formación inicial ni kit."
        : "La implementación es única y protege el alcance institucional; no se cobra de nuevo al renovar la misma cohorte.",
      ...(!input.renewal
        ? ["El kit se estima con las placas indicadas por beneficiario; confirma localizaciones y áreas antes de imprimir."]
        : []),
    ],
  };
}

export function createPricingQuote(value: unknown): PricingQuote {
  const input = parseInput(value);
  return input.segment === "producer" ? quoteProducer(input) : quoteAggregator(input);
}
