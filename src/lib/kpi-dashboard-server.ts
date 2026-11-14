import { db } from "@/db";
import {
  appSettings,
  broilerBatches,
  eggProduction,
  eggSales,
  farmLocations,
  feedInventory,
  feedMovements,
  hens,
  mortalityRecords,
  roosters,
  slaughter,
  transactions,
  weightLogs,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { computeAnimalInventory } from "./animal-inventory";
import {
  BATCH_PRESENT_STATUSES,
  HEN_LAYING_STATUSES,
  HEN_PRESENT_STATUSES,
  ROOSTER_PRESENT_STATUSES,
  isBatchPresent,
  isHenPresent,
  isRoosterPresent,
} from "./animal-status";
import {
  classifyTransactionNature,
  computeThreeLayerFinancials,
} from "./analytics/biological-valuation";
import {
  computeAssetsDepreciationSummary,
  computeFeedWarehouseValuation,
  evaluateBiologicalPortfolio,
  loadFarmBiologicalContext,
} from "./analytics/biological-db";
import {
  buildPresetConfig,
  computeDeltaPct,
  normalizeKpiDashboardConfig,
  resolveRecommendedPreset,
  type KpiDashboardConfig,
  type KpiDashboardData,
  type KpiFinanceSummary,
  type KpiResolvedPresetId,
} from "./kpi-dashboard";
export type { KpiFinanceSummary } from "./kpi-dashboard";
import { loadSpeciesParams, speciesLabel, type SpeciesKey } from "./species-db";

export const KPI_CONFIG_KEY_PREFIX = "kpi.dashboard.layout.";
export const KPI_DEFAULT_CONFIG_KEY = "kpi.dashboard.layout.default";

export type KpiConfigSource = "user" | "farm_default" | "recommended";

export interface PreviousPeriodComparison {
  periodDays: number;
  startDate: string;
  endDate: string;
  mortalityRate: number;
  layingRate: number;
  layingHaaRate: number;
  costPerEgg: number;
  eggMargin: number;
  avgSalePricePerEgg: number;
  costPerKgMeat: number;
  netProfit: number;
  epef: number | null;
  uniformityPct: number | null;
  totalEggs: number;
  totalDeaths: number;
  deltas: {
    laying_rate: number | null;
    laying_haa: number | null;
    cost_per_egg: number | null;
    egg_margin: number | null;
    mortality_rate: number | null;
    net_profit: number | null;
    cost_per_kg_meat: number | null;
    epef: number | null;
    uniformity: number | null;
  };
}

export interface KpiFeedAutonomy {
  daysRemaining: number | null;
  currentStockKg: number;
  dailyConsumptionKg: number;
  source: "movements" | "estimated" | "no_data";
}

export interface KpiBenchmarks {
  layingTargetPct: number;
  mortalityMaxPct: number;
  fcrTarget: number;
  epefTarget: number;
  uniformityTargetPct: number;
  feedAutonomyMinDays: number;
  referenceEggPrice: number | null;
  referenceMeatPriceKg: number | null;
  breedLabel: string;
}

export interface KpiFarmContext {
  activeSpecies: Array<{ species: string; label: string; count: number }>;
  locations: Array<{ id: string; code: string; name: string; type: string; activeCount: number }>;
  activeBatches: Array<{
    id: string;
    code: string;
    species: string;
    speciesLabel: string;
    purpose: string;
    breed: string;
    currentQuantity: number;
    initialQuantity: number;
    locationId: string | null;
  }>;
  recommendedPreset: KpiResolvedPresetId;
}

export interface BatchScopedKpiOverride {
  species: SpeciesKey;
  locationId: string | null;
  mortality: {
    rate: number;
    totalDeaths: number;
    totalFlock: number;
    byCause: Array<{ cause: string; total: number }>;
  };
  laying: {
    rate: number;
    haaRate: number;
    totalEggs: number;
    eligibleEggs: number;
    eligibleAnimals: number;
    avgDaily: number;
    series: Array<{ date: string; total: number }>;
  };
  costPerUnit: {
    perEgg: number;
    perTray30: number;
    avgSalePricePerEgg: number;
    breakevenAlertEggs: boolean;
    perKgMeat: number;
    perLiveKgMeat: number;
    totalExpenses: number;
    proratedCostsInPeriod: number;
    eggFeedCost: number;
    meatEstimatedCost: number;
    saleableMeatKg: number;
    totalCarcassKg: number;
    totalLiveKg: number;
  };
  zootechnical: {
    cvPercent: number | null;
    uniformityPct: number | null;
    dailyGainG: number | null;
    epef: number | null;
    feedKgConsumed: number;
    slaughterWindowAlerts: Array<{
      id: string;
      code: string;
      species: string;
      currentQuantity: number;
      ageDays: number;
      targetDays: number;
      avgWeightKg: number | null;
      targetWeightKg: number;
    }>;
  };
  flock: {
    avgAgeWeeks: number;
    totalBirds: number;
    productiveRatio: number;
  };
  expenseByCategory: Array<{ category: string; total: number }>;
  peakProduction: {
    peakWeek: string | null;
    peakDate: string | null;
    peakRate: number;
    currentRate: number;
    declinePercent: number;
    avgDaily: number;
    totalEggs: number;
  };
}

export function isValidUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const base = new Date(`${isoDate}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().split("T")[0];
}

function unitToKg(quantity: number, unit: string | null | undefined): number {
  const norm = (unit || "kg").trim().toLowerCase();
  if (norm === "lb" || norm === "lbs") return quantity * 0.453592;
  if (norm === "g" || norm === "gr") return quantity / 1000;
  if (norm === "kg" || norm === "kilogramo" || norm === "kilogramos") return quantity;
  return 0;
}

export async function detectRecommendedPresetForFarm(farmId: string): Promise<{
  recommendedPreset: KpiResolvedPresetId;
  activeSpecies: string[];
}> {
  const [henCountRow, batchRows, eggSumRow, meatSumRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(hens)
      .where(and(eq(hens.farmId, farmId), inArray(hens.status, HEN_PRESENT_STATUSES as any))),
    db
      .select({
        species: broilerBatches.species,
        purpose: broilerBatches.purpose,
        count: sql<number>`count(*)`,
      })
      .from(broilerBatches)
      .where(
        and(
          eq(broilerBatches.farmId, farmId),
          inArray(broilerBatches.status, BATCH_PRESENT_STATUSES as any)
        )
      )
      .groupBy(broilerBatches.species, broilerBatches.purpose),
    db
      .select({ total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)` })
      .from(eggProduction)
      .where(eq(eggProduction.farmId, farmId)),
    db
      .select({ total: sql<number>`coalesce(sum(${slaughter.weightKg}), 0)` })
      .from(slaughter)
      .where(eq(slaughter.farmId, farmId)),
  ]);

  const activeSpeciesSet = new Set<string>();
  const activeHens = Number(henCountRow[0]?.count || 0);
  if (activeHens > 0) {
    activeSpeciesSet.add("gallina");
  }

  let hasBroilerBatches = false;
  let hasLayingBatches = false;
  for (const row of batchRows) {
    if (Number(row.count || 0) > 0 && row.species) {
      activeSpeciesSet.add(row.species);
      if (row.purpose === "postura_huevo") {
        hasLayingBatches = true;
      } else {
        hasBroilerBatches = true;
      }
    }
  }

  const activeSpecies = Array.from(activeSpeciesSet);
  const recommendedPreset = resolveRecommendedPreset({
    activeSpecies,
    totalEggs: Number(eggSumRow[0]?.total || 0),
    totalMeatKg: Number(meatSumRow[0]?.total || 0),
    hasLayingAnimals: activeHens > 0 || hasLayingBatches,
    hasBroilerBatches,
  });

  return { recommendedPreset, activeSpecies };
}

