import { db } from "@/db";
import { feedInventory, feedMovements, transactions } from "@/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/rbac";
import { normalizeFeedingSpecies } from "@/lib/species";
import {
  classifyTransactionNature,
  computeThreeLayerFinancials,
} from "@/lib/analytics/biological-valuation";
import {
  OPEX_TREATMENTS,
  TREATMENT_LABELS,
  resolveExpenseClassification,
  type ExpenseTreatmentType,
} from "@/lib/finance/standard-expense-catalog";
import {
  computeAssetsDepreciationSummary,
  computeFeedWarehouseValuation,
  evaluateBiologicalPortfolio,
  loadFarmBiologicalContext,
} from "@/lib/analytics/biological-db";
import { computeSupplyWarehouseValuation } from "@/lib/analytics/payroll-tax-supplies";
import { loadPeriodPayrollAndSupplies } from "@/lib/analytics/payroll-tax-supplies-db";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const directivo = isReadOnlyRole((await getSessionUser())?.role);
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0];
  const speciesParam = searchParams.get("species");
  const species = speciesParam ? normalizeFeedingSpecies(speciesParam) : null;
  if (speciesParam && !species) {
    return NextResponse.json({ error: "Especie no válida" }, { status: 400 });
  }
  const locationId = searchParams.get("locationId");
  const batchId = searchParams.get("batchId");

  const conditions = [gte(transactions.date, from), lte(transactions.date, to)];
  if (species) conditions.push(eq(transactions.species, species));
  if (locationId) conditions.push(eq(transactions.locationId, locationId));
  if (batchId) conditions.push(eq(transactions.batchId, batchId));

  const [txs, feedMovRows, bioCtx, payrollSuppliesCtx] = await Promise.all([
    db.select().from(transactions).where(and(...conditions)).orderBy(transactions.date),
    db
      .select({
        species: feedMovements.species,
        locationId: feedMovements.locationId,
        quantity: feedMovements.quantity,
        unitCost: feedMovements.unitCost,
        fallbackCost: feedInventory.costPerUnit,
      })
      .from(feedMovements)
      .innerJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
      .where(and(eq(feedMovements.isEntry, false), gte(feedMovements.date, from), lte(feedMovements.date, to))),
    loadFarmBiologicalContext({
      speciesFilter: species,
      locationIdFilter: locationId || null,
      batchIdFilter: batchId || null,
      referenceDate: to,
    }),
    loadPeriodPayrollAndSupplies({
      from,
      to,
      speciesFilter: species,
      locationIdFilter: locationId || null,
    }),
  ]);

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();
  const familyMap = new Map<
    string,
    {
      family: string;
      treatment: string;
      isOpex: boolean;
      total: number;
      count: number;
      concepts: Map<string, { catalogId: string | null; concept: string; treatment: string; total: number; count: number }>;
    }
  >();
  const treatmentMap = new Map<string, { treatment: string; label: string; isOpex: boolean; total: number; count: number }>();

  for (const t of txs) {
    const amount = Number(t.amount);
    if (t.type === "ingreso") {
      incomeMap.set(t.category, (incomeMap.get(t.category) || 0) + amount);
    } else {
      expenseMap.set(t.category, (expenseMap.get(t.category) || 0) + amount);
      const resolved = resolveExpenseClassification({
        type: t.type,
        category: t.category,
        expenseCatalogId: t.expenseCatalogId,
        expenseFamily: t.expenseFamily,
        expenseConcept: t.expenseConcept,
        expenseTreatment: t.expenseTreatment,
        expenseDriver: t.expenseDriver,
        description: t.description,
        sourceType: t.sourceType,
      });
      const famKey = resolved.expenseFamily || t.category || "Sin clasificar";
      const treatment = resolved.expenseTreatment || "VARIABLE";
      const isOpex = resolved.isOpex;
      let famEntry = familyMap.get(famKey);
      if (!famEntry) {
        famEntry = {
          family: famKey,
          treatment,
          isOpex,
          total: 0,
          count: 0,
          concepts: new Map(),
        };
        familyMap.set(famKey, famEntry);
      }
      famEntry.total += amount;
      famEntry.count += 1;

      const conceptName = resolved.expenseConcept || t.category || "Concepto general";
      const conceptKey = `${resolved.expenseCatalogId || "MANUAL"}::${conceptName}`;
      const prevConcept = famEntry.concepts.get(conceptKey) || {
        catalogId: resolved.expenseCatalogId || null,
        concept: conceptName,
        treatment,
        total: 0,
        count: 0,
      };
      prevConcept.total += amount;
      prevConcept.count += 1;
      famEntry.concepts.set(conceptKey, prevConcept);

      const trLabel = TREATMENT_LABELS[treatment as ExpenseTreatmentType] || treatment;
      const trIsOpex = famKey === "Mano de obra (Nómina / jornales)" || OPEX_TREATMENTS.has(treatment as ExpenseTreatmentType);
      const trEntry = treatmentMap.get(treatment) || {
        treatment,
        label: trLabel,
        isOpex: trIsOpex,
        total: 0,
        count: 0,
      };
      trEntry.total += amount;
      trEntry.count += 1;
      treatmentMap.set(treatment, trEntry);
    }
  }

  const incomeCategories = Array.from(incomeMap.entries())
    .map(([category, total]) => ({ category, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const expenseCategories = Array.from(expenseMap.entries())
    .map(([category, total]) => ({ category, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const expensesByFamily = Array.from(familyMap.values())
    .map((f) => ({
      family: f.family,
      treatment: f.treatment,
      isOpex: f.isOpex,
      total: parseFloat(f.total.toFixed(2)),
      count: f.count,
      concepts: Array.from(f.concepts.values())
        .map((c) => ({ ...c, total: parseFloat(c.total.toFixed(2)) }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);

  const expensesByTreatment = Array.from(treatmentMap.values())
    .map((tr) => ({ ...tr, total: parseFloat(tr.total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const opexTotal = parseFloat(expensesByTreatment.filter((t) => t.isOpex).reduce((s, t) => s + t.total, 0).toFixed(2));
  const nonOpexTotal = parseFloat(expensesByTreatment.filter((t) => !t.isOpex).reduce((s, t) => s + t.total, 0).toFixed(2));

  const totalIncome = incomeCategories.reduce((s, c) => s + c.total, 0);
  const totalExpenses = expenseCategories.reduce((s, c) => s + c.total, 0);
  const netProfit = parseFloat((totalIncome - totalExpenses).toFixed(2));

  const filteredFeedMovs = feedMovRows.filter((fc) => {
    if (species && fc.species !== species) return false;
    if (locationId && fc.locationId !== locationId) return false;
    return true;
  });
  const accruedFeedCost = filteredFeedMovs.reduce(
    (s, fc) => s + Number(fc.quantity || 0) * Number(fc.unitCost ?? fc.fallbackCost ?? 0),
    0,
  );
  const assetsSummary = computeAssetsDepreciationSummary(bioCtx.assets, { fromDate: from, toDate: to });
  const warehouseSummary = computeFeedWarehouseValuation(bioCtx.feedRows);
  const supplyWarehouseSummary = computeSupplyWarehouseValuation(bioCtx.supplyRows);
  const biologicalSummary = evaluateBiologicalPortfolio({
    flocks: bioCtx.flocks,
    broilerBatches: bioCtx.batches,
    locations: bioCtx.locations,
    marketPrices: bioCtx.marketOverrides,
    referenceDate: to,
  });
  const threeLayer = computeThreeLayerFinancials({
    transactions: txs.map((t) => ({
      type: t.type,
      category: t.category,
      description: t.description,
      sourceType: t.sourceType,
      expenseCatalogId: t.expenseCatalogId,
      expenseFamily: t.expenseFamily,
      expenseTreatment: t.expenseTreatment,
      amount: t.amount,
      date: t.date,
    })),
    accruedFeedConsumedCostCop: accruedFeedCost,
    hasFeedConsumptionRecords: filteredFeedMovs.length > 0 && accruedFeedCost > 0,
    accruedSupplyConsumedCostCop: payrollSuppliesCtx.accruedSupplyCostCop,
    hasSupplyConsumptionRecords: payrollSuppliesCtx.hasSupplyConsumptionRecords,
    imputedOwnerLaborCop: payrollSuppliesCtx.imputedOwnerLaborCop,
    warehouseSupplyAssetCop: supplyWarehouseSummary.totalValueCop,
    assetsSummary,
    warehouseSummary,
    biologicalSummary,
  });
  const taxAndDeductions = payrollSuppliesCtx.summarizeTaxes(txs, threeLayer.cashOutflowsCop);
  const capexExcluded = txs
    .filter((t) => t.type === "egreso" && classifyTransactionNature(t) === "capex")
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  return NextResponse.json({
    from,
    to,
    filters: { species, locationId: locationId || null, batchId: batchId || null },
    income: {
      categories: incomeCategories,
      total: parseFloat(totalIncome.toFixed(2)),
    },
    expenses: {
      categories: expenseCategories,
      byFamily: expensesByFamily,
      byTreatment: expensesByTreatment,
      opexTotal,
      nonOpexTotal,
      total: parseFloat(totalExpenses.toFixed(2)),
    },
    netProfit,
    ...(!directivo ? {
      operatingContext: {
        ...threeLayer,
        taxAndDeductions,
        capexExcludedCop: parseFloat(capexExcluded.toFixed(2)),
        lifecycleMode: biologicalSummary.lifecycleMode,
        lifecycleLabel: biologicalSummary.lifecycleLabel,
        capexRecoveryPct: assetsSummary.capexRecoveryPct,
        alertsCount: biologicalSummary.alerts.length,
      },
    } : {}),
    transactionCount: txs.length,
  });
});
