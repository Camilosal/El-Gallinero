import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { runPendingMigrations } from "@/db/migrate-prod";
import { budgetItems, budgets, transactions } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { inArray, eq } from "drizzle-orm";
import {
  NON_FEED_STANDARD_EXPENSE_FAMILIES,
  STANDARD_EXPENSE_CATALOG,
  STANDARD_EXPENSE_FAMILIES,
  findStandardExpenseById,
  resolveExpenseClassification,
  searchStandardExpenseCatalog,
} from "@/lib/finance/standard-expense-catalog";
import { classifyTransactionNature, computeThreeLayerFinancials, isNonOperatingCatalogueExpense } from "@/lib/analytics/biological-valuation";
import { inferManagedTaxProfile } from "@/lib/analytics/payroll-tax-supplies";
import { GET as catalogoEgresosGet } from "@/app/api/finanzas/catalogo-egresos/route";
import { POST as alinearEgresosPost } from "@/app/api/finanzas/alinear-egresos/route";
import { GET as finanzasGet, POST as finanzasPost } from "@/app/api/finanzas/finanzas/route";
import { POST as presupuestosPost } from "@/app/api/presupuestos/route";
import { GET as presupuestosCompGet } from "@/app/api/presupuestos/comparativo/route";
import { GET as estadoResultadosGet } from "@/app/api/analisis/reportes/estado-resultados/route";
import { GET as analiticaGet } from "@/app/api/analisis/contabilidad-analitica/route";
import { loadExportDataset } from "@/lib/export/datasets";
import { FEED_CATALOG_GROUPS, currentFeedType, inferFeedCatalogGroup } from "@/lib/feed-classification";
import { parseColombianAgroDocument } from "@/lib/attachments-shared";
import { DEFAULT_ERP_MAPPING, formatInventoryItemForProfile, formatTransactionForProfile } from "@/lib/integrations/profiles";
import { AGENT_TOOLS } from "@/lib/agent/tools";

