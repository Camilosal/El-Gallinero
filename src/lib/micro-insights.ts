export type MicroInsightTone = "positive" | "warning" | "critical" | "info";

export type DailyHabitStep =
  | "huevos"
  | "alimentacion"
  | "mortalidad"
  | "finanzas"
  | "sanidad"
  | "reproduccion";

export interface MicroInsightMetric {
  label: string;
  value: string;
  helper?: string;
  highlight?: "good" | "warn" | "bad" | "neutral";
}

export interface MicroInsightNextAction {
  label: string;
  mode?: "huevos" | "alimentacion" | "mortalidad" | "gasto" | "venta";
  href?: string;
}

export interface DailyHabitProgress {
  date: string;
  completedSteps: DailyHabitStep[];
  completedEssentialCount: number;
  essentialTotal: number;
  streakDays: number;
  nextSuggestedMode?: "huevos" | "alimentacion" | "mortalidad" | "gasto" | "venta";
  nextSuggestedLabel?: string;
}

export interface MicroInsightPayload {
  id: string;
  categoryLabel: string;
  tone: MicroInsightTone;
  title: string;
  subtitle: string;
  metrics: MicroInsightMetric[];
  nudgeTitle: string;
  nudgeBody: string;
  normativeTag?: string;
  whatsappText: string;
  offline?: boolean;
  habit?: DailyHabitProgress;
  nextAction?: MicroInsightNextAction;
}

const HABIT_STORAGE_KEY = "gallinero_daily_habit_v1";

const ESSENTIAL_DAILY_STEPS: {
  step: DailyHabitStep;
  mode: "huevos" | "alimentacion" | "mortalidad" | "venta";
  label: string;
}[] = [
  { step: "huevos", mode: "huevos", label: "Registrar recolección de huevos" },
  { step: "alimentacion", mode: "alimentacion", label: "Registrar ración de alimento" },
  { step: "mortalidad", mode: "mortalidad", label: "Registrar estado / bajas del día" },
  { step: "finanzas", mode: "venta", label: "Registrar ventas o gastos del día" },
];

interface StoredHabitState {
  byDate: Record<string, DailyHabitStep[]>;
}

function getTodayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const d = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateIso;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function readHabitState(): StoredHabitState {
  if (typeof window === "undefined") return { byDate: {} };
  try {
    const raw = window.localStorage.getItem(HABIT_STORAGE_KEY);
    if (!raw) return { byDate: {} };
    const parsed = JSON.parse(raw) as StoredHabitState;
    if (!parsed || typeof parsed.byDate !== "object") return { byDate: {} };
    return parsed;
  } catch {
    return { byDate: {} };
  }
}

function writeHabitState(state: StoredHabitState): void {
  if (typeof window === "undefined") return;
  try {
    // Keep only last 45 days to stay lightweight
    const dates = Object.keys(state.byDate).sort().slice(-45);
    const trimmed: Record<string, DailyHabitStep[]> = {};
    for (const dt of dates) {
      trimmed[dt] = state.byDate[dt];
    }
    window.localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify({ byDate: trimmed }));
  } catch {
    // Ignore storage quota errors
  }
}

export function recordDailyHabitStep(
  step: DailyHabitStep,
  dateIso?: string,
): DailyHabitProgress {
  const targetDate = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : getTodayIsoLocal();
  const state = readHabitState();
  const existing = state.byDate[targetDate] || [];
  const updated = existing.includes(step) ? existing : [...existing, step];
  state.byDate[targetDate] = updated;
  writeHabitState(state);
  return getDailyHabitProgress(targetDate, state);
}

export function getDailyHabitProgress(
  dateIso?: string,
  preloadedState?: StoredHabitState,
): DailyHabitProgress {
  const targetDate = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : getTodayIsoLocal();
  const state = preloadedState || readHabitState();
  const completedSteps = state.byDate[targetDate] || [];

  const essentialDone = ESSENTIAL_DAILY_STEPS.filter((item) =>
    completedSteps.includes(item.step),
  ).length;

  let streakDays = 0;
  let cursor = targetDate;
  for (let i = 0; i < 45; i++) {
    const stepsOnDay = state.byDate[cursor] || [];
    if (stepsOnDay.length > 0) {
      streakDays += 1;
      cursor = shiftIsoDate(cursor, -1);
    } else {
      break;
    }
  }
  if (streakDays === 0) streakDays = 1;

  const nextMissing = ESSENTIAL_DAILY_STEPS.find(
    (item) => !completedSteps.includes(item.step),
  );

  return {
    date: targetDate,
    completedSteps,
    completedEssentialCount: Math.max(1, essentialDone),
    essentialTotal: ESSENTIAL_DAILY_STEPS.length,
    streakDays,
    nextSuggestedMode: nextMissing?.mode,
    nextSuggestedLabel: nextMissing?.label,
  };
}

export interface HarvestWindowWarning {
  species: string;
  ageDays: number;
  severity: "warning" | "critical";
  title: string;
  message: string;
}

/**
 * Evalúa si un lote entró en ventana óptima de sacrificio o superó el límite de eficiencia FCR.
 * - Pato Pekín: aviso sem 7 (>= 49d), crítico sem 8 (>= 56d).
 * - Cuy engorde: aviso >= 75d, crítico >= 90d.
 * - Pollo engorde: aviso >= 35d, crítico >= 49d.
 */
