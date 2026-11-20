import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  FEATURE_FLAG_CATALOG,
  PROGRESSIVE_ROUTE_GATES,
  PROGRESSIVE_UNLOCKABLE_KEYS,
  getGateFlagForHref,
  isHrefEnabledByFlags,
} from "@/lib/onboarding";
import { canPerformAction } from "@/lib/rbac";
import { getApiPermission, hasApiPermission } from "@/lib/api-rbac";
import { createPricingQuote, getPublicPricingMatrix, getPublicPricingOffer } from "@/lib/pricing/quote";

const TEST_FINANCIAL_POLICY = {
  policy_version: "iwagranja-v2.3-2026-11-19",
  qr_supplier_whole_batch_tiers: [
    { max_quantity: 20, cost_each_cop: 1 },
    { max_quantity: 50, cost_each_cop: 1 },
    { max_quantity: null, cost_each_cop: 1 },
  ],
  shipping: {
    standard_dispatch_cost_cop: 0,
    max_probability_dispatch_producer: 0,
    expected_per_new_kit_order_cop: 0,
  },
  cost_assumptions: {
    reference_average_monthly_cost_per_user_initial_three_months_cop: 1,
    initial_activation_cost_once_per_new_user_cop: 1,
    gina_monthly_per_user_cop: 1,
    infrastructure_and_virtual_support_monthly_per_user_cop: 1,
    initial_activation_amortization_months_assumed: 1,
  },
  aggregator: {
    initial_training_internal_cost_cop: 1,
    minimum_direct_margin_basis_points: 3500,
    implementation_fee_reference_cop: { "25": 700000, "50": 1000000, "150": 2500000, "500": 9500000 },
    implementation_rounding_step_cop: 50000,
  },
};

beforeEach(() => {
  vi.stubEnv("IWAGRANJA_PRICING_FINANCIAL_POLICY_JSON", JSON.stringify(TEST_FINANCIAL_POLICY));
});

afterEach(() => vi.unstubAllEnvs());

