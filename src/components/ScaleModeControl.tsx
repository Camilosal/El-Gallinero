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
      ? `inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
          isMediano
            ? "border-sky-300/60 bg-sky-500/20 text-white hover:bg-sky-500/30"
            : "border-emerald-300/50 bg-emerald-950/35 text-emerald-100 hover:bg-emerald-950/55"
        }`
      : `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
          isMediano
            ? "border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100"
            : "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
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
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
            variant === "hero"
              ? "bg-white/20 text-white"
              : isMediano
                ? "bg-sky-200/80 text-sky-950"
                : "bg-amber-200/90 text-amber-950"
          }`}
        >
          {unlockedCount}/5
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Selector de escala operativa"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 text-left text-slate-900"
        >
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Modo de operación de la granja
            </p>
            <p className="text-[11px] text-slate-500">
              Cambia al instante sin perder ni migrar datos.
            </p>
          </div>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentScale === "PEQUENO"}
            disabled={saving}
            onClick={() => void selectScale("PEQUENO")}
            className={`w-full rounded-lg p-2.5 text-left transition-colors mb-1 cursor-pointer border ${
              currentScale === "PEQUENO"
                ? "border-emerald-500 bg-emerald-50/80"
                : "border-transparent hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">
                Pequeño Productor (Esencial)
              </span>
              {currentScale === "PEQUENO" && (
                <Check className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
              Captura diaria rápida en Inicio, huevos sin matriz NTC 1240/PEPS, menú limpio sin auditorías, presupuestos ni IoT.
            </p>
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentScale === "MEDIANO"}
            disabled={saving}
            onClick={() => void selectScale("MEDIANO")}
            className={`w-full rounded-lg p-2.5 text-left transition-colors cursor-pointer border ${
              currentScale === "MEDIANO"
                ? "border-sky-500 bg-sky-50/80"
                : "border-transparent hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">
                Mediano / Tecnificado (9/9)
              </span>
              {currentScale === "MEDIANO" && (
                <Check className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
              )}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
              Habilita POE GAB ICA, calibres NTC 1240 PEPS, presupuestos DIAN, analítica/ROI, pedigrí 3G y telemetría IoT.
            </p>
          </button>

          <div className="mt-1.5 pt-1.5 border-t border-slate-100">
            <Link
              href="/dashboard/configuracion/modulos"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
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
