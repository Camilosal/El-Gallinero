import {
  RAW_STANDARD_CAPEX_CATALOG,
  type CapexClassificationType,
  type CapexDestinationType,
  type CapexPriority,
  type RawStandardCapexEntry,
} from "./standard-capex-catalog-data";

export type {
  CapexClassificationType,
  CapexCsvState,
  CapexDestinationType,
  CapexPriority,
  RawStandardCapexEntry,
} from "./standard-capex-catalog-data";

export type LegacyAssetCategory = "equipo" | "herramienta" | "estructura" | "vehiculo" | "otro";

export interface CapexFrontierRedirect {
  href: string;
  moduleLabel: string;
  reason: string;
}

export interface StandardCapexItem extends RawStandardCapexEntry {
  isPhysicalOrIntangibleCapex: boolean;
  isDepreciable: boolean;
  isNonDepreciableLand: boolean;
  isFrontierExclusion: boolean;
  defaultLegacyCategory: LegacyAssetCategory;
  suggestedExpenseCatalogId: string;
  frontierRedirect: CapexFrontierRedirect | null;
}

export interface StandardCapexFamilyMeta {
  code: string;
  name: string;
  label: string;
  subfamilies: string[];
  conceptsCount: number;
  p1Count: number;
  defaultClassification: CapexClassificationType;
  defaultDestination: CapexDestinationType;
  defaultLegacyCategory: LegacyAssetCategory;
  isFrontierFamily: boolean;
}

export interface StandardCapexSubfamilyMeta {
  family: string;
  familyCode: string;
  subfamily: string;
  conceptsCount: number;
  defaultClassification: CapexClassificationType;
}

export const PHYSICAL_CAPEX_CLASSIFICATIONS = new Set<CapexClassificationType>([
  "CAPEX_DEPRECIABLE",
  "CAPEX_NO_DEPRECIABLE",
  "INTANGIBLE_AMORTIZABLE",
]);

export const DEPRECIABLE_CAPEX_CLASSIFICATIONS = new Set<CapexClassificationType>([
  "CAPEX_DEPRECIABLE",
  "INTANGIBLE_AMORTIZABLE",
]);

export const NON_CAPEX_FRONTIER_CLASSIFICATIONS = new Set<CapexClassificationType>([
  "ACTIVO_BIOLOGICO",
  "INVENTARIO",
  "OPEX_NO_CAPEX",
  "FINANCIACION",
]);

export const CAPEX_CLASSIFICATION_LABELS: Record<CapexClassificationType, string> = {
  CAPEX_DEPRECIABLE: "CapEx Depreciable",
  CAPEX_NO_DEPRECIABLE: "CapEx No Depreciable (Terreno)",
  INTANGIBLE_AMORTIZABLE: "Intangible Amortizable",
  ACTIVO_BIOLOGICO: "Frontera: Activo Biológico",
  INVENTARIO: "Frontera: Inventario",
  OPEX_NO_CAPEX: "Frontera: Gasto OPEX",
  FINANCIACION: "Frontera: Financiación (Deuda)",
};

export const CAPEX_DESTINATIONS: readonly CapexDestinationType[] = [
  "Compartido",
  "Huevos",
  "Aves/carne",
  "Reproducción",
  "Gallinaza/compost",
];

export const CAPEX_DESTINATION_LABELS: Record<CapexDestinationType, string> = {
  Compartido: "Compartido (multidestino)",
  Huevos: "Huevos (postura)",
  "Aves/carne": "Aves / Carne (engorde)",
  Reproducción: "Reproducción e incubación",
  "Gallinaza/compost": "Gallinaza y compostaje",
};

