import { db } from "@/db";
import {
  mortalityRecords,
  hens,
  roosters,
  eggProduction,
  eggSales,
  transactions,
  broilerBatches,
  slaughter,
  birdAcquisitions,
  catalogos,
  weightLogs,
  feedMovements,
  feedInventory,
  farmAssets,
  costAllocations,
} from "@/db/schema";
import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { computeAnimalInventory } from "@/lib/animal-inventory";
import { isHenPresent, isRoosterPresent } from "@/lib/animal-status";
import { loadSpeciesParams, type SpeciesDbParams } from "@/lib/species-db";
import { isAnimalSpecies, normalizeFeedingSpecies } from "@/lib/species";

export const dynamic = "force-dynamic";

function dateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysBetween(start: string, end: string): number {
  const startMs = new Date(`${start}T12:00:00`).getTime();
  const endMs = new Date(`${end}T12:00:00`).getTime();
  return Math.max(0, Math.floor((endMs - startMs) / 86400000));
}

function weekStart(date: string): string {
  const monday = new Date(`${date}T12:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dateString(monday);
}

function paramsForSpecies(params: SpeciesDbParams[], species: string, breed?: string | null): SpeciesDbParams | undefined {
  const normalizedBreed = String(breed || "").toLowerCase();
  return params.find((item) => item.species === species && normalizedBreed && item.breed.toLowerCase().includes(normalizedBreed))
    || params.find((item) => item.species === species);
}

function saleableWeightKg(record: typeof slaughter.$inferSelect): number {
  const total = Math.max(0, Number(record.weightKg) || 0);
  const autoconsumo = Math.max(0, Number(record.weightKgAutoconsumo) || 0);
  const excedente = Math.max(0, Number(record.weightKgExcedente) || 0);
  if (record.destination === "venta") return Math.min(total, excedente || total);
  if (record.destination === "mixto") return Math.min(total, excedente || Math.max(0, total - autoconsumo));
  return 0;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const days = Math.max(1, Math.min(3650, parseInt(searchParams.get("period") || "30", 10) || 30));
  const speciesParam = searchParams.get("species");
  const speciesFilter = speciesParam ? normalizeFeedingSpecies(speciesParam) : null;
  if (speciesParam && !speciesFilter) {
    return NextResponse.json({ error: "Especie no válida" }, { status: 400 });
  }
  const locationIdFilter = searchParams.get("locationId") || null;

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const ninetyDays = new Date(today);
  ninetyDays.setDate(ninetyDays.getDate() - 90);
  const sevenDays = new Date(today);
  sevenDays.setDate(sevenDays.getDate() - 7);

  const todayStr = dateString(today);
  const cutoffStr = dateString(cutoff);
  const ninetyDaysStr = dateString(ninetyDays);
  const sevenDaysStr = dateString(sevenDays);
  const periodFilter = (column: any) => and(gte(column, cutoffStr), lte(column, todayStr));

  const mortConds = [periodFilter(mortalityRecords.date)];
  if (speciesFilter && isAnimalSpecies(speciesFilter)) {
    mortConds.push(eq(mortalityRecords.species, speciesFilter));
  }
  if (locationIdFilter) mortConds.push(eq(mortalityRecords.locationId, locationIdFilter));

  const txExpConds = [eq(transactions.type, "egreso"), periodFilter(transactions.date)];
  if (speciesFilter) txExpConds.push(eq(transactions.species, speciesFilter));
  if (locationIdFilter) txExpConds.push(eq(transactions.locationId, locationIdFilter));

  const eggPeriodConds = [periodFilter(eggProduction.date)];
  if (speciesFilter && ["gallina", "codorniz", "pato"].includes(speciesFilter)) {
    eggPeriodConds.push(eq(eggProduction.species, speciesFilter as typeof eggProduction.$inferSelect.species));
  }
  if (locationIdFilter) eggPeriodConds.push(eq(eggProduction.locationId, locationIdFilter));

  const [
    deathRows,
    byCause,
    stageRows,
    periodEggRows,
    ninetyDayEggRows,
    expenseRows,
    expenseByCategory,
    currentHens,
    currentRoosters,
    allBatches,
    periodSlaughter,
    animalInventory,
    speciesParams,
    recentWeightLogs,
    periodFeedMovements,
    periodEggSalesRows,
    allTxInPeriod,
    allocationsInPeriod,
    activeAssets,
  ] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int` })
      .from(mortalityRecords).where(and(...mortConds)),
    db.select({
      cause: mortalityRecords.cause,
      total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int`,
    }).from(mortalityRecords).where(and(...mortConds)).groupBy(mortalityRecords.cause),
    db.select({ minWeeks: catalogos.minWeeks, expectedEggsPerHen: catalogos.expectedEggsPerHen })
      .from(catalogos)
      .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true))),
    db.select().from(eggProduction).where(and(...eggPeriodConds)),
    db.select().from(eggProduction).where(and(gte(eggProduction.date, ninetyDaysStr), lte(eggProduction.date, todayStr))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text` })
      .from(transactions).where(and(...txExpConds)),
    db.select({
      category: transactions.category,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
    }).from(transactions)
      .where(and(...txExpConds))
      .groupBy(transactions.category)
      .orderBy(sql`sum(${transactions.amount}) desc`),
    db.select({
      id: hens.id,
      birthDate: hens.birthDate,
      status: hens.status,
      breed: hens.breed,
      locationId: hens.locationId,
      acquisitionCost: hens.acquisitionCost,
      acquisitionUnitCost: birdAcquisitions.unitCost,
    }).from(hens).leftJoin(birdAcquisitions, eq(hens.acquisitionId, birdAcquisitions.id)),
    db.select({
      id: roosters.id,
      birthDate: roosters.birthDate,
      status: roosters.status,
      breed: roosters.breed,
      locationId: roosters.locationId,
      acquisitionCost: roosters.acquisitionCost,
      acquisitionUnitCost: birdAcquisitions.unitCost,
    }).from(roosters).leftJoin(birdAcquisitions, eq(roosters.acquisitionId, birdAcquisitions.id)),
    db.select({
      id: broilerBatches.id,
      code: broilerBatches.code,
      species: broilerBatches.species,
      purpose: broilerBatches.purpose,
      status: broilerBatches.status,
      currentQuantity: broilerBatches.currentQuantity,
      initialQuantity: broilerBatches.initialQuantity,
      avgWeightKg: broilerBatches.avgWeightKg,
      targetWeightKg: broilerBatches.targetWeightKg,
      targetWeeks: broilerBatches.targetWeeks,
      targetDays: broilerBatches.targetDays,
      locationId: broilerBatches.locationId,
      startDate: broilerBatches.startDate,
      breed: broilerBatches.breed,
      acquisitionUnitCost: birdAcquisitions.unitCost,
    }).from(broilerBatches).leftJoin(birdAcquisitions, eq(broilerBatches.acquisitionId, birdAcquisitions.id)),
    db.select().from(slaughter).where(periodFilter(slaughter.date)),
    computeAnimalInventory(),
    loadSpeciesParams(),
    db.select().from(weightLogs).where(periodFilter(weightLogs.date)).orderBy(desc(weightLogs.date)).limit(50),
    db.select({
      species: feedMovements.species,
      locationId: feedMovements.locationId,
      quantity: feedMovements.quantity,
      unitCost: feedMovements.unitCost,
      fallbackCost: feedInventory.costPerUnit,
    }).from(feedMovements)
      .innerJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
      .where(and(eq(feedMovements.isEntry, false), periodFilter(feedMovements.date))),
    db.select().from(eggSales).where(periodFilter(eggSales.date)),
    db.select().from(transactions).where(periodFilter(transactions.date)),
    db.select().from(costAllocations).where(periodFilter(costAllocations.date)),
    db.select().from(farmAssets).where(ne(farmAssets.status, "retirado")),
  ]);

  const scopedHens = currentHens.filter((h) =>
    (!speciesFilter || speciesFilter === "gallina") && (!locationIdFilter || h.locationId === locationIdFilter),
  );
  const scopedRoosters = currentRoosters.filter((r) =>
    (!speciesFilter || speciesFilter === "gallo") && (!locationIdFilter || r.locationId === locationIdFilter),
  );
  const scopedBatches = allBatches.filter((b) =>
    (!speciesFilter || b.species === speciesFilter) && (!locationIdFilter || b.locationId === locationIdFilter),
  );

  const layingAgeCandidates = stageRows
    .filter((row) => Number(row.expectedEggsPerHen || 0) > 0 && row.minWeeks != null)
    .map((row) => Number(row.minWeeks));
  const minimumHenLayingWeeks = layingAgeCandidates.length > 0 ? Math.min(...layingAgeCandidates) : 20;
  const eligibleHens = scopedHens.filter((hen) =>
    hen.status === "activa" && daysBetween(hen.birthDate, todayStr) >= minimumHenLayingWeeks * 7,
  );
  const presentScopedHens = scopedHens.filter((hen) => isHenPresent(hen.status));

  const eligibleBatches = scopedBatches.filter((batch) => {
    if (batch.purpose !== "postura_huevo" || !["activo", "listo_sacrificio"].includes(batch.status) || batch.currentQuantity <= 0) return false;
    if (!["codorniz", "pato"].includes(batch.species)) return false;
    const params = paramsForSpecies(speciesParams, batch.species, batch.breed);
    return !!params && daysBetween(batch.startDate, todayStr) >= params.cycleWeeks * 7;
  });
  const eligibleBatchById = new Map(eligibleBatches.map((batch) => [batch.id, batch]));
  const eligibleAnimals = eligibleHens.length + eligibleBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
  const eligiblePopulationBySpecies = new Map<string, number>([["gallina", eligibleHens.length]]);
  for (const batch of eligibleBatches) {
    eligiblePopulationBySpecies.set(batch.species, (eligiblePopulationBySpecies.get(batch.species) || 0) + batch.currentQuantity);
  }

  const isEligibleEggRecord = (row: typeof periodEggRows[number]) => {
    if ((row.species || "gallina") === "gallina") return !row.batchId && eligibleHens.length > 0;
    if (!row.batchId) return false;
    const batch = eligibleBatchById.get(row.batchId);
    return !!batch && batch.species === row.species;
  };
  const eligiblePeriodEggRows = periodEggRows.filter(isEligibleEggRecord);
  const eligibleNinetyDayEggRows = ninetyDayEggRows.filter(isEligibleEggRecord);
  const recordedEggs = periodEggRows.reduce((sum, row) => sum + row.totalCollected, 0);
  const eligibleEggs = eligiblePeriodEggRows.reduce((sum, row) => sum + row.totalCollected, 0);
  const layingRate = eligibleAnimals > 0 ? (eligibleEggs / (eligibleAnimals * days)) * 100 : 0;
  const avgDaily = eligibleEggs / days;

  // HAA (Huevo Ave Alojada - incluye población alojada/lote inicial o presente) vs HD% (Gallina-Día / Hen-Day presente)
  const initialLayerPool = Math.max(eligibleAnimals, presentScopedHens.length + eligibleBatches.reduce((s, b) => s + b.initialQuantity, 0));
  const haaRate = initialLayerPool > 0 ? (eligibleEggs / (initialLayerPool * days)) * 100 : 0;

  const seriesMap = new Map<string, number>();
  for (const row of eligiblePeriodEggRows) {
    seriesMap.set(row.date, (seriesMap.get(row.date) || 0) + row.totalCollected);
  }
  const layingSeries = [...seriesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  // Real accrued feed cost when recorded, fallback to standard model estimate
  let accruedEggFeedCost = 0;
  for (const fm of periodFeedMovements) {
    if (speciesFilter && fm.species !== speciesFilter) continue;
    if (locationIdFilter && fm.locationId !== locationIdFilter) continue;
    if (!fm.species || ["gallina", "codorniz", "pato"].includes(fm.species)) {
      accruedEggFeedCost += Number(fm.quantity || 0) * Number(fm.unitCost ?? fm.fallbackCost ?? 0);
    }
  }
  let eggFeedCost = 0;
  for (const [species, count] of eligiblePopulationBySpecies) {
    const params = paramsForSpecies(speciesParams, species);
    if (!params) continue;
    eggFeedCost += count * params.dailyFeedGPerHead / 1000 * params.feedCostPerKgCOP * days;
  }
  const effectiveEggCostPool = accruedEggFeedCost > 0 ? accruedEggFeedCost : eggFeedCost;

  const eligibleEggsByWeek = new Map<string, number>();
  for (const row of eligibleNinetyDayEggRows) {
    const key = weekStart(row.date);
    eligibleEggsByWeek.set(key, (eligibleEggsByWeek.get(key) || 0) + row.totalCollected);
  }
  let peakWeek: { weekStart: string; avgDaily: number; totalEggs: number } | null = null;
  for (const [start, totalEggs] of eligibleEggsByWeek) {
    const avgDailyWk = totalEggs / 7;
    if (!peakWeek || avgDailyWk > peakWeek.avgDaily) {
      peakWeek = { weekStart: start, avgDaily: avgDailyWk, totalEggs };
    }
  }
  const recentEligibleEggs = eligibleNinetyDayEggRows
    .filter((row) => row.date >= sevenDaysStr)
    .reduce((sum, row) => sum + row.totalCollected, 0);
  const peakRate = eligibleAnimals > 0 && peakWeek ? peakWeek.avgDaily / eligibleAnimals * 100 : 0;
  const currentRate = eligibleAnimals > 0 ? recentEligibleEggs / (eligibleAnimals * 7) * 100 : 0;
  const declinePercent = peakRate > 0 ? ((peakRate - currentRate) / peakRate) * 100 : 0;

  const henById = new Map(currentHens.map((hen) => [hen.id, hen]));
  const roosterById = new Map(currentRoosters.map((rooster) => [rooster.id, rooster]));
  const batchById = new Map(allBatches.map((batch) => [batch.id, batch]));
  let saleableMeatKg = 0;
  let totalLiveMeatKg = 0;
  let totalCarcassMeatKg = 0;
  let meatEstimatedCost = 0;
  for (const record of periodSlaughter) {
    if (speciesFilter && record.species !== speciesFilter) continue;
    if (locationIdFilter && record.locationId !== locationIdFilter) continue;

    const totalCarcassKg = Math.max(0, Number(record.weightKg) || 0);
    const linkedBatch = record.batchId ? batchById.get(record.batchId) : undefined;
    const params = paramsForSpecies(speciesParams, record.species || "pollo", linkedBatch?.breed);
    const yieldFrac = Math.max(0.01, (Number(record.carcassYieldPercent) || params?.carcassYieldPercent || 72) / 100);
    const liveKg = Number(record.liveWeightKg) || totalCarcassKg / yieldFrac;
    totalCarcassMeatKg += totalCarcassKg;
    totalLiveMeatKg += liveKg;

    const saleableKg = saleableWeightKg(record);
    if (saleableKg <= 0 || totalCarcassKg <= 0) continue;
    saleableMeatKg += saleableKg;

    const quantity = Math.max(1, Number(record.quantity) || 1);
    const linkedHen = record.henId ? henById.get(record.henId) : undefined;
    const linkedRooster = record.roosterId ? roosterById.get(record.roosterId) : undefined;
    const linkedAnimal = linkedHen || linkedRooster;
    const species = linkedAnimal ? "gallina" : linkedBatch?.species || record.species || "pollo";
    const spParams = paramsForSpecies(speciesParams, species, linkedBatch?.breed || linkedAnimal?.breed);
    if (!spParams) continue;

    let estimatedCost = 0;
    if (linkedAnimal) {
      const acquisitionPrice = Number(linkedAnimal.acquisitionCost ?? linkedAnimal.acquisitionUnitCost ?? 0) || 0;
      const ageDays = daysBetween(linkedAnimal.birthDate, record.date);
      const feedCost = ageDays * spParams.dailyFeedGPerHead / 1000 * spParams.feedCostPerKgCOP;
      estimatedCost = (acquisitionPrice + feedCost) * quantity;
    } else if (linkedBatch) {
      const acquisitionPrice = Number(linkedBatch.acquisitionUnitCost || 0);
      const ageDays = daysBetween(linkedBatch.startDate, record.date);
      const feedCost = ageDays * spParams.dailyFeedGPerHead / 1000 * spParams.feedCostPerKgCOP;
      estimatedCost = (acquisitionPrice + feedCost) * quantity;
    } else {
      estimatedCost = liveKg * spParams.feedConversionRatio * spParams.feedCostPerKgCOP;
    }
    meatEstimatedCost += estimatedCost * (saleableKg / totalCarcassKg);
  }

  const totalExpenses = Number(expenseRows[0]?.total || 0);
  const perEgg = eligibleEggs > 0 ? effectiveEggCostPool / eligibleEggs : 0;
  const perTray30 = perEgg * 30;
  const perKgMeat = saleableMeatKg > 0 ? meatEstimatedCost / saleableMeatKg : 0;
  const perLiveKgMeat = totalLiveMeatKg > 0 ? meatEstimatedCost / totalLiveMeatKg : 0;

  const filteredEggSales = periodEggSalesRows.filter((s) =>
    (!speciesFilter || s.species === speciesFilter) && (!locationIdFilter || s.locationId === locationIdFilter),
  );
  const totalEggsSold = filteredEggSales.reduce((s, r) => s + Number(r.quantity || 0), 0);
  const totalEggSalesRev = filteredEggSales.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
  const avgSalePricePerEgg = totalEggsSold > 0 ? totalEggSalesRev / totalEggsSold : 0;
  const breakevenAlertEggs = totalEggsSold > 0 && perEgg > 0 && avgSalePricePerEgg < perEgg;

  const totalDeaths = deathRows[0]?.total || 0;
  const scopedFlockCount = (speciesFilter || locationIdFilter)
    ? presentScopedHens.length + scopedRoosters.filter((r) => isRoosterPresent(r.status)).length + scopedBatches.filter((b) => ["activo", "listo_sacrificio"].includes(b.status)).reduce((s, b) => s + b.currentQuantity, 0)
    : animalInventory.summary.totalAnimals;
  const mortalityRate = scopedFlockCount > 0 ? totalDeaths / scopedFlockCount * 100 : 0;

  let totalAgeWeeks = 0;
  let countWithAge = 0;
  for (const hen of scopedHens) {
    if (!isHenPresent(hen.status)) continue;
    totalAgeWeeks += daysBetween(hen.birthDate, todayStr) / 7;
    countWithAge++;
  }
  for (const rooster of scopedRoosters) {
    if (!isRoosterPresent(rooster.status)) continue;
    totalAgeWeeks += daysBetween(rooster.birthDate, todayStr) / 7;
    countWithAge++;
  }
  const avgAgeWeeks = countWithAge > 0 ? totalAgeWeeks / countWithAge : 0;
  const productiveRatio = scopedFlockCount > 0 ? eligibleAnimals / scopedFlockCount : 0;

  // Zootechnical KPIs: CV%, Uniformity, GDP/ADG, EPEF (broilers), Slaughter Window Alerts
  const filteredWeights = recentWeightLogs.filter((w) =>
    (!speciesFilter || w.species === speciesFilter) && (!locationIdFilter || w.locationId === locationIdFilter),
  );
  const cvValues = filteredWeights.map((w) => Number(w.cvPercent)).filter((v) => Number.isFinite(v) && v > 0);
  const uniValues = filteredWeights.map((w) => Number(w.uniformityPct)).filter((v) => Number.isFinite(v) && v > 0);
  const gdpValues = filteredWeights.map((w) => Number(w.dailyGainG)).filter((v) => Number.isFinite(v) && v > 0);
  const avgCvPercent = cvValues.length > 0 ? cvValues.reduce((s, v) => s + v, 0) / cvValues.length : null;
  const avgUniformityPct = uniValues.length > 0 ? uniValues.reduce((s, v) => s + v, 0) / uniValues.length : null;
  const avgDailyGainG = gdpValues.length > 0 ? gdpValues.reduce((s, v) => s + v, 0) / gdpValues.length : null;

  // EPEF = ((Viabilidad % * Peso vivo kg) / (Edad días * ICA)) * 100
  const meatBatches = scopedBatches.filter((b) =>
    b.purpose === "engorde_carne" && ["activo", "listo_sacrificio"].includes(b.status) && b.currentQuantity > 0,
  );
  let epefScore: number | null = null;
  const epefScores: number[] = [];
  const slaughterWindowAlerts: Array<{ batchId: string; code: string; species: string; ageDays: number; targetDays: number; avgWeightKg: number; targetWeightKg: number; recommendation: string }> = [];

  const totalFeedKgPeriod = periodFeedMovements
    .filter((f) => (!speciesFilter || f.species === speciesFilter) && (!locationIdFilter || f.locationId === locationIdFilter))
    .reduce((s, f) => s + Number(f.quantity || 0), 0);

  for (const b of meatBatches) {
    const ageDays = Math.max(1, daysBetween(b.startDate, todayStr));
    const targetDays = b.targetDays || (b.targetWeeks || 6) * 7;
    const avgW = Number(b.avgWeightKg || 0);
    const targetW = Number(b.targetWeightKg || 2.5);
    const viability = b.initialQuantity > 0 ? (b.currentQuantity / b.initialQuantity) * 100 : 100;
    const spParams = paramsForSpecies(speciesParams, b.species, b.breed);
    const estFcr = Number(spParams?.feedConversionRatio || 1.75);
    if (avgW > 0 && estFcr > 0) {
      epefScores.push(((viability * avgW) / (ageDays * estFcr)) * 100);
    }
    if (ageDays >= targetDays - 3 || (avgW > 0 && avgW >= targetW * 0.92)) {
      slaughterWindowAlerts.push({
        batchId: b.id,
        code: b.code,
        species: b.species,
        ageDays,
        targetDays,
        avgWeightKg: Number(avgW.toFixed(2)),
        targetWeightKg: Number(targetW.toFixed(2)),
        recommendation: ageDays > targetDays + 3
          ? "Sobre-edad: programar beneficio inmediato para evitar deterioro de conversión alimenticia"
          : "En ventana óptima de beneficio/venta",
      });
    }
  }
  if (epefScores.length > 0) {
    epefScore = epefScores.reduce((s, v) => s + v, 0) / epefScores.length;
  }

  // CAPEX ROI
  const periodRev = allTxInPeriod
    .filter((t) => t.type === "ingreso" && (!speciesFilter || t.species === speciesFilter) && (!locationIdFilter || t.locationId === locationIdFilter))
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const proratedSum = allocationsInPeriod.reduce((s, a) => s + Number(a.totalAmount || 0), 0);
  const netPeriodProfit = periodRev - totalExpenses;
  const totalCapex = activeAssets
    .filter((a) => !locationIdFilter || a.locationId === locationIdFilter)
    .reduce((s, a) => s + Number(a.acquisitionCost || 0), 0);
  const monthlyProfit = (netPeriodProfit / days) * 30.4375;
  const roiAnnualizedPct = totalCapex > 0 ? (((netPeriodProfit / days) * 365) / totalCapex) * 100 : null;
  const paybackMonths = totalCapex > 0 && monthlyProfit > 0 ? totalCapex / monthlyProfit : null;

  return NextResponse.json({
    filters: { species: speciesFilter, locationId: locationIdFilter },
    mortality: {
      rate: Number(mortalityRate.toFixed(2)),
      totalDeaths,
      totalFlock: scopedFlockCount,
      byCause,
    },
    laying: {
      rate: Number(layingRate.toFixed(2)),
      haaRate: Number(haaRate.toFixed(2)),
      totalEggs: recordedEggs,
      eligibleEggs,
      eligibleAnimals,
      avgDaily: Number(avgDaily.toFixed(1)),
      series: layingSeries,
    },
    costPerUnit: {
      perEgg: Number(perEgg.toFixed(2)),
      perTray30: Number(perTray30.toFixed(2)),
      avgSalePricePerEgg: Number(avgSalePricePerEgg.toFixed(2)),
      breakevenAlertEggs,
      perKgMeat: Number(perKgMeat.toFixed(2)),
      perLiveKgMeat: Number(perLiveKgMeat.toFixed(2)),
      totalExpenses,
      proratedCostsInPeriod: Number(proratedSum.toFixed(2)),
      eggFeedCost: Number(effectiveEggCostPool.toFixed(2)),
      meatEstimatedCost: Number(meatEstimatedCost.toFixed(2)),
      saleableMeatKg: Number(saleableMeatKg.toFixed(2)),
      totalCarcassKg: Number(totalCarcassMeatKg.toFixed(2)),
      totalLiveKg: Number(totalLiveMeatKg.toFixed(2)),
    },
    zootechnical: {
      cvPercent: avgCvPercent !== null ? Number(avgCvPercent.toFixed(2)) : null,
      uniformityPct: avgUniformityPct !== null ? Number(avgUniformityPct.toFixed(1)) : null,
      dailyGainG: avgDailyGainG !== null ? Number(avgDailyGainG.toFixed(1)) : null,
      epef: epefScore !== null ? Number(epefScore.toFixed(1)) : null,
      feedKgConsumed: Number(totalFeedKgPeriod.toFixed(2)),
      slaughterWindowAlerts,
    },
    capexRoi: {
      totalCapex: Number(totalCapex.toFixed(2)),
      roiAnnualizedPct: roiAnnualizedPct !== null ? Number(roiAnnualizedPct.toFixed(1)) : null,
      paybackMonths: paybackMonths !== null ? Number(paybackMonths.toFixed(1)) : null,
    },
    flock: {
      avgAgeWeeks: Number(avgAgeWeeks.toFixed(1)),
      totalBirds: scopedFlockCount,
      productiveRatio: Number(productiveRatio.toFixed(2)),
    },
    expenseByCategory,
    periodDays: days,
    peakProduction: {
      peakWeek: peakWeek?.weekStart || null,
      peakDate: peakWeek?.weekStart || null,
      peakRate: Number(peakRate.toFixed(2)),
      currentRate: Number(currentRate.toFixed(2)),
      declinePercent: Number(declinePercent.toFixed(2)),
      avgDaily: Number((peakWeek?.avgDaily || 0).toFixed(1)),
      totalEggs: peakWeek?.totalEggs || 0,
    },
  });
});
