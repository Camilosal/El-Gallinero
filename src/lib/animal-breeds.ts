export type ManagedAnimalSpecies = "gallina" | "pollo" | "codorniz" | "pato" | "conejo" | "cuy";

export const MANAGED_SPECIES: { value: ManagedAnimalSpecies; label: string }[] = [
  { value: "gallina", label: "Gallina" },
  { value: "pollo", label: "Pollo" },
  { value: "codorniz", label: "Codorniz" },
  { value: "pato", label: "Pato" },
  { value: "conejo", label: "Conejo" },
  { value: "cuy", label: "Cuy" },
];

/** Razas base asociadas al tipo de animal; pueden ampliarse desde Catálogos. */
export const DEFAULT_BREEDS_BY_SPECIES: Record<ManagedAnimalSpecies, string[]> = {
  gallina: ["Rhode Island Red", "Leghorn", "Plymouth Rock", "Sussex", "Marans", "Araucana", "Isa Brown", "Criolla", "Otra"],
  pollo: ["Cobb 500 / Ross 308", "Cobb 500", "Ross 308", "Criollo / Campero"],
  codorniz: ["Coturnix japonica"],
  pato: ["Pato Pekín", "Pato Muscovy (Criollo)"],
  conejo: ["Nueva Zelanda / California"],
  cuy: ["Cuy Mejorado (Andino)", "Cuy Criollo"],
};

const SPECIES_ALIASES: Record<string, ManagedAnimalSpecies> = {
  gallina: "gallina", gallinas: "gallina", gallo: "gallina", gallos: "gallina",
  pollo: "pollo", pollos: "pollo", pollito: "pollo", pollitos: "pollo",
  codorniz: "codorniz", codornices: "codorniz",
  pato: "pato", patos: "pato",
  conejo: "conejo", conejos: "conejo",
  cuy: "cuy", cuyes: "cuy", cobayo: "cuy", cobayos: "cuy", curi: "cuy",
};

const HISTORICAL_BREED_ALIASES: Record<ManagedAnimalSpecies, string[]> = {
  gallina: ["ISA Brown"],
  pollo: ["Pollo de engorde (Cobb 500 / Ross 308)", "Pollo criollo / campero"],
  codorniz: ["Codorniz Japónica", "Codorniz Japónica (Doble propósito)"],
  pato: ["Pato Muscovy / Criollo", "Pato Muscovy (Criollo)"],
  conejo: ["Conejo de engorde (Nueva Zelanda / California)"],
  cuy: ["Cuy Mejorado", "Cuy Mejorado (Perú / Andino)", "Perú", "Andina"],
};

function normalized(value: string): string {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeManagedSpecies(value: string | null | undefined): ManagedAnimalSpecies | null {
  if (!value) return null;
  return SPECIES_ALIASES[normalized(value)] || null;
}

export function speciesForAcquisitionType(birdType: string): ManagedAnimalSpecies | null {
  if (birdType === "gallina" || birdType === "gallo") return "gallina";
  if (birdType === "lote_pollos") return "pollo";
  return normalizeManagedSpecies(birdType);
}

export interface AnimalBreedCatalogItem {
  value: string;
  tipo?: string | null;
}

/**
 * Combina las razas asociadas en el catálogo con opciones base para instalaciones
 * antiguas. Las filas sin especie pertenecen al catálogo histórico de gallinas.
 */
export function getBreedsForSpecies(
  items: AnimalBreedCatalogItem[],
  species: ManagedAnimalSpecies,
  currentValue?: string | null,
): string[] {
  const catalogSpecies = (item: AnimalBreedCatalogItem): ManagedAnimalSpecies | null =>
    normalizeManagedSpecies(item.tipo) || (!item.tipo ? canonicalBreedType(item.value) || "gallina" : null);
  const catalogValues = items.flatMap((item) => {
    const associatedSpecies = catalogSpecies(item);
    return associatedSpecies === species ? [item.value] : [];
  });
  const currentKey = normalized(currentValue || "");
  const currentItem = currentKey
    ? items.find((item) => normalized(item.value) === currentKey)
    : undefined;
  const currentSpecies = currentItem
    ? catalogSpecies(currentItem)
    : canonicalBreedType(currentValue || "");
  const compatibleCurrentValue = currentSpecies === species && currentValue?.trim() ? [currentValue.trim()] : [];
  const fallbackValues = DEFAULT_BREEDS_BY_SPECIES[species].filter((breed) => {
    const existing = items.find((item) => normalized(item.value) === normalized(breed));
    return !existing || catalogSpecies(existing) === species;
  });
  const candidates = [
    ...catalogValues,
    ...fallbackValues,
    ...compatibleCurrentValue,
  ];
  const seen = new Set<string>();
  return candidates.filter((value) => {
    const key = normalized(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function canonicalBreedType(value: string): ManagedAnimalSpecies | null {
  const key = normalized(value);
  for (const [species, breeds] of Object.entries(DEFAULT_BREEDS_BY_SPECIES) as [ManagedAnimalSpecies, string[]][]) {
    if ([...breeds, ...HISTORICAL_BREED_ALIASES[species]].some((breed) => normalized(breed) === key)) return species;
  }
  return null;
}

export function speciesLabelEs(species: ManagedAnimalSpecies): string {
  return MANAGED_SPECIES.find((item) => item.value === species)?.label || species;
}
