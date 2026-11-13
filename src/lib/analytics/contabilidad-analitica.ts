import { and, desc, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  costAllocations,
  eggProduction,
  eggSales,
  eggSalesItems,
  farmAssets,
  farmLocations,
  feedInventory,
  feedMovements,
  meatSales,
  slaughter,
  transactions,
} from "@/db/schema";
import { SPECIES_LABELS } from "@/lib/species";

const round2 = (n: number) => Number((Number.isFinite(n) ? n : 0).toFixed(2));
const UNASSIGNED = "sin_asignar";

// Mapeo NTC 1240 estándar Colombia + tallas legadas
export function classifyNtc1240Caliber(rawSize: string | null | undefined): {
  code: string;
  label: string;
  minWeightG: number | null;
  maxWeightG: number | null;
} {
  const s = String(rawSize || "").trim().toLowerCase();
  if (s === "jumbo") return { code: "Jumbo", label: "Jumbo (>78 g)", minWeightG: 78.1, maxWeightG: null };
  if (s === "aaa") return { code: "AAA", label: "AAA (67 – 77.9 g)", minWeightG: 67, maxWeightG: 77.9 };
  if (s === "aa" || s === "grande") return { code: s === "aa" ? "AA" : "AA (Grande)", label: "AA (60 – 66.9 g)", minWeightG: 60, maxWeightG: 66.9 };
  if (s === "a" || s === "mediano" || s === "mediana") return { code: s === "a" ? "A" : "A (Mediano)", label: "A (53 – 59.9 g)", minWeightG: 53, maxWeightG: 59.9 };
  if (s === "b" || s === "pequeño" || s === "pequeno") return { code: s === "b" ? "B" : "B (Pequeño)", label: "B (46 – 52.9 g)", minWeightG: 46, maxWeightG: 52.9 };
  if (s === "c") return { code: "C", label: "C (<46 g)", minWeightG: null, maxWeightG: 45.9 };
  return { code: rawSize?.trim() || "Sin talla", label: rawSize?.trim() || "Sin talla", minWeightG: null, maxWeightG: null };
}

function speciesName(key: string): string {
  if (key === UNASSIGNED) return "Sin asignar";
  return (SPECIES_LABELS as Record<string, { singular?: string }>)[key]?.singular || key;
}

function isEggRelatedTx(tx: { category: string; sourceType: string | null; species: string | null }) {
  const cat = tx.category.toLowerCase();
  return cat.includes("huevo") || tx.sourceType === "venta";
}

function isMeatRelatedTx(tx: { category: string; sourceType: string | null }) {
  const cat = tx.category.toLowerCase();
  return cat.includes("carne") || cat.includes("sacrificio") || tx.sourceType === "venta_carne" || tx.sourceType === "sacrificio";
}

export interface ComputeAnalyticsOptions {
  from: string;
  to: string;
  speciesFilter?: string | null;
  locationIdFilter?: string | null;
  batchIdFilter?: string | null;
  includeProrated?: boolean;
}

