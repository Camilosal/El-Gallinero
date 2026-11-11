import { db } from "@/db";
import {
  mortalityRecords,
  hens,
  roosters,
  eggProduction,
  transactions,
  broilerBatches,
  slaughter,
  birdAcquisitions,
  catalogos,
} from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { computeAnimalInventory } from "@/lib/animal-inventory";
import { isHenPresent, isRoosterPresent } from "@/lib/animal-status";
import { loadSpeciesParams, type SpeciesDbParams } from "@/lib/species-db";

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
  const requestedDays = Number(searchParams.get("period") || "30");
  const days = [7, 30, 90, 365].includes(requestedDays) ? requestedDays : 30;
  const todayStr = dateString(new Date());
  const cutoff = new Date(`${todayStr}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffStr = dateString(cutoff);
  const ninetyDays = new Date(`${todayStr}T12:00:00`);
  ninetyDays.setDate(ninetyDays.getDate() - 89);
  const ninetyDaysStr = dateString(ninetyDays);
  const sevenDays = new Date(`${todayStr}T12:00:00`);
  sevenDays.setDate(sevenDays.getDate() - 6);
  const sevenDaysStr = dateString(sevenDays);
  const periodFilter = (column: any) => and(gte(column, cutoffStr), lte(column, todayStr));

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
  ] = await Promise.all([
    db.select({ total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int` })
      .from(mortalityRecords).where(periodFilter(mortalityRecords.date)),
    db.select({
      cause: mortalityRecords.cause,
      total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int`,
    }).from(mortalityRecords).where(periodFilter(mortalityRecords.date)).groupBy(mortalityRecords.cause),
    db.select({ minWeeks: catalogos.minWeeks, expectedEggsPerHen: catalogos.expectedEggsPerHen })
      .from(catalogos)
      .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true))),
    db.select().from(eggProduction).where(periodFilter(eggProduction.date)),
    db.select().from(eggProduction).where(and(gte(eggProduction.date, ninetyDaysStr), lte(eggProduction.date, todayStr))),
    db.select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text` })
      .from(transactions).where(and(eq(transactions.type, "egreso"), periodFilter(transactions.date))),
    db.select({
      category: transactions.category,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
    }).from(transactions)
      .where(and(eq(transactions.type, "egreso"), periodFilter(transactions.date)))
      .groupBy(transactions.category)
      .orderBy(sql`sum(${transactions.amount}) desc`),
    db.select({
      id: hens.id,
      birthDate: hens.birthDate,
      status: hens.status,
      breed: hens.breed,
      acquisitionCost: hens.acquisitionCost,
      acquisitionUnitCost: birdAcquisitions.unitCost,
    }).from(hens).leftJoin(birdAcquisitions, eq(hens.acquisitionId, birdAcquisitions.id)),
    db.select({
      id: roosters.id,
      birthDate: roosters.birthDate,
      status: roosters.status,
      breed: roosters.breed,
      acquisitionCost: roosters.acquisitionCost,
      acquisitionUnitCost: birdAcquisitions.unitCost,
    }).from(roosters).leftJoin(birdAcquisitions, eq(roosters.acquisitionId, birdAcquisitions.id)),
    db.select({
      id: broilerBatches.id,
      species: broilerBatches.species,
      purpose: broilerBatches.purpose,
      status: broilerBatches.status,
      currentQuantity: broilerBatches.currentQuantity,
      initialQuantity: broilerBatches.initialQuantity,
      startDate: broilerBatches.startDate,
      breed: broilerBatches.breed,
      acquisitionUnitCost: birdAcquisitions.unitCost,
    }).from(broilerBatches).leftJoin(birdAcquisitions, eq(broilerBatches.acquisitionId, birdAcquisitions.id)),
    db.select().from(slaughter).where(periodFilter(slaughter.date)),
    computeAnimalInventory(),
    loadSpeciesParams(),
  ]);

  const layingAgeCandidates = stageRows
    .filter((row) => Number(row.expectedEggsPerHen || 0) > 0 && row.minWeeks != null)
    .map((row) => Number(row.minWeeks));
  const minimumHenLayingWeeks = layingAgeCandidates.length > 0 ? Math.min(...layingAgeCandidates) : 20;
  const eligibleHens = currentHens.filter((hen) =>
    hen.status === "activa" && daysBetween(hen.birthDate, todayStr) >= minimumHenLayingWeeks * 7,
  );

  const eligibleBatches = allBatches.filter((batch) => {
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

  const seriesMap = new Map<string, number>();
  for (const row of eligiblePeriodEggRows) {
    seriesMap.set(row.date, (seriesMap.get(row.date) || 0) + row.totalCollected);
  }
  const layingSeries = [...seriesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  let eggFeedCost = 0;
  for (const [species, count] of eligiblePopulationBySpecies) {
    const params = paramsForSpecies(speciesParams, species);
    if (!params) continue;
    eggFeedCost += count * params.dailyFeedGPerHead / 1000 * params.feedCostPerKgCOP * days;
  }

  const eligibleEggsByWeek = new Map<string, number>();
  for (const row of eligibleNinetyDayEggRows) {
    const key = weekStart(row.date);
    eligibleEggsByWeek.set(key, (eligibleEggsByWeek.get(key) || 0) + row.totalCollected);
  }
  let peakWeek: { weekStart: string; avgDaily: number; totalEggs: number } | null = null;
  for (const [start, totalEggs] of eligibleEggsByWeek) {
    const avgDaily = totalEggs / 7;
    if (!peakWeek || avgDaily > peakWeek.avgDaily) {
      peakWeek = { weekStart: start, avgDaily, totalEggs };
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
  let meatEstimatedCost = 0;
  for (const record of periodSlaughter) {
    const totalCarcassKg = Math.max(0, Number(record.weightKg) || 0);
    const saleableKg = saleableWeightKg(record);
    if (saleableKg <= 0 || totalCarcassKg <= 0) continue;
    saleableMeatKg += saleableKg;

    const quantity = Math.max(1, Number(record.quantity) || 1);
    const linkedHen = record.henId ? henById.get(record.henId) : undefined;
    const linkedRooster = record.roosterId ? roosterById.get(record.roosterId) : undefined;
    const linkedBatch = record.batchId ? batchById.get(record.batchId) : undefined;
    const linkedAnimal = linkedHen || linkedRooster;
    const species = linkedAnimal ? "gallina" : linkedBatch?.species || record.species || "pollo";
    const params = paramsForSpecies(speciesParams, species, linkedBatch?.breed || linkedAnimal?.breed);
    if (!params) continue;

    let estimatedCost = 0;
    if (linkedAnimal) {
      const acquisitionPrice = Number(linkedAnimal.acquisitionCost ?? linkedAnimal.acquisitionUnitCost ?? 0) || 0;
      const ageDays = daysBetween(linkedAnimal.birthDate, record.date);
      const feedCost = ageDays * params.dailyFeedGPerHead / 1000 * params.feedCostPerKgCOP;
      estimatedCost = (acquisitionPrice + feedCost) * quantity;
    } else if (linkedBatch) {
      const acquisitionPrice = Number(linkedBatch.acquisitionUnitCost || 0);
      const ageDays = daysBetween(linkedBatch.startDate, record.date);
      const feedCost = ageDays * params.dailyFeedGPerHead / 1000 * params.feedCostPerKgCOP;
      estimatedCost = (acquisitionPrice + feedCost) * quantity;
    } else {
      const liveWeightKg = Number(record.liveWeightKg) || totalCarcassKg / Math.max(0.01, params.carcassYieldPercent / 100);
      estimatedCost = liveWeightKg * params.feedConversionRatio * params.feedCostPerKgCOP;
    }
    meatEstimatedCost += estimatedCost * (saleableKg / totalCarcassKg);
  }

  const totalExpenses = Number(expenseRows[0]?.total || 0);
  const perEgg = eligibleEggs > 0 ? eggFeedCost / eligibleEggs : 0;
  const perKgMeat = saleableMeatKg > 0 ? meatEstimatedCost / saleableMeatKg : 0;
  const totalDeaths = deathRows[0]?.total || 0;
  const totalFlock = animalInventory.summary.totalAnimals;
  const mortalityRate = totalFlock > 0 ? totalDeaths / totalFlock * 100 : 0;

  let totalAgeWeeks = 0;
  let countWithAge = 0;
  for (const hen of currentHens) {
    if (!isHenPresent(hen.status)) continue;
    totalAgeWeeks += daysBetween(hen.birthDate, todayStr) / 7;
    countWithAge++;
  }
  for (const rooster of currentRoosters) {
    if (!isRoosterPresent(rooster.status)) continue;
    totalAgeWeeks += daysBetween(rooster.birthDate, todayStr) / 7;
    countWithAge++;
  }
  const avgAgeWeeks = countWithAge > 0 ? totalAgeWeeks / countWithAge : 0;
  const productiveRatio = totalFlock > 0 ? eligibleAnimals / totalFlock : 0;

  return NextResponse.json({
    mortality: {
      rate: Number(mortalityRate.toFixed(2)),
      totalDeaths,
      totalFlock,
      byCause,
    },
    laying: {
      rate: Number(layingRate.toFixed(2)),
      totalEggs: recordedEggs,
      eligibleEggs,
      eligibleAnimals,
      avgDaily: Number(avgDaily.toFixed(1)),
      series: layingSeries,
    },
    costPerUnit: {
      perEgg: Number(perEgg.toFixed(2)),
      perKgMeat: Number(perKgMeat.toFixed(2)),
      totalExpenses,
      eggFeedCost: Number(eggFeedCost.toFixed(2)),
      meatEstimatedCost: Number(meatEstimatedCost.toFixed(2)),
      saleableMeatKg: Number(saleableMeatKg.toFixed(2)),
    },
    flock: {
      avgAgeWeeks: Number(avgAgeWeeks.toFixed(1)),
      totalBirds: totalFlock,
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
