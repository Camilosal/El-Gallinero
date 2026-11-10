// ─── Estimación de producción de gallinaza ───
// La producción diaria se estima como Σ (aves del grupo × factor kg/ave/día).
// Los factores son editables por el usuario (tabla manureFactors).

export interface BirdGroupCount {
  key: string;          // stageCatalogoId o 'gallo' o 'lote'
  label: string;        // nombre de la etapa / "Gallos" / "Lotes de engorde"
  count: number;        // número de aves
  kgPerBirdPerDay: number;
}

/** Reserved source for the idempotent daily estimate written to manureProduction. */
export const AUTO_MANURE_SOURCE = "auto_diario";

/** Stock events describe completed work and cannot be dated in the future. */
export function isTodayOrEarlierManureDate(date: string): boolean {
  return date <= new Date().toISOString().slice(0, 10);
}

/** Producción estimada kg/día de un grupo (2 decimales) */
export function estimatedKgPerDay(group: BirdGroupCount): number {
  return Math.round(group.count * group.kgPerBirdPerDay * 100) / 100;
}

/** Producción total kg/día de todos los grupos (2 decimales) */
export function totalEstimatedKgPerDay(groups: BirdGroupCount[]): number {
  const total = groups.reduce((sum, g) => sum + g.count * g.kgPerBirdPerDay, 0);
  return Math.round(total * 100) / 100;
}

/** Días transcurridos desde dateStr hasta today; nunca negativo */
export function daysSince(dateStr: string, today: Date = new Date()): number {
  const from = new Date(dateStr + "T12:00:00");
  const to = new Date(today.toISOString().split("T")[0] + "T12:00:00");
  const diff = Math.floor((to.getTime() - from.getTime()) / 86400000);
  return Math.max(0, diff);
}
