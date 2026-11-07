import { db, pool } from "@/db";
import { appSettings, vaccinationTemplates } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { VACCINATION_SCHEDULES } from "@/lib/vaccination-schedules";

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

  console.log(`Parámetros globales: ${insertedSettings.length} creados de ${settingsRows.length}.`);
  console.log(`Plantillas de vacunación: ${insertedTemplates.length} creadas de ${templateRows.length}.`);
}

main()
  .catch((error) => {
    console.error("Error sembrando configuración:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
