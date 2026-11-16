import { NextResponse } from "next/server";
import { db } from "@/db";
import { feedInventory, feedMovements, transactions } from "@/db/schema";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { computeThreeLayerFinancials } from "@/lib/analytics/biological-valuation";
import {
  computeAssetsDepreciationSummary,
  computeFeedWarehouseValuation,
  evaluateBiologicalPortfolio,
  loadFarmBiologicalContext,
} from "@/lib/analytics/biological-db";
import { computeSupplyWarehouseValuation } from "@/lib/analytics/payroll-tax-supplies";
import { loadPeriodPayrollAndSupplies } from "@/lib/analytics/payroll-tax-supplies-db";

export const GET = withApiHandler(async () => {
  try {
    const hoy = new Date();
    const hace30Dias = new Date(hoy);
    hace30Dias.setDate(hoy.getDate() - 29);
    const hace30DiasStr = hace30Dias.toISOString().split("T")[0];
    const hoyStr = hoy.toISOString().split("T")[0];

    const [txRows, feedMovRows, bioCtx, payrollSuppliesCtx] = await Promise.all([
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
        .where(and(gte(transactions.date, hace30DiasStr), lte(transactions.date, hoyStr))),
      db
        .select({
          quantity: feedMovements.quantity,
          unitCost: feedMovements.unitCost,
          fallbackCost: feedInventory.costPerUnit,
        })
        .from(feedMovements)
        .innerJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
        .where(and(eq(feedMovements.isEntry, false), gte(feedMovements.date, hace30DiasStr), lte(feedMovements.date, hoyStr))),
      loadFarmBiologicalContext({ referenceDate: hoyStr }),
      loadPeriodPayrollAndSupplies({ from: hace30DiasStr, to: hoyStr }),
    ]);

    const ingresosMes = txRows
      .filter((t) => t.type === "ingreso")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const egresosMes = txRows
      .filter((t) => t.type === "egreso")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const balanceMes = ingresosMes - egresosMes;

    const accruedFeedCost = feedMovRows.reduce(
      (s, fc) => s + Number(fc.quantity || 0) * Number(fc.unitCost ?? fc.fallbackCost ?? 0),
      0,
    );
    const assetsSummary = computeAssetsDepreciationSummary(bioCtx.assets, {
      fromDate: hace30DiasStr,
      toDate: hoyStr,
    });
    const warehouseSummary = computeFeedWarehouseValuation(bioCtx.feedRows);
    const supplyWarehouseSummary = computeSupplyWarehouseValuation(bioCtx.supplyRows);
    const biologicalSummary = evaluateBiologicalPortfolio({
      flocks: bioCtx.flocks,
      broilerBatches: bioCtx.batches,
      locations: bioCtx.locations,
      marketPrices: bioCtx.marketOverrides,
      referenceDate: hoyStr,
    });
    const threeLayer = computeThreeLayerFinancials({
      transactions: txRows,
      accruedFeedConsumedCostCop: accruedFeedCost,
      hasFeedConsumptionRecords: feedMovRows.length > 0 && accruedFeedCost > 0,
      accruedSupplyConsumedCostCop: payrollSuppliesCtx.accruedSupplyCostCop,
      hasSupplyConsumptionRecords: payrollSuppliesCtx.hasSupplyConsumptionRecords,
      imputedOwnerLaborCop: payrollSuppliesCtx.imputedOwnerLaborCop,
      warehouseSupplyAssetCop: supplyWarehouseSummary.totalValueCop,
      assetsSummary,
      warehouseSummary,
      biologicalSummary,
    });

    return NextResponse.json({
      ingresosMes: Number(ingresosMes.toFixed(2)),
      egresosMes: Number(egresosMes.toFixed(2)),
      balanceMes: Number(balanceMes.toFixed(2)),
      totalTransacciones: txRows.length,
      operatingContext: {
        ...threeLayer,
        capexRecoveryPct: assetsSummary.capexRecoveryPct,
        lifecycleMode: biologicalSummary.lifecycleMode,
        lifecycleLabel: biologicalSummary.lifecycleLabel,
        lifecycleDescription: biologicalSummary.lifecycleDescription,
        alertsCount: biologicalSummary.alerts.length,
      },
    });
  } catch (error) {
    console.error("Error en resumen finanzas:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen financiero" },
      { status: 500 }
    );
  }
});