describe("Catálogo estandarizado de egresos (Catalogo Egresos.csv)", () => {
  const createdTxIds: string[] = [];
  const createdBudgetIds: string[] = [];

  beforeAll(async () => {
    await runPendingMigrations(pool);
  });

  afterAll(async () => {
    if (createdBudgetIds.length > 0) {
      await db.delete(budgetItems).where(inArray(budgetItems.budgetId, createdBudgetIds));
      await db.delete(budgets).where(inArray(budgets.id, createdBudgetIds));
    }
    if (createdTxIds.length > 0) {
      await db.delete(transactions).where(inArray(transactions.id, createdTxIds));
    }
  });

  it("carga íntegros los 303 conceptos y 26 familias de Catalogo Egresos.csv", () => {
    const csvPath = path.join(process.cwd(), "docs/Catalogos/Catalogo Egresos.csv");
    const rawLines = fs.readFileSync(csvPath).toString("latin1").trim().split(/\r?\n/);
    expect(rawLines.length - 1).toBe(303);
    expect(STANDARD_EXPENSE_CATALOG).toHaveLength(303);
    expect(STANDARD_EXPENSE_FAMILIES).toHaveLength(26);
    expect(NON_FEED_STANDARD_EXPENSE_FAMILIES).toHaveLength(25);

    const cst090 = findStandardExpenseById("CST-090");
    expect(cst090).toMatchObject({
      id: "CST-090",
      family: "08 Clasificación y empaque",
      concept: "Cubetas de cartón para huevos",
      treatment: "VARIABLE",
      driver: "HUEVO_VENDIDO",
      isOpex: true,
      priority: "P1",
    });

    const p1Bio = searchStandardExpenseCatalog("", { family: "03 Bioseguridad", priority: "P1" });
    expect(p1Bio.some((item) => item.id === "CST-024")).toBe(true);
  });

  it("resuelve clasificación contable, tributaria y exclusiones No-OPEX correctamente", () => {
    // 07 Equipos e infraestructura = reparación OPEX (no confundir con CapEx 22)
    const rep = resolveExpenseClassification({
      type: "egreso",
      expenseCatalogId: "CST-076",
      description: "Reparación de comederos",
    });
    expect(rep.expenseFamily).toBe("07 Equipos e infraestructura");
    expect(rep.expenseTreatment).toBe("VARIABLE");
    expect(rep.isOpex).toBe(true);
    expect(rep.accountingNature).toBe("operating_expense");

    // 22 Activos / inversión = CapEx excluido de gasto operativo
    const capex = resolveExpenseClassification({
      type: "egreso",
      expenseCatalogId: "CST-256",
    });
    expect(capex.expenseTreatment).toBe("CAPEX");
    expect(capex.accountingNature).toBe("capex");
    expect(classifyTransactionNature({ type: "egreso", expenseCatalogId: "CST-256", expenseFamily: "22 Activos / inversión", expenseTreatment: "CAPEX", amount: 500000 })).toBe("capex");

    // 26 Servicios no atribuibles al ave = No OPEX y excluido de impuestos de compras/servicios
    const noCosto = resolveExpenseClassification({
      type: "egreso",
      expenseCatalogId: "CST-300",
    });
    expect(noCosto.expenseTreatment).toBe("NO_COSTO");
    expect(noCosto.isOpex).toBe(false);
    expect(isNonOperatingCatalogueExpense({ type: "egreso", expenseCatalogId: "CST-300", expenseFamily: noCosto.expenseFamily, expenseTreatment: "NO_COSTO", amount: 80000 })).toBe(true);
    expect(inferManagedTaxProfile("egreso", "26 Servicios no atribuibles al ave", "CST-300", "26 Servicios no atribuibles al ave")).toBe("none");

    // Desambiguación automática de categorías históricas
    const agua = resolveExpenseClassification({ type: "egreso", category: "Servicios (agua/luz)", description: "Factura acueducto" });
    expect(agua.expenseFamily).toBe("05 Agua y suministro");
    const luz = resolveExpenseClassification({ type: "egreso", category: "Servicios (agua/luz)", description: "Recibo energía kWh" });
    expect(luz.expenseFamily).toBe("06 Energía y clima");

    // Three-layer financials separa OPEX vs No-OPEX (FINANCIERO / NO_COSTO / MERMA)
    const three = computeThreeLayerFinancials({
      transactions: [
        { type: "ingreso", category: "Venta de huevos", amount: 1000000 },
        { type: "egreso", category: "08 Clasificación y empaque", expenseCatalogId: "CST-090", expenseFamily: "08 Clasificación y empaque", expenseTreatment: "VARIABLE", amount: 100000 },
        { type: "egreso", category: "26 Servicios no atribuibles al ave", expenseCatalogId: "CST-300", expenseFamily: "26 Servicios no atribuibles al ave", expenseTreatment: "NO_COSTO", amount: 250000 },
      ],
      accruedFeedConsumedCostCop: 0,
      hasFeedConsumptionRecords: false,
      assetsSummary: { totalAcquisitionCostCop: 0, totalDepreciableCop: 0, periodDepreciationCop: 0, accumulatedDepreciationCop: 0, netBookValueCop: 0, capexRecoveryPct: 0, activeAssetCount: 0, breakdown: [] },
      warehouseSummary: { totalValueCop: 0, totalKg: 0, bultos40Kg: 0, lowStockCount: 0, items: [] },
      biologicalSummary: { totalAliveAnimals: 0, totalBiologicalValueCop: 0, totalInvestedBaseCop: 0, unrealizedBiologicalGainCop: 0, projectedHarvestValueCop: 0, meatBiologicalValueCop: 0, layerCapitalValueCop: 0, breederCapitalValueCop: 0, lifecycleMode: "sin_poblacion", lifecycleLabel: "Sin", lifecycleDescription: "", activeSanitaryPauseLocations: [], units: [], alerts: [], bySpecies: {} },
    });
    expect(three.directOperatingCashOutflowCop).toBe(100000);
    expect(three.nonOperatingCashOutflowCop).toBe(250000);
    expect(three.accruedOperatingExpenseCop).toBe(100000);
    expect(three.operatingNetProfitCop).toBe(900000);
    expect(three.cashNetFlowCop).toBe(650000);
  });

  it("articula entrada API, P&L por Familia/Tratamiento, analítica, presupuestos, alineación y exportación", async () => {
    // 1. Consulta catálogo por API
    const catRes = await catalogoEgresosGet(
      new NextRequest("http://localhost:3000/api/finanzas/catalogo-egresos?q=cubeta&family=08+Clasificación+y+empaque"),
    );
    expect(catRes.status).toBe(200);
    const catBody = await catRes.json();
    expect(catBody.items.some((i: { id: string }) => i.id === "CST-090")).toBe(true);

    // 2. Registra egresos estándar: CST-090 (OPEX) y CST-300 (NO_COSTO)
    const testDate = "2026-11-18";
    const resOpex = await finanzasPost(
      new NextRequest("http://localhost:3000/api/finanzas/finanzas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: testDate,
          type: "egreso",
          category: "08 Clasificación y empaque",
          expenseCatalogId: "CST-090",
          description: "Cubetas cartón x30 test estándar",
          amount: "48000",
        }),
      }),
    );
    expect(resOpex.status).toBe(201);
    const txOpex = await resOpex.json();
    createdTxIds.push(txOpex.id);
    expect(txOpex.expenseCatalogId).toBe("CST-090");
    expect(txOpex.expenseFamily).toBe("08 Clasificación y empaque");
    expect(txOpex.expenseTreatment).toBe("VARIABLE");
    expect(txOpex.expenseDriver).toBe("HUEVO_VENDIDO");

    const resNonOpex = await finanzasPost(
      new NextRequest("http://localhost:3000/api/finanzas/finanzas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: testDate,
          type: "egreso",
          category: "26 Servicios no atribuibles al ave",
          expenseCatalogId: "CST-300",
          description: "Gasto familiar personal no atribuible test",
          amount: "90000",
        }),
      }),
    );
    expect(resNonOpex.status).toBe(201);
    const txNonOpex = await resNonOpex.json();
    createdTxIds.push(txNonOpex.id);
    expect(txNonOpex.expenseTreatment).toBe("NO_COSTO");

    // 3. Estado de Resultados agrupa por Familia y separa OPEX vs No-OPEX
    const plRes = await estadoResultadosGet(
      new NextRequest(`http://localhost:3000/api/analisis/reportes/estado-resultados?from=${testDate}&to=${testDate}`),
    );
    expect(plRes.status).toBe(200);
    const plBody = await plRes.json();
    expect(plBody.expenses.byFamily.some((f: { family: string }) => f.family === "08 Clasificación y empaque")).toBe(true);
    expect(plBody.expenses.opexTotal).toBeGreaterThanOrEqual(48000);
    expect(plBody.expenses.nonOpexTotal).toBeGreaterThanOrEqual(90000);

    // 4. Contabilidad Analítica excluye NO_COSTO de costos directos del ave
    const anaRes = await analiticaGet(
      new NextRequest(`http://localhost:3000/api/analisis/contabilidad-analitica?from=${testDate}&to=${testDate}`),
    );
    expect(anaRes.status).toBe(200);
    const anaBody = await anaRes.json();
    expect(anaBody.expensesByFamily.some((f: { family: string }) => f.family === "08 Clasificación y empaque")).toBe(true);
    expect(anaBody.totals.nonOperatingExcluded).toBeGreaterThanOrEqual(90000);

    // 5. Presupuestos por Familia / centro suman automáticamente los egresos de la familia
    const budgetRes = await presupuestosPost(
      new NextRequest("http://localhost:3000/api/presupuestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Presupuesto Empaque Estandarizado Test",
          periodStart: "2026-11-01",
          periodEnd: "2026-11-30",
          type: "egreso",
          items: [
            {
              category: "08 Clasificación y empaque",
              expenseFamily: "08 Clasificación y empaque",
              monthlyTarget: "100000",
            },
          ],
        }),
      }),
    );
    expect(budgetRes.status).toBe(201);
    const createdBudget = await budgetRes.json();
    createdBudgetIds.push(createdBudget.id);

    const compRes = await presupuestosCompGet(
      new NextRequest(`http://localhost:3000/api/presupuestos/comparativo?budgetId=${createdBudget.id}`),
    );
    expect(compRes.status).toBe(200);
    const compBody = await compRes.json();
    expect(compBody.items[0].actual).toBeGreaterThanOrEqual(48000);

    // 6. Alineación retroactiva de un egreso legado sin metadata estándar (sin tocar monto)
    const [legacyRow] = await db
      .insert(transactions)
      .values({
        date: testDate,
        type: "egreso",
        category: "Control sanitario",
        description: "Vacuna Bronquitis Legado Test",
        amount: "33500.00",
      })
      .returning();
    createdTxIds.push(legacyRow.id);

    const alignRes = await alinearEgresosPost(
      new NextRequest("http://localhost:3000/api/finanzas/alinear-egresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncCatalogosList: true }),
      }),
    );
    expect(alignRes.status).toBe(200);
    const alignBody = await alignRes.json();
    expect(alignBody.updatedTransactions).toBeGreaterThanOrEqual(1);

    const [reloadedLegacy] = await db.select().from(transactions).where(eq(transactions.id, legacyRow.id));
    expect(reloadedLegacy.expenseFamily).toBe("01 Sanidad preventiva");
    expect(reloadedLegacy.expenseCatalogId).toBe("CST-001");
    expect(reloadedLegacy.expenseTreatment).toBe("VARIABLE");
    expect(reloadedLegacy.amount).toBe("33500.00");

    // 7. Dataset exportable Finanzas incluye columnas estandarizadas CST y Familia
    const expData = await runWithFarmContext(DEFAULT_FARM_ID, () =>
      loadExportDataset("finanzas", { from: testDate, to: testDate }),
    );
    expect(expData?.headers).toContain("Código catálogo (CST)");
    expect(expData?.headers).toContain("Familia / centro");
    expect(expData?.rows.some((r) => r.includes("CST-090") && r.includes("08 Clasificación y empaque"))).toBe(true);

    // 8. GET /api/finanzas/finanzas devuelve byFamily enriquecido
    const finRes = await finanzasGet(new NextRequest("http://localhost:3000/api/finanzas/finanzas?period=30"));
    expect(finRes.status).toBe(200);
    const finBody = await finRes.json();
    expect(Array.isArray(finBody.byFamily)).toBe(true);
  });

  it("alinea enums de alimentos, OCR, perfiles ERP, exportación IG/Grupo y herramientas del agente", async () => {
    // 1. Alimentos: normaliza legacy concentrado_comercial y reconoce los 9 grupos CSV
    expect(FEED_CATALOG_GROUPS).toHaveLength(9);
    expect(currentFeedType("concentrado_comercial")).toBe("Concentrado Aves");
    expect(inferFeedCatalogGroup("concentrado_comercial", "Concentrado Codorniz Cría y Postura", "Concentrado")).toBe(
      "Balanceados",
    );

    // 2. OCR de factura no alimentaria clasifica hacia Familia + CST estándar
    const ocrVet = parseColombianAgroDocument(
      "factura_compra",
      "FACTURA FE-991 Proveedor: VetMarket NIT: 900111222-3 Producto: Vacuna Newcastle B1 ICA Cantidad: 2 Total: $180.000",
    );
    expect(ocrVet.mode).toBe("factura_compra");
    if (ocrVet.mode === "factura_compra") {
      expect(ocrVet.expenseFamily).toBe("01 Sanidad preventiva");
      expect(ocrVet.expenseCatalogId).toBe("CST-001");
      expect(ocrVet.expenseTreatment).toBe("VARIABLE");
    }

    // 3. Conectores ERP Alegra, Odoo y Zoho incluyen campos estándar de egreso y alimentos
    const sampleTx = {
      id: "tx-erp-1",
      date: "2026-11-22",
      type: "egreso" as const,
      category: "Control sanitario",
      description: "Vacuna Newcastle",
      counterparty: "VetMarket",
      amount: 180000,
      quantity: 2,
      unitPrice: 90000,
      unit: "unidades",
      presentation: "Unidad",
      species: "gallina",
      locationId: null,
      locationCode: null,
      locationName: null,
      batchId: null,
      isCredit: false,
      sourceType: "sanidad",
      sourceId: null,
      expenseCatalogId: "CST-001",
      expenseFamily: "01 Sanidad preventiva",
      expenseConcept: "Vacunas adquiridas",
      expenseTreatment: "VARIABLE",
      notes: null,
      createdAt: "2026-11-22T12:00:00.000Z",
    };
    const alegraTx = formatTransactionForProfile(sampleTx, "alegra", DEFAULT_ERP_MAPPING);
    expect(alegraTx.expenseCatalogId).toBe("CST-001");
    expect(alegraTx.expenseFamily).toBe("01 Sanidad preventiva");
    const odooTx = formatTransactionForProfile(sampleTx, "odoo", DEFAULT_ERP_MAPPING);
    expect(odooTx.expense_catalog_id).toBe("CST-001");
    expect(odooTx.expense_family).toBe("01 Sanidad preventiva");
    const zohoTx = formatTransactionForProfile(sampleTx, "zoho", DEFAULT_ERP_MAPPING);
    expect(zohoTx.expense_catalog_id).toBe("CST-001");
    expect(zohoTx.expense_family).toBe("01 Sanidad preventiva");

    const zohoInv = formatInventoryItemForProfile(
      {
        id: "f-1",
        sku: "IG-015-FEED-1",
        itemType: "alimento",
        name: "Maíz amarillo seco en grano",
        category: "Preparados",
        subCategory: "Maiz en Grano",
        standardCatalogId: "IG-015",
        catalogGroup: "Cereales y semillas",
        sanitaryStatus: "CONDICIONAL",
        unit: "kg",
        currentStock: 100,
        minStock: 20,
        costPerUnit: 1800,
        inventoryValue: 180000,
        supplier: null,
        updatedAt: "2026-11-22T12:00:00.000Z",
      },
      "zoho",
      DEFAULT_ERP_MAPPING,
    );
    expect(zohoInv.standard_catalog_id).toBe("IG-015");
    expect(zohoInv.catalog_group).toBe("Cereales y semillas");

    // 4. Exportación de alimentos incluye IG y Grupo catálogo
    const feedExp = await runWithFarmContext(DEFAULT_FARM_ID, () =>
      loadExportDataset("alimento-inventario", { from: "2026-01-01", to: "2026-12-31" }),
    );
    expect(feedExp?.headers).toContain("Código estándar (IG)");
    expect(feedExp?.headers).toContain("Grupo catálogo");

    // 5. Esquemas de herramientas del agente expuestos con enums estándar
    const gastoTool = AGENT_TOOLS.find((t) => t.name === "registrar_gasto");
    const feedTool = AGENT_TOOLS.find((t) => t.name === "gestionar_alimento");
    const budgetTool = AGENT_TOOLS.find((t) => t.name === "registrar_presupuesto");
    expect((gastoTool?.parameters as any)?.properties?.familia?.enum).toHaveLength(26);
    expect((feedTool?.parameters as any)?.properties?.grupo_catalogo?.enum).toHaveLength(9);
    expect((budgetTool?.parameters as any)?.properties?.rubros?.items?.properties?.familia?.enum).toHaveLength(26);
  });
});
