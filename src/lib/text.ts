/** Normaliza texto para búsquedas: sin tildes, minúsculas y sin signos. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Comprueba si todos los tokens de la consulta aparecen en alguno de los
 * valores. Útil para filtrar tablas por varias columnas a la vez.
 */
export function matchesTextQuery(
  query: string,
  values: Array<string | number | null | undefined>,
): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeText(
    values
      .filter((value) => value !== null && value !== undefined)
      .join(" "),
  );

  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}
