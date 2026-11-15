import path from "node:path";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  appSettings,
  breedWeightStandards,
  catalogos,
  farmSubscriptions,
  farms,
  manureFactors,
  vaccinationTemplates,
} from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { canonicalBreedType, DEFAULT_BREEDS_BY_SPECIES } from "@/lib/animal-breeds";
import { ALL_BREED_STANDARD_DEFS, inferSpeciesForBreed } from "@/lib/breed-standards";
import { syncLegacyCatalogContacts } from "@/lib/contacts";
import { seedStarterFeedsAndPrograms, type StarterSeedSummary } from "@/lib/feeding/default-tenant-seed";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { SPECIES_PARAMS } from "@/lib/species-params";
import { VACCINATION_SCHEDULE_SPECIES, VACCINATION_SCHEDULES } from "@/lib/vaccination-schedules";

export const NORMATIVE_PACK_VERSION = "2026.11-ICA-NTC1240";

/**
 * Siembra técnica obligatoria e idempotente (Capa Core).
 *
 * - Crea la granja principal por defecto (`DEFAULT_FARM_ID`) y su suscripción base si faltan.
 * - Siembra parámetros globales (`DEFAULT_SETTINGS`) sin sobrescribir valores editados.
 * - Carga catálogos maestros multi-especie, razas, parámetros por especie, estándares de peso y vacunas.
 * - Precarga alimentos neutros (stock 0, sin proveedor), etapas y planes mixtos + factores base de gallinaza.
 *
 * Segura para ejecutar en producción o en el arranque inicial: usa `onConflictDoNothing()` y no borra datos.
 */

const BREED_SPECIES: Record<string, string> = {
  "ISA Brown": "gallina",
  "Hy-Line W-36": "gallina",
  "Hy-Line Brown": "gallina",
  "Cobb 500": "pollo",
  "Ross 308": "pollo",
  "Cuy Mejorado": "cuy",
};

const HEN_STATUSES = [
  { value: "activa", sortOrder: 0 },
  { value: "empollando", sortOrder: 1 },
  { value: "enferma", sortOrder: 2 },
  { value: "recomendada_sacrificio", sortOrder: 3 },
  { value: "descarte", sortOrder: 4 },
  { value: "vendida", sortOrder: 5 },
  { value: "faena", sortOrder: 6 },
  { value: "muerta", sortOrder: 7 },
];

interface MasterCatalogDef {
  category: string;
  value: string;
  tipo?: string;
  price?: string;
  units?: number;
  minWeeks?: number | null;
  maxWeeks?: number | null;
  expectedEggsPerHen?: string | null;
  sortOrder: number;
}

