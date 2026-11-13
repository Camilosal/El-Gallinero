"use client";

import { useEffect, useState, useCallback } from "react";
import { Banknote, Bird, Coins, Egg, HeartCrack, Skull, Trophy } from "lucide-react";
import { PageHeader, Card, StatCard, Select, EmptyState, Badge } from "@/components/ui";
import { ANIMAL_SPECIES, SPECIES_LABELS } from "@/lib/species";
import TableSearch from "@/components/TableSearch";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";

interface KpiData {
  mortality: {
    rate: number;
    totalDeaths: number;
    totalFlock: number;
    byCause: { cause: string; total: number }[];
  };
  laying: {
    rate: number;
    haaRate?: number;
    totalEggs: number;
    eligibleEggs: number;
    eligibleAnimals: number;
    avgDaily: number;
    series: { date: string; total: number }[];
  };
  costPerUnit: {
    perEgg: number;
    perTray30?: number;
    avgSalePricePerEgg?: number;
    breakevenAlertEggs?: boolean;
    perKgMeat: number;
    perLiveKgMeat?: number;
    totalExpenses: number;
    saleableMeatKg: number;
  };
  zootechnical?: {
    cvPercent: number | null;
    uniformityPct: number | null;
    dailyGainG: number | null;
    epef: number | null;
    feedKgConsumed: number;
    slaughterWindowAlerts: Array<{ batchId: string; code: string; species: string; ageDays: number; targetDays: number; recommendation: string }>;
  };
  capexRoi?: {
    totalCapex: number;
    roiAnnualizedPct: number | null;
    paybackMonths: number | null;
  };
  flock: {
    avgAgeWeeks: number;
    totalBirds: number;
    productiveRatio: number;
  };
  expenseByCategory: { category: string; total: string }[];
  periodDays: number;
  peakProduction: {
    peakWeek: string | null;
    peakDate: string | null;
    peakRate: number;
    currentRate: number;
    declinePercent: number;
    avgDaily: number;
    totalEggs: number;
  };
}

const CAUSE_LABELS: Record<string, string> = {
  enfermedad: "Enfermedad",
  depredador: "Depredador",
  accidente: "Accidente",
  sacrificio_sanitario: "Sacrificio sanitario",
  causa_natural: "Causa natural",
  otro: "Otro",
};

