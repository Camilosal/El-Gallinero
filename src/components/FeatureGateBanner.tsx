"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Lock, Sparkles, Unlock } from "lucide-react";
import { FEATURE_FLAG_BY_KEY, type ProgressiveUnlockableFlagKey } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/useOnboardingState";
import { useState } from "react";

interface FeatureGateBannerProps {
  flagKey: ProgressiveUnlockableFlagKey;
  children?: ReactNode;
  /** En modo "banner", siempre renderiza `children` debajo; en "gate", sustituye `children` hasta desbloquear. */
  mode?: "gate" | "banner";
  customHint?: string;
}

export default function FeatureGateBanner({
  flagKey,
  children,
  mode = "banner",
  customHint,
}: FeatureGateBannerProps) {
  const { state, isFlagEnabled, patchOnboarding } = useOnboardingState();
  const [unlocking, setUnlocking] = useState(false);

  const enabled = isFlagEnabled(flagKey);
  if (enabled) {
    return <>{children}</>;
  }

  const def = FEATURE_FLAG_BY_KEY[flagKey];
  const progress = state?.evaluation.progress.find((p) => p.key === flagKey);

  const handleUnlockNow = async () => {
    setUnlocking(true);
    try {
      await patchOnboarding({
        toggleFlag: {
          key: flagKey,
          enabled: true,
          reason: `Activado directamente desde vista ${def.name}`,
        },
      });
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <>
      <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 max-w-2xl">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-900">
              <Lock className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
              <span>Módulo Progresivo en Espera ({state?.config.scale === "PEQUENO" ? "Modo Pequeño Productor" : "Opcional"})</span>
            </p>
            <h3 className="text-sm font-bold text-slate-900">{def.name}</h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              {customHint || def.description}
            </p>
            {progress && (
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-950 bg-white/80 border border-amber-200 rounded-lg px-2.5 py-1 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                <span>
                  Auto-activación: {progress.currentValue} / {progress.threshold} {progress.unitLabel} ({progress.percent}%)
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUnlockNow}
              disabled={unlocking}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50"
            >
              <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{unlocking ? "Activando..." : "Activar módulo ahora"}</span>
            </button>
            <Link
              href="/dashboard/configuracion/modulos"
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Configurar escala
            </Link>
          </div>
        </div>
      </div>
      {mode === "banner" ? children : null}
    </>
  );
}

