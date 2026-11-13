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
export function requiredRoosters(
  activeHenCount: number,
  hensPerRooster: number = FLOCK_RULES.hensPerRooster,
): number {
  return Math.ceil(activeHenCount / Math.max(1, hensPerRooster));
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
  targetDays?: number | null;
  targetWeightKg: string | number;
  avgWeightKg: string | number | null;
}

export interface BatchReadiness {
  ready: boolean;
  ageWeeks: number;
  ageDays: number;
  reasons: string[];
}

/**
 * Evalúa si un lote de engorde está listo para sacrificio:
 * cumple la edad objetivo (semanas O días) O el peso promedio objetivo.
 * Los conejos y cuyes usan targetDays; las aves usan targetWeeks.
 */
export function batchReadiness(batch: BatchLike, today: Date = new Date()): BatchReadiness {
  const start = new Date(batch.startDate + "T12:00:00");
  const msElapsed = today.getTime() - start.getTime();
  const ageDays = Math.floor(msElapsed / (24 * 60 * 60 * 1000));
  const ageWeeks = Math.floor(msElapsed / (7 * 24 * 60 * 60 * 1000));

  const reasons: string[] = [];

  // Criterio por días (conejos y cuyes principalmente)
  const effectiveTargetDays = batch.targetDays ?? batch.targetWeeks * 7;
  if (ageDays >= effectiveTargetDays) {
    if (batch.targetDays) {
      reasons.push(`Edad objetivo alcanzada (${batch.targetDays} días)`);
    } else {
      reasons.push(`Edad objetivo alcanzada (${batch.targetWeeks} sem)`);
    }
  }

  const weight = batch.avgWeightKg != null ? Number(batch.avgWeightKg) : null;
  const target = Number(batch.targetWeightKg);
  if (weight != null && weight >= target) {
    reasons.push(`Peso objetivo alcanzado (≥ ${target} kg)`);
  }

  return { ready: reasons.length > 0, ageWeeks, ageDays, reasons };
}

/** Balance de gallos vs gallinas del gallinero */
export function flockBalance(
  activeHenCount: number,
  activeRoosterCount: number,
  hensPerRooster: number = FLOCK_RULES.hensPerRooster,
) {
  const required = requiredRoosters(activeHenCount, hensPerRooster);
  return {
    required,
    active: activeRoosterCount,
    deficit: Math.max(0, required - activeRoosterCount),
    surplus: Math.max(0, activeRoosterCount - required),
  };
}
