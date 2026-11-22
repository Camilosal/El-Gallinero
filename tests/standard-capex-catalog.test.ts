import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db";
import { runPendingMigrations } from "@/db/migrate-prod";
import { catalogos, farmAssets, transactions } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import {
  STANDARD_CAPEX_CATALOG,
  STANDARD_CAPEX_FAMILIES,
  STANDARD_CAPEX_SUBFAMILIES,
  PRODUCTIVE_CAPEX_FAMILIES,
  computeSuggestedResidualCop,
  findStandardCapexById,
  resolveCapexClassification,
  searchStandardCapexCatalog,
} from "@/lib/finance/standard-capex-catalog";
import { alignFarmCapexCatalog } from "@/lib/finance/capex-catalog-alignment";
import { computeAssetsDepreciationSummary } from "@/lib/analytics/biological-valuation";
import { computeThreeLayerFinancials } from "@/lib/analytics/biological-valuation";
import { getApiPermission } from "@/lib/api-rbac";
import { loadExportDataset } from "@/lib/export/datasets";
import { GET as catalogoCapexGet } from "@/app/api/operaciones/activos/catalogo-capex/route";
import { POST as alinearCapexPost } from "@/app/api/operaciones/activos/alinear-catalogo/route";
import { GET as activosGet, POST as activosPost } from "@/app/api/operaciones/activos/route";
import { GET as estadoResultadosGet } from "@/app/api/analisis/reportes/estado-resultados/route";
import { GET as rentabilidadGet } from "@/app/api/analisis/reportes/rentabilidad/route";
import { GET as contabilidadAnaliticaGet } from "@/app/api/analisis/contabilidad-analitica/route";

const createdAssetIds: string[] = [];
const createdTxIds: string[] = [];

