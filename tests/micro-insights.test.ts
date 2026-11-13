import { describe, expect, it } from "vitest";
import {
  buildEggMicroInsight,
  buildExpenseMicroInsight,
  buildFeedMicroInsight,
  buildHealthMicroInsight,
  buildIncubationMicroInsight,
  buildMortalityMicroInsight,
  buildReproductionMicroInsight,
  buildSaleMicroInsight,
} from "../src/lib/micro-insights";

describe("Micro-Insights & Nudges Engine", () => {
  it("calculates NTC 1240 trays, HD% posture rate, and breakage nudge for egg collection", () => {
    const insight = buildEggMicroInsight({
      date: "2026-11-13",
      species: "gallina",
      locationName: "Galpón 1",
      totalCollected: 95,
      broken: 1,
      forIncubation: 4,
      unitPrice: 600,
      activeLayingBirds: 110,
      previousDayCollected: 90,
      offline: false,
    });

    expect(insight.tone).toBe("positive");
    expect(insight.metrics[0]?.value).toBe("3 cub. + 0 u.");
    expect(insight.metrics[1]?.value).toContain("54.000");
    expect(insight.metrics[2]?.value).toBe("86.4%");
    expect(insight.metrics[2]?.helper).toContain("+5 vs. ayer");
    expect(insight.nudgeBody).toContain("inventario PEPS");
    expect(insight.whatsappText).toContain("Galpón 1");
  });

  it("evaluates 40kg bag equivalence and critical (<4 days) feed coverage alert", () => {
    const insight = buildFeedMicroInsight({
      date: "2026-11-13",
      feedName: "Concentrado Ponedora",
      unit: "kg",
      quantity: 20,
      isEntry: false,
      locationName: "Galpón 2",
      remainingStockAfter: 50, // 50 kg / 20 kg/d = 2.5 days (< 4 critical)
      activeAnimalsCount: 180,
      offline: true,
    });

    expect(insight.tone).toBe("critical");
    expect(insight.offline).toBe(true);
    expect(insight.metrics[0]?.helper).toContain("0.5 bultos (40 kg)");
    expect(insight.metrics[1]?.value).toBe("2.5 días");
    expect(insight.metrics[2]?.value).toBe("111 g/día");
    expect(insight.nudgeTitle).toContain("< 4 días");
  });

  it("detects below-break-even sales vs. profitable PEPS sales", () => {
    const lossSale = buildSaleMicroInsight({
      date: "2026-11-13",
      itemSummary: "30 huevos AA",
      totalUnits: 30,
      unitPrice: 350,
      totalAmount: 10500,
      referenceUnitCost: 430,
      buyer: "Tienda Veredal",
    });
    expect(lossSale.tone).toBe("critical");
    expect(lossSale.nudgeTitle).toContain("Bajo Punto de Equilibrio");

    const profitSale = buildSaleMicroInsight({
      date: "2026-11-13",
      itemSummary: "60 huevos AAA",
      totalUnits: 60,
      unitPrice: 600,
      totalAmount: 36000,
      referenceUnitCost: 420,
      buyer: "Restaurante La Plaza",
    });
    expect(profitSale.tone).toBe("positive");
    expect(profitSale.metrics[1]?.value).toContain("+");
  });

  it("builds tailored sale micro-capsules for carne, animales, gallinaza and otros", () => {
    const meat = buildSaleMicroInsight({
      date: "2026-11-13",
      itemSummary: "12 kg carne (cuy)",
      totalUnits: 12,
      unitPrice: 28000,
      totalAmount: 336000,
      saleKind: "carne",
      species: "cuy",
      unitLabel: "kg",
    });
    expect(meat.tone).toBe("positive");
    expect(meat.metrics[2]?.value).toBe("12 kg");
    expect(meat.nudgeBody).toContain("carne");
    expect(meat.normativeTag).toContain("Multilínea");

    const liveAnimals = buildSaleMicroInsight({
      date: "2026-11-13",
      itemSummary: "4 cuyes",
      totalUnits: 4,
      unitPrice: 35000,
      totalAmount: 140000,
      saleKind: "animales",
      species: "cuy",
      unitLabel: "animales",
    });
    expect(liveAnimals.metrics[2]?.label).toBe("Unidades Vendidas");
    expect(liveAnimals.nudgeBody).toContain("animales en pie");

    const manure = buildSaleMicroInsight({
      date: "2026-11-13",
      itemSummary: "80 kg de gallinaza / abono",
      totalUnits: 80,
      unitPrice: 500,
      totalAmount: 40000,
      saleKind: "gallinaza",
      unitLabel: "kg",
    });
    expect(manure.metrics[2]?.label).toBe("Subproducto / Abono");
    expect(manure.nudgeBody).toContain("subproductos");

    const other = buildSaleMicroInsight({
      date: "2026-11-13",
      itemSummary: "5 kg plumas",
      totalUnits: 5,
      unitPrice: 8000,
      totalAmount: 40000,
      saleKind: "otros",
      unitLabel: "kg",
    });
    expect(other.metrics[2]?.label).toBe("Cantidad vendida");
    expect(other.nudgeBody).not.toContain("NTC 1240");
  });

  it("builds mortality, expense, health withdrawal, reproduction, and incubation micro-capsules", () => {
    const mort = buildMortalityMicroInsight({
      date: "2026-11-13",
      species: "pollo",
      birdTypeLabel: "Lote de pollos",
      quantity: 2,
      causeLabel: "Enfermedad",
      locationName: "Galpón Engorde",
      remainingPopulation: 98,
      notes: "Signo clínico · Humedad cama",
    });
    expect(mort.tone).toBe("critical");
    expect(mort.metrics[1]?.value).toBe("98%");
    expect(mort.nudgeBody).toContain("Res. ICA 30292");

    const exp = buildExpenseMicroInsight({
      date: "2026-11-13",
      category: "Compra de alimento",
      description: "Concentrado Engorde",
      amount: 360000,
      counterparty: "Italcol",
      presentations: 4,
      factor: 40,
    });
    expect(exp.metrics[1]?.value).toContain("2.250");

    const health = buildHealthMicroInsight({
      date: "2026-11-13",
      eventTypeLabel: "Tratamiento",
      product: "Enrofloxacina 10%",
      withdrawalDays: 7,
      withdrawalUntilDate: "2026-11-20",
      coldChainTempC: 5,
      locationName: "Galpón 1",
    });
    expect(health.tone).toBe("warning");
    expect(health.nudgeTitle).toContain("2026-11-20");

    const repro = buildReproductionMicroInsight({
      species: "conejo",
      eventType: "destete",
      eventDate: "2026-11-13",
      damCode: "CON-H04",
      weanedTotal: 8,
      litterDailyGainG: 34.5,
      weanedBatchCode: "CON-20261113",
    });
    expect(repro.nudgeTitle).toContain("Madre Élite");

    const inc = buildIncubationMicroInsight({
      species: "pato",
      startDate: "2026-11-13",
      eggsSet: 45,
      turnStopDate: "2026-12-08",
      expectedHatchDate: "2026-12-11",
    });
    expect(inc.metrics[0]?.value).toBe("28 días");
    expect(inc.nudgeTitle).toContain("día 25");
  });
});

