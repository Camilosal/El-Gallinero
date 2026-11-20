export type PricingSegment = "producer" | "aggregator";
export type PricingPlanKey = "free" | "producer" | "aggregator";
export type PricingCatalogCategoryKey =
  | "functionalities"
  | "gina"
  | "qr"
  | "training"
  | "accompaniment"
  | "support"
  | "conditions";
export type PricingAvailabilityState =
  | "operational"
  | "progressive"
  | "manual"
  | "policy_only"
  | "not_available";

export interface PricingCoverage {
  summary: string;
  limits: string[];
  frequency: string;
}

export interface PricingCatalogBenefit {
  id: string;
  category: PricingCatalogCategoryKey;
  name: string;
  description: string;
  unit: string;
  coverage: Record<PricingPlanKey, PricingCoverage>;
  exclusions: string[];
  addOns: string[];
  availability: {
    state: PricingAvailabilityState;
    label: string;
    detail: string;
    routes: string[];
    featureFlag?: string;
  };
}

export interface PricingCatalog {
  version: "iwagranja-catalog-v1";
  policyVersion: string;
  planEntitlementsConnected: true;
  permissionModel: string;
  contractingFlowAvailable: boolean;
  categories: Array<{
    id: PricingCatalogCategoryKey;
    label: string;
    description: string;
  }>;
  benefits: PricingCatalogBenefit[];
  auditNotes: string[];
}

export interface PricingQuote {
  quoteId: string;
  snapshotSchemaVersion: "iwagranja-plan-calculation-v1";
  policyVersion: string;
  generatedAt: string;
  currency: "COP";
  segment: PricingSegment;
  users?: number;
  periodMonths: number;
  renewal: boolean;
  subscription: {
    /** Reference price at the first marginal tier, before volume or term discounts. */
    baseReferencePeriodTotalCop: number;
    baseReferenceMonthlyCop: number;
    /** Savings from marginal volume pricing, before duration and loyalty discounts. */
    volumeSavingsCop: number;
    volumeAdjustedMonthlyCop: number;
    /** Savings from duration, applied after volume pricing. */
    durationSavingsCop: number;
    durationAdjustedMonthlyCop: number;
    /** Eligible continuity discount, applied once after the duration discount. */
    loyaltySavingsCop: number;
    /** Total savings against the first-tier reference price; never sum percentages to derive this. */
    combinedSavingsCop: number;
    combinedSavingsPct: number;
    /** Average subscription price per paid/activated unit and month, excluding one-time charges. */
    effectiveUnitMonthlyCop: number;
    grossPeriodTotalCop: number;
    totalDiscountCop: number;
    periodTotalCop: number;
    monthlyEquivalentCop: number;
    durationDiscountPct: number;
    loyaltyDiscountPct: number;
  };
  implementationOnceCop: number;
  extraPlates: { quantity: number; totalCop: number };
  extraTraining: { packages: number; hours: number; totalCop: number };
  totalBeforeLogisticsAndTaxCop: number;
  logistics: {
    physicalMaterials: boolean;
    includedDispatches: number;
    coverage: string;
    additionalOrRemoteNeedsQuote: boolean;
  };
  taxes: {
    calculated: boolean;
    applicable: boolean;
    includedInTotal: boolean;
    amountCop: number;
    policyVersion: string;
    status: string;
  };
  contracting: {
    prepaidPeriod: boolean;
    autoRenewal: false;
    conditionsAccepted: false;
    conditionsRecorded: false;
    note: string;
  };
  gina: {
    queriesPerUser: number;
    audiosPerUser: number;
    attachmentsPerUser: number;
    maxAudioSeconds: number;
    audioOrAttachmentUsesQuery: boolean;
  };
  kit: {
    locationsEligible?: number;
    locationsSelected?: number;
    locationsIncludedNow: number;
    areasPerLocation?: number;
    includedPlates: number;
    estimatedPlates?: number;
    platesPerBeneficiary?: number;
    assumedLocationsPerBeneficiary?: number;
    assumedAreasPerLocation?: number;
  };
  beneficiaries?: {
    paid: number;
    bonus: number;
    totalActivated: number;
    bonusPct: number;
  };
  training: {
    includedHours: number;
    virtualLiveHours: number;
    portalHours: number;
    inPersonHours: number;
  };
  notes: string[];
}

export interface PricingMatrixCell {
  quantity: number;
  months: number;
  subscriptionTotalCop: number;
  monthlyEquivalentCop: number;
  effectiveUnitMonthlyCop: number;
  volumeSavingsCop: number;
  durationSavingsCop: number;
  loyaltySavingsCop: number;
  combinedSavingsCop: number;
  combinedSavingsPct: number;
  bonusActivations?: number;
  totalActivated?: number;
}

export interface PricingMatrix {
  segment: PricingSegment;
  quantityOptions: number[];
  terms: PricingTermOption[];
  cells: PricingMatrixCell[];
  policyVersion: string;
}

export interface PricingTermOption {
  months: number;
  discountPct: number;
}

export interface PricingTierOption {
  from: number;
  to: number | null;
  priceCop: number;
}

export interface PublicPricingOffer {
  policyVersion: string;
  productName: string;
  ecosystemName: string;
  currency: "COP";
  taxPolicy: {
    version: string;
    ivaCharged: boolean;
    amountCop: number;
    publicLabel: string;
  };
  maxExtraPlates: number;
  maxExtraTrainingPackages: number;
  free: {
    users: number;
    locations: number;
    activeBatchesPerSpecies: number;
    kitIncluded: boolean;
    gina: PricingQuote["gina"];
  };
  producer: {
    maxUsers: number;
    userTiers: PricingTierOption[];
    terms: PricingTermOption[];
    renewalDiscountPct: number;
    renewalTerms: number[];
    maxLocations: number;
    locationBands: Array<{ minUsers: number; maxUsers: number; maxLocations: number }>;
    includedAreasPerLocation: number;
    physicalKitMinMonths: number;
    gina: PricingQuote["gina"];
  };
  aggregator: {
    minPaidBeneficiaries: number;
    maxEstimatorBeneficiaries: number;
    beneficiaryTiers: PricingTierOption[];
    terms: PricingTermOption[];
    renewalDiscountPct: number;
    renewalTerms: number[];
    bonusTiers: Array<{ minimum: number; ratePct: number }>;
    assumedPlatesPerBeneficiary: number;
    maxPlatesPerBeneficiary: number;
    training: {
      includedHours: number;
      virtualLiveHours: number;
      portalHours: number;
      inPersonHours: number;
    };
    gina: PricingQuote["gina"];
  };
  extraPlates: Array<{ upTo: number | null; priceCop: number }>;
  extraTraining: { packageHours: number; packagePriceCop: number };
  catalog: PricingCatalog;
}
