export type RoutineFrequency =
  | "diaria"
  | "lunes_a_viernes"
  | "dias_semana"
  | "quincenal"
  | "mensual";

export type RoutineShift = "manana" | "tarde" | "cierre" | "todo_el_dia";

export type CalendarModuleType =
  | "rutina"
  | "huevos"
  | "alimentacion"
  | "mortalidad"
  | "sanidad"
  | "incubacion"
  | "reproduccion"
  | "lotes"
  | "mantenimiento"
  | "compostaje"
  | "finanzas"
  | "cierre";

export type CalendarItemStatus =
  | "completed"
  | "pending_today"
  | "overdue"
  | "upcoming";

export type AutoDetectSource =
  | "egg_production"
  | "feed_consumption"
  | "mortality_or_check"
  | "sales_or_expenses"
  | "sanitary_control"
  | "daily_closure"
  | "biosecurity_log"
  | "weight_records"
  | "manual";

export type TaskVerificationMode =
  | "record_required"
  | "declaration_or_record"
  | "evidence_required";

export interface RoutineTaskConfig {
  id: string;
  title: string;
  description: string;
  module: CalendarModuleType;
  shift: RoutineShift;
  frequency: RoutineFrequency;
  /** 0 = Domingo, 1 = Lunes, ..., 6 = Sábado (cuando frequency === "dias_semana") */
  daysOfWeek?: number[];
  /** Día del mes 1..28 (cuando frequency === "mensual") */
  dayOfMonth?: number;
  enabled: boolean;
  /** Fuente de verificación en BD o evidencia manual */
  autoDetectSource?: AutoDetectSource;
  quickCaptureMode?: "huevos" | "alimentacion" | "mortalidad" | "gasto" | "venta";
  actionHref: string;
  actionLabel: string;
  icon: string;
}

export interface UnifiedCalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  subtitle: string;
  module: CalendarModuleType;
  shift?: RoutineShift;
  status: CalendarItemStatus;
  isRoutine: boolean;
  routineTaskId?: string;
  autoCompleted?: boolean;
  verificationMode?: TaskVerificationMode;
  evidenceNote?: string;
  completionDetail?: string;
  quickCaptureMode?: "huevos" | "alimentacion" | "mortalidad" | "gasto" | "venta";
  actionHref: string;
  actionLabel: string;
  icon: string;
  priority: "alta" | "media" | "normal";
}

export interface DailyComplianceSummary {
  date: string;
  totalScheduled: number;
  completedCount: number;
  overdueCount: number;
  pendingTodayCount: number;
  compliancePct: number;
}

export interface UnifiedCalendarResponse {
  today: string;
  routineConfig: RoutineTaskConfig[];
  todayRoutineTasks: UnifiedCalendarEvent[];
  overdueItems: UnifiedCalendarEvent[];
  upcomingMediumLongTerm: {
    next7Days: UnifiedCalendarEvent[];
    next30Days: UnifiedCalendarEvent[];
    next90Days: UnifiedCalendarEvent[];
  };
  allEvents: UnifiedCalendarEvent[];
  dailyHistory: DailyComplianceSummary[];
  metrics: {
    todayTotal: number;
    todayCompleted: number;
    todayPending: number;
    todayPct: number;
    overdueTotal: number;
    compliance7dPct: number;
    compliance30dPct: number;
    upcoming7dCount: number;
    upcoming30dCount: number;
    upcoming90dCount: number;
  };
}

export const ROUTINE_SETTINGS_KEY = "farm.routine.v1";
export const ROUTINE_COMPLETIONS_KEY = "farm.routine.completions.v1";

export const MODULE_META: Record<
  CalendarModuleType,
  { label: string; colorClass: string; badgeClass: string; dotClass: string }