export function evaluateHarvestWindowWarning(batch: {
  species: string;
  ageDays: number;
  code?: string | null;
}): HarvestWindowWarning | null {
  const sp = (batch.species || "").trim().toLowerCase();
  const ageDays = Math.max(0, Math.round(Number(batch.ageDays) || 0));
  const label = batch.code ? `Lote ${batch.code}` : `Lote ${sp}`;

  if (sp === "pato") {
    if (ageDays >= 56) {
      return {
        species: sp,
        ageDays,
        severity: "critical",
        title: `Límite FCR alcanzado en patos (${ageDays} días · sem ${Math.floor(ageDays / 7)})`,
        message: `${label} llegó o superó las 8 semanas (día 56). A partir de aquí el FCR sube aceleradamente; programa cosecha o venta inmediata.`,
      };
    }
    if (ageDays >= 49) {
      return {
        species: sp,
        ageDays,
        severity: "warning",
        title: `Ventana óptima de cosecha Pato Pekín (sem 7–8 · ${ageDays}d)`,
        message: `${label} entró en ventana comercial (49–56 días). Maximiza rendimiento antes de superar el día 56.`,
      };
    }
  } else if (sp === "cuy") {
    if (ageDays >= 90) {
      return {
        species: sp,
        ageDays,
        severity: "critical",
        title: `Inflexión FCR crítica en cuyes (${ageDays} días > 90d)`,
        message: `${label} superó los 90 días recomendados de engorde; mantenerlo reduce margen por exceso de consumo.`,
      };
    }
    if (ageDays >= 75) {
      return {
        species: sp,
        ageDays,
        severity: "warning",
        title: `Ventana óptima de sacrificio cuyes (días 75–90 · ${ageDays}d)`,
        message: `${label} está en ventana óptima de salida comercial (75–90 días).`,
      };
    }
  } else if (sp === "pollo") {
    if (ageDays >= 49) {
      return {
        species: sp,
        ageDays,
        severity: "critical",
        title: `Tope de ciclo pollo alcanzado (${ageDays} días >= 49d)`,
        message: `${label} alcanzó o superó el día 49; la conversión alimenticia cae rápidamente después de la semana 7.`,
      };
    }
    if (ageDays >= 35) {
      return {
        species: sp,
        ageDays,
        severity: "warning",
        title: `Ventana óptima de cosecha pollo (días 35–49 · ${ageDays}d)`,
        message: `${label} está listo para selección/faena entre días 35 y 49.`,
      };
    }
  } else if (sp === "codorniz") {
    if (ageDays >= 52) {
      return {
        species: sp,
        ageDays,
        severity: "critical",
        title: `Tope de ciclo codorniz alcanzado (${ageDays} días >= 52d)`,
        message: `${label} superó el día 52; programa venta o selección para evitar consumo improductivo.`,
      };
    }
    if (ageDays >= 42) {
      return {
        species: sp,
        ageDays,
        severity: "warning",
        title: `Ventana óptima de cosecha codorniz (días 42–52 · ${ageDays}d)`,
        message: `${label} entró en ventana comercial de codorniz de carne (42–52 días).`,
      };
    }
  } else if (sp === "conejo") {
    if (ageDays >= 90) {
      return {
        species: sp,
        ageDays,
        severity: "critical",
        title: `Tope de ciclo cunicola alcanzado (${ageDays} días >= 90d)`,
        message: `${label} superó los 90 días; el FCR aumenta rápidamente tras el destete tardío.`,
      };
    }
    if (ageDays >= 75) {
      return {
        species: sp,
        ageDays,
        severity: "warning",
        title: `Ventana óptima de beneficio conejos (días 75–90 · ${ageDays}d)`,
        message: `${label} está en peso/edad comercial óptima para beneficio (75–90 días).`,
      };
    }
  }

  return null;
}

export function buildEggMicroInsight(input: {
  date: string;
  species: string;
  locationName?: string | null;
  totalCollected: number;
  broken: number;
  discarded?: number;
  forIncubation?: number;
  unitPrice: number;
  activeLayingBirds?: number;
  previousDayCollected?: number | null;
  todayFeedKg?: number | null;
  todayFeedCostCOP?: number | null;
  offline?: boolean;
}): MicroInsightPayload {
  const habit = recordDailyHabitStep("huevos", input.date);
  const discarded = input.discarded || 0;
  const forIncubation = input.forIncubation || 0;
  const commercialEggs = Math.max(
    0,
    input.totalCollected - input.broken - discarded - forIncubation,
  );
  const trays = Math.floor(commercialEggs / 30);
  const loose = commercialEggs % 30;
  const brokenAndDiscarded = input.broken + discarded;
  const mermaPct =
    input.totalCollected > 0
      ? Math.round((brokenAndDiscarded / input.totalCollected) * 1000) / 10
      : 0;
  const estimatedValue = Math.round(commercialEggs * input.unitPrice);

  const hdPct =
    input.activeLayingBirds && input.activeLayingBirds > 0
      ? Math.min(
          100,
          Math.round((input.totalCollected / input.activeLayingBirds) * 1000) / 10,
        )
      : null;

  const deltaPrev =
    typeof input.previousDayCollected === "number" && input.previousDayCollected > 0
      ? input.totalCollected - input.previousDayCollected
      : null;

  const tone: MicroInsightTone =
    mermaPct > 5 ? "warning" : hdPct !== null && hdPct < 60 ? "warning" : "positive";

  const metrics: MicroInsightMetric[] = [
    {
      label: "Empaque NTC 1240",
      value: trays > 0 ? `${trays} cub. + ${loose} u.` : `${commercialEggs} huevos`,
      helper: `${commercialEggs} aptos para venta`,
      highlight: "good",
    },
    {
      label: "Valor comercial hoy",
      value: `$${estimatedValue.toLocaleString("es-CO")}`,
      helper: `~$${Math.round(input.unitPrice).toLocaleString("es-CO")}/unidad`,
      highlight: "good",
    },
    hdPct !== null
      ? {
          label: "Postura Ave-Día (HD%)",
          value: `${hdPct}%`,
          helper:
            deltaPrev !== null
              ? `${deltaPrev >= 0 ? `+${deltaPrev}` : deltaPrev} vs. ayer`
              : `${input.activeLayingBirds} aves activas`,
          highlight: hdPct >= 75 ? "good" : hdPct >= 60 ? "neutral" : "warn",
        }
      : {
          label: "Merma (Rotos/Desc.)",
          value: `${mermaPct}%`,
          helper:
            brokenAndDiscarded === 0
              ? "¡0 rotos hoy!"
              : `${brokenAndDiscarded} no comerciales`,
          highlight: mermaPct <= 2 ? "good" : "warn",
        },
  ];

  const feedCostToday =
    typeof input.todayFeedCostCOP === "number" && Number.isFinite(input.todayFeedCostCOP) && input.todayFeedCostCOP > 0
      ? Math.round(input.todayFeedCostCOP)
      : null;
  const netProfitToday = feedCostToday !== null ? estimatedValue - feedCostToday : null;

  if (netProfitToday !== null && feedCostToday !== null) {
    metrics.push({
      label: "Utilidad Neta Hoy",
      value: `${netProfitToday >= 0 ? "+" : ""}$${netProfitToday.toLocaleString("es-CO")}`,
      helper:
        input.todayFeedKg && input.todayFeedKg > 0
          ? `Ración: ${input.todayFeedKg.toFixed(1)} kg ($${feedCostToday.toLocaleString("es-CO")})`
          : `Descontando alimento: $${feedCostToday.toLocaleString("es-CO")}`,
      highlight: netProfitToday > 0 ? "good" : "bad",
    });
  }

  const monthlySavedIfLowBreakage = Math.max(
    15000,
    Math.round(input.totalCollected * 0.025 * input.unitPrice * 30),
  );

  const nudgeTitle =
    mermaPct <= 2
      ? "¡Excelente manejo de nido y recolección!"
      : "Oportunidad detectada en recolección y cáscara";

  const nudgeBody =
    mermaPct <= 2
      ? `Mantener la rotura en ${mermaPct}% (bajo el umbral del 2%) evita perder ~$${monthlySavedIfLowBreakage.toLocaleString("es-CO")}/mes en este lote y alimenta automáticamente tu inventario PEPS listo para despacho.`
      : `Hoy la merma fue de ${mermaPct}% (${brokenAndDiscarded} huevos). Recolectar 2 veces en la mañana y revisar calcio/cama en nidos puede recuperar hasta ~$${monthlySavedIfLowBreakage.toLocaleString("es-CO")}/mes.`;

  const locLabel = input.locationName || "la granja";
  const whatsappText =
    `🥚 *Parte de Postura (${input.date})*\n` +
    `📍 Ubicación: ${locLabel} (${input.species})\n` +
    `✅ Total recolectado: *${input.totalCollected} huevos* (${trays} cubetas + ${loose} sueltos útiles)\n` +
    (hdPct !== null ? `📈 Postura Ave-Día (HD%): *${hdPct}%*\n` : "") +
    `📉 Merma/Rotos: ${brokenAndDiscarded} (${mermaPct}%)\n` +
    `💰 Valor comercial: *$${estimatedValue.toLocaleString("es-CO")}*` +
    (netProfitToday !== null && feedCostToday !== null
      ? `\n📊 Utilidad Neta Hoy (Ingreso − Alimento): *${netProfitToday >= 0 ? "+" : ""}$${netProfitToday.toLocaleString("es-CO")}*`
      : "");

  return {
    id: `egg-${Date.now()}`,
    categoryLabel: "Micro-Reporte Zootécnico · Postura",
    tone,
    title: `${input.totalCollected} huevos registrados en ${locLabel}`,
    subtitle:
      deltaPrev !== null
        ? `Comparativo inmediato: ${deltaPrev >= 0 ? `+${deltaPrev}` : deltaPrev} huevos frente a la recolección previa.`
        : `Inventario PEPS actualizado con ${commercialEggs} huevos comerciales.`,
    metrics,
    nudgeTitle,
    nudgeBody,
    normativeTag: "Norma NTC 1240 · Inventario PEPS",
    whatsappText,
    offline: input.offline,
    habit,
    nextAction: habit.nextSuggestedMode
      ? {
          label: habit.nextSuggestedLabel || "Continuar rutina del día",
          mode: habit.nextSuggestedMode,
        }
      : undefined,
  };
}

