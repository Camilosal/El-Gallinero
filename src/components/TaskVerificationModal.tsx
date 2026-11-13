"use client";

import { useState } from "react";
import { ShieldCheck, ArrowRight, AlertCircle, CheckSquare } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { apiFetch } from "@/lib/fetch";
import type { UnifiedCalendarEvent } from "@/lib/unified-calendar";

function getPresetNotes(event: UnifiedCalendarEvent): string[] {
  if (event.verificationMode === "declaration_or_record") {
    if (event.module === "mortalidad" || event.routineTaskId === "routine-health-walk") {
      return [
        "0 bajas · aves activas, agua y cama OK",
        "Ronda sanitaria completa · consumo normal y sin síntomas",
      ];
    }
    if (event.module === "finanzas" || event.routineTaskId === "routine-sales-cash") {
      return [
        "Sin ventas ni compras hoy · caja verificada",
        "Sin movimientos comerciales en la jornada",
      ];
    }
  }
  const id = event.routineTaskId || event.id;
  if (id.startsWith("sanitary:")) {
    return [
      "Control sanitario ejecutado en galpón · dosis y lote verificados",
      "Aplicación completada sin novedades ni reacciones adversas",
    ];
  }
  if (id.startsWith("inc-turn:")) {
    return [
      "Volteo suspendido y humedad final ajustada en nacedora",
    ];
  }
  if (id.startsWith("repro-nest:")) {
    return [
      "Nidal desinfectado instalado con cama limpia para parto",
    ];
  }
  return [
    "Labor ejecutada físicamente y verificada en estación",
  ];
}

function VerificationFormContent({
  event,
  onClose,
  onVerified,
  onGoToModule,
}: {
  event: UnifiedCalendarEvent;
  onClose: () => void;
  onVerified: () => Promise<void> | void;
  onGoToModule?: (event: UnifiedCalendarEvent) => void;
}) {
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets = getPresetNotes(event);
  const isDeclaration = event.verificationMode === "declaration_or_record";
  const trimmed = note.trim();
  const canSubmit = confirmed && trimmed.length >= 5 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const taskId = event.routineTaskId || event.id;
      const res = await apiFetch("/api/planeacion/calendario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: event.date,
          taskId,
          completed: true,
          note: trimmed,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "No se pudo guardar la confirmación.");
      }
      await onVerified();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la confirmación.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <AppIcon icon={event.icon} className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{event.title}</p>
          <p className="text-xs text-slate-600 mt-0.5">{event.subtitle}</p>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">
            Fecha programada: {event.date}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p>
          {isDeclaration
            ? "Esta tarea se cumple automáticamente si registras un movimiento real en su módulo. Usa esta confirmación únicamente cuando verificaste en campo que no hubo novedad (ej. 0 bajas o sin ventas)."
            : "Para evitar cierres falsos, deja constancia breve de lo ejecutado o verificado físicamente en campo."}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-1.5">
          Observaciones rápidas (1 toque):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setNote(preset)}
              className={`text-left text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                note === preset
                  ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label
          htmlFor="task-verification-note"
          className="block text-xs font-semibold text-slate-700 mb-1"
        >
          Evidencia u observación en campo (mínimo 5 caracteres)
        </label>
        <textarea
          id="task-verification-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe qué verificaste o ejecutaste en campo..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
        <p className="text-[11px] text-slate-500 mt-1">
          {trimmed.length}/5 caracteres mínimos
        </p>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span className="text-xs font-medium text-slate-700 leading-relaxed">
          Confirmo que esta actividad se realizó realmente en la granja en la fecha{" "}
          <strong>{event.date}</strong> y asumo su trazabilidad en la bitácora.
        </span>
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-100">
        {onGoToModule && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onGoToModule(event);
            }}
            className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 py-1.5"
          >
            Mejor registrar dato en módulo <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="flex items-center justify-end gap-2 ml-auto">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            <span className="inline-flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4" />
              {submitting ? "Guardando..." : "Confirmar con evidencia"}
            </span>
          </Button>
        </div>
      </div>
    </form>
  );
}

export function TaskVerificationModal({
  event,
  onClose,
  onVerified,
  onGoToModule,
}: {
  event: UnifiedCalendarEvent | null;
  onClose: () => void;
  onVerified: () => Promise<void> | void;
  onGoToModule?: (event: UnifiedCalendarEvent) => void;
}) {
  return (
    <Modal
      open={Boolean(event)}
      onClose={onClose}
      title={
        event?.verificationMode === "declaration_or_record"
          ? "Confirmar sin novedad o abrir módulo"
          : "Evidencia obligatoria de tarea"
      }
    >
      {event && (
        <VerificationFormContent
          key={`${event.id}:${event.date}`}
          event={event}
          onClose={onClose}
          onVerified={onVerified}
          onGoToModule={onGoToModule}
        />
      )}
    </Modal>
  );
}
