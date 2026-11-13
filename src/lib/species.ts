/**
 * Fuente única de especies soportadas. El enum `animal_species` de la base de
 * datos, los programas de alimentación, las validaciones de API y los reportes
 * deben derivar de esta lista para no duplicarla.
 */
export const ANIMAL_SPECIES = ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"] as const;
export type AnimalSpecies = (typeof ANIMAL_SPECIES)[number];

/** Especies para las que existe un programa de alimentación (incluye gallos reproductores). */
export const FEEDING_SPECIES = ["gallina", "gallo", "pollo", "codorniz", "pato", "conejo", "cuy"] as const;
export type FeedingSpecies = (typeof FEEDING_SPECIES)[number];

export function isAnimalSpecies(value: unknown): value is AnimalSpecies {
  return typeof value === "string" && (ANIMAL_SPECIES as readonly string[]).includes(value);
}

export function isFeedingSpecies(value: unknown): value is FeedingSpecies {
  return typeof value === "string" && (FEEDING_SPECIES as readonly string[]).includes(value);
}

/** Normaliza texto libre a una especie de alimentación conocida o null. */
export function normalizeFeedingSpecies(value: unknown): FeedingSpecies | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  return isFeedingSpecies(normalized) ? normalized : null;
}

export const SPECIES_LABELS: Record<FeedingSpecies, { singular: string; plural: string }> = {
  gallina: { singular: "gallina", plural: "gallinas" },
  gallo: { singular: "gallo", plural: "gallos" },
  pollo: { singular: "pollo", plural: "pollos" },
  codorniz: { singular: "codorniz", plural: "codornices" },
  pato: { singular: "pato", plural: "patos" },
  conejo: { singular: "conejo", plural: "conejos" },
  cuy: { singular: "cuy", plural: "cuyes" },
};

