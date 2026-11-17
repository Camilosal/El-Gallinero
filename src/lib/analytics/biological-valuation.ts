import { getSpeciesParams } from "@/lib/species-params";
import { getStandardCurve, interpolateStandard } from "@/lib/standard-curves";
import { calibrateTargetForEnvironment } from "@/lib/zootechnics";

export type SpeciesCode = "pollo" | "gallina" | "codorniz" | "pato" | "conejo" | "cuy";

export type TransactionNature =
  | "operating_income"
  | "capex"
  | "feed_inventory_purchase"
  | "supply_inventory_purchase"
  | "biological_stock_acquisition"
  | "operating_expense";

export type FarmLifecycleMode =
  | "pausa_sanitaria"
  | "cria_levante"
  | "produccion_plena"
  | "mixto"
  | "sin_poblacion";

export interface BiologicalAlert {
  id: string;
  species: string;
  entityName: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  recommendedAction: string;
}

export interface AssetDepreciationRow {
  id: string;
  code: string;
  name: string;
  category: string;
  acquisitionCostCop: number;
  residualValueCop: number;
  depreciationBasis: "meses" | "ciclos";
  usefulLifeCount: number;
  periodDepreciationCop: number;
  accumulatedDepreciationCop: number;
  netBookValueCop: number;
  recoveryPct: number;
}

export interface AssetsDepreciationSummary {
  totalAcquisitionCostCop: number;
  totalDepreciableCop: number;
  periodDepreciationCop: number;
  accumulatedDepreciationCop: number;
  netBookValueCop: number;
  capexRecoveryPct: number;
  activeAssetCount: number;
  breakdown: AssetDepreciationRow[];
}

export interface FeedWarehouseSummary {
  totalValueCop: number;
  totalKg: number;
  bultos40Kg: number;
  lowStockCount: number;
  items: {
    id: string;
    name: string;
    currentKg: number;
    unitCostCop: number;
    valueCop: number;
    belowReorder: boolean;
  }[];
}

export interface BiologicalUnitValuation {
  id: string;
  source: "broiler_batch" | "flock";
  name: string;
  species: string;
  purpose: "engorde_carne" | "postura_huevo" | "doble_proposito" | "pie_cria";
  animalCount: number;
  ageDays: number;
  ageWeeks: number;
  valuationStage:
    | "crecimiento_inicial"
    | "desarrollo_comercial"
    | "levante_prepostura"
    | "postura_activa"
    | "reproductor_base"
    | "listo_beneficio";
  valuationStageLabel: string;
  investedBaseCop: number;
  biologicalValueCop: number;
  unrealizedBiologicalGainCop: number;
  projectedHarvestValueCop: number;
  environmentFactor: number;
  environmentNotes: string[];
  avgWeightKg: number | null;
  targetWeightKg: number | null;
  weightDeviationPct: number | null;
}

export interface BiologicalPortfolioSummary {
  totalAliveAnimals: number;
  totalBiologicalValueCop: number;
  totalInvestedBaseCop: number;
  unrealizedBiologicalGainCop: number;
  projectedHarvestValueCop: number;
  meatBiologicalValueCop: number;
  layerCapitalValueCop: number;
  breederCapitalValueCop: number;
  lifecycleMode: FarmLifecycleMode;
  lifecycleLabel: string;
  lifecycleDescription: string;
  activeSanitaryPauseLocations: { id: string; name: string; sanitaryEmptyUntil: string }[];
  units: BiologicalUnitValuation[];
  alerts: BiologicalAlert[];
  bySpecies: Record<
    string,
    {
      species: string;
      animalCount: number;
      biologicalValueCop: number;
      investedBaseCop: number;
      unrealizedGainCop: number;
    }
  >;
}

export interface ThreeLayerFinancialSummary {
  // 1. Liquidez / Caja bruta
  cashInflowsCop: number;
  cashOutflowsCop: number;
  cashNetFlowCop: number;
  capexCashOutflowCop: number;
  feedPurchaseCashOutflowCop: number;
  supplyPurchaseCashOutflowCop?: number;
  biologicalPurchaseCashOutflowCop: number;
  directOperatingCashOutflowCop: number;
  // 2. Resultado Operativo Devengado (lo justo del periodo)
  operatingIncomeCop: number;
  accruedFeedCostCop: number;
  accruedSupplyCostCop?: number;
  imputedOwnerLaborCop?: number;
  periodDepreciationCop: number;
  accruedOperatingExpenseCop: number;
  operatingNetProfitCop: number;
  operatingMarginPct: number;
  // 3. Patrimonio Productivo (Activos en granja)
  warehouseFeedAssetCop: number;
  warehouseSupplyAssetCop?: number;
  netEquipmentBookValueCop: number;
  biologicalPortfolioValueCop: number;
  totalProductiveWealthCop: number;
  wealthChangeAfterCashCop: number;
  usedFeedConsumptionBasis: boolean;
  usedSupplyConsumptionBasis?: boolean;
}

export interface TransactionLike {
  type: string;
  category?: string | null;
  description?: string | null;
  sourceType?: string | null;
  amount: string | number;
  date?: string | null;
}

export interface AssetLike {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  acquisitionDate?: string | null;
  acquisitionCost: string | number;
  usefulLifeMonths?: number | null;
  usefulLifeCycles?: number | null;
  residualValue?: string | number | null;
  depreciationBasis?: string | null;
}

export interface FeedInventoryLike {
  id: string;
  name: string;
  currentKg: string | number;
  unitCost: string | number;
  reorderLevelKg?: string | number | null;
}

export interface LocationLike {
  id: string;
  name: string;
  altitudeMeters?: number | null;
  floorType?: string | null;
  sanitaryEmptyUntil?: string | null;
}

export interface BroilerBatchLike {
  id: string;
  batchCode: string;
  species?: string | null;
  breed?: string | null;
  initialCount: number;
  currentCount: number;
  avgWeightG?: string | number | null;
  chickCostTotal?: string | number | null;
  startDate?: string | null;
  targetAgeDays?: number | null;
  targetWeightG?: number | null;
  status: string;
  locationId?: string | null;
  observedFcr?: number | null;
  uniformityCvPct?: number | null;
}