export async function readUserKpiDashboardConfig(params: {
  farmId: string;
  userId: string;
  recommendedPreset?: KpiResolvedPresetId;
}): Promise<{
  config: KpiDashboardConfig;
  source: KpiConfigSource;
  recommendedPreset: KpiResolvedPresetId;
}> {
  const recommendedPreset =
    params.recommendedPreset ??
    (await detectRecommendedPresetForFarm(params.farmId)).recommendedPreset;

  const userKey = `${KPI_CONFIG_KEY_PREFIX}${params.userId}`;
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(
      and(
        eq(appSettings.farmId, params.farmId),
        inArray(appSettings.key, [userKey, KPI_DEFAULT_CONFIG_KEY])
      )
    );

  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const userRaw = byKey.get(userKey);
  const defaultRaw = byKey.get(KPI_DEFAULT_CONFIG_KEY);

  const selectedRaw = userRaw ?? defaultRaw ?? null;
  const source: KpiConfigSource = userRaw
    ? "user"
    : defaultRaw
      ? "farm_default"
      : "recommended";

  if (!selectedRaw) {
    return {
      config: buildPresetConfig("auto", recommendedPreset),
      source,
      recommendedPreset,
    };
  }

  try {
    const parsed = JSON.parse(selectedRaw);
    return {
      config: normalizeKpiDashboardConfig(parsed, recommendedPreset),
      source,
      recommendedPreset,
    };
  } catch {
    return {
      config: buildPresetConfig("auto", recommendedPreset),
      source: "recommended",
      recommendedPreset,
    };
  }
}

export async function writeUserKpiDashboardConfig(params: {
  farmId: string;
  userId: string;
  role?: string | null;
  rawConfig: unknown;
  recommendedPreset?: KpiResolvedPresetId;
  seedFarmDefault?: boolean;
}): Promise<{
  config: KpiDashboardConfig;
  recommendedPreset: KpiResolvedPresetId;
  seededDefault: boolean;
}> {
  const recommendedPreset =
    params.recommendedPreset ??
    (await detectRecommendedPresetForFarm(params.farmId)).recommendedPreset;

  const normalized = normalizeKpiDashboardConfig(params.rawConfig, recommendedPreset);
  const serialized = JSON.stringify(normalized);
  const userKey = `${KPI_CONFIG_KEY_PREFIX}${params.userId}`;
  const now = new Date();

  await db
    .insert(appSettings)
    .values({
      farmId: params.farmId,
      key: userKey,
      value: serialized,
      updatedBy: params.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [appSettings.farmId, appSettings.key],
      set: {
        value: serialized,
        updatedBy: params.userId,
        updatedAt: now,
      },
    });

  let seededDefault = false;
  const canManageFarmDefault =
    params.role === "admin" || params.role === "propietario" || params.role === "superadmin";

  if (canManageFarmDefault) {
    const existingDefault = await db
      .select({ id: appSettings.id })
      .from(appSettings)
      .where(and(eq(appSettings.farmId, params.farmId), eq(appSettings.key, KPI_DEFAULT_CONFIG_KEY)))
      .limit(1);

    if (params.seedFarmDefault || existingDefault.length === 0) {
      await db
        .insert(appSettings)
        .values({
          farmId: params.farmId,
          key: KPI_DEFAULT_CONFIG_KEY,
          value: serialized,
          updatedBy: params.userId,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [appSettings.farmId, appSettings.key],
          set: {
            value: serialized,
            updatedBy: params.userId,
            updatedAt: now,
          },
        });
      seededDefault = true;
    }
  }

  return { config: normalized, recommendedPreset, seededDefault };
}

function buildTransactionFilters(params: {
  farmId: string;
  startDate: string;
  endDate: string;
  speciesFilter: SpeciesKey | null;
  locationIdFilter: string | null;
  batchIdFilter: string | null;
}): SQL {
  const conds: SQL[] = [
    eq(transactions.farmId, params.farmId),
    gte(transactions.date, params.startDate),
    lte(transactions.date, params.endDate),
  ];
  if (params.speciesFilter) conds.push(eq(transactions.species, params.speciesFilter));
  if (params.locationIdFilter) conds.push(eq(transactions.locationId, params.locationIdFilter));
  if (params.batchIdFilter) conds.push(eq(transactions.batchId, params.batchIdFilter));
  return and(...conds)!;
}

