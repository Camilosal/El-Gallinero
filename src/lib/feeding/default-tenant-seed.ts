import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { catalogos, feedInventory, feedPrograms } from "@/db/schema";
import { withDerivedPercentages } from "@/lib/feeding/program-validation";
import type { FeedingSpecies } from "@/lib/species";

type SeedDbClient = Pick<typeof db, "select" | "insert" | "transaction">;

export interface StarterFeedDef {
  key: string;
  name: string;
  category: "Concentrado" | "En Fresco" | "Preparados";
  feedType:
    | "Concentrado Aves"
    | "Concentrado Codorniz"
    | "Concentrado Conejos"
    | "Forraje Verde"
    | "Pastos y gramíneas"
    | "Bore o Raices"
    | "Mosca Soldado"
    | "Maíz Germinado"
    | "Maiz en Grano";
  unit: string;
  minStock: string;
  dryMatterPct: string;
  crudeProteinPct: string;
}

export interface StarterStageProgramDef {
  species: FeedingSpecies;
  value: string;
  minWeeks: number;
  maxWeeks: number | null;
  expectedEggsPerHen: string;
  sortOrder: number;
  items: ReadonlyArray<{ feedKey: string; gramsPerDay: number }>;
}

export const STARTER_FEED_DEFINITIONS: ReadonlyArray<StarterFeedDef> = [
  // Concentrados por especie y etapa (sin proveedor ni stock ficticio)
  {
    key: "conc_pollita_inicio",
    name: "Concentrado Pollitas Iniciación (0-6 sem)",
    category: "Concentrado",
    feedType: "Concentrado Aves",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "89.00",
    crudeProteinPct: "20.00",
  },
  {
    key: "conc_levante",
    name: "Concentrado Levante / Desarrollo (6-18 sem)",
    category: "Concentrado",
    feedType: "Concentrado Aves",
    unit: "kg",
    minStock: "10",
    dryMatterPct: "89.00",
    crudeProteinPct: "16.00",
  },
  {
    key: "conc_pre_postura",
    name: "Concentrado Pre-postura (18-20 sem)",
    category: "Concentrado",
    feedType: "Concentrado Aves",
    unit: "kg",
    minStock: "10",
    dryMatterPct: "89.00",
    crudeProteinPct: "17.00",
  },
  {
    key: "conc_postura",
    name: "Concentrado Postura (20+ sem)",
    category: "Concentrado",
    feedType: "Concentrado Aves",
    unit: "kg",
    minStock: "30",
    dryMatterPct: "89.00",
    crudeProteinPct: "17.50",
  },
  {
    key: "conc_pollo_inicio",
    name: "Concentrado Pollo Inicio / Pre-iniciador (0-3 sem)",
    category: "Concentrado",
    feedType: "Concentrado Aves",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "89.00",
    crudeProteinPct: "22.00",
  },
  {
    key: "conc_pollo_engorde",
    name: "Concentrado Pollo Engorde / Finalización (3+ sem)",
    category: "Concentrado",
    feedType: "Concentrado Aves",
    unit: "kg",
    minStock: "20",
    dryMatterPct: "89.00",
    crudeProteinPct: "19.00",
  },
  {
    key: "conc_codorniz",
    name: "Concentrado Codorniz Cría y Postura",
    category: "Concentrado",
    feedType: "Concentrado Codorniz",
    unit: "kg",
    minStock: "10",
    dryMatterPct: "89.50",
    crudeProteinPct: "21.00",
  },
  {
    key: "conc_conejo_cuy",
    name: "Concentrado Conejos y Cuyes (Peletizado)",
    category: "Concentrado",
    feedType: "Concentrado Conejos",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "88.50",
    crudeProteinPct: "16.50",
  },
  // Forrajes y fuentes locales en fresco
  {
    key: "pastos_gramineas",
    name: "Pastos y gramíneas",
    category: "En Fresco",
    feedType: "Pastos y gramíneas",
    unit: "kg",
    minStock: "20",
    dryMatterPct: "22.00",
    crudeProteinPct: "3.20",
  },
  {
    key: "forraje_oreado",
    name: "Forraje verde oreado (alfalfa / botón de oro)",
    category: "En Fresco",
    feedType: "Forraje Verde",
    unit: "kg",
    minStock: "20",
    dryMatterPct: "26.00",
    crudeProteinPct: "5.20",
  },
  {
    key: "bore_raices",
    name: "Bore / Raíces",
    category: "En Fresco",
    feedType: "Bore o Raices",
    unit: "kg",
    minStock: "10",
    dryMatterPct: "18.00",
    crudeProteinPct: "3.50",
  },
  // Preparados y granos complementarios
  {
    key: "larvas_bsf",
    name: "Larvas de BSF deshidratadas",
    category: "Preparados",
    feedType: "Mosca Soldado",
    unit: "kg",
    minStock: "5",
    dryMatterPct: "92.00",
    crudeProteinPct: "42.00",
  },
  {
    key: "maiz_germinado",
    name: "Maíz germinado",
    category: "Preparados",
    feedType: "Maíz Germinado",
    unit: "kg",
    minStock: "8",
    dryMatterPct: "32.00",
    crudeProteinPct: "4.50",
  },
  {
    key: "maiz_grano",
    name: "Maíz en grano",
    category: "Preparados",
    feedType: "Maiz en Grano",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "88.00",
    crudeProteinPct: "8.80",
  },
];

