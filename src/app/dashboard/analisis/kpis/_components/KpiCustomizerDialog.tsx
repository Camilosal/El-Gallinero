"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pin, RotateCcw, X } from "lucide-react";
import {
  KPI_PRESETS,
  KPI_WIDGET_CATALOG,
  MAX_PINNED_KPI_WIDGETS,
  buildPresetConfig,
  normalizeKpiDashboardConfig,
  type KpiDashboardConfig,
  type KpiPresetId,
  type KpiResolvedPresetId,
  type KpiWidgetId,
} from "@/lib/kpi-dashboard";

interface KpiCustomizerDialogProps {
  open: boolean;
  onClose: () => void;
  config: KpiDashboardConfig;
  recommendedPreset: KpiResolvedPresetId;
  canSeedFarmDefault: boolean;
  saving: boolean;
  onSave: (nextConfig: KpiDashboardConfig, seedFarmDefault: boolean) => Promise<void>;
}

const PRESET_ORDER: KpiPresetId[] = ["auto", "postura", "engorde", "gerencial", "custom"];

export function KpiCustomizerDialog({
  open,
  onClose,
  config,
  recommendedPreset,
  canSeedFarmDefault,
  saving,
  onSave,
}: KpiCustomizerDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<KpiDashboardConfig>(config);
  const [seedFarmDefault, setSeedFarmDefault] = useState(false);

  // Sync modal open/close state with native <dialog>.showModal() / .close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      void Promise.resolve().then(() => {
        setDraft(normalizeKpiDashboardConfig(config, recommendedPreset));
        setSeedFarmDefault(false);
      });
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, config, recommendedPreset]);

  // Light-dismiss fallback for browsers without <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof HTMLDialogElement === "undefined") return;
    if ("closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    const handlePointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e) && dialog.open) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", handlePointerDown);
    dialog.addEventListener("pointerup", handlePointerUp);
    return () => {
      dialog.removeEventListener("pointerdown", handlePointerDown);
      dialog.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const pinnedCount = draft.widgets.filter((w) => w.pinnedToHome).length;
  const visibleCount = draft.widgets.filter((w) => w.visible).length;

  function applyPresetToDraft(presetId: KpiPresetId) {
    if (presetId === "custom") {
      setDraft((prev) => ({ ...prev, preset: "custom" }));
      return;
    }
    setDraft(buildPresetConfig(presetId, recommendedPreset));
  }

  function updateWidget(
    id: KpiWidgetId,
    updater: (current: KpiDashboardConfig["widgets"][number]) => KpiDashboardConfig["widgets"][number]
  ) {
    setDraft((prev) => {
      const updated = prev.widgets.map((w) => (w.id === id ? updater(w) : w));
      return normalizeKpiDashboardConfig({ ...prev, preset: "custom", widgets: updated }, recommendedPreset);
    });
  }

  function moveWidget(index: number, delta: -1 | 1) {
    setDraft((prev) => {
      const targetIndex = index + delta;
      if (targetIndex < 0 || targetIndex >= prev.widgets.length) return prev;
      const copy = [...prev.widgets];
      const [item] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      const reordered = copy.map((w, idx) => ({ ...w, order: idx }));
      return normalizeKpiDashboardConfig(
        { ...prev, preset: "custom", widgets: reordered },
        recommendedPreset
      );
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSave(draft, seedFarmDefault);
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className="kpi-customizer-dialog"
      aria-labelledby={titleId}
      onClose={() => {
        if (dialogRef.current) {
          dialogRef.current.returnValue = "";
        }
        onClose();
      }}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[min(90vh,52rem)]">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-slate-900">
              Personalizar tablero de KPIs
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Elige un enfoque predefinido o ajusta qué indicadores ves, su orden, tamaño y metas propias.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar personalizador"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Presets */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Modo del tablero
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {PRESET_ORDER.map((presetId, idx) => {
                const preset = KPI_PRESETS[presetId];
                const isSelected = draft.preset === presetId;
                return (
                  <button
                    key={presetId}
                    type="button"
                    autoFocus={idx === 0}
                    onClick={() => applyPresetToDraft(presetId)}
                    className={`text-left rounded-lg border p-2.5 transition-colors ${
                      isSelected
                        ? "border-green-600 bg-green-50/70 ring-1 ring-green-600"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold text-slate-800">{preset.label}</span>
                      {presetId === "auto" && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {KPI_PRESETS[recommendedPreset].label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span>
              Visibles: <strong>{visibleCount}</strong> de {draft.widgets.length} widgets · Fijados:{" "}
              <strong>
                {pinnedCount}/{MAX_PINNED_KPI_WIDGETS}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setDraft(buildPresetConfig("auto", recommendedPreset))}
              className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-green-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer automático
            </button>
          </div>

          {/* Widgets list */}
          <div className="space-y-2">
            {draft.widgets.map((widget, index) => {
              const catalog = KPI_WIDGET_CATALOG[widget.id];
              const canPinMore = widget.pinnedToHome || pinnedCount < MAX_PINNED_KPI_WIDGETS;
              return (
                <div
                  key={widget.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    widget.visible ? "border-slate-200 bg-white" : "border-slate-200/70 bg-slate-50/70 opacity-75"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={widget.visible}
                        onChange={(e) =>
                          updateWidget(widget.id, (cur) => ({ ...cur, visible: e.target.checked }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{catalog.shortTitle}</span>
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                            {catalog.kind === "chart" ? "Gráfico" : catalog.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{catalog.description}</p>
                      </div>
                    </label>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {catalog.supportsCustomTarget && (
                        <div className="flex items-center gap-1">
                          <label htmlFor={`target-${widget.id}`} className="text-[11px] text-slate-500">
                            Meta:
                          </label>
                          <input
                            id={`target-${widget.id}`}
                            type="number"
                            step="any"
                            value={widget.customTarget ?? ""}
                            placeholder={
                              catalog.defaultTarget !== null ? String(catalog.defaultTarget) : "Auto"
                            }
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              const num = raw === "" ? null : Number(raw);
                              updateWidget(widget.id, (cur) => ({
                                ...cur,
                                customTarget: num !== null && Number.isFinite(num) ? num : null,
                              }));
                            }}
                            className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          updateWidget(widget.id, (cur) => ({
                            ...cur,
                            size: cur.size === "wide" ? "compact" : "wide",
                          }))
                        }
                        className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                          widget.size === "wide"
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {widget.size === "wide" ? "Ancho 2 col" : "Compacto"}
                      </button>

                      {catalog.supportsPinToHome && (
                        <button
                          type="button"
                          disabled={!canPinMore}
                          onClick={() =>
                            updateWidget(widget.id, (cur) => ({
                              ...cur,
                              pinnedToHome: !cur.pinnedToHome,
                            }))
                          }
                          title={
                            canPinMore
                              ? "Fijar entre tus KPIs principales (máx. 4)"
                              : "Ya tienes 4 KPIs fijados"
                          }
                          className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors disabled:opacity-40 ${
                            widget.pinnedToHome
                              ? "border-green-300 bg-green-50 text-green-700"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          <Pin className="w-3 h-3" />
                          {widget.pinnedToHome ? "Fijado" : "Fijar"}
                        </button>
                      )}

                      <div className="inline-flex items-center rounded border border-slate-200 overflow-hidden">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveWidget(index, -1)}
                          aria-label={`Subir ${catalog.shortTitle}`}
                          className="p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === draft.widgets.length - 1}
                          onClick={() => moveWidget(index, 1)}
                          aria-label={`Bajar ${catalog.shortTitle}`}
                          className="p-1 text-slate-500 hover:bg-slate-100 border-l border-slate-200 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {canSeedFarmDefault ? (
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={seedFarmDefault}
                onChange={(e) => setSeedFarmDefault(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
              Guardar también como vista predeterminada de toda la granja
            </label>
          ) : (
            <span className="text-xs text-slate-500">
              Tus cambios aplican solo a tu usuario en esta granja.
            </span>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar tablero"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