export async function computeAnalyticalAccounting(opts: ComputeAnalyticsOptions) {
  const {
    from,
    to,
    speciesFilter = null,
    locationIdFilter = null,
    batchIdFilter = null,
    includeProrated = true,
  } = opts;

  const [
    txRows,
    allocationRows,
    locations,
    feedConsumptions,
    prodEggRows,
    eggSaleRows,
    slaughterRows,
    meatSaleRows,
    activeAssets,
  ] = await Promise.all([
    db.select().from(transactions).where(and(gte(transactions.date, from), lte(transactions.date, to))),
    db
      .select()
      .from(costAllocations)
      .where(and(gte(costAllocations.date, from), lte(costAllocations.date, to)))
      .orderBy(desc(costAllocations.date)),
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
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
    db.select().from(eggProduction).where(and(gte(eggProduction.date, from), lte(eggProduction.date, to))),
    db
      .select({
        saleId: eggSales.id,
        date: eggSales.date,
        species: eggSales.species,
        locationId: eggSales.locationId,
        batchId: eggSales.batchId,
        size: eggSalesItems.size,
        quantity: eggSalesItems.quantity,
        pricePerUnit: eggSalesItems.pricePerUnit,
        totalAmount: eggSalesItems.totalAmount,
      })
      .from(eggSalesItems)
      .innerJoin(eggSales, eq(eggSalesItems.saleId, eggSales.id))
      .where(and(gte(eggSales.date, from), lte(eggSales.date, to))),
    db.select().from(slaughter).where(and(gte(slaughter.date, from), lte(slaughter.date, to))),
    db.select().from(meatSales).where(and(gte(meatSales.date, from), lte(meatSales.date, to))),
    db.select().from(farmAssets).where(ne(farmAssets.status, "retirado")),
  ]);

  const locNames = new Map(locations.map((l) => [l.id, l.name]));
  const allocatedTxIds = new Set(
    allocationRows.map((a) => a.sourceTransactionId).filter((id): id is string => Boolean(id)),
  );

  const bySpeciesMap = new Map<
    string,
    { label: string; directRevenue: number; directCost: number; proratedCost: number; feedCost: number }
  >();
  const byLocationMap = new Map<
    string,
    { label: string; directRevenue: number; directCost: number; proratedCost: number; feedCost: number }
  >();

  const ensureBucket = (
    map: Map<string, { label: string; directRevenue: number; directCost: number; proratedCost: number; feedCost: number }>,
    key: string,
    label: string,
  ) => {
    let row = map.get(key);
    if (!row) {
      row = { label, directRevenue: 0, directCost: 0, proratedCost: 0, feedCost: 0 };
      map.set(key, row);
    }
    return row;
  };

  let totalDirectRevenue = 0;
  let totalDirectCost = 0;
  let totalProratedCost = 0;
  let unallocatedSharedCost = 0;

  for (const tx of txRows) {
    if (speciesFilter && tx.species !== speciesFilter) continue;
    if (locationIdFilter && tx.locationId !== locationIdFilter) continue;
    if (batchIdFilter && tx.batchId !== batchIdFilter) continue;

    const amt = Number(tx.amount || 0);
    const spKey = tx.species || UNASSIGNED;
    const locKey = tx.locationId || UNASSIGNED;
    const spBucket = ensureBucket(bySpeciesMap, spKey, speciesName(spKey));
    const locBucket = ensureBucket(
      byLocationMap,
      locKey,
      tx.locationId ? locNames.get(tx.locationId) || "Lugar" : "Sin asignar",
    );

    if (tx.type === "ingreso") {
      totalDirectRevenue += amt;
      spBucket.directRevenue += amt;
      locBucket.directRevenue += amt;
    } else {
      const alreadySplit = includeProrated && allocatedTxIds.has(tx.id);
      if (!alreadySplit) {
        totalDirectCost += amt;
        spBucket.directCost += amt;
        locBucket.directCost += amt;
        if (!tx.species && !tx.locationId) {
          unallocatedSharedCost += amt;
        }
      }
    }
  }

  if (includeProrated) {
    for (const rule of allocationRows) {
      for (const item of rule.allocations || []) {
        if (speciesFilter && item.species !== speciesFilter) continue;
        if (locationIdFilter && item.locationId !== locationIdFilter) continue;
        if (batchIdFilter && item.batchId !== batchIdFilter) continue;
        const amt = Number(item.amount || 0);
        totalProratedCost += amt;
        if (item.species) {
          ensureBucket(bySpeciesMap, item.species, speciesName(item.species)).proratedCost += amt;
        }
        if (item.locationId) {
          ensureBucket(
            byLocationMap,
            item.locationId,
            locNames.get(item.locationId) || item.label || "Lugar",
          ).proratedCost += amt;
        }
      }
    }
  }

  for (const fc of feedConsumptions) {
    if (speciesFilter && fc.species !== speciesFilter) continue;
    if (locationIdFilter && fc.locationId !== locationIdFilter) continue;
    const cost = Number(fc.quantity || 0) * Number(fc.unitCost ?? fc.fallbackCost ?? 0);
    if (cost <= 0) continue;
    const spKey = fc.species || UNASSIGNED;
    const locKey = fc.locationId || UNASSIGNED;
    ensureBucket(bySpeciesMap, spKey, speciesName(spKey)).feedCost += cost;
    ensureBucket(
      byLocationMap,
      locKey,
      fc.locationId ? locNames.get(fc.locationId) || "Lugar" : "Sin asignar",
    ).feedCost += cost;
  }

  const formatRows = (
    map: Map<string, { label: string; directRevenue: number; directCost: number; proratedCost: number; feedCost: number }>,
  ) =>
    Array.from(map.entries())
      .map(([key, v]) => {
        const totalCost = v.directCost + v.proratedCost;
        const netProfit = v.directRevenue - totalCost;
        return {
          key,
          label: v.label,
          directRevenue: round2(v.directRevenue),
          directCost: round2(v.directCost),
          proratedCost: round2(v.proratedCost),
          totalCost: round2(totalCost),
          accruedFeedCost: round2(v.feedCost),
          netProfit: round2(netProfit),
          marginPct: v.directRevenue > 0 ? round2((netProfit / v.directRevenue) * 100) : null,
        };
      })
      .sort((a, b) => b.directRevenue - a.directRevenue || b.totalCost - a.totalCost);

  const filteredEggProd = prodEggRows.filter((e) => {
    if (speciesFilter && e.species !== speciesFilter) return false;
    if (locationIdFilter && e.locationId !== locationIdFilter) return false;
    if (batchIdFilter && e.batchId !== batchIdFilter) return false;
    return true;
  });
  const totalEggsCollected = filteredEggProd.reduce((s, e) => s + Number(e.totalCollected || 0), 0);
  const netSaleableEggs = filteredEggProd.reduce(
    (s, e) => s + Math.max(0, Number(e.totalCollected || 0) - Number(e.broken || 0) - Number(e.discarded || 0)),
    0,
  );

  let layerAccruedFeedCost = 0;
  for (const fc of feedConsumptions) {
    if (speciesFilter && fc.species !== speciesFilter) continue;
    if (locationIdFilter && fc.locationId !== locationIdFilter) continue;
    if (!fc.species || ["gallina", "codorniz", "pato"].includes(fc.species)) {
      layerAccruedFeedCost += Number(fc.quantity || 0) * Number(fc.unitCost ?? fc.fallbackCost ?? 0);
    }
  }
  const layerDirectExpenses = txRows
    .filter(
      (t) =>
        t.type === "egreso" &&
        !(includeProrated && allocatedTxIds.has(t.id)) &&
        (!speciesFilter || t.species === speciesFilter) &&
        (!locationIdFilter || t.locationId === locationIdFilter) &&
        (!batchIdFilter || t.batchId === batchIdFilter) &&
        (isEggRelatedTx(t) || t.species === "gallina" || t.species === "codorniz"),
    )
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const layerProratedShare = includeProrated
    ? allocationRows.reduce(
        (s, r) =>
          s +
          (r.allocations || [])
            .filter((a) => !speciesFilter || a.species === speciesFilter)
            .filter((a) => !a.species || ["gallina", "codorniz", "pato"].includes(a.species))
            .reduce((acc, a) => acc + Number(a.amount || 0), 0),
        0,
      )
    : 0;

  const eggProductionPoolCost = Math.max(layerDirectExpenses, layerAccruedFeedCost) + layerProratedShare;
  const costDenominatorEggs = netSaleableEggs > 0 ? netSaleableEggs : totalEggsCollected;
  const realCostPerEgg = costDenominatorEggs > 0 ? round2(eggProductionPoolCost / costDenominatorEggs) : 0;
  const realCostPerTray30 = round2(realCostPerEgg * 30);

  const filteredEggSaleItems = eggSaleRows.filter((s) => {
    if (speciesFilter && s.species !== speciesFilter) return false;
    if (locationIdFilter && s.locationId !== locationIdFilter) return false;
    if (batchIdFilter && s.batchId !== batchIdFilter) return false;
    return true;
  });
  const totalEggSoldQty = filteredEggSaleItems.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const totalEggSoldRev = filteredEggSaleItems.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
  const avgSalePricePerEgg = totalEggSoldQty > 0 ? round2(totalEggSoldRev / totalEggSoldQty) : 0;
  const eggBreakevenAlert = totalEggSoldQty > 0 && realCostPerEgg > 0 && avgSalePricePerEgg < realCostPerEgg;

  const caliberAgg = new Map<string, { code: string; label: string; quantitySold: number; revenue: number }>();
  for (const item of filteredEggSaleItems) {
    const info = classifyNtc1240Caliber(item.size);
    const prev = caliberAgg.get(info.code) || { code: info.code, label: info.label, quantitySold: 0, revenue: 0 };
    prev.quantitySold += Number(item.quantity || 0);
    prev.revenue += Number(item.totalAmount || 0);
    caliberAgg.set(info.code, prev);
  }
  const caliberMargins = Array.from(caliberAgg.values())
    .map((c) => {
      const avgPrice = c.quantitySold > 0 ? c.revenue / c.quantitySold : 0;
      const allocatedCost = c.quantitySold * realCostPerEgg;
      const grossMargin = c.revenue - allocatedCost;
      return {
        caliber: c.code,
        ntcLabel: c.label,
        quantitySold: c.quantitySold,
        revenue: round2(c.revenue),
        avgUnitPrice: round2(avgPrice),
        unitCost: realCostPerEgg,
        unitMargin: round2(avgPrice - realCostPerEgg),
        grossMargin: round2(grossMargin),
        marginPct: c.revenue > 0 ? round2((grossMargin / c.revenue) * 100) : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const filteredSlaughter = slaughterRows.filter((r) => {
    if (speciesFilter && r.species !== speciesFilter) return false;
    if (locationIdFilter && r.locationId !== locationIdFilter) return false;
    if (batchIdFilter && r.batchId !== batchIdFilter) return false;
    return true;
  });
  const totalCarcassKg = filteredSlaughter.reduce((s, r) => s + Number(r.weightKg || 0), 0);
  const totalLiveKg = filteredSlaughter.reduce(
    (s, r) => s + Number(r.liveWeightKg || Number(r.weightKg || 0) / 0.72),
    0,
  );

  let meatAccruedFeedCost = 0;
  for (const fc of feedConsumptions) {
    if (speciesFilter && fc.species !== speciesFilter) continue;
    if (locationIdFilter && fc.locationId !== locationIdFilter) continue;
    if (fc.species && ["pollo", "conejo", "cuy", "pato"].includes(fc.species)) {
      meatAccruedFeedCost += Number(fc.quantity || 0) * Number(fc.unitCost ?? fc.fallbackCost ?? 0);
    }
  }
  const meatDirectExpenses = txRows
    .filter(
      (t) =>
        t.type === "egreso" &&
        !(includeProrated && allocatedTxIds.has(t.id)) &&
        (!speciesFilter || t.species === speciesFilter) &&
        (!locationIdFilter || t.locationId === locationIdFilter) &&
        (!batchIdFilter || t.batchId === batchIdFilter) &&
        (isMeatRelatedTx(t) || (t.species && ["pollo", "conejo", "cuy"].includes(t.species))),
    )
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const meatProratedShare = includeProrated
    ? allocationRows.reduce(
        (s, r) =>
          s +
          (r.allocations || [])
            .filter((a) => !speciesFilter || a.species === speciesFilter)
            .filter((a) => a.species && ["pollo", "conejo", "cuy"].includes(a.species))
            .reduce((acc, a) => acc + Number(a.amount || 0), 0),
        0,
      )
    : 0;
  const meatPoolCost = Math.max(meatDirectExpenses, meatAccruedFeedCost) + meatProratedShare;
  const realCostPerLiveKg = totalLiveKg > 0 ? round2(meatPoolCost / totalLiveKg) : 0;
  const realCostPerCarcassKg = totalCarcassKg > 0 ? round2(meatPoolCost / totalCarcassKg) : 0;

  const filteredMeatSales = meatSaleRows.filter((m) => {
    if (speciesFilter && m.species !== speciesFilter) return false;
    if (locationIdFilter && m.locationId !== locationIdFilter) return false;
    if (batchIdFilter && m.batchId !== batchIdFilter) return false;
    return true;
  });
  const soldMeatKg = filteredMeatSales.reduce((s, m) => s + Number(m.quantityKg || 0), 0);
  const soldMeatRev = filteredMeatSales.reduce((s, m) => s + Number(m.totalAmount || 0), 0);
  const avgMeatSalePrice = soldMeatKg > 0 ? round2(soldMeatRev / soldMeatKg) : 0;
  const meatBreakevenAlert = soldMeatKg > 0 && realCostPerCarcassKg > 0 && avgMeatSalePrice < realCostPerCarcassKg;

  const totalAssetCapex = activeAssets
    .filter((a) => !locationIdFilter || a.locationId === locationIdFilter)
    .reduce((s, a) => s + Number(a.acquisitionCost || 0), 0);
  const netOperatingProfit = totalDirectRevenue - (totalDirectCost + totalProratedCost);
  const days = Math.max(
    1,
    Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000) + 1,
  );
  const monthlyProfit = (netOperatingProfit / days) * 30.4375;
  const annualizedProfit = (netOperatingProfit / days) * 365;
  const roiPercent = totalAssetCapex > 0 ? round2((annualizedProfit / totalAssetCapex) * 100) : null;
  const paybackMonths = totalAssetCapex > 0 && monthlyProfit > 0 ? round2(totalAssetCapex / monthlyProfit) : null;

  return {
    from,
    to,
    includeProrated,
    filters: { species: speciesFilter, locationId: locationIdFilter, batchId: batchIdFilter },
    totals: {
      directRevenue: round2(totalDirectRevenue),
      directCost: round2(totalDirectCost),
      proratedCost: round2(totalProratedCost),
      totalCost: round2(totalDirectCost + totalProratedCost),
      netProfit: round2(netOperatingProfit),
      unallocatedSharedCost: round2(unallocatedSharedCost),
    },
    bySpecies: formatRows(bySpeciesMap),
    byLocation: formatRows(byLocationMap),
    unitEconomics: {
      eggs: {
        totalEggsCollected,
        netSaleableEggs,
        soldEggs: totalEggSoldQty,
        poolCost: round2(eggProductionPoolCost),
        realCostPerEgg,
        realCostPerTray30,
        avgSalePricePerEgg,
        breakevenPricePerEgg: realCostPerEgg,
        marginPerTray30: avgSalePricePerEgg > 0 ? round2((avgSalePricePerEgg - realCostPerEgg) * 30) : null,
        breakevenAlert: eggBreakevenAlert,
      },
      caliberMargins,
      meat: {
        totalLiveKg: round2(totalLiveKg),
        totalCarcassKg: round2(totalCarcassKg),
        soldMeatKg: round2(soldMeatKg),
        poolCost: round2(meatPoolCost),
        realCostPerLiveKg,
        realCostPerCarcassKg,
        avgSalePricePerKg: avgMeatSalePrice,
        breakevenPricePerCarcassKg: realCostPerCarcassKg,
        breakevenAlert: meatBreakevenAlert,
      },
    },
    capexRoi: {
      totalAssetCapex: round2(totalAssetCapex),
      activeAssetsCount: activeAssets.length,
      monthlyProjectedProfit: round2(monthlyProfit),
      annualizedProfit: round2(annualizedProfit),
      roiPercent,
      paybackMonths,
    },
    proratedRulesCount: allocationRows.length,
  };
}
