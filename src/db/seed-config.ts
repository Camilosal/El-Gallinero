import { db, pool } from "@/db";
import { appSettings, catalogos, vaccinationTemplates } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { VACCINATION_SCHEDULES } from "@/lib/vaccination-schedules";
import { canonicalBreedType, DEFAULT_BREEDS_BY_SPECIES } from "@/lib/animal-breeds";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * Siembra idempotente de configuración.
 *
 * - Crea los parámetros globales con su valor por defecto (no sobrescribe
 *   valores ya editados por el usuario).
 * - Carga los planes de vacunación de referencia (no duplica plantillas).
 * - Completa las razas base por especie y clasifica razas antiguas sin tipo.
 *
 * Seguro para ejecutar en producción: usa ON CONFLICT DO NOTHING y no borra
 * ningún dato existente.
 */

const BREED_SPECIES: Record<string, string> = {
  "ISA Brown": "gallina",
  "Hy-Line W-36": "gallina",
  "Cobb 500": "pollo",
};

/**
 * Estados completos de una gallina. `recomendada_sacrificio` y `faena` ya se
 * usan en la base pero no existían en instalaciones antiguas, por eso se
 * agregan sin borrar ni reordenar los estados que el usuario haya editado.
 */
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

async function ensureHenStatuses(): Promise<number> {
  const existing = await db
    .select({ value: catalogos.value })
    .from(catalogos)
    .where(eq(catalogos.category, "estado_gallina"));
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
            eq(catalogos.category, "estado_gallina"),
            gte(catalogos.sortOrder, item.sortOrder),
          ),
        );
      await tx
        .insert(catalogos)
        .values({
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
    .where(eq(catalogos.category, "raza"));
  const normalizeValue = (value: string) => value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

      const [created] = await db.insert(catalogos).values({
        category: "raza",
        value,
        tipo: species,
        sortOrder: nextOrder,
      }).onConflictDoNothing().returning({ id: catalogos.id, value: catalogos.value, tipo: catalogos.tipo });
      if (created) {
        byValue.set(key, created);
        added += 1;
        nextOrder += 1;
      }
    }
  }
  return { added, associated };
}

async function main() {
  const settingsRows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
    key,
    value,
  }));

  const insertedSettings = settingsRows.length
    ? await db.insert(appSettings).values(settingsRows).onConflictDoNothing().returning({ key: appSettings.key })
    : [];

  const templateRows = Object.entries(VACCINATION_SCHEDULES).flatMap(([breed, events]) =>
    events.map((event) => ({
      species: BREED_SPECIES[breed] || "gallina",
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

  const addedStatuses = await ensureHenStatuses();
  const animalBreeds = await ensureAnimalBreeds();

  console.log(`Parámetros globales: ${insertedSettings.length} creados de ${settingsRows.length}.`);
  console.log(`Plantillas de vacunación: ${insertedTemplates.length} creadas de ${templateRows.length}.`);
  console.log(`Estados de gallina: ${addedStatuses} agregados de ${HEN_STATUSES.length}.`);
  console.log(`Razas de animales: ${animalBreeds.added} agregadas, ${animalBreeds.associated} asociadas a su especie.`);
}

main()
  .catch((error) => {
    console.error("Error sembrando configuración:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
