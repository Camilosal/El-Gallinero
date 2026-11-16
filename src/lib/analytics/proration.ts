import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  broilerBatches,
  farmLocations,
  feedMovements,
  hens,
  roosters,
} from "@/db/schema";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";
import { isDateOnly } from "@/lib/date-validation";
import { SPECIES_LABELS } from "@/lib/species";

export const VALID_PRORATION_BASES = new Set([
  "head_count",
  "biomass",
  "feed_kg",
  "area_m2",
  "manual",
]);

export interface WeightBucket {
  species: string | null;
  locationId: string | null;
  batchId: string | null;
  label: string;
  weight: number;
}

export function formatProrationSpeciesLabel(sp: string | null | undefined): string {
  if (!sp) return "Sin asignar";
  return (SPECIES_LABELS as Record<string, { plural?: string; singular?: string }>)[sp]?.plural || sp;
}

export async function computeSuggestedProrationWeights(
  basis: string,
  periodFrom?: string,
  periodTo?: string,
): Promise<WeightBucket[]> {
  if (basis === "area_m2") {
    const locs = await db
      .select({ id: farmLocations.id, name: farmLocations.name, areaM2: farmLocations.areaM2 })
      .from(farmLocations)
      .where(eq(farmLocations.status, "activa"));
    return locs
      .map((l) => ({
        species: null,
        locationId: l.id,
        batchId: null,
        label: l.name,
        weight: Math.max(0, Number(l.areaM2 || 0)),
      }))
      .filter((b) => b.weight > 0);
  }

  if (basis === "feed_kg") {
    const conds = [eq(feedMovements.isEntry, false)];
    if (periodFrom && isDateOnly(periodFrom)) conds.push(gte(feedMovements.date, periodFrom));
    if (periodTo && isDateOnly(periodTo)) conds.push(lte(feedMovements.date, periodTo));
    const rows = await db
      .select({
        species: feedMovements.species,
        kg: sql<string>`coalesce(sum(${feedMovements.quantity}::numeric), 0)`,
      })
      .from(feedMovements)
      .where(and(...conds))
      .groupBy(feedMovements.species);
    return rows
      .map((r) => ({
        species: r.species || "gallina",
        locationId: null,
        batchId: null,
        label: formatProrationSpeciesLabel(r.species || "gallina"),
        weight: Math.max(0, Number(r.kg || 0)),
      }))
      .filter((b) => b.weight > 0);
  }

  const [henRows, roosterRows, batchRows] = await Promise.all([
    db
      .select({ weight: hens.weight })
      .from(hens)
      .where(inArray(hens.status, HEN_PRESENT_STATUSES as (typeof hens.status.enumValues)[number][])),
    db
      .select({ weight: roosters.weight })
      .from(roosters)
      .where(inArray(roosters.status, ["activo", "enfermo"])),
    db
      .select({
        species: broilerBatches.species,
        qty: broilerBatches.currentQuantity,
        avgWeightKg: broilerBatches.avgWeightKg,
        targetWeightKg: broilerBatches.targetWeightKg,
      })
      .from(broilerBatches)
      .where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"])),
  ]);

  const bySpecies = new Map<string, number>();
  const add = (sp: string, val: number) => {
    if (val > 0) bySpecies.set(sp, (bySpecies.get(sp) || 0) + val);
  };

  if (basis === "biomass") {
    add("gallina", henRows.reduce((s, h) => s + Math.max(0.5, Number(h.weight || 1.8)), 0));
    add("gallo", roosterRows.reduce((s, r) => s + Math.max(0.5, Number(r.weight || 2.5)), 0));
    for (const b of batchRows) {
      const unitKg = Math.max(0.1, Number(b.avgWeightKg || b.targetWeightKg || 1));
      add(b.species, b.qty * unitKg);
    }
  } else {
    add("gallina", henRows.length);
    add("gallo", roosterRows.length);
    for (const b of batchRows) {
      add(b.species, b.qty);
    }
  }

  return Array.from(bySpecies.entries()).map(([sp, w]) => ({
    species: sp,
    locationId: null,
    batchId: null,
    label: formatProrationSpeciesLabel(sp),
    weight: Number(w.toFixed(2)),
  }));
}

export function distributeAmountByWeights(totalAmount: number, buckets: WeightBucket[]) {
  const totalWeight = buckets.reduce((s, b) => s + b.weight, 0);
  if (buckets.length === 0 || totalWeight <= 0) return [];
  let remainingPct = 100;
  let remainingAmount = totalAmount;
  return buckets.map((b, idx) => {
    const isLast = idx === buckets.length - 1;
    const pct = isLast
      ? Number(remainingPct.toFixed(2))
      : Number(((b.weight / totalWeight) * 100).toFixed(2));
    const amt = isLast
      ? Number(remainingAmount.toFixed(2))
      : Number(((totalAmount * pct) / 100).toFixed(2));
    remainingPct -= pct;
    remainingAmount -= amt;
    return {
      species: b.species,
      locationId: b.locationId,
      batchId: b.batchId,
      label: b.label,
      percentage: pct,
      amount: amt,
    };
  });
}
