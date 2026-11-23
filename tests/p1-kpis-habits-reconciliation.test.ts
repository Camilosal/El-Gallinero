import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { runWithFarmContext } from "@/db/tenant-context";
import {
  autoconsumoLogs,
  budgetItems,
  budgets,
  eggProduction,
  eggProductionDetails,
  farmLocations,
  farms,
  feedInventory,
  transactions,
  users,
} from "@/db/schema";
import * as authMod from "@/lib/auth";
import {
  buildEggMicroInsight,
  buildSaleMicroInsight,
  getDailyHabitProgress,
} from "@/lib/micro-insights";
import {
  KPI_CONTRACT_DICTIONARY,
  computeDailyEggAverage,
  evaluateKpiQuality,
  getKpiContract,
} from "@/lib/kpi-dictionary";
import { computeEggInventory } from "@/lib/inventory";
import { getFeedInventoryProjection, normalizeFeedQuantityToKg } from "@/lib/feeding/inventory";
import { runFarmReconciliationReport } from "@/lib/reconciliation-service";
import { GET as kpisGET, POST as kpisPOST } from "@/app/api/analisis/kpis-adopcion/route";
import { GET as comparativoGET } from "@/app/api/presupuestos/comparativo/route";
import { GET as alimentacionGET } from "@/app/api/produccion/alimentacion/route";
import { todayColombiaIso } from "@/lib/date-validation";
import { mockRequest, parseJson } from "./helpers";