export function buildFeedMicroInsight(input: {
  date: string;
  feedName: string;
  unit: string;
  quantity: number;
  isEntry: boolean;
  locationName?: string | null;
  remainingStockAfter?: number | null;
  unitCost?: number | null;
  activeAnimalsCount?: number | null;
  batch?: { species: string; ageDays: number; code?: string | null } | null;
  offline?: boolean;
}): MicroInsightPayload {
  const habit = recordDailyHabitStep("alimentacion", input.date);
  const unitNorm = (input.unit || "kg").toLowerCase();
  const isKg = unitNorm === "kg" || unitNorm === "kilogramos";
  const qtyKg = isKg ? input.quantity : unitNorm === "lb" ? input.quantity * 0.5 : input.quantity;
  const bultos40Eq = Math.round((qtyKg / 40) * 100) / 100;

  const remainingKg =
    typeof input.remainingStockAfter === "number"
      ? Math.max(0, input.remainingStockAfter)
      : null;

  const dailyConsumptionEstimate =
    !input.isEntry && qtyKg > 0
      ? qtyKg
      : input.activeAnimalsCount && input.activeAnimalsCount > 0
        ? input.activeAnimalsCount * 0.115
        : null;

  const coverageDays =
    remainingKg !== null && dailyConsumptionEstimate && dailyConsumptionEstimate > 0
      ? Math.round((remainingKg / dailyConsumptionEstimate) * 10) / 10
      : null;

  const gramsPerBird =
    !input.isEntry && input.activeAnimalsCount && input.activeAnimalsCount > 0 && qtyKg > 0
      ? Math.round((qtyKg * 1000) / input.activeAnimalsCount)
      : null;

  let tone: MicroInsightTone = "positive";
  if (coverageDays !== null) {
    if (coverageDays < 4) tone = "critical";
    else if (coverageDays < 8) tone = "warning";
  }

  const rationCost =
    input.unitCost && input.unitCost > 0 ? Math.round(input.quantity * input.unitCost) : null;

  const metrics: MicroInsightMetric[] = [
    {
      label: input.isEntry ? "Ingreso a Bodega" : "Ración Servida",
      value: `${input.quantity} ${input.unit}`,
      helper: isKg ? `Equivale a ${bultos40Eq} bultos (40 kg)` : input.feedName,
      highlight: "good",
    },
    coverageDays !== null
      ? {
          label: "Días de Cobertura",
          value: `${coverageDays} días`,
          helper:
            coverageDays < 4
              ? "🚨 Crítico (< 4 d): pedir hoy"
              : coverageDays < 8
                ? "⚠️ Programar pedido semanal"
                : `Saldo: ${remainingKg?.toFixed(1)} kg`,
          highlight: coverageDays < 4 ? "bad" : coverageDays < 8 ? "warn" : "good",
        }
      : {
          label: "Equivalencia Comercial",
          value: `${bultos40Eq} bultos`,
          helper: "Estándar 1 bulto = 40 kg",
          highlight: "neutral",
        },
    gramsPerBird !== null
      ? {
          label: "Dosis por Animal",
          value: `${gramsPerBird} g/día`,
          helper: `${input.activeAnimalsCount} animales en unidad`,
          highlight: gramsPerBird >= 85 && gramsPerBird <= 145 ? "good" : "warn",
        }
      : {
          label: "Costo de Ración",
          value: rationCost ? `$${rationCost.toLocaleString("es-CO")}` : "Control PEPS",
          helper: rationCost ? "Imputado al centro de costo" : "Inventario actualizado",
          highlight: "neutral",
        },
  ];

  const harvestAlert = input.batch ? evaluateHarvestWindowWarning(input.batch) : null;

  const nudgeTitle =
    harvestAlert && harvestAlert.severity === "critical"
      ? harvestAlert.title
      : coverageDays !== null && coverageDays < 4
        ? "Alerta temprana de abastecimiento activada (< 4 días)"
        : harvestAlert
          ? harvestAlert.title
          : coverageDays !== null && coverageDays < 8
            ? "Ventana ideal para programar reposición de concentrado"
            : "Controlaste el rubro que representa ~70% del costo de producción";

  const baseFeedNudge =
    coverageDays !== null && coverageDays < 4
      ? `Con el consumo actual te quedan ${coverageDays} días de ${input.feedName} en bodega. Pedir hoy evita cambios bruscos de dieta que pueden tumbar la postura un 15% en 48 horas.`
      : `Registrar cada entrega de alimento descuenta automáticamente tu bodega (bultos de 40 kg), recalcula la conversión alimenticia (FCR) y evita desperdicio invisible en comedero.`;

  const nudgeBody = harvestAlert ? `${harvestAlert.message} ${baseFeedNudge}` : baseFeedNudge;

  const locLabel = input.locationName || "Bodega General";
  const whatsappText =
    `🌾 *Reporte de Alimentación (${input.date})*\n` +
    `📍 Destino: ${locLabel}\n` +
    `📦 ${input.isEntry ? "Entrada" : "Consumo"}: *${input.quantity} ${input.unit}* de ${input.feedName} (${bultos40Eq} bultos de 40kg)\n` +
    (coverageDays !== null ? `⏳ Cobertura en bodega: *${coverageDays} días*\n` : "") +
    (gramsPerBird !== null ? `🐦 Ración promedio: *${gramsPerBird} g/animal*` : "");

  return {
    id: `feed-${Date.now()}`,
    categoryLabel: "Micro-Reporte Nutricional y Bodega",
    tone,
    title: `${input.quantity} ${input.unit} de ${input.feedName} registrados`,
    subtitle: input.isEntry
      ? `Stock de bodega incrementado y valorizado por PEPS.`
      : `Ración imputada a ${locLabel} · Descuento automático aplicado.`,
    metrics,
    nudgeTitle,
    nudgeBody,
    normativeTag: "Conversión FCR · Cobertura 40 kg",
    whatsappText,
    offline: input.offline,
    habit,
    nextAction: habit.nextSuggestedMode
      ? {
          label: habit.nextSuggestedLabel || "Continuar rutina del día",
          mode: habit.nextSuggestedMode,
        }
      : undefined,
  };
}

