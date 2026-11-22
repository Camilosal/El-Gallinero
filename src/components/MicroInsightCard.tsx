"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Flame,
  GraduationCap,
  Lightbulb,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui";
import type {
  MicroInsightNextAction,
  MicroInsightPayload,
  MicroInsightTone,
} from "@/lib/micro-insights";

interface MicroInsightCardProps {
  insight: MicroInsightPayload;
  onDismiss?: () => void;
  onAnother?: () => void;
  onNextAction?: (action: MicroInsightNextAction) => void;
  doneLabel?: string;
  variant?: "full" | "compact";
}

const TONE_STYLES: Record<
  MicroInsightTone,
  {
    wrapper: string;
    badge: string;
    iconWrap: string;
    nudgeBox: string;
    nudgeTitle: string;
  }
> = {
  positive: {
    wrapper: "border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60",
    badge: "bg-emerald-800 text-white",
    iconWrap: "bg-emerald-100 text-emerald-800 border border-emerald-300",
    nudgeBox: "border-emerald-300 bg-emerald-950 text-emerald-50",
    nudgeTitle: "text-amber-300",
  },
  warning: {
    wrapper: "border-amber-400 bg-gradient-to-br from-amber-50/90 via-white to-yellow-50/60",
    badge: "bg-amber-900 text-white",
    iconWrap: "bg-amber-100 text-amber-900 border border-amber-300",
    nudgeBox: "border-amber-400 bg-slate-900 text-amber-50",
    nudgeTitle: "text-amber-300",
  },
  critical: {
    wrapper: "border-rose-400 bg-gradient-to-br from-rose-50/90 via-white to-amber-50/50",
    badge: "bg-rose-800 text-white",
    iconWrap: "bg-rose-100 text-rose-900 border border-rose-300",
    nudgeBox: "border-rose-400 bg-rose-950 text-rose-50",
    nudgeTitle: "text-amber-300",
  },
  info: {
    wrapper: "border-sky-300 bg-gradient-to-br from-sky-50/90 via-white to-emerald-50/50",
    badge: "bg-slate-800 text-white",
    iconWrap: "bg-sky-100 text-sky-900 border border-sky-300",
    nudgeBox: "border-slate-700 bg-slate-900 text-slate-50",
    nudgeTitle: "text-emerald-300",
  },
};

const METRIC_HIGHLIGHT_STYLES: Record<string, string> = {
  good: "border-emerald-300 bg-white text-slate-900",
  warn: "border-amber-300 bg-amber-50/80 text-slate-900",
  bad: "border-rose-300 bg-rose-50/80 text-rose-950",
  neutral: "border-slate-200 bg-white text-slate-900",
};

