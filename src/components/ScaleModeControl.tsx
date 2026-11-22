"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Layers, SlidersHorizontal } from "lucide-react";
import { PROGRESSIVE_UNLOCKABLE_KEYS, type ProducerScale } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/useOnboardingState";

interface ScaleModeControlProps {
  variant?: "topbar" | "hero";
}

export function ScaleModeControl({ variant = "topbar" }: ScaleModeControlProps) {
  const { config, flags, patchOnboarding } = useOnboardingState();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!config || !flags) return null;

  const currentScale: ProducerScale = config.scale;
  const isMediano = currentScale === "MEDIANO";
  const unlockedCount = PROGRESSIVE_UNLOCKABLE_KEYS.filter((k) => flags[k]).length;

  const selectScale = async (nextScale: ProducerScale) => {
    if (nextScale === currentScale || saving) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await patchOnboarding({ scale: nextScale });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const buttonClass =
    variant === "hero"
      ? `inline-flex min-h-[42px] items-center gap-1.5 rounded-[var(--iw-radius-control)] border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
          isMediano
            ? "border-white/30 bg-white/15 text-white hover:bg-white/25"
            : "border-[var(--iw-color-sage)]/45 bg-[var(--iw-color-forest-dark)]/70 text-[var(--iw-color-paper)] hover:bg-[var(--iw-color-forest-dark)]/90"
        }`
      : `inline-flex h-10 min-h-[40px] items-center gap-1.5 rounded-[var(--iw-radius-control)] border px-3 py-0 text-xs sm:text-sm font-semibold shadow-xs transition-colors shrink-0 cursor-pointer ${
          isMediano
            ? "border-[var(--iw-semantic-status-info)]/40 bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-status-info)] hover:bg-[var(--iw-semantic-bg-feature)]"
            : "border-[var(--iw-semantic-status-warning)]/40 bg-[var(--iw-color-paper)] text-[var(--iw-semantic-status-warning)] hover:bg-[var(--iw-semantic-bg-subtle)]"
        }`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cambiar entre Modo Pequeño (vista esencial) y Modo Mediano (control total)"
        className={buttonClass}
      >
        <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">
          {isMediano ? "Mediano" : "Pequeño"}
        </span>
        <span className="sm:hidden">{isMediano ? "M" : "P"}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
            variant === "hero"
              ? "bg-white/20 text-white"
              : isMediano
                ? "bg-[var(--iw-semantic-status-info)]/15 text-[var(--iw-semantic-status-info)]"
                : "bg-[var(--iw-semantic-status-warning)]/15 text-[var(--iw-semantic-status-warning)]"
          }`}
        >
          {unlockedCount}/5
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Selector de escala operativa"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-2 shadow-[var(--iw-shadow-popover)] z-50 text-left text-[var(--iw-semantic-text-primary)]"
        >
          <div className="px-2.5 py-1.5 border-b border-[var(--iw-semantic-border-default)] mb-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--iw-semantic-text-secondary)]">
              Modo de operación de la granja
            </p>
            <p className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
              Cambia al instante sin perder ni migrar datos.
            </p>
          </div>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentScale === "PEQUENO"}
            disabled={saving}
            onClick={() => void selectScale("PEQUENO")}
            className={`w-full rounded-[var(--iw-radius-control)] p-2.5 text-left transition-colors mb-1 cursor-pointer border ${
              currentScale === "PEQUENO"
                ? "border-[var(--iw-semantic-border-strong)] bg-[var(--iw-semantic-bg-feature)]"
                : "border-transparent hover:bg-[var(--iw-semantic-bg-subtle)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--iw-semantic-text-primary)]">
                Pequeño Productor (Esencial)
              </span>
              {currentScale === "PEQUENO" && (
                <Check className="w-4 h-4 text-[var(--iw-semantic-action-primary)] shrink-0" aria-hidden="true" />
              )}
            </div>
            <p className="text-[11px] text-[var(--iw-semantic-text-secondary)] mt-0.5 leading-snug">
              Captura diaria rápida en Inicio, huevos sin matriz NTC 1240/PEPS, menú limpio sin auditorías, presupuestos ni IoT.
            </p>
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentScale === "MEDIANO"}
            disabled={saving}
            onClick={() => void selectScale("MEDIANO")}
            className={`w-full rounded-[var(--iw-radius-control)] p-2.5 text-left transition-colors cursor-pointer border ${
              currentScale === "MEDIANO"
                ? "border-[var(--iw-semantic-status-info)] bg-[var(--iw-semantic-bg-subtle)]"
                : "border-transparent hover:bg-[var(--iw-semantic-bg-subtle)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--iw-semantic-text-primary)]">
                Mediano / Tecnificado (9/9)
              </span>
              {currentScale === "MEDIANO" && (
                <Check className="w-4 h-4 text-[var(--iw-semantic-status-info)] shrink-0" aria-hidden="true" />
              )}
            </div>
            <p className="text-[11px] text-[var(--iw-semantic-text-secondary)] mt-0.5 leading-snug">
              Habilita POE GAB ICA, calibres NTC 1240 PEPS, presupuestos DIAN, analítica/ROI, pedigrí 3G y telemetría IoT.
            </p>
          </button>

          <div className="mt-1.5 pt-1.5 border-t border-[var(--iw-semantic-border-default)]">
            <Link
              href="/configuracion/modulos"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-[var(--iw-radius-control)] px-2.5 py-2 text-xs font-semibold text-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-bg-feature)]"
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Personalizar módulos por separado</span>
              </span>
              <span>→</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