> = {
  rutina: {
    label: "Rutina Operativa",
    colorClass: "border-emerald-200 bg-emerald-50 text-emerald-900",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    dotClass: "bg-emerald-600",
  },
  huevos: {
    label: "Postura / Huevos",
    colorClass: "border-yellow-300 bg-yellow-50 text-yellow-900",
    badgeClass: "bg-yellow-100 text-yellow-900 border-yellow-300",
    dotClass: "bg-yellow-500",
  },
  alimentacion: {
    label: "Alimentación",
    colorClass: "border-amber-300 bg-amber-50 text-amber-900",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    dotClass: "bg-amber-600",
  },
  mortalidad: {
    label: "Vigilancia / Bajas",
    colorClass: "border-rose-200 bg-rose-50 text-rose-900",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
    dotClass: "bg-rose-600",
  },
  sanidad: {
    label: "Sanidad e ICA",
    colorClass: "border-blue-200 bg-blue-50 text-blue-900",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300",
    dotClass: "bg-blue-600",
  },
  incubacion: {
    label: "Incubación",
    colorClass: "border-purple-200 bg-purple-50 text-purple-900",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-300",
    dotClass: "bg-purple-600",
  },
  reproduccion: {
    label: "Reproducción",
    colorClass: "border-pink-200 bg-pink-50 text-pink-900",
    badgeClass: "bg-pink-100 text-pink-900 border-pink-300",
    dotClass: "bg-pink-600",
  },
  lotes: {
    label: "Lotes y Cosecha",
    colorClass: "border-teal-200 bg-teal-50 text-teal-900",
    badgeClass: "bg-teal-100 text-teal-900 border-teal-300",
    dotClass: "bg-teal-600",
  },
  mantenimiento: {
    label: "Mantenimiento",
    colorClass: "border-orange-200 bg-orange-50 text-orange-900",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-300",
    dotClass: "bg-orange-500",
  },
  compostaje: {
    label: "Compostaje ICA",
    colorClass: "border-lime-300 bg-lime-50 text-lime-900",
    badgeClass: "bg-lime-100 text-lime-900 border-lime-300",
    dotClass: "bg-lime-600",
  },
  finanzas: {
    label: "Finanzas y Cartera",
    colorClass: "border-cyan-200 bg-cyan-50 text-cyan-900",
    badgeClass: "bg-cyan-100 text-cyan-900 border-cyan-300",
    dotClass: "bg-cyan-600",
  },
  cierre: {
    label: "Cierre Diario",
    colorClass: "border-slate-300 bg-slate-100 text-slate-900",
    badgeClass: "bg-slate-200 text-slate-800 border-slate-300",
    dotClass: "bg-slate-700",
  },
};

export const SHIFT_LABELS: Record<RoutineShift, string> = {
  manana: "🌅 Mañana (6:00 – 11:00)",
  tarde: "☀️ Tarde (12:00 – 17:00)",
  cierre: "🌙 Cierre (17:00+)",
  todo_el_dia: "📅 Todo el día",
};

export const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export const DEFAULT_ROUTINE_TASKS: RoutineTaskConfig[] = [
  {
    id: "routine-feed-am",
    title: "Servir ración de alimento y revisar agua",
    description: "Entrega de concentrado/forraje (bultos 40 kg o kg) y verificación de bebederos limpios.",
    module: "alimentacion",
    shift: "manana",
    frequency: "diaria",
    enabled: true,
    autoDetectSource: "feed_consumption",
    quickCaptureMode: "alimentacion",
    actionHref: "/dashboard/produccion?tab=alimentacion&subtab=movimientos&nuevo=movimiento",
    actionLabel: "Registrar alimento",
    icon: "wheat",
  },
  {
    id: "routine-eggs",
    title: "Recolección y clasificación de huevos",
    description: "Recolección de postura del día, separación de rotos/incubables y entrada PEPS.",
    module: "huevos",
    shift: "manana",
    frequency: "diaria",
    enabled: true,
    autoDetectSource: "egg_production",
    quickCaptureMode: "huevos",
    actionHref: "/dashboard/produccion?tab=huevos&nuevo=1",
    actionLabel: "Recoger huevos",
    icon: "egg",
  },
  {
    id: "routine-health-walk",
    title: "Ronda sanitaria, cama y bajas del día",
    description: "Inspección visual de aves/mamíferos, estado de cama y reporte de bajas (o confirmar 0 bajas).",
    module: "mortalidad",
    shift: "manana",
    frequency: "diaria",
    enabled: true,
    autoDetectSource: "mortality_or_check",
    quickCaptureMode: "mortalidad",
    actionHref: "/dashboard/produccion/mortalidad",
    actionLabel: "Reportar o confirmar OK",
    icon: "health",
  },
  {
    id: "routine-sales-cash",
    title: "Registro de ventas y gastos del día",
    description: "Anota despachos (huevos, carne, animales, abono o productos) o compras de insumos para mantener la caja al día.",
    module: "finanzas",
    shift: "tarde",
    frequency: "diaria",
    enabled: true,
    autoDetectSource: "sales_or_expenses",
    quickCaptureMode: "venta",
    actionHref: "/dashboard/finanzas/ventas",
    actionLabel: "Registrar venta",
    icon: "money",
  },
  {
    id: "routine-daily-closure",
    title: "Cierre diario auditable de bitácora",
    description: "Consolidación e inmutabilidad del parte diario de la granja.",
    module: "cierre",
    shift: "cierre",
    frequency: "diaria",
    enabled: false,
    autoDetectSource: "daily_closure",
    actionHref: "/dashboard/operaciones/cierre",
    actionLabel: "Cerrar jornada",
    icon: "clipboard",
  },
  {
    id: "routine-weekly-biosecurity",
    title: "Recarga de pediluvios y aseo de instalaciones",
    description: "Desinfección semanal de entradas, arcos y revisión de mallas antipájaros (Res. ICA 3651).",
    module: "sanidad",
    shift: "manana",
    frequency: "dias_semana",
    daysOfWeek: [1], // Lunes
    enabled: true,
    autoDetectSource: "biosecurity_log",
    actionHref: "/dashboard/sanidad/bioseguridad",
    actionLabel: "Registrar bioseguridad",
    icon: "shield",
  },
  {
    id: "routine-weekly-weighing",
    title: "Pesaje muestral semanal de lotes (FCR)",
    description: "Pesar muestra del 2% del lote para calibrar curva de crecimiento y conversión.",
    module: "lotes",
    shift: "manana",
    frequency: "dias_semana",
    daysOfWeek: [6], // Sábado
    enabled: true,
    autoDetectSource: "weight_records",
    actionHref: "/dashboard/produccion/peso?nuevo=1",
    actionLabel: "Registrar pesaje",
    icon: "scale",
  },
];

