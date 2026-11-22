import {
  RAW_STANDARD_FEED_CATALOG,
  type RawStandardFeedEntry,
  type SanitaryStatus,
} from "./standard-feed-catalog-data";
import { FEED_CURRENT_CATEGORIES, FEED_CURRENT_TYPES } from "@/lib/feed-classification";

export type FeedCategoryCurrent = (typeof FEED_CURRENT_CATEGORIES)[number];
export type FeedTypeCurrent = (typeof FEED_CURRENT_TYPES)[number];

export interface StandardFeedItem extends RawStandardFeedEntry {
  defaultCategory: FeedCategoryCurrent;
  defaultFeedType: FeedTypeCurrent;
  defaultUnit: "kg";
  crudeProteinAsFedPct: number | null;
  missingCriticalFields: string[];
  isBlocked: boolean;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function inferDefaultCategory(entry: RawStandardFeedEntry): FeedCategoryCurrent {
  if (entry.group === "Balanceados") return "Concentrado";

  const pres = (entry.presentation || "").toLocaleLowerCase("es");
  const name = entry.name.toLocaleLowerCase("es");

  if (
    entry.group === "Hojas y forrajes" ||
    entry.group === "Hortalizas y verduras" ||
    entry.group === "Frutas"
  ) {
    if (pres.includes("deshidratad") || pres.includes("seca") || pres.includes("seco") || pres.includes("hojuelas") || name.includes("deshidratad") || name.includes("seco")) {
      return "Preparados";
    }
    return "En Fresco";
  }

  if (entry.group === "Insectos y anélidos") {
    return pres.includes("fresca") || pres.includes("viva") || name.includes("fresc") || name.includes("roja fresca")
      ? "En Fresco"
      : "Preparados";
  }

  if (entry.group === "Raíces y tubérculos") {
    return pres.includes("harina") || pres.includes("seco") || pres.includes("deshidratad") || name.includes("harina")
      ? "Preparados"
      : "En Fresco";
  }

  return "Preparados";
}

function inferDefaultFeedType(entry: RawStandardFeedEntry): FeedTypeCurrent {
  const name = entry.name.toLocaleLowerCase("es");
  const group = entry.group;

  if (group === "Balanceados") return "Concentrado Aves";
  if (group === "Insectos y anélidos" && (name.includes("bsf") || name.includes("mosca"))) {
    return "Mosca Soldado";
  }
  if (group === "Cereales y semillas") {
    if (name.includes("germinado") || name.includes("hidropónico")) return "Maíz Germinado";
    if (name.includes("maíz") && !name.includes("germinado")) return "Maiz en Grano";
    return "Purinas";
  }
  if (group === "Raíces y tubérculos") return "Bore o Raices";
  if (group === "Hojas y forrajes") {
    return name.includes("pasto") || name.includes("alfalfa") ? "Pastos y gramíneas" : "Forraje Verde";
  }
  return "Otro";
}

function collectMissingCriticalFields(entry: RawStandardFeedEntry): string[] {
  const missing: string[] = [];
  if (entry.dryMatterPct === null) missing.push("MS %");
  if (entry.crudeProteinDmPct === null) missing.push("PB % MS");
  if (entry.energyKcalKgDm === null) missing.push("EM kcal/kg MS");
  if (entry.calciumDmPct === null) missing.push("Ca % MS");
  if (entry.availablePhosphorusDmPct === null) missing.push("P disp % MS");
  return missing;
}

export const STANDARD_FEED_CATALOG: ReadonlyArray<StandardFeedItem> = RAW_STANDARD_FEED_CATALOG.map((entry) => ({
  ...entry,
  defaultCategory: inferDefaultCategory(entry),
  defaultFeedType: inferDefaultFeedType(entry),
  defaultUnit: "kg",
  crudeProteinAsFedPct:
    entry.dryMatterPct !== null && entry.crudeProteinDmPct !== null
      ? round2((entry.crudeProteinDmPct * entry.dryMatterPct) / 100)
      : null,
  missingCriticalFields: collectMissingCriticalFields(entry),
  isBlocked: entry.sanitaryStatus === "NO USAR",
}));

export const STANDARD_FEED_GROUPS: ReadonlyArray<string> = Array.from(
  new Set(STANDARD_FEED_CATALOG.map((item) => item.group)),
);

const BY_ID = new Map<string, StandardFeedItem>(STANDARD_FEED_CATALOG.map((item) => [item.id, item]));

export function findStandardFeedById(id: string | null | undefined): StandardFeedItem | null {
  if (!id) return null;
  return BY_ID.get(id.trim().toUpperCase()) || null;
}

function normalizeSearch(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function searchStandardFeedCatalog(
  query = "",
  options: { group?: string; includeBlocked?: boolean; sanitaryStatus?: SanitaryStatus } = {},
): StandardFeedItem[] {
  const normalizedQuery = normalizeSearch(query);
  return STANDARD_FEED_CATALOG.filter((item) => {
    if (options.includeBlocked === false && item.isBlocked) return false;
    if (options.group && options.group !== "all" && item.group !== options.group) return false;
    if (options.sanitaryStatus && item.sanitaryStatus !== options.sanitaryStatus) return false;
    if (!normalizedQuery) return true;
    const haystack = normalizeSearch(
      [item.id, item.name, item.botanicalName || "", item.group, item.presentation || ""].join(" "),
    );
    return haystack.includes(normalizedQuery);
  });
}

export interface StoredNutritionProfile {
  group?: string | null;
  botanicalName?: string | null;
  presentation?: string | null;
  origin?: string | null;
  preparation?: string | null;
  evidenceQuality?: string | null;
  risks?: string | null;
  sourceUrl?: string | null;
  compositionNotes?: string | null;
  crudeProteinDmPct?: number | null;
  fatDmPct?: number | null;
  totalPhosphorusDmPct?: number | null;
  formulationStatus?: string | null;
}

export interface FeedNutritionSourceInput {
  name?: string | null;
  standardCatalogId?: string | null;
  sanitaryStatus?: string | null;
  dryMatterPct?: string | number | null;
  crudeProteinPct?: string | number | null;
  energyKcalKgDm?: string | number | null;
  calciumDmPct?: string | number | null;
  availablePhosphorusDmPct?: string | number | null;
  lysineDigDmPct?: string | number | null;
  metCysDigDmPct?: string | number | null;
  crudeFiberDmPct?: string | number | null;
  nutritionProfile?: StoredNutritionProfile | null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Combina datos guardados del inventario con el catálogo estándar IG-xxx para evaluación nutricional.
 * Prioriza los valores ingresados por el productor sobre la referencia base.
 */
export function resolveEffectiveFeedProfile(feed: FeedNutritionSourceInput) {
  const std = findStandardFeedById(feed.standardCatalogId);
  const profile = (feed.nutritionProfile ?? {}) as StoredNutritionProfile;

  const dryMatterPct = toNumberOrNull(feed.dryMatterPct) ?? std?.dryMatterPct ?? null;
  const crudeProteinAsFedPct = toNumberOrNull(feed.crudeProteinPct);
  const crudeProteinDmPct =
    crudeProteinAsFedPct !== null && dryMatterPct && dryMatterPct > 0
      ? round2((crudeProteinAsFedPct / dryMatterPct) * 100)
      : toNumberOrNull(profile.crudeProteinDmPct) ?? std?.crudeProteinDmPct ?? null;

  const sanitaryStatus =
    (feed.sanitaryStatus as SanitaryStatus | undefined) ??
    std?.sanitaryStatus ??
    null;

  return {
    standardCatalogId: std?.id ?? (feed.standardCatalogId || null),
    standardItem: std,
    sanitaryStatus,
    dryMatterPct,
    crudeProteinAsFedPct:
      crudeProteinAsFedPct ??
      (crudeProteinDmPct !== null && dryMatterPct !== null
        ? round2((crudeProteinDmPct * dryMatterPct) / 100)
        : null),
    crudeProteinDmPct,
    energyKcalKgDm: toNumberOrNull(feed.energyKcalKgDm) ?? std?.energyKcalKgDm ?? null,
    calciumDmPct: toNumberOrNull(feed.calciumDmPct) ?? std?.calciumDmPct ?? null,
    availablePhosphorusDmPct:
      toNumberOrNull(feed.availablePhosphorusDmPct) ?? std?.availablePhosphorusDmPct ?? null,
    lysineDigDmPct: toNumberOrNull(feed.lysineDigDmPct) ?? std?.lysineDigDmPct ?? null,
    metCysDigDmPct: toNumberOrNull(feed.metCysDigDmPct) ?? std?.metCysDigDmPct ?? null,
    crudeFiberDmPct: toNumberOrNull(feed.crudeFiberDmPct) ?? std?.crudeFiberDmPct ?? null,
    preparation: profile.preparation ?? std?.preparation ?? null,
    risks: profile.risks ?? std?.risks ?? null,
    sourceUrl: profile.sourceUrl ?? std?.sourceUrl ?? null,
  };
}