export function buildMortalityMicroInsight(input: {
  date: string;
  species: string;
  birdTypeLabel: string;
  quantity: number;
  causeLabel: string;
  locationName?: string | null;
  remainingPopulation?: number | null;
  batch?: { species: string; ageDays: number; code?: string | null } | null;
  notes?: string | null;
  offline?: boolean;
}): MicroInsightPayload {
  const habit = recordDailyHabitStep("mortalidad", input.date);
  const initialOrPrior =
    typeof input.remainingPopulation === "number" && input.remainingPopulation >= 0
      ? input.remainingPopulation + input.quantity
      : null;

  const viabilityPct =
    initialOrPrior && initialOrPrior > 0
      ? Math.round(((initialOrPrior - input.quantity) / initialOrPrior) * 1000) / 10
      : null;

  const dailyLossPct =
    initialOrPrior && initialOrPrior > 0
      ? Math.round((input.quantity / initialOrPrior) * 1000) / 10
      : null;

  const hasClinicalAlert =
    (dailyLossPct !== null && dailyLossPct >= 0.5) ||
    Boolean(input.notes && /signo|humedad|falta agua|respiratorio|diarrea/i.test(input.notes));

  const tone: MicroInsightTone =
    dailyLossPct !== null && dailyLossPct >= 1.0
      ? "critical"
      : hasClinicalAlert
        ? "warning"
        : "info";

  const metrics: MicroInsightMetric[] = [
    {
      label: "Baja Registrada",
      value: `${input.quantity} ${input.birdTypeLabel}`,
      helper: `Causa: ${input.causeLabel}`,
      highlight: input.quantity > 2 ? "warn" : "neutral",
    },
    viabilityPct !== null
      ? {
          label: "Viabilidad del Lote",
          value: `${viabilityPct}%`,
          helper: `${input.remainingPopulation} vivos actuales`,
          highlight: viabilityPct >= 96 ? "good" : viabilityPct >= 92 ? "warn" : "bad",
        }
      : {
          label: "Ajuste de Ración",
          value: "Automático",
          helper: "Recalcula consumo esperado",
          highlight: "good",
        },
    {
      label: "Protocolo Sanitario",
      value: hasClinicalAlert ? "Vigilancia 48h" : "Normal (<0.5%)",
      helper: "Compostaje Res. ICA 30292",
      highlight: hasClinicalAlert ? "warn" : "good",
    },
  ];

  const harvestAlert = input.batch ? evaluateHarvestWindowWarning(input.batch) : null;

  const nudgeTitle = hasClinicalAlert
    ? "Detección temprana activada: vigila este galpón las próximas 48 h"
    : harvestAlert
      ? harvestAlert.title
      : "Tu reporte mantiene exacta la población viva y la ración de mañana";

  const baseMortBody = hasClinicalAlert
    ? `Registrar la causa (${input.causeLabel}) y la observación de campo permite aislar a tiempo posibles brotes antes de que afecten al resto del lote. Recuerda disponer la mortalidad en pila de compostaje (Res. ICA 30292/2017).`
    : `Cada baja registrada descuenta de inmediato el inventario vivo para que mañana no sobre-alimentes el galpón ni distorsiones el porcentaje real de postura o conversión (FCR).`;
  const nudgeBody = harvestAlert ? `${baseMortBody} ${harvestAlert.message}` : baseMortBody;

  const locLabel = input.locationName || "la granja";
  const whatsappText =
    `🩺 *Reporte de Novedad Sanitaria / Baja (${input.date})*\n` +
    `📍 Unidad: ${locLabel} (${input.birdTypeLabel})\n` +
    `📉 Cantidad: *${input.quantity}* · Causa: *${input.causeLabel}*\n` +
    (viabilityPct !== null ? `🛡️ Viabilidad actual: *${viabilityPct}%*\n` : "") +
    (input.notes ? `📝 Observación: ${input.notes}` : "");

  return {
    id: `mort-${Date.now()}`,
    categoryLabel: "Micro-Reporte de Bioseguridad y Viabilidad",
    tone,
    title: `Baja actualizada (${input.quantity} ${input.birdTypeLabel}) en ${locLabel}`,
    subtitle: `Inventario vivo y requerimiento diario de alimento ajustados al instante.`,
    metrics,
    nudgeTitle,
    nudgeBody,
    normativeTag: "Bioseguridad ICA 3651 · Compostaje 30292",
    whatsappText,
    offline: input.offline,
    habit,
    nextAction: habit.nextSuggestedMode
      ? {
          label: habit.nextSuggestedLabel || "Continuar rutina del día",
          mode: habit.nextSuggestedMode,
        }
      : undefined,
  };
}