export async function computeFinanceSummary(params: {
  farmId: string;
  startDate: string;
  endDate: string;
  speciesFilter: SpeciesKey | null;
  locationIdFilter: string | null;
  batchIdFilter: string | null;
}): Promise<KpiFinanceSummary> {
  const feedConds: SQL[] = [
    eq(feedMovements.farmId, params.farmId),
    eq(feedMovements.isEntry, false),
    gte(feedMovements.date, params.startDate),
    lte(feedMovements.date, params.endDate),
  ];
  if (params.speciesFilter) feedConds.push(eq(feedMovements.species, params.speciesFilter));
  if (params.locationIdFilter) feedConds.push(eq(feedMovements.locationId, params.locationIdFilter));

  const [txRows, feedMovRows, bioCtx] = await Promise.all([
    db
      .select({
        type: transactions.type,
        category: transactions.category,
        description: transactions.description,
        sourceType: transactions.sourceType,
        amount: transactions.amount,
        date: transactions.date,
      })
      .from(transactions)
      .where(buildTransactionFilters(params)),
    db
      .select({
        quantity: feedMovements.quantity,
        unitCost: feedMovements.unitCost,
        fallbackCost: feedInventory.costPerUnit,
      })
      .from(feedMovements)
      .innerJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
      .where(and(...feedConds)),
    loadFarmBiologicalContext({
      farmId: params.farmId,
      speciesFilter: params.speciesFilter,
      locationIdFilter: params.locationIdFilter,
      batchIdFilter: params.batchIdFilter,
      referenceDate: params.endDate,
    }),
  ]);

  const accruedFeedConsumedCostCop = feedMovRows.reduce(
    (s, fc) => s + Number(fc.quantity || 0) * Number(fc.unitCost ?? fc.fallbackCost ?? 0),
    0,
  );
  const assetsSummary = computeAssetsDepreciationSummary(bioCtx.assets, {
    fromDate: params.startDate,
    toDate: params.endDate,
  });
  const warehouseSummary = computeFeedWarehouseValuation(bioCtx.feedRows);
  const biologicalSummary = evaluateBiologicalPortfolio({
    flocks: bioCtx.flocks,
    broilerBatches: bioCtx.batches,
    locations: bioCtx.locations,
    marketPrices: bioCtx.marketOverrides,
    referenceDate: params.endDate,
  });

  const threeLayer = computeThreeLayerFinancials({
    transactions: txRows,
    accruedFeedConsumedCostCop,
    hasFeedConsumptionRecords: feedMovRows.length > 0 && accruedFeedConsumedCostCop > 0,
    assetsSummary,
    warehouseSummary,
    biologicalSummary,
  });

  const capexExcluded = txRows
    .filter((t) => t.type === "egreso" && classifyTransactionNature(t) === "capex")
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const totalIncome = threeLayer.operatingIncomeCop;
  const totalExpenses = threeLayer.accruedOperatingExpenseCop;
  const netProfit = threeLayer.operatingNetProfitCop;
  const marginPct =
    totalIncome > 0 ? Number(((netProfit / totalIncome) * 100).toFixed(1)) : null;

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    marginPct,
    cashOutflows: threeLayer.cashOutflowsCop,
    cashNetFlow: threeLayer.cashNetFlowCop,
    capexExcluded: Number(capexExcluded.toFixed(2)),
    feedPurchasesExcluded: threeLayer.feedPurchaseCashOutflowCop,
    periodDepreciation: threeLayer.periodDepreciationCop,
    warehouseFeedAssetCop: threeLayer.warehouseFeedAssetCop,
    netEquipmentBookValueCop: threeLayer.netEquipmentBookValueCop,
    biologicalPortfolioValueCop: threeLayer.biologicalPortfolioValueCop,
    totalProductiveWealthCop: threeLayer.totalProductiveWealthCop,
    capexRecoveryPct: assetsSummary.capexRecoveryPct,
  };
}

