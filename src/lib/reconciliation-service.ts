import { db } from "@/db";
import {
  autoconsumoLogs,
  eggProduction,
  eggProductionDetails,
  feedInventory,
  slaughter,
} from "@/db/schema";
import { computeEggInventory } from "@/lib/inventory";
import { normalizeFeedQuantityToKg } from "@/lib/feeding/inventory";

type ReconciliationReader = Pick<typeof db, "select">;

export interface FarmReconciliationReport {
  generatedAt: string;
  status: "clean" | "warnings" | "discrepancies";
  eggs: {
    recordsCount: number;
    totalCollected: number;
    broken: number;
    discarded: number;
    forIncubation: number;
    goodClassified: number;
    autoconsumed: number;
    explicitSaleable: number;
    legacyInferredSaleable: number;
    pendingDestination: number;
    headerVsDetailMismatches: number;
  };
  eggInventory: {
    saleableProduced: number;
    sold: number;
    lost: number;
    recordedLost: number;
    available: number;
    bookVsAvailableDelta: number;
    hasNegativeBalance: boolean;
  };
  autoconsumo: {
    totalLogsCount: number;
    missingEggAutoLogsCount: number;
    missingSlaughterAutoLogsCount: number;
    unvaluedLogsCount: number;
    potentialManualDuplicatesCount: number;
  };
  feed: {
    itemsCount: number;
    negativeStockFeedsCount: number;
    nonStandardUnitFeedsCount: number;
  };
}

/**
 * S0 / DAT-05: Servicio transversal de conciliación de solo lectura.
 * Verifica las ecuaciones de conservación entre producción, inventarios, autoconsumo
 * y bodega de alimento sin modificar ningún registro productivo.
 */
export async function runFarmReconciliationReport(
  client: ReconciliationReader = db,
): Promise<FarmReconciliationReport> {
  const [productions, details, eggInv, autoLogs, slaughters, feeds] = await Promise.all([
    client.select().from(eggProduction),
    client.select().from(eggProductionDetails),
    computeEggInventory(client),
    client.select().from(autoconsumoLogs),
    client.select().from(slaughter),
    client.select().from(feedInventory),
  ]);

  const detailsTotalByProd = new Map<string, number>();
  for (const d of details) {
    detailsTotalByProd.set(
      d.productionId,
      (detailsTotalByProd.get(d.productionId) || 0) + Math.max(0, Number(d.quantity) || 0),
    );
  }

  let totalCollected = 0;
  let broken = 0;
  let discarded = 0;
  let forIncubation = 0;
  let goodClassified = 0;
  let headerVsDetailMismatches = 0;

  for (const p of productions) {
    const collected = Number(p.totalCollected) || 0;
    const brk = Number(p.broken) || 0;
    const disc = Number(p.discarded) || 0;
    const inc = Number(p.forIncubation) || 0;
    const classified = detailsTotalByProd.get(p.id) || 0;

    totalCollected += collected;
    broken += brk;
    discarded += disc;
    forIncubation += inc;
    goodClassified += classified;

    if (collected - brk - disc - inc !== classified) {
      headerVsDetailMismatches += 1;
    }
  }

  const autoEggIds = new Set(
    autoLogs.map((l) => l.eggProductionId).filter((v): v is string => Boolean(v)),
  );
  const autoSlaughterIds = new Set(
    autoLogs.map((l) => l.slaughterId).filter((v): v is string => Boolean(v)),
  );

  let missingEggAutoLogsCount = 0;
  for (const p of productions) {
    if ((Number(p.quantityAutoconsumo) || 0) > 0 && !autoEggIds.has(p.id)) {
      missingEggAutoLogsCount += 1;
    }
  }

  let missingSlaughterAutoLogsCount = 0;
  for (const s of slaughters) {
    if (Number(s.weightKgAutoconsumo || 0) > 0 && !autoSlaughterIds.has(s.id)) {
      missingSlaughterAutoLogsCount += 1;
    }
  }

  let unvaluedLogsCount = 0;
  const autoKeys = new Set<string>();
  for (const log of autoLogs) {
    if (Number(log.marketReferencePrice || 0) <= 0) {
      unvaluedLogsCount += 1;
    }
    if (log.eggProductionId || log.slaughterId) {
      autoKeys.add(`${log.date}|${log.species}|${log.productType}`);
    }
  }

  let potentialManualDuplicatesCount = 0;
  for (const log of autoLogs) {
    if (!log.eggProductionId && !log.slaughterId) {
      const key = `${log.date}|${log.species}|${log.productType}`;
      if (autoKeys.has(key)) {
        potentialManualDuplicatesCount += 1;
      }
    }
  }

  let negativeStockFeedsCount = 0;
  let nonStandardUnitFeedsCount = 0;
  for (const f of feeds) {
    if (Number(f.currentStock) < 0) {
      negativeStockFeedsCount += 1;
    }
    if (!normalizeFeedQuantityToKg(f.currentStock, f.unit).isConvertible) {
      nonStandardUnitFeedsCount += 1;
    }
  }

  const expectedAvailable = Math.max(
    0,
    eggInv.summary.saleableProduced - eggInv.summary.sold - eggInv.summary.lost,
  );
  const bookVsAvailableDelta = Math.abs(eggInv.summary.available - expectedAvailable);
  const hasNegativeBalance =
    eggInv.summary.saleableProduced - eggInv.summary.sold - eggInv.summary.recordedLost < 0;

  const hasDiscrepancies =
    headerVsDetailMismatches > 0 ||
    bookVsAvailableDelta > 0 ||
    hasNegativeBalance ||
    missingEggAutoLogsCount > 0 ||
    missingSlaughterAutoLogsCount > 0 ||
    negativeStockFeedsCount > 0;

  const hasWarnings =
    eggInv.summary.pendingDestination > 0 ||
    eggInv.summary.legacyInferredSaleableProduced > 0 ||
    unvaluedLogsCount > 0 ||
    potentialManualDuplicatesCount > 0 ||
    nonStandardUnitFeedsCount > 0;

  return {
    generatedAt: new Date().toISOString(),
    status: hasDiscrepancies ? "discrepancies" : hasWarnings ? "warnings" : "clean",
    eggs: {
      recordsCount: productions.length,
      totalCollected,
      broken,
      discarded,
      forIncubation,
      goodClassified,
      autoconsumed: eggInv.summary.autoconsumed,
      explicitSaleable: eggInv.summary.explicitSaleableProduced,
      legacyInferredSaleable: eggInv.summary.legacyInferredSaleableProduced,
      pendingDestination: eggInv.summary.pendingDestination,
      headerVsDetailMismatches,
    },
    eggInventory: {
      saleableProduced: eggInv.summary.saleableProduced,
      sold: eggInv.summary.sold,
      lost: eggInv.summary.lost,
      recordedLost: eggInv.summary.recordedLost,
      available: eggInv.summary.available,
      bookVsAvailableDelta,
      hasNegativeBalance,
    },
    autoconsumo: {
      totalLogsCount: autoLogs.length,
      missingEggAutoLogsCount,
      missingSlaughterAutoLogsCount,
      unvaluedLogsCount,
      potentialManualDuplicatesCount,
    },
    feed: {
      itemsCount: feeds.length,
      negativeStockFeedsCount,
      nonStandardUnitFeedsCount,
    },
  };
}
