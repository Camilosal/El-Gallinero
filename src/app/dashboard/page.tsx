"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  BarChart3,
  Bird,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Egg,
  HelpCircle,
  Home,
  Lightbulb,
  Package,
  PackageOpen,
  Pill,
  Stethoscope,
  Wheat,
  Wrench,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { Card, Modal, Input, Select, Button, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
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
  hens: { total: number; active: number; laying?: number; broody: number; sick: number; recommendedForSlaughter: number };
  roosters: { required: number; active: number; deficit: number; surplus: number };
  totalAnimals?: number;
  totalBirds?: number;
  species?: { species: string; label: string; count: number }[];
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
  eggApplicable: boolean;
  eggCollectedToday: boolean;
  feedApplicable: boolean;
  feedMovedToday: boolean;
  setup: {
    farmProfileConfigured: boolean;
    locationsConfigured: boolean;
    animalsRegistered: boolean;
    starterInventoryConfigured: boolean;
    contactsConfigured: boolean;
    budgetConfigured: boolean;
    assetsRegistered: boolean;
    sanitaryConfigured: boolean;
  };
  pendingSanitary: { id: string; name: string; type: string; dueDate: string; isOverdue: boolean } | null;
  maintenanceDue: { id: string; title: string; scheduledDate: string; locationName: string | null; assetName: string | null; isOverdue: boolean }[];
  maintenanceDueCount: number;
  assetsNeedAttention: number;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [tareas, setTareas] = useState<TareasPendientes | null>(null);
  const [dashHelp, setDashHelp] = useState(false);
  const [search, setSearch] = useState("");

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
          <Bird className="w-12 h-12 text-green-600 mx-auto mb-4 animate-bounce" aria-hidden="true" />
          <p className="text-slate-500">Cargando datos del gallinero...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-500">Error cargando datos</p>;
  }

  const dailyChecklistPending = Boolean(tareas && (
    (tareas.eggApplicable && !tareas.eggCollectedToday)
    || (tareas.feedApplicable && !tareas.feedMovedToday)
    || tareas.pendingSanitary || tareas.maintenanceDue.length > 0 || tareas.assetsNeedAttention > 0
  ));
  const setupSteps = tareas ? [
    { done: tareas.setup.farmProfileConfigured, title: "Completa los datos de la granja", description: "Indica nombre, municipio y responsable; la ubicación y fechas se pueden ampliar.", href: "/dashboard/configuracion/catalogos?tab=parametros", icon: "home" },
    { done: tareas.setup.locationsConfigured, title: "Define los lugares de manejo", description: "Crea corrales, galpones, jaulas o potreros.", href: "/dashboard/ubicaciones", icon: "map-pin" },
    { done: tareas.setup.animalsRegistered, title: "Registra el primer ingreso", description: "Deja documentados especie, origen y destino.", href: "/dashboard/produccion/adquisiciones", icon: "paw-print" },
    { done: tareas.setup.starterInventoryConfigured, title: "Carga los inventarios de arranque", description: "Registra existencias iniciales de alimentos e insumos.", href: "/dashboard/almacen", icon: "wheat" },
    { done: tareas.setup.contactsConfigured, title: "Registra clientes y proveedores", description: "Agrega al menos un cliente y un proveedor propios.", href: "/dashboard/configuracion/catalogos?tab=listas&category=proveedor", icon: "handshake" },
    { done: tareas.setup.budgetConfigured, title: "Crea el presupuesto inicial", description: "Comienza en $0 y agrega las metas cuando las definas.", href: "/dashboard/finanzas/presupuestos?nuevo=base", icon: "money" },
    { done: tareas.setup.sanitaryConfigured, title: "Revisa el manejo sanitario inicial", description: "Valida las actividades sugeridas y ajusta el calendario a tus animales.", href: "/dashboard/sanidad/calendario", icon: "pill" },
    { done: tareas.setup.assetsRegistered, title: "Registra activos y equipos", description: "Incluye equipos, herramientas y estructuras de la granja.", href: "/dashboard/operaciones/activos", icon: "equipment" },
  ] : [];
  const completedSetupSteps = setupSteps.filter((step) => step.done).length;

  // ─── Build actionable alerts ───
  const alerts: Alert[] = [];

  // Critical feed stock (<=7 days remaining)
  const criticalFeeds = data.stockProjection.filter((s) => s.daysRemaining !== null && s.daysRemaining <= 7);
  if (criticalFeeds.length > 0) {
    alerts.push({
      id: "feed-critical",
      icon: "wheat",
      message: `${criticalFeeds.length} alimento${criticalFeeds.length > 1 ? "s" : ""} con stock crítico (${criticalFeeds.map((f) => f.feedName).join(", ")})`,
      href: "/dashboard/produccion?tab=alimentacion",
      severity: "critical",
    });
  }

  // Sanitary alerts
  if (data.sanitaryAlerts > 0) {
    alerts.push({
      id: "sanitary",
      icon: "pill",
      message: `${data.sanitaryAlerts} vacuna${data.sanitaryAlerts > 1 ? "s" : ""} o tratamiento${data.sanitaryAlerts > 1 ? "s" : ""} pendiente${data.sanitaryAlerts > 1 ? "s" : ""}`,
      href: "/dashboard/sanidad/calendario",
      severity: "critical",
    });
  }

  // Eggs expiring soon
  if (data.eggs.inventory && data.eggs.inventory.available > 50) {
    alerts.push({
      id: "eggs-expiring",
      icon: "egg",
      message: `${data.eggs.inventory.available} huevos en inventario — priorizar venta`,
      href: "/dashboard/produccion?tab=inventario",
      severity: "warning",
    });
  }

  // Hens recommended for slaughter
  if (data.hens.recommendedForSlaughter > 0) {
    alerts.push({
      id: "slaughter-rec",
      icon: "warning",
      message: `${data.hens.recommendedForSlaughter} gallina${data.hens.recommendedForSlaughter > 1 ? "s" : ""} recomendada${data.hens.recommendedForSlaughter > 1 ? "s" : ""} para sacrificio`,
      href: "/dashboard/produccion?tab=gallinas",
      severity: "warning",
    });
  }

  // Broiler batches ready
  if (data.readyBatches > 0) {
    alerts.push({
      id: "batches-ready",
      icon: "meat",
      message: `${data.readyBatches} lote${data.readyBatches > 1 ? "s" : ""} listo${data.readyBatches > 1 ? "s" : ""} para sacrificio`,
      href: "/dashboard/produccion?tab=carne",
      severity: "warning",
    });
  }

  // Pending maintenance
  if (data.pendingMaintenance > 0) {
    alerts.push({
      id: "maintenance",
      icon: "wrench",
      message: `${data.pendingMaintenance} mantenimiento${data.pendingMaintenance > 1 ? "s" : ""} pendiente${data.pendingMaintenance > 1 ? "s" : ""}`,
      href: "/dashboard/operaciones/mantenimiento",
      severity: "warning",
    });
  }

  // Supply alerts
  if (data.supplyAlerts > 0) {
    alerts.push({
      id: "supplies",
      icon: "package-open",
      message: `${data.supplyAlerts} insumo${data.supplyAlerts > 1 ? "s" : ""} con stock bajo`,
      href: "/dashboard/inventarios/insumos",
      severity: "warning",
    });
  }

  // Min feed days remaining for mini-stat
  const minFeedDays = data.stockProjection
    .filter((s) => s.daysRemaining !== null)
    .reduce((min, s) => Math.min(min, s.daysRemaining!), Infinity);

  // Desglose de la parvada con la misma definición de inventario del resto de la app.
  const speciesBreakdown = (data.species ?? [])
    .filter((s) => s.count > 0)
    .map((s) => `${s.count} ${s.label.toLowerCase()}`)
    .join(" · ");
  const flockHint = [
    speciesBreakdown,
    data.hens.laying != null ? `${data.hens.laying} en postura` : "",
  ].filter(Boolean).join(" · ");

  const hasSearch = search.trim().length > 0;
  const visibleAlerts = hasSearch
    ? alerts.filter((a) => matchesTextQuery(search, [a.message, a.severity === "critical" ? "critica urgente" : "advertencia"]))
    : alerts;
  const visibleSetupSteps = hasSearch
    ? setupSteps.filter((s) => matchesTextQuery(search, [s.title, s.description, s.done ? "completado" : "por completar"]))
    : setupSteps;
  const visibleMaintenanceDue = tareas
    ? hasSearch
      ? tareas.maintenanceDue.filter((t) => matchesTextQuery(search, [t.title, t.assetName, t.locationName, t.scheduledDate, t.isOverdue ? "vencido" : "proximo"]))
      : tareas.maintenanceDue
    : [];
  const showPendingEgg = Boolean(
    tareas &&
      tareas.eggApplicable &&
      !tareas.eggCollectedToday &&
      (!hasSearch || matchesTextQuery(search, ["huevos hoy recoger recoleccion pendiente"])),
  );
  const showPendingFeed = Boolean(
    tareas &&
      tareas.feedApplicable &&
      !tareas.feedMovedToday &&
      (!hasSearch || matchesTextQuery(search, ["alimentacion alimento comida consumo registro pendiente"])),
  );
  const showPendingSanitary = Boolean(
    tareas?.pendingSanitary &&
      (!hasSearch ||
        matchesTextQuery(search, [
          tareas.pendingSanitary.name,
          tareas.pendingSanitary.type,
          tareas.pendingSanitary.isOverdue ? "vencido sanidad vacuna" : "pendiente sanidad vacuna",
        ])),
  );
  const showAssetsAttention = Boolean(
    tareas &&
      tareas.assetsNeedAttention > 0 &&
      (!hasSearch || matchesTextQuery(search, ["equipos activos mantenimiento atencion"])),
  );
  const hasVisiblePending =
    showPendingEgg || showPendingFeed || showPendingSanitary || visibleMaintenanceDue.length > 0 || showAssetsAttention;

  const taskCards = [
    {
      id: "eggs",
      visible: (!tareas || tareas.eggApplicable) && (!hasSearch || matchesTextQuery(search, ["recoger huevos postura recoleccion", data.eggs.avgDaily])),
    },
    {
      id: "feed",
      visible: (!tareas || tareas.feedApplicable) && (!hasSearch || matchesTextQuery(search, ["registrar alimentacion alimento concentrado stock", minFeedDays])),
    },
    {
      id: "sale",
      visible: !hasSearch || matchesTextQuery(search, ["registrar venta ingresos dinero facturar", data.sales.totalRevenue]),
    },
    {
      id: "sanitary",
      visible: !hasSearch || matchesTextQuery(search, ["plan sanitario vacunas salud sanidad", data.sanitaryAlerts]),
    },
  ];
  const visibleTaskIds = new Set(taskCards.filter((c) => c.visible).map((c) => c.id));

  const quickStatItems = [
    { id: "animals", visible: !hasSearch || matchesTextQuery(search, ["animales inventario parvada gallinas gallos", flockHint, data.totalAnimals ?? data.hens.active]) },
    { id: "eggs", visible: !hasSearch || matchesTextQuery(search, ["huevos hoy promedio postura", data.eggs.avgDaily]) },
    { id: "feed", visible: !hasSearch || matchesTextQuery(search, ["alimento dias stock concentrado", minFeedDays]) },
    { id: "finance", visible: !hasSearch || matchesTextQuery(search, ["balance mes finanzas dinero utilidad", data.finance.profit]) },
    { id: "alerts", visible: !hasSearch || matchesTextQuery(search, ["alertas avisos notificaciones", alerts.length]) },
  ];
  const visibleStatIds = new Set(quickStatItems.filter((s) => s.visible).map((s) => s.id));
  const visibleStages = hasSearch
    ? data.stages.filter((s) => matchesTextQuery(search, [s.name, s.count, s.expectedEggsPerDay]))
    : data.stages;
  const visibleStockProjection = hasSearch
    ? data.stockProjection.filter((s) => matchesTextQuery(search, [s.feedName, s.currentStockKg, s.daysRemaining]))
    : data.stockProjection;
  const noHomeMatches =
    hasSearch &&
    visibleAlerts.length === 0 &&
    visibleSetupSteps.length === 0 &&
    !hasVisiblePending &&
    visibleTaskIds.size === 0 &&
    visibleStatIds.size === 0 &&
    visibleStages.length === 0 &&
    visibleStockProjection.length === 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Home className="w-6 h-6 text-green-700 shrink-0" aria-hidden="true" />
              <span>Buenos días, Gallinero</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">Esto es lo que necesita tu atención hoy</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => setDashHelp(!dashHelp)} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors mt-1">
              <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ayuda</span>
            </button>
          </div>
        </div>
        {dashHelp && (
          <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
              <span>Panel Principal</span>
            </p>
            <p>Este es tu centro de control diario. Aquí verás alertas críticas (stock bajo, tareas pendientes, sanitarias), tareas del día, un resumen rápido de producción/huevos/mortalidad y el estado del alimento. Usa <strong>Crear</strong> para encontrar los registros y formularios de los distintos módulos; las tareas del día y el menú lateral siguen disponibles para tus accesos frecuentes.</p>
          </div>
        )}
      </div>

      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Buscar alertas, pendientes, tareas o indicadores en inicio..."
        className="mb-6"
      />

      {noHomeMatches ? (
        <Card className="mb-6">
          <EmptyState icon="home" message="No hay elementos en inicio que coincidan con la búsqueda" />
        </Card>
      ) : null}

      {/* ─── 1. Alert Banner ─── */}
      {visibleAlerts.length > 0 ? (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {visibleAlerts.filter((a) => a.severity === "critical").map((alert) => (
            <a
              key={alert.id}
              href={alert.href}
              className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
            >
              <AppIcon icon={alert.icon} className="w-5 h-5 text-red-600 shrink-0" />
              <span className="flex-1 text-sm font-medium text-red-700">{alert.message}</span>
              <span className="text-xs text-red-500 font-medium whitespace-nowrap">Atender →</span>
            </a>
          ))}
          {visibleAlerts.filter((a) => a.severity === "warning").map((alert) => (
            <a
              key={alert.id}
              href={alert.href}
              className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors"
            >
              <AppIcon icon={alert.icon} className="w-5 h-5 text-yellow-700 shrink-0" />
              <span className="flex-1 text-sm font-medium text-yellow-700">{alert.message}</span>
              <span className="text-xs text-yellow-600 font-medium whitespace-nowrap">Ver →</span>
            </a>
          ))}
        </div>
      ) : !hasSearch && tareas && !dailyChecklistPending ? (
        <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-xl text-center">
          <CheckCircle2 className="w-9 h-9 text-green-600 mx-auto mb-2" aria-hidden="true" />
          <p className="text-green-700 font-medium">Sin alertas operativas para atender hoy</p>
          <p className="text-green-600 text-sm mt-1">Las tareas de postura y alimentación solo aparecen cuando aplican a tus animales y programas.</p>
        </div>
      ) : null}

      {completedSetupSteps < setupSteps.length && visibleSetupSteps.length > 0 && (
        <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5" aria-labelledby="setup-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="setup-title" className="font-semibold text-blue-950">Prepara tu granja</h2>
              <p className="mt-1 text-sm text-blue-800">Sigue estos pasos para dejar listos los registros básicos.</p>
            </div>
            <span className="text-xs font-medium text-blue-700">{completedSetupSteps} de {setupSteps.length} pasos completados</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {visibleSetupSteps.map((step) => (
              step.done ? (
                <div key={step.title} className="rounded-lg border border-green-200 bg-green-50 p-3" aria-label={`${step.title}: completado`}>
                  <div className="flex items-center justify-between gap-2">
                    <AppIcon icon={step.icon} className="w-5 h-5 text-green-700" />
                    <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-green-700">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" /> Completado
                    </span>
                  </div>
                  <span className="mt-2 block text-sm font-semibold text-slate-800">{step.title}</span>
                  <span className="mt-1 block text-xs text-slate-600">{step.description}</span>
                </div>
              ) : (
                <a key={step.title} href={step.href} className="rounded-lg border border-blue-200 bg-white p-3 transition hover:border-blue-400 hover:bg-blue-50">
                  <div className="flex items-center justify-between gap-2">
                    <AppIcon icon={step.icon} className="w-5 h-5 text-blue-700" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">Por completar</span>
                  </div>
                  <span className="mt-2 block text-sm font-semibold text-slate-800">{step.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">{step.description}</span>
                </a>
              )
            ))}
          </div>
        </section>
      )}

      {/* ─── 2. Daily Check-ins ─── */}
      {tareas && hasVisiblePending && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Pendientes y próximos 7 días</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {showPendingEgg && (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <Egg className="w-6 h-6 text-yellow-600 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-sm font-medium text-yellow-700">¿Ya recogiste huevos hoy?</span>
                <a href="/dashboard/produccion?tab=huevos&nuevo=1" className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700">
                  Recoger ahora
                </a>
              </div>
            )}
            {showPendingFeed && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <Wheat className="w-6 h-6 text-amber-600 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-sm font-medium text-amber-700">No hay registro de alimentación hoy</span>
                <a href="/dashboard/produccion?tab=alimentacion&subtab=movimientos&nuevo=movimiento" className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700">
                  Ver alimentación
                </a>
              </div>
            )}
            {showPendingSanitary && tareas.pendingSanitary && (
              <div className={`flex items-center gap-3 p-4 border rounded-xl ${tareas.pendingSanitary.isOverdue ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
                <Pill className={`w-6 h-6 shrink-0 ${tareas.pendingSanitary.isOverdue ? "text-red-600" : "text-blue-600"}`} aria-hidden="true" />
                <span className={`flex-1 text-sm font-medium ${tareas.pendingSanitary.isOverdue ? "text-red-700" : "text-blue-700"}`}>
                  {tareas.pendingSanitary.isOverdue ? "Vencido: " : "Pendiente: "}{tareas.pendingSanitary.name}
                </span>
                <a href={`/dashboard/sanidad/control?pendiente=${tareas.pendingSanitary.id}`} className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg ${tareas.pendingSanitary.isOverdue ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                  Aplicar
                </a>
              </div>
            )}
            {visibleMaintenanceDue.map((task) => (
              <div key={task.id} className={`flex items-center gap-3 rounded-xl border p-4 ${task.isOverdue ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}`}>
                <Wrench className={`w-6 h-6 shrink-0 ${task.isOverdue ? "text-red-600" : "text-orange-600"}`} aria-hidden="true" />
                <span className={`flex-1 text-sm font-medium ${task.isOverdue ? "text-red-700" : "text-orange-800"}`}>
                  {task.isOverdue ? "Vencido: " : "Próximo: "}{task.title}
                  <span className="mt-1 block text-xs font-normal">{task.assetName ? `${task.assetName} · ` : ""}{task.locationName || "Finca"} · {new Date(`${task.scheduledDate}T12:00:00`).toLocaleDateString("es-CO")}</span>
                </span>
                <a href="/dashboard/operaciones/mantenimiento" className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${task.isOverdue ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`}>Revisar</a>
              </div>
            ))}
            {showAssetsAttention && (
              <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
                <PackageOpen className="w-6 h-6 text-orange-600 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-sm font-medium text-orange-800">{tareas.assetsNeedAttention} equipo{tareas.assetsNeedAttention === 1 ? "" : "s"} requiere{tareas.assetsNeedAttention === 1 ? "" : "n"} atención</span>
                <a href="/dashboard/operaciones/activos" className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700">Ver equipos</a>
              </div>
            )}
          </div>
          {tareas.maintenanceDueCount > tareas.maintenanceDue.length && (
            <a href="/dashboard/operaciones/mantenimiento" className="mt-3 inline-block text-sm font-medium text-green-700 hover:underline">
              Ver las {tareas.maintenanceDueCount - tareas.maintenanceDue.length} tareas restantes →
            </a>
          )}
        </div>
      )}

      {/* ─── 3. Task Buttons ─── */}
      {visibleTaskIds.size > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Tareas del día</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleTaskIds.has("eggs") && <a
              href="/dashboard/produccion?tab=huevos&nuevo=1"
              className="flex flex-col items-center gap-3 p-6 bg-yellow-50 border-2 border-yellow-200 rounded-2xl hover:bg-yellow-100 hover:border-yellow-300 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-700">
                <Egg className="w-6 h-6" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-yellow-800 text-center">Recoger Huevos</span>
              <span className="text-xs text-yellow-600">{data.eggs.avgDaily} prom/día</span>
            </a>}
            {visibleTaskIds.has("feed") && <a
              href="/dashboard/produccion?tab=alimentacion&subtab=movimientos&nuevo=movimiento"
              className="flex flex-col items-center gap-3 p-6 bg-amber-50 border-2 border-amber-200 rounded-2xl hover:bg-amber-100 hover:border-amber-300 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700">
                <Wheat className="w-6 h-6" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-amber-800 text-center">Registrar Alimentación</span>
              <span className="text-xs text-amber-600">
                {minFeedDays === Infinity ? "Stock OK" : `${minFeedDays} días de stock`}
              </span>
            </a>}
            {visibleTaskIds.has("sale") && <a
              href="#"
              onClick={(e) => { e.preventDefault(); setQuickSaleOpen(true); }}
              className="flex flex-col items-center gap-3 p-6 bg-green-50 border-2 border-green-200 rounded-2xl hover:bg-green-100 hover:border-green-300 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-green-700">
                <CircleDollarSign className="w-6 h-6" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-green-800 text-center">Registrar Venta</span>
              <span className="text-xs text-green-600">${Number(data.sales.totalRevenue).toLocaleString()} este mes</span>
            </a>}
            {visibleTaskIds.has("sanitary") && <a
              href="/dashboard/sanidad"
              className="flex flex-col items-center gap-3 p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl hover:bg-blue-100 hover:border-blue-300 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700">
                <Stethoscope className="w-6 h-6" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-blue-800 text-center">Plan Sanitario</span>
              <span className="text-xs text-blue-600">
                {data.sanitaryAlerts > 0 ? `${data.sanitaryAlerts} pendiente${data.sanitaryAlerts > 1 ? "s" : ""}` : "Al día"}
              </span>
            </a>}
          </div>
        </div>
      )}

      {/* ─── 4. Mini Summary ─── */}
      {visibleStatIds.size > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Resumen rápido</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {visibleStatIds.has("animals") && <QuickStat icon="paw-print" label="Animales en inventario" value={data.totalAnimals ?? data.hens.active} hint={flockHint} />}
            {visibleStatIds.has("eggs") && <QuickStat icon="egg" label="Huevos hoy" value={`${data.eggs.avgDaily} prom`} />}
            {visibleStatIds.has("feed") && <QuickStat
              icon="wheat"
              label="Alimento"
              value={minFeedDays === Infinity ? "OK" : `${minFeedDays}d`}
              alert={criticalFeeds.length > 0}
            />}
            {visibleStatIds.has("finance") && <QuickStat
              icon="money"
              label="Balance mes"
              value={`$${Number(data.finance.profit).toLocaleString()}`}
              alert={Number(data.finance.profit) < 0}
            />}
            {visibleStatIds.has("alerts") && <QuickStat icon="bell" label="Alertas" value={alerts.length} alert={alerts.length > 0} />}
          </div>
        </div>
      )}

      {/* ─── 5. Collapsible Details ─── */}
      <div className="mb-6">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${showDetails ? "rotate-90" : ""}`} aria-hidden="true" />
          <span>{showDetails ? "Ocultar detalles" : "Ver más detalles"}</span>
        </button>

        {(showDetails || (hasSearch && (visibleStages.length > 0 || visibleStockProjection.length > 0))) && (
          <div className="mt-4 space-y-6">
            {/* Stage Distribution & Stock Projection */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Bird className="w-4 h-4 text-green-700" aria-hidden="true" />
                  <span>Distribución por Etapa</span>
                </h3>
                {visibleStages.length > 0 ? (
                  <div className="space-y-2">
                    {visibleStages.map((stage) => (
                      <div key={stage.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{stage.name}</span>
                          <span className="text-xs text-slate-500">{stage.count} aves</span>
                        </div>
                        {stage.expectedEggsPerDay > 0 && (
                          <span className="text-sm font-bold text-yellow-700">{stage.expectedEggsPerDay} huevos/día</span>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                      <span className="text-sm font-semibold text-green-700">TOTAL</span>
                      <span className="text-sm font-bold text-green-700">{data.totalExpectedEggsPerDay} huevos/día</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-4 text-sm">{hasSearch ? "Sin etapas coincidentes" : "Sin etapas definidas"}</p>
                )}
              </Card>

              <Card>
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Stock de Alimento</span>
                </h3>
                {visibleStockProjection.length > 0 ? (
                  <div className="space-y-2">
                    {visibleStockProjection.map((item) => {
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
                  <p className="text-center text-slate-400 py-4 text-sm">{hasSearch ? "Sin alimentos coincidentes" : "Sin datos de programas"}</p>
                )}
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Huevos (últimos 14 días)</span>
                </h3>
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
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-700" aria-hidden="true" />
                  <span>Finanzas (30 días)</span>
                </h3>
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
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Wheat className="w-4 h-4 text-amber-600" aria-hidden="true" />
                  <span>Alimento vs Huevos</span>
                </h3>
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
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Wheat className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <span>Conversión Alimenticia (30 días)</span>
              </h3>
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
      <Modal open={quickSaleOpen} onClose={() => { setQuickSaleOpen(false); setQuickSaleSuccess(false); setQuickSaleError(""); }} title="Venta rápida de huevos">
        <div className="space-y-4">
          {quickSaleError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{quickSaleError}</p>}
          {quickSaleSuccess ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" aria-hidden="true" />
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
function QuickStat({ icon, label, value, alert, hint }: { icon: string; label: string; value: string | number; alert?: boolean; hint?: string }) {
  return (
    <div className={`p-3 rounded-xl border text-center ${alert ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <div className={`mx-auto mb-1 w-8 h-8 rounded-lg flex items-center justify-center ${alert ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-700"}`}>
        <AppIcon icon={icon} className="w-4 h-4" />
      </div>
      <p className={`text-lg font-bold ${alert ? "text-red-600" : "text-slate-800"}`}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{hint}</p>}
    </div>
  );
}
