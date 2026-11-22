import { db } from "@/db";
import { catalogos } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { SPECIES_BIOLOGY_FALLBACKS, type SpeciesProductionParams } from "./species-params";

/** Orden canónico de especies para reportes y desgloses. */
export const SPECIES_ORDER = ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"] as const;
export type SpeciesKey = (typeof SPECIES_ORDER)[number];

export const SPECIES_LABEL: Record<string, string> = {
  gallina: "Gallina",
  pollo: "Pollo",
  codorniz: "Codorniz",
  pato: "Pato",
  conejo: "Conejo",
  cuy: "Cuy",
};

export const SPECIES_PLURAL: Record<string, string> = {
  gallina: "Gallinas",
  pollo: "Pollos",
  codorniz: "Codornices",
  pato: "Patos",
  conejo: "Conejos",
  cuy: "Cuyes",
};

export const SPECIES_ICON: Record<string, string> = {
  gallina: "hen",
  gallo: "rooster",
  pollo: "chick",
  codorniz: "egg",
  pato: "duck",
  conejo: "rabbit",
  cuy: "paw-print",
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
  return SPECIES_ICON[species] || "paw-print";
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
    cuy: "cuy",
    cuyes: "cuy",
    cobayo: "cuy",
    cobayos: "cuy",
    curi: "cuy",
  };

  return aliases[text] || null;
}

export interface SpeciesDbParams extends SpeciesProductionParams {
  id?: string;
  isActive?: boolean;
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
    feedCostPerKgCOP: Number(row.feedCostPerKg ?? 0),
    initialUnitCostCOP: row.initialUnitCostCop == null ? undefined : Number(row.initialUnitCostCop),
    pointOfLayUnitValueCOP: row.pointOfLayUnitValueCop == null ? undefined : Number(row.pointOfLayUnitValueCop),
    breederUnitValueCOP: row.breederUnitValueCop == null ? undefined : Number(row.breederUnitValueCop),
    feedConversionRatio: Number(row.feedConversionRatio ?? 2.5),
    marketPriceKgCanalCOP: Number(row.price ?? 0),
    marketPriceEggUnitCOP: row.eggPrice == null ? undefined : Number(row.eggPrice),
    eggsPerDayPerFemale: row.expectedEggsPerHen ? Number(row.expectedEggsPerHen) : undefined,
    systemType: row.systemType || "piso",
    notes: row.description || "",
    isActive: row.isActive,
  };
}

/**
 * Carga los parámetros productivos desde Catálogos (params_especie).
 * Si la tabla está vacía o falla, usa datos biológicos de referencia sin precios ni costos.
 */
export async function loadSpeciesParams(species?: string): Promise<SpeciesDbParams[]> {
  const fallback = species
    ? SPECIES_BIOLOGY_FALLBACKS.filter((p) => p.species === species)
    : SPECIES_BIOLOGY_FALLBACKS;

  try {
    const conditions = [eq(catalogos.category, "params_especie"), eq(catalogos.isActive, true)];
    if (species) conditions.push(eq(catalogos.tipo, species));

    const rows = await db
      .select()
      .from(catalogos)
      .where(and(...conditions))
      .orderBy(asc(catalogos.sortOrder), asc(catalogos.value));

    if (rows.length === 0) return fallback;
    const mapped = rows.map(rowToParams);
    const presentSpecies = new Set(mapped.map((item) => item.species));
    const missingDefaults = fallback.filter((item) => !presentSpecies.has(item.species));
    return missingDefaults.length > 0 ? [...mapped, ...missingDefaults] : mapped;
  } catch {
    return fallback;
  }
}

/** Lee solo precios configurados en Catálogos, sin referencias estáticas ni sustitutos. */
export async function loadSpeciesMasterParams(species?: string): Promise<SpeciesDbParams[]> {
  const conditions = [eq(catalogos.category, "params_especie"), eq(catalogos.isActive, true)];
  if (species) conditions.push(eq(catalogos.tipo, species));
  const rows = await db
    .select()
    .from(catalogos)
    .where(and(...conditions))
    .orderBy(asc(catalogos.sortOrder), asc(catalogos.value));
  return rows.map(rowToParams);
}

/** Primer registro (registro base) por especie. */
export async function loadDefaultSpeciesParams(species: string): Promise<SpeciesDbParams | undefined> {
  const rows = await loadSpeciesParams(species);
  return rows[0];
}

/** Precio de mercado por kg canal, tomando el primer registro activo de cada especie. */
export async function loadSpeciesPriceMap(): Promise<Record<string, number>> {
  const rows = await loadSpeciesMasterParams();
  const map: Record<string, number> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.species)) continue;
    seen.add(row.species);
    if (row.marketPriceKgCanalCOP > 0) map[row.species] = row.marketPriceKgCanalCOP;
  }
  return map;
}

/** Precio de referencia por huevo, tomando el primer registro activo de cada especie. */
export async function loadEggPriceMap(): Promise<Record<string, number>> {
  const rows = await loadSpeciesMasterParams();
  const map: Record<string, number> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.species)) continue;
    seen.add(row.species);
    if (row.marketPriceEggUnitCOP !== undefined && row.marketPriceEggUnitCOP > 0) map[row.species] = row.marketPriceEggUnitCOP;
  }
  return map;
}

export async function loadSpeciesValuationPriceMaps(): Promise<{
  meatKgCopBySpecies: Record<string, number>;
  eggUnitCopBySpecies: Record<string, number>;
  initialUnitCostCopBySpecies: Record<string, number>;
  pointOfLayValueCopBySpecies: Record<string, number>;
  breederUnitValueCopBySpecies: Record<string, number>;
}> {
  const rows = await loadSpeciesMasterParams();
  const result = {
    meatKgCopBySpecies: {} as Record<string, number>,
    eggUnitCopBySpecies: {} as Record<string, number>,
    initialUnitCostCopBySpecies: {} as Record<string, number>,
    pointOfLayValueCopBySpecies: {} as Record<string, number>,
    breederUnitValueCopBySpecies: {} as Record<string, number>,
  };
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.species)) continue;
    seen.add(row.species);
    if (row.marketPriceKgCanalCOP > 0) {
      result.meatKgCopBySpecies[row.species] = Math.round(
        row.marketPriceKgCanalCOP * Math.max(0, row.carcassYieldPercent) / 100,
      );
    }
    if ((row.marketPriceEggUnitCOP ?? 0) > 0) {
      result.eggUnitCopBySpecies[row.species] = row.marketPriceEggUnitCOP!;
    }
    if ((row.initialUnitCostCOP ?? 0) > 0) {
      result.initialUnitCostCopBySpecies[row.species] = row.initialUnitCostCOP!;
    }
    if ((row.pointOfLayUnitValueCOP ?? 0) > 0) {
      result.pointOfLayValueCopBySpecies[row.species] = row.pointOfLayUnitValueCOP!;
    }
    if ((row.breederUnitValueCOP ?? 0) > 0) {
      result.breederUnitValueCopBySpecies[row.species] = row.breederUnitValueCOP!;
    }
  }
  return result;
}
