import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { catalogos, feedInventory, feedPrograms } from "@/db/schema";
import { withDerivedPercentages } from "@/lib/feeding/program-validation";
import { inferFeedCatalogGroup } from "@/lib/feed-classification";
import { findStandardFeedById } from "@/lib/feeding/standard-feed-catalog";
import { resolveStandardFeedEnrichment } from "@/lib/feeding/feed-catalog-metadata";
import type { FeedingSpecies } from "@/lib/species";

type SeedDbClient = Pick<typeof db, "select" | "insert" | "transaction">;

export interface StarterFeedDef {
  key: string;
  name: string;
  category: "Concentrado" | "En Fresco" | "Preparados";
  feedType:
    | "Concentrado Aves"
    | "Concentrado Pollo Engorde"
    | "Concentrado Codorniz"
    | "Concentrado Patos"
    | "Concentrado Conejos"
    | "Concentrado Cuyes"
    | "Concentrado Multiespecie"
    | "Forraje Verde"
    | "Pastos y gramíneas"
    | "Bore o Raices"
    | "Mosca Soldado"
    | "Maíz Germinado"
    | "Maiz en Grano"
    | "Otro"
    | "Purinas";
  unit: string;
  minStock: string;
  dryMatterPct: string;
  crudeProteinPct: string;
  standardCatalogId?: string;
  sanitaryStatus?: "CONDICIONAL" | "RESTRINGIDO";
  energyKcalKgDm?: string;
  calciumDmPct?: string;
  availablePhosphorusDmPct?: string;
  lysineDigDmPct?: string;
  metCysDigDmPct?: string;
  crudeFiberDmPct?: string;
  allowedSpecies?: FeedingSpecies[];
  regionalNames?: string[];
  description?: string;
  imageUrl?: string;
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
  // Concentrados por especie y etapa (sin proveedor ni stock ficticio; referencia guía editable contra etiqueta real)
  {
    key: "conc_pollita_inicio",
    name: "Concentrado Pollitas Iniciación (0-6 sem)",
    category: "Concentrado",
    feedType: "Concentrado Aves",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "89.00",
    crudeProteinPct: "20.00",
    standardCatalogId: "IG-004",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3120.00",
    calciumDmPct: "1.10",
    availablePhosphorusDmPct: "0.48",
    crudeFiberDmPct: "4.00",
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
    standardCatalogId: "IG-003",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "2980.00",
    calciumDmPct: "1.05",
    availablePhosphorusDmPct: "0.46",
    crudeFiberDmPct: "5.20",
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
    standardCatalogId: "IG-002",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3020.00",
    calciumDmPct: "2.45",
    availablePhosphorusDmPct: "0.48",
    crudeFiberDmPct: "4.80",
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
    standardCatalogId: "IG-001",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3050.00",
    calciumDmPct: "4.15",
    availablePhosphorusDmPct: "0.48",
    crudeFiberDmPct: "4.50",
  },
  {
    key: "conc_pollo_inicio",
    name: "Concentrado Pollo Inicio / Pre-iniciador (0-3 sem)",
    category: "Concentrado",
    feedType: "Concentrado Pollo Engorde",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "89.00",
    crudeProteinPct: "22.00",
    standardCatalogId: "IG-004",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3280.00",
    calciumDmPct: "1.10",
    availablePhosphorusDmPct: "0.50",
    crudeFiberDmPct: "3.80",
    allowedSpecies: ["pollo"],
  },
  {
    key: "conc_pollo_engorde",
    name: "Concentrado Pollo Engorde / Finalización (3+ sem)",
    category: "Concentrado",
    feedType: "Concentrado Pollo Engorde",
    unit: "kg",
    minStock: "20",
    dryMatterPct: "89.00",
    crudeProteinPct: "19.00",
    standardCatalogId: "IG-120",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3420.00",
    calciumDmPct: "0.98",
    availablePhosphorusDmPct: "0.45",
    crudeFiberDmPct: "4.20",
    allowedSpecies: ["pollo"],
  },
  {
    key: "conc_codorniz_cria",
    name: "Concentrado Codorniz Cría / Iniciación (0-5 sem)",
    category: "Concentrado",
    feedType: "Concentrado Codorniz",
    unit: "kg",
    minStock: "10",
    dryMatterPct: "89.50",
    crudeProteinPct: "23.00",
    standardCatalogId: "IG-121",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3160.00",
    calciumDmPct: "1.10",
    availablePhosphorusDmPct: "0.48",
    crudeFiberDmPct: "4.20",
    allowedSpecies: ["codorniz"],
  },
  {
    key: "conc_codorniz",
    name: "Concentrado Codorniz Postura (5+ sem)",
    category: "Concentrado",
    feedType: "Concentrado Codorniz",
    unit: "kg",
    minStock: "10",
    dryMatterPct: "89.50",
    crudeProteinPct: "21.00",
    standardCatalogId: "IG-122",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3160.00",
    calciumDmPct: "3.35",
    availablePhosphorusDmPct: "0.46",
    crudeFiberDmPct: "4.50",
    allowedSpecies: ["codorniz"],
  },
  {
    key: "conc_pato",
    name: "Concentrado Patos (Cría y Engorde)",
    category: "Concentrado",
    feedType: "Concentrado Patos",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "89.00",
    crudeProteinPct: "19.20",
    standardCatalogId: "IG-123",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3200.00",
    calciumDmPct: "1.02",
    availablePhosphorusDmPct: "0.48",
    crudeFiberDmPct: "4.50",
    allowedSpecies: ["pato"],
  },
  {
    key: "conc_conejo",
    name: "Concentrado Peletizado Conejos",
    category: "Concentrado",
    feedType: "Concentrado Conejos",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "88.50",
    crudeProteinPct: "16.80",
    standardCatalogId: "IG-124",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "2650.00",
    calciumDmPct: "0.95",
    availablePhosphorusDmPct: "0.52",
    crudeFiberDmPct: "15.50",
    allowedSpecies: ["conejo"],
  },
  {
    key: "conc_cuy",
    name: "Concentrado Peletizado Cuyes (Vitamina C)",
    category: "Concentrado",
    feedType: "Concentrado Cuyes",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "88.50",
    crudeProteinPct: "17.80",
    standardCatalogId: "IG-125",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "2720.00",
    calciumDmPct: "1.00",
    availablePhosphorusDmPct: "0.52",
    crudeFiberDmPct: "13.50",
    allowedSpecies: ["cuy"],
  },
  {
    key: "conc_conejo_cuy",
    name: "Concentrado Conejos y Cuyes (Peletizado Mixto)",
    category: "Concentrado",
    feedType: "Concentrado Multiespecie",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "88.50",
    crudeProteinPct: "17.50",
    standardCatalogId: "IG-126",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "2680.00",
    calciumDmPct: "0.95",
    availablePhosphorusDmPct: "0.55",
    crudeFiberDmPct: "14.50",
    allowedSpecies: ["conejo", "cuy"],
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
    standardCatalogId: "IG-071",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "1950.00",
    calciumDmPct: "0.45",
    availablePhosphorusDmPct: "0.22",
    crudeFiberDmPct: "28.00",
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
    standardCatalogId: "IG-058",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "2050.00",
    calciumDmPct: "1.94",
    availablePhosphorusDmPct: "0.24",
    crudeFiberDmPct: "26.70",
  },
  {
    key: "batata_fresca",
    name: "Batata / camote raíz fresca (energía local)",
    category: "En Fresco",
    feedType: "Bore o Raices",
    unit: "kg",
    minStock: "10",
    dryMatterPct: "30.00",
    crudeProteinPct: "1.65",
    standardCatalogId: "IG-039",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3300.00",
    calciumDmPct: "0.12",
    availablePhosphorusDmPct: "0.14",
    crudeFiberDmPct: "3.20",
  },
  // Preparados, granos, proteína y mineral cálcico estandarizados
  {
    key: "larvas_bsf",
    name: "Larvas de BSF deshidratadas",
    category: "Preparados",
    feedType: "Mosca Soldado",
    unit: "kg",
    minStock: "5",
    dryMatterPct: "91.70",
    crudeProteinPct: "37.69",
    standardCatalogId: "IG-007",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3967.00",
    calciumDmPct: "3.30",
    availablePhosphorusDmPct: "0.55",
    crudeFiberDmPct: "7.00",
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
    standardCatalogId: "IG-031",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3250.00",
    calciumDmPct: "0.08",
    availablePhosphorusDmPct: "0.14",
    crudeFiberDmPct: "5.80",
  },
  {
    key: "maiz_grano",
    name: "Maíz en grano",
    category: "Preparados",
    feedType: "Maiz en Grano",
    unit: "kg",
    minStock: "15",
    dryMatterPct: "86.30",
    crudeProteinPct: "7.59",
    standardCatalogId: "IG-015",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "3660.00",
    calciumDmPct: "0.05",
    availablePhosphorusDmPct: "0.07",
    lysineDigDmPct: "0.24",
    metCysDigDmPct: "0.37",
    crudeFiberDmPct: "2.60",
  },
  {
    key: "carbonato_calcio",
    name: "Carbonato de calcio grado alimenticio",
    category: "Preparados",
    feedType: "Otro",
    unit: "kg",
    minStock: "5",
    dryMatterPct: "99.00",
    crudeProteinPct: "0.00",
    standardCatalogId: "IG-115",
    sanitaryStatus: "CONDICIONAL",
    energyKcalKgDm: "0.00",
    calciumDmPct: "38.00",
    availablePhosphorusDmPct: "0.00",
    crudeFiberDmPct: "0.00",
  },
];