describe("Catálogo Estándar de CapEx e Inversiones (CAP-001..CAP-242)", () => {
  beforeAll(async () => {
    await runPendingMigrations(pool);
  });

  afterAll(async () => {
    await runWithFarmContext(DEFAULT_FARM_ID, async () => {
      if (createdAssetIds.length > 0) {
        await db.delete(transactions).where(and(eq(transactions.farmId, DEFAULT_FARM_ID), inArray(transactions.sourceId, createdAssetIds)));
        await db.delete(farmAssets).where(and(eq(farmAssets.farmId, DEFAULT_FARM_ID), inArray(farmAssets.id, createdAssetIds)));
      }
      if (createdTxIds.length > 0) {
        await db.delete(transactions).where(and(eq(transactions.farmId, DEFAULT_FARM_ID), inArray(transactions.id, createdTxIds)));
      }
    });
  });

  it("carga exactamente los 242 conceptos, 21 familias y 20 subfamilias desde Catalogo Capex - Inversiones.csv", () => {
    expect(STANDARD_CAPEX_CATALOG.length).toBe(242);
    expect(STANDARD_CAPEX_FAMILIES.length).toBe(21);
    expect(PRODUCTIVE_CAPEX_FAMILIES.length).toBe(20);
    expect(STANDARD_CAPEX_SUBFAMILIES.length).toBeGreaterThanOrEqual(20);

    const estructura = findStandardCapexById("CAP-001");
    expect(estructura).toMatchObject({
      id: "CAP-001",
      family: "01 Estructuras avícolas",
      subfamily: "Alojamiento",
      classification: "CAPEX_DEPRECIABLE",
      destination: "Compartido",
      suggestedLifeMonths: 72,
      suggestedResidualRate: 0.1,
      suggestedExpenseCatalogId: "CST-255",
      defaultLegacyCategory: "estructura",
    });

    const terreno = findStandardCapexById("CAP-228");
    expect(terreno).toMatchObject({
      id: "CAP-228",
      family: "20 Activos no depreciables",
      subfamily: "Terreno",
      classification: "CAPEX_NO_DEPRECIABLE",
      suggestedLifeMonths: 0,
      suggestedResidualRate: 0,
      isNonDepreciableLand: true,
      isDepreciable: false,
      isPhysicalOrIntangibleCapex: true,
    });

    const intangible = findStandardCapexById("CAP-224");
    expect(intangible).toMatchObject({
      id: "CAP-224",
      family: "19 Intangibles capitalizables",
      classification: "INTANGIBLE_AMORTIZABLE",
      suggestedLifeMonths: 36,
      isDepreciable: true,
    });

    const fronteraBio = findStandardCapexById("CAP-230");
    expect(fronteraBio?.isFrontierExclusion).toBe(true);
    expect(fronteraBio?.frontierRedirect?.href).toBe("/produccion/adquisiciones");

    const fronteraOpex = findStandardCapexById("CAP-236");
    expect(fronteraOpex?.classification).toBe("OPEX_NO_CAPEX");
    expect(fronteraOpex?.frontierRedirect?.href).toBe("/operaciones/mantenimiento");

    expect(computeSuggestedResidualCop(10_000_000, estructura!.suggestedResidualRate)).toBe(1_000_000);
  });

  it("filtra correctamente por familia, clasificación, destino y exclusión de fronteras", () => {
    const prodOnly = searchStandardCapexCatalog("", { excludeFrontier: true });
    expect(prodOnly.some((item) => item.id === "CAP-235")).toBe(false);
    expect(prodOnly.some((item) => item.id === "CAP-228")).toBe(true);

    const landOnly = searchStandardCapexCatalog("", { classification: "CAPEX_NO_DEPRECIABLE" });
    expect(landOnly.map((i) => i.id)).toEqual(["CAP-228", "CAP-229"]);

    const huevos = searchStandardCapexCatalog("huevo", { destination: "Huevos" });
    expect(huevos.length).toBeGreaterThan(0);
    expect(huevos.every((i) => i.destination === "Huevos")).toBe(true);
  });

  it("calcula depreciación $0 para Terrenos (CAPEX_NO_DEPRECIABLE) y agrupa por Familia, Subfamilia, Clasificación y Destino", () => {
    const summary = computeAssetsDepreciationSummary(
      [
        {
          id: "land-1",
          code: "ACT-9001",
          name: "Lote rural principal",
          category: "estructura",
          status: "operativo",
          capexCatalogId: "CAP-228",
          capexFamily: "20 Activos no depreciables",
          capexSubfamily: "Terreno",
          capexClassification: "CAPEX_NO_DEPRECIABLE",
          capexDestination: "Compartido",
          capexDriver: "m² asignados",
          acquisitionDate: "2026-01-01",
          acquisitionCost: "50000000",
          usefulLifeMonths: 0,
          residualValue: "0",
          depreciationBasis: "meses",
        },
        {
          id: "egg-equip-1",
          code: "ACT-9002",
          name: "Clasificadora de huevo semi-automática",
          category: "equipo",
          status: "operativo",
          capexCatalogId: "CAP-082",
          capexFamily: "08 Recolección y huevo",
          capexSubfamily: "Clasificación y almacenamiento",
          capexClassification: "CAPEX_DEPRECIABLE",
          capexDestination: "Huevos",
          capexDriver: "huevos procesados",
          acquisitionDate: "2026-01-01",
          acquisitionCost: "12000000",
          usefulLifeMonths: 48,
          residualValue: "0",
          depreciationBasis: "meses",
        },
      ],
      { fromDate: "2026-06-01", toDate: "2026-06-30" },
    );

    expect(summary.totalAcquisitionCostCop).toBe(62_000_000);
    const landRow = summary.breakdown.find((r) => r.id === "land-1");
    expect(landRow?.periodDepreciationCop).toBe(0);
    expect(landRow?.accumulatedDepreciationCop).toBe(0);
    expect(landRow?.netBookValueCop).toBe(50_000_000);

    const equipRow = summary.breakdown.find((r) => r.id === "egg-equip-1");
    expect(equipRow?.periodDepreciationCop).toBeGreaterThan(200_000);

    expect(summary.byFamily?.length).toBe(2);
    expect(summary.byClassification?.some((c) => c.key === "CAPEX_NO_DEPRECIABLE")).toBe(true);
    expect(summary.byDestination?.find((d) => d.key === "Huevos")?.periodDepreciationCop).toBeCloseTo(
      equipRow!.periodDepreciationCop,
      1,
    );

    // Three-layer financials preserva el patrimonio neto incluyendo terreno + equipo sin inflar gasto con OPEX falso
    const threeLayer = computeThreeLayerFinancials({
      transactions: [],
      accruedFeedConsumedCostCop: 0,
      hasFeedConsumptionRecords: false,
      assetsSummary: summary,
      warehouseSummary: { totalValueCop: 0, totalKg: 0, bultos40Kg: 0, lowStockCount: 0, items: [] },
      biologicalSummary: {
        lifecycleMode: "produccion_plena",
        lifecycleLabel: "Producción",
        lifecycleDescription: "",
        totalAliveAnimals: 0,
        totalInvestedBaseCop: 0,
        totalBiologicalValueCop: 0,
        unrealizedBiologicalGainCop: 0,
        projectedHarvestValueCop: 0,
        layerCapitalValueCop: 0,
        meatBiologicalValueCop: 0,
        breederCapitalValueCop: 0,
        activeSanitaryPauseLocations: [],
        bySpecies: {},
        alerts: [],
        units: [],
      },
    });
    expect(threeLayer.netEquipmentBookValueCop).toBe(summary.netBookValueCop);
    expect(threeLayer.periodDepreciationCop).toBe(summary.periodDepreciationCop);
  });

  it("expone GET /api/operaciones/activos/catalogo-capex con filtros y RBAC", async () => {
    expect(getApiPermission("/api/operaciones/activos/catalogo-capex", "GET")).toEqual([
      "operations:manage",
      "inventory:read",
      "finance:read",
      "catalogs:write",
    ]);
    expect(getApiPermission("/api/operaciones/activos/alinear-catalogo", "POST")).toEqual([
      "operations:manage",
      "catalogs:write",
      "finance:write",
    ]);

    const res = await catalogoCapexGet(
      new NextRequest(
        "http://localhost:3000/api/operaciones/activos/catalogo-capex?family=04+Suministro+de+agua&excludeFrontier=true",
      ),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.families).toHaveLength(20);
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((i: { family: string }) => i.family === "04 Suministro de agua")).toBe(true);
  });

  it("crea activos CapEx depreciables y terrenos en POST /api/operaciones/activos y bloquea fronteras OPEX/Biológicas", async () => {
    await runWithFarmContext(DEFAULT_FARM_ID, async () => {
      // 1. Bloquear frontera contable OPEX (CAP-235 Vacunas consumibles)
      const frontierRes = await activosPost(
        new NextRequest("http://localhost:3000/api/operaciones/activos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Lote de vacunas Newcastle",
            capexCatalogId: "CAP-235",
            acquisitionCost: 350000,
          }),
        }),
      );
      expect(frontierRes.status).toBe(400);
      const frontierErr = await frontierRes.json();
      expect(frontierErr.error).toContain("Frontera contable");

      // 2. Bloquear código CAP inválido
      const badCodeRes = await activosPost(
        new NextRequest("http://localhost:3000/api/operaciones/activos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Equipo raro",
            capexCatalogId: "CAP-999",
            acquisitionCost: 100000,
          }),
        }),
      );
      expect(badCodeRes.status).toBe(400);

      // 3. Crear estructura estándar CAP-001 con recordCashPurchase = true -> vincula CST-255 + residual 10% + 72 meses
      const capexRes = await activosPost(
        new NextRequest("http://localhost:3000/api/operaciones/activos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Galpón Ponederas Sur (CAP Test)",
            capexCatalogId: "CAP-001",
            acquisitionDate: "2026-10-01",
            acquisitionCost: 10_000_000,
            recordCashPurchase: true,
          }),
        }),
      );
      expect(capexRes.status).toBe(201);
      const createdStruct = await capexRes.json();
      createdAssetIds.push(createdStruct.id);
      expect(createdStruct.capexCatalogId).toBe("CAP-001");
      expect(createdStruct.capexFamily).toBe("01 Estructuras avícolas");
      expect(createdStruct.capexSubfamily).toBe("Alojamiento");
      expect(createdStruct.capexClassification).toBe("CAPEX_DEPRECIABLE");
      expect(createdStruct.usefulLifeMonths).toBe(72);
      expect(Number(createdStruct.residualValue)).toBe(1_000_000);

      const [linkedTx] = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.farmId, DEFAULT_FARM_ID), eq(transactions.sourceId, createdStruct.id)));
      expect(linkedTx).toBeDefined();
      createdTxIds.push(linkedTx.id);
      expect(linkedTx.expenseFamily).toBe("22 Activos / inversión");
      expect(linkedTx.expenseCatalogId).toBe("CST-255");
      expect(linkedTx.expenseTreatment).toBe("CAPEX");
      expect(linkedTx.capexCatalogId).toBe("CAP-001");
      expect(linkedTx.capexFamily).toBe("01 Estructuras avícolas");

      // 4. Crear Terreno CAP-228 (CAPEX_NO_DEPRECIABLE, usefulLifeMonths = 0)
      const landRes = await activosPost(
        new NextRequest("http://localhost:3000/api/operaciones/activos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Lote de expansión oriental",
            capexCatalogId: "CAP-228",
            acquisitionDate: "2026-10-01",
            acquisitionCost: 25_000_000,
          }),
        }),
      );
      expect(landRes.status).toBe(201);
      const createdLand = await landRes.json();
      createdAssetIds.push(createdLand.id);
      expect(createdLand.capexClassification).toBe("CAPEX_NO_DEPRECIABLE");
      expect(createdLand.usefulLifeMonths).toBe(0);
      expect(Number(createdLand.residualValue)).toBe(0);

      // 5. Insertar activo legado sin campos CAPEX y alinear idempotentemente
      const [legacyAsset] = await db
        .insert(farmAssets)
        .values({
          farmId: DEFAULT_FARM_ID,
          code: "ACT-9991",
          name: "Motobomba hidráulica antigua",
          category: "equipo",
          acquisitionCost: "950000",
          acquisitionDate: "2026-09-01",
          status: "operativo",
        })
        .returning();
      createdAssetIds.push(legacyAsset.id);

      const alignRes = await alinearCapexPost(
        new NextRequest("http://localhost:3000/api/operaciones/activos/alinear-catalogo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncCatalogosList: true }),
        }),
      );
      expect(alignRes.status).toBe(200);
      const alignBody = await alignRes.json();
      expect(alignBody.updatedAssets).toBeGreaterThanOrEqual(1);

      const secondAlign = await alignFarmCapexCatalog(DEFAULT_FARM_ID, db, { syncCatalogosList: true });
      expect(secondAlign.updatedAssets).toBe(0);
      expect(secondAlign.addedCatalogEntries).toBe(0);

      const [reloadedLegacy] = await db
        .select()
        .from(farmAssets)
        .where(eq(farmAssets.id, legacyAsset.id));
      expect(reloadedLegacy.capexFamily).toBe("04 Suministro de agua");
      expect(reloadedLegacy.acquisitionCost).toBe("950000.00");

      const capexCatalogEntries = await db
        .select()
        .from(catalogos)
        .where(and(eq(catalogos.farmId, DEFAULT_FARM_ID), eq(catalogos.category, "categoria_capex")));
      expect(capexCatalogEntries.length).toBe(20);

      // 6. Verificar reportes financieros, export CSV/XLSX y listado
      const listRes = await activosGet(
        new NextRequest("http://localhost:3000/api/operaciones/activos"),
      );
      expect(listRes.status).toBe(200);
      const listed = await listRes.json();
      expect(listed.some((a: { id: string; capexFamily?: string }) => a.id === createdStruct.id && a.capexFamily === "01 Estructuras avícolas")).toBe(true);

      const plRes = await estadoResultadosGet(
        new NextRequest("http://localhost:3000/api/analisis/reportes/estado-resultados?from=2026-10-01&to=2026-10-31"),
      );
      expect(plRes.status).toBe(200);
      const plBody = await plRes.json();
      expect(plBody.operatingContext.capexSummary.totalAcquisitionCostCop).toBeGreaterThanOrEqual(35_950_000);
      expect(plBody.operatingContext.capexSummary.byFamily.some((f: { key: string }) => f.key === "20 Activos no depreciables")).toBe(true);

      const rentRes = await rentabilidadGet(
        new NextRequest("http://localhost:3000/api/analisis/reportes/rentabilidad?from=2026-10-01&to=2026-10-31"),
      );
      expect(rentRes.status).toBe(200);
      const rentBody = await rentRes.json();
      expect(Array.isArray(rentBody.operatingContext.capexByFamily)).toBe(true);

      const xlsxRes = await contabilidadAnaliticaGet(
        new NextRequest("http://localhost:3000/api/analisis/contabilidad-analitica?from=2026-10-01&to=2026-10-31&format=xlsx"),
      );
      expect(xlsxRes.status).toBe(200);
      const buf = Buffer.from(await xlsxRes.arrayBuffer());
      expect(Array.from(buf.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

      const exportSheet = await loadExportDataset("activos-capex", { from: "2026-10-01", to: "2026-10-31" });
      expect(exportSheet.headers).toContain("Familia CapEx");
      expect(exportSheet.headers).toContain("Código catálogo CapEx");
      expect(exportSheet.rows.some((r) => r[0] === createdStruct.code && r[2] === "CAP-001")).toBe(true);

      // Resolver heurístico legado
      const fuzzy = resolveCapexClassification({ name: "Panel solar 450W galpón", category: "equipo" });
      expect(fuzzy.capexFamily).toBe("05 Energía y ambiente");
    });
  });
});