const MASTER_CATALOG_DEFS: MasterCatalogDef[] = [
  // Tamaños comerciales de huevo (NTC 1240)
  { category: "tamano_huevo", value: "Jumbo", price: "800", sortOrder: 0 },
  { category: "tamano_huevo", value: "Extra", price: "700", sortOrder: 1 },
  { category: "tamano_huevo", value: "Grande", price: "600", sortOrder: 2 },
  { category: "tamano_huevo", value: "Mediano", price: "500", sortOrder: 3 },
  { category: "tamano_huevo", value: "Pequeño", price: "400", sortOrder: 4 },

  // Presentaciones de venta (huevos, codorniz, carne y abonos)
  { category: "presentacion_venta", value: "Unidad", units: 1, sortOrder: 0 },
  { category: "presentacion_venta", value: "Media docena", units: 6, sortOrder: 1 },
  { category: "presentacion_venta", value: "Docena", units: 12, sortOrder: 2 },
  { category: "presentacion_venta", value: "1/2 Bandeja", units: 15, sortOrder: 3 },
  { category: "presentacion_venta", value: "Bandeja/Cubeta", units: 30, sortOrder: 4 },
  { category: "presentacion_venta", value: "Bandeja x24 Huevos Codorniz", price: "6500", units: 24, tipo: "huevos_codorniz", sortOrder: 10 },
  { category: "presentacion_venta", value: "Caja x30 Huevos Codorniz", price: "8000", units: 30, tipo: "huevos_codorniz", sortOrder: 11 },
  { category: "presentacion_venta", value: "Bolsa x50 Huevos Codorniz", price: "12000", units: 50, tipo: "huevos_codorniz", sortOrder: 12 },
  { category: "presentacion_venta", value: "Canal Conejo Entero (kg)", price: "28000", units: 1, tipo: "carne_conejo", sortOrder: 20 },
  { category: "presentacion_venta", value: "Canal Pato Entero (kg)", price: "24000", units: 1, tipo: "carne_pato", sortOrder: 21 },
  { category: "presentacion_venta", value: "Bulto Conejaza 25kg", price: "15000", units: 25, tipo: "abono", sortOrder: 30 },
  { category: "presentacion_venta", value: "Bulto Codornaza 25kg", price: "18000", units: 25, tipo: "abono", sortOrder: 31 },

  // Presentaciones de compra
  { category: "presentacion_compra", value: "Kg", units: 1, sortOrder: 0 },
  { category: "presentacion_compra", value: "Bulto 25kg", units: 25, sortOrder: 1 },
  { category: "presentacion_compra", value: "Bulto 40kg", units: 40, sortOrder: 2 },
  { category: "presentacion_compra", value: "Bulto 50kg", units: 50, sortOrder: 3 },
  { category: "presentacion_compra", value: "Arpilla 5kg", units: 5, sortOrder: 4 },
  { category: "presentacion_compra", value: "Litro", units: 1, sortOrder: 5 },
  { category: "presentacion_compra", value: "Galón", units: 4, sortOrder: 6 },
  { category: "presentacion_compra", value: "Unidad", units: 1, sortOrder: 7 },

  // Enfermedades frecuentes
  { category: "enfermedad", value: "Newcastle", sortOrder: 0 },
  { category: "enfermedad", value: "Coccidiosis", sortOrder: 1 },
  { category: "enfermedad", value: "Viruela aviar", sortOrder: 2 },
  { category: "enfermedad", value: "Mycoplasma", sortOrder: 3 },
  { category: "enfermedad", value: "Ácaros / piojos", sortOrder: 4 },
  { category: "enfermedad", value: "Cólera aviar", sortOrder: 5 },
  { category: "enfermedad", value: "Marek", sortOrder: 6 },
  { category: "enfermedad", value: "Coriza", sortOrder: 7 },

  // Unidades de medida
  { category: "unidad_medida", value: "unidades", sortOrder: 0 },
  { category: "unidad_medida", value: "kg", sortOrder: 1 },
  { category: "unidad_medida", value: "lb", sortOrder: 2 },
  { category: "unidad_medida", value: "litros", sortOrder: 3 },
  { category: "unidad_medida", value: "docenas", sortOrder: 4 },
  { category: "unidad_medida", value: "gramos", sortOrder: 5 },
  { category: "unidad_medida", value: "otro", sortOrder: 6 },

  // Categorías financieras
  { category: "categoria_ingreso", value: "Venta de huevos", sortOrder: 0 },
  { category: "categoria_ingreso", value: "Venta de animales", sortOrder: 1 },
  { category: "categoria_ingreso", value: "Venta de carne", sortOrder: 2 },
  { category: "categoria_ingreso", value: "Venta de gallinas", sortOrder: 3 },
  { category: "categoria_ingreso", value: "Venta de pollitos", sortOrder: 4 },
  { category: "categoria_ingreso", value: "Venta de abono/gallinaza", sortOrder: 5 },
  { category: "categoria_ingreso", value: "Venta de subproductos", sortOrder: 6 },
  { category: "categoria_ingreso", value: "Otro ingreso", sortOrder: 7 },

  { category: "categoria_egreso", value: "Compra de alimento", sortOrder: 0 },
  { category: "categoria_egreso", value: "Compra de insumos", sortOrder: 1 },
  { category: "categoria_egreso", value: "Control sanitario", sortOrder: 2 },
  { category: "categoria_egreso", value: "Mantenimiento", sortOrder: 3 },
  { category: "categoria_egreso", value: "Mano de obra", sortOrder: 4 },
  { category: "categoria_egreso", value: "Servicios (agua/luz)", sortOrder: 5 },
  { category: "categoria_egreso", value: "Compra de gallinas", sortOrder: 6 },
  { category: "categoria_egreso", value: "Equipamiento", sortOrder: 7 },
  { category: "categoria_egreso", value: "Transporte", sortOrder: 8 },
  { category: "categoria_egreso", value: "Otro egreso", sortOrder: 9 },

  // Sanidad y mantenimiento
  { category: "tipo_sanidad", value: "vacunacion", sortOrder: 0 },
  { category: "tipo_sanidad", value: "desparasitacion", sortOrder: 1 },
  { category: "tipo_sanidad", value: "tratamiento", sortOrder: 2 },
  { category: "tipo_sanidad", value: "inspeccion", sortOrder: 3 },
  { category: "tipo_sanidad", value: "fumigacion", sortOrder: 4 },
  { category: "tipo_sanidad", value: "vitaminas", sortOrder: 5 },
  { category: "tipo_sanidad", value: "otro", sortOrder: 6 },

  { category: "tipo_mantenimiento", value: "Limpieza y desinfección del gallinero", sortOrder: 0 },
  { category: "tipo_mantenimiento", value: "Revisión y reparación de nidales", sortOrder: 1 },
  { category: "tipo_mantenimiento", value: "Cambio de cama / viruta", sortOrder: 2 },
  { category: "tipo_mantenimiento", value: "Revisión del sistema de agua", sortOrder: 3 },
  { category: "tipo_mantenimiento", value: "Reparación de cercas y malla", sortOrder: 4 },
  { category: "tipo_mantenimiento", value: "Poda de vegetación alrededor", sortOrder: 5 },
  { category: "tipo_mantenimiento", value: "Revisión de techos y drenajes", sortOrder: 6 },
  { category: "tipo_mantenimiento", value: "Mantenimiento de comederos", sortOrder: 7 },
  { category: "tipo_mantenimiento", value: "Fumigación preventiva", sortOrder: 8 },
  { category: "tipo_mantenimiento", value: "Pintura y protección de estructuras", sortOrder: 9 },

  // Alimentos e insumos
  { category: "categoria_alimento", value: "Concentrado", sortOrder: 0 },
  { category: "categoria_alimento", value: "En Fresco", sortOrder: 1 },
  { category: "categoria_alimento", value: "Preparados", sortOrder: 2 },

  { category: "tipo_alimento", value: "Concentrado Aves", sortOrder: 0 },
  { category: "tipo_alimento", value: "Concentrado Codorniz", sortOrder: 1 },
  { category: "tipo_alimento", value: "Concentrado Conejos", sortOrder: 2 },
  { category: "tipo_alimento", value: "Purinas", sortOrder: 3 },
  { category: "tipo_alimento", value: "Maiz en Grano", sortOrder: 4 },
  { category: "tipo_alimento", value: "Maíz Germinado", sortOrder: 5 },
  { category: "tipo_alimento", value: "Mosca Soldado", sortOrder: 6 },
  { category: "tipo_alimento", value: "Forraje Verde", sortOrder: 7 },
  { category: "tipo_alimento", value: "Pastos y gramíneas", sortOrder: 8 },
  { category: "tipo_alimento", value: "Bore o Raices", sortOrder: 9 },
  { category: "tipo_alimento", value: "Otro", sortOrder: 10 },

  { category: "tipo_ave", value: "Gallina", tipo: "ave", sortOrder: 0 },
  { category: "tipo_ave", value: "Pollo", tipo: "ave", sortOrder: 1 },
  { category: "tipo_ave", value: "Gallo", tipo: "ave", sortOrder: 2 },
  { category: "tipo_ave", value: "Pollito", tipo: "ave", sortOrder: 3 },
  { category: "tipo_ave", value: "Codorniz", tipo: "ave", sortOrder: 4 },
  { category: "tipo_ave", value: "Pato", tipo: "ave", sortOrder: 5 },
  { category: "tipo_ave", value: "Conejo", tipo: "mamifero", sortOrder: 6 },
  { category: "tipo_ave", value: "Cuy", tipo: "mamifero", sortOrder: 7 },

  { category: "categoria_insumo", value: "medicamento", sortOrder: 0 },
  { category: "categoria_insumo", value: "vacuna", sortOrder: 1 },
  { category: "categoria_insumo", value: "desinfectante", sortOrder: 2 },
  { category: "categoria_insumo", value: "limpieza", sortOrder: 3 },
  { category: "categoria_insumo", value: "equipo", sortOrder: 4 },
  { category: "categoria_insumo", value: "otro", sortOrder: 5 },

  { category: "causa_mortalidad", value: "enfermedad", sortOrder: 0 },
  { category: "causa_mortalidad", value: "depredador", sortOrder: 1 },
  { category: "causa_mortalidad", value: "accidente", sortOrder: 2 },
  { category: "causa_mortalidad", value: "sacrificio_sanitario", sortOrder: 3 },
  { category: "causa_mortalidad", value: "causa_natural", sortOrder: 4 },
  { category: "causa_mortalidad", value: "otro", sortOrder: 5 },

  // Etapas base de postura (el resto de especies se completa en seedStarterFeedsAndPrograms)
  { category: "etapa_crecimiento", value: "Pollito", tipo: "gallina", minWeeks: 0, maxWeeks: 6, expectedEggsPerHen: "0", sortOrder: 0 },
  { category: "etapa_crecimiento", value: "Juvenil", tipo: "gallina", minWeeks: 6, maxWeeks: 18, expectedEggsPerHen: "0", sortOrder: 1 },
  { category: "etapa_crecimiento", value: "Pre-postura", tipo: "gallina", minWeeks: 18, maxWeeks: 20, expectedEggsPerHen: "0.3", sortOrder: 2 },
  { category: "etapa_crecimiento", value: "Postura", tipo: "gallina", minWeeks: 20, maxWeeks: null, expectedEggsPerHen: "0.85", sortOrder: 3 },
  { category: "etapa_crecimiento", value: "Cuy Crecimiento (4-8 sem)", tipo: "cuy", minWeeks: 4, maxWeeks: 8, expectedEggsPerHen: "0", sortOrder: 12 },
  { category: "etapa_crecimiento", value: "Cuy Engorde (8-16 sem)", tipo: "cuy", minWeeks: 8, maxWeeks: 16, expectedEggsPerHen: "0", sortOrder: 13 },
];

