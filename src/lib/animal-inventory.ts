import { db } from "@/db";
import { broilerBatches, hens, roosters } from "@/db/schema";
import {
  SPECIES_ORDER,
  isBirdSpecies,
  loadSpeciesParams,
  speciesIcon,
  speciesLabel,
  type SpeciesDbParams,
} from "./species-db";
import { getNumberSetting } from "./settings";
import {
  isBatchPresent,
  isHenLaying,
  isHenPresent,
  isRoosterPresent,
} from "./animal-status";

/**
 * Inventario consolidado de animales del gallinero.
 *
 * La unidad de inventario es "animal", no "gallina": incluye gallinas, gallos,
 * pollos, codornices, patos y conejos. El término "aves" se usa solo para las
 * especies avícolas; el conejo se reporta como animal no avícola.
 */

export type AnimalSource = "hen" | "rooster" | "batch";

export interface AnimalGroup {
  key: string;
  label: string;
  species: string;
  speciesLabel: string;
  icon: string;
  count: number;
  avgWeightKg: number;
  totalWeightKg: number;
  pricePerKg: number;
  estimatedValue: number;
  weightEstimated: boolean;
  source: AnimalSource;
  detail?: string | null;
}

export interface AnimalSpeciesSummary {
  species: string;
  label: string;
  icon: string;
  isBird: boolean;
  count: number;
  totalWeightKg: number;
  estimatedValue: number;
}

export interface AnimalInventorySummary {
  totalAnimals: number;
  totalBirds: number;
  totalNonBirds: number;
  /** Gallinas registradas en total (incluye vendidas, faenadas y muertas). */
  registeredHens: number;
  /** Gallinas que siguen en el gallinero. */
  activeHens: number;
  /** Gallinas en postura (estado "activa"). */
  layingHens: number;
  activeRoosters: number;
  activeBatches: number;
  totalWeightKg: number;
  totalValue: number;
}

export interface AnimalInventory {
  summary: AnimalInventorySummary;
  species: AnimalSpeciesSummary[];
  groups: AnimalGroup[];
  byPurpose: { purpose: string; label: string; count: number }[];
}

