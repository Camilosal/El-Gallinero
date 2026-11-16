export function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/**
 * Calcula costo unitario promedio ponderado al ingresar nueva compra al inventario
 * (compartido por alimentos e insumos).
 */
export function computeWeightedAverageUnitCost(
  currentStock: number,
  currentCostPerUnit: number,
  addedQty: number,
  addedUnitPrice: number,
): number {
  const safeOldQty = Math.max(0, Number.isFinite(currentStock) ? currentStock : 0);
  const safeOldCost = Math.max(0, Number.isFinite(currentCostPerUnit) ? currentCostPerUnit : 0);
  const safeAddedQty = Math.max(0, Number.isFinite(addedQty) ? addedQty : 0);
  const safeAddedPrice = Math.max(0, Number.isFinite(addedUnitPrice) ? addedUnitPrice : 0);
  const totalQty = safeOldQty + safeAddedQty;
  if (totalQty <= 0) return safeAddedPrice > 0 ? round2(safeAddedPrice) : round2(safeOldCost);
  const totalValue = safeOldQty * safeOldCost + safeAddedQty * safeAddedPrice;
  return round2(totalValue / totalQty);
}

export interface TransactionTaxInput {
  amount: number;
  inputMode?: "gross" | "subtotal";
  ivaRate?: number | null;
  reteFuenteRate?: number | null;
  icaRate?: number | null;
  otherDeductionsAmount?: number | null;
}

export interface TransactionTaxBreakdown {
  subtotalAmount: number;
  ivaRate: number;
  ivaAmount: number;
  grossAmount: number;
  reteFuenteRate: number;
  reteFuenteAmount: number;
  icaRate: number;
  icaAmount: number;
  otherDeductionsAmount: number;
  totalDeductionsAmount: number;
  netSettlementAmount: number;
}

/**
 * Descompone una transacción (ingreso o egreso) en base gravable, IVA, retenciones/ICA
 * y valor neto efectivamente cobrado o pagado.
 */
export function computeTransactionTaxBreakdown(input: TransactionTaxInput): TransactionTaxBreakdown {
  const baseInput = Math.max(0, Number(input.amount || 0));
  const ivaRate = Math.max(0, Number(input.ivaRate || 0));
  const reteFuenteRate = Math.max(0, Number(input.reteFuenteRate || 0));
  const icaRate = Math.max(0, Number(input.icaRate || 0));
  const otherDeductionsAmount = round2(Math.max(0, Number(input.otherDeductionsAmount || 0)));

  let subtotalAmount: number;
  let ivaAmount: number;
  let grossAmount: number;

  if (input.inputMode === "subtotal") {
    subtotalAmount = round2(baseInput);
    ivaAmount = round2((subtotalAmount * ivaRate) / 100);
    grossAmount = round2(subtotalAmount + ivaAmount);
  } else {
    grossAmount = round2(baseInput);
    subtotalAmount = ivaRate > 0 ? round2(grossAmount / (1 + ivaRate / 100)) : grossAmount;
    ivaAmount = round2(grossAmount - subtotalAmount);
  }

  const reteFuenteAmount = round2((subtotalAmount * reteFuenteRate) / 100);
  const icaAmount = round2((subtotalAmount * icaRate) / 100);
  const totalDeductionsAmount = round2(reteFuenteAmount + icaAmount + otherDeductionsAmount);
  const netSettlementAmount = round2(Math.max(0, grossAmount - totalDeductionsAmount));

  return {
    subtotalAmount,
    ivaRate: round2(ivaRate),
    ivaAmount,
    grossAmount,
    reteFuenteRate: round2(reteFuenteRate),
    reteFuenteAmount,
    icaRate: round2(icaRate),
    icaAmount,
    otherDeductionsAmount,
    totalDeductionsAmount,
    netSettlementAmount,
  };
}

