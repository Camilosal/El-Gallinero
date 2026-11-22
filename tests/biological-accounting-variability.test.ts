import { describe, expect, it } from "vitest";
import {
  classifyTransactionNature,
  computeAssetsDepreciationSummary,
  computeFeedWarehouseValuation,
  computeThreeLayerFinancials,
  evaluateBiologicalPortfolio,
} from "@/lib/analytics/biological-valuation";

describe("Contabilidad AgroIntegral y Variabilidad Biológica Multi-Especie", () => {
  it("advierte cuando una valoración no tiene precios maestros para no confundir cero con un precio real", () => {
    const portfolio = evaluateBiologicalPortfolio({
      flocks: [],
      broilerBatches: [{
        id: "batch-without-master-prices",
        batchCode: "POLLO-SIN-PRECIO",
        species: "pollo",
        initialCount: 100,
        currentCount: 100,
        status: "activo",
      }],
    });

    expect(portfolio.units[0].biologicalValueCop).toBe(0);
    expect(portfolio.alerts.some((alert) =>
      alert.id === "batch-without-master-prices-missing-master-price" &&
      alert.title.includes("Faltan precios maestros") &&
      alert.detail.includes("costo inicial por animal"),
    )).toBe(true);
  });

  it("reproduce el caso práctico de 200 pollos (Semana 1 y Semana 6): separa CapEx, bodega y activo biológico de caja", () => {
    // Equipos: $1,800,000 COP / 18 ciclos de 42 días -> $100,000 COP por ciclo (~$16,666.67 / semana)
    const assetsSummaryWeek1 = computeAssetsDepreciationSummary(
      [
        {
          id: "eq-1",
          code: "ACT-0001",
          name: "Comederos, bebederos, criadora y malla",
          category: "equipo",
          status: "operativo",
          acquisitionDate: "2026-01-01",
          acquisitionCost: 1800000,
          usefulLifeCycles: 18,
          depreciationBasis: "ciclos",
          residualValue: 0,
        },
      ],
      { fromDate: "2026-01-01", toDate: "2026-01-07", avgCycleDays: 42 },
    );
    // 7 días / (18 * 42 días) * 1,800,000 = 16,666.67 COP
    expect(assetsSummaryWeek1.periodDepreciationCop).toBeCloseTo(16666.67, 1);
    expect(assetsSummaryWeek1.netBookValueCop).toBeCloseTo(1783333.33, 1);
    expect(assetsSummaryWeek1.capexRecoveryPct).toBeCloseTo(0.93, 1);

    // Bodega Semana 1: 12 bultos (480 kg) comprados - 35 kg consumidos = 445 kg * $2,500 = $1,112,500
    const warehouseWeek1 = computeFeedWarehouseValuation([
      { id: "f-1", name: "Iniciación Pollo", currentKg: 445, unitCost: 2500, reorderLevelKg: 80 },
    ]);
    expect(warehouseWeek1.totalValueCop).toBe(1112500);
    expect(warehouseWeek1.bultos40Kg).toBeCloseTo(11.13, 2);

    // Valor biológico Semana 1: 197 pollos vivos @ 0.18 kg
    // chickUnit vacunado ($500k + $160k) / 200 = $3,300 * (1 - 7/42) + 0.18 * 7200 = 2750 + 1296 = 4046 -> * 197 = 797,062
    const bioWeek1 = evaluateBiologicalPortfolio({
      flocks: [],
      broilerBatches: [
        {
          id: "b-1",
          batchCode: "POLLO-01",
          species: "pollo",
          breed: "Ross 308",
          initialCount: 200,
          currentCount: 197,
          avgWeightG: 180,
          chickCostTotal: 660000,
          startDate: "2026-01-01",
          targetAgeDays: 42,
          status: "activo",
        },
      ],
      marketPrices: { meatKgCopBySpecies: { pollo: 7200 } },
      referenceDate: "2026-01-08", // diffDaysElapsed = 7 days
    });
    expect(bioWeek1.lifecycleMode).toBe("cria_levante");
    expect(bioWeek1.units[0].valuationStage).toBe("crecimiento_inicial");
    expect(bioWeek1.totalBiologicalValueCop).toBeCloseTo(797062, 0);

    // Flujo de caja Semana 1: -3,660,000 COP; Operativo devengado solo carga consumo (87,500) + sanidad (160k) + depr (16,666.67)
    const threeLayerW1 = computeThreeLayerFinancials({
      transactions: [
        { type: "egreso", category: "Equipamiento", sourceType: "capex", amount: 1800000, date: "2026-01-01" },
        { type: "egreso", category: "Compra de aves", amount: 500000, date: "2026-01-01" },
        { type: "egreso", category: "Compra de alimento", amount: 1200000, date: "2026-01-01" },
        { type: "egreso", category: "Control sanitario", amount: 160000, date: "2026-01-01" },
      ],
      accruedFeedConsumedCostCop: 35 * 2500,
      hasFeedConsumptionRecords: true,
      assetsSummary: assetsSummaryWeek1,
      warehouseSummary: warehouseWeek1,
      biologicalSummary: bioWeek1,
    });
    expect(threeLayerW1.cashNetFlowCop).toBe(-3660000);
    expect(threeLayerW1.capexCashOutflowCop).toBe(1800000);
    // Accrued op expense = 160,000 (sanidad) + 87,500 (alimento) + 16,666.67 (depr) = 264,166.67 (NO los $3.66M!)
    expect(threeLayerW1.accruedOperatingExpenseCop).toBeCloseTo(264166.67, 1);
    // Patrimonio productivo total = 1,112,500 + 1,783,333.33 + 797,062 = 3,692,895.33 COP
    expect(threeLayerW1.totalProductiveWealthCop).toBeCloseTo(3692895.33, 0);

    // Semana 6 (Cosecha día 42): 192 pollos * 2.70 kg * $7,200 = $3,732,480 COP
    const bioWeek6 = evaluateBiologicalPortfolio({
      flocks: [],
      broilerBatches: [
        {
          id: "b-1",
          batchCode: "POLLO-01",
          species: "pollo",
          breed: "Ross 308",
          initialCount: 200,
          currentCount: 192,
          avgWeightG: 2700,
          chickCostTotal: 660000,
          startDate: "2026-01-01",
          targetAgeDays: 42,
          status: "activo",
        },
      ],
      marketPrices: { meatKgCopBySpecies: { pollo: 7200 } },
      referenceDate: "2026-02-12", // 42 days elapsed
    });
    expect(bioWeek6.totalBiologicalValueCop).toBe(3732480);
    expect(bioWeek6.units[0].valuationStage).toBe("listo_beneficio");
  });

  it("maneja variabilidad biológica multi-especie: levante ponedora (no carne), inflexión pato/cuy, altitud y vacío sanitario", () => {
    expect(classifyTransactionNature({ type: "egreso", category: "Equipamiento", amount: 500000 })).toBe("capex");
    expect(classifyTransactionNature({ type: "egreso", category: "Compra de alimento", amount: 200000 })).toBe(
      "feed_inventory_purchase",
    );

    const portfolio = evaluateBiologicalPortfolio({
      locations: [
        {
          id: "loc-alta",
          name: "Galpón Altiplano",
          altitudeMeters: 2400,
          floorType: "cemento",
        },
      ],
      flocks: [
        // Pollitas ponedoras semana 10 (<18w) NO deben valorarse como carne
        {
          id: "f-levante",
          name: "Isa Levante",
          species: "gallina",
          breed: "Isa Brown",
          purpose: "postura_huevo",
          initialCount: 100,
          currentCount: 98,
          acquisitionCost: 450000,
          ageWeeks: 10,
          status: "activo",
        },
        // Pie de cría reproductores
        {
          id: "f-breeder",
          name: "Cuyes Reproductores",
          species: "cuy",
          breed: "Peruano",
          purpose: "pie_cria",
          initialCount: 20,
          currentCount: 20,
          acquisitionCost: 800000,
          ageWeeks: 30,
          status: "activo",
        },
      ],
      broilerBatches: [
        // Patos día 52 (>49d -> alerta de inflexión FCR)
        {
          id: "b-pato",
          batchCode: "PATOS-01",
          species: "pato",
          breed: "Pekín",
          initialCount: 50,
          currentCount: 49,
          avgWeightG: 3100,
          startDate: "2026-01-01",
          targetAgeDays: 49,
          status: "activo",
          observedFcr: 3.52,
        },
        // Cuyes día 80 (ventana óptima 75-90d)
        {
          id: "b-cuy",
          batchCode: "CUY-02",
          species: "cuy",
          breed: "Mejorado",
          initialCount: 40,
          currentCount: 39,
          avgWeightG: 1120,
          startDate: "2026-01-01",
          targetAgeDays: 82,
          status: "activo",
          locationId: "loc-alta",
        },
      ],
      marketPrices: {
        initialUnitCostCopBySpecies: { gallina: 4500 },
        pointOfLayValueCopBySpecies: { gallina: 29000 },
      },
      referenceDate: "2026-03-22", // 80 days after Jan 1 (for cuy 80d, pato 80d >= 49d)
    });

    const levante = portfolio.units.find((u) => u.id === "f-levante");
    expect(levante?.valuationStage).toBe("levante_prepostura");
    expect(levante?.purpose).toBe("postura_huevo");
    expect(levante?.biologicalValueCop).toBeGreaterThan(1500000);

    const breeder = portfolio.units.find((u) => u.id === "f-breeder");
    expect(breeder?.valuationStage).toBe("reproductor_base");

    const cuyBatch = portfolio.units.find((u) => u.id === "b-cuy");
    expect(cuyBatch?.environmentFactor).toBe(1);
    expect(cuyBatch?.environmentNotes.some((n) => n.toLowerCase().includes("ascitis"))).toBe(false);
    expect(cuyBatch?.environmentNotes.some((n) => n.toLowerCase().includes("cuy andino"))).toBe(true);
    expect(portfolio.alerts.some((a) => a.species === "pato" && a.title.includes("Patos"))).toBe(true);
    expect(portfolio.alerts.some((a) => a.species === "cuy" && a.title.includes("Cuyes"))).toBe(true);

    // Vacío sanitario cuando no hay animales activos pero sí descanso ICA vigente
    const sanitaryRest = evaluateBiologicalPortfolio({
      locations: [{ id: "loc-1", name: "Galpón 1", sanitaryEmptyUntil: "2026-04-05" }],
      flocks: [],
      broilerBatches: [],
      referenceDate: "2026-03-25",
    });
    expect(sanitaryRest.lifecycleMode).toBe("pausa_sanitaria");
    expect(sanitaryRest.activeSanitaryPauseLocations).toHaveLength(1);
  });
});
