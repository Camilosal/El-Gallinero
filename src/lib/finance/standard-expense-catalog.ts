import {
  RAW_STANDARD_EXPENSE_CATALOG,
  type ExpenseDriverType,
  type ExpenseTreatmentType,
  type RawStandardExpenseEntry,
} from "./standard-expense-catalog-data";

export type {
  ExpenseCsvState,
  ExpenseDriverType,
  ExpensePriority,
  ExpenseTreatmentType,
  RawStandardExpenseEntry,
} from "./standard-expense-catalog-data";

export type ExpenseAccountingNature =
  | "operating_income"
  | "capex"
  | "feed_inventory_purchase"
  | "supply_inventory_purchase"
  | "biological_stock_acquisition"
  | "operating_expense";

export type ExpenseTaxProfileHint = "agro" | "purchases" | "services" | "general" | "none";

export interface StandardExpenseItem extends RawStandardExpenseEntry {
  isOpex: boolean;
  isSharedProrationCandidate: boolean;
  isFeedModuleConcept: boolean;
  isCapexConcept: boolean;
  isBiologicalConcept: boolean;
  isNonAttributableCost: boolean;
  isFinancialConcept: boolean;
  defaultLegacyCategory: string;
  defaultSystemUnit: "unidades" | "kg" | "litros" | "otro";
  defaultTaxProfile: ExpenseTaxProfileHint;
  isPurchaseWorkflow: boolean;
  supportsSupplyInventoryLink: boolean;
  recommendedProrationBasis: "head_count" | "biomass" | "feed_kg" | "area_m2" | "manual";
}

export interface StandardExpenseFamilyMeta {
  code: string;
  name: string;
  label: string;
  defaultTreatment: ExpenseTreatmentType;
  defaultDriver: ExpenseDriverType;
  isOpex: boolean;
  isNonFeedExpense: boolean;
  conceptsCount: number;
  p1Count: number;
  sharedConceptsCount: number;
  defaultLegacyCategory: string;
  defaultTaxProfile: ExpenseTaxProfileHint;
  isPurchaseWorkflow: boolean;
  recommendedProrationBasis: "head_count" | "biomass" | "feed_kg" | "area_m2" | "manual";
}

export const OPEX_TREATMENTS = new Set<ExpenseTreatmentType>(["VARIABLE", "FIJO", "EXISTENTE_V4"]);

export const TREATMENT_LABELS: Record<ExpenseTreatmentType, string> = {
  VARIABLE: "OPEX Variable",
  FIJO: "OPEX Fijo",
  EXISTENTE_V4: "OPEX Producción / V4",
  CAPEX: "CapEx / Inversión",
  BIOLOGICO: "Activo Biológico",
  ALIMENTO: "Alimentación (módulo)",
  FINANCIERO: "Financiero / Fiscal",
  MERMA: "Pérdida / Merma",
  NO_COSTO: "No atribuible al ave",
};

