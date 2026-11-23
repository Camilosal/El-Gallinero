export const FEED_CATALOG_GROUPS = [
  "Balanceados",
  "Cereales y semillas",
  "Frutas",
  "Hojas y forrajes",
  "Hortalizas y verduras",
  "Insectos y anélidos",
  "Minerales y aditivos",
  "Raíces y tubérculos",
  "Recuperados y subproductos",
] as const;

export type FeedCatalogGroup = (typeof FEED_CATALOG_GROUPS)[number];

export const FEED_CURRENT_CATEGORIES = ["Concentrado", "En Fresco", "Preparados"] as const;
export const FEED_CURRENT_TYPES = [
  "Bore o Raices",
  "Concentrado Aves",
  "Concentrado Pollo Engorde",
  "Concentrado Codorniz",
  "Concentrado Patos",
  "Concentrado Conejos",
  "Concentrado Cuyes",
  "Concentrado Multiespecie",
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
    concentrado_comercial: "Concentrado Aves",
    maiz_germinado: "Maíz Germinado",
    maiz_comprado: "Maiz en Grano",
    mosca_soldado: "Mosca Soldado",
    pastos_gramineas: "Pastos y gramíneas",
    purinas: "Purinas",
    otro: "Otro",
  };
  return legacyToCurrent[type] || type;
}

export function normalizeFeedCatalogGroup(value: unknown): FeedCatalogGroup | null {
  return normalizeEnumValue(value, FEED_CATALOG_GROUPS);
}

export function inferFeedCatalogGroup(
  feedType: unknown,
  name?: string | null,
  category?: unknown,
): FeedCatalogGroup {
  const normalizedType = currentFeedType(feedType) || normalizeFeedType(feedType);
  const hay = normalizeLabel(`${name || ""} ${String(feedType || "")}`);
  if (
    normalizedType === "Concentrado Aves" ||
    normalizedType === "Concentrado Pollo Engorde" ||
    normalizedType === "Concentrado Codorniz" ||
    normalizedType === "Concentrado Patos" ||
    normalizedType === "Concentrado Conejos" ||
    normalizedType === "Concentrado Cuyes" ||
    normalizedType === "Concentrado Multiespecie" ||
    hay.includes("concentrado") ||
    hay.includes("balanceado")
  ) {
    return "Balanceados";
  }
  if (normalizedType === "Mosca Soldado" || hay.includes("bsf") || hay.includes("mosca") || hay.includes("lombriz") || hay.includes("tenebrio") || hay.includes("grillo")) {
    return "Insectos y anélidos";
  }
  if (normalizedType === "Bore o Raices" || hay.includes("bore") || hay.includes("batata") || hay.includes("yuca") || hay.includes("papa") || hay.includes("camote")) {
    return "Raíces y tubérculos";
  }
  if (normalizedType === "Maiz en Grano" || normalizedType === "Maíz Germinado" || normalizedType === "Purinas" || hay.includes("maiz") || hay.includes("sorgo") || hay.includes("trigo") || hay.includes("arroz") || hay.includes("semilla")) {
    return "Cereales y semillas";
  }
  if (normalizedType === "Pastos y gramíneas" || normalizedType === "Forraje Verde" || hay.includes("pasto") || hay.includes("forraje") || hay.includes("alfalfa") || hay.includes("graminea") || hay.includes("boton de oro")) {
    return "Hojas y forrajes";
  }
  if (hay.includes("carbonato") || hay.includes("conchilla") || hay.includes("sal") || hay.includes("fosfato") || hay.includes("calcio") || hay.includes("premezcla")) {
    return "Minerales y aditivos";
  }
  if (hay.includes("fruta") || hay.includes("guayaba") || hay.includes("banano") || hay.includes("platano") || hay.includes("papaya")) {
    return "Frutas";
  }
  if (hay.includes("zanahoria") || hay.includes("auyama") || hay.includes("repollo") || hay.includes("hortaliza") || hay.includes("verdura")) {
    return "Hortalizas y verduras";
  }
  if (hay.includes("salvado") || hay.includes("suero") || hay.includes("afrecho") || hay.includes("subproducto") || hay.includes("recuperado")) {
    return "Recuperados y subproductos";
  }
  if (currentFeedCategory(category) === "Concentrado") return "Balanceados";
  if (currentFeedCategory(category) === "En Fresco") return "Hojas y forrajes";
  return "Cereales y semillas";
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
    concentrado_comercial: "Concentrado Aves",
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
