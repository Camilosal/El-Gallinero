"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, ChevronDown, ChevronUp, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import {
  pickAdaptiveNudge,
  recordNudgeFeedback,
  resolvePageNudgeGroup,
  type AdaptiveNudgeResult,
  type NudgeFeedbackOutcome,
  type NudgeTone,
} from "@/lib/behavioral-nudges";
import { openQuickCapture } from "@/lib/quick-capture-events";
import { useOnboardingState } from "@/lib/useOnboardingState";

const TONE_CLASSES: Record<
  NudgeTone,
  { container: string; pill: string; principle: string; action: string; icon: string }
> = {
  emerald: {
    container: "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-text-primary)]",
    pill: "bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]",
    principle: "bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-action-primary)] border border-[var(--iw-semantic-border-default)]",
    action: "bg-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-action-primary-hover)] text-[var(--iw-semantic-action-primary-text)]",
    icon: "text-[var(--iw-semantic-action-primary)]",
  },
  amber: {
    container: "border-[var(--iw-color-ochre)]/45 bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-primary)]",
    pill: "bg-[var(--iw-semantic-status-warning)] text-[var(--iw-color-white)]",
    principle: "bg-[var(--iw-semantic-bg-page)] text-[var(--iw-semantic-text-primary)] border border-[var(--iw-color-ochre)]/45",
    action: "bg-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-action-primary-hover)] text-[var(--iw-semantic-action-primary-text)]",
    icon: "text-[var(--iw-semantic-status-warning)]",
  },
  sky: {
    container: "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-primary)]",
    pill: "bg-[var(--iw-semantic-status-info)] text-[var(--iw-color-white)]",
    principle: "bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-status-info)] border border-[var(--iw-semantic-border-default)]",
    action: "bg-[var(--iw-semantic-status-info)] hover:opacity-90 text-[var(--iw-color-white)]",
    icon: "text-[var(--iw-semantic-status-info)]",
  },
  slate: {
    container: "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-primary)]",
    pill: "bg-[var(--iw-semantic-text-primary)] text-[var(--iw-color-white)]",
    principle: "bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-secondary)] border border-[var(--iw-semantic-border-default)]",
    action: "bg-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-action-primary-hover)] text-[var(--iw-semantic-action-primary-text)]",
    icon: "text-[var(--iw-semantic-text-secondary)]",
  },
};

const RECENT_ROTATIONS = new Map<string, { at: number; result: AdaptiveNudgeResult }>();

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export interface BehavioralNudgeBannerProps {
  compact?: boolean;
  className?: string;
}

