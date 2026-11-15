"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pin,
  SlidersHorizontal,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui";
import {
  KPI_WIDGET_CATALOG,
  evaluateKpiStatus,
  type KpiDashboardData,
  type KpiHealthStatus,
  type KpiWidgetId,
  type KpiWidgetUserPref,
} from "@/lib/kpi-dashboard";

const CAUSE_LABELS: Record<string, string> = {
  enfermedad: "Enfermedad",
  depredador: "Depredador",
  accidente: "Accidente",
  vejez: "Vejez / Descarte",
  desconocida: "Desconocida",
  otra: "Otra causa",
};

const PIE_COLORS = ["#16a34a", "#eab308", "#dc2626", "#2563eb", "#7c3aed", "#ea580c"];

function formatCop(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

interface MetricSnapshot {
  rawValue: number | null;
  formattedValue: string;
  deltaPct: number | null;
  benchmarkTarget: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  contextLine: string;
  secondaryLine: string;
  progressPct: number | null;
}

function extractMetricSnapshot(
  id: KpiWidgetId,
  data: KpiDashboardData,
  pref: KpiWidgetUserPref
): MetricSnapshot {
  const catalog = KPI_WIDGET_CATALOG[id];
  const { laying, mortality, costPerUnit, zootechnical, capexRoi, finance, feedAutonomy, benchmarks, previousPeriod, flock } =
    data;

  const targetOrDefault = (fallback: number | null) =>
    pref.customTarget !== null ? pref.customTarget : fallback;

  switch (id) {
    case "laying_rate": {
      const val = laying.eligibleAnimals > 0 ? laying.rate : null;
      const target = targetOrDefault(benchmarks.layingTargetPct);
      const pct = val !== null && target && target > 0 ? Math.min(100, Math.round((val / target) * 100)) : null;
      return {
        rawValue: val,
        formattedValue: val !== null ? `${val.toFixed(1)}%` : "Sin postura",
        deltaPct: previousPeriod.deltas.laying_rate,
        benchmarkTarget: benchmarks.layingTargetPct,
        warningThreshold: catalog.warningThreshold,
        criticalThreshold: catalog.criticalThreshold,
        contextLine: `Meta ${benchmarks.breedLabel}: ${target ?? 82}%`,
        secondaryLine: `${laying.totalEggs.toLocaleString("es-CO")} huevos · ${laying.eligibleAnimals} aves elegibles`,
        progressPct: pct,
      };
    }
    case "laying_haa": {
      const val = laying.eligibleAnimals > 0 ? laying.haaRate : null;
      const target = targetOrDefault(catalog.defaultTarget);
      const pct = val !== null && target && target > 0 ? Math.min(100, Math.round((val / target) * 100)) : null;
      return {
        rawValue: val,
        formattedValue: val !== null ? `${val.toFixed(1)}%` : "Sin postura",
        deltaPct: previousPeriod.deltas.laying_haa,
        benchmarkTarget: catalog.defaultTarget,
        warningThreshold: catalog.warningThreshold,
        criticalThreshold: catalog.criticalThreshold,
        contextLine: `Meta Ave Alojada: ${target ?? 78}%`,
        secondaryLine: `Promedio ${laying.avgDaily.toFixed(1)} huevos/día`,
        progressPct: pct,
      };
    }
    case "cost_per_egg": {
      const val = laying.totalEggs > 0 && costPerUnit.perEgg > 0 ? costPerUnit.perEgg : null;
      const target = targetOrDefault(
        benchmarks.referenceEggPrice ? Math.round(benchmarks.referenceEggPrice * 0.72) : catalog.defaultTarget
      );
      return {
        rawValue: val,
        formattedValue: val !== null ? formatCop(val) : "Sin costos/huevos",
        deltaPct: previousPeriod.deltas.cost_per_egg,
        benchmarkTarget: target,
        warningThreshold: target ? Math.round(target * 1.18) : catalog.warningThreshold,
        criticalThreshold: target ? Math.round(target * 1.35) : catalog.criticalThreshold,
        contextLine: `Cubeta x30: ${val !== null ? formatCop(costPerUnit.perTray30) : "—"} · Meta ≤ ${target ? formatCop(target) : "—"}`,
        secondaryLine: `Pool postura: ${formatCop(costPerUnit.eggFeedCost)}`,
        progressPct: val !== null && target && target > 0 ? Math.min(100, Math.round((target / val) * 100)) : null,
      };
    }
    case "egg_margin": {
      const hasBoth = costPerUnit.perEgg > 0 && costPerUnit.avgSalePricePerEgg > 0;
      const val = hasBoth ? Number((costPerUnit.avgSalePricePerEgg - costPerUnit.perEgg).toFixed(2)) : null;
      const target = targetOrDefault(catalog.defaultTarget);
      return {
        rawValue: val,
        formattedValue: val !== null ? formatCop(val) : "Faltan ventas/costos",
        deltaPct: previousPeriod.deltas.egg_margin,
        benchmarkTarget: catalog.defaultTarget,
        warningThreshold: catalog.warningThreshold,
        criticalThreshold: catalog.criticalThreshold,
        contextLine: `Venta prom. ${formatCop(costPerUnit.avgSalePricePerEgg)} vs Costo ${formatCop(costPerUnit.perEgg)}`,
        secondaryLine: costPerUnit.breakevenAlertEggs
          ? "Alerta: venta por debajo del punto de equilibrio"
          : `Meta margen: ≥ ${formatCop(target ?? 80)}/huevo`,
        progressPct: null,
      };
    }
    case "mortality_rate": {
      const val = flock.totalBirds > 0 || mortality.totalDeaths > 0 ? mortality.rate : null;
      const target = targetOrDefault(benchmarks.mortalityMaxPct);
      return {
        rawValue: val,
        formattedValue: val !== null ? `${val.toFixed(2)}%` : "0.00%",
        deltaPct: previousPeriod.deltas.mortality_rate,
        benchmarkTarget: benchmarks.mortalityMaxPct,
        warningThreshold: catalog.warningThreshold,
        criticalThreshold: catalog.criticalThreshold,
        contextLine: `Umbral sano ≤ ${target ?? 1.5}% en ${data.periodDays}d`,
        secondaryLine: `${mortality.totalDeaths} bajas sobre ${mortality.totalFlock} animales en alcance`,
        progressPct: null,
      };
    }
    case "feed_autonomy": {
      const val = feedAutonomy.daysRemaining;
      const target = targetOrDefault(benchmarks.feedAutonomyMinDays);
      const pct = val !== null && target && target > 0 ? Math.min(100, Math.round((val / target) * 100)) : null;
      const sourceText =
        feedAutonomy.source === "movements"
          ? "Basado en consumo real"
          : feedAutonomy.source === "estimated"
            ? "Estimado según población"
            : "Sin consumo ni ración";
      return {
        rawValue: val,
        formattedValue: val !== null ? `${val.toFixed(1)} días` : "Sin cálculo",
        deltaPct: null,
        benchmarkTarget: benchmarks.feedAutonomyMinDays,
        warningThreshold: catalog.warningThreshold,
        criticalThreshold: catalog.criticalThreshold,
        contextLine: `Meta reserva ≥ ${target ?? 10} días · ${sourceText}`,
        secondaryLine: `${feedAutonomy.currentStockKg} kg en bodega · ${feedAutonomy.dailyConsumptionKg} kg/día`,
        progressPct: pct,
      };
    }
    case "net_profit": {
      const hasActivity = finance.totalIncome > 0 || finance.totalExpenses > 0;
      const val = hasActivity ? finance.netProfit : null;
      const cashNote =
        typeof finance.cashNetFlow === "number" &&
        (finance.capexExcluded || 0) + (finance.feedPurchasesExcluded || 0) > 0
          ? ` · Caja neta: ${formatCop(finance.cashNetFlow)}`
          : "";
      return {
        rawValue: val,
        formattedValue: val !== null ? formatCop(val) : "Sin movimientos",
        deltaPct: previousPeriod.deltas.net_profit,
        benchmarkTarget: catalog.defaultTarget,
        warningThreshold: catalog.warningThreshold,
        criticalThreshold: catalog.criticalThreshold,
        contextLine:
          finance.marginPct !== null
            ? `Margen real de operación: ${finance.marginPct.toFixed(1)}%${cashNote}`
            : `Gastos reales usados en el período${cashNote}`,
        secondaryLine: `Ventas ${formatCop(finance.totalIncome)} · Gasto real ${formatCop(finance.totalExpenses)}`,
        progressPct: null,
      };
    }
    case "cost_per_kg_meat": {
      const val = costPerUnit.saleableMeatKg > 0 && costPerUnit.perKgMeat > 0 ? costPerUnit.perKgMeat : null;
      const refTarget = targetOrDefault(
        benchmarks.referenceMeatPriceKg ? Math.round(benchmarks.referenceMeatPriceKg * 0.65) : catalog.defaultTarget
      );
      return {
        rawValue: val,
        formattedValue: val !== null ? `${formatCop(val)}/kg` : "Sin faena/carne",
        deltaPct: previousPeriod.deltas.cost_per_kg_meat,
        benchmarkTarget: refTarget,
        warningThreshold: refTarget ? Math.round(refTarget * 1.2) : catalog.warningThreshold,
        criticalThreshold: refTarget ? Math.round(refTarget * 1.4) : catalog.criticalThreshold,
        contextLine: `Meta ≤ ${refTarget ? formatCop(refTarget) : "—"}/kg · Ref. canal ${benchmarks.referenceMeatPriceKg ? formatCop(benchmarks.referenceMeatPriceKg) : "—"}`,
        secondaryLine: `${costPerUnit.saleableMeatKg.toFixed(1)} kg vendibles · Vivo ${formatCop(costPerUnit.perLiveKgMeat)}/kg`,
        progressPct: null,
      };
    }
    case "epef": {
      const val = zootechnical.epef;
      const target = targetOrDefault(benchmarks.epefTarget);
      const pct = val !== null && target && target > 0 ? Math.min(100, Math.round((val / target) * 100)) : null;
      return {
        rawValue: val,
        formattedValue: val !== null ? `${val.toFixed(0)} pts` : "Sin pesajes",
        deltaPct: previousPeriod.deltas.epef,
        benchmarkTarget: benchmarks.epefTarget,
        warningThreshold: catalog.warningThreshold,
        criticalThreshold: catalog.criticalThreshold,
        contextLine: `Meta comercial ≥ ${target ?? 300} pts · Alimento/kg ideal ${benchmarks.fcrTarget}`,
        secondaryLine:
          zootechnical.dailyGainG !== null
            ? `Ganancia diaria: ${zootechnical.dailyGainG} g/día`
            : "Registra pesajes semanales del lote",
        progressPct: pct,
      };
    }
    case "uniformity": {
      const val = zootechnical.uniformityPct;
      const target = targetOrDefault(benchmarks.uniformityTargetPct);
      const pct = val !== null && target && target > 0 ? Math.min(100, Math.round((val / target) * 100)) : null;
      return {
        rawValue: val,
        formattedValue: val !== null ? `${val.toFixed(1)}%` : "Sin muestras",
        deltaPct: previousPeriod.deltas.uniformity,
        benchmarkTarget: benchmarks.uniformityTargetPct,
        warningThreshold: catalog.warningThreshold,
        criticalThreshold: catalog.criticalThreshold,
        contextLine: `Meta lote parejo ≥ ${target ?? 80}%`,
        secondaryLine:
          zootechnical.cvPercent !== null
            ? `Variación de peso entre animales: ${zootechnical.cvPercent}%`
            : "Requiere pesajes individuales",
        progressPct: pct,
      };
    }
    case "capex_roi": {
      const val = capexRoi.roiAnnualizedPct;
      const target = targetOrDefault(catalog.defaultTarget);
      const recPct = data.biologicalContext?.capexRecoveryPct ?? finance.capexRecoveryPct;
      return {
        rawValue: val,
        formattedValue: val !== null ? `${val.toFixed(1)}%` : "Sin activos",
        deltaPct: null,
        benchmarkTarget: catalog.defaultTarget,
        warningThreshold: catalog.warningThreshold,
        criticalThreshold: catalog.criticalThreshold,
        contextLine:
          capexRoi.paybackMonths !== null
            ? `Se recupera en aprox. ${capexRoi.paybackMonths.toFixed(1)} meses`
            : data.biologicalContext?.lifecycleMode === "cria_levante"
              ? `Desgaste repartido por su vida útil (meta ≥ ${target ?? 20}%)`
              : `Meta anual ≥ ${target ?? 20}%`,
        secondaryLine: `Invertido en equipos: ${formatCop(capexRoi.totalCapex)}${typeof recPct === "number" ? ` · Usado ${recPct.toFixed(1)}%` : ""}`,
        progressPct: typeof recPct === "number" ? Math.min(100, Math.round(recPct)) : null,
      };
    }
    case "biological_value": {
      const bio = data.biologicalContext;
      const val = bio ? bio.totalBiologicalValueCop : null;
      return {
        rawValue: val,
        formattedValue: val !== null ? formatCop(val) : "—",
        deltaPct: null,
        benchmarkTarget: null,
        warningThreshold: null,
        criticalThreshold: null,
        contextLine: bio
          ? `${bio.totalAliveAnimals} animales · Valor ganado en pie hoy: ${formatCop(bio.unrealizedBiologicalGainCop)}`
          : "Valoración de tus animales hoy",
        secondaryLine: bio
          ? `Valor estimado al vender/cosechar: ${formatCop(bio.projectedHarvestValueCop)}`
          : "",
        progressPct: null,
      };
    }
    case "patrimony_wealth": {
      const bio = data.biologicalContext;
      const val = bio ? bio.totalProductiveWealthCop : null;
      return {
        rawValue: val,
        formattedValue: val !== null ? formatCop(val) : "—",
        deltaPct: null,
        benchmarkTarget: null,
        warningThreshold: null,
        criticalThreshold: null,
        contextLine: bio
          ? `Alimento en bodega ${formatCop(bio.warehouseFeedAssetCop)} · Equipos restantes ${formatCop(bio.netEquipmentBookValueCop)}`
          : "Todo lo que vale tu granja hoy",
        secondaryLine: bio
          ? `Valor actual de animales: ${formatCop(bio.totalBiologicalValueCop)}`
          : "",
        progressPct: null,
      };
    }
    default:
      return {
        rawValue: null,
        formattedValue: "—",
        deltaPct: null,
        benchmarkTarget: null,
        warningThreshold: null,
        criticalThreshold: null,
        contextLine: "",
        secondaryLine: "",
        progressPct: null,
      };
  }
}

function statusBadgeColor(status: KpiHealthStatus): string {
  switch (status) {
    case "optimal":
      return "green";
    case "warning":
      return "yellow";
    case "critical":
      return "red";
    default:
      return "gray";
  }
}

function statusBorderClass(status: KpiHealthStatus): string {
  switch (status) {
    case "optimal":
      return "border-emerald-200";
    case "warning":
      return "border-amber-300";
    case "critical":
      return "border-red-300";
    default:
      return "border-slate-200";
  }
}

export function KpiWidgetCard({
  pref,
  data,
  onToggleSize,
  onOpenCustomizer,
}: {
  pref: KpiWidgetUserPref;
  data: KpiDashboardData;
  onToggleSize: (id: KpiWidgetId) => void;
  onOpenCustomizer: () => void;
}) {
  const catalog = KPI_WIDGET_CATALOG[pref.id];
  const colSpanClass = pref.size === "wide" ? "md:col-span-2" : "col-span-1";
  const [layingChartMode, setLayingChartMode] = useState<"rate" | "eggs">(
    data.laying.eligibleAnimals > 0 ? "rate" : "eggs"
  );

  if (catalog.kind === "metric") {
    const snap = extractMetricSnapshot(pref.id, data, pref);
    const lifecycleMode = data.biologicalContext?.lifecycleMode;
    const suppressFalseEarlyRed =
      (lifecycleMode === "cria_levante" || lifecycleMode === "pausa_sanitaria") &&
      (pref.id === "net_profit" || pref.id === "capex_roi" || pref.id === "laying_rate" || pref.id === "laying_haa");
    const rawEvaluation = evaluateKpiStatus(snap.rawValue, {
      direction: catalog.direction,
      customTarget: pref.customTarget,
      benchmarkTarget: snap.benchmarkTarget,
      warningThreshold: snap.warningThreshold,
      criticalThreshold: snap.criticalThreshold,
    });
    const evaluation =
      suppressFalseEarlyRed && rawEvaluation.status === "critical"
        ? {
            status: "neutral" as KpiHealthStatus,
            label: lifecycleMode === "pausa_sanitaria" ? "Vacío sanitario" : "En formación",
          }
        : rawEvaluation;

    const deltaPositiveIsGood =
      catalog.direction === "lower_is_better"
        ? (snap.deltaPct ?? 0) < 0
        : (snap.deltaPct ?? 0) > 0;

    return (
      <article
        className={`bg-white rounded-xl shadow-sm border ${statusBorderClass(evaluation.status)} p-4 flex flex-col justify-between gap-3 transition-shadow hover:shadow-md ${colSpanClass}`}
      >
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {catalog.category}
              </span>
              <h3 className="text-sm font-semibold text-slate-800 leading-snug">
                {catalog.shortTitle}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {pref.pinnedToHome && (
                <span
                  title="Fijado en tu resumen"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50 text-green-700"
                >
                  <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              )}
              <Badge color={statusBadgeColor(evaluation.status)}>{evaluation.label}</Badge>
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              {snap.formattedValue}
            </p>
            {snap.deltaPct !== null ? (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  snap.deltaPct === 0
                    ? "bg-slate-100 text-slate-600"
                    : deltaPositiveIsGood
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                }`}
              >
                {snap.deltaPct >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {snap.deltaPct > 0 ? `+${snap.deltaPct}%` : `${snap.deltaPct}%`} vs {data.periodDays}d ant.
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Sin histórico comparable</span>
            )}
          </div>

          {snap.progressPct !== null && (
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-all ${
                  evaluation.status === "optimal"
                    ? "bg-emerald-500"
                    : evaluation.status === "warning"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                style={{ width: `${Math.max(4, Math.min(100, snap.progressPct))}%` }}
              />
            </div>
          )}

          <div className="space-y-0.5 text-xs">
            <p className="font-medium text-slate-600">{snap.contextLine}</p>
            <p className="text-slate-500">{snap.secondaryLine}</p>
          </div>
        </div>

        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <Link
            href={catalog.drilldownHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800 hover:underline"
          >
            <span>{catalog.drilldownLabel}</span>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleSize(pref.id)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title={pref.size === "wide" ? "Hacer compacto" : "Ampliar tarjeta"}
              aria-label={pref.size === "wide" ? `Compactar ${catalog.shortTitle}` : `Ampliar ${catalog.shortTitle}`}
            >
              {pref.size === "wide" ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onOpenCustomizer}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Ajustar meta o visibilidad"
              aria-label={`Configurar ${catalog.shortTitle}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </article>
    );
  }

  // ─── Chart Widgets ───
  if (pref.id === "chart_laying_curve") {
    const series = data.laying.series.map((s) => {
      const ratePct =
        data.laying.eligibleAnimals > 0
          ? Number(((s.total / data.laying.eligibleAnimals) * 100).toFixed(1))
          : 0;
      return {
        dateLabel: new Date(`${s.date}T12:00:00`).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
        }),
        huevos: s.total,
        tasaPct: ratePct,
      };
    });

    return (
      <article className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3 min-w-0 ${colSpanClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-800">{catalog.title}</h3>
            <p className="text-xs text-slate-500">
              Meta referencia ({data.benchmarks.breedLabel}): {data.benchmarks.layingTargetPct}% · Pico:{" "}
              {data.peakProduction.peakRate}%
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLayingChartMode("rate")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  layingChartMode === "rate" ? "bg-white text-green-700 shadow-xs" : "text-slate-600"
                }`}
              >
                % Postura
              </button>
              <button
                type="button"
                onClick={() => setLayingChartMode("eggs")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  layingChartMode === "eggs" ? "bg-white text-green-700 shadow-xs" : "text-slate-600"
                }`}
              >
                Huevos/día
              </button>
            </div>
            <button
              type="button"
              onClick={() => onToggleSize(pref.id)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Cambiar tamaño del gráfico"
            >
              {pref.size === "wide" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {series.length > 0 ? (
          <div className="h-[250px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dateLabel" fontSize={11} />
                <YAxis fontSize={11} unit={layingChartMode === "rate" ? "%" : ""} />
                <Tooltip
                  formatter={(value) =>
                    layingChartMode === "rate"
                      ? [`${value}%`, "% Postura"]
                      : [`${value} huevos`, "Recolección"]
                  }
                />
                {layingChartMode === "rate" && (
                  <ReferenceLine
                    y={data.benchmarks.layingTargetPct}
                    stroke="#ca8a04"
                    strokeDasharray="4 4"
                    label={{
                      value: `Meta ${data.benchmarks.layingTargetPct}%`,
                      position: "insideTopRight",
                      fill: "#a16207",
                      fontSize: 11,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey={layingChartMode === "rate" ? "tasaPct" : "huevos"}
                  stroke="#16a34a"
                  fill="#bbf7d0"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            Sin recolecciones registradas para este filtro en los últimos {data.periodDays} días.{" "}
            <Link href={catalog.drilldownHref} className="font-semibold text-green-700 hover:underline">
              Registrar huevos
            </Link>
          </div>
        )}
      </article>
    );
  }

  if (pref.id === "chart_mortality_causes") {
    const mortalityPie = data.mortality.byCause.map((item) => ({
      name: CAUSE_LABELS[item.cause] || item.cause,
      value: item.total,
    }));

    return (
      <article className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3 min-w-0 ${colSpanClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-800">{catalog.title}</h3>
            <p className="text-xs text-slate-500">
              {data.mortality.totalDeaths} bajas registradas en {data.periodDays} días (tasa{" "}
              {data.mortality.rate}%)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={catalog.drilldownHref}
              className="text-xs font-semibold text-green-700 hover:underline"
            >
              {catalog.drilldownLabel}
            </Link>
            <button
              type="button"
              onClick={() => onToggleSize(pref.id)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Cambiar tamaño del gráfico"
            >
              {pref.size === "wide" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mortalityPie.length > 0 ? (
          <div className="h-[250px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={mortalityPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={82}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {mortalityPie.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-emerald-700 bg-emerald-50/70 rounded-lg border border-dashed border-emerald-200">
            Excelente: sin bajas registradas en este alcance durante los últimos {data.periodDays} días.
          </div>
        )}
      </article>
    );
  }

  // chart_cost_breakdown
  const costBreakdown = data.expenseByCategory.map((c) => ({
    name: c.category,
    total: Number(c.total || 0),
  }));

  return (
    <article className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3 min-w-0 ${colSpanClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{catalog.title}</h3>
          <p className="text-xs text-slate-500">
            Ingresos: {formatCop(data.finance.totalIncome)} · Egresos:{" "}
            {formatCop(data.finance.totalExpenses)} · Utilidad:{" "}
            <strong className={data.finance.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}>
              {formatCop(data.finance.netProfit)}
            </strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={catalog.drilldownHref}
            className="text-xs font-semibold text-green-700 hover:underline"
          >
            {catalog.drilldownLabel}
          </Link>
          <button
            type="button"
            onClick={() => onToggleSize(pref.id)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Cambiar tamaño del gráfico"
          >
            {pref.size === "wide" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {costBreakdown.length > 0 ? (
        <div className="h-[250px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={costBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(value) => formatCop(Number(value || 0))} />
              <Bar dataKey="total" fill="#16a34a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-10 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          Sin egresos categorizados para este filtro en los últimos {data.periodDays} días.{" "}
          <Link href="/finanzas/egresos" className="font-semibold text-green-700 hover:underline">
            Registrar egreso
          </Link>
        </div>
      )}
    </article>
  );
}
