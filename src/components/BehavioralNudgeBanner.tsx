"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, ChevronUp, Lightbulb, RefreshCw } from "lucide-react";
import {
  pickNextRotatingNudge,
  resolvePageNudgeGroup,
  type NudgeTone,
  type PickedNudgeResult,
} from "@/lib/behavioral-nudges";
import { openQuickCapture } from "@/lib/quick-capture-events";

const TONE_CLASSES: Record<
  NudgeTone,
  { container: string; pill: string; principle: string; action: string; icon: string }
> = {
  emerald: {
    container: "border-emerald-200 bg-gradient-to-r from-emerald-50/95 via-white to-teal-50/70 text-slate-900",
    pill: "bg-emerald-800 text-white",
    principle: "bg-emerald-100 text-emerald-900 border border-emerald-300",
    action: "bg-emerald-700 hover:bg-emerald-800 text-white",
    icon: "text-emerald-700",
  },
  amber: {
    container: "border-amber-300 bg-gradient-to-r from-amber-50/95 via-white to-orange-50/70 text-slate-900",
    pill: "bg-amber-900 text-white",
    principle: "bg-amber-100 text-amber-950 border border-amber-300",
    action: "bg-amber-800 hover:bg-amber-900 text-white",
    icon: "text-amber-700",
  },
  sky: {
    container: "border-sky-200 bg-gradient-to-r from-sky-50/95 via-white to-cyan-50/70 text-slate-900",
    pill: "bg-sky-900 text-white",
    principle: "bg-sky-100 text-sky-950 border border-sky-300",
    action: "bg-sky-800 hover:bg-sky-900 text-white",
    icon: "text-sky-700",
  },
  slate: {
    container: "border-slate-300 bg-gradient-to-r from-slate-50 via-white to-stone-50 text-slate-900",
    pill: "bg-slate-800 text-white",
    principle: "bg-slate-200/80 text-slate-800 border border-slate-300",
    action: "bg-slate-800 hover:bg-slate-900 text-white",
    icon: "text-slate-700",
  },
};

const RECENT_ROTATIONS = new Map<string, { at: number; result: PickedNudgeResult }>();

export default function BehavioralNudgeBanner() {
  const pathname = usePathname() || "/dashboard";
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  const group = useMemo(() => resolvePageNudgeGroup(pathname, query), [pathname, query]);
  const pageKey = useMemo(() => {
    const cleanPath = pathname.split("?")[0].replace(/\/+$/, "") || "/dashboard";
    const tab = searchParams.get("tab") || "";
    const subtab = searchParams.get("subtab") || "";
    return `${group.key}:${cleanPath}${tab ? `?tab=${tab}` : ""}${subtab ? `&subtab=${subtab}` : ""}`;
  }, [group.key, pathname, searchParams]);

  const [state, setState] = useState<{
    pageKey: string;
    picked: PickedNudgeResult;
  } | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      const now = Date.now();
      const recent = RECENT_ROTATIONS.get(pageKey);
      let picked: PickedNudgeResult;
      if (recent && now - recent.at < 180) {
        picked = recent.result;
      } else {
        let storage: Storage | null = null;
        try {
          storage = window.localStorage;
        } catch {
          storage = null;
        }
        picked = pickNextRotatingNudge(pageKey, group.nudges, storage, { advance: true });
        RECENT_ROTATIONS.set(pageKey, { at: now, result: picked });
      }
      setMinimized(false);
      setState({ pageKey, picked });
    });
    return () => {
      active = false;
    };
  }, [group.nudges, pageKey]);

  const activePicked =
    state && state.pageKey === pageKey
      ? state.picked
      : { index: 0, total: group.nudges.length, nudge: group.nudges[0] };

  const { nudge, index, total } = activePicked;
  const tone = TONE_CLASSES[nudge.tone] ?? TONE_CLASSES.emerald;

  const handleManualNext = () => {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    const next = pickNextRotatingNudge(pageKey, group.nudges, storage, { advance: true });
    RECENT_ROTATIONS.set(pageKey, { at: Date.now(), result: next });
    setState({ pageKey, picked: next });
  };

  if (!state || state.pageKey !== pageKey) {
    return (
      <div
        aria-hidden="true"
        className="mb-4 h-12 rounded-xl border border-slate-200/70 bg-slate-50/70 animate-pulse"
      />
    );
  }

  return (
    <aside
      aria-label={`Recordatorio conductual de ${group.label}`}
      data-nudge-group={group.key}
      data-nudge-id={nudge.id}
      className={`mb-4 rounded-xl border px-3.5 py-2.5 shadow-2xs transition-colors ${tone.container}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
          <div className={`mt-0.5 sm:mt-0 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/90 border border-slate-200 ${tone.icon}`}>
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
              <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                Nudge {index + 1}/{total}
              </span>
            </div>
            {!minimized && (
              <p className="text-xs sm:text-[13px] font-medium text-slate-800 leading-snug">
                {nudge.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {!minimized && nudge.actionLabel && nudge.quickCaptureMode && (
            <button
              type="button"
              onClick={() => openQuickCapture({ mode: nudge.quickCaptureMode! })}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${tone.action}`}
            >
              <span>{nudge.actionLabel}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          {!minimized && nudge.actionLabel && nudge.actionHref && (
            <Link
              href={nudge.actionHref}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${tone.action}`}
            >
              <span>{nudge.actionLabel}</span>
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            onClick={handleManualNext}
            title="Ver siguiente consejo conductual"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Otro</span>
          </button>
          <button
            type="button"
            onClick={() => setMinimized((prev) => !prev)}
            title={minimized ? "Mostrar mensaje conductual" : "Minimizar temporalmente"}
            aria-label={minimized ? "Mostrar mensaje conductual" : "Minimizar mensaje conductual"}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
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