export async function computeBatchScopedOverride(params: {
  farmId: string;
  batchId: string;
  days: number;
  startDate: string;
  endDate: string;
}): Promise<{ notFound: true } | { notFound: false; data: BatchScopedKpiOverride; batchBreed: string }> {
  const [batch] = await db
    .select()
    .from(broilerBatches)
    .where(and(eq(broilerBatches.farmId, params.farmId), eq(broilerBatches.id, params.batchId)))
    .limit(1);

  if (!batch) {
    return { notFound: true };
  }

  const batchSpecies = (batch.species || "pollo") as SpeciesKey;
  const periodCond = <T extends { date: any; farmId: any; batchId: any }>(tbl: T) =>
    and(
      eq(tbl.farmId, params.farmId),
      eq(tbl.batchId, params.batchId),
      gte(tbl.date, params.startDate),
      lte(tbl.date, params.endDate)
    )!;

  const [
    deathRows,
    eggRows,
    eggSalesRows,
    weightRows,
    slaughterRows,
    txByCatRows,
  ] = await Promise.all([
    db
      .select({
        cause: mortalityRecords.cause,
        total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int`,
      })
      .from(mortalityRecords)
      .where(periodCond(mortalityRecords))
      .groupBy(mortalityRecords.cause),
    db
      .select({
        date: eggProduction.date,
        total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int`,
      })
      .from(eggProduction)
      .where(periodCond(eggProduction))
      .groupBy(eggProduction.date)
      .orderBy(eggProduction.date),
    db
      .select({
        qty: sql<number>`coalesce(sum(${eggSales.quantity}), 0)::int`,
        amount: sql<string>`coalesce(sum(${eggSales.totalAmount}), 0)::text`,
      })
      .from(eggSales)
      .where(periodCond(eggSales)),
    db
      .select({
        cvPercent: weightLogs.cvPercent,
        uniformityPct: weightLogs.uniformityPct,
        dailyGainG: weightLogs.dailyGainG,
        avgWeightKg: weightLogs.avgWeightKg,
      })
      .from(weightLogs)
      .where(periodCond(weightLogs))
      .orderBy(desc(weightLogs.date)),
    db
      .select({
        carcassKg: sql<string>`coalesce(sum(${slaughter.weightKg}), 0)::text`,
        liveKg: sql<string>`coalesce(sum(${slaughter.liveWeightKg}), 0)::text`,
      })
      .from(slaughter)
      .where(periodCond(slaughter)),
    db
      .select({
        category: transactions.category,
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
      })
      .from(transactions)
      .where(
        and(
          buildTransactionFilters({
            farmId: params.farmId,
            startDate: params.startDate,
            endDate: params.endDate,
            speciesFilter: null,
            locationIdFilter: null,
            batchIdFilter: params.batchId,
          }),
          eq(transactions.type, "egreso")
        )
      )
      .groupBy(transactions.category),
  ]);

  const totalDeaths = deathRows.reduce((s, r) => s + Number(r.total || 0), 0);
  const currentQty = Math.max(0, Number(batch.currentQuantity || 0));
  const initialQty = Math.max(currentQty, Number(batch.initialQuantity || 0));
  const mortalityDenominator = Math.max(currentQty + totalDeaths, initialQty, 1);
  const mortalityRate = (totalDeaths / mortalityDenominator) * 100;

  const totalEggs = eggRows.reduce((s, r) => s + Number(r.total || 0), 0);
  const eligibleAnimals = batch.purpose === "postura_huevo" || batchSpecies === "codorniz" || batchSpecies === "gallina"
    ? currentQty
    : 0;
  const layingRate =
    eligibleAnimals > 0 ? (totalEggs / (eligibleAnimals * params.days)) * 100 : 0;
  const haaRate =
    initialQty > 0 && eligibleAnimals > 0
      ? (totalEggs / (initialQty * params.days)) * 100
      : layingRate;

  const soldEggQty = Number(eggSalesRows[0]?.qty || 0);
  const soldEggRev = Number(eggSalesRows[0]?.amount || 0);
  const avgSalePricePerEgg = soldEggQty > 0 ? soldEggRev / soldEggQty : 0;

  const expenseByCategory = txByCatRows.map((r) => ({
    category: r.category,
    total: Number(Number(r.total || 0).toFixed(2)),
  }));
  const totalExpenses = expenseByCategory.reduce((s, r) => s + r.total, 0);

  const perEgg = totalEggs > 0 ? totalExpenses / totalEggs : 0;
  const perTray30 = perEgg * 30;
  const breakevenAlertEggs =
    perEgg > 0 && avgSalePricePerEgg > 0 && avgSalePricePerEgg < perEgg;

  const totalCarcassKg = Number(slaughterRows[0]?.carcassKg || 0);
  const totalLiveKg = Number(slaughterRows[0]?.liveKg || 0);
  const perKgMeat = totalCarcassKg > 0 ? totalExpenses / totalCarcassKg : 0;
  const perLiveKgMeat = totalLiveKg > 0 ? totalExpenses / totalLiveKg : 0;

  const cvVals = weightRows
    .map((r) => (r.cvPercent !== null ? Number(r.cvPercent) : null))
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const unifVals = weightRows
    .map((r) => (r.uniformityPct !== null ? Number(r.uniformityPct) : null))
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const gainVals = weightRows
    .map((r) => (r.dailyGainG !== null ? Number(r.dailyGainG) : null))
    .filter((v): v is number => v !== null && Number.isFinite(v));

  const avgCvPercent = cvVals.length > 0 ? cvVals.reduce((a, b) => a + b, 0) / cvVals.length : null;
  const avgUniformityPct =
    unifVals.length > 0 ? unifVals.reduce((a, b) => a + b, 0) / unifVals.length : null;
  const avgDailyGainG = gainVals.length > 0 ? gainVals.reduce((a, b) => a + b, 0) / gainVals.length : null;

  const startMs = new Date(`${batch.startDate}T00:00:00Z`).getTime();
  const endMs = new Date(`${params.endDate}T00:00:00Z`).getTime();
  const ageDays = Math.max(1, Math.floor((endMs - startMs) / 86400000));
  const ageWeeks = Number((ageDays / 7).toFixed(1));
  const latestWeightKg = weightRows[0]?.avgWeightKg
    ? Number(weightRows[0].avgWeightKg)
    : batch.avgWeightKg
      ? Number(batch.avgWeightKg)
      : null;
  const fcrTarget = batch.feedConversionTarget ? Number(batch.feedConversionTarget) : 1.9;
  const viabilityPct = Math.max(0, 100 - mortalityRate);
  const epef =
    latestWeightKg && latestWeightKg > 0 && ageDays > 0 && fcrTarget > 0
      ? (viabilityPct * latestWeightKg * 100) / (ageDays * fcrTarget)
      : null;

  const targetDays = batch.targetDays ?? (batch.targetWeeks || 7) * 7;
  const targetWeightKg = Number(batch.targetWeightKg || 2.5);
  const slaughterWindowAlerts =
    isBatchPresent(batch.status, currentQty) && ageDays >= targetDays - 7
      ? [
        {
          id: batch.id,
          code: batch.code,
          species: batchSpecies,
          currentQuantity: currentQty,
          ageDays,
          targetDays,
          avgWeightKg: latestWeightKg,
          targetWeightKg,
        },
      ]
      : [];

  let peakDay: { date: string; total: number } | null = null;
  for (const row of eggRows) {
    if (!peakDay || row.total > peakDay.total) {
      peakDay = { date: row.date, total: row.total };
    }
  }
  const peakRate =
    peakDay && eligibleAnimals > 0 ? (peakDay.total / eligibleAnimals) * 100 : 0;
  const declinePercent =
    peakRate > 0 ? Math.max(0, ((peakRate - layingRate) / peakRate) * 100) : 0;

  return {
    notFound: false,
    batchBreed: batch.breed || speciesLabel(batchSpecies),
    data: {
      species: batchSpecies,
      locationId: batch.locationId ?? null,
      mortality: {
        rate: Number(mortalityRate.toFixed(2)),
        totalDeaths,
        totalFlock: currentQty,
        byCause: deathRows.map((r) => ({ cause: r.cause, total: Number(r.total || 0) })),
      },
      laying: {
        rate: Number(layingRate.toFixed(2)),
        haaRate: Number(haaRate.toFixed(2)),
        totalEggs,
        eligibleEggs: totalEggs,
        eligibleAnimals,
        avgDaily: Number((totalEggs / params.days).toFixed(1)),
        series: eggRows,
      },
      costPerUnit: {
        perEgg: Number(perEgg.toFixed(2)),
        perTray30: Number(perTray30.toFixed(2)),
        avgSalePricePerEgg: Number(avgSalePricePerEgg.toFixed(2)),
        breakevenAlertEggs,
        perKgMeat: Number(perKgMeat.toFixed(2)),
        perLiveKgMeat: Number(perLiveKgMeat.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        proratedCostsInPeriod: Number(totalExpenses.toFixed(2)),
        eggFeedCost: Number(totalExpenses.toFixed(2)),
        meatEstimatedCost: Number(totalExpenses.toFixed(2)),
        saleableMeatKg: Number(totalCarcassKg.toFixed(2)),
        totalCarcassKg: Number(totalCarcassKg.toFixed(2)),
        totalLiveKg: Number(totalLiveKg.toFixed(2)),
      },
      zootechnical: {
        cvPercent: avgCvPercent !== null ? Number(avgCvPercent.toFixed(2)) : null,
        uniformityPct: avgUniformityPct !== null ? Number(avgUniformityPct.toFixed(1)) : null,
        dailyGainG: avgDailyGainG !== null ? Number(avgDailyGainG.toFixed(1)) : null,
        epef: epef !== null ? Number(epef.toFixed(1)) : null,
        feedKgConsumed: 0,
        slaughterWindowAlerts,
      },
      flock: {
        avgAgeWeeks: ageWeeks,
        totalBirds: currentQty,
        productiveRatio: Number((eligibleAnimals > 0 ? 100 : 0).toFixed(2)),
      },
      expenseByCategory,
      peakProduction: {
        peakWeek: peakDay?.date || null,
        peakDate: peakDay?.date || null,
        peakRate: Number(peakRate.toFixed(2)),
        currentRate: Number(layingRate.toFixed(2)),
        declinePercent: Number(declinePercent.toFixed(2)),
        avgDaily: peakDay ? Number(peakDay.total.toFixed(1)) : 0,
        totalEggs: peakDay?.total || 0,
      },
    },
  };
}

export async function computeFeedAutonomy(params: {
  farmId: string;
  days: number;
  startDate: string;
  endDate: string;
  speciesFilter: SpeciesKey | null;
  locationIdFilter: string | null;
  activeSpeciesCounts: Map<string, number>;
}): Promise<KpiFeedAutonomy> {
  const movConds: SQL[] = [
    eq(feedMovements.farmId, params.farmId),
    eq(feedMovements.isEntry, false),
    gte(feedMovements.date, params.startDate),
    lte(feedMovements.date, params.endDate),
  ];
  if (params.speciesFilter) movConds.push(eq(feedMovements.species, params.speciesFilter));
  if (params.locationIdFilter) movConds.push(eq(feedMovements.locationId, params.locationIdFilter));

  const [invRows, movRows, speciesParams] = await Promise.all([
    db
      .select({
        unit: feedInventory.unit,
        currentStock: feedInventory.currentStock,
      })
      .from(feedInventory)
      .where(eq(feedInventory.farmId, params.farmId)),
    db
      .select({
        totalKg: sql<string>`coalesce(sum(${feedMovements.quantity}), 0)::text`,
      })
      .from(feedMovements)
      .where(and(...movConds)),
    loadSpeciesParams(),
  ]);

  const currentStockKg = invRows.reduce(
    (sum, r) => sum + unitToKg(Number(r.currentStock || 0), r.unit),
    0
  );
  const consumedPeriodKg = Number(movRows[0]?.totalKg || 0);

  if (consumedPeriodKg > 0 && params.days > 0) {
    const dailyConsumptionKg = consumedPeriodKg / params.days;
    return {
      daysRemaining:
        dailyConsumptionKg > 0 ? Number((currentStockKg / dailyConsumptionKg).toFixed(1)) : null,
      currentStockKg: Number(currentStockKg.toFixed(1)),
      dailyConsumptionKg: Number(dailyConsumptionKg.toFixed(2)),
      source: "movements",
    };
  }

  // Fallback estimate using active herd population and reference daily ration per species.
  const dailyGramsBySpecies = new Map<string, number>();
  for (const sp of speciesParams) {
    if (!dailyGramsBySpecies.has(sp.species)) {
      dailyGramsBySpecies.set(sp.species, sp.dailyFeedGPerHead);
    }
  }

  let estDailyKg = 0;
  for (const [sp, count] of params.activeSpeciesCounts.entries()) {
    if (params.speciesFilter && sp !== params.speciesFilter) continue;
    const gPerHead = dailyGramsBySpecies.get(sp) ?? 110;
    estDailyKg += (count * gPerHead) / 1000;
  }

  if (estDailyKg > 0) {
    return {
      daysRemaining: Number((currentStockKg / estDailyKg).toFixed(1)),
      currentStockKg: Number(currentStockKg.toFixed(1)),
      dailyConsumptionKg: Number(estDailyKg.toFixed(2)),
      source: "estimated",
    };
  }

  return {
    daysRemaining: null,
    currentStockKg: Number(currentStockKg.toFixed(1)),
    dailyConsumptionKg: 0,
    source: "no_data",
  };
}

export async function computePreviousPeriodComparison(params: {
  farmId: string;
  days: number;
  currentCutoffStr: string;
  speciesFilter: SpeciesKey | null;
  locationIdFilter: string | null;
  batchIdFilter: string | null;
  currentValues: {
    mortalityRate: number;
    layingRate: number;
    layingHaaRate: number;
    costPerEgg: number;
    eggMargin: number;
    costPerKgMeat: number;
    netProfit: number;
    epef: number | null;
    uniformityPct: number | null;
    totalFlock: number;
    eligibleAnimals: number;
  };
}): Promise<PreviousPeriodComparison> {
  const endDate = shiftIsoDate(params.currentCutoffStr, -1);
  const startDate = shiftIsoDate(endDate, -params.days);

  const eggProdConds: SQL[] = [
    eq(eggProduction.farmId, params.farmId),
    gte(eggProduction.date, startDate),
    lte(eggProduction.date, endDate),
  ];
  const mortConds: SQL[] = [
    eq(mortalityRecords.farmId, params.farmId),
    gte(mortalityRecords.date, startDate),
    lte(mortalityRecords.date, endDate),
  ];
  const eggSaleConds: SQL[] = [
    eq(eggSales.farmId, params.farmId),
    gte(eggSales.date, startDate),
    lte(eggSales.date, endDate),
  ];
  const slaughterConds: SQL[] = [
    eq(slaughter.farmId, params.farmId),
    gte(slaughter.date, startDate),
    lte(slaughter.date, endDate),
  ];
  const weightConds: SQL[] = [
    eq(weightLogs.farmId, params.farmId),
    gte(weightLogs.date, startDate),
    lte(weightLogs.date, endDate),
  ];

  if (params.speciesFilter) {
    eggProdConds.push(eq(eggProduction.species, params.speciesFilter));
    mortConds.push(eq(mortalityRecords.species, params.speciesFilter));
    eggSaleConds.push(eq(eggSales.species, params.speciesFilter));
    slaughterConds.push(eq(slaughter.species, params.speciesFilter));
    weightConds.push(eq(weightLogs.species, params.speciesFilter));
  }
  if (params.locationIdFilter) {
    eggProdConds.push(eq(eggProduction.locationId, params.locationIdFilter));
    mortConds.push(eq(mortalityRecords.locationId, params.locationIdFilter));
    eggSaleConds.push(eq(eggSales.locationId, params.locationIdFilter));
    slaughterConds.push(eq(slaughter.locationId, params.locationIdFilter));
    weightConds.push(eq(weightLogs.locationId, params.locationIdFilter));
  }
  if (params.batchIdFilter) {
    eggProdConds.push(eq(eggProduction.batchId, params.batchIdFilter));
    mortConds.push(eq(mortalityRecords.batchId, params.batchIdFilter));
    eggSaleConds.push(eq(eggSales.batchId, params.batchIdFilter));
    slaughterConds.push(eq(slaughter.batchId, params.batchIdFilter));
    weightConds.push(eq(weightLogs.batchId, params.batchIdFilter));
  }

  const [eggRow, deathRow, eggSalesRow, slaughterRow, weightRows, finance] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int` })
      .from(eggProduction)
      .where(and(...eggProdConds)),
    db
      .select({ total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int` })
      .from(mortalityRecords)
      .where(and(...mortConds)),
    db
      .select({
        qty: sql<number>`coalesce(sum(${eggSales.quantity}), 0)::int`,
        amount: sql<string>`coalesce(sum(${eggSales.totalAmount}), 0)::text`,
      })
      .from(eggSales)
      .where(and(...eggSaleConds)),
    db
      .select({
        carcassKg: sql<string>`coalesce(sum(${slaughter.weightKg}), 0)::text`,
      })
      .from(slaughter)
      .where(and(...slaughterConds)),
    db
      .select({ uniformityPct: weightLogs.uniformityPct })
      .from(weightLogs)
      .where(and(...weightConds)),
    computeFinanceSummary({
      farmId: params.farmId,
      startDate,
      endDate,
      speciesFilter: params.speciesFilter,
      locationIdFilter: params.locationIdFilter,
      batchIdFilter: params.batchIdFilter,
    }),
  ]);

  const totalEggs = Number(eggRow[0]?.total || 0);
  const totalDeaths = Number(deathRow[0]?.total || 0);
  const denomFlock = Math.max(params.currentValues.totalFlock + totalDeaths, 1);
  const mortalityRate =
    params.currentValues.totalFlock > 0 || totalDeaths > 0
      ? Number(((totalDeaths / denomFlock) * 100).toFixed(2))
      : 0;

  const eligibleAnimals = params.currentValues.eligibleAnimals;
  const layingRate =
    eligibleAnimals > 0 && params.days > 0
      ? Number(((totalEggs / (eligibleAnimals * params.days)) * 100).toFixed(2))
      : 0;
  const layingHaaRate = layingRate;

  const soldEggQty = Number(eggSalesRow[0]?.qty || 0);
  const soldEggAmount = Number(eggSalesRow[0]?.amount || 0);
  const avgSalePricePerEgg =
    soldEggQty > 0 ? Number((soldEggAmount / soldEggQty).toFixed(2)) : 0;

  const costPerEgg =
    totalEggs > 0 ? Number((finance.totalExpenses / totalEggs).toFixed(2)) : 0;
  const eggMargin =
    avgSalePricePerEgg > 0 && costPerEgg > 0
      ? Number((avgSalePricePerEgg - costPerEgg).toFixed(2))
      : 0;

  const prevCarcassKg = Number(slaughterRow[0]?.carcassKg || 0);
  const costPerKgMeat =
    prevCarcassKg > 0 ? Number((finance.totalExpenses / prevCarcassKg).toFixed(2)) : 0;

  const unifVals = weightRows
    .map((r) => (r.uniformityPct !== null ? Number(r.uniformityPct) : null))
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const uniformityPct =
    unifVals.length > 0
      ? Number((unifVals.reduce((a, b) => a + b, 0) / unifVals.length).toFixed(1))
      : null;

  return {
    periodDays: params.days,
    startDate,
    endDate,
    mortalityRate,
    layingRate,
    layingHaaRate,
    costPerEgg,
    eggMargin,
    avgSalePricePerEgg,
    costPerKgMeat,
    netProfit: finance.netProfit,
    epef: null,
    uniformityPct,
    totalEggs,
    totalDeaths,
    deltas: {
      laying_rate:
        totalEggs > 0 || layingRate > 0
          ? computeDeltaPct(params.currentValues.layingRate, layingRate)
          : null,
      laying_haa:
        totalEggs > 0 || layingHaaRate > 0
          ? computeDeltaPct(params.currentValues.layingHaaRate, layingHaaRate)
          : null,
      cost_per_egg:
        costPerEgg > 0 ? computeDeltaPct(params.currentValues.costPerEgg, costPerEgg) : null,
      egg_margin:
        eggMargin !== 0 ? computeDeltaPct(params.currentValues.eggMargin, eggMargin) : null,
      mortality_rate:
        totalDeaths > 0
          ? computeDeltaPct(params.currentValues.mortalityRate, mortalityRate)
          : null,
      net_profit:
        finance.netProfit !== 0
          ? computeDeltaPct(params.currentValues.netProfit, finance.netProfit)
          : null,
      cost_per_kg_meat:
        costPerKgMeat > 0
          ? computeDeltaPct(params.currentValues.costPerKgMeat, costPerKgMeat)
          : null,
      epef: null,
      uniformity:
        uniformityPct !== null
          ? computeDeltaPct(params.currentValues.uniformityPct, uniformityPct)
          : null,
    },
  };
}