export function buildSaleMicroInsight(input: {
  date: string;
  itemSummary: string;
  totalUnits: number;
  unitPrice: number;
  totalAmount: number;
  referenceUnitCost?: number;
  buyer?: string | null;
  species?: string;
  isBirdSale?: boolean;
  saleKind?: "huevos" | "carne" | "animales" | "gallinaza" | "otros";
  unitLabel?: string;
  offline?: boolean;
}): MicroInsightPayload {
  const habit = recordDailyHabitStep("finanzas", input.date);
  const effectiveKind =
    input.saleKind ?? (input.isBirdSale ? "animales" : "huevos");
  const isEggSale = effectiveKind === "huevos";
  const defaultMarginRatio =
    effectiveKind === "gallinaza"
      ? 0.35
      : effectiveKind === "otros"
        ? 0.65
        : 0.72;
  const estUnitCost =
    input.referenceUnitCost && input.referenceUnitCost > 0
      ? input.referenceUnitCost
      : isEggSale
        ? 420 // Costo base referencia por huevo en COP
        : input.unitPrice * defaultMarginRatio;

  const unitMargin = Math.round(input.unitPrice - estUnitCost);
  const totalMargin = Math.round(unitMargin * input.totalUnits);
  const marginPct =
    input.unitPrice > 0 ? Math.round((unitMargin / input.unitPrice) * 100) : 0;

  const isBelowBreakEven = unitMargin < 0;
  const tone: MicroInsightTone = isBelowBreakEven
    ? "critical"
    : marginPct < 15
      ? "warning"
      : "positive";

  const traysEq = isEggSale ? Math.round((input.totalUnits / 30) * 10) / 10 : null;
  const unitSuffix =
    input.unitLabel ||
    (effectiveKind === "carne" || effectiveKind === "gallinaza" ? "kg" : "u.");

  const thirdMetric = (() => {
    switch (effectiveKind) {
      case "huevos":
        return {
          label: "Rotación PEPS",
          value:
            traysEq !== null && traysEq >= 1
              ? `${traysEq} cubetas`
              : `${input.totalUnits} unid.`,
          helper: "Descontado del lote más antiguo",
        };
      case "carne":
        return {
          label: "Volumen vendido",
          value: `${input.totalUnits} ${unitSuffix}`,
          helper: "Descontado de inventario de carne",
        };
      case "gallinaza":
        return {
          label: "Subproducto / Abono",
          value: `${input.totalUnits} ${unitSuffix}`,
          helper: "Descontado del stock de gallinaza",
        };
      case "otros":
        return {
          label: "Cantidad vendida",
          value: `${input.totalUnits} ${unitSuffix}`,
          helper: "Ingreso registrado sin descuento vivo",
        };
      case "animales":
      default:
        return {
          label: "Unidades Vendidas",
          value: `${input.totalUnits} ${input.unitLabel || "unid."}`,
          helper: "Actualiza existencias vivas en pie",
        };
    }
  })();

  const metrics: MicroInsightMetric[] = [
    {
      label: "Ingreso Bruto",
      value: `$${Math.round(input.totalAmount).toLocaleString("es-CO")}`,
      helper: input.buyer ? `Cliente: ${input.buyer}` : input.itemSummary,
      highlight: "good",
    },
    {
      label: isBelowBreakEven ? "Pérdida vs. Costo" : "Utilidad Estimada",
      value: `${totalMargin >= 0 ? "+" : ""}$${totalMargin.toLocaleString("es-CO")}`,
      helper: `Margen ~${marginPct}% ($${unitMargin.toLocaleString("es-CO")}/${unitSuffix})`,
      highlight: isBelowBreakEven ? "bad" : marginPct >= 15 ? "good" : "warn",
    },
    {
      label: thirdMetric.label,
      value: thirdMetric.value,
      helper: thirdMetric.helper,
      highlight: "neutral",
    },
  ];

  const nudgeTitle = isBelowBreakEven
    ? "⚠️ Alerta de Venta Bajo Punto de Equilibrio"
    : "¡Venta por encima del punto de equilibrio confirmada!";

  const nudgeBody = (() => {
    if (isBelowBreakEven) {
      if (isEggSale) {
        return `El precio unitario ($${Math.round(input.unitPrice).toLocaleString("es-CO")}) está por debajo del costo acumulado estimado ($${Math.round(estUnitCost).toLocaleString("es-CO")}). Revisa el precio por calibre NTC 1240 para no descapitalizar el lote.`;
      }
      return `El precio unitario ($${Math.round(input.unitPrice).toLocaleString("es-CO")}/${unitSuffix}) está por debajo del costo acumulado estimado ($${Math.round(estUnitCost).toLocaleString("es-CO")}). Ajusta tarifa o presentación para proteger el margen de la especie.`;
    }
    if (effectiveKind === "gallinaza") {
      return `Monetizar abono y subproductos suma ~$${totalMargin.toLocaleString("es-CO")} extra y mejora la rentabilidad global por lote sin subsidiar otras líneas.`;
    }
    if (effectiveKind === "otros") {
      return `Venta diversa contabilizada con trazabilidad financiera (~$${totalMargin.toLocaleString("es-CO")} de contribución neta estimada) en tu flujo de caja.`;
    }
    if (effectiveKind === "carne") {
      return `Venta de carne en canal/despiece registrada (~$${totalMargin.toLocaleString("es-CO")} libres estimados). El inventario de faena queda actualizado automáticamente.`;
    }
    if (effectiveKind === "animales") {
      return `Venta de animales en pie registrada (~$${totalMargin.toLocaleString("es-CO")} libres estimados) y reflejada en el inventario activo del plantel.`;
    }
    return `Gracias a que registras tus compras de alimento y recolección, sabes que esta venta deja ~$${totalMargin.toLocaleString("es-CO")} libres después de cubrir el costo productivo y descuenta primero el inventario más antiguo (PEPS).`;
  })();

  const normativeTag =
    effectiveKind === "huevos"
      ? "Contabilidad Anti-Subsidio · PEPS"
      : "Contabilidad Anti-Subsidio · Multilínea";

  const whatsappText =
    `💵 *Comprobante Rápido de Venta (${input.date})*\n` +
    `👤 Cliente: ${input.buyer || "Venta de contado"}\n` +
    `📦 Detalle: *${input.itemSummary}*\n` +
    `💰 Total venta: *$${Math.round(input.totalAmount).toLocaleString("es-CO")}*`;

  return {
    id: `sale-${Date.now()}`,
    categoryLabel: "Micro-Reporte Financiero · Punto de Equilibrio",
    tone,
    title: `Venta registrada: $${Math.round(input.totalAmount).toLocaleString("es-CO")}`,
    subtitle: `${input.itemSummary}${input.buyer ? ` · Cliente: ${input.buyer}` : ""}`,
    metrics,
    nudgeTitle,
    nudgeBody,
    normativeTag,
    whatsappText,
    offline: input.offline,
    habit,
  };
}

