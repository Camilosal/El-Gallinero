"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { TaskVerificationModal } from "@/components/TaskVerificationModal";
import { apiFetch } from "@/lib/fetch";
import {
  OPEN_QUICK_CAPTURE_EVENT,
  QUICK_CAPTURE_SAVED_EVENT,
  type QuickCaptureDetail,
} from "@/lib/quick-capture-events";
import type {
  RoutineShift,
  UnifiedCalendarEvent,
  UnifiedCalendarResponse,
} from "@/lib/unified-calendar";

const SHIFT_SHORT_LABELS: Record<RoutineShift, string> = {
  manana: "Mañana",
  tarde: "Tarde",
  cierre: "Cierre",
  todo_el_dia: "Todo el día",
};

interface RoutineDayButtonsProps {
  searchQuery?: string;
  onOpenQuickSale?: () => void;
}

export default function RoutineDayButtons({
  searchQuery = "",
  onOpenQuickSale,
}: RoutineDayButtonsProps) {
  const router = useRouter();
  const [calendarData, setCalendarData] = useState<UnifiedCalendarResponse | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [verifyingEvent, setVerifyingEvent] = useState<UnifiedCalendarEvent | null>(null);

  const loadRoutine = useCallback(async () => {
    try {
      const res = await apiFetch("/api/planeacion/calendario");
      if (!res.ok) return;
      const payload = (await res.json()) as UnifiedCalendarResponse;
      setCalendarData(payload);
    } catch {
      // Fallback handled below
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch("/api/planeacion/calendario")
      .then(async (res) => {
        if (!res.ok || !active) return;
        const payload = (await res.json()) as UnifiedCalendarResponse;
        if (active) setCalendarData(payload);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onSaved = () => {
      void loadRoutine();
    };
    window.addEventListener(QUICK_CAPTURE_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(QUICK_CAPTURE_SAVED_EVENT, onSaved);
  }, [loadRoutine]);

  const handleExecuteTask = (ev: UnifiedCalendarEvent) => {
    if (ev.quickCaptureMode === "venta" && onOpenQuickSale) {
      onOpenQuickSale();
      return;
    }
    if (ev.quickCaptureMode) {
      const detail: QuickCaptureDetail = { mode: ev.quickCaptureMode };
      window.dispatchEvent(new CustomEvent(OPEN_QUICK_CAPTURE_EVENT, { detail }));
      return;
    }
    router.push(ev.actionHref);
  };

  const handleTaskStatusClick = async (
    e: React.MouseEvent,
    ev: UnifiedCalendarEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const mode = ev.verificationMode || "record_required";
    const isDone = ev.status === "completed";

    if (!isDone) {
      if (mode === "record_required") {
        // Nunca se marca sin registro real: abre el formulario de captura directamente
        handleExecuteTask(ev);
        return;
      }
      setVerifyingEvent(ev);
      return;
    }

    // Solo permitir deshacer confirmaciones manuales (nunca registros reales de BD)
    if (ev.autoCompleted || mode === "record_required") return;

    const taskId = ev.routineTaskId || ev.id;
    setTogglingId(ev.id);
    try {
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
        await loadRoutine();
      }
    } finally {
      setTogglingId(null);
    }
  };

  if (!calendarData) return null;

  const q = searchQuery.trim().toLowerCase();
  const visibleTasks = q
    ? calendarData.todayRoutineTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        t.module.toLowerCase().includes(q),
    )
    : calendarData.todayRoutineTasks;

  if (visibleTasks.length === 0) return null;

  // Sort: pending first, completed after so the user focuses on what remains
  const sortedTasks = [...visibleTasks].sort((a, b) => {
    const aDone = a.status === "completed" ? 1 : 0;
    const bDone = b.status === "completed" ? 1 : 0;
    return aDone - bDone;
  });
  const pendingTasks = sortedTasks.filter((t) => t.status !== "completed");
  const completedTasks = sortedTasks.filter((t) => t.status === "completed");
  const displayedTasks = q || showCompleted ? sortedTasks : pendingTasks;

  const { todayCompleted, todayTotal, overdueTotal } = calendarData.metrics;

  return (
    <section
      className="mb-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/45 p-4 sm:p-5 shadow-xs"
      aria-labelledby="routine-day-heading"
    >
      {/* Header limpio con progreso y único enlace a Calendario y rutina */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2
            id="routine-day-heading"
            className="text-base font-bold text-slate-900"
          >
            Tareas de hoy
          </h2>
          <span className="text-xs font-medium text-slate-500">
            {todayCompleted} de {todayTotal} completadas
          </span>
          {overdueTotal > 0 && (
            <Link
              href="/dashboard/planeacion/calendario"
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
            >
              <AlertTriangle className="h-3 w-3 text-rose-700" aria-hidden="true" />
              <span>{overdueTotal} atrasada{overdueTotal > 1 ? "s" : ""}</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {completedTasks.length > 0 && !q && (
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${showCompleted ? "rotate-90" : ""}`} aria-hidden="true" />
              <span>{showCompleted ? "Ocultar listas" : `Ver listas (${completedTasks.length})`}</span>
            </button>
          )}
          <Link
            href="/dashboard/planeacion/calendario"
            className="inline-flex min-h-[48px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-50"
          >
            <Calendar className="h-4 w-4 text-slate-600" aria-hidden="true" />
            <span>Calendario y rutina</span>
          </Link>
        </div>
      </div>

      {/* Franja limpia cuando las tareas de hoy ya están listas */}
      {displayedTasks.length === 0 && completedTasks.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 border-l-4 border-l-emerald-600 bg-white px-4 py-3 text-sm text-slate-800">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Jornada al día ({completedTasks.length} de {sortedTasks.length} tareas completadas)</span>
          </div>
          <button
            type="button"
            onClick={() => setShowCompleted(true)}
            className="text-xs font-semibold text-emerald-800 hover:underline"
          >
            Revisar o agregar registro →
          </button>
        </div>
      ) : (
        /* Cuadrícula uniforme y profesional (2 columnas en móvil, 4 en escritorio) */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {displayedTasks.map((ev) => {
            const isDone = ev.status === "completed";
            const mode = ev.verificationMode || "record_required";
            const shiftLabel = ev.shift ? SHIFT_SHORT_LABELS[ev.shift] : "Hoy";

            return (
              <div
                key={ev.id}
                onClick={() => handleExecuteTask(ev)}
                role="button"
                tabIndex={0}
                title={ev.subtitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleExecuteTask(ev);
                  }
                }}
                className={`group flex flex-col justify-between min-w-0 rounded-xl border p-3 sm:p-4 text-left transition-colors cursor-pointer ${isDone
                  ? "border-slate-200 bg-slate-50/80 hover:border-slate-300"
                  : "border-slate-200 bg-white hover:border-emerald-600/60"
                  }`}
              >
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg ${isDone
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                        }`}
                    >
                      <AppIcon icon={ev.icon} className="h-4 w-4" />
                    </div>

                    {isDone && ev.autoCompleted ? (
                      <span
                        title="Completada automáticamente con registro en base de datos"
                        className="inline-flex min-h-[48px] items-center gap-1 rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 shrink-0"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Listo</span>
                      </span>
                    ) : isDone ? (
                      <button
                        type="button"
                        onClick={(e) => void handleTaskStatusClick(e, ev)}
                        disabled={togglingId === ev.id}
                        title={
                          ev.evidenceNote
                            ? `Confirmada: ${ev.evidenceNote} (clic para revertir)`
                            : "Confirmada (clic para revertir)"
                        }
                        className="inline-flex min-h-[48px] items-center gap-1 rounded-lg border border-emerald-700/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 shrink-0"
                      >
                        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Listo</span>
                      </button>
                    ) : mode === "record_required" ? (
                      <button
                        type="button"
                        onClick={(e) => void handleTaskStatusClick(e, ev)}
                        title="Se completa al guardar el registro en su módulo"
                        className="inline-flex min-h-[48px] items-center rounded-lg border border-emerald-700/40 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:border-emerald-700 hover:bg-emerald-100 shrink-0"
                      >
                        Registrar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => void handleTaskStatusClick(e, ev)}
                        disabled={togglingId === ev.id}
                        title={
                          mode === "declaration_or_record"
                            ? "Confirmar sin novedad o abrir módulo"
                            : "Confirmar labor realizada"
                        }
                        className="inline-flex min-h-[48px] items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-emerald-700 hover:text-emerald-900 shrink-0"
                      >
                        Confirmar
                      </button>
                    )}
                  </div>

                  <p
                    className={`text-xs sm:text-sm font-semibold leading-snug line-clamp-2 ${isDone ? "line-through text-slate-500" : "text-slate-900"
                      }`}
                  >
                    {ev.title}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-1 border-t border-slate-100 pt-2 text-[11px]">
                  <span className="text-slate-500 truncate">{shiftLabel}</span>
                  <span className="font-semibold text-emerald-800 group-hover:underline shrink-0">
                    {isDone ? "+ Otro" : "Abrir →"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskVerificationModal
        event={verifyingEvent}
        onClose={() => setVerifyingEvent(null)}
        onVerified={loadRoutine}
        onGoToModule={handleExecuteTask}
      />
    </section>
  );
}

