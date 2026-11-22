"use client";

import { AlertTriangle, CheckCircle2, HelpCircle, ShieldAlert } from "lucide-react";
import type { DietValidationResult, NutritionMetricCheck } from "@/lib/feeding/nutrition-validator";

const STATUS_BADGE: Record<
  DietValidationResult["status"],
  { label: string; badgeClass: string; borderClass: string }
> = {
  cumple: {
    label: "Cumple requerimientos",
    badgeClass:
      "bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-status-success)] border-[var(--iw-semantic-status-success)]/35",
    borderClass: "border-[var(--iw-semantic-status-success)]/35 bg-[var(--iw-semantic-bg-feature)]/45",
  },
  advertencia: {
    label: "Revisar observaciones",
    badgeClass:
      "bg-[var(--iw-color-paper)] text-[var(--iw-semantic-status-warning)] border-[var(--iw-semantic-status-warning)]/40",
    borderClass: "border-[var(--iw-semantic-status-warning)]/35 bg-[var(--iw-color-paper)]/65",
  },
  rechazado: {
    label: "Incumple / Riesgo",
    badgeClass:
      "bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-status-danger)] border-[var(--iw-semantic-status-danger)]/45",
    borderClass: "border-[var(--iw-semantic-status-danger)]/45 bg-[var(--iw-semantic-bg-surface)]",
  },
};

function CheckIcon({ status }: { status: NutritionMetricCheck["status"] }) {
  if (status === "ok") {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-status-success)]" aria-hidden="true" />;
  }
  if (status === "error") {
    return <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-status-danger)]" aria-hidden="true" />;
  }
  if (status === "warning") {
    return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-status-warning)]" aria-hidden="true" />;
  }
  return <HelpCircle className="h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />;
}

export function DietValidationSummary({
  validation,
  compact = false,
  onAddRecommendedFeed,
}: {
  validation: DietValidationResult;
  compact?: boolean;
  onAddRecommendedFeed?: (feedId: string, suggestedGrams?: number) => void;
}) {
  const theme = STATUS_BADGE[validation.status];

  return (
    <div className={`mt-3 rounded-[var(--iw-radius-control)] border p-3 ${theme.borderClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${theme.badgeClass}`}
          >
            {theme.label}
          </span>
          <span className="text-xs font-semibold text-[var(--iw-semantic-text-primary)]">
            {validation.headline}
          </span>
        </div>
        <span className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
          Ref: {validation.requirement.stageLabel} · {validation.requirement.source}
        </span>
      </div>

      {validation.sanitaryAlerts.length > 0 && (
        <div className="mt-2 space-y-1">
          {validation.sanitaryAlerts.map((alert, idx) => (
            <p
              key={`${alert.feedName}-${idx}`}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                alert.status === "NO USAR"
                  ? "border-[var(--iw-semantic-status-danger)]/40 bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-status-danger)]"
                  : "border-[var(--iw-semantic-status-warning)]/35 bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-status-warning)]"
              }`}
            >
              <strong>{alert.status}:</strong> {alert.feedName}
              {alert.standardCatalogId ? ` (${alert.standardCatalogId})` : ""} — {alert.message}
            </p>
          ))}
        </div>
      )}

      <div className={`mt-2.5 grid gap-2 ${compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {validation.checks.map((check) => (
          <div
            key={check.metric}
            className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2.5 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--iw-semantic-text-primary)]">
                <CheckIcon status={check.status} />
                <span>{check.label}</span>
              </span>
              <span className="text-[11px] font-bold text-[var(--iw-semantic-text-primary)] tabular-nums">
                {check.actualLabel}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--iw-semantic-text-secondary)] tabular-nums">
              Meta: {check.targetLabel}
            </p>
            {check.status !== "ok" && (
              <p className="mt-1 text-[11px] leading-snug text-[var(--iw-semantic-text-secondary)]">
                {check.message}
              </p>
            )}
          </div>
        ))}
      </div>

      {validation.requirement.speciesNotes && (
        <p className="mt-2 text-[11px] text-[var(--iw-semantic-text-secondary)]">
          <strong>Nota técnica:</strong> {validation.requirement.speciesNotes}
        </p>
      )}

      {validation.recommendations && validation.recommendations.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-[var(--iw-semantic-border-default)] pt-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--iw-semantic-text-primary)]">
            Recomendaciones, condiciones y sustitutos para cumplir
          </p>
          <div className="space-y-2">
            {validation.recommendations.map((rec) => (
              <div
                key={rec.id}
                className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--iw-semantic-text-primary)]">
                    {rec.title}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      rec.priority === "alta"
                        ? "border-[var(--iw-semantic-status-danger)]/35 text-[var(--iw-semantic-status-danger)] bg-[var(--iw-semantic-bg-subtle)]"
                        : "border-[var(--iw-semantic-status-warning)]/35 text-[var(--iw-semantic-status-warning)] bg-[var(--iw-color-paper)]"
                    }`}
                  >
                    Prioridad {rec.priority}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[var(--iw-semantic-text-secondary)]">
                  {rec.detail}
                </p>
                {rec.candidates.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {rec.candidates.map((cand, idx) => (
                      <li
                        key={`${rec.id}-${cand.standardCatalogId || cand.feedId || idx}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-[var(--iw-semantic-text-primary)]">
                            {cand.name}
                          </span>
                          {cand.standardCatalogId && (
                            <span className="ml-1.5 font-mono text-[10px] text-[var(--iw-semantic-text-secondary)]">
                              ({cand.standardCatalogId})
                            </span>
                          )}
                          <p className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
                            {cand.reason}
                            {cand.condition ? ` · Condición: ${cand.condition}` : ""}
                          </p>
                        </div>
                        {onAddRecommendedFeed && cand.source === "inventory" && cand.feedId && (
                          <button
                            type="button"
                            onClick={() => onAddRecommendedFeed(cand.feedId!, cand.suggestedGrams)}
                            className="shrink-0 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-action-primary)] bg-[var(--iw-semantic-action-primary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--iw-semantic-action-primary-text)] hover:bg-[var(--iw-semantic-action-primary-hover)]"
                          >
                            + Agregar{cand.suggestedGrams ? ` (${cand.suggestedGrams}g)` : ""}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