export interface TransactionTaxFieldsLike {
  type: string;
  amount: string | number;
  subtotalAmount?: string | number | null;
  ivaRate?: string | number | null;
  ivaAmount?: string | number | null;
  reteFuenteRate?: string | number | null;
  reteFuenteAmount?: string | number | null;
  icaRate?: string | number | null;
  icaAmount?: string | number | null;
  otherDeductionsAmount?: string | number | null;
  netSettlementAmount?: string | number | null;
}

export function resolveTransactionTaxValues(tx: TransactionTaxFieldsLike): TransactionTaxBreakdown {
  const grossAmount = round2(Math.max(0, Number(tx.amount || 0)));
  const ivaRate = round2(Math.max(0, Number(tx.ivaRate || 0)));
  const ivaAmount =
    tx.ivaAmount !== null && tx.ivaAmount !== undefined
      ? round2(Math.max(0, Number(tx.ivaAmount)))
      : ivaRate > 0
        ? round2(grossAmount - grossAmount / (1 + ivaRate / 100))
        : 0;
  const subtotalAmount =
    tx.subtotalAmount !== null && tx.subtotalAmount !== undefined
      ? round2(Math.max(0, Number(tx.subtotalAmount)))
      : round2(Math.max(0, grossAmount - ivaAmount));
  const reteFuenteRate = round2(Math.max(0, Number(tx.reteFuenteRate || 0)));
  const reteFuenteAmount =
    tx.reteFuenteAmount !== null && tx.reteFuenteAmount !== undefined
      ? round2(Math.max(0, Number(tx.reteFuenteAmount)))
      : round2((subtotalAmount * reteFuenteRate) / 100);
  const icaRate = round2(Math.max(0, Number(tx.icaRate || 0)));
  const icaAmount =
    tx.icaAmount !== null && tx.icaAmount !== undefined
      ? round2(Math.max(0, Number(tx.icaAmount)))
      : round2((subtotalAmount * icaRate) / 100);
  const otherDeductionsAmount = round2(Math.max(0, Number(tx.otherDeductionsAmount || 0)));
  const totalDeductionsAmount = round2(reteFuenteAmount + icaAmount + otherDeductionsAmount);
  const netSettlementAmount =
    tx.netSettlementAmount !== null && tx.netSettlementAmount !== undefined
      ? round2(Math.max(0, Number(tx.netSettlementAmount)))
      : round2(Math.max(0, grossAmount - totalDeductionsAmount));

  return {
    subtotalAmount,
    ivaRate,
    ivaAmount,
    grossAmount,
    reteFuenteRate,
    reteFuenteAmount,
    icaRate,
    icaAmount,
    otherDeductionsAmount,
    totalDeductionsAmount,
    netSettlementAmount,
  };
}

export interface PayrollLiquidationInput {
  unitsWorked: number;
  unitRateCop: number;
  bonusesCop?: number;
  applySocialSecurity?: boolean;
  employerBurdenPct?: number;
  workerDeductionPct?: number;
  reteFuenteRatePct?: number;
  reteFuenteFixedCop?: number | null;
}

export interface PayrollLiquidationResult {
  grossPayCop: number;
  bonusesCop: number;
  employerBurdenCop: number;
  workerDeductionsCop: number;
  reteFuenteCop: number;
  netPayableCop: number;
  totalEmployerCostCop: number;
}

/**
 * Liquida jornal, salario o trabajo propio calculando aportes del empleador,
 * deducciones al trabajador (salud/pensión/retención), neto a pagar y costo económico total.
 */
