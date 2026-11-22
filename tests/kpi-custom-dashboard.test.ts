import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { runWithFarmContext } from "@/db/tenant-context";
import {
  appSettings,
  broilerBatches,
  eggProduction,
  farmLocations,
  farms,
  feedInventory,
  feedMovements,
  mortalityRecords,
  transactions,
  users,
} from "@/db/schema";
import * as authMod from "@/lib/auth";
import {
  KPI_WIDGET_IDS,
  MAX_PINNED_KPI_WIDGETS,
  buildPresetConfig,
  computeDeltaPct,
  evaluateKpiStatus,
  normalizeKpiDashboardConfig,
  resolveRecommendedPreset,
} from "@/lib/kpi-dashboard";
import { KPI_CONFIG_KEY_PREFIX, KPI_DEFAULT_CONFIG_KEY } from "@/lib/kpi-dashboard-server";
import { GET as configGET, PUT as configPUT } from "@/app/api/analisis/kpis/config/route";
import { GET as kpisGET } from "@/app/api/analisis/kpis/route";
import { mockRequest, parseJson } from "./helpers";

function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

describe("kpi-dashboard domain helpers", () => {
  it("resuelve preset recomendado según señales de especie y producción", () => {
    expect(
      resolveRecommendedPreset({ activeSpecies: ["gallina", "codorniz"], hasLayingAnimals: true })
    ).toBe("postura");

    expect(
      resolveRecommendedPreset({ activeSpecies: ["pollo"], hasBroilerBatches: true })
    ).toBe("engorde");

    expect(
      resolveRecommendedPreset({
        activeSpecies: ["gallina", "pollo"],
        totalEggs: 500,
        totalMeatKg: 120,
        hasLayingAnimals: true,
        hasBroilerBatches: true,
      })
    ).toBe("gerencial");
  });

  it("normaliza configuración deduplicando, filtrando IDs inválidos y limitando a 4 pines", () => {
    const raw = {
      preset: "custom",
      widgets: [
        { id: "unknown_widget", visible: true, order: 0, pinnedToHome: true },
        { id: "laying_rate", visible: true, order: 2, size: "wide", customTarget: 86, pinnedToHome: true },
        { id: "laying_rate", visible: false, order: 0, pinnedToHome: false }, // duplicate ignored
        { id: "mortality_rate", visible: true, order: 1, customTarget: Number.NaN, pinnedToHome: true },
        { id: "feed_autonomy", visible: true, order: 3, pinnedToHome: true },
        { id: "net_profit", visible: true, order: 4, pinnedToHome: true },
        { id: "cost_per_egg", visible: true, order: 5, pinnedToHome: true },
        { id: "chart_laying_curve", visible: true, order: 6, pinnedToHome: true }, // charts don't support pin
      ],
    };

    const normalized = normalizeKpiDashboardConfig(raw, "postura");

    expect(normalized.widgets).toHaveLength(KPI_WIDGET_IDS.length);
    const uniqueIds = new Set(normalized.widgets.map((w) => w.id));
    expect(uniqueIds.size).toBe(KPI_WIDGET_IDS.length);

    expect(normalized.widgets[0].id).toBe("mortality_rate");
    expect(normalized.widgets[0].customTarget).toBeNull();
    expect(normalized.widgets[1].id).toBe("laying_rate");
    expect(normalized.widgets[1].size).toBe("wide");
    expect(normalized.widgets[1].customTarget).toBe(86);

    const pinned = normalized.widgets.filter((w) => w.pinnedToHome);
    expect(pinned).toHaveLength(MAX_PINNED_KPI_WIDGETS);
    expect(pinned.some((w) => w.id === "chart_laying_curve")).toBe(false);
    expect(normalized.widgets.every((w, idx) => w.order === idx)).toBe(true);
  });

  it("evalúa estado de KPIs para higher_is_better, lower_is_better y metas personalizadas", () => {
    expect(
      evaluateKpiStatus(85, {
        direction: "higher_is_better",
        benchmarkTarget: 82,
        warningThreshold: 72,
        criticalThreshold: 60,
      }).status
    ).toBe("optimal");

    expect(
      evaluateKpiStatus(70, {
        direction: "higher_is_better",
        benchmarkTarget: 82,
        warningThreshold: 72,
        criticalThreshold: 60,
      }).status
    ).toBe("warning");

    expect(
      evaluateKpiStatus(55, {
        direction: "higher_is_better",
        benchmarkTarget: 82,
        warningThreshold: 72,
        criticalThreshold: 60,
      }).status
    ).toBe("critical");

    // Custom target override: user requires 90% instead of 82%
    expect(
      evaluateKpiStatus(85, {
        direction: "higher_is_better",
        customTarget: 90,
        benchmarkTarget: 82,
        warningThreshold: 72,
        criticalThreshold: 60,
      }).status
    ).toBe("warning");

    // Lower is better (mortality)
    expect(
      evaluateKpiStatus(1.2, {
        direction: "lower_is_better",
        benchmarkTarget: 1.5,
        warningThreshold: 3,
        criticalThreshold: 5,
      }).status
    ).toBe("optimal");

    expect(
      evaluateKpiStatus(5.5, {
        direction: "lower_is_better",
        benchmarkTarget: 1.5,
        warningThreshold: 3,
        criticalThreshold: 5,
      }).status
    ).toBe("critical");

    expect(evaluateKpiStatus(null, { direction: "higher_is_better", benchmarkTarget: 80 }).status).toBe(
      "neutral"
    );
  });

  it("calcula variación porcentual vs. período anterior de forma segura", () => {
    expect(computeDeltaPct(110, 100)).toBe(10);
    expect(computeDeltaPct(80, 100)).toBe(-20);
    expect(computeDeltaPct(50, 0)).toBeNull();
    expect(computeDeltaPct(null, 100)).toBeNull();
  });
});

