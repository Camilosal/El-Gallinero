"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Layers,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { PageHeader, Select } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import {
  KPI_PRESETS,
  KPI_SPECIES_OPTIONS,
  KPI_WIDGET_CATALOG,
  buildPresetConfig,
  normalizeKpiDashboardConfig,
  type KpiDashboardConfig,
  type KpiDashboardData,
  type KpiPresetId,
  type KpiResolvedPresetId,
  type KpiWidgetId,
} from "@/lib/kpi-dashboard";
import { KpiWidgetCard } from "./_components/KpiWidgetCard";
import { KpiCustomizerDialog } from "./_components/KpiCustomizerDialog";

const LOCAL_STORAGE_KEY = "galli_kpi_dashboard_config_v1";
const PRESET_TABS: KpiPresetId[] = ["auto", "postura", "engorde", "gerencial", "custom"];

function readLocalCachedConfig(recommended: KpiResolvedPresetId): KpiDashboardConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return normalizeKpiDashboardConfig(JSON.parse(raw), recommended);
  } catch {
    return null;
  }
}

function writeLocalCachedConfig(config: KpiDashboardConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export default function KpisPage() {
  const [period, setPeriod] = useState("30");
  const [species, setSpecies] = useState("");
  const [locationId, setLocationId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [search, setSearch] = useState("");

  const [data, setData] = useState<KpiDashboardData | null>(null);
  const [config, setConfig] = useState<KpiDashboardConfig>(() => buildPresetConfig("auto", "gerencial"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [canSeedFarmDefault, setCanSeedFarmDefault] = useState(false);

  const recommendedPreset: KpiResolvedPresetId =
    data?.customConfig?.recommendedPreset || data?.farmContext?.recommendedPreset || "gerencial";

  const loadKpis = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ period });
      if (species) qs.set("species", species);
      if (locationId) qs.set("locationId", locationId);
      if (batchId) qs.set("batchId", batchId);

      const res = await fetch(`/api/analisis/kpis?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "No se pudieron cargar los KPIs.");
      }
      const payload = (await res.json()) as KpiDashboardData;
      setData(payload);

      const rec = payload.customConfig?.recommendedPreset || payload.farmContext?.recommendedPreset || "gerencial";
      if (payload.customConfig?.config) {
        const normalized = normalizeKpiDashboardConfig(payload.customConfig.config, rec);
        setConfig(normalized);
        writeLocalCachedConfig(normalized);
      } else {
        const cached = readLocalCachedConfig(rec);
        setConfig(cached ?? buildPresetConfig("auto", rec));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cargando métricas";
      setError(msg);
      const cached = readLocalCachedConfig("gerencial");
      if (cached) {
        setConfig(cached);
      }
    } finally {
      setLoading(false);
    }
  }, [period, species, locationId, batchId]);

  useEffect(() => {
    void Promise.resolve().then(loadKpis);
  }, [loadKpis]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => {
        const role = user?.role;
        if (role === "admin" || role === "propietario" || role === "superadmin") {
          setCanSeedFarmDefault(true);
        }
      })
      .catch(() => {});
  }, []);

  const persistConfig = useCallback(
    async (nextConfig: KpiDashboardConfig, seedFarmDefault = false) => {
      const normalized = normalizeKpiDashboardConfig(nextConfig, recommendedPreset);
      setConfig(normalized);
      writeLocalCachedConfig(normalized);
      setSavingConfig(true);
      setSaveNotice(null);

      try {
        const res = await fetch("/api/analisis/kpis/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preset: normalized.preset,
            widgets: normalized.widgets,
            seedFarmDefault,
          }),
        });
        if (!res.ok) {
          throw new Error("Guardado solo localmente (sin conexión al servidor)");
        }
        const saved = await res.json();
        if (saved?.config) {
          const synced = normalizeKpiDashboardConfig(saved.config, recommendedPreset);
          setConfig(synced);
          writeLocalCachedConfig(synced);
        }
        setSaveNotice(
          seedFarmDefault
            ? "Tablero guardado y aplicado como vista predeterminada de la granja."
            : "Preferencias del tablero guardadas."
        );
      } catch {
        setSaveNotice("Preferencias guardadas en este dispositivo (sincronización pendiente).");
      } finally {
        setSavingConfig(false);
      }
    },
    [recommendedPreset]
  );

  const handleSelectPreset = async (presetId: KpiPresetId) => {
    if (presetId === "custom") {
      setCustomizerOpen(true);
      return;
    }
    const next = buildPresetConfig(presetId, recommendedPreset);
    await persistConfig(next, false);
  };

  const handleToggleWidgetSize = async (id: KpiWidgetId) => {
    const nextWidgets = config.widgets.map((w) =>
      w.id === id ? { ...w, size: (w.size === "wide" ? "compact" : "wide") as "wide" | "compact" } : w
    );
    await persistConfig(
      normalizeKpiDashboardConfig({ ...config, preset: "custom", widgets: nextWidgets }, recommendedPreset),
      false
    );
  };

  const visibleWidgets = useMemo(() => {
    const active = config.widgets.filter((w) => w.visible).sort((a, b) => a.order - b.order);
    if (!search.trim()) return active;
    return active.filter((w) => {
      const cat = KPI_WIDGET_CATALOG[w.id];
      return matchesTextQuery(search, [cat.title, cat.shortTitle, cat.description, cat.category]);
    });
  }, [config.widgets, search]);

  const filteredBatches = useMemo(() => {
    const batches = data?.farmContext?.activeBatches || [];
    return batches.filter((b) => {
      if (species && b.species !== species) return false;
      if (locationId && b.locationId !== locationId) return false;
      return true;
    });
  }, [data?.farmContext?.activeBatches, species, locationId]);

  const activeSpeciesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data?.farmContext?.activeSpecies || []) {
      map.set(item.species, item.count);
    }
    return map;
  }, [data?.farmContext?.activeSpecies]);

  const pinnedWidgets = useMemo(
    () => config.widgets.filter((w) => w.pinnedToHome).sort((a, b) => a.order - b.order),
    [config.widgets]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        theme="analisis"
        icon={<BarChart3 className="w-6 h-6" />}
        title="Tablero de KPIs conectado a tu granja"
        description="Métricas con contexto, comparación vs. período anterior, metas por especie y vista personalizable por rol."
        actions={
          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-white/95 hover:bg-white text-slate-900 px-3.5 py-2 text-sm font-semibold shadow-sm transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-green-700" />
            Personalizar tablero
          </button>
        }
      />

      {/* Farm-Connected Filter Strip + Preset Switcher */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Select
            label="Período"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="7">Últimos 7 días</option>
            <option value="15">Últimos 15 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="60">Últimos 60 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="180">Últimos 180 días</option>
            <option value="365">Último año</option>
          </Select>

          <Select
            label="Especie"
            value={species}
            onChange={(e) => {
              setSpecies(e.target.value);
              setBatchId("");
            }}
          >
            <option value="">Todas las especies</option>
            {KPI_SPECIES_OPTIONS.map((sp) => {
              const count = activeSpeciesMap.get(sp.value) || 0;
              return (
                <option key={sp.value} value={sp.value}>
                  {sp.label} {count > 0 ? `(${count} act.)` : ""}
                </option>
              );
            })}
          </Select>

          <Select
            label="Ubicación / Galpón"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setBatchId("");
            }}
          >
            <option value="">Todas las ubicaciones</option>
            {(data?.farmContext?.locations || []).map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.activeCount} anim.)
              </option>
            ))}
          </Select>

          <Select
            label="Lote específico"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          >
            <option value="">Todos los lotes</option>
            {filteredBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.speciesLabel} ({b.currentQuantity})
              </option>
            ))}
          </Select>

          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Filtrar KPIs visibles..."
            className="w-full"
          />
        </div>

        {/* Presets Bar + Quick Farm Context */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Vista:
            </span>
            {PRESET_TABS.map((presetId) => {
              const meta = KPI_PRESETS[presetId];
              const isActive = config.preset === presetId;
              return (
                <button
                  key={presetId}
                  type="button"
                  disabled={savingConfig}
                  onClick={() => handleSelectPreset(presetId)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isActive
                      ? "bg-green-700 text-white border-green-700 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {presetId === "auto" && <Sparkles className="w-3.5 h-3.5" />}
                  <span>{meta.label}</span>
                  {presetId === "auto" && data && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded ${
                        isActive ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {KPI_PRESETS[recommendedPreset].label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {data && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <strong>{data.flock.totalBirds}</strong> animales en alcance
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Ref. {data.benchmarks.breedLabel}
              </span>
              {pinnedWidgets.length > 0 && (
                <span className="text-green-700 font-medium">
                  {pinnedWidgets.length} fijado{pinnedWidgets.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {saveNotice && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-800 flex items-center justify-between gap-2">
            <span>{saveNotice}</span>
            <button
              type="button"
              onClick={() => setSaveNotice(null)}
              className="text-emerald-700 hover:underline font-semibold"
            >
              Ocultar
            </button>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Alerts derived from live farm metrics */}
      {data && (
        <div className="space-y-3">
          {data.biologicalContext && (data.biologicalContext.lifecycleMode === "cria_levante" || data.biologicalContext.lifecycleMode === "pausa_sanitaria") && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-emerald-950">
              <div>
                <p className="font-semibold">
                  Modo adaptativo: {data.biologicalContext.lifecycleLabel}
                </p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  {data.biologicalContext.lifecycleDescription} Patrimonio vivo acumulado:{" "}
                  <strong>${Math.round(data.biologicalContext.totalProductiveWealthCop).toLocaleString("es-CO")}</strong>
                </p>
              </div>
              <Link
                href="/dashboard/analisis/reportes"
                className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
              >
                Ver balance en 3 capas
              </Link>
            </div>
          )}

          {(data.biologicalContext?.alerts || []).map((bioAlert) => (
            <div
              key={bioAlert.id}
              className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm ${
                bioAlert.severity === "critical"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : bioAlert.severity === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-sky-200 bg-sky-50 text-sky-900"
              }`}
            >
              <div>
                <p className="font-semibold">
                  [{bioAlert.species.toUpperCase()}] {bioAlert.title}
                </p>
                <p className="text-xs opacity-90 mt-0.5">
                  {bioAlert.detail} <strong>Acción:</strong> {bioAlert.recommendedAction}
                </p>
              </div>
            </div>
          ))}

          {data.costPerUnit.breakevenAlertEggs && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-rose-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Precio bajo punto de equilibrio:</strong> Tu precio promedio de huevo ($
                  {data.costPerUnit.avgSalePricePerEgg.toFixed(0)}) está por debajo de tu costo unitario ($
                  {data.costPerUnit.perEgg.toFixed(0)}).
                </span>
              </div>
              <Link
                href="/dashboard/finanzas/ventas"
                className="text-xs font-semibold text-rose-800 underline hover:text-rose-950"
              >
                Revisar precios y ventas
              </Link>
            </div>
          )}

          {data.peakProduction.declinePercent > 10 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm text-amber-900">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Caída frente al pico de postura:</strong> Bajó{" "}
                  {data.peakProduction.declinePercent.toFixed(1)}% desde su semana pico (
                  {data.peakProduction.peakRate}% → {data.peakProduction.currentRate}%).
                </span>
              </div>
              <Link
                href="/dashboard/produccion/huevos"
                className="text-xs font-semibold text-amber-800 underline hover:text-amber-950"
              >
                Auditar lote en postura
              </Link>
            </div>
          )}

          {data.zootechnical.slaughterWindowAlerts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Lotes próximos o dentro de ventana óptima de sacrificio</span>
                </div>
                <Link
                  href="/dashboard/produccion/sacrificio"
                  className="text-xs font-semibold text-amber-800 underline"
                >
                  Programar sacrificio
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.zootechnical.slaughterWindowAlerts.map((alert) => (
                  <span
                    key={alert.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-900"
                  >
                    <strong>{alert.code}</strong> · {alert.ageDays}/{alert.targetDays}d ·{" "}
                    {alert.currentQuantity} anim.
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Customizable Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 rounded-xl bg-white border border-slate-200 p-4 animate-pulse space-y-3"
            >
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-7 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-40 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : data && visibleWidgets.length > 0 ? (
        <section
          aria-label="Indicadores del tablero personalizable"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {visibleWidgets.map((pref) => (
            <KpiWidgetCard
              key={pref.id}
              pref={pref}
              data={data}
              onToggleSize={handleToggleWidgetSize}
              onOpenCustomizer={() => setCustomizerOpen(true)}
            />
          ))}
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700">
            No hay widgets visibles para los filtros actuales.
          </p>
          <div className="flex items-center justify-center gap-2">
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Limpiar búsqueda
              </button>
            )}
            <button
              type="button"
              onClick={() => setCustomizerOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              Elegir indicadores en Personalizar
            </button>
          </div>
        </div>
      )}

      <KpiCustomizerDialog
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        config={config}
        recommendedPreset={recommendedPreset}
        canSeedFarmDefault={canSeedFarmDefault}
        saving={savingConfig}
        onSave={async (nextConfig, seedDefault) => {
          await persistConfig(nextConfig, seedDefault);
        }}
      />
    </div>
  );
}