describe("catálogo comercial, cálculo de planes y permisos de la aplicación", () => {
  it("deriva los niveles, plazos y límites de la misma oferta que usa la calculadora", () => {
    const offer = getPublicPricingOffer();
    const producer = createPricingQuote({
      segment: "producer",
      users: 1,
      months: 3,
      renewal: false,
      locations: 1,
      areasPerLocation: 3,
      extraPlates: 0,
      extraTrainingPackages: 0,
    });
    const aggregator = createPricingQuote({
      segment: "aggregator",
      beneficiaries: 25,
      months: 3,
      renewal: false,
      platesPerBeneficiary: 4,
      extraPlates: 0,
      extraTrainingPackages: 0,
    });

    expect(offer.catalog.policyVersion).toBe(offer.policyVersion);
    expect(offer.policyVersion).toBe("iwagranja-v2.3.2-2026-11-20");
    expect(offer.producer.terms.map((term) => term.months)).toEqual([3, 6, 12, 18]);
    expect(offer.producer.terms.find((term) => term.months === 18)?.discountPct).toBe(15);
    expect(offer.catalog.version).toBe("iwagranja-catalog-v1");
    expect(producer.policyVersion).toBe(offer.policyVersion);
    expect(aggregator.policyVersion).toBe(offer.policyVersion);
    expect(producer.gina).toEqual(offer.producer.gina);
    expect(aggregator.gina).toEqual(offer.aggregator.gina);
    expect(producer.subscription.periodTotalCop).toBe(56_715);
    expect(producer.kit.includedPlates).toBe(4);
    expect(aggregator.subscription.periodTotalCop).toBe(1_417_500);
    expect(aggregator.implementationOnceCop).toBe(700_000);
    expect(aggregator.totalBeforeLogisticsAndTaxCop).toBe(2_117_500);
    expect(aggregator.beneficiaries).toMatchObject({ paid: 25, bonus: 1, totalActivated: 26 });
    expect(aggregator.kit.estimatedPlates).toBe(104);
    expect(offer.catalog.benefits.find((item) => item.id === "physical-qr-kit")?.coverage.producer.limits)
      .toEqual(expect.arrayContaining([expect.stringContaining("1–5 usuarios: hasta 1 localización")]));
    expect(offer.catalog.benefits.find((item) => item.id === "live-training")?.coverage.aggregator.summary)
      .toContain(`${offer.aggregator.training.includedHours} horas`);
  });

  it("vincula cada módulo progresivo del catálogo a sus banderas y rutas reales", () => {
    const offer = getPublicPricingOffer();
    const catalogFeatures = offer.catalog.benefits.filter((item) => item.availability.featureFlag);
    const progressiveDefinitions = FEATURE_FLAG_CATALOG.filter((item) =>
      PROGRESSIVE_UNLOCKABLE_KEYS.includes(item.key as (typeof PROGRESSIVE_UNLOCKABLE_KEYS)[number]),
    );

    expect(catalogFeatures.map((item) => item.availability.featureFlag).sort())
      .toEqual(progressiveDefinitions.map((item) => item.key).sort());

    for (const definition of progressiveDefinitions) {
      const catalogItem = catalogFeatures.find((item) => item.availability.featureFlag === definition.key);
      const expectedRoutes = PROGRESSIVE_ROUTE_GATES
        .filter((gate) => gate.flag === definition.key)
        .map((gate) => gate.prefix);

      expect(catalogItem?.availability.routes).toEqual(expectedRoutes);
      for (const route of expectedRoutes) {
        expect(getGateFlagForHref(route)).toBe(definition.key);
        expect(isHrefEnabledByFlags(route, { [definition.key]: false })).toBe(false);
        expect(isHrefEnabledByFlags(route, { [definition.key]: true })).toBe(true);
      }
    }

    expect(offer.catalog.permissionModel).toContain("roles");
    expect(offer.catalog.planEntitlementsConnected).toBe(true);
  });

  it("mantiene la cobertura comercial subordinada a los permisos reales de la API", () => {
    const catalog = getPublicPricingOffer().catalog;
    const farmOperations = catalog.benefits.find((item) => item.id === "farm-operations");
    const permission = getApiPermission("/api/produccion/adquisiciones", "POST");

    expect(farmOperations?.availability.state).toBe("operational");
    expect(farmOperations?.availability.detail).toContain("función");
    expect(permission).toBe("animal:manage");
    expect(canPerformAction("propietario", "animal:manage")).toBe(true);
    expect(hasApiPermission("propietario", permission)).toBe(true);
    expect(canPerformAction("operario", "animal:manage")).toBe(false);
    expect(hasApiPermission("operario", permission)).toBe(false);
    expect(canPerformAction("directivo", "animal:manage")).toBe(false);
  });

  it("marca explícitamente las prestaciones comerciales sin control operativo y los permisos que no coinciden", () => {
    const catalog = getPublicPricingOffer().catalog;
    const ginaQuota = catalog.benefits.find((item) => item.id === "gina-monthly-quotas");
    const physicalKit = catalog.benefits.find((item) => item.id === "physical-qr-kit");
    const tower = catalog.benefits.find((item) => item.id === "tower-control-me");
    const terms = catalog.benefits.find((item) => item.id === "commercial-conditions");

    expect(ginaQuota?.availability.state).toBe("progressive");
    expect(physicalKit?.availability.state).toBe("manual");
    expect(tower?.availability.state).toBe("not_available");
    expect(["policy_only", "operational"]).toContain(terms?.availability.state);
    expect(ginaQuota?.availability.detail).toContain("se renueva cada mes");
    expect(ginaQuota?.availability.detail).toContain("puedes seguir usando las demás funciones");
    expect(ginaQuota?.availability.detail).not.toMatch(/migración|base de datos|servidor|API/i);
    expect(catalog.auditNotes.join(" ")).toContain("una plaza de usuario");
    expect(catalog.auditNotes.join(" ")).toContain("por especie");
    expect(catalog.auditNotes.join(" ")).toContain("canal servidor a servidor con Reservas");
    expect(typeof catalog.contractingFlowAvailable).toBe("boolean");
  });

  it("devuelve un cálculo exportable y versionado sin costos ni márgenes internos", () => {
    const offer = getPublicPricingOffer();
    const quote = createPricingQuote({
      segment: "producer",
      users: 1,
      months: 6,
      renewal: true,
      locations: 0,
      areasPerLocation: 3,
      extraPlates: 0,
      extraTrainingPackages: 0,
    });
    const serialized = JSON.stringify(quote);
    const serializedOffer = JSON.stringify(offer);

    expect(quote.quoteId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(quote.snapshotSchemaVersion).toBe("iwagranja-plan-calculation-v1");
    expect(quote.contracting).toMatchObject({
      prepaidPeriod: true,
      autoRenewal: false,
      conditionsAccepted: false,
      conditionsRecorded: false,
    });
    expect(quote.subscription.totalDiscountCop).toBeGreaterThan(0);
    expect(quote.logistics.includedDispatches).toBe(0);
    expect(serialized).not.toMatch(/cost_each_cop|directCost|minimum_direct_margin|supplier_cost|margin_basis_points/i);
    expect(serializedOffer).not.toMatch(/cost_each_cop|directCost|minimum_direct_margin|supplier_cost|margin_basis_points/i);
  });

  it("cumple el caso obligatorio Productor 10 × 12 y separa los dos descuentos", () => {
    const quote = createPricingQuote({
      segment: "producer",
      users: 10,
      months: 12,
      renewal: false,
      locations: 2,
      areasPerLocation: 3,
      extraPlates: 0,
      extraTrainingPackages: 0,
    });

    expect(quote.subscription).toMatchObject({
      baseReferenceMonthlyCop: 199_000,
      baseReferencePeriodTotalCop: 2_388_000,
      volumeAdjustedMonthlyCop: 183_000,
      volumeSavingsCop: 192_000,
      durationAdjustedMonthlyCop: 155_550,
      durationSavingsCop: 329_400,
      effectiveUnitMonthlyCop: 15_555,
      monthlyEquivalentCop: 155_550,
      periodTotalCop: 1_866_600,
      combinedSavingsCop: 521_400,
      combinedSavingsPct: 21.83,
      loyaltySavingsCop: 0,
    });
  });

  it("aplica la fidelidad elegible después del plazo una sola vez, sin acumulación", () => {
    const input = {
      segment: "producer",
      users: 1,
      months: 3,
      renewal: true,
      locations: 0,
      areasPerLocation: 3,
      extraPlates: 0,
      extraTrainingPackages: 0,
    } as const;
    const firstRenewal = createPricingQuote(input);
    const nextRenewal = createPricingQuote(input);

    expect(firstRenewal.subscription.durationSavingsCop).toBe(2_985);
    expect(firstRenewal.subscription.loyaltySavingsCop).toBe(2_836);
    expect(firstRenewal.subscription.periodTotalCop).toBe(53_879);
    expect(nextRenewal.subscription.periodTotalCop).toBe(firstRenewal.subscription.periodTotalCop);
  });

  it("calcula la matriz Productor en servidor y el precio unitario no aumenta por cantidad ni plazo", () => {
    const matrix = getPublicPricingMatrix("producer");

    expect(matrix.quantityOptions).toEqual([1, 3, 10, 25]);
    expect(matrix.terms.map((term) => term.months)).toEqual([3, 6, 12, 18]);
    for (const term of matrix.terms) {
      const prices = matrix.quantityOptions.map((quantity) =>
        matrix.cells.find((cell) => cell.quantity === quantity && cell.months === term.months)!.effectiveUnitMonthlyCop,
      );
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
      const totals = matrix.quantityOptions.map((quantity) =>
        matrix.cells.find((cell) => cell.quantity === quantity && cell.months === term.months)!.subscriptionTotalCop,
      );
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    }
    for (const quantity of matrix.quantityOptions) {
      const prices = matrix.terms.map((term) =>
        matrix.cells.find((cell) => cell.quantity === quantity && cell.months === term.months)!.effectiveUnitMonthlyCop,
      );
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
      const totals = matrix.terms.map((term) =>
        matrix.cells.find((cell) => cell.quantity === quantity && cell.months === term.months)!.subscriptionTotalCop,
      );
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    }
    expect(matrix.cells.find((cell) => cell.quantity === 10 && cell.months === 12)).toMatchObject({
      effectiveUnitMonthlyCop: 15_555,
      subscriptionTotalCop: 1_866_600,
    });
    expect(matrix.cells.find((cell) => cell.quantity === 10 && cell.months === 18)).toMatchObject({
      effectiveUnitMonthlyCop: 15_555,
      subscriptionTotalCop: 2_799_900,
    });
    expect(() => createPricingQuote({
      segment: "producer",
      users: 1,
      months: 1,
      renewal: false,
      locations: 0,
      areasPerLocation: 3,
      extraPlates: 0,
      extraTrainingPackages: 0,
    })).toThrow("El plazo para Productor debe ser 3, 6, 12, 18 meses.");
  });

  it("compara Agregador 25, 50, 150 y 500; bonificados e implementación quedan separados", () => {
    const matrix = getPublicPricingMatrix("aggregator");
    const expected = [
      { quantity: 25, total: 1_417_500, bonus: 1, activated: 26, implementation: 700_000 },
      { quantity: 50, total: 2_757_000, bonus: 2, activated: 52, implementation: 1_000_000 },
      { quantity: 150, total: 7_824_000, bonus: 10, activated: 160, implementation: 2_500_000 },
      { quantity: 500, total: 24_516_000, bonus: 50, activated: 550, implementation: 9_500_000 },
    ];

    expect(matrix.quantityOptions).toEqual(expected.map((item) => item.quantity));
    for (const item of expected) {
      const cell = matrix.cells.find((value) => value.quantity === item.quantity && value.months === 3)!;
      const quote = createPricingQuote({
        segment: "aggregator",
        beneficiaries: item.quantity,
        months: 3,
        renewal: false,
        platesPerBeneficiary: 4,
        extraPlates: 0,
        extraTrainingPackages: 0,
      });

      expect(cell).toMatchObject({
        subscriptionTotalCop: item.total,
        bonusActivations: item.bonus,
        totalActivated: item.activated,
      });
      expect(quote.subscription.periodTotalCop).toBe(item.total);
      expect(quote.implementationOnceCop).toBe(item.implementation);
      expect(quote.totalBeforeLogisticsAndTaxCop).toBe(item.total + item.implementation);
    }

    for (const term of matrix.terms) {
      const prices = matrix.quantityOptions.map((quantity) =>
        matrix.cells.find((cell) => cell.quantity === quantity && cell.months === term.months)!.effectiveUnitMonthlyCop,
      );
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
      const totals = matrix.quantityOptions.map((quantity) =>
        matrix.cells.find((cell) => cell.quantity === quantity && cell.months === term.months)!.subscriptionTotalCop,
      );
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    }
    for (const quantity of matrix.quantityOptions) {
      const prices = matrix.terms.map((term) =>
        matrix.cells.find((cell) => cell.quantity === quantity && cell.months === term.months)!.effectiveUnitMonthlyCop,
      );
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
      const totals = matrix.terms.map((term) =>
        matrix.cells.find((cell) => cell.quantity === quantity && cell.months === term.months)!.subscriptionTotalCop,
      );
      expect(totals).toEqual([...totals].sort((a, b) => a - b));
    }
    expect(JSON.stringify(matrix)).not.toMatch(/cost_each_cop|directCost|minimum_direct_margin|supplier_cost|margin_basis_points/i);
  });
});
