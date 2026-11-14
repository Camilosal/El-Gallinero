import { db } from "@/db";
import { feedInventory, feedMovements, transactions } from "@/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { normalizeFeedingSpecies } from "@/lib/species";
import {
  classifyTransactionNature,
  computeThreeLayerFinancials,
} from "@/lib/analytics/biological-valuation";
import {
  computeAssetsDepreciationSummary,
  computeFeedWarehouseValuation,
  evaluateBiologicalPortfolio,
  loadFarmBiologicalContext,
} from "@/lib/analytics/biological-db";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
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

  const [txs, feedMovRows, bioCtx] = await Promise.all([
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
  ]);

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const t of txs) {
    const amount = Number(t.amount);
    if (t.type === "ingreso") {
      incomeMap.set(t.category, (incomeMap.get(t.category) || 0) + amount);
    } else {
      expenseMap.set(t.category, (expenseMap.get(t.category) || 0) + amount);
    }
  }

  const incomeCategories = Array.from(incomeMap.entries())
    .map(([category, total]) => ({ category, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const expenseCategories = Array.from(expenseMap.entries())
    .map(([category, total]) => ({ category, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

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
      amount: t.amount,
      date: t.date,
    })),
    accruedFeedConsumedCostCop: accruedFeedCost,
    hasFeedConsumptionRecords: filteredFeedMovs.length > 0 && accruedFeedCost > 0,
    assetsSummary,
    warehouseSummary,
    biologicalSummary,
  });
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
      total: parseFloat(totalExpenses.toFixed(2)),
    },
    netProfit,
    operatingContext: {
      ...threeLayer,
      capexExcludedCop: parseFloat(capexExcluded.toFixed(2)),
      lifecycleMode: biologicalSummary.lifecycleMode,
      lifecycleLabel: biologicalSummary.lifecycleLabel,
      capexRecoveryPct: assetsSummary.capexRecoveryPct,
      alertsCount: biologicalSummary.alerts.length,
    },
    transactionCount: txs.length,
  });
});
