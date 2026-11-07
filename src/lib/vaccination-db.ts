import { db } from "@/db";
import { vaccinationTemplates } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { VACCINATION_SCHEDULES, type VaccinationEvent } from "./vaccination-schedules";

/**
 * Carga el plan de vacunación desde Catálogos (vaccination_templates).
 * Si no hay plantillas para la raza, usa el calendario estático como respaldo.
 */
export async function loadVaccinationSchedule(breed: string): Promise<VaccinationEvent[]> {
  try {
    const rows = await db
      .select()
      .from(vaccinationTemplates)
      .where(and(eq(vaccinationTemplates.breed, breed), eq(vaccinationTemplates.isActive, true)))
      .orderBy(asc(vaccinationTemplates.weekNumber), asc(vaccinationTemplates.name));

    if (rows.length > 0) {
      return rows.map((row) => ({
        weekNumber: row.weekNumber,
        name: row.name,
        description: row.description || "",
        type: "vacunacion" as const,
        frequencyDays: row.frequencyDays,
      }));
    }
  } catch {
    // Si la tabla no existe todavía, se usa el respaldo estático.
  }

  return VACCINATION_SCHEDULES[breed] || [];
}
