"use client";

import { useEffect, useState } from "react";
import { Card, StatCard, PageHeader, Badge } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { apiFetch } from "@/lib/fetch";

interface StageData {
  name: string;
  count: number;
  expectedEggsPerDay: number;
}

interface StockProjection {
  feedId: string;
  feedName: string;
  dailyNeedKg: number;
  currentStockKg: number;
  daysRemaining: number | null;
}

interface FcrData {
  feedConsumed30d: number;
  fcrEggs: number;
  fcrChicks: number;
  fcrMeat: number;
  incubationEfficiency: number;
  totalHatched: number;
  totalMeatKg: number;
  totalMeatRevenue: string;
  totalBirdsSold: number;
}

interface FeedChartPoint {
  fecha: string;
  alimento: number;
  huevos: number;
}

interface DashboardData {
  hens: { total: number; active: number; broody: number; sick: number; recommendedForSlaughter: number };
  roosters: { required: number; active: number; deficit: number; surplus: number };
  readyBatches: number;
  eggs: { totalLast30: number; avgDaily: number };
  sales: { totalSold: number; totalRevenue: string };
  feedAlerts: number;
  activeIncubations: number;
  pendingMaintenance: number;
  recentEggs: { date: string; total: number }[];
  finance: { income: string; expenses: string; profit: string };
  stages: StageData[];
  totalExpectedEggsPerDay: number;
  stockProjection: StockProjection[];
  fcr: FcrData;
  feedChartData: FeedChartPoint[];
  manure: { currentStockKg: number; totalKgPerDay: number };
}

const stageColors: Record<string, string> = {
  Pollito: "yellow",
  Juvenil: "blue",
  "Pre-postura": "purple",
  Postura: "green",
};

