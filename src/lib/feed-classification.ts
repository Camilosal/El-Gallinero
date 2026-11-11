export const FEED_CURRENT_CATEGORIES = ["Concentrado", "En Fresco", "Preparados"] as const;
export const FEED_CURRENT_TYPES = [
  "Bore o Raices",
  "Concentrado Aves",
  "Concentrado Codorniz",
  "Concentrado Conejos",
  "Forraje Verde",
  "Maiz en Grano",
  "Maíz Germinado",
  "Mosca Soldado",
  "Otro",
  "Pastos y gramíneas",
  "Purinas",
] as const;

const legacyCategories = ["granja_fresco", "granja_procesado", "suplementario"] as const;
const legacyTypes = [
  "mosca_soldado",
  "pastos_gramineas",
  "maiz_germinado",
  "bore_raices",
  "purinas",
  "maiz_comprado",
  "concentrado_comercial",
  "otro",
] as const;

export type FeedCategory = (typeof legacyCategories)[number] | (typeof FEED_CURRENT_CATEGORIES)[number];
export type FeedType = (typeof legacyTypes)[number] | (typeof FEED_CURRENT_TYPES)[number];

function normalizeLabel(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function normalizeEnumValue<T extends string>(value: unknown, values: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (values.includes(trimmed as T)) return trimmed as T;
  const normalized = normalizeLabel(trimmed);
  return values.find((candidate) => normalizeLabel(candidate) === normalized) || null;
}

export function normalizeFeedCategory(value: unknown): FeedCategory | null {
  return normalizeEnumValue(value, [...legacyCategories, ...FEED_CURRENT_CATEGORIES]);
}

export function normalizeFeedType(value: unknown): FeedType | null {
  return normalizeEnumValue(value, [...legacyTypes, ...FEED_CURRENT_TYPES]);
}

export function currentFeedCategory(value: unknown): (typeof FEED_CURRENT_CATEGORIES)[number] | null {
  const category = normalizeFeedCategory(value);
  if (!category) return null;
  if (category === "granja_fresco") return "En Fresco";
  if (category === "granja_procesado") return "Preparados";
  if (category === "suplementario") return "Concentrado";
  return category;
}

export function currentFeedType(value: unknown): FeedType | null {
  const type = normalizeFeedType(value);
  if (!type) return null;
  const legacyToCurrent: Partial<Record<FeedType, FeedType>> = {
    bore_raices: "Bore o Raices",
    maiz_germinado: "Maíz Germinado",
    maiz_comprado: "Maiz en Grano",
    mosca_soldado: "Mosca Soldado",
    pastos_gramineas: "Pastos y gramíneas",
    purinas: "Purinas",
    otro: "Otro",
  };
  return legacyToCurrent[type] || type;
}

export function isPurchasedFeedCategory(value: unknown): boolean {
  const category = normalizeFeedCategory(value);
  return category === "suplementario" || category === "Concentrado";
}

export function isFreshFeedCategory(value: unknown): boolean {
  const category = normalizeFeedCategory(value);
  return category === "granja_fresco" || category === "En Fresco";
}

export function feedCategoryLabel(value: unknown): string {
  const category = normalizeFeedCategory(value);
  if (category === "granja_fresco") return "En Fresco";
  if (category === "granja_procesado") return "Preparados";
  if (category === "suplementario") return "Concentrado";
  return category || (typeof value === "string" ? value : "");
}

export function feedTypeLabel(value: unknown): string {
  const type = normalizeFeedType(value);
  const legacyLabels: Partial<Record<FeedType, string>> = {
    bore_raices: "Bore o Raices",
    concentrado_comercial: "Concentrado Comercial (anterior)",
    maiz_comprado: "Maiz en Grano",
    maiz_germinado: "Maíz Germinado",
    mosca_soldado: "Mosca Soldado",
    otro: "Otro",
    pastos_gramineas: "Pastos y gramíneas",
    purinas: "Purinas",
  };
  if (!type) return typeof value === "string" ? value : "";
  return legacyLabels[type] || type;
}