const RECORD_REQUIRED_SOURCES = new Set<AutoDetectSource>([
  "egg_production",
  "feed_consumption",
  "daily_closure",
  "biosecurity_log",
  "weight_records",
  "sanitary_control",
]);

const DECLARATION_OR_RECORD_SOURCES = new Set<AutoDetectSource>([
  "mortality_or_check",
  "sales_or_expenses",
]);

export function getEffectiveAutoDetectSource(
  task: Pick<RoutineTaskConfig, "id" | "autoDetectSource">,
): AutoDetectSource {
  const source = task.autoDetectSource;
  if (source && source !== "manual") return source;
  if (task.id === "routine-weekly-biosecurity" || task.id.includes("biosecurity")) {
    return "biosecurity_log";
  }
  if (task.id === "routine-weekly-weighing" || task.id.includes("weigh")) {
    return "weight_records";
  }
  return source || "manual";
}

export function getTaskVerificationMode(
  taskOrSource?: Pick<RoutineTaskConfig, "id" | "autoDetectSource"> | AutoDetectSource | null,
): TaskVerificationMode {
  if (!taskOrSource) return "record_required";
  const source: AutoDetectSource =
    typeof taskOrSource === "string"
      ? taskOrSource
      : getEffectiveAutoDetectSource(taskOrSource);

  if (RECORD_REQUIRED_SOURCES.has(source)) return "record_required";
  if (DECLARATION_OR_RECORD_SOURCES.has(source)) return "declaration_or_record";
  return "evidence_required";
}

export function normalizeRoutineTaskConfig(task: RoutineTaskConfig): RoutineTaskConfig {
  const effectiveSource = getEffectiveAutoDetectSource(task);
  if (task.id === "routine-weekly-weighing") {
    return {
      ...task,
      autoDetectSource: effectiveSource,
      actionHref:
        !task.actionHref || task.actionHref === "/dashboard/produccion?tab=animales"
          ? "/dashboard/produccion/peso?nuevo=1"
          : task.actionHref,
      actionLabel:
        !task.actionLabel || task.actionLabel === "Ver lotes"
          ? "Registrar pesaje"
          : task.actionLabel,
    };
  }
  if (task.id === "routine-weekly-biosecurity") {
    return {
      ...task,
      autoDetectSource: effectiveSource,
      actionLabel:
        !task.actionLabel || task.actionLabel === "Abrir bioseguridad"
          ? "Registrar bioseguridad"
          : task.actionLabel,
    };
  }
  return {
    ...task,
    autoDetectSource: effectiveSource,
  };
}

export function doesRoutineApplyOnDate(
  task: RoutineTaskConfig,
  dateIso: string,
): boolean {
  if (!task.enabled) return false;
  const d = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const dayOfWeek = d.getUTCDay(); // 0..6
  const dayOfMonth = d.getUTCDate(); // 1..31

  switch (task.frequency) {
    case "diaria":
      return true;
    case "lunes_a_viernes":
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case "dias_semana":
      return Array.isArray(task.daysOfWeek) && task.daysOfWeek.length > 0
        ? task.daysOfWeek.includes(dayOfWeek)
        : dayOfWeek === 1;
    case "quincenal":
      return dayOfMonth === 1 || dayOfMonth === 15;
    case "mensual":
      return dayOfMonth === (task.dayOfMonth || 1);
    default:
      return true;
  }
}

export function addDaysIso(dateIso: string, deltaDays: number): string {
  const d = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateIso;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