export function computePayrollLiquidation(input: PayrollLiquidationInput): PayrollLiquidationResult {
  const units = Math.max(0, Number(input.unitsWorked || 0));
  const rate = Math.max(0, Number(input.unitRateCop || 0));
  const bonuses = Math.max(0, Number(input.bonusesCop || 0));
  const grossPayCop = round2(units * rate + bonuses);

  const applySs = Boolean(input.applySocialSecurity);
  const empPct = applySs ? Math.max(0, Number(input.employerBurdenPct || 0)) : 0;
  const wrkPct = applySs ? Math.max(0, Number(input.workerDeductionPct || 0)) : 0;

  const employerBurdenCop = round2((grossPayCop * empPct) / 100);
  const workerDeductionsCop = round2((grossPayCop * wrkPct) / 100);
  const reteFuenteCop =
    input.reteFuenteFixedCop !== null && input.reteFuenteFixedCop !== undefined
      ? round2(Math.max(0, Number(input.reteFuenteFixedCop)))
      : round2((grossPayCop * Math.max(0, Number(input.reteFuenteRatePct || 0))) / 100);

  const netPayableCop = round2(Math.max(0, grossPayCop - workerDeductionsCop - reteFuenteCop));
  const totalEmployerCostCop = round2(grossPayCop + employerBurdenCop);

  return {
    grossPayCop,
    bonusesCop: round2(bonuses),
    employerBurdenCop,
    workerDeductionsCop,
    reteFuenteCop,
    netPayableCop,
    totalEmployerCostCop,
  };
}

export interface SupplyWarehouseLike {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: string | number;
  minStock?: string | number | null;
  costPerUnit: string | number;
}

export interface SupplyWarehouseSummary {
  totalValueCop: number;
  itemsCount: number;
  lowStockCount: number;
  items: {
    id: string;
    name: string;
    category: string;
    unit: string;
    currentStock: number;
    unitCostCop: number;
    valueCop: number;
    belowReorder: boolean;
  }[];
}

export function computeSupplyWarehouseValuation(rows: SupplyWarehouseLike[]): SupplyWarehouseSummary {
  let totalValueCop = 0;
  let lowStockCount = 0;

  const items = rows.map((row) => {
    const currentStock = Math.max(0, Number(row.currentStock || 0));
    const unitCostCop = Math.max(0, Number(row.costPerUnit || 0));
    const minStock = Math.max(0, Number(row.minStock || 0));
    const valueCop = round2(currentStock * unitCostCop);
    const belowReorder = minStock > 0 && currentStock <= minStock;
    if (belowReorder) lowStockCount += 1;
    totalValueCop += valueCop;
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      unit: row.unit,
      currentStock: round2(currentStock),
      unitCostCop: round2(unitCostCop),
      valueCop,
      belowReorder,
    };
  });

  return {
    totalValueCop: round2(totalValueCop),
    itemsCount: items.length,
    lowStockCount,
    items,
  };
}

export interface PayrollEntrySummaryInput {
  accountingMode: string;
  grossPayCop: string | number;
  employerBurdenCop: string | number;
  workerDeductionsCop: string | number;
  reteFuenteCop: string | number;
  netPayableCop: string | number;
  totalEmployerCostCop: string | number;
}

export interface TaxAndDeductionsPeriodSummary {
  ivaGeneradoCop: number;
  ivaDescontableCop: number;
  ivaSaldoEstimadoCop: number;
  reteFuentePracticadaCop: number;
  reteFuenteSufridaCop: number;
  icaTotalCop: number;
  otherDeductionsCop: number;
  payrollGrossCop: number;
  payrollEmployerBurdenCop: number;
  payrollWorkerDeductionsCop: number;
  payrollReteFuenteCop: number;
  payrollTotalEconomicCop: number;
  paidPayrollCostCop: number;
  imputedOwnerLaborCop: number;
  gmf4x1000EstimatedCop: number;
  gmf4x1000Enabled: boolean;
  totalTaxesAndWithholdingsCop: number;
}