export function buildExpenseMicroInsight(input: {
  date: string;
  category: string;
  description: string;
  amount: number;
  counterparty?: string | null;
  species?: string | null;
  locationName?: string | null;
  presentations?: number | null;
  factor?: number | null;
  offline?: boolean;
}): MicroInsightPayload {
  const habit = recordDailyHabitStep("finanzas", input.date);
  const totalKg =
    input.presentations && input.factor && input.presentations > 0 && input.factor > 0
      ? input.presentations * input.factor
      : null;
  const costPerKg =
    totalKg && totalKg > 0 ? Math.round(input.amount / totalKg) : null;

  const hasCostCenter = Boolean(input.species || input.locationName);

  const metrics: MicroInsightMetric[] = [
    {
      label: "Egreso Registrado",
      value: `$${Math.round(input.amount).toLocaleString("es-CO")}`,
      helper: input.category,
      highlight: "neutral",
    },
    costPerKg !== null
      ? {
          label: "Costo por Kg",
          value: `$${costPerKg.toLocaleString("es-CO")}/kg`,
          helper: `${totalKg} kg ingresados a bodega`,
          highlight: "good",
        }
      : {
          label: "Centro de Costo",
          value: input.species
            ? input.species.toUpperCase()
            : input.locationName || "Prorrateo General",
          helper: hasCostCenter ? "Imputación directa" : "Costo indirecto compartido",
          highlight: hasCostCenter ? "good" : "neutral",
        },
    {
      label: "Soporte DIAN / Crédito",
      value: input.counterparty ? "Tercero vinculado" : "Registrado",
      helper: input.counterparty || "Listo para carpeta financiera",
      highlight: "good",
    },
  ];

  const nudgeTitle = hasCostCenter
    ? "Contabilidad anti-subsidio cruzado actualizada"
    : "Gasto registrado y listo para prorrateo analítico";

  const nudgeBody = hasCostCenter
    ? `Al asignar este gasto de $${Math.round(input.amount).toLocaleString("es-CO")} a su unidad/especie, actualizas el costo unitario real por huevo o kg de carne sin mezclar bolsillos entre lotes.`
    : `Registrar incluso los gastos menores mantiene exacto tu flujo de caja real y construye el historial contable que exigen FINAGRO y el banco agrario para líneas de crédito.`;

  const whatsappText =
    `🧾 *Registro de Egreso (${input.date})*\n` +
    `🏷️ Categoría: ${input.category}\n` +
    `📝 Concepto: ${input.description}\n` +
    (input.counterparty ? `🏢 Proveedor: ${input.counterparty}\n` : "") +
    `💸 Valor: *$${Math.round(input.amount).toLocaleString("es-CO")}*`;

  return {
    id: `exp-${Date.now()}`,
    categoryLabel: "Micro-Reporte de Costeo Analítico",
    tone: "info",
    title: `Egreso guardado: $${Math.round(input.amount).toLocaleString("es-CO")}`,
    subtitle: `${input.category} · ${input.description}`,
    metrics,
    nudgeTitle,
    nudgeBody,
    normativeTag: "Costeo por Lote · Carpeta DIAN/FINAGRO",
    whatsappText,
    offline: input.offline,
    habit,
  };
}

