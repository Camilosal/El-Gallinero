import { addDaysIso } from "@/lib/date-validation";
import { normalizeDay1Species } from "@/lib/onboarding";
import type { Day1SetupUnitInput } from "@/lib/onboarding-server";
import { getStandardCurve, interpolateStandard } from "@/lib/standard-curves";
import { flockPlanMilestones, flockPlans, sanitaryCalendar } from "@/db/schema";

export interface PlannedMilestone {
  weekNumber: number;
  label: string;
  phase: string;
  expectedCount: number;
  expectedEggsPerWeek: number;
  expectedFeedKgPerWeek: number;
  dueDate: string;
}

export interface PlannedSanitaryEvent {
  type: string;
  name: string;
  description: string;
  targetBirds: string;
  frequencyDays: number | null;
  nextDueDate: string;
}

export interface InitialBiologicalPlan {
  species: string;
  planName: string;
  currentAgeDays: number;
  currentAgeWeeks: number;
  currentPhase: string;
  birthOrStartDate: string;
  milestones: PlannedMilestone[];
  sanitaryEvents: PlannedSanitaryEvent[];
}

function futureDateFromAge(
  operationStartDate: string,
  currentAgeDays: number,
  targetAgeDays: number,
): string {
  const deltaDays = Math.max(0, targetAgeDays - currentAgeDays);
  return addDaysIso(operationStartDate, deltaDays);
}

/**
 * Construye el plan biológico inicial Día 1 sin deuda histórica:
 * únicamente genera hitos vigentes o futuros respecto a la edad actual hoy.
 */