async function ensureDefaultFarmAndSubscription(): Promise<void> {
  await db
    .insert(farms)
    .values({
      id: DEFAULT_FARM_ID,
      slug: "default",
      name: "Granja Principal",
      deploymentMode: "dedicated",
      planCode: "COMERCIAL_MEDIANO",
    })
    .onConflictDoNothing();

  await db
    .insert(farmSubscriptions)
    .values({
      farmId: DEFAULT_FARM_ID,
      planCode: "COMERCIAL_MEDIANO",
      status: "active",
      maxActiveBatches: null,
      maxUsers: 8,
    })
    .onConflictDoNothing();
}

async function ensureHenStatuses(): Promise<number> {
  const existing = await db
    .select({ value: catalogos.value })
    .from(catalogos)
    .where(and(eq(catalogos.farmId, DEFAULT_FARM_ID), eq(catalogos.category, "estado_gallina")));
  const present = new Set(existing.map((row) => row.value));
  const missing = HEN_STATUSES.filter((item) => !present.has(item.value));
  if (missing.length === 0) return 0;

  for (const item of missing) {
    await db.transaction(async (tx) => {
      await tx
        .update(catalogos)
        .set({ sortOrder: sql`${catalogos.sortOrder} + 1` })
        .where(
          and(
            eq(catalogos.farmId, DEFAULT_FARM_ID),
            eq(catalogos.category, "estado_gallina"),
            gte(catalogos.sortOrder, item.sortOrder),
          ),
        );
      await tx
        .insert(catalogos)
        .values({
          farmId: DEFAULT_FARM_ID,
          category: "estado_gallina",
          value: item.value,
          sortOrder: item.sortOrder,
        })
        .onConflictDoNothing();
    });
  }

  return missing.length;
}