export default function MicroInsightCard({
  insight,
  onDismiss,
  onAnother,
  onNextAction,
  doneLabel = "Listo",
  variant = "full",
}: MicroInsightCardProps) {
  const isCompact = variant === "compact";
  const resolvedSyncStatus = insight.syncStatus ?? (insight.offline ? "queued" : undefined);
  const [copied, setCopied] = useState(false);
  const styles = TONE_STYLES[insight.tone] || TONE_STYLES.positive;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(insight.whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleShareParte = async () => {
    // Parte diario omnicanal: compartir nativo (Telegram, etc.) o copiar al portapapeles.
    const text = insight.whatsappText;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Parte diario · IwaGranja", text });
        return;
      } catch {
        // Usuario canceló o no soportado: cae al portapapeles.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative rounded-2xl border-2 p-4 sm:p-5 shadow-md transition-all ${styles.wrapper}`}
    >
      {/* Top Bar: Category + Habit Streak + Dismiss */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${styles.badge}`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{insight.categoryLabel}</span>
          </span>

          {insight.normativeTag && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>{insight.normativeTag}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {insight.habit && (
            <span
              title="Progreso de los 4 registros esenciales de hoy y racha de disciplina"
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-100 px-2.5 py-1 text-xs font-extrabold text-orange-950"
            >
              <Flame className="h-3.5 w-3.5 text-orange-600 fill-orange-500" aria-hidden="true" />
              <span>
                Racha {insight.habit.streakDays}d · {insight.habit.completedEssentialCount}/
                {insight.habit.essentialTotal} hoy
              </span>
            </span>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Cerrar micro-reporte"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles.iconWrap}`}
        >
          {insight.tone === "critical" || insight.tone === "warning" ? (
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
            {insight.title}
          </h3>
          <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-700">
            {insight.subtitle}
          </p>
          {(resolvedSyncStatus === "queued" || resolvedSyncStatus === "local_draft" || insight.offline) && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-950">
              <WifiOff className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
              <span>Guardado en este teléfono · pendiente de respaldo en el servidor</span>
            </p>
          )}
          {resolvedSyncStatus === "confirmed" && !insight.offline && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
              <CheckCircle2 className="h-3 w-3 text-emerald-700" aria-hidden="true" />
              <span>Confirmado en servidor</span>
            </p>
          )}
          {insight.destinationBreakdown && (
            <p className="mt-1 text-xs font-semibold text-slate-800">
              Destino sin doble conteo: {insight.destinationBreakdown.hogar} al hogar ·{" "}
              {insight.destinationBreakdown.comercial} disponibles para comercialización (Total:{" "}
              {insight.destinationBreakdown.total} {insight.destinationBreakdown.unit})
            </p>
          )}
        </div>
      </div>

      {/* Instant Micro-Report Metrics Grid */}
      <div className={`grid grid-cols-2 ${isCompact ? "" : "sm:grid-cols-3"} gap-2 sm:gap-2.5 mb-4`}>
        {insight.metrics.map((metric, idx) => {
          const boxStyle =
            METRIC_HIGHLIGHT_STYLES[metric.highlight || "neutral"] ||
            METRIC_HIGHLIGHT_STYLES.neutral;
          return (
            <div
              key={`${metric.label}-${idx}`}
              className={`rounded-xl border p-2.5 sm:p-3 min-w-0 shadow-2xs ${boxStyle}`}
            >
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-600 truncate">
                {metric.label}
              </p>
              <p className="mt-0.5 text-base sm:text-lg font-black text-slate-950 truncate">{metric.value}</p>
              {metric.helper && (
                <p className="mt-0.5 text-[11px] sm:text-xs font-semibold text-slate-700 line-clamp-2">{metric.helper}</p>
              )}
            </div>
          );
        })}
      </div>

      {insight.assumptions && insight.assumptions.length > 0 && (
        <div className="mb-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-[11px] text-slate-700">
          <strong>Nota sobre el cálculo:</strong> {insight.assumptions.join(" ")}
        </div>
      )}

      {/* Nudge / Capsule Explanation Box (High Contrast >= 7:1) */}
      <div className={`rounded-xl border p-3.5 mb-4 ${styles.nudgeBox}`}>
        <div className="flex items-start gap-2.5">
          <Lightbulb
            className={`mt-0.5 h-5 w-5 shrink-0 ${styles.nudgeTitle}`}
            aria-hidden="true"
          />
          <div className="space-y-1 text-left">
            <p className={`text-xs sm:text-sm font-extrabold ${styles.nudgeTitle}`}>
              💡 Cápsula de Valor: {insight.nudgeTitle}
            </p>
            <p className="text-xs sm:text-sm leading-relaxed font-medium text-white/95">
              {insight.nudgeBody}
            </p>
          </div>
        </div>
      </div>

      {/* Puente formativo preparado hacia la Escuela de Operación de Granja */}
      {!isCompact && insight.learningAction && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-xs">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-bold text-slate-900">
              <GraduationCap className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>
                {insight.learningAction.isSchoolModuleMounted
                  ? `Escuela IwaGranja (${insight.learningAction.durationMinutes} min):`
                  : "Microlección Escuela (contrato preparado):"}
              </span>
              <span className="truncate font-semibold text-emerald-900">{insight.learningAction.title}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-slate-600">{insight.learningAction.fieldQuestion}</p>
          </div>
          {onNextAction && (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onNextAction({
                    label: insight.learningAction!.title,
                    href: insight.learningAction!.targetHref,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                <span>Ver referencia y práctica</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Omnichannel & Next Habit Step Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleShareParte()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-700 bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition-colors"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>Compartir parte diario</span>
          </button>

          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>¡Resumen copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-slate-600" aria-hidden="true" />
                <span>Copiar resumen</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {insight.nextAction && onNextAction && (
            <button
              type="button"
              onClick={() => onNextAction(insight.nextAction!)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-400 bg-amber-100 px-3.5 py-2 text-xs font-extrabold text-amber-950 hover:bg-amber-200 transition-colors"
            >
              <span>{insight.nextAction.label}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {onAnother && (
            <Button
              type="button"
              variant="secondary"
              onClick={onAnother}
              className="min-h-[44px]"
            >
              <Plus className="mr-1 h-4 w-4 inline" aria-hidden="true" />
              Registrar otro
            </Button>
          )}

          {onDismiss && (
            <Button type="button" onClick={onDismiss} className="min-h-[44px]">
              {doneLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