export function buildInitialBiologicalPlan(
  unit: Day1SetupUnitInput,
  operationStartDate: string,
): InitialBiologicalPlan {
  const species = normalizeDay1Species(unit.especie);
  const qty = Math.max(1, Math.round(Number(unit.cantidadVivaHoy) || 0));
  const currentAgeDays = Math.max(0, Math.round(Number(unit.edadActualDias) || 0));
  const currentAgeWeeks = Math.floor(currentAgeDays / 7);
  const birthOrStartDate =
    currentAgeDays > 0 ? addDaysIso(operationStartDate, -currentAgeDays) : operationStartDate;
  const breed = (unit.lineaGenetica || "").trim();

  const milestones: PlannedMilestone[] = [];
  const sanitaryEvents: PlannedSanitaryEvent[] = [];
  let currentPhase = "produccion";

  if (species === "gallina" || species === "gallo") {
    currentPhase =
      currentAgeWeeks < 15
        ? "levante"
        : currentAgeWeeks <= 18
          ? "pre-postura"
          : "postura";
    const curve = getStandardCurve("gallina", breed || "Hy-Line Brown");
    const targetWeeks = [15, 18, 22, 26, 30, 40, 50, 60, 75, 90, 100].filter(
      (w) => w >= currentAgeWeeks,
    );
    const milestoneWeeks = targetWeeks.length > 0 ? targetWeeks : [currentAgeWeeks];

    for (const w of milestoneWeeks) {
      const point = curve ? interpolateStandard(curve, w) : null;
      const pctPostura = point ? point.target : w >= 20 ? 85 : w >= 18 ? 10 : 0;
      const feedGPerDay = w < 15 ? 72 : w <= 18 ? 90 : 112;
      const label =
        w < 15
          ? `Levante semana ${w}`
          : w <= 18
            ? `Transición pre-postura semana ${w}`
            : `Control postura semana ${w}`;

      milestones.push({
        weekNumber: w,
        label,
        phase: w < 15 ? "levante" : w <= 18 ? "pre-postura" : "postura",
        expectedCount: qty,
        expectedEggsPerWeek: Math.round((qty * (pctPostura / 100)) * 7),
        expectedFeedKgPerWeek: Number(((qty * feedGPerDay * 7) / 1000).toFixed(2)),
        dueDate: futureDateFromAge(operationStartDate, currentAgeDays, w * 7),
      });
    }

    if (currentAgeWeeks < 15) {
      sanitaryEvents.push({
        type: "manejo",
        name: "Cambio a alimento pre-postura (sem 15–18)",
        description: "Transición gradual de alimento de levante a pre-postura Hy-Line Brown.",
        targetBirds: "gallina",
        frequencyDays: null,
        nextDueDate: futureDateFromAge(operationStartDate, currentAgeDays, 15 * 7),
      });
    }

    sanitaryEvents.push({
      type: "vacunacion",
      name: "Refuerzo Newcastle + Bronquitis (programa vigente)",
      description: "Mantenimiento inmunitario programado en postura sin arrastrar vacunas pasadas.",
      targetBirds: "gallina",
      frequencyDays: 90,
      nextDueDate: addDaysIso(operationStartDate, 14),
    });
  } else if (species === "pollo") {
    currentPhase = currentAgeDays < 15 ? "iniciacion" : currentAgeDays < 35 ? "engorde" : "cosecha";
    const weighDays = [7, 14, 21, 28, 35, 42, 49].filter((d) => d >= currentAgeDays);
    for (const day of weighDays) {
      milestones.push({
        weekNumber: Math.max(1, Math.round(day / 7)),
        label: `Pesaje semanal día ${day}`,
        phase: day >= 35 ? "ventana_cosecha" : "engorde",
        expectedCount: qty,
        expectedEggsPerWeek: 0,
        expectedFeedKgPerWeek: Number(((qty * 0.12 * 7)).toFixed(2)),
        dueDate: futureDateFromAge(operationStartDate, currentAgeDays, day),
      });
    }
    sanitaryEvents.push({
      type: "manejo",
      name: "Ventana óptima de sacrificio pollo (días 35–49)",
      description: "Evaluar peso promedio y conversión alimenticia antes del día 49.",
      targetBirds: "pollo",
      frequencyDays: null,
      nextDueDate: futureDateFromAge(operationStartDate, currentAgeDays, 35),
    });
  } else if (species === "codorniz") {
    currentPhase = currentAgeWeeks < 6 ? "cria" : "postura";
    const targetDayOnset = 42; // semana 6
    if (currentAgeDays < targetDayOnset) {
      milestones.push({
        weekNumber: 6,
        label: "Inicio postura codorniz (semana 6)",
        phase: "postura",
        expectedCount: qty,
        expectedEggsPerWeek: Math.round(qty * 0.85 * 7),
        expectedFeedKgPerWeek: Number(((qty * 24 * 7) / 1000).toFixed(2)),
        dueDate: futureDateFromAge(operationStartDate, currentAgeDays, targetDayOnset),
      });
    } else {
      milestones.push({
        weekNumber: Math.max(6, currentAgeWeeks),
        label: "Ración estándar codorniz (23–25 g/día)",
        phase: "postura",
        expectedCount: qty,
        expectedEggsPerWeek: Math.round(qty * 0.88 * 7),
        expectedFeedKgPerWeek: Number(((qty * 24 * 7) / 1000).toFixed(2)),
        dueDate: addDaysIso(operationStartDate, 7),
      });
    }
    sanitaryEvents.push({
      type: "manejo",
      name: "Control postura y ración codorniz (23–25 g/ave/día)",
      description: "Si hay lotes en incubación (16–18 días), suspender volteo en el día 14.",
      targetBirds: "codorniz",
      frequencyDays: 30,
      nextDueDate: currentAgeDays < targetDayOnset
        ? futureDateFromAge(operationStartDate, currentAgeDays, targetDayOnset)
        : addDaysIso(operationStartDate, 7),
    });
  } else if (species === "pato") {
    currentPhase = currentAgeDays < 49 ? "engorde" : "ventana_cosecha";
    const checkpoints = [28, 49, 56].filter((d) => d >= currentAgeDays);
    for (const day of checkpoints) {
      milestones.push({
        weekNumber: Math.round(day / 7),
        label:
          day === 56
            ? "Límite eficiencia FCR Pato Pekín (semana 8 / día 56)"
            : `Control crecimiento pato semana ${Math.round(day / 7)}`,
        phase: day >= 49 ? "ventana_cosecha" : "engorde",
        expectedCount: qty,
        expectedEggsPerWeek: 0,
        expectedFeedKgPerWeek: Number(((qty * 0.2 * 7)).toFixed(2)),
        dueDate: futureDateFromAge(operationStartDate, currentAgeDays, day),
      });
    }
    sanitaryEvents.push({
      type: "manejo",
      name: "Ventana óptima Pekín (sem 7–8) y baño restringido",
      description: "Cosechar entre semanas 7 y 8 (máx. día 56 para evitar disparo de FCR) con baño restringido.",
      targetBirds: "pato",
      frequencyDays: null,
      nextDueDate: futureDateFromAge(operationStartDate, currentAgeDays, 49),
    });
  } else if (species === "conejo") {
    currentPhase = "reproduccion";
    milestones.push({
      weekNumber: Math.max(1, currentAgeWeeks),
      label: "Ciclo reproductivo conejo (gestación 31–32d, destete 21–40d)",
      phase: "reproduccion",
      expectedCount: qty,
      expectedEggsPerWeek: 0,
      expectedFeedKgPerWeek: Number(((qty * 0.13 * 7)).toFixed(2)),
      dueDate: addDaysIso(operationStartDate, 18),
    });
    sanitaryEvents.push(
      {
        type: "manejo",
        name: "Chequeo de palpación coneja (día 18)",
        description: "Confirmación de preñez tras empadre; preparar nidal en día 26 (gestación 31–32 días).",
        targetBirds: "conejo",
        frequencyDays: 42,
        nextDueDate: addDaysIso(operationStartDate, 18),
      },
      {
        type: "manejo",
        name: "Colocación de nidal coneja (día 26)",
        description: "Desinfectar y ubicar nidal limpio antes del parto (días 31–32).",
        targetBirds: "conejo",
        frequencyDays: 42,
        nextDueDate: addDaysIso(operationStartDate, 26),
      },
    );
  } else {
    // cuy
    currentPhase = currentAgeDays >= 75 ? "cosecha" : "reproduccion_y_cria";
    milestones.push({
      weekNumber: Math.max(1, currentAgeWeeks),
      label: "Plan cuyes: destete/sexado 15–18d · engorde 75–90d",
      phase: currentPhase,
      expectedCount: qty,
      expectedEggsPerWeek: 0,
      expectedFeedKgPerWeek: Number(((qty * 0.055 * 7)).toFixed(2)),
      dueDate: addDaysIso(operationStartDate, 15),
    });
    sanitaryEvents.push(
      {
        type: "manejo",
        name: "Control de destete y sexado de cuyes (15–18 días)",
        description: "Separar gazapos por sexo entre los días 15 y 18 posparto (gestación 64–68 días).",
        targetBirds: "cuy",
        frequencyDays: 30,
        nextDueDate: addDaysIso(operationStartDate, 15),
      },
      {
        type: "manejo",
        name: "Revisión salida de cuyes de engorde (días 75–90)",
        description: "Evaluar peso de sacrificio entre días 75 y 90 para evitar pérdida de FCR.",
        targetBirds: "cuy",
        frequencyDays: 30,
        nextDueDate: futureDateFromAge(operationStartDate, currentAgeDays, 75),
      },
    );
  }

  return {
    species,
    planName: `Plan Día 1 · ${unit.nombreInstalacion.trim()} (${species})`,
    currentAgeDays,
    currentAgeWeeks,
    currentPhase,
    birthOrStartDate,
    milestones,
    sanitaryEvents,
  };
}