export const LEGACY_ASSET_CATEGORY_LABELS: Record<LegacyAssetCategory, string> = {
  equipo: "Equipo / maquinaria",
  estructura: "Estructura / infraestructura",
  herramienta: "Herramienta durable",
  vehiculo: "Vehículo / transporte",
  otro: "Otro / intangible",
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

export function getCapexFrontierRedirect(
  classification: CapexClassificationType,
  concept?: string | null,
): CapexFrontierRedirect | null {
  if (classification === "ACTIVO_BIOLOGICO") {
    return {
      href: "/produccion/adquisiciones",
      moduleLabel: "Producción → Adquisiciones",
      reason:
        "Las aves, pollitas y reproductores vivos son Activo Biológico: se registran en Adquisiciones para trazabilidad, postura/engorde y valoración biológica, no en Activos fijos.",
    };
  }
  if (classification === "INVENTARIO") {
    return {
      href: "/almacen",
      moduleLabel: "Almacén → Alimentos / Insumos",
      reason:
        "El alimento concentrado y los insumos/cama almacenados son Inventario de consumo PEPS, no activos fijos depreciables.",
    };
  }
  if (classification === "FINANCIACION") {
    return {
      href: "/finanzas/egresos",
      moduleLabel: "Finanzas → Egresos (Financiación)",
      reason:
        "La cuota de capital de un préstamo corresponde a Financiación / servicio de deuda (Familia 26), no a un activo físico.",
    };
  }
  if (classification === "OPEX_NO_CAPEX") {
    const norm = normalizeText(concept);
    if (/(vacuna|medicamento)/.test(norm)) {
      return {
        href: "/inventarios",
        moduleLabel: "Inventarios / Insumos sanitarios",
        reason:
          "Las vacunas y medicamentos consumibles van al inventario de insumos sanitarios y OPEX de Sanidad, no como activo CapEx.",
      };
    }
    if (/(reparacion)/.test(norm)) {
      return {
        href: "/operaciones/mantenimiento",
        moduleLabel: "Almacén → Mantenimiento",
        reason:
          "Las reparaciones menores que no extienden la vida útil del activo se registran como OPEX de Mantenimiento, no como nuevo activo CapEx.",
      };
    }
    return {
      href: "/finanzas/egresos",
      moduleLabel: "Finanzas → Egresos (Catálogo OPEX)",
      reason:
        "Suscripciones, arrendamientos, intereses, servicios contratados y fungibles cortos son gasto OPEX o costo financiero del período, no activos capitalizables.",
    };
  }
  return null;
}

export function inferLegacyAssetCategoryFromCapex(input: {
  familyCode?: string | null;
  subfamily?: string | null;
  concept?: string | null;
  classification?: CapexClassificationType | string | null;
  legacyCategory?: string | null;
}): LegacyAssetCategory {
  const rawLegacy = normalizeText(input.legacyCategory);
  if (
    rawLegacy === "equipo" ||
    rawLegacy === "herramienta" ||
    rawLegacy === "estructura" ||
    rawLegacy === "vehiculo" ||
    rawLegacy === "otro"
  ) {
    // Only override if no explicit standard family/subfamily points more specifically
    if (!input.familyCode && !input.concept) return rawLegacy;
  }

  const conceptNorm = normalizeText(input.concept);
  const subNorm = normalizeText(input.subfamily);
  const famCode = String(input.familyCode ?? "").trim();

  if (
    /(vehiculo|motocarro|camioneta|furgon|remolque|trailer|triciclo de carga|moto de reparto)/.test(
      conceptNorm,
    )
  ) {
    return "vehiculo";
  }
  if (
    famCode === "17" ||
    subNorm.includes("herramientas") ||
    /(machete|pala|carretilla|tijera|herramienta|martillo|fumigadora de espalda|botas|overol durable)/.test(
      conceptNorm,
    )
  ) {
    return "herramienta";
  }
  if (
    famCode === "01" ||
    famCode === "02" ||
    famCode === "18" ||
    famCode === "20" ||
    subNorm === "alojamiento" ||
    subNorm === "terreno" ||
    subNorm === "obras compartidas" ||
    subNorm === "seguridad / rotacion"
  ) {
    return "estructura";
  }
  if (famCode === "21" || input.classification === "INTANGIBLE_AMORTIZABLE") {
    return famCode === "19" ? "otro" : "otro";
  }
  if (famCode) {
    return "equipo";
  }
  if (
    rawLegacy === "equipo" ||
    rawLegacy === "herramienta" ||
    rawLegacy === "estructura" ||
    rawLegacy === "vehiculo" ||
    rawLegacy === "otro"
  ) {
    return rawLegacy;
  }
  return "equipo";
}

function inferSuggestedExpenseCatalogId(entry: RawStandardCapexEntry): string {
  const c = normalizeText(entry.concept);
  const fam = entry.familyCode;
  if (fam === "20") return "CST-255";
  if (fam === "01") {
    return /(ampliacion|extension|modulo adicional|anexo)/.test(c) ? "CST-256" : "CST-255";
  }
  if (fam === "02") return "CST-261";
  if (fam === "07" && /(incubadora|nacedora)/.test(c)) return "CST-257";
  if (/(bomba|motobomba|hidroneumatic)/.test(c)) return "CST-258";
  if (/(tanque|reservorio|cisterna|almacenamiento de agua)/.test(c)) return "CST-264";
  if (/(panel solar|fotovoltaic|inversor solar)/.test(c)) return "CST-259";
  if (/(refrigerador|nevera|congelador|cuarto frio|enfriador)/.test(c)) return "CST-260";
  if (/(comedero|tolva|silo)/.test(c)) return "CST-262";
  if (/(bebedero|niple)/.test(c)) return "CST-263";
  if (fam === "11" || /(compost|biodigestor|secado de gallinaza)/.test(c)) return "CST-265";
  if (fam === "15" || /(bascula|balanza|pesa|dinamometro|medidor|termohigrometro|sensor)/.test(c)) {
    return "CST-266";
  }
  if (/(vehiculo|motocarro|camioneta|furgon|remolque)/.test(c)) return "CST-267";
  if (fam === "18") return "CST-255";
  return "CST-268";
}

export const STANDARD_CAPEX_CATALOG: readonly StandardCapexItem[] = RAW_STANDARD_CAPEX_CATALOG.map(
  (entry) => ({
    ...entry,
    isPhysicalOrIntangibleCapex: PHYSICAL_CAPEX_CLASSIFICATIONS.has(entry.classification),
    isDepreciable: DEPRECIABLE_CAPEX_CLASSIFICATIONS.has(entry.classification),
    isNonDepreciableLand: entry.classification === "CAPEX_NO_DEPRECIABLE",
    isFrontierExclusion: NON_CAPEX_FRONTIER_CLASSIFICATIONS.has(entry.classification),
    defaultLegacyCategory: inferLegacyAssetCategoryFromCapex({
      familyCode: entry.familyCode,
      subfamily: entry.subfamily,
      concept: entry.concept,
      classification: entry.classification,
    }),
    suggestedExpenseCatalogId: inferSuggestedExpenseCatalogId(entry),
    frontierRedirect: getCapexFrontierRedirect(entry.classification, entry.concept),
  }),
);

const CAPEX_BY_ID = new Map<string, StandardCapexItem>();
const CAPEX_BY_CONCEPT = new Map<string, StandardCapexItem>();

for (const item of STANDARD_CAPEX_CATALOG) {
  CAPEX_BY_ID.set(item.id.toUpperCase(), item);
  CAPEX_BY_CONCEPT.set(normalizeText(item.concept), item);
}

function buildFamilies(): StandardCapexFamilyMeta[] {
  const map = new Map<string, StandardCapexItem[]>();
  for (const item of STANDARD_CAPEX_CATALOG) {
    const arr = map.get(item.family) ?? [];
    arr.push(item);
    map.set(item.family, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([name, items]) => {
      const first = items[0];
      const subfamilies = Array.from(new Set(items.map((i) => i.subfamily)));
      const p1Count = items.filter((i) => i.priority === "P1").length;
      return {
        code: first.familyCode,
        name,
        label: first.familyLabel,
        subfamilies,
        conceptsCount: items.length,
        p1Count,
        defaultClassification: first.classification,
        defaultDestination: first.destination,
        defaultLegacyCategory: first.defaultLegacyCategory,
        isFrontierFamily: first.familyCode === "21",
      };
    });
}

function buildSubfamilies(): StandardCapexSubfamilyMeta[] {
  const map = new Map<string, StandardCapexItem[]>();
  for (const item of STANDARD_CAPEX_CATALOG) {
    const key = `${item.family}::${item.subfamily}`;
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return Array.from(map.values()).map((items) => ({
    family: items[0].family,
    familyCode: items[0].familyCode,
    subfamily: items[0].subfamily,
    conceptsCount: items.length,
    defaultClassification: items[0].classification,
  }));
}

export const STANDARD_CAPEX_FAMILIES: readonly StandardCapexFamilyMeta[] = buildFamilies();
export const PRODUCTIVE_CAPEX_FAMILIES: readonly StandardCapexFamilyMeta[] =
  STANDARD_CAPEX_FAMILIES.filter((f) => !f.isFrontierFamily);
export const STANDARD_CAPEX_SUBFAMILIES: readonly StandardCapexSubfamilyMeta[] = buildSubfamilies();

const FAMILY_BY_NORM = new Map<string, StandardCapexFamilyMeta>();
for (const fam of STANDARD_CAPEX_FAMILIES) {
  FAMILY_BY_NORM.set(normalizeText(fam.name), fam);
  FAMILY_BY_NORM.set(normalizeText(fam.label), fam);
  FAMILY_BY_NORM.set(fam.code, fam);
}

export function findStandardCapexById(id: string | null | undefined): StandardCapexItem | null {
  if (!id) return null;
  return CAPEX_BY_ID.get(String(id).trim().toUpperCase()) ?? null;
}

export function findStandardCapexFamily(
  input: string | null | undefined,
): StandardCapexFamilyMeta | null {
  if (!input) return null;
  const norm = normalizeText(input);
  return FAMILY_BY_NORM.get(norm) ?? null;
}

export function searchStandardCapexCatalog(
  query = "",
  filters: {
    family?: string;
    subfamily?: string;
    classification?: string;
    destination?: string;
    priority?: string;
    excludeFrontier?: boolean;
  } = {},
): StandardCapexItem[] {
  const normQ = normalizeText(query);
  return STANDARD_CAPEX_CATALOG.filter((item) => {
    if (filters.excludeFrontier && item.isFrontierExclusion) return false;
    if (filters.family && filters.family !== "all" && item.family !== filters.family) return false;
    if (filters.subfamily && filters.subfamily !== "all" && item.subfamily !== filters.subfamily) {
      return false;
    }
    if (
      filters.classification &&
      filters.classification !== "all" &&
      item.classification !== filters.classification
    ) {
      return false;
    }
    if (
      filters.destination &&
      filters.destination !== "all" &&
      item.destination !== filters.destination
    ) {
      return false;
    }
    if (filters.priority && filters.priority !== "all" && item.priority !== filters.priority) {
      return false;
    }
    if (!normQ) return true;
    const haystack = normalizeText(
      `${item.id} ${item.family} ${item.subfamily} ${item.concept} ${item.destination} ${item.driver} ${item.classificationNote}`,
    );
    return haystack.includes(normQ);
  });
}

function matchCapexConceptFromText(text: string): StandardCapexItem | null {
  const norm = normalizeText(text);
  if (!norm) return null;
  const direct = CAPEX_BY_CONCEPT.get(norm);
  if (direct) return direct;

  // Heuristic matching for legacy free-text asset names
  if (/(terreno|lote de tierra|predio|finca raiz)/.test(norm)) {
    return findStandardCapexById("CAP-228");
  }
  if (/(panel solar|fotovoltaic|inversor solar|bateria solar)/.test(norm)) {
    return (
      findStandardCapexById("CAP-049") ||
      (findStandardCapexFamily("05") && STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "05")) ||
      null
    );
  }
  if (/(incubadora|nacedora)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "07" && /incubadora/.test(normalizeText(c.concept))) ?? null;
  }
  if (/(bomba|motobomba|hidroneumatic)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "04" && /bomba/.test(normalizeText(c.concept))) ?? null;
  }
  if (/(tanque|reservorio|cisterna)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "04" && /tanque/.test(normalizeText(c.concept))) ?? null;
  }
  if (/(bebedero|niple)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "04" && /bebedero/.test(normalizeText(c.concept))) ?? null;
  }
  if (/(comedero|tolva|silo)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "06") ?? null;
  }
  if (/(nidal|nido|percha|jaula)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "03") ?? null;
  }
  if (/(malla|cerca|cerco|porton|puerta|encierro)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "02") ?? null;
  }
  if (/(gallinero|galpon|nave|cobertizo|techo|estructura)/.test(norm)) {
    return findStandardCapexById("CAP-001");
  }
  if (/(compost|biodigestor|lombriz|tenebrio|mosca soldado|bsf|forraje)/.test(norm)) {
    return (
      STANDARD_CAPEX_CATALOG.find((c) =>
        /(11|12|13|14)/.test(c.familyCode) &&
        ((/compost/.test(norm) && c.familyCode === "11") ||
          (/(bsf|mosca)/.test(norm) && c.familyCode === "12") ||
          (/(lombriz|tenebrio)/.test(norm) && c.familyCode === "13") ||
          (/(forraje|germinad)/.test(norm) && c.familyCode === "14")),
      ) ?? null
    );
  }
  if (/(bascula|balanza|sensor|termometro|termohigrometro|medidor|camara)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "15") ?? null;
  }
  if (/(vehiculo|motocarro|camioneta|furgon|remolque)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "16" && /(vehiculo|motocarro|furgon)/.test(normalizeText(c.concept))) ?? null;
  }
  if (/(software|licencia|computador|sistema)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "19") ?? null;
  }
  if (/(carretilla|pala|machete|herramienta|fumigadora)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => c.familyCode === "17") ?? null;
  }
  if (/(refrigerador|nevera|congelador|desplumadora|peladora|empacadora|clasificadora)/.test(norm)) {
    return STANDARD_CAPEX_CATALOG.find((c) => (c.familyCode === "08" || c.familyCode === "10")) ?? null;
  }

  // Fallback by substring against concept
  const words = norm.split(/\s+/).filter((w) => w.length >= 4);
  if (words.length > 0) {
    let best: { item: StandardCapexItem; score: number } | null = null;
    for (const item of STANDARD_CAPEX_CATALOG) {
      if (item.isFrontierExclusion) continue;
      const conceptNorm = normalizeText(item.concept);
      let score = 0;
      for (const w of words) {
        if (conceptNorm.includes(w)) score += 1;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { item, score };
      }
    }
    if (best && best.score >= 1) return best.item;
  }
  return null;
}