/** Agrega razas por especie y clasifica las razas históricas de gallina. */
async function ensureAnimalBreeds(): Promise<{ added: number; associated: number }> {
  const rows = await db
    .select({ id: catalogos.id, value: catalogos.value, tipo: catalogos.tipo })
    .from(catalogos)
    .where(and(eq(catalogos.farmId, DEFAULT_FARM_ID), eq(catalogos.category, "raza")));
  const normalizeValue = (value: string) =>
    value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const byValue = new Map(rows.map((row) => [normalizeValue(row.value), row]));
  let added = 0;
  let associated = 0;
  let nextOrder = rows.length;

  for (const row of rows) {
    if (row.tipo) continue;
    const species = canonicalBreedType(row.value) || "gallina";
    await db.update(catalogos).set({ tipo: species }).where(eq(catalogos.id, row.id));
    row.tipo = species;
    associated += 1;
  }

  for (const [species, breeds] of Object.entries(DEFAULT_BREEDS_BY_SPECIES)) {
    for (const value of breeds) {
      const key = normalizeValue(value);
      const existing = byValue.get(key);
      if (existing) {
        if (!existing.tipo) {
          await db.update(catalogos).set({ tipo: species }).where(eq(catalogos.id, existing.id));
          existing.tipo = species;
          associated += 1;
        }
        continue;
      }

      const [created] = await db
        .insert(catalogos)
        .values({
          farmId: DEFAULT_FARM_ID,
          category: "raza",
          value,
          tipo: species,
          sortOrder: nextOrder,
        })
        .onConflictDoNothing()
        .returning({ id: catalogos.id, value: catalogos.value, tipo: catalogos.tipo });
      if (created) {
        byValue.set(key, created);
        added += 1;
        nextOrder += 1;
      }
    }
  }
  return { added, associated };
}

