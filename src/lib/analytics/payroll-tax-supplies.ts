import { resolveExpenseClassification } from "@/lib/finance/standard-expense-catalog";

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

export function computeUnitCostAfterRemovingStockEntry(
  currentStock: number,
  currentCostPerUnit: number,
  removedQuantity: number,
  removedUnitCost: number,
): number {
  const stock = Math.max(0, Number.isFinite(currentStock) ? currentStock : 0);
  const averageCost = Math.max(0, Number.isFinite(currentCostPerUnit) ? currentCostPerUnit : 0);
  const quantity = Math.max(0, Number.isFinite(removedQuantity) ? removedQuantity : 0);
  const entryCost = Math.max(0, Number.isFinite(removedUnitCost) ? removedUnitCost : 0);
  const remainingStock = Math.max(0, stock - quantity);
  if (remainingStock <= 0 || stock <= 0) return round2(averageCost);
  return round2(Math.max(0, (stock * averageCost - quantity * entryCost) / remainingStock));
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

export interface TransactionTaxColumns {
  subtotalAmount: string | null;
  ivaRate: string | null;
  ivaAmount: string | null;
  reteFuenteRate: string | null;
  reteFuenteAmount: string | null;
  icaRate: string | null;
  icaAmount: string | null;
  otherDeductionsAmount: string | null;
  netSettlementAmount: string | null;
  taxNotes: string | null;
}

/** Normalizes optional tax fields for storage on a transaction row. */
export function resolveTransactionTaxColumns(
  body: Record<string, unknown>,
  rawAmount: string | number,
  forceSnapshot = false,
) {
  const numeric = (key: string) => {
    const raw = body[key];
    if (raw === undefined || raw === null || raw === "") return 0;
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  };
  const ivaRate = numeric("ivaRate");
  const reteFuenteRate = numeric("reteFuenteRate");
  const icaRate = numeric("icaRate");
  const otherDeductionsAmount = numeric("otherDeductionsAmount");
  const taxNotes = typeof body.taxNotes === "string" ? body.taxNotes.trim() : "";
  const hasExplicitTaxes = forceSnapshot || ivaRate > 0 || reteFuenteRate > 0 || icaRate > 0 || otherDeductionsAmount > 0 || Boolean(taxNotes);
  const breakdown = computeTransactionTaxBreakdown({
    amount: Number(rawAmount),
    inputMode: body.taxInputMode === "subtotal" ? "subtotal" : "gross",
    ivaRate,
    reteFuenteRate,
    icaRate,
    otherDeductionsAmount,
  });

  const emptyColumns: TransactionTaxColumns = {
    subtotalAmount: null,
    ivaRate: null,
    ivaAmount: null,
    reteFuenteRate: null,
    reteFuenteAmount: null,
    icaRate: null,
    icaAmount: null,
    otherDeductionsAmount: null,
    netSettlementAmount: null,
    taxNotes: null,
  };
  const columns: TransactionTaxColumns = hasExplicitTaxes
    ? {
        subtotalAmount: breakdown.subtotalAmount.toFixed(2),
        ivaRate: breakdown.ivaRate.toFixed(2),
        ivaAmount: breakdown.ivaAmount.toFixed(2),
        reteFuenteRate: breakdown.reteFuenteRate.toFixed(2),
        reteFuenteAmount: breakdown.reteFuenteAmount.toFixed(2),
        icaRate: breakdown.icaRate.toFixed(2),
        icaAmount: breakdown.icaAmount.toFixed(2),
        otherDeductionsAmount: breakdown.otherDeductionsAmount.toFixed(2),
        netSettlementAmount: breakdown.netSettlementAmount.toFixed(2),
        taxNotes: taxNotes || null,
      }
    : emptyColumns;

  return {
    amount: breakdown.grossAmount.toFixed(2),
    netSettlementAmountNum: breakdown.netSettlementAmount,
    columns,
  };
}

export type ManagedTaxProfile = "agro" | "purchases" | "services" | "general" | "none";

export interface ManagedTaxConfig {
  uvtCop: number;
  ivaDefaultPct: number;
  ivaAgroPct: number;
  reteAgroPct: number;
  reteComprasPct: number;
  reteServiciosPct: number;
  icaDefaultPct: number;
  reteComprasThresholdUvt: number;
  reteAgroThresholdUvt: number;
}

export interface PreviousTransactionTaxValues {
  ivaRate?: string | number | null;
  reteFuenteRate?: string | number | null;
  icaRate?: string | number | null;
  otherDeductionsAmount?: string | number | null;
  taxNotes?: string | null;
}

export function inferManagedTaxProfile(
  type: unknown,
  category: unknown,
  standardCatalogId?: string | null,
  expenseFamily?: string | null,
): ManagedTaxProfile {
  const normalizedType = String(type || "egreso").toLowerCase();
  const normalizedCategory = String(category || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/(nomina|mano de obra|jornal|retiro|aporte|prestamo|credito|transferencia|impuesto|gmf|pago a personal)/.test(normalizedCategory)) {
    return "none";
  }
  if (normalizedType === "ingreso") {
    if (/(venta|huevo|ave|pollo|gallina|carne|gallinaza|abono|subproducto|producto agro)/.test(normalizedCategory)) return "agro";
    return "general";
  }
  if (standardCatalogId || expenseFamily) {
    const resolved = resolveExpenseClassification({
      type: "egreso",
      category: typeof category === "string" ? category : null,
      expenseCatalogId: standardCatalogId ?? null,
      expenseFamily: expenseFamily ?? null,
    });
    if (resolved.isStandardMatched) {
      return resolved.taxProfile;
    }
  }
  if (/(servicio|honorario|mantenimiento|veterin|asesoria|consultoria|reparacion)/.test(normalizedCategory)) return "services";
  return "purchases";
}

/** Applies the current master rates to a new operation and snapshots them on its transaction row. */
export function resolveManagedTransactionTaxColumns(
  body: Record<string, unknown>,
  rawAmount: string | number,
  config: ManagedTaxConfig,
  profile: ManagedTaxProfile,
  previous?: PreviousTransactionTaxValues | null,
) {
  let rates: { ivaRate: number; reteFuenteRate: number; icaRate: number };
  let forceSnapshot = true;

  if (previous) {
    const hasPreviousSnapshot = [previous.ivaRate, previous.reteFuenteRate, previous.icaRate]
      .some((value) => value !== null && value !== undefined && value !== "");
    rates = {
      ivaRate: hasPreviousSnapshot ? Number(previous.ivaRate || 0) : 0,
      reteFuenteRate: hasPreviousSnapshot ? Number(previous.reteFuenteRate || 0) : 0,
      icaRate: hasPreviousSnapshot ? Number(previous.icaRate || 0) : 0,
    };
    forceSnapshot = hasPreviousSnapshot;
  } else if (profile === "none") {
    rates = { ivaRate: 0, reteFuenteRate: 0, icaRate: 0 };
  } else {
    const amount = Math.max(0, Number(rawAmount) || 0);
    const agroMinimum = Math.max(0, config.uvtCop * config.reteAgroThresholdUvt);
    const purchaseMinimum = Math.max(0, config.uvtCop * config.reteComprasThresholdUvt);
    rates = {
      ivaRate: profile === "agro" ? config.ivaAgroPct : config.ivaDefaultPct,
      reteFuenteRate:
        profile === "agro" && amount >= agroMinimum
          ? config.reteAgroPct
          : profile === "purchases" && amount >= purchaseMinimum
            ? config.reteComprasPct
            : profile === "services"
              ? config.reteServiciosPct
              : 0,
      icaRate: config.icaDefaultPct,
    };
  }

  const safeBody = {
    ...body,
    taxInputMode: "gross",
    ivaRate: rates.ivaRate,
    reteFuenteRate: rates.reteFuenteRate,
    icaRate: rates.icaRate,
    otherDeductionsAmount:
      body.otherDeductionsAmount !== undefined
        ? body.otherDeductionsAmount
        : previous?.otherDeductionsAmount,
    taxNotes: body.taxNotes !== undefined ? body.taxNotes : previous?.taxNotes,
  };
  return resolveTransactionTaxColumns(safeBody, rawAmount, forceSnapshot);
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
  transportAllowanceCop?: number;
  applySocialSecurity?: boolean;
  employerBurdenPct?: number;
  workerDeductionPct?: number;
  reteFuenteRatePct?: number;
  reteFuenteFixedCop?: number | null;
}

export interface PayrollLiquidationResult {
  grossPayCop: number;
  bonusesCop: number;
  transportAllowanceCop: number;
  employerBurdenCop: number;
  workerDeductionsCop: number;
  reteFuenteCop: number;
  netPayableCop: number;
  totalEmployerCostCop: number;
}

export interface TransportAllowanceCalculationInput {
  eligible: boolean;
  workerKind: string;
  contractType: string;
  payPeriod: string;
  unitsWorked: number;
  unitRateCop: number;
  smlmvCop: number;
  allowanceMonthlyCop: number;
  maximumMonthlySmlmv: number;
  daysPerMonth: number;
  hoursPerDay: number;
  weeksPerMonth: number;
  quincenasPerMonth: number;
}

/** Calculates the configured allowance for eligible staff and snapshots only the amount for this period. */
export function calculateTransportAllowanceCop(input: TransportAllowanceCalculationInput): number {
  if (
    !input.eligible ||
    input.workerKind !== "apoyo" ||
    input.contractType === "prestacion_servicios" ||
    input.allowanceMonthlyCop <= 0
  ) return 0;

  const days = Math.max(1, input.daysPerMonth);
  const hours = Math.max(1, input.hoursPerDay);
  const weeks = Math.max(1, input.weeksPerMonth);
  const quincenas = Math.max(1, input.quincenasPerMonth);
  const periodScale = input.payPeriod === "hora"
    ? hours * days
    : input.payPeriod === "dia"
      ? days
      : input.payPeriod === "semana"
        ? weeks
        : input.payPeriod === "quincena"
          ? quincenas
          : 1;
  const monthlyRate = Math.max(0, input.unitRateCop) * periodScale;
  const monthlyLimit = Math.max(0, input.smlmvCop) * Math.max(0, input.maximumMonthlySmlmv);
  if (monthlyLimit <= 0 || monthlyRate > monthlyLimit) return 0;

  return round2((input.allowanceMonthlyCop / periodScale) * Math.max(0, input.unitsWorked));
}

/**
 * Liquida jornal, salario o trabajo propio calculando aportes del empleador,
 * deducciones al trabajador (salud/pensión/retención), neto a pagar y costo económico total.
 */
export function computePayrollLiquidation(input: PayrollLiquidationInput): PayrollLiquidationResult {
  const units = Math.max(0, Number(input.unitsWorked || 0));
  const rate = Math.max(0, Number(input.unitRateCop || 0));
  const bonuses = Math.max(0, Number(input.bonusesCop || 0));
  const transportAllowanceCop = Math.max(0, Number(input.transportAllowanceCop || 0));
  const contributoryGrossCop = round2(units * rate + bonuses);
  const grossPayCop = round2(contributoryGrossCop + transportAllowanceCop);

  const applySs = Boolean(input.applySocialSecurity);
  const empPct = applySs ? Math.max(0, Number(input.employerBurdenPct || 0)) : 0;
  const wrkPct = applySs ? Math.max(0, Number(input.workerDeductionPct || 0)) : 0;

  const employerBurdenCop = round2((contributoryGrossCop * empPct) / 100);
  const workerDeductionsCop = round2((contributoryGrossCop * wrkPct) / 100);
  const reteFuenteCop =
    input.reteFuenteFixedCop !== null && input.reteFuenteFixedCop !== undefined
      ? round2(Math.max(0, Number(input.reteFuenteFixedCop)))
      : round2((grossPayCop * Math.max(0, Number(input.reteFuenteRatePct || 0))) / 100);

  const netPayableCop = round2(Math.max(0, grossPayCop - workerDeductionsCop - reteFuenteCop));
  const totalEmployerCostCop = round2(grossPayCop + employerBurdenCop);

  return {
    grossPayCop,
    bonusesCop: round2(bonuses),
    transportAllowanceCop: round2(transportAllowanceCop),
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
  paymentStatus?: string;
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
  gmfRatePct?: number;
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
  let cashPayrollCostCop = 0;
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
      cashPayrollCostCop += totalCost;
      if (p.paymentStatus === undefined || p.paymentStatus === "pagado") {
        paidPayrollCostCop += totalCost;
      }
    }
  }

  const gmf4x1000EstimatedCop = input.gmf4x1000Enabled
    ? round2(Math.max(0, input.cashOutflowsCop) * Math.max(0, Number(input.gmfRatePct ?? 0.4)) / 100)
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
    payrollTotalEconomicCop: round2(cashPayrollCostCop + imputedOwnerLaborCop),
    paidPayrollCostCop: round2(paidPayrollCostCop),
    imputedOwnerLaborCop: round2(imputedOwnerLaborCop),
    gmf4x1000EstimatedCop,
    gmf4x1000Enabled: Boolean(input.gmf4x1000Enabled),
    totalTaxesAndWithholdingsCop,
  };
}
