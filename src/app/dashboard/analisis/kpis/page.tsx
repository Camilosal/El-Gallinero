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
    eligibleEggs: number;
    eligibleAnimals: number;
    avgDaily: number;
    series: { date: string; total: number }[];
  };
  costPerUnit: {
    perEgg: number;
    perKgMeat: number;
    totalExpenses: number;
    saleableMeatKg: number;
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

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/analisis/kpis?period=${period}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="📊 Indicadores Clave (KPIs)"
        description="Métricas de productividad, mortalidad, postura y costos"
        help="La tasa de postura cuenta huevos asociados a gallinas en edad y estado de postura, y a lotes maduros marcados para postura. El costo por huevo estima alimento de esa población. El costo por kg de carne estima adquisición y alimento para la carne destinada a venta; excluye autoconsumo. Los egresos se muestran aparte como total financiero del período."
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
            <StatCard icon="🏠" label="Animales en inventario" value={String(data.mortality.totalFlock)} color="green" />
            <StatCard icon="📊" label="Causas registradas" value={String(data.mortality.byCause.length)} color="purple" />
          </div>

          {/* Laying KPIs */}
          <h2 className="text-lg font-bold text-slate-700">🥚 Postura</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="📈" label="Tasa de postura" value={`${data.laying.rate}%`} color="green" />
            <StatCard icon="🥚" label="Huevos elegibles" value={String(data.laying.eligibleEggs)} color="yellow" />
            <StatCard icon="📊" label="Huevos registrados" value={String(data.laying.totalEggs)} color="blue" />
            <StatCard icon="🐔" label="Animales aptos para postura" value={String(data.laying.eligibleAnimals)} color="earth" />
          </div>
          <p className="-mt-3 text-xs text-slate-500">Solo cuenta gallinas activas en edad de postura y lotes maduros de codornices o patos marcados para postura; registra en esos lotes únicamente las hembras ponedoras. Para el período se supone que la población apta actual estuvo presente todos los días.</p>

          {/* Cost KPIs */}
          <h2 className="text-lg font-bold text-slate-700">💰 Costos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="🥚" label="Alimento estimado / huevo" value={data.laying.eligibleEggs > 0 ? fmt(data.costPerUnit.perEgg) : "—"} color="green" />
            <StatCard icon="🍗" label="Costo estimado / kg vendible" value={data.costPerUnit.saleableMeatKg > 0 ? fmt(data.costPerUnit.perKgMeat) : "—"} color="red" />
            <StatCard icon="💸" label="Total egresos" value={fmt(data.costPerUnit.totalExpenses)} color="purple" />
            <StatCard icon="📊" label="Días en período" value={String(data.periodDays)} color="blue" />
          </div>
          <p className="-mt-3 text-xs text-slate-500">Los costos unitarios son estimaciones con costos de adquisición registrados y parámetros estándar de alimento. Los egresos no se reparten entre huevos y carne.</p>

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
            <StatCard icon="🐾" label="Total animales" value={String(data.flock.totalBirds)} color="green" />
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
                <h3 className="font-semibold text-slate-700 mb-4">🥚 Huevos diarios de población apta</h3>
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
