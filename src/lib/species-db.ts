import { db } from "@/db";
import { catalogos } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { SPECIES_PARAMS, type SpeciesProductionParams } from "./species-params";

/** Orden canónico de especies para reportes y desgloses. */
export const SPECIES_ORDER = ["gallina", "pollo", "codorniz", "pato", "conejo"] as const;
export type SpeciesKey = (typeof SPECIES_ORDER)[number];

export const SPECIES_LABEL: Record<string, string> = {
  gallina: "Gallina",
  pollo: "Pollo",
  codorniz: "Codorniz",
  pato: "Pato",
  conejo: "Conejo",
};

export const SPECIES_PLURAL: Record<string, string> = {
  gallina: "Gallinas",
  pollo: "Pollos",
  codorniz: "Codornices",
  pato: "Patos",
  conejo: "Conejos",
};

export const SPECIES_ICON: Record<string, string> = {
  gallina: "🐔",
  gallo: "🐓",
  pollo: "🐤",
  codorniz: "🥚",
  pato: "🦆",
  conejo: "🐇",
};

/** Especies que son aves (el conejo queda por fuera del término "aves"). */
export const BIRD_SPECIES = new Set(["gallina", "pollo", "codorniz", "pato"]);

export function isBirdSpecies(species: string): boolean {
  return BIRD_SPECIES.has(species);
}

export function speciesLabel(species: string, plural = false): string {
  const map = plural ? SPECIES_PLURAL : SPECIES_LABEL;
  return map[species] || species;
}

export function speciesIcon(species: string): string {
  return SPECIES_ICON[species] || "🐾";
}

/** Normaliza texto libre ("gallinas", "Gallina", "pollos", "conejos") a la clave del enum. */
export function normalizeSpecies(input: string): SpeciesKey | null {
  const text = String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!text) return null;

  const aliases: Record<string, SpeciesKey> = {
    gallina: "gallina",
    gallinas: "gallina",
    gallo: "gallina",
    gallos: "gallina",
    pollo: "pollo",
    pollos: "pollo",
    pollito: "pollo",
    pollitos: "pollo",
    codorniz: "codorniz",
    codornices: "codorniz",
    pato: "pato",
    patos: "pato",
    conejo: "conejo",
    conejos: "conejo",
  };

  return aliases[text] || null;
}

export interface SpeciesDbParams extends SpeciesProductionParams {
  id?: string;
  isActive?: boolean;
}

export function defaultEggPrice(species: string): number {
  const prices: Record<string, number> = { gallina: 600, codorniz: 300, pato: 800 };
  return prices[species] || 500;
}

function rowToParams(row: typeof catalogos.$inferSelect): SpeciesDbParams {
  const species = row.tipo || "gallina";
  const cycleWeeks = row.minWeeks ?? 8;
  return {
    id: row.id,
    species,
    breed: row.value,
    label: row.value,
    icon: speciesIcon(species),
    cycleWeeks,
    cycleDays: row.maxWeeks ?? cycleWeeks * 7,
    targetWeightKg: Number(row.targetWeightKg ?? 2),
    carcassYieldPercent: row.units ?? 70,
    dailyFeedGPerHead: row.dailyFeedG ?? 100,
    feedCostPerKgCOP: Number(row.feedCostPerKg ?? 2800),
    feedConversionRatio: Number(row.feedConversionRatio ?? 2.5),
    marketPriceKgCanalCOP: Number(row.price ?? 14000),
    marketPriceEggUnitCOP: row.eggPrice
      ? Number(row.eggPrice)
      : row.expectedEggsPerHen && Number(row.expectedEggsPerHen) > 0
        ? defaultEggPrice(species)
        : undefined,
    eggsPerDayPerFemale: row.expectedEggsPerHen ? Number(row.expectedEggsPerHen) : undefined,
    systemType: row.systemType || "piso",
    notes: row.description || "",
    isActive: row.isActive,
  };
}

/**
 * Carga los parámetros productivos desde Catálogos (params_especie).
 * Si la tabla está vacía o falla, usa la referencia estática como respaldo.
 */
export async function loadSpeciesParams(species?: string): Promise<SpeciesDbParams[]> {
  const fallback = species
    ? SPECIES_PARAMS.filter((p) => p.species === species)
    : SPECIES_PARAMS;

  try {
    const conditions = [eq(catalogos.category, "params_especie"), eq(catalogos.isActive, true)];
    if (species) conditions.push(eq(catalogos.tipo, species));

    const rows = await db
      .select()
      .from(catalogos)
      .where(and(...conditions))
      .orderBy(asc(catalogos.sortOrder), asc(catalogos.value));

    if (rows.length === 0) return fallback;
    return rows.map(rowToParams);
  } catch {
    return fallback;
  }
}

/** Primer registro (registro base) por especie. */
export async function loadDefaultSpeciesParams(species: string): Promise<SpeciesDbParams | undefined> {
  const rows = await loadSpeciesParams(species);
  return rows[0];
}

/** Precio de mercado por kg canal, tomando el primer registro activo de cada especie. */
export async function loadSpeciesPriceMap(): Promise<Record<string, number>> {
  const rows = await loadSpeciesParams();
  const map: Record<string, number> = {};
  for (const row of rows) {
    if (map[row.species] === undefined) {
      map[row.species] = row.marketPriceKgCanalCOP;
    }
  }
  return map;
}

/** Precio de referencia por huevo, tomando el primer registro activo de cada especie. */
export async function loadEggPriceMap(): Promise<Record<string, number>> {
  const rows = await loadSpeciesParams();
  const map: Record<string, number> = {};
  for (const row of rows) {
    if (map[row.species] === undefined) {
      map[row.species] = row.marketPriceEggUnitCOP ?? defaultEggPrice(row.species);
    }
  }
  return map;
}