export const DRIVER_LABELS: Record<ExpenseDriverType, string> = {
  UNIDAD_MENSUAL: "Por unidad / mes",
  MES: "Cargo mensual fijo",
  EVENTO: "Por evento",
  HUEVO_VENDIDO: "Por huevo vendido",
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function inferSystemUnit(costUnit: string): "unidades" | "kg" | "litros" | "otro" {
  const u = normalizeText(costUnit);
  if (u.includes("kg")) return "kg";
  if (u.includes("litro") || u.includes("m3")) return "litros";
  if (u.includes("mes") || u.includes("cargo") || u.includes("tramite") || u.includes("hora")) return "otro";
  return "unidades";
}

function inferDefaultLegacyCategory(entry: RawStandardExpenseEntry): string {
  switch (entry.familyCode) {
    case "01":
    case "02":
      return "Control sanitario";
    case "03":
    case "04":
    case "08":
    case "09":
    case "10":
    case "11":
    case "12":
    case "13":
    case "19":
      return "Compra de insumos";
    case "05":
    case "06":
      return "Servicios (agua/luz)";
    case "07":
      return "Mantenimiento";
    case "14":
      return "Comercialización";
    case "15":
      return "Transporte";
    case "16":
    case "17":
    case "18":
    case "20":
    case "21":
    case "25":
    case "26":
      return "Otro egreso";
    case "22":
      return "Equipamiento";
    case "23":
      return "Compra de animales";
    case "24":
      return "Compra de alimento";
    default:
      return "Otro egreso";
  }
}

function inferDefaultTaxProfile(entry: RawStandardExpenseEntry): ExpenseTaxProfileHint {
  if (entry.treatment === "FINANCIERO" || entry.treatment === "NO_COSTO" || entry.treatment === "MERMA") {
    return "none";
  }
  const c = normalizeText(entry.concept);
  if (
    ["02", "07", "14", "15", "16", "17", "18"].includes(entry.familyCode) ||
    /(servicio|veterin|laboratorio|reparaci|mantenimiento|transporte|flete|alquiler|vigilancia|impuesto|tasa|licencia|certificaci|publicidad|internet|cuota)/.test(c)
  ) {
    if (/(impuesto|tasa|multa|predial|licencia|comision|interes|gmf|gravamen)/.test(c)) {
      return "none";
    }
    return "services";
  }
  if (entry.familyCode === "22") return "purchases";
  if (entry.familyCode === "23") return "agro";
  return "purchases";
}

function inferPurchaseWorkflow(entry: RawStandardExpenseEntry): boolean {
  if (["FIJO", "FINANCIERO", "NO_COSTO", "MERMA"].includes(entry.treatment)) return false;
  if (["01", "03", "04", "08", "22", "23", "24"].includes(entry.familyCode)) return true;
  const c = normalizeText(entry.concept);
  return /(compra|adquisici|insumo|vacuna|jeringa|desinfectante|viruta|cascarilla|cubeta|empaque|bolsa|filtro|cartucho|lampara|cuchilla)/.test(c);
}

function inferSupportsSupplyLink(entry: RawStandardExpenseEntry): boolean {
  if (!OPEX_TREATMENTS.has(entry.treatment)) return false;
  if (["01", "03", "04", "08", "09", "10", "11", "12", "13"].includes(entry.familyCode)) {
    const c = normalizeText(entry.concept);
    return !/(alquiler|servicio|cuota|mortalidad|energia|agua|gas)/.test(c);
  }
  return false;
}

function inferProrationBasis(familyCode: string): "head_count" | "biomass" | "feed_kg" | "area_m2" | "manual" {
  if (["06", "07", "09", "17"].includes(familyCode)) return "area_m2";
  if (["15"].includes(familyCode)) return "feed_kg";
  if (["01", "02", "03", "05", "19"].includes(familyCode)) return "head_count";
  return "manual";
}

export const STANDARD_EXPENSE_CATALOG: ReadonlyArray<StandardExpenseItem> = RAW_STANDARD_EXPENSE_CATALOG.map((entry) => ({
  ...entry,
  isOpex: OPEX_TREATMENTS.has(entry.treatment),
  isSharedProrationCandidate: entry.poultryAllocationPct === 0,
  isFeedModuleConcept: entry.treatment === "ALIMENTO",
  isCapexConcept: entry.treatment === "CAPEX",
  isBiologicalConcept: entry.treatment === "BIOLOGICO",
  isNonAttributableCost: entry.treatment === "NO_COSTO" || entry.treatment === "MERMA",
  isFinancialConcept: entry.treatment === "FINANCIERO",
  defaultLegacyCategory: inferDefaultLegacyCategory(entry),
  defaultSystemUnit: inferSystemUnit(entry.costUnit),
  defaultTaxProfile: inferDefaultTaxProfile(entry),
  isPurchaseWorkflow: inferPurchaseWorkflow(entry),
  supportsSupplyInventoryLink: inferSupportsSupplyLink(entry),
  recommendedProrationBasis: inferProrationBasis(entry.familyCode),
}));

const ITEM_BY_ID = new Map(STANDARD_EXPENSE_CATALOG.map((item) => [item.id.toUpperCase(), item]));

export const STANDARD_EXPENSE_FAMILIES: ReadonlyArray<StandardExpenseFamilyMeta> = (() => {
  const byFamily = new Map<string, StandardExpenseItem[]>();
  for (const item of STANDARD_EXPENSE_CATALOG) {
    const list = byFamily.get(item.family) || [];
    list.push(item);
    byFamily.set(item.family, list);
  }
  return Array.from(byFamily.entries()).map(([family, items]) => {
    const first = items[0];
    const p1Count = items.filter((i) => i.priority === "P1").length;
    const sharedConceptsCount = items.filter((i) => i.isSharedProrationCandidate).length;
    const hasOpex = items.some((i) => i.isOpex);
    return {
      code: first.familyCode,
      name: family,
      label: first.familyLabel,
      defaultTreatment: first.treatment,
      defaultDriver: first.driver,
      isOpex: hasOpex,
      isNonFeedExpense: first.familyCode !== "24",
      conceptsCount: items.length,
      p1Count,
      sharedConceptsCount,
      defaultLegacyCategory: first.defaultLegacyCategory,
      defaultTaxProfile: first.defaultTaxProfile,
      isPurchaseWorkflow: items.some((i) => i.isPurchaseWorkflow),
      recommendedProrationBasis: first.recommendedProrationBasis,
    };
  });
})();

const FAMILY_BY_NORMALIZED_NAME = new Map<string, StandardExpenseFamilyMeta>();
for (const fam of STANDARD_EXPENSE_FAMILIES) {
  FAMILY_BY_NORMALIZED_NAME.set(normalizeText(fam.name), fam);
  FAMILY_BY_NORMALIZED_NAME.set(normalizeText(fam.label), fam);
  FAMILY_BY_NORMALIZED_NAME.set(normalizeText(fam.code), fam);
}

/** Familias estándar no alimentarias (excluye 24 Alimentación en otro módulo) + opciones clave. */
export const NON_FEED_STANDARD_EXPENSE_FAMILIES = STANDARD_EXPENSE_FAMILIES.filter((f) => f.isNonFeedExpense);

/** Familias operativas de consumo rápido en campo (1 toque en QuickCapture y móviles). */
export const QUICK_CAPTURE_STANDARD_FAMILY_NAMES = [
  "01 Sanidad preventiva",
  "03 Bioseguridad",
  "04 Cama y limpieza",
  "06 Energía y clima",
  "07 Equipos e infraestructura",
  "08 Clasificación y empaque",
  "14 Comercialización",
  "15 Transporte y logística",
  "16 Administración y TIC",
] as const;

export function findStandardExpenseById(id: string | null | undefined): StandardExpenseItem | null {
  if (!id) return null;
  const trimmed = id.trim().toUpperCase();
  return ITEM_BY_ID.get(trimmed) || null;
}

export function findStandardExpenseFamily(familyOrCode: string | null | undefined): StandardExpenseFamilyMeta | null {
  if (!familyOrCode) return null;
  return FAMILY_BY_NORMALIZED_NAME.get(normalizeText(familyOrCode)) || null;
}

export function searchStandardExpenseCatalog(
  query: string,
  filters?: {
    family?: string;
    treatment?: string;
    priority?: string;
    opexOnly?: boolean;
    excludeFood?: boolean;
  },
): StandardExpenseItem[] {
  const q = normalizeText(query);
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const familyFilter = filters?.family && filters.family !== "all" ? normalizeText(filters.family) : "";

  return STANDARD_EXPENSE_CATALOG.filter((item) => {
    if (filters?.excludeFood && item.isFeedModuleConcept) return false;
    if (filters?.opexOnly && !item.isOpex) return false;
    if (familyFilter && normalizeText(item.family) !== familyFilter && normalizeText(item.familyCode) !== familyFilter && normalizeText(item.familyLabel) !== familyFilter) {
      return false;
    }
    if (filters?.treatment && filters.treatment !== "all" && item.treatment !== filters.treatment) {
      return false;
    }
    if (filters?.priority && filters.priority !== "all" && item.priority !== filters.priority) {
      return false;
    }
    if (tokens.length === 0) return true;
    const haystack = normalizeText(
      `${item.id} ${item.family} ${item.concept} ${item.treatment} ${item.driver} ${item.costUnit} ${item.controlNote}`,
    );
    return tokens.every((tok) => haystack.includes(tok));
  });
}

export const LEGACY_EXPENSE_CATEGORY_TO_FAMILY: Record<string, { family: string; defaultCatalogId?: string; treatment?: ExpenseTreatmentType }> = {
  "control sanitario": { family: "01 Sanidad preventiva", defaultCatalogId: "CST-001", treatment: "VARIABLE" },
  "compra de insumos": { family: "03 Bioseguridad", treatment: "VARIABLE" },
  "mantenimiento": { family: "07 Equipos e infraestructura", treatment: "VARIABLE" },
  "servicios (agua/luz)": { family: "06 Energía y clima", treatment: "VARIABLE" },
  "servicios": { family: "06 Energía y clima", treatment: "VARIABLE" },
  "energia / servicios": { family: "06 Energía y clima", treatment: "VARIABLE" },
  "mano de obra": { family: "Mano de obra (Nómina / jornales)", treatment: "FIJO" },
  "compra de gallinas": { family: "23 Activo biológico", defaultCatalogId: "CST-269", treatment: "BIOLOGICO" },
  "compra de animales": { family: "23 Activo biológico", defaultCatalogId: "CST-270", treatment: "BIOLOGICO" },
  "equipamiento": { family: "22 Activos / inversión", treatment: "CAPEX" },
  "infraestructura": { family: "22 Activos / inversión", treatment: "CAPEX" },
  "compra de alimento": { family: "24 Alimentación (en otro módulo)", defaultCatalogId: "CST-278", treatment: "ALIMENTO" },
  "transporte": { family: "15 Transporte y logística", treatment: "VARIABLE" },
  "comercializacion": { family: "14 Comercialización", treatment: "VARIABLE" },
  "otro egreso": { family: "16 Administración y TIC", treatment: "FIJO" },
  "otros gastos": { family: "16 Administración y TIC", treatment: "FIJO" },
};

function inferConceptByDescription(description: string, family?: string | null): StandardExpenseItem | null {
  const desc = normalizeText(description);
  if (!desc) return null;

  if (/(vacuna|vacunaci)/.test(desc)) return ITEM_BY_ID.get("CST-001") || null;
  if (/(jeringa|aguja)/.test(desc)) return ITEM_BY_ID.get("CST-002") || null;
  if (/(desinfectante|pediluvio|amonio)/.test(desc)) return ITEM_BY_ID.get("CST-024") || null;
  if (/(viruta)/.test(desc)) return ITEM_BY_ID.get("CST-038") || null;
  if (/(cascarilla)/.test(desc)) return ITEM_BY_ID.get("CST-039") || null;
  if (/(cubeta|carton)/.test(desc) && /(huevo|empaque|cubeta)/.test(desc)) return ITEM_BY_ID.get("CST-090") || null;
  if (/(veterinari|consulta)/.test(desc)) return ITEM_BY_ID.get("CST-010") || null;
  if (/(laboratorio|diagnostico|prueba)/.test(desc)) return ITEM_BY_ID.get("CST-012") || null;
  if (/(agua|acueducto)/.test(desc)) return ITEM_BY_ID.get("CST-053") || null;
  if (/(luz|energ|electricidad|kwh)/.test(desc)) return ITEM_BY_ID.get("CST-064") || null;
  if (/(gas|propano|calefacci)/.test(desc)) return ITEM_BY_ID.get("CST-068") || null;
  if (/(combustible|gasolina|acpm|peaje|flete|domicilio)/.test(desc)) return ITEM_BY_ID.get("CST-178") || null;
  if (/(internet|datos|software|aplicacion|plan)/.test(desc)) return ITEM_BY_ID.get("CST-191") || null;
  if (/(seguro|poliza)/.test(desc)) return ITEM_BY_ID.get("CST-204") || null;
  if (/(predial)/.test(desc)) return ITEM_BY_ID.get("CST-210") || null;
  if (/(interes|prestamo)/.test(desc)) return ITEM_BY_ID.get("CST-245") || null;
  if (/(bancari|comision|gmf|4x1000)/.test(desc)) return ITEM_BY_ID.get("CST-246") || null;
  if (/(bebedero|comedero|cerca|malla|puerta|techo|reparaci|mantenimiento)/.test(desc) && (!family || family.startsWith("07") || normalizeText(family) === "mantenimiento")) {
    if (/bebedero/.test(desc)) return ITEM_BY_ID.get("CST-077") || null;
    if (/comedero/.test(desc)) return ITEM_BY_ID.get("CST-076") || null;
    return ITEM_BY_ID.get("CST-078") || null;
  }

  return null;
}

export interface ResolvedExpenseClassification {
  category: string;
  expenseCatalogId: string | null;
  expenseFamily: string | null;
  expenseConcept: string | null;
  expenseTreatment: ExpenseTreatmentType | string | null;
  expenseDriver: ExpenseDriverType | string | null;
  isOpex: boolean;
  accountingNature: ExpenseAccountingNature;
  taxProfile: ExpenseTaxProfileHint;
  isStandardMatched: boolean;
  standardItem: StandardExpenseItem | null;
}

/**
 * Resuelve de manera unificada la clasificación estándar de cualquier egreso,
 * presupuesto, prorrateo o transacción histórica sin romper categorías legadas.
 */
export function resolveExpenseClassification(input: {
  type?: string | null;
  category?: string | null;
  expenseCatalogId?: string | null;
  expenseFamily?: string | null;
  expenseConcept?: string | null;
  expenseTreatment?: string | null;
  expenseDriver?: string | null;
  description?: string | null;
  sourceType?: string | null;
}): ResolvedExpenseClassification {
  const txType = String(input.type || "egreso").toLowerCase();
  if (txType === "ingreso") {
    return {
      category: String(input.category || "Otro ingreso").trim() || "Otro ingreso",
      expenseCatalogId: null,
      expenseFamily: null,
      expenseConcept: null,
      expenseTreatment: null,
      expenseDriver: null,
      isOpex: false,
      accountingNature: "operating_income",
      taxProfile: "agro",
      isStandardMatched: false,
      standardItem: null,
    };
  }

  // 1. Coincidencia exacta por código CST-xxx explícito o embebido en categoría/descripción
  const embeddedCodeMatch = String(input.category || "").match(/\b(CST-\d{3})\b/i);
  const directStd =
    findStandardExpenseById(input.expenseCatalogId) ||
    findStandardExpenseById(embeddedCodeMatch?.[1]);

  if (directStd) {
    const category =
      input.category && input.category.trim() && !findStandardExpenseById(input.category.trim())
        ? input.category.trim()
        : directStd.family;
    return {
      category,
      expenseCatalogId: directStd.id,
      expenseFamily: directStd.family,
      expenseConcept: directStd.concept,
      expenseTreatment: directStd.treatment,
      expenseDriver: directStd.driver,
      isOpex: directStd.isOpex,
      accountingNature: inferAccountingNature({
        category,
        description: input.description,
        sourceType: input.sourceType,
        expenseFamily: directStd.family,
        expenseTreatment: directStd.treatment,
      }),
      taxProfile: directStd.defaultTaxProfile,
      isStandardMatched: true,
      standardItem: directStd,
    };
  }

  // 2. Coincidencia exacta por nombre o código de Familia / centro ("01 Sanidad preventiva", "01", "Sanidad preventiva")
  const explicitFamilyMeta =
    findStandardExpenseFamily(input.expenseFamily) ||
    findStandardExpenseFamily(input.category);

  const normalizedDescItem = inferConceptByDescription(input.description || "", explicitFamilyMeta?.name || input.category);

  if (explicitFamilyMeta) {
    const matchedInFamily =
      normalizedDescItem && normalizedDescItem.family === explicitFamilyMeta.name
        ? normalizedDescItem
        : null;
    const category =
      input.category && input.category.trim() ? input.category.trim() : explicitFamilyMeta.name;
    const treatment = (matchedInFamily?.treatment || input.expenseTreatment || explicitFamilyMeta.defaultTreatment) as ExpenseTreatmentType;
    return {
      category,
      expenseCatalogId: matchedInFamily?.id || input.expenseCatalogId || null,
      expenseFamily: explicitFamilyMeta.name,
      expenseConcept: matchedInFamily?.concept || input.expenseConcept?.trim() || null,
      expenseTreatment: treatment,
      expenseDriver: matchedInFamily?.driver || input.expenseDriver || explicitFamilyMeta.defaultDriver,
      isOpex: OPEX_TREATMENTS.has(treatment),
      accountingNature: inferAccountingNature({
        category,
        description: input.description,
        sourceType: input.sourceType,
        expenseFamily: explicitFamilyMeta.name,
        expenseTreatment: treatment,
      }),
      taxProfile: matchedInFamily?.defaultTaxProfile || explicitFamilyMeta.defaultTaxProfile,
      isStandardMatched: true,
      standardItem: matchedInFamily,
    };
  }

  // 3. Mapeo determinístico desde categorías históricas del sistema / módulos
  const rawCategory = String(input.category || "Otro egreso").trim() || "Otro egreso";
  const normCat = normalizeText(rawCategory);
  const descText = normalizeText(input.description || "");
  const legacyHit = LEGACY_EXPENSE_CATEGORY_TO_FAMILY[normCat];

  let inferredFamily: string | null = input.expenseFamily || legacyHit?.family || null;
  let inferredCatalogId: string | null = input.expenseCatalogId || legacyHit?.defaultCatalogId || null;
  let inferredTreatment: string | null = input.expenseTreatment || legacyHit?.treatment || null;

  // Desambiguación inteligente por texto de descripción / módulo origen
  if (normCat === "servicios (agua/luz)" || normCat === "servicios" || normCat === "energia / servicios") {
    if (/(agua|acueducto|filtro|bomba)/.test(descText) && !/(luz|energ|electric)/.test(descText)) {
      inferredFamily = "05 Agua y suministro";
      inferredCatalogId = normalizedDescItem?.family === "05 Agua y suministro" ? normalizedDescItem.id : "CST-053";
    } else {
      inferredFamily = "06 Energía y clima";
      inferredCatalogId = normalizedDescItem?.family === "06 Energía y clima" ? normalizedDescItem.id : "CST-064";
    }
    inferredTreatment = "VARIABLE";
  } else if (normCat === "compra de insumos" || normCat === "insumos") {
    if (normalizedDescItem && normalizedDescItem.isOpex) {
      inferredFamily = normalizedDescItem.family;
      inferredCatalogId = normalizedDescItem.id;
      inferredTreatment = normalizedDescItem.treatment;
    }
  } else if (normCat === "control sanitario" || input.sourceType === "sanidad") {
    if (normalizedDescItem && (normalizedDescItem.familyCode === "01" || normalizedDescItem.familyCode === "02" || normalizedDescItem.familyCode === "03")) {
      inferredFamily = normalizedDescItem.family;
      inferredCatalogId = normalizedDescItem.id;
    } else if (/(tratamiento|medicamento|antibiotico|antiparasit|consulta|veterinari|desparasit)/.test(descText)) {
      inferredFamily = "02 Diagnóstico y tratamientos";
      inferredCatalogId = normalizedDescItem?.id || "CST-010";
    } else if (/(fumigac|desinfecc|bioseguridad)/.test(descText)) {
      inferredFamily = "03 Bioseguridad";
      inferredCatalogId = "CST-024";
    } else {
      inferredFamily = "01 Sanidad preventiva";
      inferredCatalogId = "CST-001";
    }
    inferredTreatment = "VARIABLE";
  } else if (normCat === "mantenimiento" || input.sourceType === "mantenimiento") {
    inferredFamily = "07 Equipos e infraestructura";
    inferredCatalogId = normalizedDescItem?.familyCode === "07" ? normalizedDescItem.id : "CST-078";
    inferredTreatment = "VARIABLE";
  } else if (normCat === "equipamiento" || input.sourceType === "farm_asset" || input.sourceType === "capex") {
    inferredFamily = "22 Activos / inversión";
    inferredTreatment = "CAPEX";
  } else if (normCat === "compra de gallinas" || normCat === "compra de animales" || input.sourceType === "adquisicion" || input.sourceType === "flock_acquisition" || input.sourceType === "broiler_batch") {
    inferredFamily = "23 Activo biológico";
    inferredCatalogId = /(pollito|pollita)/.test(descText) ? "CST-270" : /(gallo|reproductor)/.test(descText) ? "CST-271" : "CST-269";
    inferredTreatment = "BIOLOGICO";
  } else if (normCat === "compra de alimento" || input.sourceType === "alimento" || input.sourceType === "feed_purchase") {
    inferredFamily = "24 Alimentación (en otro módulo)";
    inferredCatalogId = "CST-278";
    inferredTreatment = "ALIMENTO";
  } else if (normCat === "mano de obra" || input.sourceType === "payroll") {
    inferredFamily = "Mano de obra (Nómina / jornales)";
    inferredTreatment = /(salario|mensual|nomina|produccion)/.test(descText) ? "FIJO" : "VARIABLE";
  } else if (normalizedDescItem && !legacyHit) {
    inferredFamily = normalizedDescItem.family;
    inferredCatalogId = normalizedDescItem.id;
    inferredTreatment = normalizedDescItem.treatment;
  }

  const resolvedItem = findStandardExpenseById(inferredCatalogId);
  const resolvedFamMeta = findStandardExpenseFamily(inferredFamily);
  const finalTreatment = (inferredTreatment || resolvedItem?.treatment || resolvedFamMeta?.defaultTreatment || "VARIABLE") as ExpenseTreatmentType;

  return {
    category: rawCategory,
    expenseCatalogId: resolvedItem?.id || inferredCatalogId || null,
    expenseFamily: resolvedFamMeta?.name || inferredFamily || null,
    expenseConcept: resolvedItem?.concept || input.expenseConcept?.trim() || null,
    expenseTreatment: finalTreatment,
    expenseDriver: resolvedItem?.driver || resolvedFamMeta?.defaultDriver || input.expenseDriver || null,
    isOpex: inferredFamily === "Mano de obra (Nómina / jornales)" ? true : OPEX_TREATMENTS.has(finalTreatment),
    accountingNature: inferAccountingNature({
      category: rawCategory,
      description: input.description,
      sourceType: input.sourceType,
      expenseFamily: resolvedFamMeta?.name || inferredFamily,
      expenseTreatment: finalTreatment,
    }),
    taxProfile:
      inferredFamily === "Mano de obra (Nómina / jornales)"
        ? "none"
        : resolvedItem?.defaultTaxProfile || resolvedFamMeta?.defaultTaxProfile || "purchases",
    isStandardMatched: Boolean(resolvedItem || resolvedFamMeta || legacyHit),
    standardItem: resolvedItem,
  };
}

export function inferAccountingNature(input: {
  category?: string | null;
  description?: string | null;
  sourceType?: string | null;
  expenseFamily?: string | null;
  expenseTreatment?: string | null;
}): ExpenseAccountingNature {
  const cat = normalizeText(input.category);
  const sourceType = normalizeText(input.sourceType);
  const desc = normalizeText(input.description);
  const family = normalizeText(input.expenseFamily);
  const treatment = String(input.expenseTreatment || "").toUpperCase();

  if (
    treatment === "CAPEX" ||
    family.startsWith("22 ") ||
    sourceType === "farm_asset" ||
    sourceType === "capex" ||
    /equipamiento|infraestructura|maquinaria|activo|construcci|equipo/.test(cat) ||
    /compra capex|bebedero|comedero|criadora|galpon|jaula/.test(desc)
  ) {
    // Excepción explícita del catálogo: Familia 07 ("Equipos e infraestructura") es reparación/mantenimiento OPEX
    if (!family.startsWith("07 ") && !cat.startsWith("07 ")) {
      return "capex";
    }
  }

  if (
    treatment === "ALIMENTO" ||
    family.startsWith("24 ") ||
    sourceType === "feed_purchase" ||
    sourceType === "alimento" ||
    sourceType === "feed_inventory" ||
    /alimento|concentrado|nutrici|bulto|sal_mineral/.test(cat)
  ) {
    return "feed_inventory_purchase";
  }

  if (
    sourceType === "supply_purchase" ||
    sourceType === "insumo" ||
    sourceType === "supply_inventory" ||
    /compra de insumos|compra_insumos/.test(cat)
  ) {
    return "supply_inventory_purchase";
  }

  if (
    treatment === "BIOLOGICO" ||
    family.startsWith("23 ") ||
    sourceType === "flock_acquisition" ||
    sourceType === "broiler_batch" ||
    sourceType === "adquisicion" ||
    /compra_aves|compra de aves|pollito|pollona|pie de cr|pie_cria|\baves\b|compra de animales|compra de gallinas/.test(cat)
  ) {
    return "biological_stock_acquisition";
  }

  return "operating_expense";
}
