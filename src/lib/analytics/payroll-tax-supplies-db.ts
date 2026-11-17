import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { payrollEntries, supplyInventory, supplyMovements } from "@/db/schema";
import { getTaxAndPayrollConfig } from "@/lib/settings";
import {
  computeTaxAndDeductionsSummary,
  round2,
  type TransactionTaxFieldsLike,
} from "@/lib/analytics/payroll-tax-supplies";

export interface SupplyConsumptionRow {
  species: string | null;
  locationId: string | null;
  quantity: string;
  unitCost: string | null;
  fallbackCost: string;
  movementType: string;
}

export async function loadPeriodPayrollAndSupplies(options: {
  from: string;
  to: string;
  farmId?: string | null;
  speciesFilter?: string | null;
  locationIdFilter?: string | null;
}) {
  const { from, to, farmId = null, speciesFilter = null, locationIdFilter = null } = options;

  const supplyConds = [
    eq(supplyMovements.isEntry, false),
    gte(supplyMovements.date, from),
    lte(supplyMovements.date, to),
  ];
  if (farmId) supplyConds.push(eq(supplyMovements.farmId, farmId));

  const payrollConds = [gte(payrollEntries.date, from), lte(payrollEntries.date, to)];
  if (farmId) payrollConds.push(eq(payrollEntries.farmId, farmId));

  const [rawSupplyMovs, rawPayroll, taxConfig] = await Promise.all([
    db
      .select({
        species: supplyMovements.species,
        locationId: supplyMovements.locationId,
        quantity: supplyMovements.quantity,
        unitCost: supplyMovements.unitCost,
        fallbackCost: supplyInventory.costPerUnit,
        movementType: supplyMovements.movementType,
      })
      .from(supplyMovements)
      .innerJoin(supplyInventory, eq(supplyMovements.supplyId, supplyInventory.id))
      .where(and(...supplyConds)),
    db.select().from(payrollEntries).where(and(...payrollConds)),
    getTaxAndPayrollConfig(),
  ]);

  const supplyConsumptions: SupplyConsumptionRow[] = rawSupplyMovs.filter((m) => {
    if (speciesFilter && m.species !== speciesFilter) return false;
    if (locationIdFilter && m.locationId !== locationIdFilter) return false;
    return true;
  });

  const accruedSupplyCostCop = round2(
    supplyConsumptions.reduce(
      (s, m) => s + Number(m.quantity || 0) * Number(m.unitCost ?? m.fallbackCost ?? 0),
      0,
    ),
  );
  const hasSupplyConsumptionRecords = supplyConsumptions.length > 0 && accruedSupplyCostCop > 0;

  const filteredPayroll = rawPayroll.filter((p) => {
    if (speciesFilter && p.species && p.species !== speciesFilter) return false;
    if (locationIdFilter && p.locationId && p.locationId !== locationIdFilter) return false;
    return true;
  });

  const imputedOwnerLaborCop = taxConfig.includeImputedOwnerLabor
    ? round2(
        filteredPayroll
          .filter((p) => p.accountingMode === "imputed_economic")
          .reduce((s, p) => s + Math.max(0, Number(p.totalEmployerCostCop || 0)), 0),
      )
    : 0;

  return {
    supplyConsumptions,
    accruedSupplyCostCop,
    hasSupplyConsumptionRecords,
    payrollEntries: filteredPayroll,
    imputedOwnerLaborCop,
    taxConfig,
    summarizeTaxes: (txRows: TransactionTaxFieldsLike[], cashOutflowsCop: number) =>
      computeTaxAndDeductionsSummary({
        transactions: txRows,
        payrollEntries: filteredPayroll,
        cashOutflowsCop,
        gmf4x1000Enabled: taxConfig.gmf4x1000Enabled,
        gmfRatePct: taxConfig.gmfRatePct,
        includeImputedOwnerLabor: taxConfig.includeImputedOwnerLabor,
      }),
  };
}