/** Siembra parámetros productivos por especie cuando una especie aún no tiene filas en catálogos. */
async function ensureSpeciesParams(): Promise<number> {
  const existing = await db
    .select({ tipo: catalogos.tipo, sortOrder: catalogos.sortOrder })
    .from(catalogos)
    .where(and(eq(catalogos.farmId, DEFAULT_FARM_ID), eq(catalogos.category, "params_especie")));
  const presentSpecies = new Set(existing.map((r) => r.tipo).filter(Boolean));
  const missing = SPECIES_PARAMS.filter((p) => !presentSpecies.has(p.species));
  if (missing.length === 0) return 0;

  let nextOrder = existing.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), 0) + 1;
  let added = 0;
  for (const p of missing) {
    const [inserted] = await db
      .insert(catalogos)
      .values({
        farmId: DEFAULT_FARM_ID,
        category: "params_especie",
        value: p.label,
        tipo: p.species,
        minWeeks: p.cycleWeeks,
        maxWeeks: p.cycleDays ?? p.cycleWeeks * 7,
        targetWeightKg: String(p.targetWeightKg),
        units: p.carcassYieldPercent,
        dailyFeedG: p.dailyFeedGPerHead,
        feedCostPerKg: String(p.feedCostPerKgCOP),
        feedConversionRatio: String(p.feedConversionRatio),
        price: String(p.marketPriceKgCanalCOP),
        eggPrice: p.marketPriceEggUnitCOP != null ? String(p.marketPriceEggUnitCOP) : null,
        expectedEggsPerHen: p.eggsPerDayPerFemale != null ? String(p.eggsPerDayPerFemale) : null,
        systemType: p.systemType,
        description: p.notes,
        sortOrder: nextOrder++,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ id: catalogos.id });
    if (inserted) added += 1;
  }
  return added;
}

async function ensureMasterCatalogs(): Promise<number> {
  let added = 0;
  for (const item of MASTER_CATALOG_DEFS) {
    const [inserted] = await db
      .insert(catalogos)
      .values({
        farmId: DEFAULT_FARM_ID,
        category: item.category,
        value: item.value,
        tipo: item.tipo ?? null,
        price: item.price ?? null,
        units: item.units ?? null,
        minWeeks: item.minWeeks ?? null,
        maxWeeks: item.maxWeeks ?? null,
        expectedEggsPerHen: item.expectedEggsPerHen ?? null,
        sortOrder: item.sortOrder,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ id: catalogos.id });
    if (inserted) added += 1;
  }
  return added;
}