function fcrColor(fcr: number, inverse = false) {
  // For FCR: lower is better. For efficiency: higher is better.
  if (inverse) return fcr >= 80 ? "text-green-600" : fcr >= 50 ? "text-yellow-600" : "text-red-600";
  return fcr <= 2 ? "text-green-600" : fcr <= 5 ? "text-yellow-600" : "text-red-600";
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐔</div>
          <p className="text-slate-500">Cargando datos del gallinero...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-500">Error cargando datos</p>;
  }

  const eggVariance = data.totalExpectedEggsPerDay > 0
    ? Math.round((data.eggs.avgDaily - data.totalExpectedEggsPerDay) * 10) / 10
    : 0;

  return (
    <div>
      <PageHeader
        title="🏡 Panel de Control — GalliGranja"
        description="Vista general del gallinero y la granja autosustentable"
      />

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon="🐔" label="Gallinas Activas" value={data.hens.active} color="green" />
        <StatCard icon="🥚" label="Huevos Esperados/día" value={data.totalExpectedEggsPerDay} color="yellow" />
        <StatCard icon="💰" label="Ingresos (30 días)" value={`$${Number(data.finance.income).toLocaleString()}`} color="blue" />
        <StatCard icon="🥚" label="Venta Huevos (30 días)" value={`$${Number(data.sales.totalRevenue).toLocaleString()}`} color="yellow" />
        <StatCard icon="📈" label="Ganancia Neta" value={`$${Number(data.finance.profit).toLocaleString()}`} color={Number(data.finance.profit) >= 0 ? "green" : "red"} />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Card className="text-center">
          <p className="text-2xl">🐣</p>
          <p className="text-lg font-bold mt-1">{data.hens.broody}</p>
          <p className="text-xs text-slate-500">Empollando</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl">🤒</p>
          <p className="text-lg font-bold mt-1">{data.hens.sick}</p>
          <p className="text-xs text-slate-500">Enfermas</p>
        </Card>
        {data.hens.recommendedForSlaughter > 0 && (
          <Card className="text-center border-orange-200 bg-orange-50">
            <p className="text-2xl">⚠️</p>
            <p className="text-lg font-bold mt-1">{data.hens.recommendedForSlaughter}</p>
            <p className="text-xs text-orange-600">Recomendadas sacrificio</p>
          </Card>
        )}
        <Card className={`text-center ${data.roosters.deficit > 0 ? "border-orange-200 bg-orange-50" : ""}`}>
          <p className="text-2xl">🐓</p>
          <p className={`text-lg font-bold mt-1 ${data.roosters.deficit > 0 ? "text-orange-600" : ""}`}>
            {data.roosters.active}/{data.roosters.required}
          </p>
          <p className="text-xs text-slate-500">
            Gallos {data.roosters.deficit > 0 ? `(faltan ${data.roosters.deficit})` : "(balance OK)"}
          </p>
        </Card>
        {data.readyBatches > 0 && (
          <Card className="text-center border-orange-200 bg-orange-50">
            <p className="text-2xl">🍗</p>
            <p className="text-lg font-bold mt-1">{data.readyBatches}</p>
            <p className="text-xs text-orange-600">Lotes listos p/ sacrificio</p>
          </Card>
        )}
        <Card className="text-center">
          <p className="text-2xl">🥚</p>
          <p className="text-lg font-bold mt-1">{data.eggs.avgDaily}</p>
          <p className="text-xs text-slate-500">Prom. Real/día</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl">{eggVariance >= 0 ? "📈" : "📉"}</p>
          <p className={`text-lg font-bold mt-1 ${eggVariance >= 0 ? "text-green-600" : "text-red-600"}`}>{eggVariance > 0 ? "+" : ""}{eggVariance}</p>
          <p className="text-xs text-slate-500">Vs Esperado</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl">⚠️</p>
          <p className="text-lg font-bold mt-1 text-red-600">{data.stockProjection.filter((s) => s.daysRemaining !== null && s.daysRemaining <= 7).length}</p>
          <p className="text-xs text-slate-500">Stock Crítico</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl">🔧</p>
          <p className="text-lg font-bold mt-1">{data.pendingMaintenance}</p>
          <p className="text-xs text-slate-500">Mant. Pendiente</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl">🌱</p>
          <p className="text-lg font-bold mt-1">{data.manure.currentStockKg} kg</p>
          <p className="text-xs text-slate-500">Gallinaza (+{data.manure.totalKgPerDay} kg/día)</p>
        </Card>
      </div>

      {/* ─── FCR: Conversión Alimenticia ─── */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-700 mb-3">🌾 Conversión Alimenticia (30 días)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="text-center">
            <p className="text-2xl">🌾</p>
            <p className="text-lg font-bold mt-1">{data.fcr.feedConsumed30d}</p>
            <p className="text-xs text-slate-500">kg Alimento Consumido</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl">🥚</p>
            <p className={`text-lg font-bold mt-1 ${fcrColor(data.fcr.fcrEggs)}`}>{data.fcr.fcrEggs}</p>
            <p className="text-xs text-slate-500">kg Alimento / Huevo</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl">🐣</p>
            <p className={`text-lg font-bold mt-1 ${data.fcr.fcrChicks > 0 ? fcrColor(data.fcr.fcrChicks) : "text-slate-400"}`}>{data.fcr.fcrChicks || "—"}</p>
            <p className="text-xs text-slate-500">kg Alimento / Pollito</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl">🍗</p>
            <p className={`text-lg font-bold mt-1 ${data.fcr.fcrMeat > 0 ? fcrColor(data.fcr.fcrMeat) : "text-slate-400"}`}>{data.fcr.fcrMeat || "—"}</p>
            <p className="text-xs text-slate-500">kg Alimento / kg Carne</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl">🐣</p>
            <p className={`text-lg font-bold mt-1 ${fcrColor(data.fcr.incubationEfficiency, true)}`}>{data.fcr.incubationEfficiency > 0 ? `${data.fcr.incubationEfficiency}%` : "—"}</p>
            <p className="text-xs text-slate-500">Eficiencia Incubación</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl">🍗</p>
            <p className="text-lg font-bold mt-1">{data.fcr.totalBirdsSold}</p>
            <p className="text-xs text-slate-500">Aves Vendidas ({data.fcr.totalMeatKg} kg)</p>
          </Card>
        </div>
      </div>

      {/* Stage Distribution & Stock Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Stage Distribution */}
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">🐔 Distribución por Etapa</h3>
          {data.stages.length > 0 ? (
            <div className="space-y-3">
              {data.stages.map((stage) => (
                <div key={stage.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge color={stageColors[stage.name] || "gray"}>{stage.name}</Badge>
                    <span className="text-sm font-semibold">{stage.count} gallina{stage.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-yellow-700">{stage.expectedEggsPerDay}</span>
                    <span className="text-xs text-slate-500 ml-1">huevos/día</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-sm font-semibold text-green-700">TOTAL ESPERADO</span>
                <span className="text-lg font-bold text-green-700">{data.totalExpectedEggsPerDay} huevos/día</span>
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-400 py-4">Sin etapas definidas</p>
          )}
        </Card>

        {/* Stock Projection */}
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">📦 Proyección de Stock de Alimento</h3>
          {data.stockProjection.length > 0 ? (
            <div className="space-y-2">
              {data.stockProjection.map((item) => {
                const isCritical = item.daysRemaining !== null && item.daysRemaining <= 7;
                const isWarning = item.daysRemaining !== null && item.daysRemaining > 7 && item.daysRemaining <= 14;
                return (
                  <div key={item.feedId} className={`p-3 rounded-lg ${isCritical ? "bg-red-50 border border-red-200" : isWarning ? "bg-yellow-50 border border-yellow-200" : "bg-slate-50"}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{item.feedName}</span>
                      <span className={`text-sm font-bold ${isCritical ? "text-red-600" : isWarning ? "text-yellow-600" : "text-green-600"}`}>
                        {item.daysRemaining !== null ? `${item.daysRemaining} días` : "∞"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>Stock: {item.currentStockKg} kg</span>
                      <span>Consumo: {item.dailyNeedKg} kg/día</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-4">Sin datos de programas</p>
          )}
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">📊 Producción de Huevos (últimos 14 días)</h3>
          {data.recentEggs.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.recentEggs.map((e) => ({
                fecha: new Date(e.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" }),
                huevos: e.total,
              })).reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="huevos" fill="#eab308" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-slate-400 py-8">Sin datos de producción aún</p>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">💵 Resumen Financiero (30 días)</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-green-700">Ingresos Totales</span>
              <span className="text-lg font-bold text-green-700">${Number(data.finance.income).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-red-700">Egresos Totales</span>
              <span className="text-lg font-bold text-red-700">${Number(data.finance.expenses).toLocaleString()}</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-lg ${Number(data.finance.profit) >= 0 ? "bg-blue-50" : "bg-orange-50"}`}>
              <span className={`text-sm font-medium ${Number(data.finance.profit) >= 0 ? "text-blue-700" : "text-orange-700"}`}>Ganancia Neta</span>
              <span className={`text-lg font-bold ${Number(data.finance.profit) >= 0 ? "text-blue-700" : "text-orange-700"}`}>${Number(data.finance.profit).toLocaleString()}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Feed vs Production Chart */}
      {data.feedChartData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">🌾 Alimento Consumido vs Producción de Huevos</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.feedChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" fontSize={11} />
              <YAxis yAxisId="left" fontSize={11} label={{ value: "kg", angle: -90, position: "insideLeft", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} label={{ value: "huevos", angle: 90, position: "insideRight", fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="alimento" stroke="#f97316" strokeWidth={2} name="Alimento (kg)" dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="huevos" stroke="#eab308" strokeWidth={2} name="Huevos" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <h3 className="font-semibold text-slate-700 mb-4">⚡ Acciones Rápidas</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <a href="/huevos" className="flex flex-col items-center gap-2 p-4 bg-farm-50 rounded-lg hover:bg-farm-100 transition-colors">
            <span className="text-3xl">🥚</span>
            <span className="text-sm font-medium text-center">Registrar Producción</span>
          </a>
          <a href="/inventario" className="flex flex-col items-center gap-2 p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
            <span className="text-3xl">📦</span>
            <span className="text-sm font-medium text-center">Inventario Huevos</span>
          </a>
          <a href="/ventas" className="flex flex-col items-center gap-2 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
            <span className="text-3xl">💰</span>
            <span className="text-sm font-medium text-center">Nueva Venta</span>
          </a>
          <a href="/alimentacion" className="flex flex-col items-center gap-2 p-4 bg-earth-100 rounded-lg hover:bg-earth-200 transition-colors">
            <span className="text-3xl">🌾</span>
            <span className="text-sm font-medium text-center">Gestionar Alimento</span>
          </a>
          <a href="/gallinas" className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <span className="text-3xl">🐔</span>
            <span className="text-sm font-medium text-center">Gestionar Gallinas</span>
          </a>
        </div>
      </Card>
    </div>
  );
}