export function buildHealthMicroInsight(input: {
  date: string;
  eventTypeLabel: string;
  product?: string | null;
  withdrawalDays: number;
  withdrawalUntilDate?: string | null;
  coldChainTempC?: string | number | null;
  vaccineLot?: string | null;
  nextScheduled?: string | null;
  locationName?: string | null;
}): MicroInsightPayload {
  const habit = recordDailyHabitStep("sanidad", input.date);
  const tempNum =
    input.coldChainTempC !== undefined && input.coldChainTempC !== null && input.coldChainTempC !== ""
      ? Number(input.coldChainTempC)
      : null;
  const coldChainOk = tempNum === null || (tempNum >= 2 && tempNum <= 8);

  const hasWithdrawal = input.withdrawalDays > 0 && Boolean(input.withdrawalUntilDate);

  const tone: MicroInsightTone = !coldChainOk
    ? "warning"
    : hasWithdrawal
      ? "warning"
      : "positive";

  const metrics: MicroInsightMetric[] = [
    {
      label: "Retiro Farmacológico",
      value: hasWithdrawal ? `${input.withdrawalDays} días` : "0 días (Libre)",
      helper: hasWithdrawal
        ? `Bloqueo hasta ${input.withdrawalUntilDate}`
        : "Sin restricción de venta",
      highlight: hasWithdrawal ? "warn" : "good",
    },
    {
      label: "Cadena de Frío / POE",
      value:
        tempNum !== null
          ? `${tempNum} °C`
          : input.vaccineLot
            ? `Lote ${input.vaccineLot}`
            : "Registrado",
      helper:
        tempNum !== null
          ? coldChainOk
            ? "Óptima (2 °C – 8 °C)"
            : "⚠️ Fuera de rango (2–8 °C)"
          : "Bitácora ICA 3651 al día",
      highlight: coldChainOk ? "good" : "warn",
    },
    {
      label: "Próximo Refuerzo",
      value: input.nextScheduled || "Calendario al día",
      helper: input.locationName || "Toda la unidad",
      highlight: "neutral",
    },
  ];

  const nudgeTitle = hasWithdrawal
    ? `Protección sanitaria activada: bloqueo de venta hasta ${input.withdrawalUntilDate}`
    : "Bitácora POE sanitaria actualizada para auditoría ICA";

  const nudgeBody = hasWithdrawal
    ? `El sistema protegerá automáticamente tu granja bloqueando ventas o remisiones accidentales de este lote durante los ${input.withdrawalDays} días de retiro (Norma ICA / PRAMSAC / INVIMA).`
    : `Llevar al día el lote del biológico y la temperatura de aplicación (2–8 °C) garantiza que la vacuna sí genere inmunidad y cumple el requisito #1 de Granja Avícola Biosegura (GAB).`;

  const whatsappText =
    `💉 *Control Sanitario Registrado (${input.date})*\n` +
    `📍 Unidad: ${input.locationName || "General"}\n` +
    `🔬 Evento: *${input.eventTypeLabel}*${input.product ? ` · Producto: *${input.product}*` : ""}\n` +
    (hasWithdrawal
      ? `⛔ Tiempo de retiro: *${input.withdrawalDays} días* (Liberación: ${input.withdrawalUntilDate})\n`
      : `✅ Sin tiempo de retiro farmacológico\n`) +
    (input.nextScheduled ? `📅 Próximo refuerzo: ${input.nextScheduled}` : "");

  return {
    id: `health-${Date.now()}`,
    categoryLabel: "Micro-Reporte de Inocuidad y Bioseguridad ICA",
    tone,
    title: `${input.eventTypeLabel} registrado correctamente`,
    subtitle: input.product
      ? `Producto aplicado: ${input.product}${input.vaccineLot ? ` (Lote ${input.vaccineLot})` : ""}`
      : `Trazabilidad sanitaria guardada en el expediente de la unidad.`,
    metrics,
    nudgeTitle,
    nudgeBody,
    normativeTag: "Res. ICA 3651/2014 · Control de Retiro",
    whatsappText,
    habit,
  };
}

export function buildReproductionMicroInsight(input: {
  species: "conejo" | "cuy";
  eventType: string;
  eventDate: string;
  damCode: string;
  sireCode?: string | null;
  expectedPalpationDate?: string | null;
  expectedNestboxDate?: string | null;
  expectedBirthDate?: string | null;
  bornAlive?: number | null;
  bornDead?: number | null;
  weanedTotal?: number | null;
  litterDailyGainG?: string | number | null;
  weanedBatchCode?: string | null;
}): MicroInsightPayload {
  const habit = recordDailyHabitStep("reproduccion", input.eventDate);
  const dailyGain =
    input.litterDailyGainG !== undefined && input.litterDailyGainG !== null
      ? Number(input.litterDailyGainG)
      : null;
  const isElite = dailyGain !== null && dailyGain >= 32;

  const metrics: MicroInsightMetric[] = [];
  let nudgeTitle = "Sincronización reproductiva agendada";
  let nudgeBody = "";

  if (input.eventType === "empadre") {
    metrics.push(
      {
        label: "Consanguinidad (3 Gen.)",
        value: "Verificada OK",
        helper: `Cruce ${input.damCode} × ${input.sireCode || "Reproductor"}`,
        highlight: "good",
      },
      {
        label: input.species === "conejo" ? "Palpación (Día 18)" : "Control Gestación",
        value: input.expectedPalpationDate || "Agendado",
        helper: input.expectedNestboxDate ? `Nidal: ${input.expectedNestboxDate}` : "Alerta automática",
        highlight: "neutral",
      },
      {
        label: "Parto Esperado",
        value: input.expectedBirthDate || (input.species === "conejo" ? "+31 días" : "+66 días"),
        helper: input.species === "conejo" ? "Ciclo 31–32 días" : "Ciclo 64–68 días",
        highlight: "good",
      },
    );
    nudgeBody =
      input.species === "conejo"
        ? `No necesitas memorizar fechas: el sistema te avisará el día exacto para palpar (día 18) y poner el nidal desinfectado (día 26), reduciendo hasta en 50% la mortalidad al parto.`
        : `El empadre controlado en cuyes reduce la mortalidad en lactancia del ~40% a menos del 20% y programa automáticamente la fecha esperada de parto y destete.`;
  } else if (input.eventType === "parto") {
    const alive = Number(input.bornAlive || 0);
    const dead = Number(input.bornDead || 0);
    const total = alive + dead;
    const survPct = total > 0 ? Math.round((alive / total) * 100) : 100;
    metrics.push(
      {
        label: "Nacidos Vivos",
        value: `${alive} crías`,
        helper: `${survPct}% supervivencia natal`,
        highlight: survPct >= 85 ? "good" : "warn",
      },
      {
        label: "Próximo Hito",
        value: input.species === "conejo" ? "Destete 28–35 d" : "Destete + Sexado 15–18 d",
        helper: "Transición a poza/jaula",
        highlight: "neutral",
      },
      {
        label: "Madre Reproductora",
        value: input.damCode,
        helper: "Ficha individual actualizada",
        highlight: "good",
      },
    );
    nudgeTitle = "Camada registrada y agenda de destete activada";
    nudgeBody = `Registrar los nacidos vivos de ${input.damCode} permite evaluar su habilidad materna y te recordará el día exacto de destete y sexado obligatorio para evitar preñeces prematuras.`;
  } else {
    metrics.push(
      {
        label: "Crías Destetadas",
        value: `${input.weanedTotal || 0} crías`,
        helper: input.weanedBatchCode ? `Nuevo lote: ${input.weanedBatchCode}` : "Pasan a engorde grupal",
        highlight: "good",
      },
      {
        label: "Ganancia Camada",
        value: dailyGain !== null ? `${dailyGain.toFixed(1)} g/día` : "Registrada",
        helper: isElite ? "🏆 Madre Élite (>=32 g/d)" : "Curva de lactancia",
        highlight: isElite ? "good" : "neutral",
      },
      {
        label: "Modo Híbrido",
        value: "Individual → Lote",
        helper: "Cosecha óptima: 75–90 d (cuy)",
        highlight: "good",
      },
    );
    nudgeTitle = isElite
      ? `¡Madre Élite detectada (${input.damCode})! Selecciónala para pie de cría`
      : "Transición automática de camada a lote de engorde completada";
    nudgeBody = `Tus crías ahora están en un lote grupal para controlar su conversión (FCR) y avisarte la ventana exacta de cosecha antes de que se dispare el consumo de alimento.`;
  }

  const whatsappText =
    `🐇 *Evento Reproductivo (${input.eventDate})*\n` +
    `🧬 Especie: ${input.species.toUpperCase()} · Hembra: *${input.damCode}*\n` +
    `📌 Evento: *${input.eventType.toUpperCase()}*\n` +
    (input.expectedBirthDate ? `📅 Parto esperado: *${input.expectedBirthDate}*\n` : "") +
    (input.weanedBatchCode ? `📦 Lote de engorde creado: *${input.weanedBatchCode}*` : "");

  return {
    id: `repro-${Date.now()}`,
    categoryLabel: "Micro-Reporte Zootécnico Híbrido",
    tone: "positive",
    title: `Evento de ${input.eventType} registrado para ${input.damCode}`,
    subtitle: `Trazabilidad individual de reproductora y calendario biológico actualizados.`,
    metrics,
    nudgeTitle,
    nudgeBody,
    normativeTag: "Genética 3 Generaciones · Bienestar ICA",
    whatsappText,
    habit,
  };
}