export function computeTaxAndDeductionsSummary(input: {
  transactions: TransactionTaxFieldsLike[];
  payrollEntries: PayrollEntrySummaryInput[];
  cashOutflowsCop: number;
  gmf4x1000Enabled: boolean;
  includeImputedOwnerLabor?: boolean;
}): TaxAndDeductionsPeriodSummary {
  let ivaGeneradoCop = 0;
  let ivaDescontableCop = 0;
  let reteFuentePracticadaCop = 0;
  let reteFuenteSufridaCop = 0;
  let icaTotalCop = 0;
  let otherDeductionsCop = 0;

  for (const tx of input.transactions) {
    const t = resolveTransactionTaxValues(tx);
    if (tx.type === "ingreso") {
      ivaGeneradoCop += t.ivaAmount;
      reteFuenteSufridaCop += t.reteFuenteAmount;
    } else {
      ivaDescontableCop += t.ivaAmount;
      reteFuentePracticadaCop += t.reteFuenteAmount;
    }
    icaTotalCop += t.icaAmount;
    otherDeductionsCop += t.otherDeductionsAmount;
  }

  let payrollGrossCop = 0;
  let payrollEmployerBurdenCop = 0;
  let payrollWorkerDeductionsCop = 0;
  let payrollReteFuenteCop = 0;
  let paidPayrollCostCop = 0;
  let imputedOwnerLaborCop = 0;

  for (const p of input.payrollEntries) {
    const gross = Math.max(0, Number(p.grossPayCop || 0));
    const empBurden = Math.max(0, Number(p.employerBurdenCop || 0));
    const wrkDed = Math.max(0, Number(p.workerDeductionsCop || 0));
    const rete = Math.max(0, Number(p.reteFuenteCop || 0));
    const totalCost = Math.max(0, Number(p.totalEmployerCostCop || 0));

    payrollGrossCop += gross;
    payrollEmployerBurdenCop += empBurden;
    payrollWorkerDeductionsCop += wrkDed;
    payrollReteFuenteCop += rete;

    if (p.accountingMode === "imputed_economic") {
      if (input.includeImputedOwnerLabor !== false) {
        imputedOwnerLaborCop += totalCost;
      }
    } else {
      paidPayrollCostCop += totalCost;
    }
  }

  const gmf4x1000EstimatedCop = input.gmf4x1000Enabled
    ? round2(Math.max(0, input.cashOutflowsCop) * 0.004)
    : 0;

  const ivaSaldoEstimadoCop = round2(ivaGeneradoCop - ivaDescontableCop);
  const totalRetePracticada = round2(reteFuentePracticadaCop + payrollReteFuenteCop);
  const totalTaxesAndWithholdingsCop = round2(
    Math.max(0, ivaSaldoEstimadoCop) +
      totalRetePracticada +
      icaTotalCop +
      payrollEmployerBurdenCop +
      payrollWorkerDeductionsCop +
      otherDeductionsCop +
      gmf4x1000EstimatedCop,
  );

  return {
    ivaGeneradoCop: round2(ivaGeneradoCop),
    ivaDescontableCop: round2(ivaDescontableCop),
    ivaSaldoEstimadoCop,
    reteFuentePracticadaCop: totalRetePracticada,
    reteFuenteSufridaCop: round2(reteFuenteSufridaCop),
    icaTotalCop: round2(icaTotalCop),
    otherDeductionsCop: round2(otherDeductionsCop),
    payrollGrossCop: round2(payrollGrossCop),
    payrollEmployerBurdenCop: round2(payrollEmployerBurdenCop),
    payrollWorkerDeductionsCop: round2(payrollWorkerDeductionsCop),
    payrollReteFuenteCop: round2(payrollReteFuenteCop),
    payrollTotalEconomicCop: round2(paidPayrollCostCop + imputedOwnerLaborCop),
    paidPayrollCostCop: round2(paidPayrollCostCop),
    imputedOwnerLaborCop: round2(imputedOwnerLaborCop),
    gmf4x1000EstimatedCop,
    gmf4x1000Enabled: Boolean(input.gmf4x1000Enabled),
    totalTaxesAndWithholdingsCop,
  };
}