const PURPOSE_LABEL: Record<string, string> = {
  engorde_carne: "Engorde / carne",
  postura_huevo: "Postura / huevo",
  pie_cria: "Pie de cría",
  mixto: "Mixto",
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round0(value: number): number {
  return Math.round(value);
}

function buildPriceMap(params: SpeciesDbParams[]) {
  const map = new Map<string, { canalPrice: number; yieldPct: number }>();
  for (const p of params) {
    if (!map.has(p.species)) {
      map.set(p.species, {
        canalPrice: p.marketPriceKgCanalCOP,
        yieldPct: p.carcassYieldPercent || 70,
      });
    }
  }
  return map;
}

function buildTargetWeightMap(params: SpeciesDbParams[]) {
  const map = new Map<string, number>();
  for (const p of params) {
    if (!map.has(p.species)) map.set(p.species, p.targetWeightKg);
  }
  return map;
}

export async function computeAnimalInventory(): Promise<AnimalInventory> {
  const [henRows, roosterRows, batchRows, speciesParams, fallbackLivePrice] = await Promise.all([
    db.select().from(hens),
    db.select().from(roosters),
    db.select().from(broilerBatches),
    loadSpeciesParams(),
    getNumberSetting("inventory.bird_price_per_kg"),
  ]);

  const priceMap = buildPriceMap(speciesParams);
  const targetWeightMap = buildTargetWeightMap(speciesParams);

  const livePriceFor = (species: string): number => {
    const priceSpecies = species === "gallo" ? "gallina" : species;
    const info = priceMap.get(priceSpecies);
    if (info && info.canalPrice > 0) {
      return Math.max(0, Math.round(info.canalPrice * (info.yieldPct / 100)));
    }
    return Math.max(0, Math.round(fallbackLivePrice));
  };

  const groups: AnimalGroup[] = [];

  const addGroup = (input: {
    key: string;
    label: string;
    species: string;
    count: number;
    avgWeightKg: number;
    weightEstimated: boolean;
    source: AnimalSource;
    detail?: string | null;
  }) => {
    if (input.count <= 0) return;
    const totalWeightKg = round2(input.count * input.avgWeightKg);
    const pricePerKg = livePriceFor(input.species);
    groups.push({
      ...input,
      avgWeightKg: round2(input.avgWeightKg),
      totalWeightKg,
      pricePerKg,
      estimatedValue: round0(totalWeightKg * pricePerKg),
      speciesLabel: speciesLabel(input.species, true),
      icon: speciesIcon(input.species),
    });
  };

  // ─── Gallinas ───
  const presentHens = henRows.filter((h) => isHenPresent(h.status));
  const henTargetWeight = targetWeightMap.get("gallina") ?? 2.5;
  const henWeights = presentHens.map((h) => {
    const real = h.weight != null ? Number(h.weight) : 0;
    return real > 0 ? real : henTargetWeight;
  });
  const henAvgWeight = henWeights.length > 0
    ? henWeights.reduce((sum, w) => sum + w, 0) / henWeights.length
    : henTargetWeight;
  addGroup({
    key: "gallinas",
    label: "Gallinas",
    species: "gallina",
    count: presentHens.length,
    avgWeightKg: henAvgWeight,
    weightEstimated: presentHens.length === 0 || presentHens.every((h) => h.weight == null || Number(h.weight) <= 0),
    source: "hen",
    detail: "Hembras en el gallinero",
  });

  // ─── Gallos ───
  const presentRoosters = roosterRows.filter((r) => isRoosterPresent(r.status));
  const roosterTargetWeight = targetWeightMap.get("gallina") ?? 3;
  const roosterWeights = presentRoosters.map((r) => (r.weight != null ? Number(r.weight) : 0)).filter((w) => w > 0);
  const roosterAvgWeight = roosterWeights.length > 0
    ? roosterWeights.reduce((sum, w) => sum + w, 0) / roosterWeights.length
    : roosterTargetWeight;
  addGroup({
    key: "gallos",
    label: "Gallos",
    species: "gallo",
    count: presentRoosters.length,
    avgWeightKg: roosterAvgWeight,
    weightEstimated: roosterWeights.length === 0,
    source: "rooster",
    detail: "Machos reproductores",
  });

  // ─── Lotes multiespecie ───
  const presentBatches = batchRows.filter((b) => isBatchPresent(b.status, b.currentQuantity));
  for (const batch of presentBatches) {
    const real = batch.avgWeightKg != null ? Number(batch.avgWeightKg) : 0;
    const target = Number(batch.targetWeightKg) || targetWeightMap.get(batch.species) || 0;
    const avgWeight = real > 0 ? real : target;
    addGroup({
      key: `lote:${batch.id}`,
      label: batch.code,
      species: batch.species,
      count: batch.currentQuantity,
      avgWeightKg: avgWeight,
      weightEstimated: real <= 0,
      source: "batch",
      detail: PURPOSE_LABEL[batch.purpose] || batch.purpose,
    });
  }

  // ─── Resumen por especie ───
  const speciesMap = new Map<string, AnimalSpeciesSummary>();

  const ensureSpecies = (key: string, lookupSpecies: string): AnimalSpeciesSummary => {
    const existing = speciesMap.get(key);
    if (existing) return existing;
    const created: AnimalSpeciesSummary = {
      species: key,
      label: key === "gallo" ? "Gallos" : speciesLabel(lookupSpecies, true),
      icon: speciesIcon(lookupSpecies),
      isBird: key === "gallo" ? true : isBirdSpecies(lookupSpecies),
      count: 0,
      totalWeightKg: 0,
      estimatedValue: 0,
    };
    speciesMap.set(key, created);
    return created;
  };

  for (const group of groups) {
    const key = group.source === "rooster" ? "gallo" : group.species;
    const lookup = group.species === "gallo" ? "gallina" : group.species;
    const row = ensureSpecies(key, lookup);
    row.count += group.count;
    row.totalWeightKg = round2(row.totalWeightKg + group.totalWeightKg);
    row.estimatedValue += group.estimatedValue;
  }

  // Incluir especies canónicas aunque estén en cero, para una vista estable.
  for (const sp of SPECIES_ORDER) {
    ensureSpecies(sp, sp);
  }

  const species = Array.from(speciesMap.values()).filter(
    (row) => row.count > 0 || SPECIES_ORDER.includes(row.species as (typeof SPECIES_ORDER)[number]),
  );

  const totalAnimals = species.reduce((sum, row) => sum + row.count, 0);
  const totalBirds = species.filter((row) => row.isBird).reduce((sum, row) => sum + row.count, 0);
  const totalWeightKg = round2(species.reduce((sum, row) => sum + row.totalWeightKg, 0));
  const totalValue = round0(species.reduce((sum, row) => sum + row.estimatedValue, 0));

  // ─── Resumen por propósito (solo lotes) ───
  const purposeMap = new Map<string, number>();
  for (const batch of presentBatches) {
    purposeMap.set(batch.purpose, (purposeMap.get(batch.purpose) || 0) + batch.currentQuantity);
  }
  const byPurpose = Array.from(purposeMap.entries()).map(([purpose, count]) => ({
    purpose,
    label: PURPOSE_LABEL[purpose] || purpose,
    count,
  }));

  return {
    summary: {
      totalAnimals,
      totalBirds,
      totalNonBirds: totalAnimals - totalBirds,
      registeredHens: henRows.length,
      activeHens: presentHens.length,
      layingHens: presentHens.filter((h) => isHenLaying(h.status)).length,
      activeRoosters: presentRoosters.length,
      activeBatches: presentBatches.length,
      totalWeightKg,
      totalValue,
    },
    species: species.filter((row) => row.count > 0 || SPECIES_ORDER.includes(row.species as (typeof SPECIES_ORDER)[number])),
    groups,
    byPurpose,
  };
}
