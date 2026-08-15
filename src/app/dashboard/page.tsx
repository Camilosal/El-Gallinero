"use client";

import { useEffect, useState } from "react";
import { Card, Modal, Input, Select, Button } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";

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
  eggs: {
    totalLast30: number;
    avgDaily: number;
    inventory?: { produced: number; sold: number; lost: number; available: number };
  };
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
  manure: { currentStockKg: number; totalKgPerDay: number; salesLast30d?: { totalKg: number; totalRevenue: string } };
  mortality: { total30d: number; rate: number; byCause: Record<string, number> };
  sanitaryAlerts: number;
  supplyAlerts: number;
}

// ─── Alert definition ───
interface Alert {
  id: string;
  icon: string;
  message: string;
  href: string;
  severity: "critical" | "warning";
}

interface TareasPendientes {
  eggCollectedToday: boolean;
  feedMovedToday: boolean;
  pendingSanitary: { id: string; name: string; type: string; dueDate: string; isOverdue: boolean } | null;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [tareas, setTareas] = useState<TareasPendientes | null>(null);
  const [dashHelp, setDashHelp] = useState(false);

  // ─── Quick sale state ───
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  const [quickSaleInv, setQuickSaleInv] = useState<{ size: string; available: number; price: number | null }[]>([]);
  const [quickSaleForm, setQuickSaleForm] = useState({ size: "", quantity: "1", buyer: "", pricePerUnit: "500" });
  const [quickSaleError, setQuickSaleError] = useState("");
  const [quickSaleSuccess, setQuickSaleSuccess] = useState(false);
  const { values: buyerOptions } = useCatalog("comprador");
  const { items: sizeOptions } = useCatalog("tamano_huevo");