export const STARTER_STAGE_PROGRAMS: ReadonlyArray<StarterStageProgramDef> = [
  // Gallinas ponedoras (4 etapas)
  {
    species: "gallina",
    value: "Pollito",
    minWeeks: 0,
    maxWeeks: 6,
    expectedEggsPerHen: "0",
    sortOrder: 0,
    items: [
      { feedKey: "conc_pollita_inicio", gramsPerDay: 28 },
      { feedKey: "maiz_germinado", gramsPerDay: 4 },
    ],
  },
  {
    species: "gallina",
    value: "Juvenil",
    minWeeks: 6,
    maxWeeks: 18,
    expectedEggsPerHen: "0",
    sortOrder: 1,
    items: [
      { feedKey: "conc_levante", gramsPerDay: 30 },
      { feedKey: "pastos_gramineas", gramsPerDay: 15 },
      { feedKey: "larvas_bsf", gramsPerDay: 10 },
      { feedKey: "maiz_germinado", gramsPerDay: 8 },
    ],
  },
  {
    species: "gallina",
    value: "Pre-postura",
    minWeeks: 18,
    maxWeeks: 20,
    expectedEggsPerHen: "0.3",
    sortOrder: 2,
    items: [
      { feedKey: "conc_pre_postura", gramsPerDay: 36 },
      { feedKey: "pastos_gramineas", gramsPerDay: 18 },
      { feedKey: "larvas_bsf", gramsPerDay: 10 },
      { feedKey: "maiz_grano", gramsPerDay: 12 },
      { feedKey: "maiz_germinado", gramsPerDay: 5 },
      { feedKey: "bore_raices", gramsPerDay: 4 },
    ],
  },
  {
    species: "gallina",
    value: "Postura",
    minWeeks: 20,
    maxWeeks: null,
    expectedEggsPerHen: "0.85",
    sortOrder: 3,
    items: [
      { feedKey: "conc_postura", gramsPerDay: 42 },
      { feedKey: "pastos_gramineas", gramsPerDay: 22 },
      { feedKey: "larvas_bsf", gramsPerDay: 14 },
      { feedKey: "maiz_grano", gramsPerDay: 16 },
      { feedKey: "maiz_germinado", gramsPerDay: 10 },
      { feedKey: "bore_raices", gramsPerDay: 6 },
    ],
  },
  // Gallos reproductores
  {
    species: "gallo",
    value: "Gallo Reproductor",
    minWeeks: 0,
    maxWeeks: null,
    expectedEggsPerHen: "0",
    sortOrder: 4,
    items: [
      { feedKey: "conc_levante", gramsPerDay: 45 },
      { feedKey: "pastos_gramineas", gramsPerDay: 25 },
      { feedKey: "maiz_grano", gramsPerDay: 25 },
      { feedKey: "larvas_bsf", gramsPerDay: 10 },
    ],
  },
  // Pollos de engorde
  {
    species: "pollo",
    value: "Pollo Inicio (0-3 sem)",
    minWeeks: 0,
    maxWeeks: 3,
    expectedEggsPerHen: "0",
    sortOrder: 5,
    items: [
      { feedKey: "conc_pollo_inicio", gramsPerDay: 50 },
      { feedKey: "maiz_germinado", gramsPerDay: 5 },
    ],
  },
  {
    species: "pollo",
    value: "Pollo Engorde (3+ sem)",
    minWeeks: 3,
    maxWeeks: null,
    expectedEggsPerHen: "0",
    sortOrder: 6,
    items: [
      { feedKey: "conc_pollo_engorde", gramsPerDay: 80 },
      { feedKey: "maiz_grano", gramsPerDay: 20 },
      { feedKey: "pastos_gramineas", gramsPerDay: 15 },
      { feedKey: "larvas_bsf", gramsPerDay: 10 },
    ],
  },
  // Codornices
  {
    species: "codorniz",
    value: "Codorniz Cría (0-5 sem)",
    minWeeks: 0,
    maxWeeks: 5,
    expectedEggsPerHen: "0",
    sortOrder: 7,
    items: [
      { feedKey: "conc_codorniz", gramsPerDay: 14 },
      { feedKey: "forraje_oreado", gramsPerDay: 3 },
      { feedKey: "larvas_bsf", gramsPerDay: 2 },
    ],
  },
  {
    species: "codorniz",
    value: "Codorniz Postura (5+ sem)",
    minWeeks: 5,
    maxWeeks: null,
    expectedEggsPerHen: "0.88",
    sortOrder: 8,
    items: [
      { feedKey: "conc_codorniz", gramsPerDay: 18 },
      { feedKey: "forraje_oreado", gramsPerDay: 4 },
      { feedKey: "larvas_bsf", gramsPerDay: 3 },
      { feedKey: "maiz_germinado", gramsPerDay: 2 },
    ],
  },
  // Patos
  {
    species: "pato",
    value: "Pato Cría (0-4 sem)",
    minWeeks: 0,
    maxWeeks: 4,
    expectedEggsPerHen: "0",
    sortOrder: 9,
    items: [
      { feedKey: "conc_pollita_inicio", gramsPerDay: 70 },
      { feedKey: "forraje_oreado", gramsPerDay: 20 },
      { feedKey: "larvas_bsf", gramsPerDay: 10 },
    ],
  },
  {
    species: "pato",
    value: "Pato Levante y Engorde (4+ sem)",
    minWeeks: 4,
    maxWeeks: null,
    expectedEggsPerHen: "0.55",
    sortOrder: 10,
    items: [
      { feedKey: "conc_pollo_engorde", gramsPerDay: 110 },
      { feedKey: "pastos_gramineas", gramsPerDay: 50 },
      { feedKey: "bore_raices", gramsPerDay: 25 },
      { feedKey: "maiz_grano", gramsPerDay: 25 },
    ],
  },
  // Conejos
  {
    species: "conejo",
    value: "Conejo Gazapo (0-8 sem)",
    minWeeks: 0,
    maxWeeks: 8,
    expectedEggsPerHen: "0",
    sortOrder: 11,
    items: [
      { feedKey: "conc_conejo_cuy", gramsPerDay: 45 },
      { feedKey: "forraje_oreado", gramsPerDay: 45 },
    ],
  },
  {
    species: "conejo",
    value: "Conejo Engorde y Cría (8+ sem)",
    minWeeks: 8,
    maxWeeks: null,
    expectedEggsPerHen: "0",
    sortOrder: 12,
    items: [
      { feedKey: "conc_conejo_cuy", gramsPerDay: 75 },
      { feedKey: "forraje_oreado", gramsPerDay: 110 },
      { feedKey: "bore_raices", gramsPerDay: 35 },
    ],
  },
  // Cuyes
  {
    species: "cuy",
    value: "Cuy Cría y Recría (0-6 sem)",
    minWeeks: 0,
    maxWeeks: 6,
    expectedEggsPerHen: "0",
    sortOrder: 13,
    items: [
      { feedKey: "forraje_oreado", gramsPerDay: 35 },
      { feedKey: "conc_conejo_cuy", gramsPerDay: 18 },
      { feedKey: "bore_raices", gramsPerDay: 7 },
    ],
  },
  {
    species: "cuy",
    value: "Cuy Engorde y Cría (6+ sem)",
    minWeeks: 6,
    maxWeeks: null,
    expectedEggsPerHen: "0",
    sortOrder: 14,
    items: [
      { feedKey: "forraje_oreado", gramsPerDay: 70 },
      { feedKey: "pastos_gramineas", gramsPerDay: 40 },
      { feedKey: "conc_conejo_cuy", gramsPerDay: 25 },
      { feedKey: "bore_raices", gramsPerDay: 15 },
    ],
  },
];

