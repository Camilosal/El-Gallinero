import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classifyTransactionNature,
  computeAssetsDepreciationSummary,
  computeFeedWarehouseValuation,
  computeThreeLayerFinancials,
  evaluateBiologicalPortfolio,
} from "@/lib/analytics/biological-valuation";
import {
  computePayrollLiquidation,
  computeSupplyWarehouseValuation,
  computeTaxAndDeductionsSummary,
  computeTransactionTaxBreakdown,
  computeWeightedAverageUnitCost,
  resolveTransactionTaxValues,
} from "@/lib/analytics/payroll-tax-supplies";

describe("Personal, trabajo propio, impuestos/deducciones y devengo de insumos", () => {
  it("calcula IVA, ReteFuente, ICA y neto pagado/cobrado en transacciones", () => {
    const grossMode = computeTransactionTaxBreakdown({
      amount: 119000,
      inputMode: "gross",
      ivaRate: 19,
      reteFuenteRate: 2.5,
      icaRate: 0.4,
      otherDeductionsAmount: 1000,
    });
    expect(grossMode.subtotalAmount).toBe(100000);
    expect(grossMode.ivaAmount).toBe(19000);
    expect(grossMode.reteFuenteAmount).toBe(2500);
    expect(grossMode.icaAmount).toBe(400);
    expect(grossMode.totalDeductionsAmount).toBe(3900);
    expect(grossMode.netSettlementAmount).toBe(115100);

    const subtotalMode = computeTransactionTaxBreakdown({
      amount: 200000,
      inputMode: "subtotal",
      ivaRate: 5,
      reteFuenteRate: 1.5,
      icaRate: 0,
      otherDeductionsAmount: 0,
    });
    expect(subtotalMode.subtotalAmount).toBe(200000);
    expect(subtotalMode.ivaAmount).toBe(10000);
    expect(subtotalMode.grossAmount).toBe(210000);
    expect(subtotalMode.reteFuenteAmount).toBe(3000);
    expect(subtotalMode.netSettlementAmount).toBe(207000);

    const legacy = resolveTransactionTaxValues({ type: "egreso", amount: "85000" });
    expect(legacy.subtotalAmount).toBe(85000);
    expect(legacy.ivaAmount).toBe(0);
    expect(legacy.netSettlementAmount).toBe(85000);
  });

  it("liquida jornal propio (Pequeño) y nómina formal con seguridad social/deducciones (Mediano)", () => {
    const smallProducerDay = computePayrollLiquidation({
      unitsWorked: 5,
      unitRateCop: 50000,
      applySocialSecurity: false,
    });
    expect(smallProducerDay.grossPayCop).toBe(250000);
    expect(smallProducerDay.employerBurdenCop).toBe(0);
    expect(smallProducerDay.workerDeductionsCop).toBe(0);
    expect(smallProducerDay.netPayableCop).toBe(250000);
    expect(smallProducerDay.totalEmployerCostCop).toBe(250000);

    const mediumWorkerMonth = computePayrollLiquidation({
      unitsWorked: 1,
      unitRateCop: 1423500,
      bonusesCop: 200000,
      applySocialSecurity: true,
      employerBurdenPct: 29.52,
      workerDeductionPct: 8,
      reteFuenteRatePct: 0,
    });
    expect(mediumWorkerMonth.grossPayCop).toBe(1623500);
    expect(mediumWorkerMonth.employerBurdenCop).toBeCloseTo(479257.2, 1);
    expect(mediumWorkerMonth.workerDeductionsCop).toBeCloseTo(129880, 1);
    expect(mediumWorkerMonth.netPayableCop).toBeCloseTo(1493620, 1);
    expect(mediumWorkerMonth.totalEmployerCostCop).toBeCloseTo(2102757.2, 1);
  });

  it("devenga consumo de insumos e incluye trabajo propio del productor sin alterar flujo de caja", () => {
    expect(classifyTransactionNature({ type: "egreso", category: "Compra de insumos", amount: 300000 })).toBe(
      "supply_inventory_purchase",
    );

    const avgSupplyCost = computeWeightedAverageUnitCost(10, 12000, 10, 14000);
    expect(avgSupplyCost).toBe(13000);

    const supplyWarehouse = computeSupplyWarehouseValuation([
      {
        id: "sup-1",
        name: "Desinfectante amonio",
        category: "desinfectante",
        unit: "litros",
        currentStock: "15",
        minStock: "3",
        costPerUnit: "13000",
      },
    ]);
    expect(supplyWarehouse.totalValueCop).toBe(195000);

    const assetsSummary = computeAssetsDepreciationSummary([], { fromDate: "2026-11-01", toDate: "2026-11-30" });
    const warehouseFeed = computeFeedWarehouseValuation([]);
    const bioSummary = evaluateBiologicalPortfolio({ flocks: [], broilerBatches: [], referenceDate: "2026-11-30" });

    const threeLayer = computeThreeLayerFinancials({
      transactions: [
        { type: "ingreso", category: "Venta de huevos", amount: 900000 },
        { type: "egreso", category: "Compra de insumos", amount: 300000 },
      ],
      accruedFeedConsumedCostCop: 0,
      hasFeedConsumptionRecords: false,
      accruedSupplyConsumedCostCop: 65000,
      hasSupplyConsumptionRecords: true,
      imputedOwnerLaborCop: 250000,
      warehouseSupplyAssetCop: supplyWarehouse.totalValueCop,
      assetsSummary,
      warehouseSummary: warehouseFeed,
      biologicalSummary: bioSummary,
    });

    // Caja real sigue siendo 900k - 300k = +600k (no inventa salida de caja por trabajo propio no retirado)
    expect(threeLayer.cashNetFlowCop).toBe(600000);
    // Resultado operativo devengado carga consumo real de insumos (65k) + trabajo propio valorado (250k) = 315k
    expect(threeLayer.accruedSupplyCostCop).toBe(65000);
    expect(threeLayer.imputedOwnerLaborCop).toBe(250000);
    expect(threeLayer.accruedOperatingExpenseCop).toBe(315000);
    expect(threeLayer.operatingNetProfitCop).toBe(585000);
    // Bodega de insumos forma parte del patrimonio productivo
    expect(threeLayer.warehouseSupplyAssetCop).toBe(195000);
    expect(threeLayer.totalProductiveWealthCop).toBe(195000);
  });

  it("consolida resumen de IVA, ReteFuente, ICA, deducciones de nómina y GMF 4x1000", () => {
    const summary = computeTaxAndDeductionsSummary({
      transactions: [
        { type: "ingreso", amount: 1190000, subtotalAmount: 1000000, ivaAmount: 190000, reteFuenteAmount: 15000, icaAmount: 4000 },
        { type: "egreso", amount: 595000, subtotalAmount: 500000, ivaAmount: 95000, reteFuenteAmount: 12500, icaAmount: 2000, otherDeductionsAmount: 1000 },
      ],
      payrollEntries: [
        {
          accountingMode: "cash_expense",
          grossPayCop: 1500000,
          employerBurdenCop: 442800,
          workerDeductionsCop: 120000,
          reteFuenteCop: 0,
          netPayableCop: 1380000,
          totalEmployerCostCop: 1942800,
        },
        {
          accountingMode: "imputed_economic",
          grossPayCop: 250000,
          employerBurdenCop: 0,
          workerDeductionsCop: 0,
          reteFuenteCop: 0,
          netPayableCop: 250000,
          totalEmployerCostCop: 250000,
        },
      ],
      cashOutflowsCop: 2537800,
      gmf4x1000Enabled: true,
      includeImputedOwnerLabor: true,
    });

    expect(summary.ivaGeneradoCop).toBe(190000);
    expect(summary.ivaDescontableCop).toBe(95000);
    expect(summary.ivaSaldoEstimadoCop).toBe(95000);
    expect(summary.reteFuenteSufridaCop).toBe(15000);
    expect(summary.reteFuentePracticadaCop).toBe(12500);
    expect(summary.icaTotalCop).toBe(6000);
    expect(summary.payrollEmployerBurdenCop).toBe(442800);
    expect(summary.payrollWorkerDeductionsCop).toBe(120000);
    expect(summary.paidPayrollCostCop).toBe(1942800);
    expect(summary.imputedOwnerLaborCop).toBe(250000);
    expect(summary.gmf4x1000EstimatedCop).toBeCloseTo(10151.2, 1);
  });

  it("mantiene tablas nuevas aisladas con RLS y columnas tributarias en PostgreSQL", async () => {
    const colRes = await db.execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'transactions'
        AND column_name IN ('subtotal_amount', 'iva_amount', 'rete_fuente_amount', 'ica_amount', 'net_settlement_amount')
    `);
    const colNames = colRes.rows.map((r) => r.column_name).sort();
    expect(colNames).toEqual([
      "ica_amount",
      "iva_amount",
      "net_settlement_amount",
      "rete_fuente_amount",
      "subtotal_amount",
    ]);

    const tblRes = await db.execute<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(sql`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('staff_profiles', 'payroll_entries')
    `);
    expect(tblRes.rows).toHaveLength(2);
    for (const row of tblRes.rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });
});
