"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, StatCard, Select, EmptyState } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { apiFetch } from "@/lib/fetch";

interface KpiData {
  mortality: {
    rate: number;
    totalDeaths: number;
    totalFlock: number;
    byCause: { cause: string; total: number }[];
  };
  laying: {
    rate: number;
    totalEggs: number;
    avgDaily: number;
    series: { date: string; total: number }[];
  };
  costPerUnit: {
    perEgg: number;
    perKgMeat: number;
    totalExpenses: number;
  };
  flock: {
    avgAgeWeeks: number;
    totalBirds: number;
    productiveRatio: number;
  };
  expenseByCategory: { category: string; total: string }[];
  periodDays: number;
  costMetrics: {
    costoPorAve: number;
    costoPorDocena: number;
    costoPorHuevo: number;
    costoPorKgCarne: number;
    totalExpenses: number;
    totalBirds: number;
    totalEggs: number;
    dozens: number;
  };
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

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/analisis/kpis?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="📊 Indicadores Clave (KPIs)"
        description="Métricas de productividad, mortalidad, postura y costos"
        help="Panel de indicadores clave de rendimiento. Muestra tasa de postura (huevos/gallina/día), mortalidad, costo por unidad producida, edad promedio de la parvada y ratio productivo. Puedes filtrar por período (7, 30, 90 días o todo). Los gráficos de series históricas te permiten ver la evolución temporal. Ideal para tomar decisiones basadas en datos."
        actions={
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="365">Último año</option>
          </Select>
        }
      />

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : !data ? (
        <EmptyState icon="📊" message="No hay datos para el período seleccionado" />
      ) : (
        <>
          {/* Mortality KPIs */}
          <h2 className="text-lg font-bold text-slate-700">💀 Mortalidad</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="💀" label="Tasa mortalidad" value={`${data.mortality.rate}%`} color="red" />
            <StatCard icon="☠️" label="Muertes totales" value={String(data.mortality.totalDeaths)} color="yellow" />
            <StatCard icon="🏠" label="Parvada total" value={String(data.mortality.totalFlock)} color="green" />
            <StatCard icon="📊" label="Causas registradas" value={String(data.mortality.byCause.length)} color="purple" />
          </div>

          {/* Laying KPIs */}
          <h2 className="text-lg font-bold text-slate-700">🥚 Postura</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="📈" label="Tasa de postura" value={`${data.laying.rate}%`} color="green" />
            <StatCard icon="🥚" label="Total huevos" value={String(data.laying.totalEggs)} color="yellow" />
            <StatCard icon="📅" label="Promedio diario" value={String(data.laying.avgDaily)} color="blue" />
            <StatCard icon="🐔" label="Gallinas productivas" value={String(data.mortality.totalFlock)} color="earth" />
          </div>

          {/* Cost KPIs */}
          <h2 className="text-lg font-bold text-slate-700">💰 Costos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="🥚" label="Costo por huevo" value={`$${data.costPerUnit.perEgg.toFixed(0)}`} color="green" />
            <StatCard icon="🍗" label="Costo por kg carne" value={`$${data.costPerUnit.perKgMeat.toFixed(0)}`} color="red" />
            <StatCard icon="💸" label="Total egresos" value={fmt(data.costPerUnit.totalExpenses)} color="purple" />
            <StatCard icon="📊" label="Días en período" value={String(data.periodDays)} color="blue" />
          </div>

          {/* Enhanced Cost Metrics */}
          <h2 className="text-lg font-bold text-slate-700">💲 Costos Unitarios Detallados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="🐔" label="Costo por ave" value={`$${data.costMetrics.costoPorAve.toFixed(0)}`} color="blue" />
            <StatCard icon="🥚" label="Costo por docena" value={`$${data.costMetrics.costoPorDocena.toFixed(0)}`} color="yellow" />
            <StatCard icon="🥚" label="Costo por huevo" value={`$${data.costMetrics.costoPorHuevo.toFixed(0)}`} color="green" />
            <StatCard icon="🍗" label="Costo por kg carne" value={`$${data.costMetrics.costoPorKgCarne.toFixed(0)}`} color="red" />
          </div>

          {/* Peak Production */}
          {data.peakProduction.peakWeek && (
            <>
              <h2 className="text-lg font-bold text-slate-700">🏆 Pico de Producción</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="📅" label="Semana pico" value={new Date(data.peakProduction.peakWeek + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" })} color="green" />
                <StatCard icon="📈" label="Tasa pico" value={`${data.peakProduction.peakRate}%`} color="blue" />
                <StatCard icon="📉" label="Tasa actual" value={`${data.peakProduction.currentRate}%`} color="yellow" />
                <StatCard icon="📊" label="Declive" value={`${data.peakProduction.declinePercent}%`} color="red" />
              </div>
            </>
          )}

          {/* Flock KPIs */}
          <h2 className="text-lg font-bold text-slate-700">🐔 Parvada</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="📅" label="Edad promedio" value={`${data.flock.avgAgeWeeks} sem`} color="blue" />
            <StatCard icon="🐔" label="Total aves" value={String(data.flock.totalBirds)} color="green" />
            <StatCard icon="📈" label="Ratio productivo" value={`${(data.flock.productiveRatio * 100).toFixed(0)}%`} color="yellow" />
            <StatCard icon="🏠" label="Estado" value={data.flock.totalBirds > 0 ? "Activo" : "Vacío"} color="earth" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {mortalityPie.length > 0 && (
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4">💀 Mortalidad por Causa</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={mortalityPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} fontSize={11}>
                      {mortalityPie.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}

            {layingSeries.length > 0 && (
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4">🥚 Producción Diaria de Huevos</h3>
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

            {costBreakdown.length > 0 && (
              <Card className="lg:col-span-2">
                <h3 className="font-semibold text-slate-700 mb-4">💸 Desglose de Costos</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costBreakdown} layout="vertical">
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
    </div>
  );
}