async function ensureBreedWeightStandards(): Promise<number> {
  const existingMissingSpecies = await db
    .select({ id: breedWeightStandards.id, breed: breedWeightStandards.breed })
    .from(breedWeightStandards)
    .where(isNull(breedWeightStandards.species));

  for (const row of existingMissingSpecies) {
    await db
      .update(breedWeightStandards)
      .set({ species: inferSpeciesForBreed(row.breed) })
      .where(eq(breedWeightStandards.id, row.id));
  }

  let added = 0;
  for (const def of ALL_BREED_STANDARD_DEFS) {
    const rows = def.points.map((p) => ({
      species: def.species,
      breed: def.breed,
      gender: def.gender,
      weekNumber: p.week,
      targetWeightG: String(p.targetG),
      minWeightG: p.minG != null ? String(p.minG) : null,
      maxWeightG: p.maxG != null ? String(p.maxG) : null,
    }));
    const inserted = await db
      .insert(breedWeightStandards)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: breedWeightStandards.id });
    added += inserted.length;
  }
  return added;
}

const DEFAULT_STAGE_MANURE_FACTORS: Record<string, string> = {
  Pollito: "0.050",
  Juvenil: "0.080",
  "Pre-postura": "0.110",
  Postura: "0.130",
};

async function ensureDefaultManureFactors(): Promise<number> {
  const existingGlobals = await db
    .select({ birdGroup: manureFactors.birdGroup })
    .from(manureFactors)
    .where(and(eq(manureFactors.farmId, DEFAULT_FARM_ID), isNull(manureFactors.stageCatalogoId)));

  const globalSet = new Set(existingGlobals.map((row) => row.birdGroup));
  let added = 0;

  for (const [birdGroup, kg] of [
    ["gallo", "0.150"],
    ["lote", "0.100"],
  ] as const) {
    if (globalSet.has(birdGroup)) continue;
    const [inserted] = await db
      .insert(manureFactors)
      .values({
        farmId: DEFAULT_FARM_ID,
        stageCatalogoId: null,
        birdGroup,
        kgPerBirdPerDay: kg,
      })
      .onConflictDoNothing()
      .returning({ id: manureFactors.id });
    if (inserted) added += 1;
  }

  const baseStages = await db
    .select({ id: catalogos.id, value: catalogos.value })
    .from(catalogos)
    .where(and(eq(catalogos.farmId, DEFAULT_FARM_ID), eq(catalogos.category, "etapa_crecimiento")));

  for (const stage of baseStages) {
    const defaultKg = DEFAULT_STAGE_MANURE_FACTORS[stage.value];
    if (!defaultKg) continue;
    const [inserted] = await db
      .insert(manureFactors)
      .values({
        farmId: DEFAULT_FARM_ID,
        stageCatalogoId: stage.id,
        birdGroup: "etapa",
        kgPerBirdPerDay: defaultKg,
      })
      .onConflictDoNothing()
      .returning({ id: manureFactors.id });
    if (inserted) added += 1;
  }

  return added;
}

export interface CoreSeedOptions {
  includeStarterFeeding?: boolean;
}

export interface CoreSeedResult {
  settingsCreated: number;
  speciesParamsAdded: number;
  vaccinationTemplatesCreated: number;
  statusesAdded: number;
  breedsAdded: number;
  breedsAssociated: number;
  masterCatalogsAdded: number;
  weightStandardsAdded: number;
  manureFactorsAdded: number;
  contactsMigrated: number;
  starterFeeding: StarterSeedSummary | null;
}