export function buildIncubationMicroInsight(input: {
  species: string;
  startDate: string;
  eggsSet: number;
  expectedHatchDate?: string;
  turnStopDate?: string;
  eggsHatched?: number;
  fertileEggs?: number;
  batchCode?: string;
  isCompletion?: boolean;
}): MicroInsightPayload {
  const habit = recordDailyHabitStep("reproduccion", input.startDate);
  const sp = (input.species || "gallina").toLowerCase();
  const cycleDays = sp === "codorniz" ? 17 : sp === "pato" ? 28 : 21;
  const turnStopDay = sp === "codorniz" ? 14 : sp === "pato" ? 25 : 18;

  if (input.isCompletion) {
    const hatched = Number(input.eggsHatched || 0);
    const fertile = Number(input.fertileEggs || input.eggsSet || 1);
    const hatchPct = fertile > 0 ? Math.round((hatched / fertile) * 100) : 0;
    return {
      id: `inc-done-${Date.now()}`,
      categoryLabel: "Micro-Reporte de Incubación y Eclosión",
      tone: hatchPct >= 75 ? "positive" : "warning",
      title: `¡Eclosión completada! ${hatched} crías nacidas`,
      subtitle: input.batchCode
        ? `Asignadas automáticamente al lote ${input.batchCode}.`
        : `Inventario de aves actualizado automáticamente.`,
      metrics: [
        {
          label: "Nacidos Vivos",
          value: `${hatched} crías`,
          helper: `De ${input.eggsSet} huevos cargados`,
          highlight: "good",
        },
        {
          label: "Eclosión / Fértiles",
          value: `${hatchPct}%`,
          helper: hatchPct >= 80 ? "Excelente incubación" : "Revisar humedad final",
          highlight: hatchPct >= 75 ? "good" : "warn",
        },
        {
          label: "Destino Automático",
          value: input.batchCode || "Inventario Activo",
          helper: "Sin doble digitación",
          highlight: "good",
        },
      ],
      nudgeTitle: "Tus crías ya hacen parte del inventario productivo",
      nudgeBody: `Al cerrar la incubación, el sistema creó automáticamente las altas en tu inventario para que empieces a controlar su alimento de iniciación y vacunas desde el Día 1.`,
      normativeTag: `Ciclo ${sp.toUpperCase()} (${cycleDays} días)`,
      whatsappText:
        `🐣 *Eclosión Completada (${input.startDate})*\n` +
        `🐦 Especie: ${sp.toUpperCase()}\n` +
        `✅ Nacidos: *${hatched} crías* (${hatchPct}% sobre fértiles)` +
        (input.batchCode ? `\n📦 Nuevo lote: *${input.batchCode}*` : ""),
      habit,
    };
  }

  return {
    id: `inc-start-${Date.now()}`,
    categoryLabel: "Micro-Reporte de Incubadora Multi-Especie",
    tone: "positive",
    title: `Tanda de ${input.eggsSet} huevos de ${sp} iniciada`,
    subtitle: `Calendario de ovoscopía, freno de volteo y eclosión programado.`,
    metrics: [
      {
        label: "Ciclo Biológico",
        value: `${cycleDays} días`,
        helper: `${input.eggsSet} huevos en bandeja`,
        highlight: "good",
      },
      {
        label: "Freno de Volteo",
        value: input.turnStopDate || `Día ${turnStopDay}`,
        helper: `Subir humedad los últimos 3 días`,
        highlight: "warn",
      },
      {
        label: "Eclosión Esperada",
        value: input.expectedHatchDate || `+${cycleDays} días`,
        helper: sp === "gallina" ? "Ovoscopía día 7 y 14" : "Alerta en calendario",
        highlight: "good",
      },
    ],
    nudgeTitle: `Alerta de bloqueo de volteo agendada para el día ${turnStopDay}`,
    nudgeBody: `Detener el volteo exactamente en el día ${turnStopDay} (${sp}) y subir la humedad relativa permite que el embrión se posicione en la cámara de aire y aumenta hasta un 20% la tasa de nacimientos.`,
    normativeTag: `Incubación Simultánea · Día ${turnStopDay} Sin Volteo`,
    whatsappText:
      `🥚 *Nueva Tanda de Incubación (${input.startDate})*\n` +
      `🐦 Especie: ${sp.toUpperCase()} (${input.eggsSet} huevos)\n` +
      `🛑 Detener volteo: ${input.turnStopDate || `Día ${turnStopDay}`}\n` +
      `🐣 Eclosión esperada: ${input.expectedHatchDate || `+${cycleDays} días`}`,
    habit,
  };
}