describe("P1 Saneamiento de KPIs, MicroInsights, Hábitos desde Cero y Conciliación", () => {
  const farmId = randomUUID();
  const userId = randomUUID();

  beforeAll(async () => {
    await db.insert(farms).values({
      id: farmId,
      slug: `test-p1-${farmId.slice(0, 8)}`,
      name: "Granja P1 Auditoría",
      deploymentMode: "saas",
      planCode: "FREEMIUM_SEMILLA",
    });

    await runWithFarmContext(farmId, async () => {
      await db.insert(users).values({
        id: userId,
        farmId,
        username: `p1_${userId.slice(0, 8)}`,
        passwordHash: "hash",
        name: "Productor P1",
        role: "propietario",
      });
    });

    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: userId,
      farmId,
      username: `p1_${userId.slice(0, 8)}`,
      name: "Productor P1",
      role: "propietario",
    });
  });

  afterAll(async () => {
    await db.delete(farms).where(eq(farms.id, farmId));
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "test-user",
      farmId: "00000000-0000-0000-0000-000000000001",
      username: "test",
      name: "Test User",
      role: "admin",
    });
  });

  it("KPI-09: hábitos y racha parten estrictamente en 0 cuando no hay actividad registrada", () => {
    const emptyProgress = getDailyHabitProgress(
      "2026-11-22",
      { byDate: {} },
      { farmId: "farm-zero", species: ["gallina"], purposes: ["ingresos"] },
    );
    expect(emptyProgress.completedSteps).toEqual([]);
    expect(emptyProgress.completedEssentialCount).toBe(0);
    expect(emptyProgress.streakDays).toBe(0);
    expect(emptyProgress.nextSuggestedMode).toBe("huevos");

    const nonEssentialOnly = getDailyHabitProgress(
      "2026-11-22",
      { byDate: { "2026-11-22": ["reproduccion"] } },
      { farmId: "farm-zero", species: ["gallina"], purposes: ["ingresos"] },
    );
    expect(nonEssentialOnly.completedEssentialCount).toBe(0);
    expect(nonEssentialOnly.streakDays).toBe(1);

    const withOneEssential = getDailyHabitProgress(
      "2026-11-22",
      { byDate: { "2026-11-22": ["huevos"] } },
      { farmId: "farm-zero", species: ["gallina"], purposes: ["ingresos"] },
    );
    expect(withOneEssential.completedEssentialCount).toBe(1);
    expect(withOneEssential.streakDays).toBe(1);
  });

  it("KPI-05: computeDailyEggAverage agrupa por días observados distintos y no por cantidad de capturas", () => {
    const avg = computeDailyEggAverage([
      { date: "2026-11-22", totalCollected: 10 },
      { date: "2026-11-22", totalCollected: 15 },
      { date: "2026-11-22", totalCollected: 5 },
      { date: "2026-11-21", totalCollected: 20 },
    ]);
    expect(avg).toEqual({
      totalEggs: 50,
      observedDays: 2,
      avgPerObservedDay: 25,
    });
    expect(computeDailyEggAverage([])).toEqual({
      totalEggs: 0,
      observedDays: 0,
      avgPerObservedDay: 0,
    });
  });

  it("KPI-01 / KPI-02 / KPI-03: separa valorización hogar vs comercial y distingue costo trazable vs paramétrico", () => {
    const eggInsight = buildEggMicroInsight({
      date: "2026-11-22",
      species: "gallina",
      locationName: "Galpón 1",
      totalCollected: 30,
      broken: 0,
      quantityAutoconsumo: 12,
      unitPrice: 600,
      todayFeedCostCOP: 8000,
    });

    expect(eggInsight.destinationBreakdown).toEqual({
      total: 30,
      hogar: 12,
      comercial: 18,
      unit: "huevos",
      hogarValuationCOP: 7200,
      comercialValueCOP: 10800,
    });
    expect(eggInsight.metrics[1]?.helper).toContain("Venta: $10.800");
    expect(eggInsight.metrics[1]?.helper).toContain("Hogar (sustitución): $7.200");
    expect(eggInsight.economicContract).toEqual({
      resultKind: "margen_parcial_alimento",
      costSource: "parcial_alimento",
      saleableValueCOP: 10800,
      householdSubstitutionCOP: 7200,
      partialFeedMarginCOP: 2800,
    });

    const parametricSale = buildSaleMicroInsight({
      date: "2026-11-22",
      itemSummary: "30 huevos AA",
      totalUnits: 30,
      unitPrice: 600,
      totalAmount: 18000,
    });
    expect(parametricSale.valueKind).toBe("estimate");
    expect(parametricSale.economicContract?.costSource).toBe("parametrico");
    expect(parametricSale.metrics[1]?.helper).toContain("est. paramétrica");
    expect(parametricSale.assumptions?.[0]).toContain("paramétrico");

    const traceableSale = buildSaleMicroInsight({
      date: "2026-11-22",
      itemSummary: "30 huevos AA",
      totalUnits: 30,
      unitPrice: 600,
      totalAmount: 18000,
      referenceUnitCost: 390,
    });
    expect(traceableSale.valueKind).toBe("calculated");
    expect(traceableSale.economicContract?.costSource).toBe("trazable");
    expect(traceableSale.metrics[1]?.helper).toContain("costo trazable");
    expect(traceableSale.assumptions).toBeUndefined();
  });

  it("KPI-08 y KPI-11: diccionario único de KPIs y Time to First Value real (false sin primera operación)", async () => {
    expect(Object.keys(KPI_CONTRACT_DICTIONARY).length).toBeGreaterThanOrEqual(8);
    const householdContract = getKpiContract("household_eggs_allocated");
    expect(householdContract?.formula).toBeTruthy();
    expect(householdContract?.unit).toBe("unidades");
    expect(evaluateKpiQuality({ hasConfirmedRecords: false })).toBe("incompleto");
    expect(evaluateKpiQuality({ hasConfirmedRecords: true, usesFallbackPriceOrCost: true })).toBe("estimado");
    expect(evaluateKpiQuality({ hasConfirmedRecords: true })).toBe("confirmado");

    // 1. Solo completó onboarding, sin capturas ni registros operativos todavía
    const onbRes = await kpisPOST(
      mockRequest("http://localhost/api/analisis/kpis-adopcion", {
        method: "POST",
        body: { type: "onboarding", durationSec: 180 },
      }),
    );
    expect(onbRes.status).toBe(201);

    const kpisBeforeCapture = await parseJson(
      await kpisGET(mockRequest("http://localhost/api/analisis/kpis-adopcion", { method: "GET" })),
    );
    expect(kpisBeforeCapture.timeToValueMinutes).toBe(3);
    expect(kpisBeforeCapture.firstValueAchieved).toBe(false);
    expect(kpisBeforeCapture.timeToFirstValueMinutes).toBeNull();

    // 2. Registra primera captura operativa -> Time to First Value se vuelve positivo
    const capRes = await kpisPOST(
      mockRequest("http://localhost/api/analisis/kpis-adopcion", {
        method: "POST",
        body: { type: "capture", mode: "huevos", durationSec: 30 },
      }),
    );
    expect(capRes.status).toBe(201);

    const kpisAfterCapture = await parseJson(
      await kpisGET(mockRequest("http://localhost/api/analisis/kpis-adopcion", { method: "GET" })),
    );
    expect(kpisAfterCapture.firstValueAchieved).toBe(true);
    expect(kpisAfterCapture.timeToFirstValueMinutes).toBe(3.5);
  });

  it("DAT-03 + DAT-05: distingue destino pendiente vs excedente comercial y ejecuta conciliación transversal S0", async () => {
    const today = todayColombiaIso();

    await runWithFarmContext(farmId, async () => {
      const [loc] = await db
        .insert(farmLocations)
        .values({
          farmId,
          code: `GAL-P1-${Date.now()}`,
          name: "Galpón Conciliación P1",
          type: "galpon",
          status: "activa",
        })
        .returning();

      // Registro 1: 30 huevos -> 12 hogar, 13 venta, 5 destino pendiente
      const [prod1] = await db
        .insert(eggProduction)
        .values({
          farmId,
          date: today,
          species: "gallina",
          locationId: loc.id,
          totalCollected: 30,
          broken: 0,
          discarded: 0,
          forIncubation: 0,
          quantityAutoconsumo: 12,
          quantityExcedente: 13,
          referenceUnitPrice: "600.00",
        })
        .returning();
      await db.insert(eggProductionDetails).values({
        farmId,
        productionId: prod1.id,
        size: "AA",
        quantity: 30,
      });
      await db.insert(autoconsumoLogs).values({
        farmId,
        date: today,
        species: "gallina",
        productType: "huevo",
        quantity: "12",
        unit: "unidades",
        marketReferencePrice: "600.00",
        savingsAmount: "7200.00",
        eggProductionId: prod1.id,
      });

      // Registro 2: legado con 0 hogar y 0 excedente -> 10 inferidos comercializables
      const [prod2] = await db
        .insert(eggProduction)
        .values({
          farmId,
          date: today,
          species: "gallina",
          locationId: loc.id,
          totalCollected: 10,
          broken: 0,
          discarded: 0,
          forIncubation: 0,
          quantityAutoconsumo: 0,
          quantityExcedente: 0,
        })
        .returning();
      await db.insert(eggProductionDetails).values({
        farmId,
        productionId: prod2.id,
        size: "AA",
        quantity: 10,
      });
    });

    const inv = await runWithFarmContext(farmId, () => computeEggInventory());
    expect(inv.summary.produced).toBe(40);
    expect(inv.summary.autoconsumed).toBe(12);
    expect(inv.summary.explicitSaleableProduced).toBe(13);
    expect(inv.summary.legacyInferredSaleableProduced).toBe(10);
    expect(inv.summary.pendingDestination).toBe(5);
    expect(inv.summary.saleableProduced).toBe(23);
    expect(inv.summary.available).toBe(23);

    const report = await runWithFarmContext(farmId, () => runFarmReconciliationReport());
    expect(report.eggs.pendingDestination).toBe(5);
    expect(report.eggs.legacyInferredSaleable).toBe(10);
    expect(report.eggs.headerVsDetailMismatches).toBe(0);
    expect(report.eggInventory.bookVsAvailableDelta).toBe(0);
    expect(report.autoconsumo.missingEggAutoLogsCount).toBe(0);
    expect(report.status).toBe("warnings");
  });

  it("DAT-07: comparativo presupuestal imputa una sola vez transacciones con reglas superpuestas", async () => {
    const today = todayColombiaIso();
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthEnd = `${today.slice(0, 7)}-28`;
    let budgetId = "";

    await runWithFarmContext(farmId, async () => {
      const [b] = await db
        .insert(budgets)
        .values({
          farmId,
          name: "Presupuesto Solapado P1",
          periodStart: monthStart,
          periodEnd: monthEnd,
          type: "egreso",
        })
        .returning();
      budgetId = b.id;

      await db.insert(budgetItems).values([
        {
          farmId,
          budgetId: b.id,
          category: "01 Sanidad preventiva",
          expenseCatalogId: null,
          expenseFamily: "01 Sanidad preventiva",
          monthlyTarget: "200000",
        },
        {
          farmId,
          budgetId: b.id,
          category: "Control sanitario",
          expenseCatalogId: "CST-001",
          expenseFamily: "01 Sanidad preventiva",
          monthlyTarget: "100000",
        },
      ]);

      await db.insert(transactions).values({
        farmId,
        date: today,
        type: "egreso",
        category: "Control sanitario",
        description: "Vacuna CST-001 P1",
        amount: "50000.00",
        expenseCatalogId: "CST-001",
        expenseFamily: "01 Sanidad preventiva",
      });
    });

    const compRes = await comparativoGET(
      new NextRequest(`http://localhost/api/presupuestos/comparativo?budgetId=${budgetId}`),
    );
    expect(compRes.status).toBe(200);
    const compJson = await compRes.json();

    // La transacción de $50.000 debe contar exactamente UNA vez en el presupuesto total
    expect(compJson.summary.totalActual).toBe(50000);
    expect(compJson.summary.deduplicatedOverlapCount).toBe(1);
    expect(compJson.summary.hasOverlappingRules).toBe(true);

    const specificItem = compJson.items.find((i: any) => i.expenseCatalogId === "CST-001");
    const familyItem = compJson.items.find((i: any) => i.expenseCatalogId === null);
    expect(specificItem.actual).toBe(50000);
    expect(familyItem.actual).toBe(0);
    expect(specificItem.overlapWarning).toContain("imputó una sola vez");
    expect(familyItem.overlapWarning).toContain("imputó una sola vez");
  });

  it("DAT-06 + DAT-09: normaliza unidades de alimento a kg y soporta GET ?readonly=1 sin mutar", async () => {
    expect(normalizeFeedQuantityToKg(10, "kg")).toEqual({
      quantityKg: 10,
      conversionFactor: 1,
      canonicalUnit: "kg",
      isConvertible: true,
    });
    expect(normalizeFeedQuantityToKg(4, "lb")).toEqual({
      quantityKg: 2,
      conversionFactor: 0.5,
      canonicalUnit: "kg",
      isConvertible: true,
    });
    expect(normalizeFeedQuantityToKg(2, "bultos")).toEqual({
      quantityKg: 80,
      conversionFactor: 40,
      canonicalUnit: "kg",
      isConvertible: true,
    });
    expect(normalizeFeedQuantityToKg(5, "litros")).toEqual({
      quantityKg: null,
      conversionFactor: null,
      canonicalUnit: "kg",
      isConvertible: false,
    });

    await runWithFarmContext(farmId, async () => {
      await db.insert(feedInventory).values([
        {
          farmId,
          name: "Concentrado Bultos P1",
          category: "suplementario" as const,
          feedType: "concentrado_comercial" as const,
          unit: "bulto",
          currentStock: "3.00",
          minStock: "1.00",
          costPerUnit: "80000.00",
        },
        {
          farmId,
          name: "Suero Líquido P1",
          category: "suplementario" as const,
          feedType: "otro" as const,
          unit: "litros",
          currentStock: "15.00",
          minStock: "2.00",
          costPerUnit: "5000.00",
        },
      ]);
    });

    const proj = await runWithFarmContext(farmId, () =>
      getFeedInventoryProjection(30, { materializeProgramCatchup: false }),
    );
    const bagFeed = proj.find((f) => f.name === "Concentrado Bultos P1");
    const liquidFeed = proj.find((f) => f.name === "Suero Líquido P1");
    expect(bagFeed?.currentStockKg).toBe(120);
    expect(bagFeed?.unitConversionVerified).toBe(true);
    expect(liquidFeed?.currentStockKg).toBeNull();
    expect(liquidFeed?.unitConversionVerified).toBe(false);

    const readonlyRes = await alimentacionGET(
      new NextRequest("http://localhost/api/produccion/alimentacion?days=30&readonly=1"),
    );
    expect(readonlyRes.status).toBe(200);
    const readonlyJson = await readonlyRes.json();
    expect(readonlyJson.some((x: any) => x.name === "Concentrado Bultos P1" && x.currentStockKg === 120)).toBe(true);
  });
});