export const STARTER_STAGE_PROGRAMS: ReadonlyArray<StarterStageProgramDef> = [
  // Gallinas ponedoras (4 etapas balanceadas contra FEDNA / Hy-Line)
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
      { feedKey: "conc_levante", gramsPerDay: 50 },
      { feedKey: "pastos_gramineas", gramsPerDay: 12 },
      { feedKey: "maiz_grano", gramsPerDay: 8 },
      { feedKey: "larvas_bsf", gramsPerDay: 3 },
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
      { feedKey: "conc_pre_postura", gramsPerDay: 70 },
      { feedKey: "pastos_gramineas", gramsPerDay: 12 },
      { feedKey: "maiz_grano", gramsPerDay: 10 },
      { feedKey: "larvas_bsf", gramsPerDay: 3 },
      { feedKey: "carbonato_calcio", gramsPerDay: 1 },
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
      { feedKey: "conc_postura", gramsPerDay: 82 },
      { feedKey: "pastos_gramineas", gramsPerDay: 16 },
      { feedKey: "maiz_grano", gramsPerDay: 12 },
      { feedKey: "larvas_bsf", gramsPerDay: 6 },
      { feedKey: "carbonato_calcio", gramsPerDay: 2 },
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
      { feedKey: "conc_levante", gramsPerDay: 85 },
      { feedKey: "pastos_gramineas", gramsPerDay: 20 },
      { feedKey: "maiz_grano", gramsPerDay: 15 },
      { feedKey: "larvas_bsf", gramsPerDay: 3 },
      { feedKey: "carbonato_calcio", gramsPerDay: 1 },
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
      { feedKey: "conc_pollo_engorde", gramsPerDay: 105 },
      { feedKey: "maiz_grano", gramsPerDay: 15 },
      { feedKey: "pastos_gramineas", gramsPerDay: 10 },
      { feedKey: "larvas_bsf", gramsPerDay: 5 },
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
      { feedKey: "conc_codorniz_cria", gramsPerDay: 17 },
      { feedKey: "larvas_bsf", gramsPerDay: 1 },
      { feedKey: "pastos_gramineas", gramsPerDay: 1 },
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
      { feedKey: "conc_codorniz", gramsPerDay: 21 },
      { feedKey: "maiz_grano", gramsPerDay: 2 },
      { feedKey: "pastos_gramineas", gramsPerDay: 2 },
      { feedKey: "larvas_bsf", gramsPerDay: 1 },
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
      { feedKey: "conc_pato", gramsPerDay: 70 },
      { feedKey: "pastos_gramineas", gramsPerDay: 10 },
      { feedKey: "maiz_grano", gramsPerDay: 8 },
      { feedKey: "larvas_bsf", gramsPerDay: 6 },
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
      { feedKey: "conc_pato", gramsPerDay: 132 },
      { feedKey: "pastos_gramineas", gramsPerDay: 24 },
      { feedKey: "maiz_grano", gramsPerDay: 24 },
      { feedKey: "carbonato_calcio", gramsPerDay: 1 },
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
      { feedKey: "conc_conejo", gramsPerDay: 50 },
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
      { feedKey: "conc_conejo", gramsPerDay: 95 },
      { feedKey: "forraje_oreado", gramsPerDay: 105 },
      { feedKey: "batata_fresca", gramsPerDay: 15 },
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
      { feedKey: "conc_cuy", gramsPerDay: 50 },
      { feedKey: "forraje_oreado", gramsPerDay: 35 },
      { feedKey: "maiz_grano", gramsPerDay: 5 },
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
      { feedKey: "conc_cuy", gramsPerDay: 80 },
      { feedKey: "forraje_oreado", gramsPerDay: 65 },
      { feedKey: "pastos_gramineas", gramsPerDay: 25 },
      { feedKey: "maiz_grano", gramsPerDay: 10 },
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
        missingFeeds.map((def) => {
          const std = findStandardFeedById(def.standardCatalogId);
          const group = std?.group ?? inferFeedCatalogGroup(def.feedType, def.name, def.category);
          const enrichment = resolveStandardFeedEnrichment({
            id: def.standardCatalogId || "",
            group,
            name: def.name,
            botanicalName: std?.botanicalName,
            presentation: std?.presentation,
            origin: std?.origin,
            sanitaryStatus: def.sanitaryStatus ?? std?.sanitaryStatus ?? "CONDICIONAL",
            preparation: std?.preparation,
            risks: std?.risks,
            compositionNotes: std?.compositionNotes,
            defaultFeedType: def.feedType,
          });
          return {
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
            standardCatalogId: def.standardCatalogId ?? null,
            catalogGroup: group,
            sanitaryStatus: def.sanitaryStatus ?? null,
            energyKcalKgDm: def.energyKcalKgDm ?? null,
            calciumDmPct: def.calciumDmPct ?? null,
            availablePhosphorusDmPct: def.availablePhosphorusDmPct ?? null,
            lysineDigDmPct: def.lysineDigDmPct ?? null,
            metCysDigDmPct: def.metCysDigDmPct ?? null,
            crudeFiberDmPct: def.crudeFiberDmPct ?? null,
            allowedSpecies: def.allowedSpecies ?? enrichment.targetSpecies,
            imageUrl: def.imageUrl ?? enrichment.imageUrl,
            description: def.description ?? enrichment.description,
            regionalNames: def.regionalNames ?? enrichment.regionalNames,
          };
        }),
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