export async function seedBiologicalPreloadInTx(
  tx: any,
  units: Day1SetupUnitInput[],
  operationStartDate: string,
): Promise<{
  plansCreated: number;
  milestonesCreated: number;
  sanitaryEventsCreated: number;
}> {
  let plansCreated = 0;
  let milestonesCreated = 0;
  let sanitaryEventsCreated = 0;

  for (const unit of units) {
    if ((Number(unit.cantidadVivaHoy) || 0) <= 0) continue;
    const planData = buildInitialBiologicalPlan(unit, operationStartDate);

    const [createdPlan] = await tx
      .insert(flockPlans)
      .values({
        name: planData.planName.slice(0, 200),
        startDate: operationStartDate,
        targetHenCount: Math.max(1, Math.round(Number(unit.cantidadVivaHoy) || 1)),
        currentPhase: planData.currentPhase.slice(0, 50),
        status: "activo",
        notes: `Precarga biológica Día 1 sin deuda histórica (${planData.species}, edad inicio ${planData.currentAgeDays} días).`,
      })
      .returning({ id: flockPlans.id });

    plansCreated += 1;

    if (planData.milestones.length > 0) {
      await tx.insert(flockPlanMilestones).values(
        planData.milestones.map((m) => ({
          planId: createdPlan.id,
          weekNumber: m.weekNumber,
          expectedHens: m.expectedCount,
          expectedEggsPerWeek: m.expectedEggsPerWeek,
          expectedFeedKgPerWeek: m.expectedFeedKgPerWeek.toFixed(2),
        })),
      );
      milestonesCreated += planData.milestones.length;
    }

    if (planData.sanitaryEvents.length > 0) {
      await tx.insert(sanitaryCalendar).values(
        planData.sanitaryEvents.map((ev) => ({
          type: ev.type,
          name: ev.name.slice(0, 200),
          description: ev.description,
          targetBirds: ev.targetBirds,
          frequencyDays: ev.frequencyDays,
          nextDueDate: ev.nextDueDate,
          isActive: true,
        })),
      );
      sanitaryEventsCreated += planData.sanitaryEvents.length;
    }
  }

  return {
    plansCreated,
    milestonesCreated,
    sanitaryEventsCreated,
  };
}

