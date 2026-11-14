import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  broilerBatches,
  farmAssets,
  farmLocations,
  feedInventory,
  hens,
  roosters,
  weightLogs,
} from "@/db/schema";
import {
  buildMarketPriceOverridesFromSipsa,
  evaluateBiologicalPortfolio,
  computeAssetsDepreciationSummary,
  computeFeedWarehouseValuation,
  type AssetLike,
  type BroilerBatchLike,
  type FeedInventoryLike,
  type FlockLike,
  type LocationLike,
} from "@/lib/analytics/biological-valuation";
import { syncMarketPricesSnapshot } from "@/lib/external-sources/wave1-territory-weather-market";
import { computeUniformityStats } from "@/lib/zootechnics";

export interface LoadedFarmBiologicalContext {
  locations: LocationLike[];
  assets: AssetLike[];
  feedRows: FeedInventoryLike[];
  batches: BroilerBatchLike[];
  flocks: FlockLike[];
  marketOverrides: ReturnType<typeof buildMarketPriceOverridesFromSipsa>;
}

/**
 * Loads active locations, assets, warehouse feed, batches, and flocks from DB
 * and adapts them into the pure biological valuation domain types.
 */
export async function loadFarmBiologicalContext(options?: {
  farmId?: string | null;
  speciesFilter?: string | null;
  locationIdFilter?: string | null;
  batchIdFilter?: string | null;
  referenceDate?: string;
}): Promise<LoadedFarmBiologicalContext> {
  const {
    farmId = null,
    speciesFilter = null,
    locationIdFilter = null,
    batchIdFilter = null,
    referenceDate,
  } = options || {};
  const today = referenceDate || new Date().toISOString().slice(0, 10);

  const [locRows, assetRows, feedInvRows, batchRows, henRows, roosterRows, recentWeights, marketSnap] =
    await Promise.all([
      db
        .select({
          id: farmLocations.id,
          name: farmLocations.name,
          altitudeMeters: farmLocations.altitudeMeters,
          floorType: farmLocations.floorType,
          sanitaryEmptyUntil: farmLocations.sanitaryEmptyUntil,
        })
        .from(farmLocations)
        .where(farmId ? eq(farmLocations.farmId, farmId) : undefined),
      db
        .select()
        .from(farmAssets)
        .where(farmId ? and(eq(farmAssets.farmId, farmId), ne(farmAssets.status, "retirado")) : ne(farmAssets.status, "retirado")),
      db
        .select({
          id: feedInventory.id,
          name: feedInventory.name,
          currentStock: feedInventory.currentStock,
          costPerUnit: feedInventory.costPerUnit,
          minStock: feedInventory.minStock,
        })
        .from(feedInventory)
        .where(farmId ? eq(feedInventory.farmId, farmId) : undefined),
      db
        .select()
        .from(broilerBatches)
        .where(farmId ? and(eq(broilerBatches.farmId, farmId), eq(broilerBatches.status, "activo")) : eq(broilerBatches.status, "activo")),
      db
        .select()
        .from(hens)
        .where(farmId ? and(eq(hens.farmId, farmId), eq(hens.status, "activa")) : eq(hens.status, "activa")),
      db
        .select()
        .from(roosters)
        .where(farmId ? and(eq(roosters.farmId, farmId), eq(roosters.status, "activo")) : eq(roosters.status, "activo")),
      db
        .select()
        .from(weightLogs)
        .where(farmId ? eq(weightLogs.farmId, farmId) : undefined)
        .orderBy(desc(weightLogs.date))
        .limit(80),
      syncMarketPricesSnapshot().catch(() => null),
    ]);

  const latestWeightByBatch = new Map<string, { weightG: number; cvPct: number | null }>();
  for (const w of recentWeights) {
    if (!w.batchId || latestWeightByBatch.has(w.batchId)) continue;
    const avgG = w.avgWeightKg ? Number(w.avgWeightKg) * 1000 : 0;
    let cvPct: number | null = null;
    if (Array.isArray(w.individualWeightsG) && w.individualWeightsG.length >= 2) {
      cvPct = computeUniformityStats(w.individualWeightsG)?.cvPercent ?? null;
    }
    if (avgG > 0 || cvPct !== null) {
      latestWeightByBatch.set(w.batchId, { weightG: avgG, cvPct });
    }
  }

  const locations: LocationLike[] = locRows.map((l) => ({
    id: l.id,
    name: l.name,
    altitudeMeters: l.altitudeMeters ?? null,
    floorType: l.floorType ?? null,
    sanitaryEmptyUntil: l.sanitaryEmptyUntil ?? null,
  }));

  const assets: AssetLike[] = assetRows
    .filter((a) => !locationIdFilter || a.locationId === locationIdFilter)
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      category: a.category,
      status: a.status,
      acquisitionDate: a.acquisitionDate ?? null,
      acquisitionCost: a.acquisitionCost,
      usefulLifeMonths: a.usefulLifeMonths ?? 36,
      usefulLifeCycles: a.usefulLifeCycles ?? null,
      residualValue: a.residualValue ?? "0",
      depreciationBasis: a.depreciationBasis ?? "meses",
    }));

  const feedRows: FeedInventoryLike[] = feedInvRows.map((f) => ({
    id: f.id,
    name: f.name,
    currentKg: f.currentStock,
    unitCost: f.costPerUnit,
    reorderLevelKg: f.minStock,
  }));

  const batches: BroilerBatchLike[] = [];
  const flocks: FlockLike[] = [];

  for (const b of batchRows) {
    if (speciesFilter && b.species !== speciesFilter) continue;
    if (locationIdFilter && b.locationId !== locationIdFilter) continue;
    if (batchIdFilter && b.id !== batchIdFilter) continue;

    const latestW = latestWeightByBatch.get(b.id);
    const batchAvgWeightG =
      latestW && latestW.weightG > 0
        ? latestW.weightG
        : b.avgWeightKg && Number(b.avgWeightKg) > 0
          ? Number(b.avgWeightKg) * 1000
          : null;

    if (b.purpose === "engorde_carne" || b.purpose === "mixto") {
      batches.push({
        id: b.id,
        batchCode: b.code,
        species: b.species,
        breed: b.breed,
        initialCount: b.initialQuantity,
        currentCount: b.currentQuantity,
        avgWeightG: batchAvgWeightG,
        chickCostTotal: b.totalProductionCost ?? null,
        startDate: b.startDate,
        targetAgeDays: b.targetDays ?? (b.targetWeeks ? b.targetWeeks * 7 : null),
        targetWeightG: b.targetWeightKg ? Number(b.targetWeightKg) * 1000 : null,
        status: b.status,
        locationId: b.locationId ?? null,
        uniformityCvPct: latestW?.cvPct ?? null,
      });
    } else {
      flocks.push({
        id: b.id,
        name: b.code,
        species: b.species,
        breed: b.breed,
        purpose: b.purpose,
        initialCount: b.initialQuantity,
        currentCount: b.currentQuantity,
        acquisitionCost: b.totalProductionCost ?? null,
        ageWeeks: 0,
        entryDate: b.startDate,
        status: b.status,
        locationId: b.locationId ?? null,
        latestAvgWeightG: batchAvgWeightG,
        latestCvPct: latestW?.cvPct ?? null,
      });
    }
  }

  // Group individual active hens/roosters when no batch filter is active
  if (!batchIdFilter) {
    const activeHens = henRows.filter((h) => !locationIdFilter || h.locationId === locationIdFilter);
    if (activeHens.length > 0 && (!speciesFilter || speciesFilter === "gallina")) {
      const totalAcq = activeHens.reduce((s, h) => s + Number(h.acquisitionCost || 0), 0);
      const ages = activeHens.map((h) => {
        if (!h.birthDate) return 24;
        const ms = new Date(`${today}T00:00:00Z`).getTime() - new Date(`${h.birthDate}T00:00:00Z`).getTime();
        return Math.max(1, ms / (86400000 * 7));
      });
      const avgAgeWeeks = ages.reduce((a, b) => a + b, 0) / ages.length;
      flocks.push({
        id: "individual-hens-flock",
        name: `Ponedoras individuales (${activeHens.length})`,
        species: "gallina",
        breed: activeHens[0]?.breed || "Isa Brown",
        purpose: "postura_huevo",
        initialCount: activeHens.length,
        currentCount: activeHens.length,
        acquisitionCost: totalAcq > 0 ? totalAcq : null,
        ageWeeks: avgAgeWeeks,
        entryDate: null,
        status: "activo",
        locationId: activeHens.find((h) => h.locationId)?.locationId ?? null,
      });
    }

    const activeRoosters = roosterRows.filter((r) => !locationIdFilter || r.locationId === locationIdFilter);
    if (activeRoosters.length > 0 && (!speciesFilter || speciesFilter === "gallina")) {
      const totalAcq = activeRoosters.reduce((s, r) => s + Number(r.acquisitionCost || 0), 0);
      flocks.push({
        id: "individual-roosters-flock",
        name: `Reproductores (${activeRoosters.length})`,
        species: "gallina",
        breed: activeRoosters[0]?.breed || "Criollo",
        purpose: "pie_cria",
        initialCount: activeRoosters.length,
        currentCount: activeRoosters.length,
        acquisitionCost: totalAcq > 0 ? totalAcq : null,
        ageWeeks: 28,
        entryDate: null,
        status: "activo",
        locationId: activeRoosters.find((r) => r.locationId)?.locationId ?? null,
      });
    }
  }

  return {
    locations,
    assets,
    feedRows,
    batches,
    flocks,
    marketOverrides: buildMarketPriceOverridesFromSipsa(marketSnap?.payload),
  };
}

export {
  evaluateBiologicalPortfolio,
  computeAssetsDepreciationSummary,
  computeFeedWarehouseValuation,
};