describe("API /api/analisis/kpis y /api/analisis/kpis/config conectados a granja", () => {
  const farmId = randomUUID();
  const ownerId = randomUUID();
  const operatorId = randomUUID();
  let locationId = "";
  let batchId = "";

  beforeAll(async () => {
    await db.insert(farms).values({
      id: farmId,
      slug: `test-kpi-${farmId.slice(0, 8)}`,
      name: "Granja KPI Personalizable",
      deploymentMode: "saas",
      planCode: "PRO_MEDIANA",
    });

    await runWithFarmContext(farmId, async () => {
      await db.insert(users).values([
        {
          id: ownerId,
          farmId,
          username: `owner_${ownerId.slice(0, 8)}`,
          passwordHash: "hash",
          name: "Propietario Test",
          role: "propietario",
        },
        {
          id: operatorId,
          farmId,
          username: `fin_${operatorId.slice(0, 8)}`,
          passwordHash: "hash",
          name: "Financiero Test",
          role: "financiero",
        },
      ]);

      const [loc] = await db
        .insert(farmLocations)
        .values({
          farmId,
          code: "GAL-KPI-1",
          name: "Galpón Codornices KPI",
          type: "galpon",
        })
        .returning({ id: farmLocations.id });
      locationId = loc.id;

      const [batch] = await db
        .insert(broilerBatches)
        .values({
          farmId,
          code: "LOT-KPI-01",
          species: "codorniz",
          purpose: "postura_huevo",
          breed: "Coturnix japonica",
          startDate: isoDaysAgo(45),
          initialQuantity: 200,
          currentQuantity: 196,
          targetWeeks: 8,
          targetWeightKg: "0.18",
          locationId,
          status: "activo",
        })
        .returning({ id: broilerBatches.id });
      batchId = batch.id;

      await db.insert(eggProduction).values([
        {
          farmId,
          date: isoDaysAgo(2),
          species: "codorniz",
          batchId,
          locationId,
          totalCollected: 170,
        },
        {
          farmId,
          date: isoDaysAgo(35), // previous period when period=30
          species: "codorniz",
          batchId,
          locationId,
          totalCollected: 140,
        },
      ]);

      await db.insert(mortalityRecords).values({
        farmId,
        date: isoDaysAgo(3),
        species: "codorniz",
        birdType: "codorniz",
        quantity: 4,
        cause: "accidente",
        batchId,
        locationId,
      });

      const [feed] = await db
        .insert(feedInventory)
        .values({
          farmId,
          name: "Concentrado Codorniz Test",
          category: "Concentrado",
          feedType: "Concentrado Codorniz",
          unit: "kg",
          currentStock: "100.00",
          minStock: "20.00",
          costPerUnit: "3000.00",
        })
        .returning({ id: feedInventory.id });

      await db.insert(feedMovements).values({
        farmId,
        feedId: feed.id,
        quantity: "30.00",
        isEntry: false,
        movementType: "consumo_manual",
        species: "codorniz",
        locationId,
        unitCost: "3000.00",
        date: isoDaysAgo(1),
      });

      await db.insert(transactions).values([
        {
          farmId,
          date: isoDaysAgo(1),
          type: "ingreso",
          category: "venta_huevos",
          description: "Venta huevos codorniz",
          amount: "240000.00",
          species: "codorniz",
          locationId,
          batchId,
        },
        {
          farmId,
          date: isoDaysAgo(1),
          type: "egreso",
          category: "alimento",
          description: "Compra alimento",
          amount: "90000.00",
          species: "codorniz",
          locationId,
          batchId,
        },
        {
          farmId,
          date: isoDaysAgo(36),
          type: "ingreso",
          category: "venta_huevos",
          description: "Venta período anterior",
          amount: "180000.00",
          species: "codorniz",
          locationId,
          batchId,
        },
        {
          farmId,
          date: isoDaysAgo(36),
          type: "egreso",
          category: "alimento",
          description: "Gasto período anterior",
          amount: "100000.00",
          species: "codorniz",
          locationId,
          batchId,
        },
      ]);
    });
  });

  afterEach(async () => {
    await runWithFarmContext(farmId, async () => {
      await db
        .delete(appSettings)
        .where(
          and(
            eq(appSettings.farmId, farmId),
            inArray(appSettings.key, [
              `${KPI_CONFIG_KEY_PREFIX}${ownerId}`,
              `${KPI_CONFIG_KEY_PREFIX}${operatorId}`,
              KPI_DEFAULT_CONFIG_KEY,
            ])
          )
        );
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

  it("guarda preferencias de propietario, siembra plantilla por defecto y permite personalización por usuario", async () => {
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: ownerId,
      farmId,
      username: `owner_${ownerId.slice(0, 8)}`,
      name: "Propietario Test",
      role: "propietario",
    });

    const initialRes = await configGET(mockRequest("http://localhost/api/analisis/kpis/config"));
    expect(initialRes.status).toBe(200);
    const initialBody = await parseJson(initialRes);
    expect(initialBody.source).toBe("recommended");
    expect(initialBody.recommendedPreset).toBe("postura");

    const customPreset = buildPresetConfig("gerencial", "postura");
    const putOwner = await configPUT(
      mockRequest("http://localhost/api/analisis/kpis/config", {
        method: "PUT",
        body: {
          preset: "gerencial",
          widgets: customPreset.widgets,
          seedFarmDefault: true,
        },
      })
    );
    expect(putOwner.status).toBe(200);
    const putOwnerBody = await parseJson(putOwner);
    expect(putOwnerBody.seededDefault).toBe(true);
    expect(putOwnerBody.config.preset).toBe("gerencial");

    // Operario sin analytics:read sigue bloqueado en /api/analisis/kpis/config
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: operatorId,
      farmId,
      username: `oper_${operatorId.slice(0, 8)}`,
      name: "Operario Sin Acceso",
      role: "operario",
    });
    const operDeniedRes = await configGET(mockRequest("http://localhost/api/analisis/kpis/config"));
    expect(operDeniedRes.status).toBe(403);

    // Second user (financiero, con analytics:read y sin settings:manage) inherits farm_default
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: operatorId,
      farmId,
      username: `fin_${operatorId.slice(0, 8)}`,
      name: "Financiero Test",
      role: "financiero",
    });

    const opInitialRes = await configGET(mockRequest("http://localhost/api/analisis/kpis/config"));
    expect(opInitialRes.status).toBe(200);
    const opInitial = await parseJson(opInitialRes);
    expect(opInitial.source).toBe("farm_default");
    expect(opInitial.config.preset).toBe("gerencial");

    // Operator saves their own layout -> user source, preserves default
    const opCustom = await configPUT(
      mockRequest("http://localhost/api/analisis/kpis/config", {
        method: "PUT",
        body: {
          preset: "postura",
        },
      })
    );
    expect(opCustom.status).toBe(200);
    const opCustomBody = await parseJson(opCustom);
    expect(opCustomBody.seededDefault).toBe(false);

    const opReloadRes = await configGET(mockRequest("http://localhost/api/analisis/kpis/config"));
    const opReload = await parseJson(opReloadRes);
    expect(opReload.source).toBe("user");
    expect(opReload.config.preset).toBe("postura");
  });

  it("valida payloads inválidos en PUT /api/analisis/kpis/config y parámetros en GET /api/analisis/kpis", async () => {
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: ownerId,
      farmId,
      username: `owner_${ownerId.slice(0, 8)}`,
      name: "Propietario Test",
      role: "propietario",
    });

    const badPreset = await configPUT(
      mockRequest("http://localhost/api/analisis/kpis/config", {
        method: "PUT",
        body: { preset: "inexistente" },
      })
    );
    expect(badPreset.status).toBe(400);

    const badBatch = await kpisGET(
      mockRequest("http://localhost/api/analisis/kpis?batchId=not-a-uuid")
    );
    expect(badBatch.status).toBe(400);

    const missingBatch = await kpisGET(
      mockRequest(`http://localhost/api/analisis/kpis?batchId=${randomUUID()}`)
    );
    expect(missingBatch.status).toBe(404);
  });

  it("retorna métricas enriquecidas conectadas a granja y soporta filtro batchId conservando contrato", async () => {
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: ownerId,
      farmId,
      username: `owner_${ownerId.slice(0, 8)}`,
      name: "Propietario Test",
      role: "propietario",
    });

    const res = await kpisGET(
      mockRequest(`http://localhost/api/analisis/kpis?period=30&batchId=${batchId}`)
    );
    expect(res.status).toBe(200);
    const body = await parseJson(res);

    // Backward-compatible contract
    expect(body.filters.batchId).toBe(batchId);
    expect(body.filters.species).toBe("codorniz");
    expect(body.laying.totalEggs).toBe(170);
    expect(body.mortality.totalDeaths).toBe(4);
    expect(body.periodDays).toBe(30);
    expect(body.peakProduction).toBeDefined();
    expect(body.capexRoi).toBeDefined();

    // Enriched farm-connected payload
    expect(body.finance.totalIncome).toBe(240000);
    expect(body.finance.totalExpenses).toBe(90000);
    expect(body.finance.netProfit).toBe(150000);

    expect(body.previousPeriod.totalEggs).toBe(140);
    expect(body.previousPeriod.netProfit).toBe(80000);
    expect(body.previousPeriod.deltas.net_profit).toBe(87.5);

    expect(body.feedAutonomy.currentStockKg).toBe(100);
    expect(body.feedAutonomy.dailyConsumptionKg).toBe(1);
    expect(body.feedAutonomy.daysRemaining).toBe(100);
    expect(body.feedAutonomy.source).toBe("movements");

    expect(body.benchmarks.breedLabel).toBe("Coturnix japonica");
    expect(body.farmContext.locations.some((l: any) => l.id === locationId)).toBe(true);
    expect(body.farmContext.activeBatches.some((b: any) => b.id === batchId)).toBe(true);
    expect(body.farmContext.recommendedPreset).toBe("postura");
    expect(body.customConfig.config.widgets).toHaveLength(KPI_WIDGET_IDS.length);
  });
});
