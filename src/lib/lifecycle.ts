// ─── Motor de ciclo de vida automático de gallinas ───
// Las gallinas en estados automáticos ("activa" / "recomendada_sacrificio")
// transicionan solas según edad y peso. Los estados manuales (enferma,
// descarte, empollando) y terminales (vendida, faena, muerta) nunca se tocan.

export const LIFECYCLE_RULES = {
  /** Edad (semanas) a partir de la cual la etapa de postura se considera finalizada */
  finPosturaWeeks: 80,
  /** Peso (kg) considerado adecuado para venta/sacrificio */
  pesoVentaKg: 2.5,
};

export interface LifecycleRules {
  finPosturaWeeks: number;
  pesoVentaKg: number;
}

/** Estados definidos por el usuario que el motor automático nunca modifica */
export const MANUAL_STATUSES = ["enferma", "descarte", "empollando"];

/** Estados terminales: el ave ya salió del sistema */
export const TERMINAL_STATUSES = ["vendida", "faena", "muerta"];

/** Estados gobernados por el motor automático */
export const AUTO_STATUSES = ["activa", "recomendada_sacrificio"];

/** Estados de aves que siguen en el gallinero y pueden ir a sacrificio o venta */
export const AVAILABLE_FOR_EXIT = ["activa", "empollando", "recomendada_sacrificio"];

export interface StageRange {
  id: string;
  value: string;
  minWeeks: number | null;
  maxWeeks: number | null;
}

export interface HenLike {
  birthDate: string;
  weight: string | null;
  status: string;
}

export interface LifecycleResult {
  /** Estado resuelto por el motor (solo aplica a estados automáticos) */
  status: string;
  /** Etapa de crecimiento según edad */
  stage: string | null;
  /** Edad en semanas completas */
  ageWeeks: number;
  /** Razones por las que se recomienda sacrificio (vacío = sin recomendación) */
  reasons: string[];
}

/** ¿El estado es gobernado por el motor automático? */
export function isAutoManaged(status: string): boolean {
  return AUTO_STATUSES.includes(status);
}

/** ¿El ave está disponible para sacrificio/venta? */
export function isAvailableForExit(status: string): boolean {
  return AVAILABLE_FOR_EXIT.includes(status);
}

/** Edad en semanas (con decimales) a partir de la fecha de nacimiento */
export function ageInWeeks(birthDate: string, today: Date = new Date()): number {
  const birth = new Date(birthDate + "T12:00:00");
  return (today.getTime() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000);
}

/** Etapa de crecimiento que corresponde a una edad en semanas */
export function stageForAge(stages: StageRange[], weeks: number): StageRange | null {
  for (const stage of stages) {
    const min = stage.minWeeks ?? 0;
    const max = stage.maxWeeks;
    if (weeks >= min && (max === null || weeks < max)) {
      return stage;
    }
  }
  return null;
}

/**
 * Evalúa el ciclo de vida de una gallina y resuelve su estado automático.
 * Reglas de recomendación de sacrificio (cualquiera de las dos basta):
 *  1. La etapa de postura ya pasó (edad ≥ finPosturaWeeks)
 *  2. Tiene el peso adecuado para venta (peso ≥ pesoVentaKg)
 * El objetivo es liberar espacio en el gallinero cuando el ave ya cumplió
 * su ciclo productivo o cuando tiene el peso comercial deseado.
 */
export function evaluateLifecycle(
  hen: HenLike,
  stages: StageRange[],
  rules: LifecycleRules = LIFECYCLE_RULES,
): LifecycleResult {
  const weeks = ageInWeeks(hen.birthDate);
  const stage = stageForAge(stages, weeks);

  const reasons: string[] = [];
  const pastLayingAge = weeks >= rules.finPosturaWeeks;
  const weight = hen.weight ? Number(hen.weight) : 0;
  const adequateWeight = weight >= rules.pesoVentaKg;

  if (pastLayingAge) {
    reasons.push(`Etapa de postura finalizada (${rules.finPosturaWeeks}+ semanas)`);
  }
  if (adequateWeight) {
    reasons.push(`Peso adecuado para venta (≥ ${rules.pesoVentaKg} kg)`);
  }

  return {
    status: (pastLayingAge || adequateWeight) ? "recomendada_sacrificio" : "activa",
    stage: stage?.value ?? null,
    ageWeeks: Math.floor(weeks),
    reasons,
  };
}