export interface StarterSeedSummary {
  createdFeeds: number;
  createdStages: number;
  createdPrograms: number;
  skippedExistingStages: number;
}

/**
 * Precarga de forma idempotente el catálogo neutro de alimentos (sin proveedor ni
 * inventario inicial inventado), las etapas multi-especie (`etapa_crecimiento`)
 * y sus planes de alimentación mixtos (`feed_programs`) para una granja.
 * Debe ejecutarse dentro del contexto RLS de `farmId` (`runWithFarmContext`).
 */
export async function seedStarterFeedsAndPrograms(
  farmId: string,
  client: SeedDbClient = db,
): Promise<StarterSeedSummary> {
  const existingFeeds = await client
    .select({ id: feedInventory.id, name: feedInventory.name })
    .from(feedInventory)
    .where(eq(feedInventory.farmId, farmId));

  const feedIdByName = new Map<string, string>(
    existingFeeds.map((row) => [row.name.trim().toLowerCase(), row.id]),
  );

  const missingFeeds = STARTER_FEED_DEFINITIONS.filter(
    (def) => !feedIdByName.has(def.name.trim().toLowerCase()),
  );

  let createdFeeds = 0;
  if (missingFeeds.length > 0) {
    const insertedFeeds = await client
      .insert(feedInventory)
      .values(
        missingFeeds.map((def) => ({
          farmId,
          name: def.name,
          category: def.category,
          feedType: def.feedType,
          unit: def.unit,
          currentStock: "0",
          minStock: def.minStock,
          costPerUnit: "0",
          supplier: null,
          dryMatterPct: def.dryMatterPct,
          crudeProteinPct: def.crudeProteinPct,
        })),
      )
      .returning({ id: feedInventory.id, name: feedInventory.name });

    for (const row of insertedFeeds) {
      feedIdByName.set(row.name.trim().toLowerCase(), row.id);
    }
    createdFeeds = insertedFeeds.length;
  }

  const feedIdByKey = new Map<string, string>();
  for (const def of STARTER_FEED_DEFINITIONS) {
    const id = feedIdByName.get(def.name.trim().toLowerCase());
    if (id) feedIdByKey.set(def.key, id);
  }

  const existingStages = await client
    .select({ id: catalogos.id, value: catalogos.value })
    .from(catalogos)
    .where(and(eq(catalogos.farmId, farmId), eq(catalogos.category, "etapa_crecimiento")));

  const stageIdByValue = new Map<string, string>(
    existingStages.map((row) => [row.value.trim().toLowerCase(), row.id]),
  );

  const missingStages = STARTER_STAGE_PROGRAMS.filter(
    (def) => !stageIdByValue.has(def.value.trim().toLowerCase()),
  );

  let createdStages = 0;
  if (missingStages.length > 0) {
    const insertedStages = await client
      .insert(catalogos)
      .values(
        missingStages.map((def) => ({
          farmId,
          category: "etapa_crecimiento",
          value: def.value,
          tipo: def.species,
          minWeeks: def.minWeeks,
          maxWeeks: def.maxWeeks,
          expectedEggsPerHen: def.expectedEggsPerHen,
          sortOrder: def.sortOrder,
          isActive: true,
        })),
      )
      .returning({ id: catalogos.id, value: catalogos.value });

    for (const row of insertedStages) {
      stageIdByValue.set(row.value.trim().toLowerCase(), row.id);
    }
    createdStages = insertedStages.length;
  }

  const existingPrograms = await client
    .select({ stageCatalogoId: feedPrograms.stageCatalogoId })
    .from(feedPrograms)
    .where(eq(feedPrograms.farmId, farmId));

  const configuredStageIds = new Set(existingPrograms.map((row) => row.stageCatalogoId));

  let createdPrograms = 0;
  let skippedExistingStages = 0;

  for (const stageDef of STARTER_STAGE_PROGRAMS) {
    const stageId = stageIdByValue.get(stageDef.value.trim().toLowerCase());
    if (!stageId) continue;
    if (configuredStageIds.has(stageId)) {
      skippedExistingStages += 1;
      continue;
    }

    const itemsWithIds = stageDef.items
      .map((item) => {
        const feedId = feedIdByKey.get(item.feedKey);
        return feedId ? { feedId, grams: item.gramsPerDay } : null;
      })
      .filter((entry): entry is { feedId: string; grams: number } => entry !== null);

    if (itemsWithIds.length === 0) continue;

    const normalizedEntries = withDerivedPercentages(itemsWithIds);
    await client.insert(feedPrograms).values(
      normalizedEntries.map((entry) => ({
        farmId,
        stageCatalogoId: stageId,
        feedId: entry.feedId,
        percentage: entry.percentage,
        dailyAmountPerHen: entry.dailyAmountPerHen,
      })),
    );
    createdPrograms += 1;
  }

  return {
    createdFeeds,
    createdStages,
    createdPrograms,
    skippedExistingStages,
  };
}
