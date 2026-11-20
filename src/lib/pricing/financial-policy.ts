import "server-only";

const PRIVATE_POLICY_ENV = "IWAGRANJA_PRICING_FINANCIAL_POLICY_JSON";

export interface PrivatePricingFinancialPolicy {
  policy_version: string;
  qr_supplier_whole_batch_tiers: Array<{
    max_quantity: number | null;
    cost_each_cop: number;
  }>;
  shipping: {
    standard_dispatch_cost_cop: number;
    max_probability_dispatch_producer: number;
    expected_per_new_kit_order_cop: number;
  };
  cost_assumptions: {
    reference_average_monthly_cost_per_user_initial_three_months_cop: number;
    initial_activation_cost_once_per_new_user_cop: number;
    gina_monthly_per_user_cop: number;
    infrastructure_and_virtual_support_monthly_per_user_cop: number;
    initial_activation_amortization_months_assumed: number;
  };
  aggregator: {
    initial_training_internal_cost_cop: number;
    minimum_direct_margin_basis_points: number;
    implementation_fee_reference_cop: Record<string, number>;
    implementation_rounding_step_cop: number;
  };
}

export class PricingConfigurationError extends Error {
  constructor() {
    super("El cálculo de precio institucional no está disponible temporalmente. Contacta al equipo de IwaGranja.");
    this.name = "PricingConfigurationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isValidPolicy(value: unknown, expectedVersion: string): value is PrivatePricingFinancialPolicy {
  if (!isRecord(value) || value.policy_version !== expectedVersion) return false;
  if (!Array.isArray(value.qr_supplier_whole_batch_tiers) || value.qr_supplier_whole_batch_tiers.length === 0) return false;
  if (!value.qr_supplier_whole_batch_tiers.every((tier) =>
    isRecord(tier) &&
    (tier.max_quantity === null || isPositiveInteger(tier.max_quantity)) &&
    isPositiveInteger(tier.cost_each_cop),
  )) return false;

  if (!isRecord(value.shipping) ||
    !isNonNegativeInteger(value.shipping.standard_dispatch_cost_cop) ||
    typeof value.shipping.max_probability_dispatch_producer !== "number" ||
    value.shipping.max_probability_dispatch_producer < 0 ||
    value.shipping.max_probability_dispatch_producer > 1 ||
    !isNonNegativeInteger(value.shipping.expected_per_new_kit_order_cop)) return false;

  if (!isRecord(value.cost_assumptions) ||
    !isNonNegativeInteger(value.cost_assumptions.reference_average_monthly_cost_per_user_initial_three_months_cop) ||
    !isNonNegativeInteger(value.cost_assumptions.initial_activation_cost_once_per_new_user_cop) ||
    !isNonNegativeInteger(value.cost_assumptions.gina_monthly_per_user_cop) ||
    !isNonNegativeInteger(value.cost_assumptions.infrastructure_and_virtual_support_monthly_per_user_cop) ||
    !isPositiveInteger(value.cost_assumptions.initial_activation_amortization_months_assumed)) return false;

  if (!isRecord(value.aggregator) ||
    !isNonNegativeInteger(value.aggregator.initial_training_internal_cost_cop) ||
    !isPositiveInteger(value.aggregator.minimum_direct_margin_basis_points) ||
    value.aggregator.minimum_direct_margin_basis_points >= 10_000 ||
    !isPositiveInteger(value.aggregator.implementation_rounding_step_cop) ||
    !isRecord(value.aggregator.implementation_fee_reference_cop) ||
    !Object.values(value.aggregator.implementation_fee_reference_cop).every(isNonNegativeInteger)) return false;

  return true;
}

export function getPrivatePricingFinancialPolicy(expectedVersion: string): PrivatePricingFinancialPolicy {
  const raw = process.env[PRIVATE_POLICY_ENV];
  if (!raw) throw new PricingConfigurationError();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPolicy(parsed, expectedVersion)) throw new PricingConfigurationError();
    return parsed;
  } catch (error) {
    if (error instanceof PricingConfigurationError) throw error;
    throw new PricingConfigurationError();
  }
}