export interface FlockLike {
  id: string;
  name: string;
  species?: string | null;
  breed?: string | null;
  purpose?: string | null;
  initialCount: number;
  currentCount: number;
  acquisitionCost?: string | number | null;
  ageWeeks?: number | null;
  entryDate?: string | null;
  status: string;
  locationId?: string | null;
  latestAvgWeightG?: number | null;
  latestCvPct?: number | null;
  observedFcr?: number | null;
}

const MEAT_CYCLE_DAYS: Record<string, number> = {
  pollo: 42,
  pato: 49,
  codorniz: 35,
  conejo: 75,
  cuy: 82,
  gallina: 126,
};

const POINT_OF_LAY_WEEKS: Record<string, number> = {
  gallina: 18,
  codorniz: 6,
  pato: 22,
};

const CULL_WEEKS: Record<string, number> = {
  gallina: 100,
  codorniz: 55,
  pato: 78,
  conejo: 130,
  cuy: 110,
};

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function diffDaysInclusive(startStr: string, endStr: string): number {
  const s = new Date(`${startStr.slice(0, 10)}T00:00:00Z`).getTime();
  const e = new Date(`${endStr.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

function diffDaysElapsed(startStr: string, endStr: string): number {
  const s = new Date(`${startStr.slice(0, 10)}T00:00:00Z`).getTime();
  const e = new Date(`${endStr.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.floor((e - s) / 86400000);
}

/**
 * Classifies a ledger transaction by economic nature so CapEx equipment and
 * feed warehouse stockpiling do not artificially crush early-stage operating profit.
 */
export function classifyTransactionNature(tx: TransactionLike): TransactionNature {
  if (tx.type === "ingreso") return "operating_income";
  const category = (tx.category || "").toLowerCase().trim();
  const sourceType = (tx.sourceType || "").toLowerCase().trim();
  const desc = (tx.description || "").toLowerCase();

  if (
    sourceType === "farm_asset" ||
    sourceType === "capex" ||
    /equipamiento|infraestructura|maquinaria|activo|construcci|equipo/.test(category) ||
    /compra capex|bebedero|comedero|criadora|galp[oó]n|jaula/.test(desc)
  ) {
    return "capex";
  }

  if (
    sourceType === "feed_purchase" ||
    sourceType === "alimento" ||
    sourceType === "feed_inventory" ||
    /alimento|concentrado|nutrici|bulto|sal_mineral/.test(category)
  ) {
    return "feed_inventory_purchase";
  }

  if (
    sourceType === "supply_purchase" ||
    sourceType === "insumo" ||
    sourceType === "supply_inventory" ||
    /compra de insumos|compra_insumos/.test(category)
  ) {
    return "supply_inventory_purchase";
  }

  if (
    sourceType === "flock_acquisition" ||
    sourceType === "broiler_batch" ||
    /compra_aves|compra de aves|pollito|pollona|pie de cr|pie_cria|\baves\b/.test(category)
  ) {
    return "biological_stock_acquisition";
  }

  return "operating_expense";
}

/**
 * Computes linear depreciation per month or cycle for active CapEx assets.
 */
export function computeAssetsDepreciationSummary(
  assets: AssetLike[],
  options: { fromDate: string; toDate: string; avgCycleDays?: number },
): AssetsDepreciationSummary {
  const { fromDate, toDate, avgCycleDays = 42 } = options;
  const windowDays = Math.max(1, diffDaysInclusive(fromDate, toDate));
  const breakdown: AssetDepreciationRow[] = [];

  let totalAcquisitionCostCop = 0;
  let totalDepreciableCop = 0;
  let periodDepreciationCop = 0;
  let accumulatedDepreciationCop = 0;
  let netBookValueCop = 0;

  for (const asset of assets) {
    if (asset.status === "retirado") continue;
    const cost = Math.max(0, Number(asset.acquisitionCost || 0));
    if (cost <= 0) continue;

    // Exclude assets clearly acquired after the report end date
    if (asset.acquisitionDate && asset.acquisitionDate > toDate) continue;

    const residual = Math.min(cost, Math.max(0, Number(asset.residualValue || 0)));
    const depreciable = Math.max(0, cost - residual);
    const basis: "meses" | "ciclos" = asset.depreciationBasis === "ciclos" ? "ciclos" : "meses";
    const usefulLifeCount =
      basis === "ciclos"
        ? Math.max(1, Number(asset.usefulLifeCycles || 18))
        : Math.max(1, Number(asset.usefulLifeMonths || 36));
    const totalLifeDays =
      basis === "ciclos"
        ? usefulLifeCount * Math.max(1, avgCycleDays)
        : usefulLifeCount * 30.4375;

    const dailyDepr = depreciable / totalLifeDays;
    const effectivePeriodStart =
      asset.acquisitionDate && asset.acquisitionDate > fromDate ? asset.acquisitionDate : fromDate;
    const periodDays = Math.min(windowDays, diffDaysInclusive(effectivePeriodStart, toDate));
    const totalElapsedDays = asset.acquisitionDate
      ? Math.max(periodDays, diffDaysInclusive(asset.acquisitionDate, toDate))
      : periodDays;

    const accruedAccum = Math.min(depreciable, dailyDepr * totalElapsedDays);
    const remainingBeforePeriod = Math.max(0, depreciable - Math.max(0, accruedAccum - dailyDepr * periodDays));
    const periodDepr = Math.min(remainingBeforePeriod, dailyDepr * periodDays);
    const bookValue = Math.max(residual, cost - accruedAccum);
    const recoveryPct = cost > 0 ? clamp((accruedAccum / cost) * 100, 0, 100) : 0;

    totalAcquisitionCostCop += cost;
    totalDepreciableCop += depreciable;
    periodDepreciationCop += periodDepr;
    accumulatedDepreciationCop += accruedAccum;
    netBookValueCop += bookValue;

    breakdown.push({
      id: asset.id,
      code: asset.code,
      name: asset.name,
      category: asset.category,
      acquisitionCostCop: round2(cost),
      residualValueCop: round2(residual),
      depreciationBasis: basis,
      usefulLifeCount,
      periodDepreciationCop: round2(periodDepr),
      accumulatedDepreciationCop: round2(accruedAccum),
      netBookValueCop: round2(bookValue),
      recoveryPct: round2(recoveryPct),
    });
  }

  return {
    totalAcquisitionCostCop: round2(totalAcquisitionCostCop),
    totalDepreciableCop: round2(totalDepreciableCop),
    periodDepreciationCop: round2(periodDepreciationCop),
    accumulatedDepreciationCop: round2(accumulatedDepreciationCop),
    netBookValueCop: round2(netBookValueCop),
    capexRecoveryPct:
      totalAcquisitionCostCop > 0
        ? round2((accumulatedDepreciationCop / totalAcquisitionCostCop) * 100)
        : 0,
    activeAssetCount: breakdown.length,
    breakdown,
  };
}

/**
 * Values feed currently sitting in the farm warehouse as an available asset rather than a sunk expense.
 */
export function computeFeedWarehouseValuation(rows: FeedInventoryLike[]): FeedWarehouseSummary {
  let totalValueCop = 0;
  let totalKg = 0;
  let lowStockCount = 0;
  const items = rows.map((row) => {
    const currentKg = Math.max(0, Number(row.currentKg || 0));
    const unitCostCop = Math.max(0, Number(row.unitCost || 0));
    const reorderKg = Math.max(0, Number(row.reorderLevelKg || 0));
    const valueCop = round2(currentKg * unitCostCop);
    const belowReorder = reorderKg > 0 && currentKg <= reorderKg;
    if (belowReorder) lowStockCount += 1;
    totalValueCop += valueCop;
    totalKg += currentKg;
    return {
      id: row.id,
      name: row.name,
      currentKg: round2(currentKg),
      unitCostCop: round2(unitCostCop),
      valueCop,
      belowReorder,
    };
  });

  return {
    totalValueCop: round2(totalValueCop),
    totalKg: round2(totalKg),
    bultos40Kg: round2(totalKg / 40),
    lowStockCount,
    items,
  };
}

function estimateCalibratedWeightKg(
  species: SpeciesCode,
  breed: string | null | undefined,
  weeksAlive: number,
  cycleWeeks: number,
  calFactor: number,
): number {
  const curve = getStandardCurve(species, breed);
  if (curve && curve.metric === "peso" && curve.points.length > 0) {
    const firstW = curve.points[0].week;
    const lastW = curve.points[curve.points.length - 1].week;
    const clampedW = clamp(weeksAlive, firstW, lastW);
    const point = interpolateStandard(curve, clampedW);
    const baseG = point?.target ?? curve.points[curve.points.length - 1].target;
    const scaledG =
      weeksAlive < firstW && firstW > 0
        ? Math.max(40, baseG * Math.max(0.15, weeksAlive / firstW))
        : baseG;
    return (scaledG * calFactor) / 1000;
  }
  const sp = getSpeciesParams(species, breed ?? undefined);
  const endKg = sp && sp.targetWeightKg > 0 ? sp.targetWeightKg : 2.2;
  const ratio = clamp(weeksAlive / Math.max(1, cycleWeeks), 0.05, 1);
  return endKg * ratio * calFactor;
}

function normalizeSpeciesKey(raw?: string | null): SpeciesCode {
  const s = (raw || "gallina").toLowerCase().trim();
  if (s === "pollo" || s === "gallina" || s === "codorniz" || s === "pato" || s === "conejo" || s === "cuy") {
    return s;
  }
  return "gallina";
}

function normalizePurpose(raw?: string | null, species?: SpeciesCode): BiologicalUnitValuation["purpose"] {
  const p = (raw || "").toLowerCase().trim();
  if (p === "engorde_carne" || p === "postura_huevo" || p === "doble_proposito" || p === "pie_cria") {
    return p;
  }
  return species === "pollo" ? "engorde_carne" : "postura_huevo";
}

function evaluateMeatAlerts(params: {
  id: string;
  species: SpeciesCode;
  name: string;
  daysAlive: number;
  actualWeightKg: number | null;
  weightDeviationPct: number | null;
  cvPct: number | null;
  observedFcr: number | null;
  envNotes: string[];
}): BiologicalAlert[] {
  const alerts: BiologicalAlert[] = [];
  const { id, species, name, daysAlive, actualWeightKg, weightDeviationPct, cvPct, observedFcr, envNotes } = params;

  if (species === "pato" && (daysAlive >= 49 || (observedFcr !== null && observedFcr > 3.35))) {
    alerts.push({
      id: `${id}-pato-inflection`,
      species,
      entityName: name,
      severity: daysAlive > 56 || (observedFcr !== null && observedFcr > 3.6) ? "critical" : "warning",
      title: "Cambio de eficiencia en Patos (Día 49 — ya comen mucho por kilo ganado)",
      detail: `El lote "${name}" alcanzó ${daysAlive} días${observedFcr ? ` con ${observedFcr.toFixed(2)} kg de alimento por kg ganado` : ""}. Después del día 49 gastan mucha comida por poco aumento de peso.`,
      recommendedAction: "Programar sacrificio o venta esta semana para cuidar tu ganancia.",
    });
  }

  if (species === "cuy" && (daysAlive >= 75 || (actualWeightKg !== null && actualWeightKg >= 1.0))) {
    alerts.push({
      id: `${id}-cuy-window`,
      species,
      entityName: name,
      severity: daysAlive > 90 ? "critical" : "info",
      title: "Cuyes en ventana óptima de saca (75–90 días)",
      detail: `El lote "${name}" registra ${daysAlive} días${actualWeightKg ? ` (${actualWeightKg.toFixed(2)} kg promedio)` : ""}. Más allá de 90 días el FCR salta hacia 6.13.`,
      recommendedAction: "Liquidar animales terminados (1.00–1.36 kg) y conservar solo reemplazos selectos.",
    });
  }

  if (species === "conejo" && daysAlive >= 70) {
    alerts.push({
      id: `${id}-conejo-window`,
      species,
      entityName: name,
      severity: daysAlive > 84 ? "warning" : "info",
      title: "Conejos en ventana de beneficio (70–75 días)",
      detail: `El lote "${name}" lleva ${daysAlive} días. Mantener engorde extra reduce la rentabilidad por consumo de forraje/concentrado.`,
      recommendedAction: "Evaluar peso de canal y programar despacho comercial.",
    });
  }

  if (weightDeviationPct !== null && weightDeviationPct < -7) {
    alerts.push({
      id: `${id}-weight-dev`,
      species,
      entityName: name,
      severity: weightDeviationPct < -15 ? "critical" : "warning",
      title: `Desviación de peso (${weightDeviationPct.toFixed(1)}% vs curva calibrada)`,
      detail: `El lote "${name}" pesa ${Math.abs(weightDeviationPct).toFixed(1)}% menos de lo esperado para su edad y altura.${envNotes.length > 0 ? ` (${envNotes[0]})` : ""}`,
      recommendedAction: "Revisar densidad, calidad de agua, temperatura de cama y gramaje diario de alimento.",
    });
  }

  if (cvPct !== null && cvPct > 10) {
    alerts.push({
      id: `${id}-cv`,
      species,
      entityName: name,
      severity: "warning",
      title: `Uniformidad heterogénea (CV ${cvPct.toFixed(1)}% > 10%)`,
      detail: `Alta dispersión de pesos en "${name}". Indica competencia por comederos o subdosificación térmica.`,
      recommendedAction: "Separar por tamaños y verificar espacio lineal de comedero/bebedero.",
    });
  }

  return alerts;
}

/**
 * Evaluates live animals across flocks and meat batches using biological variability rules:
 * - Meat batches use conservative early-stage biological valuation converging to market liveweight value.
 * - Layer pullets (<18w hen, <6w quail) are valued as pre-lay productive capital (never meat).
 * - Breeding stock is valued as fixed genetic capital.
 * - Locations with active sanitaryEmptyUntil trigger pausa_sanitaria mode.
 */
export interface BiologicalMarketPrices {
  meatKgCopBySpecies?: Partial<Record<string, number>>;
  eggUnitCopBySpecies?: Partial<Record<string, number>>;
  initialUnitCostCopBySpecies?: Partial<Record<string, number>>;
  pointOfLayValueCopBySpecies?: Partial<Record<string, number>>;
  breederUnitValueCopBySpecies?: Partial<Record<string, number>>;
}

export function evaluateBiologicalPortfolio(input: {
  flocks: FlockLike[];
  broilerBatches: BroilerBatchLike[];
  locations?: LocationLike[];
  marketPrices?: BiologicalMarketPrices;
  referenceDate?: string;
}): BiologicalPortfolioSummary {
  const referenceDate = input.referenceDate || new Date().toISOString().slice(0, 10);
  const locationMap = new Map((input.locations || []).map((l) => [l.id, l]));

  const units: BiologicalUnitValuation[] = [];
  const alerts: BiologicalAlert[] = [];
  const addMissingMasterPriceAlert = (id: string, species: string, name: string, missing: string[]) => {
    if (missing.length === 0) return;
    alerts.push({
      id: `${id}-missing-master-price`,
      species,
      entityName: name,
      severity: "warning",
      title: `Faltan precios maestros para valorar "${name}"`,
      detail: `No hay ${missing.join(" y ")} configurado(s) en Catálogos. La valoración que requiere ese dato queda en cero o puede subestimar el activo.`,
      recommendedAction: "Completa los valores vigentes y sus unidades en Catálogos > Especies antes de usar esta valoración financiera.",
    });
  };

  for (const batch of input.broilerBatches) {
    if (batch.status !== "activo" || Number(batch.currentCount || 0) <= 0) continue;
    const species = normalizeSpeciesKey(batch.species || "pollo");
    const loc = batch.locationId ? locationMap.get(batch.locationId) : undefined;
    const cal = calibrateTargetForEnvironment(species, loc?.altitudeMeters ?? null, loc?.floorType ?? null);
    const daysAlive = batch.startDate ? Math.max(1, diffDaysElapsed(batch.startDate, referenceDate)) : 7;
    const weeksAlive = Math.max(0.14, daysAlive / 7);
    const cycleDays = Math.max(21, Number(batch.targetAgeDays || MEAT_CYCLE_DAYS[species] || 42));
    const cycleWeeks = cycleDays / 7;
    const calibratedTargetWeightKg = estimateCalibratedWeightKg(
      species,
      batch.breed,
      weeksAlive,
      cycleWeeks,
      cal.factor,
    );
    const avgWeightKg = Number(batch.avgWeightG || 0) > 0
      ? Number(batch.avgWeightG) / 1000
      : calibratedTargetWeightKg;
    const weightDeviationPct =
      calibratedTargetWeightKg > 0 && Number(batch.avgWeightG || 0) > 0
        ? round2(((avgWeightKg - calibratedTargetWeightKg) / calibratedTargetWeightKg) * 100)
        : null;

    const cycleProgress = clamp(daysAlive / cycleDays, 0, 1);
    const targetHarvestWeightKg =
      Number(batch.targetWeightG || 0) > 0
        ? Number(batch.targetWeightG) / 1000
        : estimateCalibratedWeightKg(species, batch.breed, cycleWeeks, cycleWeeks, cal.factor);

    const pricePerKgLive =
      input.marketPrices?.meatKgCopBySpecies?.[species] ?? 0;

    const defaultChickUnit = input.marketPrices?.initialUnitCostCopBySpecies?.[species] ?? 0;
    addMissingMasterPriceAlert(batch.id, species, batch.batchCode, [
      ...(pricePerKgLive > 0 ? [] : ["precio maestro por kg en canal"]),
      ...(Number(batch.chickCostTotal || 0) > 0 || defaultChickUnit > 0 ? [] : ["costo inicial por animal"]),
    ]);
    const investedBaseCop =
      Number(batch.chickCostTotal || 0) > 0
        ? Number(batch.chickCostTotal)
        : batch.initialCount * defaultChickUnit;
    const chickUnit = batch.initialCount > 0 ? investedBaseCop / batch.initialCount : defaultChickUnit;

    const biologicalUnitCop = chickUnit * (1 - cycleProgress) + avgWeightKg * pricePerKgLive;
    const biologicalValueCop = round2(batch.currentCount * biologicalUnitCop);
    const projectedHarvestValueCop = round2(batch.currentCount * targetHarvestWeightKg * pricePerKgLive);

    const valuationStage: BiologicalUnitValuation["valuationStage"] =
      cycleProgress >= 0.92
        ? "listo_beneficio"
        : cycleProgress >= 0.5
          ? "desarrollo_comercial"
          : "crecimiento_inicial";
    const valuationStageLabel =
      valuationStage === "listo_beneficio"
        ? "Listo para beneficio (valor comercial)"
        : valuationStage === "desarrollo_comercial"
          ? "Engorde comercial en pie (no realizado)"
          : "Crecimiento inicial (<50% ciclo · en formación)";

    units.push({
      id: batch.id,
      source: "broiler_batch",
      name: batch.batchCode,
      species,
      purpose: "engorde_carne",
      animalCount: batch.currentCount,
      ageDays: daysAlive,
      ageWeeks: round2(weeksAlive),
      valuationStage,
      valuationStageLabel,
      investedBaseCop: round2(investedBaseCop),
      biologicalValueCop,
      unrealizedBiologicalGainCop: round2(biologicalValueCop - investedBaseCop),
      projectedHarvestValueCop,
      environmentFactor: cal.factor,
      environmentNotes: cal.notes,
      avgWeightKg: round2(avgWeightKg),
      targetWeightKg: round2(calibratedTargetWeightKg),
      weightDeviationPct,
    });

    alerts.push(
      ...evaluateMeatAlerts({
        id: batch.id,
        species,
        name: batch.batchCode,
        daysAlive,
        actualWeightKg: Number(batch.avgWeightG || 0) > 0 ? avgWeightKg : null,
        weightDeviationPct,
        cvPct: batch.uniformityCvPct ?? null,
        observedFcr: batch.observedFcr ?? null,
        envNotes: cal.notes,
      }),
    );
  }

  for (const flock of input.flocks) {
    if (flock.status !== "activo" || Number(flock.currentCount || 0) <= 0) continue;
    const species = normalizeSpeciesKey(flock.species || "gallina");
    const purpose = normalizePurpose(flock.purpose, species);
    const loc = flock.locationId ? locationMap.get(flock.locationId) : undefined;
    const cal = calibrateTargetForEnvironment(species, loc?.altitudeMeters ?? null, loc?.floorType ?? null);
    const defaultChickUnit = input.marketPrices?.initialUnitCostCopBySpecies?.[species] ?? 0;

    const daysSinceEntry = flock.entryDate ? diffDaysElapsed(flock.entryDate, referenceDate) : 0;
    const ageWeeks = round2((Number(flock.ageWeeks || 0) || 0) + daysSinceEntry / 7);
    const ageDays = Math.round(ageWeeks * 7);
    const investedBaseCop =
      Number(flock.acquisitionCost || 0) > 0
        ? Number(flock.acquisitionCost)
        : flock.initialCount * defaultChickUnit;

    if (purpose === "postura_huevo") {
      const pointOfLayW = POINT_OF_LAY_WEEKS[species] ?? 18;
      const cullW = CULL_WEEKS[species] ?? 100;
      const pointOfLayUnitVal = input.marketPrices?.pointOfLayValueCopBySpecies?.[species] ?? 0;
      const startUnitCost = flock.initialCount > 0 ? investedBaseCop / flock.initialCount : defaultChickUnit;
      addMissingMasterPriceAlert(flock.id, species, flock.name, [
        ...(pointOfLayUnitVal > 0 ? [] : ["valor unitario de postura"]),
        ...(Number(flock.acquisitionCost || 0) > 0 || defaultChickUnit > 0 ? [] : ["costo inicial por animal"]),
      ]);

      let valuationStage: BiologicalUnitValuation["valuationStage"];
      let valuationStageLabel: string;
      let biologicalValueCop: number;
      let projectedHarvestValueCop: number;

      if (ageWeeks < pointOfLayW) {
        const progressToLay = clamp(ageWeeks / Math.max(1, pointOfLayW), 0, 1);
        const unitVal = startUnitCost + (Math.max(startUnitCost, pointOfLayUnitVal) - startUnitCost) * progressToLay;
        valuationStage = "levante_prepostura";
        valuationStageLabel = `Capital en levante (${Math.round(ageWeeks)}/${pointOfLayW} sem · pre-postura)`;
        biologicalValueCop = round2(flock.currentCount * unitVal);
        projectedHarvestValueCop = round2(flock.currentCount * pointOfLayUnitVal);

        if (pointOfLayW - ageWeeks <= 2.5) {
          alerts.push({
            id: `${flock.id}-prelay`,
            species,
            entityName: flock.name,
            severity: "info",
            title: `Lote "${flock.name}" próximo a romper postura`,
            detail: `Con ${Math.round(ageWeeks)} semanas está a menos de 3 semanas de iniciar ciclo productivo (${pointOfLayW} sem).`,
            recommendedAction: "Cambiar alimento a fase pre-postura, ajustar fotoestímulo a 14–16 h y habilitar nidales.",
          });
        }
      } else {
        const remainingRatio = clamp(1 - (ageWeeks - pointOfLayW) / Math.max(20, cullW - pointOfLayW), 0.25, 1);
        const salvageFloor = pointOfLayUnitVal * 0.35;
        const unitVal = salvageFloor + (pointOfLayUnitVal - salvageFloor) * remainingRatio;
        valuationStage = "postura_activa";
        valuationStageLabel = `Activo productor de huevo (${Math.round(ageWeeks)} sem)`;
        biologicalValueCop = round2(flock.currentCount * unitVal);
        projectedHarvestValueCop = round2(biologicalValueCop);

        if (ageWeeks >= cullW) {
          alerts.push({
            id: `${flock.id}-cull`,
            species,
            entityName: flock.name,
            severity: "warning",
            title: `Fin de ciclo productivo en "${flock.name}" (${Math.round(ageWeeks)} sem)`,
            detail: `Superó el horizonte económico estándar de ${cullW} semanas.`,
            recommendedAction: "Evaluar tasa de postura semanal vs consumo para programar descarte o renovación.",
          });
        }
      }

      units.push({
        id: flock.id,
        source: "flock",
        name: flock.name,
        species,
        purpose,
        animalCount: flock.currentCount,
        ageDays,
        ageWeeks,
        valuationStage,
        valuationStageLabel,
        investedBaseCop: round2(investedBaseCop),
        biologicalValueCop,
        unrealizedBiologicalGainCop: round2(biologicalValueCop - investedBaseCop),
        projectedHarvestValueCop,
        environmentFactor: cal.factor,
        environmentNotes: cal.notes,
        avgWeightKg: flock.latestAvgWeightG ? round2(flock.latestAvgWeightG / 1000) : null,
        targetWeightKg: null,
        weightDeviationPct: null,
      });
    } else if (purpose === "pie_cria") {
      const unitValue = input.marketPrices?.breederUnitValueCopBySpecies?.[species] ?? 0;
      addMissingMasterPriceAlert(flock.id, species, flock.name, [
        ...(unitValue > 0 || Number(flock.acquisitionCost || 0) > 0 ? [] : ["valor unitario de pie de cría"]),
        ...(Number(flock.acquisitionCost || 0) > 0 || defaultChickUnit > 0 ? [] : ["costo inicial por animal"]),
      ]);
      const biologicalValueCop = round2(flock.currentCount * Math.max(unitValue, flock.initialCount > 0 ? investedBaseCop / flock.initialCount : unitValue));
      units.push({
        id: flock.id,
        source: "flock",
        name: flock.name,
        species,
        purpose,
        animalCount: flock.currentCount,
        ageDays,
        ageWeeks,
        valuationStage: "reproductor_base",
        valuationStageLabel: "Pie de cría / Capital genético fijo",
        investedBaseCop: round2(investedBaseCop),
        biologicalValueCop,
        unrealizedBiologicalGainCop: round2(biologicalValueCop - investedBaseCop),
        projectedHarvestValueCop: biologicalValueCop,
        environmentFactor: cal.factor,
        environmentNotes: cal.notes,
        avgWeightKg: flock.latestAvgWeightG ? round2(flock.latestAvgWeightG / 1000) : null,
        targetWeightKg: null,
        weightDeviationPct: null,
      });
    } else {
      // engorde_carne or doble_proposito in flocks
      const effectiveWeeks = Math.max(0.5, ageWeeks);
      const cycleDays = MEAT_CYCLE_DAYS[species] ?? 49;
      const cycleWeeks = cycleDays / 7;
      const targetWeightKg = estimateCalibratedWeightKg(
        species,
        flock.breed,
        effectiveWeeks,
        cycleWeeks,
        cal.factor,
      );
      const avgWeightKg = flock.latestAvgWeightG && flock.latestAvgWeightG > 0
        ? flock.latestAvgWeightG / 1000
        : targetWeightKg;
      const weightDeviationPct =
        flock.latestAvgWeightG && flock.latestAvgWeightG > 0 && targetWeightKg > 0
          ? round2(((avgWeightKg - targetWeightKg) / targetWeightKg) * 100)
          : null;
      const cycleProgress = clamp(ageDays / cycleDays, 0, 1);
      const pricePerKgLive = input.marketPrices?.meatKgCopBySpecies?.[species] ?? 0;
      addMissingMasterPriceAlert(flock.id, species, flock.name, [
        ...(pricePerKgLive > 0 ? [] : ["precio maestro por kg en canal"]),
        ...(Number(flock.acquisitionCost || 0) > 0 || defaultChickUnit > 0 ? [] : ["costo inicial por animal"]),
      ]);
      const chickUnit = flock.initialCount > 0 ? investedBaseCop / flock.initialCount : (input.marketPrices?.initialUnitCostCopBySpecies?.[species] ?? 0);
      const bioUnit = chickUnit * (1 - cycleProgress) + avgWeightKg * pricePerKgLive;
      const biologicalValueCop = round2(flock.currentCount * bioUnit);
      const projectedHarvestValueCop = round2(
        flock.currentCount *
          estimateCalibratedWeightKg(species, flock.breed, cycleWeeks, cycleWeeks, cal.factor) *
          pricePerKgLive,
      );
      const valuationStage: BiologicalUnitValuation["valuationStage"] =
        cycleProgress >= 0.92
          ? "listo_beneficio"
          : cycleProgress >= 0.5
            ? "desarrollo_comercial"
            : "crecimiento_inicial";

      units.push({
        id: flock.id,
        source: "flock",
        name: flock.name,
        species,
        purpose,
        animalCount: flock.currentCount,
        ageDays,
        ageWeeks,
        valuationStage,
        valuationStageLabel:
          valuationStage === "listo_beneficio"
            ? "Listo para beneficio"
            : valuationStage === "desarrollo_comercial"
              ? "Engorde comercial en pie"
              : "Crecimiento inicial (<50% ciclo)",
        investedBaseCop: round2(investedBaseCop),
        biologicalValueCop,
        unrealizedBiologicalGainCop: round2(biologicalValueCop - investedBaseCop),
        projectedHarvestValueCop,
        environmentFactor: cal.factor,
        environmentNotes: cal.notes,
        avgWeightKg: round2(avgWeightKg),
        targetWeightKg: round2(targetWeightKg),
        weightDeviationPct,
      });

      alerts.push(
        ...evaluateMeatAlerts({
          id: flock.id,
          species,
          name: flock.name,
          daysAlive: ageDays,
          actualWeightKg: flock.latestAvgWeightG ? avgWeightKg : null,
          weightDeviationPct,
          cvPct: flock.latestCvPct ?? null,
          observedFcr: flock.observedFcr ?? null,
          envNotes: cal.notes,
        }),
      );
    }
  }

  const activeSanitaryPauseLocations = (input.locations || [])
    .filter((l) => Boolean(l.sanitaryEmptyUntil && l.sanitaryEmptyUntil >= referenceDate))
    .map((l) => ({
      id: l.id,
      name: l.name,
      sanitaryEmptyUntil: l.sanitaryEmptyUntil!,
    }));

  const totalAliveAnimals = units.reduce((acc, u) => acc + u.animalCount, 0);
  const totalBiologicalValueCop = round2(units.reduce((acc, u) => acc + u.biologicalValueCop, 0));
  const totalInvestedBaseCop = round2(units.reduce((acc, u) => acc + u.investedBaseCop, 0));
  const projectedHarvestValueCop = round2(units.reduce((acc, u) => acc + u.projectedHarvestValueCop, 0));
  const meatBiologicalValueCop = round2(
    units
      .filter((u) => u.purpose === "engorde_carne" || u.purpose === "doble_proposito")
      .reduce((acc, u) => acc + u.biologicalValueCop, 0),
  );
  const layerCapitalValueCop = round2(
    units.filter((u) => u.purpose === "postura_huevo").reduce((acc, u) => acc + u.biologicalValueCop, 0),
  );
  const breederCapitalValueCop = round2(
    units.filter((u) => u.purpose === "pie_cria").reduce((acc, u) => acc + u.biologicalValueCop, 0),
  );

  let lifecycleMode: FarmLifecycleMode = "produccion_plena";
  let lifecycleLabel = "Producción Activa";
  let lifecycleDescription = "La granja tiene lotes en producción comercial o postura generando valor operativo.";

  if (totalAliveAnimals === 0 && activeSanitaryPauseLocations.length > 0) {
    lifecycleMode = "pausa_sanitaria";
    lifecycleLabel = "Vacío Sanitario (Bioseguridad ICA)";
    lifecycleDescription =
      "Las alertas de déficit productivo están en pausa mientras completas limpieza, desinfección y descanso del galpón.";
  } else if (totalAliveAnimals === 0) {
    lifecycleMode = "sin_poblacion";
    lifecycleLabel = "Sin Lotes Activos";
    lifecycleDescription = "Registra un nuevo lote de aves o ciclo de engorde para activar curvas biológicas y valoración en pie.";
  } else {
    const allPreProduction = units.every(
      (u) => u.valuationStage === "levante_prepostura" || u.valuationStage === "crecimiento_inicial",
    );
    const hasMixedStages =
      units.some((u) => u.valuationStage === "levante_prepostura" || u.valuationStage === "crecimiento_inicial") &&
      units.some((u) => u.valuationStage === "postura_activa" || u.valuationStage === "desarrollo_comercial" || u.valuationStage === "listo_beneficio");

    if (allPreProduction) {
      lifecycleMode = "cria_levante";
      lifecycleLabel = "Fase de Cría / Levante";
      lifecycleDescription =
        "Tus animales están en formación biológica. El costo invertido construye capital vivo antes de la primera venta.";
    } else if (hasMixedStages || new Set(units.map((u) => u.species)).size > 1) {
      lifecycleMode = "mixto";
      lifecycleLabel = "Operación Multi-Etapa";
      lifecycleDescription =
        "Combinas lotes en crecimiento con unidades en producción comercial; los KPIs separan levante de postura/cosecha.";
    }
  }

  const bySpecies: BiologicalPortfolioSummary["bySpecies"] = {};
  for (const unit of units) {
    const cur = bySpecies[unit.species] ?? {
      species: unit.species,
      animalCount: 0,
      biologicalValueCop: 0,
      investedBaseCop: 0,
      unrealizedGainCop: 0,
    };
    cur.animalCount += unit.animalCount;
    cur.biologicalValueCop = round2(cur.biologicalValueCop + unit.biologicalValueCop);
    cur.investedBaseCop = round2(cur.investedBaseCop + unit.investedBaseCop);
    cur.unrealizedGainCop = round2(cur.unrealizedGainCop + unit.unrealizedBiologicalGainCop);
    bySpecies[unit.species] = cur;
  }

  return {
    totalAliveAnimals,
    totalBiologicalValueCop,
    totalInvestedBaseCop,
    unrealizedBiologicalGainCop: round2(totalBiologicalValueCop - totalInvestedBaseCop),
    projectedHarvestValueCop,
    meatBiologicalValueCop,
    layerCapitalValueCop,
    breederCapitalValueCop,
    lifecycleMode,
    lifecycleLabel,
    lifecycleDescription,
    activeSanitaryPauseLocations,
    units,
    alerts,
    bySpecies,
  };
}

/**
 * Separates farm finances into 3 honest layers:
 * 1) Liquidez / Caja bruta (what left/entered the wallet)
 * 2) Resultado Operativo Devengado (fair operating P&L: excludes raw CapEx & unconsumed feed stock, adds CapEx depreciation)
 * 3) Patrimonio Productivo (warehouse feed + depreciated equipment NBV + live biological capital)
 */
export function computeThreeLayerFinancials(input: {
  transactions: TransactionLike[];
  accruedFeedConsumedCostCop: number;
  hasFeedConsumptionRecords: boolean;
  accruedSupplyConsumedCostCop?: number;
  hasSupplyConsumptionRecords?: boolean;
  imputedOwnerLaborCop?: number;
  warehouseSupplyAssetCop?: number;
  assetsSummary: AssetsDepreciationSummary;
  warehouseSummary: FeedWarehouseSummary;
  biologicalSummary: BiologicalPortfolioSummary;
}): ThreeLayerFinancialSummary {
  let cashInflowsCop = 0;
  let cashOutflowsCop = 0;
  let capexCashOutflowCop = 0;
  let feedPurchaseCashOutflowCop = 0;
  let supplyPurchaseCashOutflowCop = 0;
  let biologicalPurchaseCashOutflowCop = 0;
  let directOperatingCashOutflowCop = 0;

  for (const tx of input.transactions) {
    const amount = Math.max(0, Number(tx.amount || 0));
    const nature = classifyTransactionNature(tx);
    if (nature === "operating_income") {
      cashInflowsCop += amount;
      continue;
    }
    cashOutflowsCop += amount;
    if (nature === "capex") capexCashOutflowCop += amount;
    else if (nature === "feed_inventory_purchase") feedPurchaseCashOutflowCop += amount;
    else if (nature === "supply_inventory_purchase") supplyPurchaseCashOutflowCop += amount;
    else if (nature === "biological_stock_acquisition") biologicalPurchaseCashOutflowCop += amount;
    else directOperatingCashOutflowCop += amount;
  }

  // If the farm tracks daily consumption via feedMovements, charge consumed feed rather than upfront bulk bag purchases.
  // Otherwise fall back to feed purchases in transactions so small farms that haven't logged movements keep consistent numbers.
  const usedFeedConsumptionBasis =
    input.hasFeedConsumptionRecords || input.accruedFeedConsumedCostCop > 0;
  const accruedFeedCostCop = usedFeedConsumptionBasis
    ? input.accruedFeedConsumedCostCop
    : feedPurchaseCashOutflowCop;

  const supplyConsumed = Math.max(0, Number(input.accruedSupplyConsumedCostCop || 0));
  const usedSupplyConsumptionBasis =
    Boolean(input.hasSupplyConsumptionRecords) || supplyConsumed > 0;
  const accruedSupplyCostCop = usedSupplyConsumptionBasis
    ? supplyConsumed
    : supplyPurchaseCashOutflowCop;

  const imputedOwnerLaborCop = Math.max(0, Number(input.imputedOwnerLaborCop || 0));
  const warehouseSupplyAssetCop = Math.max(0, Number(input.warehouseSupplyAssetCop || 0));

  const accruedOperatingExpenseCop =
    directOperatingCashOutflowCop +
    accruedFeedCostCop +
    accruedSupplyCostCop +
    imputedOwnerLaborCop +
    input.assetsSummary.periodDepreciationCop;

  const operatingNetProfitCop = cashInflowsCop - accruedOperatingExpenseCop;
  const operatingMarginPct =
    cashInflowsCop > 0 ? round2((operatingNetProfitCop / cashInflowsCop) * 100) : 0;

  const totalProductiveWealthCop =
    input.warehouseSummary.totalValueCop +
    warehouseSupplyAssetCop +
    input.assetsSummary.netBookValueCop +
    input.biologicalSummary.totalBiologicalValueCop;

  const cashNetFlowCop = cashInflowsCop - cashOutflowsCop;
  const wealthChangeAfterCashCop = totalProductiveWealthCop + cashNetFlowCop;

  return {
    cashInflowsCop: round2(cashInflowsCop),
    cashOutflowsCop: round2(cashOutflowsCop),
    cashNetFlowCop: round2(cashNetFlowCop),
    capexCashOutflowCop: round2(capexCashOutflowCop),
    feedPurchaseCashOutflowCop: round2(feedPurchaseCashOutflowCop),
    supplyPurchaseCashOutflowCop: round2(supplyPurchaseCashOutflowCop),
    biologicalPurchaseCashOutflowCop: round2(biologicalPurchaseCashOutflowCop),
    directOperatingCashOutflowCop: round2(directOperatingCashOutflowCop),
    operatingIncomeCop: round2(cashInflowsCop),
    accruedFeedCostCop: round2(accruedFeedCostCop),
    accruedSupplyCostCop: round2(accruedSupplyCostCop),
    imputedOwnerLaborCop: round2(imputedOwnerLaborCop),
    periodDepreciationCop: round2(input.assetsSummary.periodDepreciationCop),
    accruedOperatingExpenseCop: round2(accruedOperatingExpenseCop),
    operatingNetProfitCop: round2(operatingNetProfitCop),
    operatingMarginPct,
    warehouseFeedAssetCop: round2(input.warehouseSummary.totalValueCop),
    warehouseSupplyAssetCop: round2(warehouseSupplyAssetCop),
    netEquipmentBookValueCop: round2(input.assetsSummary.netBookValueCop),
    biologicalPortfolioValueCop: round2(input.biologicalSummary.totalBiologicalValueCop),
    totalProductiveWealthCop: round2(totalProductiveWealthCop),
    wealthChangeAfterCashCop: round2(wealthChangeAfterCashCop),
    usedFeedConsumptionBasis,
    usedSupplyConsumptionBasis,
  };
}

export function buildMarketPriceOverridesFromSipsa(sipsa?: {
  meat?: { polloCanalKgCop?: number | null };
  eggs?: { aaUnitCop?: number | null };
}): {
  meatKgCopBySpecies?: Partial<Record<string, number>>;
  eggUnitCopBySpecies?: Partial<Record<string, number>>;
} {
  const meatKgCopBySpecies: Partial<Record<string, number>> = {};
  const eggUnitCopBySpecies: Partial<Record<string, number>> = {};
  if (sipsa?.meat?.polloCanalKgCop && sipsa.meat.polloCanalKgCop > 0) {
    // Convert carcass benchmark conservatively (~72% dressing yield -> live kg price)
    meatKgCopBySpecies.pollo = Math.round(sipsa.meat.polloCanalKgCop * 0.72);
  }
  if (sipsa?.eggs?.aaUnitCop && sipsa.eggs.aaUnitCop > 0) {
    eggUnitCopBySpecies.gallina = sipsa.eggs.aaUnitCop;
  }
  return { meatKgCopBySpecies, eggUnitCopBySpecies };
}