  useEffect(() => {
    apiFetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
    apiFetch("/api/dashboard/tareas-pendientes")
      .then((r) => r.json())
      .then(setTareas)
      .catch(() => {});
    // Load egg inventory for quick sale
    apiFetch("/api/produccion/huevos/inventario")
      .then((r) => r.json())
      .then((d) => setQuickSaleInv(d.summary?.sizes || []))
      .catch(() => {});
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

  // ─── Build actionable alerts ───
  const alerts: Alert[] = [];

  // Critical feed stock (<=7 days remaining)
  const criticalFeeds = data.stockProjection.filter((s) => s.daysRemaining !== null && s.daysRemaining <= 7);
  if (criticalFeeds.length > 0) {
    alerts.push({
      id: "feed-critical",
      icon: "🌾",
      message: `${criticalFeeds.length} alimento${criticalFeeds.length > 1 ? "s" : ""} con stock crítico (${criticalFeeds.map((f) => f.feedName).join(", ")})`,
      href: "/dashboard/produccion?tab=alimentacion",
      severity: "critical",
    });
  }

  // Sanitary alerts
  if (data.sanitaryAlerts > 0) {
    alerts.push({
      id: "sanitary",
      icon: "💊",
      message: `${data.sanitaryAlerts} vacuna${data.sanitaryAlerts > 1 ? "s" : ""} o tratamiento${data.sanitaryAlerts > 1 ? "s" : ""} pendiente${data.sanitaryAlerts > 1 ? "s" : ""}`,
      href: "/dashboard/sanidad/calendario",
      severity: "critical",
    });
  }

  // Eggs expiring soon
  if (data.eggs.inventory && data.eggs.inventory.available > 50) {
    alerts.push({
      id: "eggs-expiring",
      icon: "🥚",
      message: `${data.eggs.inventory.available} huevos en inventario — priorizar venta`,
      href: "/dashboard/produccion?tab=inventario",
      severity: "warning",
    });
  }

  // Hens recommended for slaughter
  if (data.hens.recommendedForSlaughter > 0) {
    alerts.push({
      id: "slaughter-rec",
      icon: "⚠️",
      message: `${data.hens.recommendedForSlaughter} gallina${data.hens.recommendedForSlaughter > 1 ? "s" : ""} recomendada${data.hens.recommendedForSlaughter > 1 ? "s" : ""} para sacrificio`,
      href: "/dashboard/produccion?tab=gallinas",
      severity: "warning",
    });
  }

  // Broiler batches ready
  if (data.readyBatches > 0) {
    alerts.push({
      id: "batches-ready",
      icon: "🍗",
      message: `${data.readyBatches} lote${data.readyBatches > 1 ? "s" : ""} listo${data.readyBatches > 1 ? "s" : ""} para sacrificio`,
      href: "/dashboard/produccion?tab=carne",
      severity: "warning",
    });
  }

  // Pending maintenance
  if (data.pendingMaintenance > 0) {
    alerts.push({
      id: "maintenance",
      icon: "🔧",
      message: `${data.pendingMaintenance} mantenimiento${data.pendingMaintenance > 1 ? "s" : ""} pendiente${data.pendingMaintenance > 1 ? "s" : ""}`,
      href: "/dashboard/operaciones/mantenimiento",
      severity: "warning",
    });
  }

  // Supply alerts
  if (data.supplyAlerts > 0) {
    alerts.push({
      id: "supplies",
      icon: "🧰",
      message: `${data.supplyAlerts} insumo${data.supplyAlerts > 1 ? "s" : ""} con stock bajo`,
      href: "/dashboard/inventarios/insumos",
      severity: "warning",
    });
  }

  // Min feed days remaining for mini-stat
  const minFeedDays = data.stockProjection
    .filter((s) => s.daysRemaining !== null)
    .reduce((min, s) => Math.min(min, s.daysRemaining!), Infinity);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">🏡 Buenos días, Gallinero</h1>
            <p className="text-slate-500 text-sm mt-1">Esto es lo que necesita tu atención hoy</p>
          </div>
          <button onClick={() => setDashHelp(!dashHelp)} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors mt-1">❓ Ayuda</button>
        </div>
        {dashHelp && (
          <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 Panel Principal</p>
            <p>Este es tu centro de control diario. Aquí verás alertas críticas (stock bajo, tareas pendientes, sanitarias), tareas del día, un resumen rápido de producción/huevos/mortalidad y el estado del alimento. Desde aquí puedes acceder rápidamente a las acciones más comunes: registrar huevos, ventas rápidas y check-ins. Usa el menú lateral para navegar a las demás secciones.</p>
          </div>
        )}
      </div>

      {/* ─── 1. Alert Banner ─── */}
      {alerts.length > 0 ? (
        <div className="mb-6 space-y-2">
          {alerts.filter((a) => a.severity === "critical").map((alert) => (
            <a
              key={alert.id}
              href={alert.href}
              className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
            >
              <span className="text-2xl">{alert.icon}</span>
              <span className="flex-1 text-sm font-medium text-red-700">{alert.message}</span>
              <span className="text-xs text-red-500 font-medium whitespace-nowrap">Atender →</span>
            </a>
          ))}
          {alerts.filter((a) => a.severity === "warning").map((alert) => (
            <a
              key={alert.id}
              href={alert.href}
              className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors"
            >
              <span className="text-2xl">{alert.icon}</span>
              <span className="flex-1 text-sm font-medium text-yellow-700">{alert.message}</span>
              <span className="text-xs text-yellow-600 font-medium whitespace-nowrap">Ver →</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-xl text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-green-700 font-medium">Todo en orden hoy</p>
          <p className="text-green-600 text-sm mt-1">No hay alertas pendientes</p>
        </div>
      )}

      {/* ─── 2. Daily Check-ins ─── */}
      {tareas && (!tareas.eggCollectedToday || !tareas.feedMovedToday || tareas.pendingSanitary) && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Pendientes de hoy</h2>
          <div className="space-y-2">
            {!tareas.eggCollectedToday && (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <span className="text-2xl">🥚</span>
                <span className="flex-1 text-sm font-medium text-yellow-700">¿Ya recogiste huevos hoy?</span>
                <a href="/dashboard/produccion?tab=huevos" className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700">
                  Recoger ahora
                </a>
              </div>
            )}
            {!tareas.feedMovedToday && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-2xl">🌾</span>
                <span className="flex-1 text-sm font-medium text-amber-700">No hay registro de alimentación hoy</span>
                <a href="/dashboard/produccion?tab=alimentacion" className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700">
                  Ver alimentación
                </a>
              </div>
            )}
            {tareas.pendingSanitary && (
              <div className={`flex items-center gap-3 p-4 border rounded-xl ${tareas.pendingSanitary.isOverdue ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
                <span className="text-2xl">💊</span>
                <span className={`flex-1 text-sm font-medium ${tareas.pendingSanitary.isOverdue ? "text-red-700" : "text-blue-700"}`}>
                  {tareas.pendingSanitary.isOverdue ? "Vencido: " : "Pendiente: "}{tareas.pendingSanitary.name}
                </span>
                <a href={`/dashboard/sanidad/control?pendiente=${tareas.pendingSanitary.id}`} className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg ${tareas.pendingSanitary.isOverdue ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                  Aplicar
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 3. Task Buttons ─── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Tareas del día</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <a
            href="/dashboard/produccion?tab=huevos"
            className="flex flex-col items-center gap-3 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-2xl hover:bg-yellow-100 hover:border-yellow-300 transition-all"
          >
            <span className="text-4xl">🥚</span>
            <span className="text-sm font-semibold text-yellow-800 text-center">Recoger Huevos</span>
            <span className="text-xs text-yellow-600">{data.eggs.avgDaily} prom/día</span>
          </a>
          <a
            href="/dashboard/produccion?tab=alimentacion"
            className="flex flex-col items-center gap-3 p-6 bg-amber-50 border-2 border-amber-200 rounded-2xl hover:bg-amber-100 hover:border-amber-300 transition-all"
          >
            <span className="text-4xl">🌾</span>
            <span className="text-sm font-semibold text-amber-800 text-center">Registrar Alimentación</span>
            <span className="text-xs text-amber-600">
              {minFeedDays === Infinity ? "Stock OK" : `${minFeedDays} días de stock`}
            </span>
          </a>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setQuickSaleOpen(true); }}
            className="flex flex-col items-center gap-3 p-6 bg-green-50 border-2 border-green-200 rounded-2xl hover:bg-green-100 hover:border-green-300 transition-all"
          >
            <span className="text-4xl">💰</span>
            <span className="text-sm font-semibold text-green-800 text-center">Registrar Venta</span>
            <span className="text-xs text-green-600">${Number(data.sales.totalRevenue).toLocaleString()} este mes</span>
          </a>
          <a
            href="/dashboard/sanidad/control"
            className="flex flex-col items-center gap-3 p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl hover:bg-blue-100 hover:border-blue-300 transition-all"
          >
            <span className="text-4xl">💊</span>
            <span className="text-sm font-semibold text-blue-800 text-center">Control Sanitario</span>
            <span className="text-xs text-blue-600">
              {data.sanitaryAlerts > 0 ? `${data.sanitaryAlerts} pendiente${data.sanitaryAlerts > 1 ? "s" : ""}` : "Al día"}
            </span>
          </a>
          <a
            href="/dashboard/escanear"
            className="flex flex-col items-center gap-3 p-6 bg-indigo-50 border-2 border-indigo-200 rounded-2xl hover:bg-indigo-100 hover:border-indigo-300 transition-all"
          >
            <span className="text-4xl">📷</span>
            <span className="text-sm font-semibold text-indigo-800 text-center">Escanear Ave</span>
            <span className="text-xs text-indigo-600">{data.hens.active} aves activas</span>
          </a>
        </div>
      </div>

      {/* ─── 4. Mini Summary ─── */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Resumen rápido</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <QuickStat icon="🐔" label="Gallinas activas" value={data.hens.active} />
          <QuickStat icon="🥚" label="Huevos hoy" value={`${data.eggs.avgDaily} prom`} />
          <QuickStat
            icon="🌾"
            label="Alimento"
            value={minFeedDays === Infinity ? "OK" : `${minFeedDays}d`}
            alert={criticalFeeds.length > 0}
          />
          <QuickStat
            icon="💰"
            label="Balance mes"
            value={`$${Number(data.finance.profit).toLocaleString()}`}
            alert={Number(data.finance.profit) < 0}
          />
          <QuickStat icon="🔔" label="Alertas" value={alerts.length} alert={alerts.length > 0} />
        </div>
      </div>

      {/* ─── 5. Collapsible Details ─── */}
      <div className="mb-6">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
        >
          <span className={`transition-transform ${showDetails ? "rotate-90" : ""}`}>▶</span>
          <span>{showDetails ? "Ocultar detalles" : "Ver más detalles"}</span>
        </button>

        {showDetails && (
          <div className="mt-4 space-y-6">
            {/* Stage Distribution & Stock Projection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4">🐔 Distribución por Etapa</h3>
                {data.stages.length > 0 ? (
                  <div className="space-y-2">
                    {data.stages.map((stage) => (
                      <div key={stage.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{stage.name}</span>
                          <span className="text-xs text-slate-500">{stage.count} aves</span>
                        </div>
                        <span className="text-sm font-bold text-yellow-700">{stage.expectedEggsPerDay} huevos/día</span>
                      </div>
                    ))}
                    <div className="flex justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-sm font-semibold text-green-700">TOTAL</span>
                      <span className="text-sm font-bold text-green-700">{data.totalExpectedEggsPerDay} huevos/día</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-4 text-sm">Sin etapas definidas</p>
                )}
              </Card>

              <Card>
                <h3 className="font-semibold text-slate-700 mb-4">📦 Stock de Alimento</h3>
                {data.stockProjection.length > 0 ? (
                  <div className="space-y-2">
                    {data.stockProjection.map((item) => {
                      const isCritical = item.daysRemaining !== null && item.daysRemaining <= 7;
                      const isWarning = item.daysRemaining !== null && item.daysRemaining > 7 && item.daysRemaining <= 14;
                      return (
                        <div key={item.feedId} className={`p-2 rounded-lg ${isCritical ? "bg-red-50 border border-red-200" : isWarning ? "bg-yellow-50 border border-yellow-200" : "bg-slate-50"}`}>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{item.feedName}</span>
                            <span className={`text-sm font-bold ${isCritical ? "text-red-600" : isWarning ? "text-yellow-600" : "text-green-600"}`}>
                              {item.daysRemaining !== null ? `${item.daysRemaining} días` : "∞"}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                            <span>{item.currentStockKg} kg</span>
                            <span>{item.dailyNeedKg} kg/día</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-4 text-sm">Sin datos de programas</p>
                )}
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4">📊 Huevos (últimos 14 días)</h3>
                {data.recentEggs.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.recentEggs.map((e) => ({
                      fecha: new Date(e.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" }),
                      huevos: e.total,
                    })).reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="huevos" fill="#eab308" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-slate-400 py-8 text-sm">Sin datos aún</p>
                )}
              </Card>

              <Card>
                <h3 className="font-semibold text-slate-700 mb-4">💵 Finanzas (30 días)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                    <span className="text-sm text-green-700">Ingresos</span>
                    <span className="text-sm font-bold text-green-700">${Number(data.finance.income).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-red-50 rounded-lg">
                    <span className="text-sm text-red-700">Egresos</span>
                    <span className="text-sm font-bold text-red-700">${Number(data.finance.expenses).toLocaleString()}</span>
                  </div>
                  <div className={`flex justify-between items-center p-2 rounded-lg ${Number(data.finance.profit) >= 0 ? "bg-blue-50" : "bg-orange-50"}`}>
                    <span className={`text-sm font-medium ${Number(data.finance.profit) >= 0 ? "text-blue-700" : "text-orange-700"}`}>Balance</span>
                    <span className={`text-sm font-bold ${Number(data.finance.profit) >= 0 ? "text-blue-700" : "text-orange-700"}`}>${Number(data.finance.profit).toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Feed vs Production Chart */}
            {data.feedChartData.length > 0 && (
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4">🌾 Alimento vs Huevos</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.feedChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" fontSize={10} />
                    <YAxis yAxisId="left" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" fontSize={10} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="alimento" stroke="#f97316" strokeWidth={2} name="Alimento (kg)" dot={{ r: 2 }} />
                    <Line yAxisId="right" type="monotone" dataKey="huevos" stroke="#eab308" strokeWidth={2} name="Huevos" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* FCR */}
            <Card>
              <h3 className="font-semibold text-slate-700 mb-3">🌾 Conversión Alimenticia (30 días)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold">{data.fcr.feedConsumed30d}</p>
                  <p className="text-xs text-slate-500">kg alimento</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold">{data.fcr.fcrEggs}</p>
                  <p className="text-xs text-slate-500">kg/huevo</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold">{data.fcr.totalBirdsSold}</p>
                  <p className="text-xs text-slate-500">aves vendidas</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold">{data.fcr.incubationEfficiency > 0 ? `${data.fcr.incubationEfficiency}%` : "—"}</p>
                  <p className="text-xs text-slate-500">ef. incubación</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ─── Quick Sale Modal ─── */}
      <Modal open={quickSaleOpen} onClose={() => { setQuickSaleOpen(false); setQuickSaleSuccess(false); setQuickSaleError(""); }} title="💰 Venta rápida de huevos">
        <div className="space-y-4">
          {quickSaleError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{quickSaleError}</p>}
          {quickSaleSuccess ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-lg font-semibold text-green-700">Venta registrada</p>
              <Button className="mt-4" onClick={() => { setQuickSaleOpen(false); setQuickSaleSuccess(false); setQuickSaleForm({ size: "", quantity: "1", buyer: "", pricePerUnit: "500" }); }}>Cerrar</Button>
            </div>
          ) : (
            <>
              {/* Inventory preview */}
              {quickSaleInv.some((i) => i.available > 0) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {quickSaleInv.filter((i) => i.available > 0).map((i) => (
                    <button
                      key={i.size}
                      type="button"
                      onClick={() => {
                        const price = i.price || sizeOptions.find((o) => o.value === i.size)?.price || "500";
                        setQuickSaleForm({ ...quickSaleForm, size: i.size, pricePerUnit: String(price) });
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${quickSaleForm.size === i.size ? "bg-green-600 text-white border-green-600" : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"}`}
                    >
                      {i.size}: <strong>{i.available}</strong> disp{i.price ? ` · $${Number(i.price).toLocaleString()}/u` : ""}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Select label="Tamaño" value={quickSaleForm.size} onChange={(e) => {
                  const price = sizeOptions.find((o) => o.value === e.target.value)?.price || "500";
                  setQuickSaleForm({ ...quickSaleForm, size: e.target.value, pricePerUnit: String(price) });
                }}>
                  <option value="">— Selecciona —</option>
                  {quickSaleInv.filter((i) => i.available > 0).map((i) => (
                    <option key={i.size} value={i.size}>{i.size} ({i.available} disp)</option>
                  ))}
                </Select>
                <Input label="Cantidad (huevos)" type="number" min="1" value={quickSaleForm.quantity} onChange={(e) => setQuickSaleForm({ ...quickSaleForm, quantity: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Precio por huevo ($}" type="number" step="1" value={quickSaleForm.pricePerUnit} onChange={(e) => setQuickSaleForm({ ...quickSaleForm, pricePerUnit: e.target.value })} />
                <Input label="Comprador" value={quickSaleForm.buyer} onChange={(e) => setQuickSaleForm({ ...quickSaleForm, buyer: e.target.value })} placeholder="Nombre del cliente" list="dash-buyers" />
              </div>
              <datalist id="dash-buyers">
                {buyerOptions.map((b) => <option key={b} value={b} />)}
              </datalist>
              {quickSaleForm.size && quickSaleForm.quantity && (
                <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
                  <p>Total: <strong className="text-xl">${(Number(quickSaleForm.quantity) * Number(quickSaleForm.pricePerUnit)).toLocaleString()}</strong></p>
                  <p className="text-xs">{quickSaleForm.quantity} huevos × ${Number(quickSaleForm.pricePerUnit).toLocaleString()}</p>
                </div>
              )}
              <div className="flex gap-3">
                <Button onClick={async () => {
                  setQuickSaleError("");
                  const qty = Number(quickSaleForm.quantity);
                  if (!quickSaleForm.size) return setQuickSaleError("Selecciona un tamaño");
                  if (!qty || qty < 1) return setQuickSaleError("Cantidad inválida");
                  const price = Number(quickSaleForm.pricePerUnit);
                  if (!price || price <= 0) return setQuickSaleError("Precio inválido");
                  const res = await apiFetch("/api/finanzas/finanzas/ventas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      date: new Date().toISOString().split("T")[0],
                      buyer: quickSaleForm.buyer || null,
                      notes: null,
                      isCredit: false,
                      dueDate: null,
                      items: [{ size: quickSaleForm.size, quantity: qty, presentations: qty, pricePerUnit: price, presentation: null }],
                    }),
                  });
                  if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    return setQuickSaleError(d.error || "Error al guardar");
                  }
                  setQuickSaleSuccess(true);
                }} disabled={!quickSaleForm.size || !quickSaleForm.quantity}>
                  Registrar Venta
                </Button>
                <Button variant="secondary" onClick={() => setQuickSaleOpen(false)}>Cancelar</Button>
              </div>
              <p className="text-xs text-slate-400 text-center">¿Necesitas más opciones? Usa el <a href="/dashboard/finanzas/ventas" className="text-green-600 hover:underline">formulario completo</a></p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ─── Quick stat component ───
function QuickStat({ icon, label, value, alert }: { icon: string; label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border text-center ${alert ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className="text-lg">{icon}</p>
      <p className={`text-lg font-bold ${alert ? "text-red-600" : "text-slate-800"}`}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