export default function BehavioralNudgeBanner({
  compact = false,
  className,
}: BehavioralNudgeBannerProps = {}) {
  const pathname = usePathname() || "/inicio";
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  const { config: onboardingConfig } = useOnboardingState();
  const purposesKey = (onboardingConfig?.purposes ?? []).join(",");
  const primaryPurpose = onboardingConfig?.primaryPurpose ?? null;
  const speciesKey = (onboardingConfig?.selectedSpecies ?? []).join(",");

  const group = useMemo(() => resolvePageNudgeGroup(pathname, query), [pathname, query]);
  const pageKey = useMemo(() => {
    const cleanPath = pathname.split("?")[0].replace(/\/+$/, "") || "/inicio";
    const tab = searchParams.get("tab") || "";
    const subtab = searchParams.get("subtab") || "";
    return `${group.key}:${cleanPath}${tab ? `?tab=${tab}` : ""}${subtab ? `&subtab=${subtab}` : ""}`;
  }, [group.key, pathname, searchParams]);

  const [state, setState] = useState<{
    pageKey: string;
    picked: AdaptiveNudgeResult;
  } | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const now = Date.now();
      const cacheKey = `${pageKey}:${purposesKey}:${primaryPurpose || ""}:${speciesKey}`;
      const recent = RECENT_ROTATIONS.get(cacheKey);
      let picked: AdaptiveNudgeResult;
      if (recent && now - recent.at < 180) {
        picked = recent.result;
      } else {
        const storage = safeStorage();
        const purposes = purposesKey
          ? (purposesKey.split(",").filter(Boolean) as NonNullable<typeof onboardingConfig>["purposes"])
          : undefined;
        const activeSpecies = speciesKey ? speciesKey.split(",").filter(Boolean) : undefined;
        picked = pickAdaptiveNudge(pageKey, group.nudges, storage, {
          advance: true,
          nowMs: now,
          purposes,
          primaryPurpose,
          activeSpecies,
        });
        recordNudgeFeedback(picked.nudge.id, "shown", storage, now);
        RECENT_ROTATIONS.set(cacheKey, { at: now, result: picked });
      }
      setMinimized(false);
      setState({ pageKey, picked });
    });
    return () => {
      active = false;
    };
  }, [group.nudges, pageKey, purposesKey, primaryPurpose, speciesKey]);

  const activePicked: AdaptiveNudgeResult =
    state && state.pageKey === pageKey
      ? state.picked
      : {
          index: 0,
          total: group.nudges.length,
          nudge: group.nudges[0],
          prioritizedByHistory: false,
          utilityScore: 0.5,
        };

  const { nudge, index, total, prioritizedByHistory } = activePicked;
  const tone = TONE_CLASSES[nudge.tone] ?? TONE_CLASSES.emerald;

  const trackOutcome = (outcome: NudgeFeedbackOutcome) => {
    recordNudgeFeedback(nudge.id, outcome, safeStorage());
  };

  const handleManualNext = () => {
    const storage = safeStorage();
    const now = Date.now();
    const cacheKey = `${pageKey}:${purposesKey}:${primaryPurpose || ""}:${speciesKey}`;
    const purposes = purposesKey
      ? (purposesKey.split(",").filter(Boolean) as NonNullable<typeof onboardingConfig>["purposes"])
      : undefined;
    const activeSpecies = speciesKey ? speciesKey.split(",").filter(Boolean) : undefined;
    recordNudgeFeedback(nudge.id, "skipped", storage, now);
    const next = pickAdaptiveNudge(pageKey, group.nudges, storage, {
      advance: true,
      nowMs: now,
      purposes,
      primaryPurpose,
      activeSpecies,
    });
    recordNudgeFeedback(next.nudge.id, "shown", storage, now);
    RECENT_ROTATIONS.set(cacheKey, { at: now, result: next });
    setState({ pageKey, picked: next });
  };

  const handleToggleMinimize = () => {
    if (!minimized) {
      trackOutcome("dismissed");
    }
    setMinimized((prev) => !prev);
  };

  if (!state || state.pageKey !== pageKey) {
    return (
      <div
        aria-hidden="true"
        className={`${className ?? "mb-4"} ${compact ? "h-full min-h-[104px]" : "h-12"} rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] animate-pulse`}
      />
    );
  }

  return (
    <aside
      aria-label={`Recordatorio conductual de ${group.label}`}
      data-nudge-group={group.key}
      data-nudge-id={nudge.id}
      className={`${className ?? "mb-4"} rounded-[var(--iw-radius-control)] border px-3.5 py-2.5 shadow-xs transition-colors ${compact ? "flex flex-col justify-between gap-2.5 h-full" : ""} ${tone.container}`}
    >
      <div className={compact ? "flex flex-col justify-between gap-2.5 h-full" : "flex flex-wrap items-center justify-between gap-2"}>
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <div className={`mt-0.5 sm:mt-0 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] border border-[var(--iw-semantic-border-default)] ${tone.icon}`}>
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.pill}`}>
                {group.label}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.principle}`}>
                {nudge.principle}
              </span>
              {prioritizedByHistory && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--iw-semantic-action-primary)]">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                  <span>Priorizado por tu uso</span>
                </span>
              )}
              <span className="text-[10px] font-mono text-[var(--iw-semantic-text-secondary)] tabular-nums">
                Nudge {index + 1}/{total}
              </span>
            </div>
            {!minimized && (
              <p className="text-xs sm:text-[13px] font-medium text-[var(--iw-semantic-text-primary)] leading-snug">
                {nudge.message}
              </p>
            )}
          </div>
        </div>

        <div className={`flex flex-wrap items-center gap-1.5 shrink-0 ${compact ? "pt-1 border-t border-[var(--iw-semantic-border-default)] justify-end" : ""}`}>
          {!minimized && nudge.actionLabel && nudge.quickCaptureMode && (
            <button
              type="button"
              onClick={() => {
                trackOutcome("acted");
                openQuickCapture({ mode: nudge.quickCaptureMode! });
              }}
              className={`inline-flex items-center gap-1 rounded-[var(--iw-radius-control)] px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${tone.action}`}
            >
              <span>{nudge.actionLabel}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          {!minimized && nudge.actionLabel && nudge.actionHref && (
            <Link
              href={nudge.actionHref}
              onClick={() => trackOutcome("acted")}
              className={`inline-flex items-center gap-1 rounded-[var(--iw-radius-control)] px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${tone.action}`}
            >
              <span>{nudge.actionLabel}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
          {!minimized && activePicked.appGuideHref && activePicked.appGuideHref !== nudge.actionHref && (
            <Link
              href={activePicked.appGuideHref}
              onClick={() => trackOutcome("acted")}
              title="Ver guía de uso de esta función en /guia"
              className="inline-flex items-center gap-1 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2 py-1.5 text-[11px] font-medium text-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-bg-subtle)] transition-colors"
            >
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              <span>Cómo usar en app</span>
            </Link>
          )}
          <button
            type="button"
            onClick={handleManualNext}
            title="Ver siguiente consejo conductual"
            className="inline-flex items-center gap-1 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-2 py-1.5 text-[11px] font-medium text-[var(--iw-semantic-text-primary)] hover:bg-[var(--iw-semantic-bg-subtle)] transition-colors"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Otro</span>
          </button>
          <button
            type="button"
            onClick={handleToggleMinimize}
            title={minimized ? "Mostrar mensaje conductual" : "Minimizar temporalmente"}
            aria-label={minimized ? "Mostrar mensaje conductual" : "Minimizar mensaje conductual"}
            className="inline-flex items-center justify-center rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-1.5 text-[var(--iw-semantic-text-secondary)] hover:bg-[var(--iw-semantic-bg-subtle)] transition-colors"
          >
            {minimized ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
