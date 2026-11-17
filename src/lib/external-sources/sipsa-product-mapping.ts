export type SipsaIProductMappings = Record<string, string>;

function normalizedPart(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable identity for an official SIPSA-I product/presentation equivalence. */
export function getSipsaIProductMappingKey(dimensions: Record<string, unknown>): string | null {
  const cpcCode = normalizedPart(dimensions.cpcCode);
  const article = normalizedPart(dimensions.article);
  const presentation = normalizedPart(dimensions.presentation ?? dimensions.characteristics);
  if (!cpcCode || !article || !presentation) return null;
  return JSON.stringify([cpcCode, article, presentation]);
}

export function parseSipsaIProductMappings(raw?: string): SipsaIProductMappings {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([key, value]) => key.length <= 1000 && typeof value === "string" && value.length <= 100,
      ),
    ) as SipsaIProductMappings;
  } catch {
    return {};
  }
}
