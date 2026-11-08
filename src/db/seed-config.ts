import { db, pool } from "@/db";
import { appSettings, catalogos, vaccinationTemplates } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { VACCINATION_SCHEDULES } from "@/lib/vaccination-schedules";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * Siembra idempotente de configuración.
 *
 * - Crea los parámetros globales con su valor por defecto (no sobrescribe
 *   valores ya editados por el usuario).
 * - Carga los planes de vacunación de referencia (no duplica plantillas).
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

  console.log(`Parámetros globales: ${insertedSettings.length} creados de ${settingsRows.length}.`);
  console.log(`Plantillas de vacunación: ${insertedTemplates.length} creadas de ${templateRows.length}.`);
  console.log(`Estados de gallina: ${addedStatuses} agregados de ${HEN_STATUSES.length}.`);
}

main()
  .catch((error) => {
    console.error("Error sembrando configuración:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