const COLORS = ["#22c55e", "#eab308", "#3b82f6", "#ef4444", "#a855f7", "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#64748b"];
const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function KpisPage() {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [species, setSpecies] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const qs = `period=${period}${species ? `&species=${species}` : ""}`;
    apiFetch(`/api/analisis/kpis?${qs}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period, species]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const mortalityPie = data?.mortality.byCause.map((b) => ({
    name: CAUSE_LABELS[b.cause] || b.cause,
    value: b.total,
  })) || [];

  const layingSeries = data?.laying.series.map((s) => ({
    date: new Date(s.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" }),
    huevos: s.total,
  })) || [];

  const costBreakdown = data?.expenseByCategory.map((c) => ({
    name: c.category,
    value: Number(c.total),
  })) || [];

  const filteredMortalityPie = mortalityPie.filter((m) =>
    matchesTextQuery(search, [m.name, "mortalidad", "causa"]),
  );
  const filteredCostBreakdown = costBreakdown.filter((c) =>
    matchesTextQuery(search, [c.name, "costos", "desglose", "egresos"]),
  );

  const showMortality = matchesTextQuery(search, [
    "mortalidad",
    "tasa mortalidad",
    "muertes totales",
    "animales inventario",
    "causas registradas",
    ...mortalityPie.map((m) => m.name),
  ]);
  const showLaying = matchesTextQuery(search, [
    "postura",
    "tasa de postura",
    "huevos elegibles",
    "huevos registrados",
    "animales aptos",
    "huevos diarios",
  ]);
  const showCosts = matchesTextQuery(search, [
    "costos",
    "alimento estimado",
    "huevo",
    "kg vendible",
    "carne",
    "total egresos",
    "dias periodo",
    "desglose costos",
    ...costBreakdown.map((c) => c.name),
  ]);
  const showPeak = Boolean(data?.peakProduction.peakWeek) && matchesTextQuery(search, [
    "pico produccion",
    "semana pico",
    "tasa pico",
    "tasa actual",
    "declive",
  ]);
  const showFlock = matchesTextQuery(search, [
    "parvada",
    "edad promedio",
    "total animales",
    "ratio productivo",
    "estado",
  ]);
  const totalSections = (data?.peakProduction.peakWeek ? 5 : 4);
  const matchingSections = [showMortality, showLaying, showCosts, showPeak, showFlock].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Indicadores Clave (KPIs)"
        description="Métricas de productividad, mortalidad, postura y costos"
        help="La tasa de postura cuenta huevos asociados a gallinas en edad y estado de postura, y a lotes maduros marcados para postura. El costo por huevo estima alimento de esa población. El costo por kg de carne estima adquisición y alimento para la carne destinada a venta; excluye autoconsumo. Los egresos se muestran aparte como total financiero del período."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={species} onChange={(e) => setSpecies(e.target.value)}>
              <option value="">Todas las especies</option>
              {ANIMAL_SPECIES.map((sp) => (
                <option key={sp} value={sp}>{SPECIES_LABELS[sp]?.plural ?? sp}</option>
              ))}
            </Select>
            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="365">Último año</option>
            </Select>
          </div>
        }
      />

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : !data ? (
        <EmptyState icon="chart" message="No hay datos para el período seleccionado" />
      ) : (
        <>
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar indicador, sección o categoría de costo..."
            resultCount={matchingSections}
            totalCount={totalSections}
          />

          {matchingSections === 0 ? (
            <EmptyState icon="chart" message="No hay indicadores que coincidan con la búsqueda" />
          ) : (
            <>
          {/* Mortality KPIs */}
          {showMortality && (
            <>
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <HeartCrack className="w-5 h-5 text-red-500" aria-hidden="true" />
                Mortalidad
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <StatCard icon="skull" label="Tasa mortalidad" value={`${data.mortality.rate}%`} color="red" />
                <StatCard icon="mortality" label="Muertes totales" value={String(data.mortality.totalDeaths)} color="yellow" />
                <StatCard icon="home" label="Animales en inventario" value={String(data.mortality.totalFlock)} color="green" />
                <StatCard icon="chart" label="Causas registradas" value={String(data.mortality.byCause.length)} color="purple" />
              </div>
            </>
          )}

          {/* Laying KPIs */}
          {showLaying && (
            <>
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Egg className="w-5 h-5 text-amber-500" aria-hidden="true" />
                Postura
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <StatCard icon="trend-up" label="Tasa de postura" value={`${data.laying.rate}%`} color="green" />
                <StatCard icon="egg" label="Huevos elegibles" value={String(data.laying.eligibleEggs)} color="yellow" />
                <StatCard icon="chart" label="Huevos registrados" value={String(data.laying.totalEggs)} color="blue" />
                <StatCard icon="hen" label="Animales aptos para postura" value={String(data.laying.eligibleAnimals)} color="earth" />
              </div>
              <p className="-mt-3 text-xs text-slate-500">Solo cuenta gallinas activas en edad de postura y lotes maduros de codornices o patos marcados para postura; registra en esos lotes únicamente las hembras ponedoras. Para el período se supone que la población apta actual estuvo presente todos los días.</p>
            </>
          )}

          {/* Cost KPIs */}
          {showCosts && (
            <>
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                Costos
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <StatCard icon="egg" label="Costo real / huevo (cubeta 30)" value={data.laying.eligibleEggs > 0 ? `${fmt(data.costPerUnit.perEgg)} (${fmt(data.costPerUnit.perTray30 ?? data.costPerUnit.perEgg * 30)})` : "—"} color={data.costPerUnit.breakevenAlertEggs ? "red" : "green"} />
                <StatCard icon="drumstick" label="Costo / kg canal (vivo)" value={data.costPerUnit.saleableMeatKg > 0 ? `${fmt(data.costPerUnit.perKgMeat)} (${fmt(data.costPerUnit.perLiveKgMeat ?? 0)})` : "—"} color="red" />
                <StatCard icon="expense" label="Total egresos" value={fmt(data.costPerUnit.totalExpenses)} color="purple" />
                <StatCard icon="chart" label="ROI CAPEX / Payback" value={data.capexRoi?.roiAnnualizedPct != null ? `${data.capexRoi.roiAnnualizedPct}% · ${data.capexRoi.paybackMonths ?? "—"} m` : "—"} color="blue" />
              </div>
              <p className="-mt-3 text-xs text-slate-500">Los costos unitarios son estimaciones con costos de adquisición registrados y parámetros estándar de alimento. Los egresos no se reparten entre huevos y carne.</p>
            </>
          )}

          {/* Peak Production */}
          {showPeak && data.peakProduction.peakWeek && (
            <>
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" aria-hidden="true" />
                Pico de Producción
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <StatCard icon="calendar" label="Semana pico" value={new Date(data.peakProduction.peakWeek + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" })} color="green" />
                <StatCard icon="trend-up" label="Tasa pico" value={`${data.peakProduction.peakRate}%`} color="blue" />
                <StatCard icon="trend-down" label="Tasa actual" value={`${data.peakProduction.currentRate}%`} color="yellow" />
                <StatCard icon="chart" label="Declive" value={`${data.peakProduction.declinePercent}%`} color="red" />
              </div>
            </>
          )}

          {/* Zootechnical KPIs (CV%, GDP, EPEF, HAA vs HD%, Ventana Faena) */}
          {data.zootechnical && (
            <>
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                Zootecnia, Uniformidad y Eficiencia
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <StatCard icon="scale" label="CV% Uniformidad (±10%)" value={data.zootechnical.cvPercent !== null ? `${data.zootechnical.cvPercent}% (${data.zootechnical.uniformityPct ?? "—"}%)` : "—"} color="blue" />
                <StatCard icon="trend-up" label="GDP promedio" value={data.zootechnical.dailyGainG !== null ? `${data.zootechnical.dailyGainG} g/d` : "—"} color="green" />
                <StatCard icon="award" label="Índice EPEF (Engorde)" value={data.zootechnical.epef !== null ? String(data.zootechnical.epef) : "—"} color="yellow" />
                <StatCard icon="egg" label="Postura HAA vs HD%" value={`${data.laying.haaRate ?? data.laying.rate}% / ${data.laying.rate}%`} color="earth" />
              </div>
              {data.zootechnical.slaughterWindowAlerts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
                  <p className="font-semibold">Alertas de ventana óptima de sacrificio:</p>
                  {data.zootechnical.slaughterWindowAlerts.map((a) => (
                    <div key={a.batchId} className="flex flex-wrap items-center gap-2">
                      <Badge color="yellow">{a.code}</Badge>
                      <span>{a.species} · {a.ageDays}/{a.targetDays} d — {a.recommendation}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Flock KPIs */}
          {showFlock && (
            <>
              <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Bird className="w-5 h-5 text-green-600" aria-hidden="true" />
                Parvada
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <StatCard icon="calendar" label="Edad promedio" value={`${data.flock.avgAgeWeeks} sem`} color="blue" />
                <StatCard icon="paw" label="Total animales" value={String(data.flock.totalBirds)} color="green" />
                <StatCard icon="trend-up" label="Ratio productivo" value={`${(data.flock.productiveRatio * 100).toFixed(0)}%`} color="yellow" />
                <StatCard icon="home" label="Estado" value={data.flock.totalBirds > 0 ? "Activo" : "Vacío"} color="earth" />
              </div>
            </>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {showMortality && filteredMortalityPie.length > 0 && (
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Skull className="w-4 h-4 text-red-500" aria-hidden="true" />
                  Mortalidad por Causa
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={filteredMortalityPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} fontSize={11}>
                      {filteredMortalityPie.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}

            {showLaying && layingSeries.length > 0 && (
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Egg className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  Huevos diarios de población apta
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={layingSeries}>
                    <defs>
                      <linearGradient id="gEggs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Area type="monotone" dataKey="huevos" name="Huevos" stroke="#eab308" fill="url(#gEggs)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {showCosts && filteredCostBreakdown.length > 0 && (
              <Card className="lg:col-span-2">
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  Desglose de Costos
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredCostBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" fontSize={10} width={120} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Bar dataKey="value" name="Monto" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
