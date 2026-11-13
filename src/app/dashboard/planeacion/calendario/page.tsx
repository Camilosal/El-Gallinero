"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileCheck2,
  Filter,
  Flame,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { TaskVerificationModal } from "@/components/TaskVerificationModal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useActionQuery } from "@/lib/useActionQuery";
import {
  OPEN_QUICK_CAPTURE_EVENT,
  QUICK_CAPTURE_SAVED_EVENT,
  type QuickCaptureDetail,
} from "@/lib/quick-capture-events";
import {
  DAY_NAMES_SHORT,
  MODULE_META,
  SHIFT_LABELS,
  getTaskVerificationMode,
  type CalendarModuleType,
  type RoutineFrequency,
  type RoutineShift,
  type RoutineTaskConfig,
  type UnifiedCalendarEvent,
  type UnifiedCalendarResponse,
} from "@/lib/unified-calendar";

type ActiveTab = "hoy" | "calendario" | "horizonte" | "cumplimiento" | "rutina";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function buildMonthGrid(year: number, monthZeroBased: number): string[] {
  const firstDay = new Date(Date.UTC(year, monthZeroBased, 1, 12, 0, 0));
  const startDow = firstDay.getUTCDay(); // 0=Sun..6=Sat
  const daysInMonth = new Date(Date.UTC(year, monthZeroBased + 1, 0, 12, 0, 0)).getUTCDate();

  const cells: string[] = [];
  for (let i = 0; i < startDow; i++) {
    cells.push("");
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(monthZeroBased + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    cells.push(`${year}-${mStr}-${dStr}`);
  }
  return cells;
}

export default function UnifiedCalendarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <UnifiedCalendarInner />
    </Suspense>
  );
}

function UnifiedCalendarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const validRequestedTab: ActiveTab | null =
    requestedTab === "hoy" || requestedTab === "calendario" || requestedTab === "horizonte" || requestedTab === "cumplimiento" || requestedTab === "rutina"
      ? requestedTab
      : null;
  const [data, setData] = useState<UnifiedCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>(validRequestedTab ?? "hoy");
  const [lastSyncedTab, setLastSyncedTab] = useState<string | null>(validRequestedTab);
  if (validRequestedTab && validRequestedTab !== lastSyncedTab) {
    setLastSyncedTab(validRequestedTab);
    setActiveTab(validRequestedTab);
  }
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [verifyingEvent, setVerifyingEvent] = useState<UnifiedCalendarEvent | null>(null);
  const [monthCursor, setMonthCursor] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Routine editor state
  const [draftRoutine, setDraftRoutine] = useState<RoutineTaskConfig[]>([]);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [routineSavedMsg, setRoutineSavedMsg] = useState("");
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState<{
    title: string;
    description: string;
    module: CalendarModuleType;
    shift: RoutineShift;
    frequency: RoutineFrequency;
    daysOfWeek: number[];
    dayOfMonth: string;
    actionHref: string;
    actionLabel: string;
  }>({
    title: "",
    description: "",
    module: "rutina",
    shift: "manana",
    frequency: "diaria",
    daysOfWeek: [1],
    dayOfMonth: "1",
    actionHref: "/dashboard",
    actionLabel: "Realizar tarea",
  });

  const loadCalendar = useCallback(async () => {
    try {
      const res = await apiFetch("/api/planeacion/calendario");
      if (!res.ok) return;
      const payload = (await res.json()) as UnifiedCalendarResponse;
      setData(payload);
      setDraftRoutine(payload.routineConfig);
      setSelectedDate((prev) => prev || payload.today);
    } finally {
      setLoading(false);
    }
  }, []);

  const openNewRoutineModal = useCallback(() => {
    setActiveTab("rutina");
    setNewTaskModalOpen(true);
  }, []);

  useActionQuery(searchParams.get("nuevo"), {
    "1": openNewRoutineModal,
    rutina: openNewRoutineModal,
  });

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    const onQuickSaved = () => {
      void loadCalendar();
    };
    window.addEventListener(QUICK_CAPTURE_SAVED_EVENT, onQuickSaved);
    return () => window.removeEventListener(QUICK_CAPTURE_SAVED_EVENT, onQuickSaved);
  }, [loadCalendar]);

  const handleVerificationAction = async (ev: UnifiedCalendarEvent) => {
    const mode = ev.verificationMode || "record_required";
    const isDone = ev.status === "completed";

    if (!isDone) {
      if (mode === "record_required") {
        triggerEventAction(ev);
        return;
      }
      setVerifyingEvent(ev);
      return;
    }

    if (ev.autoCompleted || mode === "record_required") return;

    const taskId = ev.routineTaskId || ev.id;
    const res = await apiFetch("/api/planeacion/calendario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: ev.date,
        taskId,
        completed: false,
      }),
    });
    if (res.ok) {
      await loadCalendar();
    }
  };

  const triggerEventAction = (ev: UnifiedCalendarEvent) => {
    if (ev.quickCaptureMode) {
      const detail: QuickCaptureDetail = { mode: ev.quickCaptureMode };
      window.dispatchEvent(new CustomEvent(OPEN_QUICK_CAPTURE_EVENT, { detail }));
      return;
    }
    router.push(ev.actionHref);
  };

  const saveRoutineChanges = async (customRoutine?: RoutineTaskConfig[]) => {
    const toSave = customRoutine || draftRoutine;
    setSavingRoutine(true);
    setRoutineSavedMsg("");
    try {
      const res = await apiFetch("/api/planeacion/calendario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routineConfig: toSave }),
      });
      if (res.ok) {
        setRoutineSavedMsg("Rutina guardada. Los botones de tareas del día ya se auto-ajustaron.");
        await loadCalendar();
      }
    } finally {
      setSavingRoutine(false);
    }
  };

  const handleAddRoutineTask = async () => {
    if (!newTaskForm.title.trim()) return;
    const created: RoutineTaskConfig = {
      id: `routine-custom-${Date.now()}`,
      title: newTaskForm.title.trim(),
      description: newTaskForm.description.trim() || "Tarea operativa personalizada de la granja",
      module: newTaskForm.module,
      shift: newTaskForm.shift,
      frequency: newTaskForm.frequency,
      daysOfWeek: newTaskForm.frequency === "dias_semana" ? newTaskForm.daysOfWeek : undefined,
      dayOfMonth: newTaskForm.frequency === "mensual" ? Number(newTaskForm.dayOfMonth || 1) : undefined,
      enabled: true,
      autoDetectSource: "manual",
      actionHref: newTaskForm.actionHref || "/dashboard",
      actionLabel: newTaskForm.actionLabel || "Realizar tarea",
      icon: "clipboard",
    };
    const updated = [...draftRoutine, created];
    setDraftRoutine(updated);
    setNewTaskModalOpen(false);
    setNewTaskForm({
      title: "",
      description: "",
      module: "rutina",
      shift: "manana",
      frequency: "diaria",
      daysOfWeek: [1],
      dayOfMonth: "1",
      actionHref: "/dashboard",
      actionLabel: "Realizar tarea",
    });
    await saveRoutineChanges(updated);
  };

  const filteredEvents = useMemo(() => {
    if (!data) return [];
    if (moduleFilter === "all") return data.allEvents;
    return data.allEvents.filter((e) => e.module === moduleFilter);
  }, [data, moduleFilter]);

  const eventsByDateMap = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>();
    for (const ev of filteredEvents) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [filteredEvents]);

  const monthCells = useMemo(
    () => buildMonthGrid(monthCursor.year, monthCursor.month),
    [monthCursor.year, monthCursor.month],
  );

  const selectedDateEvents = useMemo(
    () => (selectedDate ? eventsByDateMap.get(selectedDate) || [] : []),
    [eventsByDateMap, selectedDate],
  );

  if (loading || !data) {
    return (
      <div className="p-8 text-center text-slate-500">
        Cargando calendario unificado y rutinas operativas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario Maestro, Rutinas y Cumplimiento"
        description="Unifica todas las fechas de producción, sanidad ICA, incubación, reproducción, cosecha de lotes, compostaje y finanzas con tu rutina diaria auto-ajustable."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setActiveTab("rutina")}>
              <Settings2 className="mr-1.5 h-4 w-4 inline" aria-hidden="true" />
              Configurar Rutina
            </Button>
            <Button onClick={() => setNewTaskModalOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4 inline" aria-hidden="true" />
              Nueva Tarea de Rutina
            </Button>
          </div>
        }
      />

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard
          icon="check"
          label="Cumplimiento Hoy"
          value={`${data.metrics.todayCompleted}/${data.metrics.todayTotal} (${data.metrics.todayPct}%)`}
          color={data.metrics.todayPct === 100 ? "green" : "yellow"}
        />
        <StatCard
          icon="target"
          label="Disciplina Semanal (7d)"
          value={`${data.metrics.compliance7dPct}%`}
          color={data.metrics.compliance7dPct >= 80 ? "green" : "blue"}
        />
        <StatCard
          icon="warning"
          label="Incumplidos / Vencidos"
          value={data.metrics.overdueTotal}
          color={data.metrics.overdueTotal > 0 ? "red" : "green"}
        />
        <StatCard
          icon="calendar"
          label="Hitos Próximos (30–90d)"
          value={
            data.metrics.upcoming7dCount +
            data.metrics.upcoming30dCount +
            data.metrics.upcoming90dCount
          }
          color="purple"
        />
      </div>

      {/* Navigation Tabs + Module Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1">
          {[
            { id: "hoy", label: `⚡ Tareas de Hoy (${data.metrics.todayCompleted}/${data.metrics.todayTotal})` },
            { id: "calendario", label: "📅 Calendario Mensual" },
            { id: "horizonte", label: "🔭 Mediano y Largo Plazo" },
            {
              id: "cumplimiento",
              label: `📊 Cumplidos vs. Incumplidos (${data.metrics.overdueTotal})`,
            },
            { id: "rutina", label: "⚙️ Rutina Auto-Ajustable" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-white text-green-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            aria-label="Filtrar por módulo"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
          >
            <option value="all">Todos los módulos</option>
            {Object.entries(MODULE_META).map(([modKey, meta]) => (
              <option key={modKey} value={modKey}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── TAB 1: HOY Y TAREAS DEL DÍA ─── */}
      {activeTab === "hoy" && (
        <div className="space-y-6">
          {/* Progress Banner */}
          <Card className="border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-amber-50/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-800 px-3 py-0.5 text-xs font-bold text-white">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Rutina Activa del Día ({data.today})</span>
                </span>
                <h2 className="mt-2 text-lg font-extrabold text-slate-900">
                  {data.metrics.todayPending === 0
                    ? "¡Jornada al día! Completaste todas las tareas programadas para hoy"
                    : `Tienes ${data.metrics.todayPending} tarea(s) pendiente(s) hoy según tu rutina`}
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
                  Las tareas conectadas a módulos (huevos, alimento, mortalidad, ventas/gastos, sanidad) se marcan{" "}
                  <strong>automáticamente</strong> al guardar el registro, o puedes confirmarlas con 1 toque.
                </p>
              </div>
              <div className="w-full sm:w-56">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Progreso de hoy</span>
                  <span>{data.metrics.todayPct}%</span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300"
                    style={{ width: `${data.metrics.todayPct}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Overdue alert strip if any */}
          {data.overdueItems.length > 0 && (
            <Card className="border-2 border-rose-300 bg-rose-50/70">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-5 w-5 text-rose-700 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-extrabold text-rose-950">
                      Tienes {data.overdueItems.length} actividad(es) incumplida(s) o vencida(s) de días anteriores
                    </p>
                    <p className="text-xs text-rose-800">
                      Puedes registrarlas ahora o marcarlas como cumplidas si ya se ejecutaron en campo.
                    </p>
                  </div>
                </div>
                <Button variant="danger" onClick={() => setActiveTab("cumplimiento")}>
                  Revisar incumplidos ({data.overdueItems.length})
                </Button>
              </div>
            </Card>
          )}

          {/* Today's Tasks Grid */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {data.todayRoutineTasks
              .filter((e) => moduleFilter === "all" || e.module === moduleFilter)
              .map((ev) => {
                const isDone = ev.status === "completed";
                const meta = MODULE_META[ev.module] || MODULE_META.rutina;
                const mode = ev.verificationMode || "record_required";
                return (
                  <div
                    key={ev.id}
                    className={`flex flex-col justify-between min-w-0 rounded-2xl border-2 p-3 sm:p-4 transition-all ${
                      isDone
                        ? "border-emerald-300 bg-emerald-50/60"
                        : "border-slate-200 bg-white shadow-xs hover:border-green-400"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-bold ${meta.badgeClass}`}
                        >
                          <AppIcon icon={ev.icon} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          <span className="truncate">{meta.label}</span>
                        </span>
                        {ev.shift && (
                          <span className="text-[10px] sm:text-xs font-semibold text-slate-500">
                            {SHIFT_LABELS[ev.shift].split(" (")[0]}
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-2 sm:gap-3">
                        {isDone && ev.autoCompleted ? (
                          <span
                            title="Verificada automáticamente con registro real en base de datos"
                            className="mt-0.5 flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg border-2 border-emerald-600 bg-emerald-600 text-white"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                          </span>
                        ) : !isDone && mode === "record_required" ? (
                          <span
                            title="Requiere registro real en el módulo para completarse"
                            className="mt-0.5 flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-800"
                          >
                            <FileCheck2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleVerificationAction(ev)}
                            title={
                              isDone
                                ? "Revertir confirmación con evidencia"
                                : "Confirmar con evidencia en campo"
                            }
                            className={`mt-0.5 flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                              isDone
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300 bg-white text-slate-600 hover:border-emerald-500 hover:text-emerald-700"
                            }`}
                          >
                            {isDone ? (
                              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                            ) : (
                              <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                            )}
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-xs sm:text-base font-extrabold leading-snug line-clamp-2 ${
                              isDone ? "line-through text-slate-600" : "text-slate-900"
                            }`}
                          >
                            {ev.title}
                          </h3>
                          <p className="mt-0.5 text-[11px] sm:text-xs font-medium text-slate-600 line-clamp-2">
                            {ev.subtitle}
                          </p>
                          {isDone && (
                            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-emerald-900">
                              <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                              <span className="truncate">
                                {ev.autoCompleted
                                  ? `Auto-verificada: ${ev.completionDetail}`
                                  : `Evidencia: ${ev.completionDetail || "Confirmada"}`}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 sm:pt-3">
                      {isDone && ev.autoCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Verificada en BD</span>
                        </span>
                      ) : isDone ? (
                        <button
                          type="button"
                          onClick={() => void handleVerificationAction(ev)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-[11px] sm:text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          <RotateCcw className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>Revertir</span>
                        </button>
                      ) : mode === "record_required" ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] sm:text-[11px] font-bold text-amber-900">
                          <FileCheck2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>Se verifica al registrar</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleVerificationAction(ev)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-[11px] sm:text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {mode === "declaration_or_record"
                              ? "Confirmar sin novedad"
                              : "Confirmar evidencia"}
                          </span>
                        </button>
                      )}

                      <Button
                        type="button"
                        variant={isDone ? "secondary" : "primary"}
                        className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs"
                        onClick={() => triggerEventAction(ev)}
                      >
                        {ev.actionLabel} →
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ─── TAB 2: CALENDARIO MENSUAL UNIFICADO ─── */}
      {activeTab === "calendario" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-green-700" aria-hidden="true" />
                <h2 className="text-lg font-extrabold text-slate-900">
                  {MONTH_NAMES[monthCursor.month]} {monthCursor.year}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor((prev) =>
                      prev.month === 0
                        ? { year: prev.year - 1, month: 11 }
                        : { year: prev.year, month: prev.month - 1 },
                    )
                  }
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const [y, m] = data.today.split("-").map(Number);
                    setMonthCursor({ year: y, month: m - 1 });
                    setSelectedDate(data.today);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMonthCursor((prev) =>
                      prev.month === 11
                        ? { year: prev.year + 1, month: 0 }
                        : { year: prev.year, month: prev.month + 1 },
                    )
                  }
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-500 mb-2">
              {DAY_NAMES_SHORT.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {monthCells.map((dateIso, idx) => {
                if (!dateIso) {
                  return <div key={`empty-${idx}`} className="h-20 rounded-xl bg-slate-50/50" />;
                }
                const dayEvents = eventsByDateMap.get(dateIso) || [];
                const doneCount = dayEvents.filter((e) => e.status === "completed").length;
                const overdueCount = dayEvents.filter((e) => e.status === "overdue").length;
                const pendingCount = dayEvents.filter(
                  (e) => e.status === "pending_today" || e.status === "upcoming",
                ).length;
                const isToday = dateIso === data.today;
                const isSelected = dateIso === selectedDate;
                const dayNum = Number(dateIso.slice(8, 10));

                return (
                  <button
                    key={dateIso}
                    type="button"
                    onClick={() => setSelectedDate(dateIso)}
                    className={`flex h-20 flex-col justify-between rounded-xl border p-2 text-left transition-all ${
                      isSelected
                        ? "border-2 border-green-700 bg-green-50/70 ring-2 ring-green-600/20"
                        : isToday
                          ? "border-2 border-amber-400 bg-amber-50/40"
                          : overdueCount > 0
                            ? "border-rose-200 bg-rose-50/30 hover:bg-rose-50/60"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-extrabold ${
                          isToday
                            ? "rounded-full bg-amber-500 px-1.5 py-0.5 text-white"
                            : "text-slate-800"
                        }`}
                      >
                        {dayNum}
                      </span>
                      {overdueCount > 0 && (
                        <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                          !{overdueCount}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {dayEvents.slice(0, 4).map((ev) => (
                          <span
                            key={ev.id}
                            className={`h-2 w-2 rounded-full ${
                              ev.status === "completed"
                                ? "bg-emerald-600"
                                : ev.status === "overdue"
                                  ? "bg-rose-600"
                                  : MODULE_META[ev.module]?.dotClass || "bg-sky-600"
                            }`}
                          />
                        ))}
                      </div>
                      {dayEvents.length > 0 && (
                        <p className="truncate text-[10px] font-semibold text-slate-600">
                          {doneCount > 0 ? `✓${doneCount} ` : ""}
                          {pendingCount > 0 ? `· ${pendingCount} prog.` : ""}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Day Detail Panel */}
          <Card>
            <div className="border-b border-slate-200 pb-3 mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Detalle de Fecha Seleccionada
              </p>
              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                {selectedDate || data.today}
              </h3>
            </div>

            {selectedDateEvents.length === 0 ? (
              <EmptyState
                icon="calendar"
                message="No hay tareas ni hitos programados para esta fecha."
              />
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {selectedDateEvents.map((ev) => {
                  const meta = MODULE_META[ev.module] || MODULE_META.rutina;
                  return (
                    <div
                      key={ev.id}
                      className={`rounded-xl border p-3 ${
                        ev.status === "completed"
                          ? "border-emerald-200 bg-emerald-50/60"
                          : ev.status === "overdue"
                            ? "border-rose-300 bg-rose-50/70"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        <Badge
                          color={
                            ev.status === "completed"
                              ? "green"
                              : ev.status === "overdue"
                                ? "red"
                                : ev.status === "pending_today"
                                  ? "yellow"
                                  : "blue"
                          }
                        >
                          {ev.status === "completed"
                            ? "Cumplido"
                            : ev.status === "overdue"
                              ? "Incumplido"
                              : ev.status === "pending_today"
                                ? "Hoy"
                                : "Programado"}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{ev.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{ev.subtitle}</p>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        {ev.status === "completed" && ev.autoCompleted ? (
                          <span className="text-[11px] font-bold text-emerald-800">
                            ✓ Verificada en BD
                          </span>
                        ) : ev.status === "completed" ? (
                          <button
                            type="button"
                            onClick={() => void handleVerificationAction(ev)}
                            className="text-xs font-bold text-slate-700 hover:underline"
                          >
                            Revertir evidencia
                          </button>
                        ) : (ev.verificationMode || "record_required") === "record_required" ? (
                          <span className="text-[11px] font-semibold text-amber-800">
                            Se verifica al registrar
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleVerificationAction(ev)}
                            className="text-xs font-bold text-emerald-800 hover:underline"
                          >
                            {(ev.verificationMode || "record_required") === "declaration_or_record"
                              ? "Confirmar sin novedad"
                              : "Confirmar con evidencia"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => triggerEventAction(ev)}
                          className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          {ev.actionLabel} →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── TAB 3: MEDIANO Y LARGO PLAZO (7, 30 Y 90 DÍAS) ─── */}
      {activeTab === "horizonte" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[
            {
              title: "Próximos 7 Días (Corto Plazo)",
              subtitle: "Vacunas de la semana, volteos, nidales y cobros próximos",
              items: data.upcomingMediumLongTerm.next7Days,
              toneClass: "border-amber-300 bg-amber-50/40",
            },
            {
              title: "8 a 30 Días (Mediano Plazo)",
              subtitle: "Eclosiones, partos programados, refuerzos ICA y mantenimientos",
              items: data.upcomingMediumLongTerm.next30Days,
              toneClass: "border-sky-300 bg-sky-50/40",
            },
            {
              title: "31 a 90 Días (Largo Plazo)",
              subtitle: "Ventanas óptimas de cosecha/beneficio de lotes y compostaje",
              items: data.upcomingMediumLongTerm.next90Days,
              toneClass: "border-purple-300 bg-purple-50/40",
            },
          ].map((col) => (
            <Card key={col.title} className={`border-2 ${col.toneClass}`}>
              <div className="border-b border-slate-200 pb-3 mb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900">{col.title}</h3>
                  <Badge color="blue">{col.items.length}</Badge>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{col.subtitle}</p>
              </div>

              {col.items.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  Sin hitos especiales programados en este horizonte.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                  {col.items.map((ev) => {
                    const meta = MODULE_META[ev.module] || MODULE_META.rutina;
                    return (
                      <div
                        key={ev.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          <span className="text-xs font-extrabold text-slate-800">
                            📅 {ev.date}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{ev.title}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{ev.subtitle}</p>
                        <div className="mt-2 flex justify-end">
                          <Link
                            href={ev.actionHref}
                            className="text-xs font-bold text-green-700 hover:underline"
                          >
                            {ev.actionLabel} →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ─── TAB 4: CUMPLIDOS VS. INCUMPLIDOS ─── */}
      {activeTab === "cumplimiento" && (
        <div className="space-y-6">
          {/* 14-day Daily Discipline Bar */}
          <Card>
            <h3 className="text-base font-extrabold text-slate-900 mb-1 flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-600" aria-hidden="true" />
              <span>Historial de Cumplimiento Diario (Últimos 15 días)</span>
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Muestra qué porcentaje de la rutina diaria se cumplió cada día. Haz clic en cualquier fecha para ver su detalle en el calendario.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-15 gap-2">
              {data.dailyHistory.map((day) => {
                const isPerfect = day.compliancePct === 100;
                const isPartial = day.compliancePct >= 50 && day.compliancePct < 100;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day.date);
                      setActiveTab("calendario");
                    }}
                    className={`flex flex-col items-center rounded-xl border p-2.5 text-center transition-all ${
                      isPerfect
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : isPartial
                          ? "border-amber-300 bg-amber-50 text-amber-950"
                          : "border-rose-300 bg-rose-50 text-rose-950"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-600">
                      {day.date.slice(5)}
                    </span>
                    <span className="my-1 text-sm font-black">{day.compliancePct}%</span>
                    <span className="text-[10px] font-semibold">
                      {day.completedCount}/{day.totalScheduled}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Overdue / Missed List */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Actividades Incumplidas o Vencidas ({data.overdueItems.length})
                </h3>
                <p className="text-xs text-slate-600">
                  Tareas de rutina de los últimos 7 días o hitos sanitarios/operativos vencidos sin registro.
                </p>
              </div>
            </div>

            {data.overdueItems.length === 0 ? (
              <EmptyState
                icon="check"
                message="¡Felicitaciones! No tienes ninguna tarea ni actividad incumplida."
              />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {data.overdueItems.map((ev) => {
                  const meta = MODULE_META[ev.module] || MODULE_META.rutina;
                  const mode = ev.verificationMode || "record_required";
                  return (
                    <div
                      key={ev.id}
                      className="flex flex-col justify-between min-w-0 rounded-xl border-2 border-rose-200 bg-rose-50/50 p-2.5 sm:p-3.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          <span className="rounded-md bg-rose-700 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-bold text-white">
                            Incumplido · {ev.date}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-2">{ev.title}</p>
                        <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 line-clamp-2">{ev.subtitle}</p>
                      </div>

                      <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rose-200 pt-2">
                        {mode === "record_required" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] sm:text-xs font-bold text-amber-900">
                            <FileCheck2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>Requiere registro</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleVerificationAction(ev)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-white px-2 py-1 text-[11px] sm:text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {mode === "declaration_or_record"
                                ? "Confirmar sin novedad"
                                : "Confirmar con evidencia"}
                            </span>
                          </button>
                        )}
                        <Button
                          type="button"
                          className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs"
                          onClick={() => triggerEventAction(ev)}
                        >
                          {ev.actionLabel} →
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── TAB 5: CONFIGURADOR DE RUTINA AUTO-AJUSTABLE ─── */}
      {activeTab === "rutina" && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Configuración de la Rutina de la Granja
              </h3>
              <p className="text-xs sm:text-sm text-slate-600">
                Define qué tareas hacen parte de tu rutina y en qué días aplican. Los botones de{" "}
                <strong>Tareas del Día</strong> en el Inicio se auto-ajustan según esta configuración.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setNewTaskModalOpen(true)}>
                + Agregar Tarea
              </Button>
              <Button onClick={() => void saveRoutineChanges()} disabled={savingRoutine}>
                {savingRoutine ? "Guardando..." : "Guardar Rutina"}
              </Button>
            </div>
          </div>

          {routineSavedMsg && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
              ✅ {routineSavedMsg}
            </div>
          )}

          <div className="space-y-3">
            {draftRoutine.map((task, idx) => {
              const meta = MODULE_META[task.module] || MODULE_META.rutina;
              return (
                <div
                  key={task.id}
                  className={`rounded-xl border p-4 transition-all ${
                    task.enabled
                      ? "border-slate-300 bg-white"
                      : "border-slate-200 bg-slate-50 opacity-70"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-[240px]">
                      <input
                        type="checkbox"
                        checked={task.enabled}
                        onChange={(e) => {
                          const next = [...draftRoutine];
                          next[idx] = { ...task, enabled: e.target.checked };
                          setDraftRoutine(next);
                        }}
                        className="mt-1 h-5 w-5 rounded border-slate-300 text-green-700"
                        aria-label={`Activar ${task.title}`}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                            {task.title}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              getTaskVerificationMode(task) === "record_required"
                                ? "bg-emerald-100 text-emerald-800"
                                : getTaskVerificationMode(task) === "declaration_or_record"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {getTaskVerificationMode(task) === "record_required"
                              ? "⚡ Verificación obligatoria en módulo"
                              : getTaskVerificationMode(task) === "declaration_or_record"
                                ? "⚡ Auto-verificable o sin novedad"
                                : "📝 Requiere evidencia en campo"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{task.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={task.shift}
                        onChange={(e) => {
                          const next = [...draftRoutine];
                          next[idx] = { ...task, shift: e.target.value as RoutineShift };
                          setDraftRoutine(next);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                        aria-label="Horario"
                      >
                        <option value="manana">🌅 Mañana</option>
                        <option value="tarde">☀️ Tarde</option>
                        <option value="cierre">🌙 Cierre</option>
                        <option value="todo_el_dia">📅 Todo el día</option>
                      </select>

                      <select
                        value={task.frequency}
                        onChange={(e) => {
                          const freq = e.target.value as RoutineFrequency;
                          const next = [...draftRoutine];
                          next[idx] = {
                            ...task,
                            frequency: freq,
                            daysOfWeek:
                              freq === "dias_semana"
                                ? task.daysOfWeek && task.daysOfWeek.length > 0
                                  ? task.daysOfWeek
                                  : [1]
                                : undefined,
                          };
                          setDraftRoutine(next);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                        aria-label="Frecuencia"
                      >
                        <option value="diaria">Todos los días</option>
                        <option value="lunes_a_viernes">Lunes a Viernes</option>
                        <option value="dias_semana">Días específicos</option>
                        <option value="quincenal">Quincenal (1 y 15)</option>
                        <option value="mensual">Mensual</option>
                      </select>

                      {task.id.startsWith("routine-custom-") && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftRoutine(draftRoutine.filter((t) => t.id !== task.id));
                          }}
                          className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                          title="Eliminar tarea personalizada"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {task.frequency === "dias_semana" && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-8">
                      <span className="text-xs font-semibold text-slate-600 mr-1">
                        Días activos:
                      </span>
                      {DAY_NAMES_SHORT.map((dayName, dow) => {
                        const selected = (task.daysOfWeek || []).includes(dow);
                        return (
                          <button
                            key={dayName}
                            type="button"
                            onClick={() => {
                              const current = task.daysOfWeek || [];
                              const nextDays = selected
                                ? current.filter((d) => d !== dow)
                                : [...current, dow].sort();
                              const next = [...draftRoutine];
                              next[idx] = {
                                ...task,
                                daysOfWeek: nextDays.length > 0 ? nextDays : [dow],
                              };
                              setDraftRoutine(next);
                            }}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${
                              selected
                                ? "border-green-700 bg-green-700 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {dayName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Modal to create custom Routine Task */}
      <Modal
        open={newTaskModalOpen}
        onClose={() => setNewTaskModalOpen(false)}
        title="Nueva Tarea para la Rutina de la Granja"
      >
        <div className="space-y-4">
          <Input
            label="Nombre de la tarea *"
            value={newTaskForm.title}
            onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
            placeholder="Ej: Limpieza de bebederos, corte de pasto, revisión de cercas..."
          />
          <Input
            label="Descripción breve / instrucción"
            value={newTaskForm.description}
            onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
            placeholder="Qué se debe verificar o registrar"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Módulo asociado"
              value={newTaskForm.module}
              onChange={(e) =>
                setNewTaskForm({
                  ...newTaskForm,
                  module: e.target.value as CalendarModuleType,
                })
              }
            >
              {Object.entries(MODULE_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Select
              label="Franja del día"
              value={newTaskForm.shift}
              onChange={(e) =>
                setNewTaskForm({ ...newTaskForm, shift: e.target.value as RoutineShift })
              }
            >
              <option value="manana">🌅 Mañana</option>
              <option value="tarde">☀️ Tarde</option>
              <option value="cierre">🌙 Cierre</option>
              <option value="todo_el_dia">📅 Todo el día</option>
            </Select>
            <Select
              label="Frecuencia"
              value={newTaskForm.frequency}
              onChange={(e) =>
                setNewTaskForm({
                  ...newTaskForm,
                  frequency: e.target.value as RoutineFrequency,
                })
              }
            >
              <option value="diaria">Todos los días</option>
              <option value="lunes_a_viernes">Lunes a Viernes</option>
              <option value="dias_semana">Días específicos</option>
              <option value="quincenal">Quincenal (1 y 15)</option>
              <option value="mensual">Mensual</option>
            </Select>
          </div>

          {newTaskForm.frequency === "dias_semana" && (
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Selecciona los días de la semana
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DAY_NAMES_SHORT.map((dName, dow) => {
                  const active = newTaskForm.daysOfWeek.includes(dow);
                  return (
                    <button
                      key={dName}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? newTaskForm.daysOfWeek.filter((d) => d !== dow)
                          : [...newTaskForm.daysOfWeek, dow].sort();
                        setNewTaskForm({
                          ...newTaskForm,
                          daysOfWeek: next.length > 0 ? next : [dow],
                        });
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                        active
                          ? "border-green-700 bg-green-700 text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      {dName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setNewTaskModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleAddRoutineTask()}>
              Agregar a la rutina
            </Button>
          </div>
        </div>
      </Modal>

      <TaskVerificationModal
        event={verifyingEvent}
        onClose={() => setVerifyingEvent(null)}
        onVerified={loadCalendar}
        onGoToModule={triggerEventAction}
      />
    </div>
  );
}