export async function runCoreSeed(options: CoreSeedOptions = {}): Promise<CoreSeedResult> {
  const includeStarterFeeding = options.includeStarterFeeding ?? true;

  await ensureDefaultFarmAndSubscription();

  return await runWithFarmContext(DEFAULT_FARM_ID, async () => {
    const settingsRows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
      farmId: DEFAULT_FARM_ID,
      key,
      value,
    }));

    const insertedSettings = settingsRows.length
      ? await db.insert(appSettings).values(settingsRows).onConflictDoNothing().returning({ key: appSettings.key })
      : [];

    const templateRows = Object.entries(VACCINATION_SCHEDULES).flatMap(([breed, events]) =>
      events.map((event) => ({
        species: VACCINATION_SCHEDULE_SPECIES[breed] || BREED_SPECIES[breed] || "gallina",
        breed,
        weekNumber: event.weekNumber,
        name: event.name,
        description: event.description,
        type: event.type,
        frequencyDays: event.frequencyDays,
        isActive: true,
      })),
    );

    const insertedTemplates = templateRows.length
      ? await db
          .insert(vaccinationTemplates)
          .values(templateRows)
          .onConflictDoNothing()
          .returning({ id: vaccinationTemplates.id })
      : [];

    const statusesAdded = await ensureHenStatuses();
    const animalBreeds = await ensureAnimalBreeds();
    const speciesParamsAdded = await ensureSpeciesParams();
    const masterCatalogsAdded = await ensureMasterCatalogs();
    const weightStandardsAdded = await ensureBreedWeightStandards();
    const manureFactorsAdded = await ensureDefaultManureFactors();
    const starterFeeding = includeStarterFeeding
      ? await seedStarterFeedsAndPrograms(DEFAULT_FARM_ID)
      : null;
    const contactsMigrated = await syncLegacyCatalogContacts();

    const normativePayload = JSON.stringify({
      version: NORMATIVE_PACK_VERSION,
      updatedAt: new Date().toISOString(),
      standards: [
        "NTC 1240",
        "ICA Res. 3650-3652/2014",
        "MADR Res. 205/2022",
        "ICA Res. 8452/2025",
        "ICA Res. 30292/2017",
      ],
    });

    await db
      .insert(appSettings)
      .values({
        farmId: DEFAULT_FARM_ID,
        key: "normative.pack_version",
        value: normativePayload,
      })
      .onConflictDoUpdate({
        target: [appSettings.farmId, appSettings.key],
        set: {
          value: normativePayload,
          updatedAt: new Date(),
        },
      });

    return {
      settingsCreated: insertedSettings.length,
      speciesParamsAdded,
      vaccinationTemplatesCreated: insertedTemplates.length,
      statusesAdded,
      breedsAdded: animalBreeds.added,
      breedsAssociated: animalBreeds.associated,
      masterCatalogsAdded,
      weightStandardsAdded,
      manureFactorsAdded,
      contactsMigrated,
      starterFeeding,
    };
  });
}

const isSeedCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  path.basename(process.argv[1] || "") === "seed-config.ts";

if (isSeedCli) {
  runCoreSeed()
    .then((res) => {
      console.log(`Parámetros globales creados: ${res.settingsCreated}.`);
      console.log(`Parámetros por especie agregados: ${res.speciesParamsAdded}.`);
      console.log(`Plantillas de vacunación creadas: ${res.vaccinationTemplatesCreated}.`);
      console.log(`Estados de gallina agregados: ${res.statusesAdded}.`);
      console.log(`Razas agregadas: ${res.breedsAdded}, asociadas: ${res.breedsAssociated}.`);
      console.log(`Catálogos maestros agregados: ${res.masterCatalogsAdded}.`);
      console.log(`Estándares de peso agregados: ${res.weightStandardsAdded}.`);
      console.log(`Factores base de gallinaza agregados: ${res.manureFactorsAdded}.`);
      if (res.starterFeeding) {
        console.log(
          `Planes iniciales de alimentación: ${res.starterFeeding.createdFeeds} alimentos, ${res.starterFeeding.createdStages} etapas, ${res.starterFeeding.createdPrograms} programas.`,
        );
      }
      console.log(`Contactos migrados desde catálogos: ${res.contactsMigrated}.`);
      console.log(`Paquete normativo ICA/NTC: ${NORMATIVE_PACK_VERSION}.`);
    })
    .catch((error) => {
      console.error("Error sembrando configuración:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
