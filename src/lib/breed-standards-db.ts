import { asc } from "drizzle-orm";
import { db } from "@/db";
import { breedWeightStandards } from "@/db/schema";
import { inferSpeciesForBreed, type StandardWeightSpecies } from "@/lib/breed-standards";
import type { StandardCurvePoint } from "@/lib/standard-curves";

function normalizeBreedKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function breedMatches(candidate: string, requested: string): boolean {
  const c = normalizeBreedKey(candidate);
  const r = normalizeBreedKey(requested);
  if (!c || !r) return false;
  if (c === r || c.includes(r) || r.includes(c)) return true;
  if (
    (c.includes("coturnix") || c.includes("codorniz japonica")) &&
    (r.includes("coturnix") || r.includes("codorniz japonica"))
  ) {
    return true;
  }
  return false;
}

export function aggregateStandardRowsByWeek(
  rows: (typeof breedWeightStandards.$inferSelect)[],
): StandardCurvePoint[] {
  if (rows.length === 0) return [];
  const neutralRows = rows.filter((r) => r.gender === "mixto");
  const sourceRows = neutralRows.length > 0 ? neutralRows : rows;

  const byWeek = new Map<number, (typeof breedWeightStandards.$inferSelect)[]>();
  for (const row of sourceRows) {
    const list = byWeek.get(row.weekNumber) || [];
    list.push(row);
    byWeek.set(row.weekNumber, list);
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, group]) => {
      const target =
        group.reduce((sum, r) => sum + Number(r.targetWeightG), 0) / group.length;
      const min = group.some((r) => r.minWeightG != null)
        ? Math.min(...group.map((r) => Number(r.minWeightG ?? r.targetWeightG)))
        : Math.round(target * 0.9);
      const max = group.some((r) => r.maxWeightG != null)
        ? Math.max(...group.map((r) => Number(r.maxWeightG ?? r.targetWeightG)))
        : Math.round(target * 1.1);
      return {
        week,
        target: Math.round(target * 10) / 10,
        min: Math.round(min * 10) / 10,
        max: Math.round(max * 10) / 10,
      };
    });
}

export async function getDbWeightCurve(
  species: string,
  breed?: string | null,
): Promise<{ breed: string; points: StandardCurvePoint[] } | null> {
  const rows = await db
    .select()
    .from(breedWeightStandards)
    .orderBy(
      asc(breedWeightStandards.breed),
      asc(breedWeightStandards.gender),
      asc(breedWeightStandards.weekNumber),
    );

  const speciesRows = rows.filter(
    (row) => ((row.species as StandardWeightSpecies | null) || inferSpeciesForBreed(row.breed)) === species,
  );
  if (speciesRows.length === 0) return null;

  const uniqueBreeds = Array.from(new Set(speciesRows.map((r) => r.breed)));
  const matchedBreed = breed
    ? uniqueBreeds.find((b) => b === breed) ||
      uniqueBreeds.find((b) => breedMatches(b, breed))
    : uniqueBreeds[0];

  if (!matchedBreed) return null;

  const breedRows = speciesRows.filter((r) => r.breed === matchedBreed);
  const points = aggregateStandardRowsByWeek(breedRows);
  return points.length > 0 ? { breed: matchedBreed, points } : null;
}

export async function listAvailableWeightBreeds(): Promise<
  Array<{ species: StandardWeightSpecies; breed: string }>
> {
  const rows = await db
    .select({
      species: breedWeightStandards.species,
      breed: breedWeightStandards.breed,
    })
    .from(breedWeightStandards)
    .orderBy(asc(breedWeightStandards.species), asc(breedWeightStandards.breed));

  const seen = new Set<string>();
  const result: Array<{ species: StandardWeightSpecies; breed: string }> = [];
  for (const row of rows) {
    const sp = (row.species as StandardWeightSpecies | null) || inferSpeciesForBreed(row.breed);
    const key = `${sp}::${row.breed}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ species: sp, breed: row.breed });
  }
  return result;
}
