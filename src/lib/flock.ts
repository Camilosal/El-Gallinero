// ─── Reglas de parvada: gallos reproductores y lotes de engorde ───
// Regla de negocio: mínimo 1 gallo por cada 10 gallinas del gallinero.
// Los machos sobrantes se destinan a lotes de pollo de sacrificio.

export const FLOCK_RULES = {
  /** Gallinas por gallo reproductor requerido */
  hensPerRooster: 10,
  /** Edad objetivo (semanas) por defecto para lotes de engorde */
  defaultTargetWeeks: 7,
  /** Peso objetivo (kg) por defecto para lotes de engorde */
  defaultTargetWeightKg: 2.5,
};

/** Gallos requeridos para un número de gallinas activas */
export function requiredRoosters(activeHenCount: number): number {
  return Math.ceil(activeHenCount / FLOCK_RULES.hensPerRooster);
}

/**
 * Distribuye machos recién nacidos/ingresados:
 * primero cubre el déficit de gallos reproductores, el resto va a sacrificio.
 */
export function assignMales(males: number, activeRoosters: number, required: number) {
  const toRoosters = Math.max(0, Math.min(males, required - activeRoosters));
  return { toRoosters, toSlaughter: males - toRoosters };
}

export interface BatchLike {
  startDate: string;
  targetWeeks: number;
  targetWeightKg: string | number;
  avgWeightKg: string | number | null;
}

export interface BatchReadiness {
  ready: boolean;
  ageWeeks: number;
  reasons: string[];
}

/**
 * Evalúa si un lote de engorde está listo para sacrificio:
 * cumple la edad objetivo O el peso promedio objetivo.
 */
export function batchReadiness(batch: BatchLike, today: Date = new Date()): BatchReadiness {
  const start = new Date(batch.startDate + "T12:00:00");
  const ageWeeks = Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));

  const reasons: string[] = [];
  if (ageWeeks >= batch.targetWeeks) {
    reasons.push(`Edad objetivo alcanzada (${batch.targetWeeks} sem)`);
  }
  const weight = batch.avgWeightKg != null ? Number(batch.avgWeightKg) : null;
  const target = Number(batch.targetWeightKg);
  if (weight != null && weight >= target) {
    reasons.push(`Peso objetivo alcanzado (≥ ${target} kg)`);
  }

  return { ready: reasons.length > 0, ageWeeks, reasons };
}

/** Balance de gallos vs gallinas del gallinero */
export function flockBalance(activeHenCount: number, activeRoosterCount: number) {
  const required = requiredRoosters(activeHenCount);
  return {
    required,
    active: activeRoosterCount,
    deficit: Math.max(0, required - activeRoosterCount),
    surplus: Math.max(0, activeRoosterCount - required),
  };
}
