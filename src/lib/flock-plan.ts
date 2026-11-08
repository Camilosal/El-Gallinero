import { ageInWeeks, stageForAge, type StageRange } from "./lifecycle";
import { isHenPresent, isRoosterPresent, summarizeHens, type StatusCount } from "./animal-status";

/**
 * Diagnóstico y proyección del plan de parvada.
 *
 * La proyección se calcula con la edad real de cada gallina y los estándares
 * de postura del catálogo (`etapa_crecimiento.expected_eggs_per_hen`), no con
 * una curva fija. Así el plan responde a la parvada que realmente existe.
 */

const MS_DAY = 24 * 60 * 60 * 1000;

export interface FlockPlanHen {
  code?: string;
  birthDate: string;
  status: string;
}

export interface FlockPlanStage extends StageRange {
  expectedEggsPerHen?: number | string | null;
  dailyFeedG?: number | null;
}

export interface WeeklyEggTotal {
  weekStart: string;
  totalEggs: number;
}

export interface FlockPlanGoal {
  startDate: string;
  targetHenCount: number;
  targetRoosterCount: number | null;
  replacementDate: string | null;
}

export type FlockPlanAlertLevel = "success" | "warning" | "info";

export interface FlockPlanAlertAction {
  label: string;
  href: string;
}

export interface FlockPlanAlert {
  level: FlockPlanAlertLevel;
  title: string;
  detail: string;
  /** Enlace directo a la pantalla donde se resuelve la alerta. */
  action?: FlockPlanAlertAction;
}

export interface FlockPlanLive {
  date: string;
  animalsTotal: number;
  hens: {
    total: number;
    laying: number;
    broody: number;
    sick: number;
    recommended: number;
    inCycle: number;
    avgAgeWeeks: number;
    phase: string;
    stageCounts: { stage: string; count: number }[];
  };
  roosters: {
    active: number;
    required: number;
    deficit: number;
    surplus: number;
  };
  batches: {
    count: number;
    quantity: number;
  };
  eggs: {
    last7: number;
    previous7: number;
    avgDaily: number;
    expectedPerDay: number;
    expectedPerWeek: number;
    compliancePct: number;
  };
  feed: {
    dailyKg: number;
    weeklyKg: number;
  };
  replacement: {
    dueNow: number;
    nextWeeks: number | null;
    nextDate: string | null;
  };
  alerts: FlockPlanAlert[];
}

export interface FlockPlanWeek {
  /** Semanas respecto a la semana actual: -4 = hace 4 semanas, 0 = actual. */
  offset: number;
  weekStart: string;
  weekEnd: string;
  label: string;
  rangeLabel: string;
  expectedHens: number;
  expectedEggs: number;
  expectedFeedKg: number;
  actualEggs: number | null;
  actualHens: number | null;
  compliancePct: number | null;
  isCurrent: boolean;
  isPast: boolean;
}

export interface FlockPlanProjection {
  weeks: FlockPlanWeek[];
  currentWeek: FlockPlanWeek | null;
}

export interface BuildFlockPlanInput {
  today?: Date;
  hens: FlockPlanHen[];
  roosterStatuses: string[];
  batchCount: number;
  batchQuantity: number;
  stages: FlockPlanStage[];
  finPosturaWeeks: number;
  hensPerRooster: number;
  last7Eggs: number;
  previous7Eggs: number;
  eggWeeks: WeeklyEggTotal[];
  plan?: FlockPlanGoal | null;
}

export interface FlockPlanPlanSummary {
  progressPct: number;
  daysToReplacement: number | null;
  currentHens: number;
  gapHens: number;
  gapRoosters: number;
  phase: string;
}