export async function buildKpiEnrichment(params: {
  farmId: string;
  userId: string;
  days: number;
  startDate: string;
  endDate: string;
  speciesFilter: SpeciesKey | null;
  locationIdFilter: string | null;
  batchIdFilter: string | null;
  currentSnapshot: {
    mortalityRate: number;
    layingRate: number;
    layingHaaRate: number;
    costPerEgg: number;
    avgSalePricePerEgg: number;
    costPerKgMeat: number;
    totalEggs: number;
    saleableMeatKg: number;
    totalCarcassKg: number;
    epef: number | null;
    uniformityPct: number | null;
    totalFlock: number;
    eligibleAnimals: number;
  };
}): Promise<{
  notFound?: boolean;
  batchOverride?: BatchScopedKpiOverride;
  previousPeriod: PreviousPeriodComparison;
  finance: KpiFinanceSummary;
  feedAutonomy: KpiFeedAutonomy;
  benchmarks: KpiBenchmarks;
  farmContext: KpiFarmContext;
  customConfig: {
    config: KpiDashboardConfig;
    source: KpiConfigSource;
    recommendedPreset: KpiResolvedPresetId;
  };
  biologicalContext?: KpiDashboardData["biologicalContext"];
}> {
  let effectiveSpecies = params.speciesFilter;
  let effectiveLocationId = params.locationIdFilter;
  let batchOverride: BatchScopedKpiOverride | undefined;
  let batchBreed: string | null = null;

  if (params.batchIdFilter) {
    const scoped = await computeBatchScopedOverride({
      farmId: params.farmId,
      batchId: params.batchIdFilter,
      days: params.days,
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (scoped.notFound) {
      return { notFound: true } as any;
    }
    batchOverride = scoped.data;
    batchBreed = scoped.batchBreed;
    effectiveSpecies = scoped.data.species;
    if (!effectiveLocationId) {
      effectiveLocationId = scoped.data.locationId;
    }
  }

  const effectiveMortalityRate = batchOverride
    ? batchOverride.mortality.rate
    : params.currentSnapshot.mortalityRate;
  const effectiveLayingRate = batchOverride
    ? batchOverride.laying.rate
    : params.currentSnapshot.layingRate;
  const effectiveLayingHaa = batchOverride
    ? batchOverride.laying.haaRate
    : params.currentSnapshot.layingHaaRate;
  const effectiveCostPerEgg = batchOverride
    ? batchOverride.costPerUnit.perEgg
    : params.currentSnapshot.costPerEgg;
  const effectiveSalePricePerEgg = batchOverride
    ? batchOverride.costPerUnit.avgSalePricePerEgg
    : params.currentSnapshot.avgSalePricePerEgg;
  const effectiveCostPerKgMeat = batchOverride
    ? batchOverride.costPerUnit.perKgMeat
    : params.currentSnapshot.costPerKgMeat;
  const effectiveTotalEggs = batchOverride
    ? batchOverride.laying.totalEggs
    : params.currentSnapshot.totalEggs;
  const effectiveMeatKg = batchOverride
    ? batchOverride.costPerUnit.totalCarcassKg
    : params.currentSnapshot.saleableMeatKg || params.currentSnapshot.totalCarcassKg;
  const effectiveEpef = batchOverride
    ? batchOverride.zootechnical.epef
    : params.currentSnapshot.epef;
  const effectiveUniformity = batchOverride
    ? batchOverride.zootechnical.uniformityPct
    : params.currentSnapshot.uniformityPct;
  const effectiveFlock = batchOverride
    ? batchOverride.flock.totalBirds
    : params.currentSnapshot.totalFlock;
  const effectiveEligible = batchOverride
    ? batchOverride.laying.eligibleAnimals
    : params.currentSnapshot.eligibleAnimals;

  const [
    finance,
    animalInventory,
    locationRows,
    henLocRows,
    roosterLocRows,
    batchRows,
    speciesParamsList,
  ] = await Promise.all([
    computeFinanceSummary({
      farmId: params.farmId,
      startDate: params.startDate,
      endDate: params.endDate,
      speciesFilter: effectiveSpecies,
      locationIdFilter: effectiveLocationId,
      batchIdFilter: params.batchIdFilter,
    }),
    computeAnimalInventory(),
    db
      .select({
        id: farmLocations.id,
        code: farmLocations.code,
        name: farmLocations.name,
        type: farmLocations.type,
      })
      .from(farmLocations)
      .where(and(eq(farmLocations.farmId, params.farmId), eq(farmLocations.status, "activa"))),
    db
      .select({ locationId: hens.locationId, status: hens.status })
      .from(hens)
      .where(eq(hens.farmId, params.farmId)),
    db
      .select({ locationId: roosters.locationId, status: roosters.status })
      .from(roosters)
      .where(eq(roosters.farmId, params.farmId)),
    db
      .select({
        id: broilerBatches.id,
        code: broilerBatches.code,
        species: broilerBatches.species,
        purpose: broilerBatches.purpose,
        breed: broilerBatches.breed,
        currentQuantity: broilerBatches.currentQuantity,
        initialQuantity: broilerBatches.initialQuantity,
        status: broilerBatches.status,
        locationId: broilerBatches.locationId,
      })
      .from(broilerBatches)
      .where(eq(broilerBatches.farmId, params.farmId)),
    loadSpeciesParams(effectiveSpecies || undefined),
  ]);

  const locCounts = new Map<string, number>();
  const incLoc = (locId: string | null, delta: number) => {
    if (!locId) return;
    locCounts.set(locId, (locCounts.get(locId) || 0) + delta);
  };
  for (const h of henLocRows) {
    if (isHenPresent(h.status)) incLoc(h.locationId, 1);
  }
  for (const r of roosterLocRows) {
    if (isRoosterPresent(r.status)) incLoc(r.locationId, 1);
  }
  const activeBatchesList: KpiFarmContext["activeBatches"] = [];
  for (const b of batchRows) {
    if (isBatchPresent(b.status, b.currentQuantity)) {
      incLoc(b.locationId, Number(b.currentQuantity || 0));
      activeBatchesList.push({
        id: b.id,
        code: b.code,
        species: b.species,
        speciesLabel: speciesLabel(b.species),
        purpose: b.purpose,
        breed: b.breed,
        currentQuantity: Number(b.currentQuantity || 0),
        initialQuantity: Number(b.initialQuantity || 0),
        locationId: b.locationId ?? null,
      });
    }
  }

  const activeSpeciesCounts = new Map<string, number>();
  const activeSpeciesList: KpiFarmContext["activeSpecies"] = [];
  for (const sp of animalInventory.species) {
    if (sp.count > 0) {
      activeSpeciesCounts.set(sp.species, sp.count);
      activeSpeciesList.push({
        species: sp.species,
        label: sp.label,
        count: sp.count,
      });
    }
  }

  const hasLayingHensInFarm = henLocRows.some((h) => HEN_LAYING_STATUSES.includes(h.status));
  const hasBroilerInFarm = activeBatchesList.some((b) => b.purpose !== "postura_huevo");

  const recommendedPreset = resolveRecommendedPreset({
    activeSpecies: effectiveSpecies
      ? [effectiveSpecies]
      : activeSpeciesList.map((s) => s.species),
    totalEggs: effectiveTotalEggs,
    totalMeatKg: effectiveMeatKg,
    hasLayingAnimals:
      effectiveSpecies === "gallina" || (!effectiveSpecies && hasLayingHensInFarm),
    hasBroilerBatches: effectiveSpecies
      ? ["pollo", "pato", "conejo", "cuy"].includes(effectiveSpecies)
      : hasBroilerInFarm,
  });

  const currentEggMargin =
    effectiveSalePricePerEgg > 0 && effectiveCostPerEgg > 0
      ? Number((effectiveSalePricePerEgg - effectiveCostPerEgg).toFixed(2))
      : 0;

  const [previousPeriod, feedAutonomy, customConfig, bioCtx] = await Promise.all([
    computePreviousPeriodComparison({
      farmId: params.farmId,
      days: params.days,
      currentCutoffStr: params.startDate,
      speciesFilter: effectiveSpecies,
      locationIdFilter: effectiveLocationId,
      batchIdFilter: params.batchIdFilter,
      currentValues: {
        mortalityRate: effectiveMortalityRate,
        layingRate: effectiveLayingRate,
        layingHaaRate: effectiveLayingHaa,
        costPerEgg: effectiveCostPerEgg,
        eggMargin: currentEggMargin,
        costPerKgMeat: effectiveCostPerKgMeat,
        netProfit: finance.netProfit,
        epef: effectiveEpef,
        uniformityPct: effectiveUniformity,
        totalFlock: effectiveFlock,
        eligibleAnimals: effectiveEligible,
      },
    }),
    computeFeedAutonomy({
      farmId: params.farmId,
      days: params.days,
      startDate: params.startDate,
      endDate: params.endDate,
      speciesFilter: effectiveSpecies,
      locationIdFilter: effectiveLocationId,
      activeSpeciesCounts,
    }),
    readUserKpiDashboardConfig({
      farmId: params.farmId,
      userId: params.userId,
      recommendedPreset,
    }),
    loadFarmBiologicalContext({
      farmId: params.farmId,
      speciesFilter: effectiveSpecies,
      locationIdFilter: effectiveLocationId,
      batchIdFilter: params.batchIdFilter,
      referenceDate: params.endDate,
    }),
  ]);

  const assetsSummary = computeAssetsDepreciationSummary(bioCtx.assets, {
    fromDate: params.startDate,
    toDate: params.endDate,
  });
  const warehouseSummary = computeFeedWarehouseValuation(bioCtx.feedRows);
  const biologicalPortfolio = evaluateBiologicalPortfolio({
    flocks: bioCtx.flocks,
    broilerBatches: bioCtx.batches,
    locations: bioCtx.locations,
    marketPrices: bioCtx.marketOverrides,
    referenceDate: params.endDate,
  });

  const biologicalContext = {
    lifecycleMode: biologicalPortfolio.lifecycleMode,
    lifecycleLabel: biologicalPortfolio.lifecycleLabel,
    lifecycleDescription: biologicalPortfolio.lifecycleDescription,
    totalAliveAnimals: biologicalPortfolio.totalAliveAnimals,
    totalBiologicalValueCop: biologicalPortfolio.totalBiologicalValueCop,
    unrealizedBiologicalGainCop: biologicalPortfolio.unrealizedBiologicalGainCop,
    projectedHarvestValueCop: biologicalPortfolio.projectedHarvestValueCop,
    capexRecoveryPct: assetsSummary.capexRecoveryPct,
    warehouseFeedAssetCop: warehouseSummary.totalValueCop,
    netEquipmentBookValueCop: assetsSummary.netBookValueCop,
    totalProductiveWealthCop: Number(
      (
        warehouseSummary.totalValueCop +
        assetsSummary.netBookValueCop +
        biologicalPortfolio.totalBiologicalValueCop
      ).toFixed(2),
    ),
    alerts: biologicalPortfolio.alerts,
  };

  const primaryParam = speciesParamsList[0];
  const benchmarks: KpiBenchmarks = {
    layingTargetPct:
      primaryParam?.eggsPerDayPerFemale && primaryParam.eggsPerDayPerFemale > 0
        ? Number((primaryParam.eggsPerDayPerFemale * 100).toFixed(1))
        : 82,
    mortalityMaxPct: 1.5,
    fcrTarget: primaryParam?.feedConversionRatio ?? 1.9,
    epefTarget: 300,
    uniformityTargetPct: 80,
    feedAutonomyMinDays: 10,
    referenceEggPrice: primaryParam?.marketPriceEggUnitCOP ?? null,
    referenceMeatPriceKg: primaryParam?.marketPriceKgCanalCOP ?? null,
    breedLabel:
      batchBreed ||
      primaryParam?.breed ||
      (effectiveSpecies ? speciesLabel(effectiveSpecies) : "Referencia mixta de granja"),
  };

  const farmContext: KpiFarmContext = {
    activeSpecies: activeSpeciesList,
    locations: locationRows.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      type: l.type,
      activeCount: locCounts.get(l.id) || 0,
    })),
    activeBatches: activeBatchesList,
    recommendedPreset,
  };

  return {
    batchOverride,
    previousPeriod,
    finance,
    feedAutonomy,
    benchmarks,
    farmContext,
    customConfig,
    biologicalContext,
  };
}