export interface CapexClassificationResolution {
  legacyCategory: LegacyAssetCategory;
  capexCatalogId: string | null;
  capexFamily: string | null;
  capexSubfamily: string | null;
  capexClassification: CapexClassificationType;
  capexDestination: CapexDestinationType;
  capexDriver: string;
  suggestedLifeMonths: number | null;
  suggestedResidualRate: number;
  suggestedExpenseCatalogId: string;
  isDepreciable: boolean;
  isNonDepreciableLand: boolean;
  isFrontierExclusion: boolean;
  frontierRedirect: CapexFrontierRedirect | null;
  isStandardMatched: boolean;
  standardItem: StandardCapexItem | null;
}

export function resolveCapexClassification(input: {
  capexCatalogId?: string | null;
  capexFamily?: string | null;
  capexSubfamily?: string | null;
  capexClassification?: string | null;
  capexDestination?: string | null;
  capexDriver?: string | null;
  name?: string | null;
  category?: string | null;
  description?: string | null;
  usefulLifeMonths?: number | string | null;
}): CapexClassificationResolution {
  const byId = findStandardCapexById(input.capexCatalogId);
  const byText = byId ?? matchCapexConceptFromText(`${input.name ?? ""} ${input.description ?? ""}`);
  const explicitFam = findStandardCapexFamily(input.capexFamily);

  // Fallback family from legacy `category` when neither ID nor concept text matches
  const legacyCatNorm = normalizeText(input.category);
  const legacyFallbackFamily =
    legacyCatNorm === "estructura"
      ? findStandardCapexFamily("01")
      : legacyCatNorm === "herramienta"
      ? findStandardCapexFamily("17")
      : legacyCatNorm === "vehiculo"
      ? findStandardCapexFamily("16")
      : legacyCatNorm === "equipo"
      ? findStandardCapexFamily("18")
      : legacyCatNorm === "otro"
      ? findStandardCapexFamily("19")
      : null;

  const standardItem = byId ?? byText ?? null;
  const resolvedFam = explicitFam ?? (standardItem ? findStandardCapexFamily(standardItem.family) : null) ?? legacyFallbackFamily;

  const rawClass = String(input.capexClassification ?? "").trim() as CapexClassificationType;
  const resolvedClassification: CapexClassificationType =
    CAPEX_CLASSIFICATION_LABELS[rawClass]
      ? rawClass
      : standardItem?.classification ?? resolvedFam?.defaultClassification ?? "CAPEX_DEPRECIABLE";

  const rawDest = String(input.capexDestination ?? "").trim() as CapexDestinationType;
  const resolvedDestination: CapexDestinationType =
    CAPEX_DESTINATION_LABELS[rawDest]
      ? rawDest
      : standardItem?.destination ?? resolvedFam?.defaultDestination ?? "Compartido";

  const resolvedDriver =
    (input.capexDriver && input.capexDriver.trim()) ||
    standardItem?.driver ||
    "según activo";

  const resolvedSubfamily =
    (input.capexSubfamily && input.capexSubfamily.trim()) ||
    standardItem?.subfamily ||
    resolvedFam?.subfamilies[0] ||
    null;

  const legacyCategory = inferLegacyAssetCategoryFromCapex({
    familyCode: resolvedFam?.code ?? standardItem?.familyCode ?? null,
    subfamily: resolvedSubfamily,
    concept: standardItem?.concept ?? input.name ?? null,
    classification: resolvedClassification,
    legacyCategory: input.category,
  });

  const isDepreciable = DEPRECIABLE_CAPEX_CLASSIFICATIONS.has(resolvedClassification);
  const isNonDepreciableLand = resolvedClassification === "CAPEX_NO_DEPRECIABLE";
  const isFrontierExclusion = NON_CAPEX_FRONTIER_CLASSIFICATIONS.has(resolvedClassification);

  const suggestedLifeMonths =
    isNonDepreciableLand || isFrontierExclusion
      ? 0
      : standardItem?.suggestedLifeMonths ?? 36;

  return {
    legacyCategory,
    capexCatalogId: standardItem?.id ?? null,
    capexFamily: resolvedFam?.name ?? standardItem?.family ?? null,
    capexSubfamily: resolvedSubfamily,
    capexClassification: resolvedClassification,
    capexDestination: resolvedDestination,
    capexDriver: resolvedDriver,
    suggestedLifeMonths,
    suggestedResidualRate: standardItem?.suggestedResidualRate ?? 0,
    suggestedExpenseCatalogId: standardItem?.suggestedExpenseCatalogId ?? "CST-268",
    isDepreciable,
    isNonDepreciableLand,
    isFrontierExclusion,
    frontierRedirect: getCapexFrontierRedirect(
      resolvedClassification,
      standardItem?.concept ?? input.name,
    ),
    isStandardMatched: Boolean(standardItem || explicitFam),
    standardItem,
  };
}

export function computeSuggestedResidualCop(
  acquisitionCost: number,
  residualRate: number,
): number {
  if (!Number.isFinite(acquisitionCost) || acquisitionCost <= 0) return 0;
  if (!Number.isFinite(residualRate) || residualRate <= 0) return 0;
  return Math.round(acquisitionCost * residualRate);
}

export function capexPriorityBadgeColor(priority: CapexPriority): "green" | "blue" | "gray" {
  if (priority === "P1") return "green";
  if (priority === "P2") return "blue";
  return "gray";
}