function atNoon(date: Date): Date {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

export function parseISODate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = atNoon(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Lunes de la semana que contiene la fecha. */
export function startOfWeek(date: Date): Date {
  const base = atNoon(date);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(base, diff);
}

function formatShort(date: Date): string {
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function feedGramsForAge(age: number, stage: FlockPlanStage | null): number {
  if (stage?.dailyFeedG) return Number(stage.dailyFeedG);
  return age < 20 ? 80 : 110;
}

function stageForHen(hen: FlockPlanHen, date: Date, stages: FlockPlanStage[]): FlockPlanStage | null {
  return (stageForAge(stages, ageInWeeks(hen.birthDate, date)) as FlockPlanStage | null) ?? null;
}

function isInCycle(hen: FlockPlanHen, date: Date, finPosturaWeeks: number): boolean {
  return ageInWeeks(hen.birthDate, date) < finPosturaWeeks;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(actual: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.round((actual / expected) * 1000) / 10;
}

export function buildFlockPlanLive(input: BuildFlockPlanInput): FlockPlanLive {
  const today = atNoon(input.today ?? new Date());
  const presentHens = input.hens.filter((hen) => isHenPresent(hen.status));
  const statusRows: StatusCount[] = Object.entries(
    presentHens.reduce<Record<string, number>>((acc, hen) => {
      acc[hen.status] = (acc[hen.status] || 0) + 1;
      return acc;
    }, {}),
  ).map(([status, count]) => ({ status, count }));
  const henSummary = summarizeHens(statusRows);

  const inCycleHens = presentHens.filter((hen) => isInCycle(hen, today, input.finPosturaWeeks));
  const stageMap = new Map<string, number>();
  let expectedPerDay = 0;
  let dailyFeedG = 0;
  let totalAgeWeeks = 0;

  for (const hen of presentHens) {
    const age = ageInWeeks(hen.birthDate, today);
    totalAgeWeeks += age;
    const stage = stageForHen(hen, today, input.stages);
    if (stage) stageMap.set(stage.value, (stageMap.get(stage.value) || 0) + 1);
    if (age < input.finPosturaWeeks) {
      expectedPerDay += Number(stage?.expectedEggsPerHen || 0);
      dailyFeedG += feedGramsForAge(age, stage);
    }
  }

  const stageCounts = Array.from(stageMap.entries())
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);
  const phase = stageCounts[0]?.stage || (presentHens.length > 0 ? "Sin etapa" : "Sin aves");

  const activeRoosters = input.roosterStatuses.filter((status) => isRoosterPresent(status)).length;
  const requiredRoosters = Math.ceil(presentHens.length / Math.max(1, input.hensPerRooster));
  const deficit = Math.max(0, requiredRoosters - activeRoosters);
  const surplus = Math.max(0, activeRoosters - requiredRoosters);

  const expectedPerWeek = Math.round(expectedPerDay * 7);
  const compliancePct = pct(input.last7Eggs, expectedPerWeek);
  const dueNow = presentHens.filter((hen) => !isInCycle(hen, today, input.finPosturaWeeks)).length;
  const nextWeeks = presentHens
    .filter((hen) => isInCycle(hen, today, input.finPosturaWeeks))
    .reduce<number | null>((min, hen) => {
      const weeks = Math.max(0, Math.ceil(input.finPosturaWeeks - ageInWeeks(hen.birthDate, today)));
      return min === null || weeks < min ? weeks : min;
    }, null);

  const alerts: FlockPlanAlert[] = [];
  if (dueNow > 0) {
    alerts.push({
      level: "warning",
      title: `${dueNow} gallina${dueNow > 1 ? "s" : ""} fuera del ciclo de postura`,
      detail: `Ya cumplieron ${input.finPosturaWeeks} semanas. Venderlas o reemplazarlas libera espacio y evita gastar alimento en aves de baja postura.`,
      action: { label: "Ver gallinas", href: "/dashboard/produccion?tab=gallinas" },
    });
  }
  if (henSummary.recommendedForSlaughter > 0) {
    alerts.push({
      level: "warning",
      title: `${henSummary.recommendedForSlaughter} gallina${henSummary.recommendedForSlaughter > 1 ? "s" : ""} recomendada${henSummary.recommendedForSlaughter > 1 ? "s" : ""} para sacrificio o venta`,
      detail: "Revisa el listado de gallinas: el sistema las marcó por peso o por haber terminado su etapa productiva.",
      action: {
        label: "Ver recomendadas",
        href: "/dashboard/produccion?tab=gallinas&estado=recomendada_sacrificio",
      },
    });
  }
  if (compliancePct > 0 && compliancePct < 90) {
    alerts.push({
      level: "warning",
      title: `Postura ${compliancePct}% de lo esperado`,
      detail: "Los últimos 7 días están por debajo de la curva para la edad del lote. Revisa alimento, agua, sanidad y conteo de huevos.",
      action: { label: "Revisar producción", href: "/dashboard/produccion/huevos" },
    });
  } else if (compliancePct > 110) {
    alerts.push({
      level: "info",
      title: `Postura ${compliancePct}% de lo esperado`,
      detail: "La producción supera el estándar del catálogo. Verifica el conteo o ajusta el estándar de postura si tu genética rinde más.",
      action: { label: "Revisar producción", href: "/dashboard/produccion/huevos" },
    });
  } else if (compliancePct >= 90) {
    alerts.push({
      level: "success",
      title: `Postura ${compliancePct}% de lo esperado`,
      detail: "La producción de los últimos 7 días está alineada con la curva de la parvada.",
    });
  }
  if (deficit > 0) {
    alerts.push({
      level: "warning",
      title: `Faltan ${deficit} gallo${deficit > 1 ? "s" : ""} para la relación ${input.hensPerRooster}:1`,
      detail: `Hay ${presentHens.length} gallinas y ${activeRoosters} gallos. La meta es ${requiredRoosters} gallos reproductores.`,
      action: { label: "Ver gallos", href: "/dashboard/produccion?tab=pollos" },
    });
  } else if (surplus > 0) {
    alerts.push({
      level: "info",
      title: `Hay ${surplus} gallo${surplus > 1 ? "s" : ""} por encima de la relación ${input.hensPerRooster}:1`,
      detail: `Con ${presentHens.length} gallinas bastan ${requiredRoosters} gallos. Los excedentes pueden destinarse a venta o sacrificio.`,
      action: { label: "Ver gallos", href: "/dashboard/produccion?tab=pollos" },
    });
  } else {
    alerts.push({
      level: "success",
      title: "Relación gallos/gallinas adecuada",
      detail: `${activeRoosters} gallo${activeRoosters === 1 ? "" : "s"} para ${presentHens.length} gallinas (meta ${input.hensPerRooster}:1).`,
    });
  }
  if (nextWeeks !== null && nextWeeks <= 8) {
    alerts.push({
      level: "info",
      title: `Próximo reemplazo en ${nextWeeks} semana${nextWeeks === 1 ? "" : "s"}`,
      detail: `Una gallina del lote actual cumplirá ${input.finPosturaWeeks} semanas. Programa la reposición para no perder postura.`,
    });
  }

  return {
    date: toISODate(today),
    animalsTotal: presentHens.length + activeRoosters + input.batchQuantity,
    hens: {
      total: presentHens.length,
      laying: henSummary.laying,
      broody: henSummary.broody,
      sick: henSummary.sick,
      recommended: henSummary.recommendedForSlaughter,
      inCycle: inCycleHens.length,
      avgAgeWeeks: presentHens.length > 0 ? round1(totalAgeWeeks / presentHens.length) : 0,
      phase,
      stageCounts,
    },
    roosters: {
      active: activeRoosters,
      required: requiredRoosters,
      deficit,
      surplus,
    },
    batches: {
      count: input.batchCount,
      quantity: input.batchQuantity,
    },
    eggs: {
      last7: input.last7Eggs,
      previous7: input.previous7Eggs,
      avgDaily: round1(input.last7Eggs / 7),
      expectedPerDay: round1(expectedPerDay),
      expectedPerWeek,
      compliancePct,
    },
    feed: {
      dailyKg: round1(dailyFeedG / 1000),
      weeklyKg: round1((dailyFeedG * 7) / 1000),
    },
    replacement: {
      dueNow,
      nextWeeks,
      nextDate: nextWeeks !== null ? toISODate(addDays(today, nextWeeks * 7)) : null,
    },
    alerts,
  };
}

export function buildFlockPlanProjection(input: BuildFlockPlanInput): FlockPlanProjection {
  const today = atNoon(input.today ?? new Date());
  const currentWeekStart = startOfWeek(today);
  const presentHens = input.hens.filter((hen) => isHenPresent(hen.status));
  const weeklyEggs = new Map(input.eggWeeks.map((row) => [row.weekStart, row.totalEggs]));

  const weeks: FlockPlanWeek[] = [];
  for (let offset = -4; offset <= 12; offset++) {
    const weekStart = addDays(currentWeekStart, offset * 7);
    const weekEnd = addDays(weekStart, 6);
    const isCurrent = offset === 0;
    const isPast = weekEnd.getTime() < today.getTime();

    let expectedHens = 0;
    let expectedEggs = 0;
    let feedGrams = 0;

    for (const hen of presentHens) {
      if (ageInWeeks(hen.birthDate, weekStart) >= input.finPosturaWeeks) continue;
      const stage = stageForHen(hen, weekStart, input.stages);
      expectedHens++;
      expectedEggs += Number(stage?.expectedEggsPerHen || 0) * 7;
      feedGrams += feedGramsForAge(ageInWeeks(hen.birthDate, weekStart), stage) * 7;
    }

    const actualEggs = isPast || isCurrent
      ? weeklyEggs.get(toISODate(weekStart)) ?? 0
      : null;
    const actualHens = isCurrent ? presentHens.length : null;
    const expected = Math.round(expectedEggs);

    weeks.push({
      offset,
      weekStart: toISODate(weekStart),
      weekEnd: toISODate(weekEnd),
      label: offset === 0 ? "Actual" : offset > 0 ? `+${offset}` : `${offset}`,
      rangeLabel: `${formatShort(weekStart)} – ${formatShort(weekEnd)}`,
      expectedHens,
      expectedEggs: expected,
      expectedFeedKg: round1(feedGrams / 1000),
      actualEggs,
      actualHens,
      compliancePct: isCurrent || !isPast ? null : pct(actualEggs ?? 0, expected),
      isCurrent,
      isPast,
    });
  }

  return {
    weeks,
    currentWeek: weeks.find((week) => week.isCurrent) ?? null,
  };
}

export function buildFlockPlanSummary(
  plan: FlockPlanGoal,
  live: FlockPlanLive,
  today: Date = new Date(),
): FlockPlanPlanSummary {
  const start = parseISODate(plan.startDate);
  const replacement = plan.replacementDate ? parseISODate(plan.replacementDate) : addDays(start, 80 * 7);
  const totalDays = Math.max(1, Math.round((replacement.getTime() - start.getTime()) / MS_DAY));
  const elapsedDays = Math.round((atNoon(today).getTime() - start.getTime()) / MS_DAY);
  const progressPct = Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 1000) / 10));
  const daysToReplacement = Math.round((replacement.getTime() - atNoon(today).getTime()) / MS_DAY);

  return {
    progressPct,
    daysToReplacement,
    currentHens: live.hens.inCycle,
    gapHens: live.hens.inCycle - plan.targetHenCount,
    gapRoosters: live.roosters.active - (plan.targetRoosterCount ?? 0),
    phase: live.hens.phase,
  };
}
