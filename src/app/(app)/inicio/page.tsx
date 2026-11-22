"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  BarChart3,
  Bird,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Copy,
  Egg,
  HeartHandshake,
  Home,
  Layers,
  Package,
  RefreshCw,
  Scale,
  Stethoscope,
  Wand2,
  Wheat,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { HeroActionButton, HeroBanner } from "@/components/HeroBanner";
import BehavioralNudgeBanner from "@/components/BehavioralNudgeBanner";
import BriefingInboxCard from "@/components/BriefingInboxCard";
import { Card } from "@/components/ui";
import RoutineDayButtons from "@/components/RoutineDayButtons";
import OnboardingWizardModal from "@/components/OnboardingWizardModal";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { FEATURE_FLAG_BY_KEY, PROGRESSIVE_UNLOCKABLE_KEYS } from "@/lib/onboarding";
import { canAccessAppRoute, canPerformAction } from "@/lib/rbac";
import { useOnboardingState } from "@/lib/useOnboardingState";
import { useAppRole } from "@/lib/useAppRole";
import { OPEN_ONBOARDING_WIZARD_EVENT, openQuickCapture, QUICK_CAPTURE_SAVED_EVENT } from "@/lib/quick-capture-events";

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
  sales: {
    totalSold: number;
    eggRevenue?: string;
    totalRevenue: string;
  };
  feedAlerts: number;
  activeIncubations: number;
  pendingMaintenance: number;
  recentEggs: { date: string; total: number }[];
  finance: { income: string; expenses: string; profit: string };
  operatingContext?: {
    operatingNetProfitCop: number;
    accruedOperatingExpenseCop: number;
    cashNetFlowCop: number;
    warehouseFeedAssetCop: number;
    netEquipmentBookValueCop: number;
    biologicalPortfolioValueCop: number;
    totalProductiveWealthCop: number;
    capexRecoveryPct: number;
    lifecycleMode: string;
    lifecycleLabel: string;
    lifecycleDescription: string;
  };
  stages: StageData[];
  totalExpectedEggsPerDay: number;
  stockProjection: StockProjection[];
  fcr: FcrData;
  feedChartData: FeedChartPoint[];
  sanitaryAlerts: number;
  supplyAlerts: number;
}

const ACTIVE_FARM_META_STORAGE_KEY = "galli-active-farm-meta";

interface AttentionItem {
  id: string;
  message: string;
  href: string;
  urgent: boolean;
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
    feedingProgramsValidated: boolean;
  };
  pendingSanitary: { id: string; name: string; type: string; dueDate: string; isOverdue: boolean } | null;
  maintenanceDue: { id: string; title: string; scheduledDate: string; locationName: string | null; assetName: string | null; isOverdue: boolean }[];
  maintenanceDueCount: number;
  assetsNeedAttention: number;
}

export default function Dashboard() {
  const role = useAppRole();
  const isExecutive = role === "directivo";
  const canSeeFinanceSummary = canPerformAction(role, "finance_summary:read")
    || canPerformAction(role, "finance:read");
  const canSeeInventory = canPerformAction(role, "inventory:read");
  const canManageSetup = canPerformAction(role, "settings:manage");
  const canManageIntegrations = canPerformAction(role, "integrations:manage");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showExtendedSetup, setShowExtendedSetup] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tareas, setTareas] = useState<TareasPendientes | null>(null);
  const [loadedAtMs, setLoadedAtMs] = useState(() => Date.now());
  const [syncingExternal, setSyncingExternal] = useState(false);
  const [externalZoneLabel, setExternalZoneLabel] = useState<string | null>(null);
  const [externalSyncNotice, setExternalSyncNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [farmIdCopied, setFarmIdCopied] = useState(false);
  const { state: onboardingState, flags: onboardingFlags, patchOnboarding, refresh: refreshOnboarding } = useOnboardingState();

  useEffect(() => {
    let active = true;
    apiFetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.farmId) return;
        const farmMeta = {
          farmId: String(data.farmId),
          farmName: data.farmName ?? null,
          farmSlug: data.farmSlug ?? null,
        };
        setFarmId(farmMeta.farmId);
        try {
          localStorage.setItem(ACTIVE_FARM_META_STORAGE_KEY, JSON.stringify(farmMeta));
        } catch {
          // El valor de la sesión sigue disponible aunque no se pueda guardar en caché.
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const copyFarmId = async () => {
    if (!farmId) return;
    try {
      await navigator.clipboard.writeText(farmId);
      setFarmIdCopied(true);
      window.setTimeout(() => setFarmIdCopied(false), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const loadHomeData = useCallback(() => {
    apiFetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: DashboardData) => {
        setData(d);
        setLoadedAtMs(Date.now());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    apiFetch("/api/dashboard/tareas-pendientes")
      .then((r) => (r.ok ? r.json() : null))
      .then(setTareas)
      .catch(() => { });
    void refreshOnboarding();
  }, [refreshOnboarding]);

  const handleManualExternalSync = useCallback(async () => {
    setSyncingExternal(true);
    setExternalSyncNotice(null);
    try {
      const res = await apiFetch("/api/configuracion/fuentes-externas", {
        method: "POST",
        body: JSON.stringify({ action: "sync_all" }),
      });
      if (res.status === 403) {
        const refreshRes = await apiFetch("/api/configuracion/fuentes-externas");
        const refreshJson = await refreshRes.json().catch(() => null);
        if (refreshJson?.activeZone?.coverageLabel) {
          setExternalZoneLabel(String(refreshJson.activeZone.coverageLabel));
        }
        setExternalSyncNotice({
          ok: true,
          text: "Datos externos verificados según calendario automático (solo administración fuerza recarga inmediata).",
        });
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "No fue posible sincronizar las fuentes externas");
      if (json?.activeZone?.coverageLabel) {
        setExternalZoneLabel(String(json.activeZone.coverageLabel));
      }
      setExternalSyncNotice({
        ok: true,
        text: `Fuentes externas sincronizadas (${json?.activeZone?.coverageLabel || "zona activa"}).`,
      });
      loadHomeData();
    } catch (err) {
      setExternalSyncNotice({
        ok: false,
        text: err instanceof Error ? err.message : "Error al sincronizar fuentes externas",
      });
    } finally {
      setSyncingExternal(false);
    }
  }, [loadHomeData]);

  useEffect(() => {
    loadHomeData();
    apiFetch("/api/configuracion/fuentes-externas")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.activeZone?.coverageLabel) {
          setExternalZoneLabel(String(json.activeZone.coverageLabel));
        }
      })
      .catch(() => { });
    const onSaved = () => loadHomeData();
    const onOpenWizard = () => setWizardOpen(true);
    window.addEventListener(QUICK_CAPTURE_SAVED_EVENT, onSaved);
    window.addEventListener(OPEN_ONBOARDING_WIZARD_EVENT, onOpenWizard);
    void Promise.resolve().then(() => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("wizard") === "1") {
        setWizardOpen(true);
        params.delete("wizard");
        const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", cleanUrl);
      }
    });
    return () => {
      window.removeEventListener(QUICK_CAPTURE_SAVED_EVENT, onSaved);
      window.removeEventListener(OPEN_ONBOARDING_WIZARD_EVENT, onOpenWizard);
    };
  }, [loadHomeData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center">
          <Bird className="w-10 h-10 text-emerald-700 mx-auto mb-3 animate-bounce" aria-hidden="true" />
          <p className="text-sm text-slate-500">Cargando panel...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    return (
      <div className="rounded-xl border border-slate-200 border-l-4 border-l-amber-500 bg-white p-6 text-center max-w-lg mx-auto my-8">
        <p className="text-sm font-semibold text-slate-900">
          {isOffline ? "Sin conexión y sin copia local para el inicio" : "No se pudieron cargar los datos"}
        </p>
        <p className="text-xs text-slate-600 mt-1">
          {isOffline
            ? "Conéctate a Internet una vez y abre 'Guardar copia offline' en el indicador superior."
            : "Intenta recargar la página o verifica la conexión con el servidor."}
        </p>
      </div>
    );
  }

  // ─── Pasos de configuración inicial ───
  const setupSteps = tareas
    ? [
      { done: tareas.setup.farmProfileConfigured, coreDay1: true, title: "Datos de la finca", description: "Nombre, municipio y altitud.", href: "/configuracion/catalogos?tab=parametros", icon: "home" },
      { done: tareas.setup.locationsConfigured, coreDay1: true, title: "Lugares de manejo", description: "Corrales, galpones o pozas.", href: "/ubicaciones", icon: "map-pin" },
      { done: tareas.setup.animalsRegistered, coreDay1: true, title: "Animales actuales", description: "Inventario vivo por especie.", href: "/produccion/adquisiciones", icon: "paw-print" },
      { done: tareas.setup.starterInventoryConfigured, coreDay1: true, title: "Alimento en bodega", description: "Saldo en bultos de 40 kg o kg.", href: "/almacen", icon: "wheat" },
      { done: tareas.setup.contactsConfigured, coreDay1: false, title: "Clientes y proveedores", description: "Contactos comerciales.", href: "/contactos", icon: "handshake" },
      { done: tareas.setup.budgetConfigured, coreDay1: false, title: "Presupuesto", description: "Metas de ingresos y gastos.", href: "/finanzas/presupuestos?nuevo=base", icon: "money" },
      { done: tareas.setup.sanitaryConfigured, coreDay1: false, title: "Calendario sanitario", description: "Vacunas y revisiones.", href: "/sanidad/calendario", icon: "pill" },
      { done: tareas.setup.feedingProgramsValidated, coreDay1: false, title: "Planes de alimentación", description: "Raciones mixtas y etapas iniciales.", href: "/produccion?tab=alimentacion&subtab=etapas", icon: "wheat" },
      { done: tareas.setup.assetsRegistered, coreDay1: false, title: "Equipos y activos", description: "Herramientas e infraestructura.", href: "/operaciones/activos", icon: "equipment" },
    ]
    : [];

  // ─── Métricas clave ───
  const criticalFeeds = data.stockProjection.filter((s) => s.daysRemaining !== null && s.daysRemaining <= 7);
  const minFeedDays = data.stockProjection
    .filter((s) => s.daysRemaining !== null)
    .reduce((min, s) => Math.min(min, s.daysRemaining!), Infinity);
  const profitVal = Number(data.finance.profit);

  // ─── Lista única y deduplicada de atención prioritaria ───
  const attentionItems: AttentionItem[] = [];

  if (criticalFeeds.length > 0) {
    attentionItems.push({
      id: "feed-critical",
      message: `Alimento bajo (${criticalFeeds.map((f) => f.feedName).join(", ")})`,
      href: "/produccion?tab=alimentacion",
      urgent: true,
    });
  }

  if (tareas?.pendingSanitary) {
    attentionItems.push({
      id: `sanitary-${tareas.pendingSanitary.id}`,
      message: `${tareas.pendingSanitary.isOverdue ? "Vencido" : "Pendiente"}: ${tareas.pendingSanitary.name}`,
      href: `/sanidad/control?pendiente=${tareas.pendingSanitary.id}`,
      urgent: tareas.pendingSanitary.isOverdue,
    });
  } else if (data.sanitaryAlerts > 0) {
    attentionItems.push({
      id: "sanitary",
      message: `${data.sanitaryAlerts} vacuna${data.sanitaryAlerts > 1 ? "s" : ""} o tratamiento${data.sanitaryAlerts > 1 ? "s" : ""} pendiente${data.sanitaryAlerts > 1 ? "s" : ""}`,
      href: "/sanidad/calendario",
      urgent: true,
    });
  }

  if (tareas && tareas.maintenanceDue.length > 0) {
    for (const task of tareas.maintenanceDue.slice(0, 2)) {
      attentionItems.push({
        id: `maint-${task.id}`,
        message: `${task.isOverdue ? "Vencido" : "Mantenimiento"}: ${task.title}`,
        href: "/operaciones/mantenimiento",
        urgent: task.isOverdue,
      });
    }
  } else if (data.pendingMaintenance > 0) {
    attentionItems.push({
      id: "maintenance",
      message: `${data.pendingMaintenance} mantenimiento${data.pendingMaintenance > 1 ? "s" : ""} pendiente${data.pendingMaintenance > 1 ? "s" : ""}`,
      href: "/operaciones/mantenimiento",
      urgent: false,
    });
  }

  if (data.eggs.inventory && data.eggs.inventory.available > 50) {
    attentionItems.push({
      id: "eggs-expiring",
      message: `${data.eggs.inventory.available} huevos en bodega listos para venta`,
      href: onboardingFlags?.clasificacion_ntc1240_calibres
        ? "/inventarios/huevos"
        : "/produccion?tab=huevos",
      urgent: false,
    });
  }

  if (data.readyBatches > 0) {
    attentionItems.push({
      id: "batches-ready",
      message: `${data.readyBatches} lote${data.readyBatches > 1 ? "s" : ""} listo${data.readyBatches > 1 ? "s" : ""} para salida`,
      href: "/produccion?tab=carne",
      urgent: false,
    });
  }

  if (data.hens.recommendedForSlaughter > 0) {
    attentionItems.push({
      id: "slaughter-rec",
      message: `${data.hens.recommendedForSlaughter} gallina${data.hens.recommendedForSlaughter > 1 ? "s" : ""} para descarte`,
      href: "/produccion?tab=gallinas",
      urgent: false,
    });
  }

  if (data.supplyAlerts > 0) {
    attentionItems.push({
      id: "supplies",
      message: `${data.supplyAlerts} insumo${data.supplyAlerts > 1 ? "s" : ""} con stock bajo`,
      href: "/inventarios/insumos",
      urgent: false,
    });
  }

  if (tareas && tareas.assetsNeedAttention > 0) {
    attentionItems.push({
      id: "assets",
      message: `${tareas.assetsNeedAttention} equipo${tareas.assetsNeedAttention === 1 ? "" : "s"} requiere revisión`,
      href: "/operaciones/activos",
      urgent: false,
    });
  }

  const roleVisibleAttention = attentionItems.filter((item) => canAccessAppRoute(role, item.href));
  const visibleAttention = showAllAttention ? roleVisibleAttention : roleVisibleAttention.slice(0, 4);

  // ─── Onboarding contextual (solo cuando aplica) ───
  const showWizardCta = Boolean(
    canManageSetup &&
    onboardingState &&
    !onboardingState.config.onboardingCompleted &&
    !onboardingState.config.wizardDismissed &&
    !onboardingState.metrics.hasExistingOperation,
  );
  const recentAutoTriggers = canManageSetup && onboardingState
    ? onboardingState.history
      .filter(
        (h) =>
          h.origin === "AUTO_TRIGGER_CRECIMIENTO" &&
          h.estadoNuevo &&
          loadedAtMs - new Date(h.activatedAt).getTime() < 72 * 3600 * 1000,
      )
      .slice(0, 2)
    : [];
  const isMediano = onboardingState?.config.scale === "MEDIANO";
  const selectedSpecies = onboardingState?.config.selectedSpecies ?? [];
  const hasMammals = Boolean(
    data.species?.some((sp) => (sp.species === "conejo" || sp.species === "cuy") && sp.count > 0) ||
    selectedSpecies.some((sp) => sp === "conejo" || sp === "cuy"),
  );
  const hasWeightSpecies = Boolean(
    isMediano ||
    hasMammals ||
    selectedSpecies.some((sp) => sp === "pollo") ||
    data.species?.some((sp) => sp.species === "pollo" && sp.count > 0),
  );
  const unlockedCount = onboardingState
    ? PROGRESSIVE_UNLOCKABLE_KEYS.filter((k) => onboardingState.flags[k]).length
    : 0;
  const visibleSetupTrackerSteps = setupSteps.filter(
    (step) => step.coreDay1 || isMediano || Boolean(onboardingFlags?.reportes_dian_roi_credito),
  );
  const completedVisibleSetupSteps = visibleSetupTrackerSteps.filter((step) => step.done).length;

  // ─── Accesos directos limpios y filtrados por escala y especies activas ───
  const quickShortcuts: Array<{
    id: string;
    label: string;
    subtitle: string;
    href: string;
    icon: "sale" | "egg" | "wheat" | "sanitary" | "weight" | "repro" | "cierre" | "calendar";
    onClick?: () => void;
    visible: boolean;
  }> = [
      {
        id: "sale",
        label: "Registrar venta",
        subtitle: "Huevos, carne o animales",
        href: "#",
        icon: "sale",
        onClick: () => openQuickCapture({ mode: "venta" }),
        visible: true,
      },
      {
        id: "eggs",
        label: "Recoger huevos",
        subtitle: "Postura de hoy",
        href: "/produccion?tab=huevos&nuevo=1",
        icon: "egg",
        visible: !tareas || tareas.eggApplicable,
      },
      {
        id: "feed",
        label: "Alimentación",
        subtitle: "Consumo y bodega",
        href: "/produccion?tab=alimentacion&subtab=movimientos&nuevo=movimiento",
        icon: "wheat",
        visible: !tareas || tareas.feedApplicable,
      },
      {
        id: "sanitary",
        label: "Sanidad",
        subtitle: "Vacunas y controles",
        href: "/sanidad",
        icon: "sanitary",
        visible: true,
      },
      {
        id: "weight",
        label: "Control de peso",
        subtitle: "Seguimiento por lote",
        href: "/produccion/peso",
        icon: "weight",
        visible: hasWeightSpecies,
      },
      {
        id: "repro",
        label: "Reproducción",
        subtitle: "Crías y nidos",
        href: "/produccion?tab=reproduccion",
        icon: "repro",
        visible: isMediano || hasMammals,
      },
      {
        id: "cierre",
        label: "Cierre del día",
        subtitle: "Resumen de jornada",
        href: "/operaciones/cierre",
        icon: "cierre",
        visible: Boolean(onboardingFlags?.genealogia_3gen_qr_iot),
      },
      {
        id: "calendar",
        label: "Calendario",
        subtitle: "Agenda semanal",
        href: "/planeacion/calendario",
        icon: "calendar",
        visible: true,
      },
    ];
  const visibleShortcuts = quickShortcuts.filter((shortcut) => {
    if (!shortcut.visible) return false;
    if (shortcut.onClick) return shortcut.id === "sale" && canPerformAction(role, "sales:write");
    return canAccessAppRoute(role, shortcut.href);
  });

  const animalCount = data.totalAnimals ?? data.hens.active;
  const animalHint =
    data.hens.laying != null && data.hens.laying > 0
      ? `${data.hens.laying} en postura`
      : data.species && data.species.filter((s) => s.count > 0).length > 1
        ? `${data.species.filter((s) => s.count > 0).length} especies`
        : "Inventario vivo";

  const hasExternalCard = canManageIntegrations && Boolean(externalSyncNotice || externalZoneLabel);
  const hasSecondaryBannerCard = showWizardCta || recentAutoTriggers.length > 0;
  const topStripGridCols =
    hasExternalCard && hasSecondaryBannerCard
      ? "lg:grid-cols-3"
      : hasExternalCard || hasSecondaryBannerCard
        ? "lg:grid-cols-2"
        : "lg:grid-cols-1";

  return (
    <div>
      {/* Encabezado limpio */}
      <HeroBanner
        theme="inicio"
        compact
        hideNudge
        className="mb-4"
        icon={<Home className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        title={onboardingState?.farmProfile?.name || "Panel principal"}
        metadata={farmId ? (
          <button
            type="button"
            onClick={() => void copyFarmId()}
            className="inline-flex max-w-full items-center gap-1.5 text-left font-mono text-[10px] text-white/70 transition-colors hover:text-white/90"
            title={farmIdCopied ? "FarmID copiado" : "Copiar FarmID"}
            aria-label="Copiar FarmID"
            data-testid="home-farm-id"
          >
            <span className="break-all">FarmID: {farmId}</span>
            {farmIdCopied ? <Check className="h-3 w-3 shrink-0" aria-hidden="true" /> : <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />}
          </button>
        ) : undefined}
        description={
          isMediano
            ? "Modo Mediano / Tecnificado · Control completo con analítica por especie, calibres NTC 1240, presupuestos y auditoría"
            : "Modo Pequeño Productor · Vista esencial con tareas diarias, recolección, alimentación, sanidad y ventas"
        }
        badge={
          onboardingState ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${isMediano
                ? "border-sky-300/50 bg-sky-500/25 text-sky-100"
                : "border-amber-300/50 bg-amber-400/20 text-amber-100"
                }`}
            >
              <Layers className="w-3 h-3" aria-hidden="true" />
              <span>{isMediano ? `Mediano · ${unlockedCount}/5` : `Pequeño · ${unlockedCount}/5`}</span>
            </span>
          ) : undefined
        }
        actions={
          <>
            {canManageIntegrations && <HeroActionButton
              tone="glass"
              onClick={handleManualExternalSync}
              disabled={syncingExternal}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingExternal ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{syncingExternal ? "Sincronizando..." : "Sincronizar fuentes externas"}</span>
            </HeroActionButton>}
            {canManageSetup && <HeroActionButton
              tone={showWizardCta ? "accent" : "glass"}
              onClick={() => setWizardOpen(true)}
            >
              <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Asistente inicial</span>
            </HeroActionButton>}
          </>
        }
        helpTitle="Cómo funciona este inicio"
        help={`• Arriba ves las 4 cifras clave del día y el botón Asistente inicial.\n• En «Tareas de hoy» ejecutas o confirmas las labores pendientes según tu rutina.\n• En «Accesos directos» entras directo a registrar o consultar cada área.`}
      />

      {/* C2: inbox del agente proactivo (briefing del día con no-leídos) */}
      {!isExecutive && canManageSetup && <BriefingInboxCard />}

      {/* Mensaje conductual y tarjetas adjuntas debajo del hero en una sola fila */}
      <div className={`mb-5 grid grid-cols-1 ${topStripGridCols} gap-3 items-stretch`}>
        <BehavioralNudgeBanner compact className="mb-0 h-full" />

        {hasExternalCard && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs flex flex-col justify-between gap-2 h-full shadow-2xs ${externalSyncNotice && !externalSyncNotice.ok
              ? "border-red-200 bg-red-50/90 text-red-900"
              : "border-emerald-200 bg-emerald-50/75 text-emerald-950"
              }`}
          >
            <div className="space-y-1">
              <span className="inline-flex items-center rounded-full bg-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Entorno externo
              </span>
              <p className="text-xs sm:text-[13px] font-medium leading-snug">
                {externalSyncNotice
                  ? externalSyncNotice.text
                  : `Entorno externo activo: ${externalZoneLabel} (renovación automática por periodo).`}
              </p>
            </div>
            <div className="pt-1 border-t border-emerald-200/70">
              <Link href="/analisis/fuentes-externas" className="font-semibold text-emerald-800 hover:underline inline-flex items-center gap-1">
                <span>Ver clima, precios e ICA →</span>
              </Link>
            </div>
          </div>
        )}

        {showWizardCta ? (
          <section
            aria-label="Asistente inicial de configuración"
            className="rounded-xl border border-emerald-200 border-l-4 border-l-emerald-700 bg-gradient-to-br from-emerald-50/90 via-white to-amber-50/70 px-3.5 py-2.5 shadow-2xs flex flex-col justify-between gap-2.5 h-full"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  <Wand2 className="w-3 h-3" aria-hidden="true" />
                  Onboarding Día 1
                </span>
                <span className="text-[11px] font-medium text-emerald-900">
                  &lt; 5 minutos
                </span>
              </div>
              <h2 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug">
                Asistente inicial: prepara tu granja en 3 pasos
              </h2>
              <p className="text-[11px] text-slate-600 leading-snug">
                Finca, lugares y animales vivos, más stock inicial o plantilla CSV.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-emerald-200/60">
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-2xs hover:bg-emerald-800 cursor-pointer"
              >
                <Wand2 className="w-3 h-3" aria-hidden="true" />
                <span>Abrir asistente</span>
              </button>
              <button
                type="button"
                onClick={() => void patchOnboarding({ wizardDismissed: true })}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Omitir
              </button>
            </div>
          </section>
        ) : recentAutoTriggers.length > 0 ? (
          <div className="rounded-xl border border-slate-200 border-l-4 border-l-emerald-600 bg-white px-3.5 py-2.5 flex flex-col justify-between gap-2 text-xs text-slate-700 h-full shadow-2xs">
            <div className="space-y-1">
              <span className="inline-flex items-center rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Desbloqueo automático
              </span>
              <p className="text-xs sm:text-[13px] leading-snug">
                <strong className="text-slate-900">Nuevas funciones habilitadas:</strong>{" "}
                {recentAutoTriggers.map((t) => FEATURE_FLAG_BY_KEY[t.featureKey]?.name || t.featureKey).join(" · ")}
              </p>
            </div>
            <div className="pt-1 border-t border-slate-100">
              <Link href="/configuracion/modulos" className="font-semibold text-emerald-800 hover:underline inline-flex items-center">
                Ver módulos →
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Cifras clave siempre visibles en grupo enmarcado */}
      <section
        className="mb-6 rounded-2xl border border-slate-200/90 bg-slate-50/85 p-4 sm:p-5 shadow-xs"
        aria-labelledby="overview-heading"
      >
        <h2 id="overview-heading" className="text-base font-bold text-slate-900 mb-3">
          Resumen del día
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <SummaryTile label="Animales activos" value={animalCount} detail={animalHint} />
          <SummaryTile label="Huevos por día" value={data.eggs.avgDaily} detail="Promedio diario" />
          {canSeeInventory && <SummaryTile
            label="Días de alimento"
            value={minFeedDays === Infinity ? "Sin dato" : `${minFeedDays} d`}
            detail={criticalFeeds.length > 0 ? "Stock crítico — reponer" : "En bodega"}
            tone={criticalFeeds.length > 0 ? "danger" : "neutral"}
          />}
          {canSeeFinanceSummary && <SummaryTile
            label={
              data.operatingContext &&
              (data.operatingContext.lifecycleMode === "cria_levante" ||
                data.operatingContext.lifecycleMode === "pausa_sanitaria" ||
                (profitVal < 0 && data.operatingContext.totalProductiveWealthCop > 0))
                ? "Patrimonio productivo"
                : "Balance operativo"
            }
            value={`$${Math.round(
              data.operatingContext &&
                (data.operatingContext.lifecycleMode === "cria_levante" ||
                  data.operatingContext.lifecycleMode === "pausa_sanitaria" ||
                  (profitVal < 0 && data.operatingContext.totalProductiveWealthCop > 0))
                ? data.operatingContext.totalProductiveWealthCop
                : (data.operatingContext?.operatingNetProfitCop ?? profitVal)
            ).toLocaleString("es-CO")}`}
            detail={
              data.operatingContext
                ? `${data.operatingContext.lifecycleLabel} · Caja 30d $${Math.round(profitVal).toLocaleString("es-CO")}`
                : "Últimos 30 días"
            }
            tone={
              data.operatingContext &&
              (data.operatingContext.lifecycleMode === "cria_levante" ||
                data.operatingContext.lifecycleMode === "pausa_sanitaria" ||
                data.operatingContext.totalProductiveWealthCop > 0)
                ? "positive"
                : profitVal < 0
                  ? "danger"
                  : "positive"
            }
          />}
        </div>
      </section>

      {/* Avisos prioritarios consolidados (solo visible cuando hay novedades) */}
      {visibleAttention.length > 0 && (
        <section className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50/50 overflow-hidden shadow-xs" aria-label="Requiere atención">
          <div className="flex items-center justify-between gap-2 border-b border-amber-200/70 bg-amber-100/50 px-4 py-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">
              Requiere atención ({roleVisibleAttention.length})
            </h2>
            {roleVisibleAttention.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllAttention((v) => !v)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                {showAllAttention ? "Ver menos" : `Ver todos (${roleVisibleAttention.length})`}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-px bg-slate-100">
            {visibleAttention.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between gap-3 bg-white px-4 py-2.5 hover:bg-slate-50 transition-colors min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${item.urgent ? "bg-rose-600" : "bg-amber-500"}`}
                    aria-hidden="true"
                  />
                  <span className="text-xs sm:text-sm font-medium text-slate-800 truncate">{item.message}</span>
                </div>
                <span className="text-xs font-semibold text-emerald-800 shrink-0">Revisar →</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Paso 1: Tareas de hoy (Rutina auto-ajustable con verificación real) */}
      {canAccessAppRoute(role, "/planeacion/calendario") && <RoutineDayButtons onOpenQuickSale={
        canPerformAction(role, "sales:write") ? () => openQuickCapture({ mode: "venta" }) : undefined
      } />}

      {/* Accesos directos enmarcados */}
      <section className="mb-6 rounded-2xl border border-slate-200/90 bg-slate-50/85 p-4 sm:p-5 shadow-xs" aria-labelledby="shortcuts-heading">
        <h2 id="shortcuts-heading" className="text-base font-bold text-slate-900 mb-3">
          Accesos directos
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {visibleShortcuts.map((item) => {
            const IconEl =
              item.icon === "sale"
                ? CircleDollarSign
                : item.icon === "egg"
                  ? Egg
                  : item.icon === "wheat"
                    ? Wheat
                    : item.icon === "sanitary"
                      ? Stethoscope
                      : item.icon === "weight"
                        ? Scale
                        : item.icon === "repro"
                          ? HeartHandshake
                          : item.icon === "cierre"
                            ? ClipboardCheck
                            : CalendarDays;

            const content = (
              <>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-emerald-50 group-hover:text-emerald-800 transition-colors">
                  <IconEl className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{item.label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                </div>
              </>
            );

            if (item.onClick) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-emerald-600/60 transition-colors min-w-0"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-emerald-600/60 transition-colors min-w-0"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Gráficas y resumen mensual (mismo formato plegable estándar) */}
      <section className="mb-4 rounded-2xl border border-emerald-200/80 bg-white overflow-hidden shadow-xs" aria-labelledby="details-toggle">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-emerald-50/40">
          <button
            id="details-toggle"
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="flex flex-1 min-w-0 items-center gap-2 text-left text-sm font-semibold text-slate-800 hover:text-emerald-900 transition-colors cursor-pointer"
          >
            <ChevronRight className={`w-4 h-4 text-emerald-700 shrink-0 transition-transform ${showDetails ? "rotate-90" : ""}`} aria-hidden="true" />
            <span className="truncate">{isMediano ? "Tablero técnico y gráficas del mes" : "Resumen del mes (opcional)"}</span>
          </button>
        </div>

        {showDetails && (
          <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/40">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                  <Bird className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Distribución por etapa</span>
                </h3>
                {data.stages.length > 0 ? (
                  <div className="space-y-2">
                    {data.stages.map((stage) => (
                      <div key={stage.name} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{stage.name}</span>
                          <span className="text-xs text-slate-500">{stage.count} animales</span>
                        </div>
                        {stage.expectedEggsPerDay > 0 && (
                          <span className="text-xs font-semibold text-slate-700">{stage.expectedEggsPerDay} huevos/día</span>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                      <span className="text-xs font-bold uppercase text-slate-700">Total estimado</span>
                      <span className="text-sm font-bold text-slate-900">{data.totalExpectedEggsPerDay} huevos/día</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-4 text-sm">Sin etapas definidas</p>
                )}
              </Card>

              {canSeeInventory && <Card>
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Alimento en bodega</span>
                </h3>
                {data.stockProjection.length > 0 ? (
                  <div className="space-y-2">
                    {data.stockProjection.map((item) => {
                      const isCritical = item.daysRemaining !== null && item.daysRemaining <= 7;
                      return (
                        <div key={item.feedId} className={`p-2.5 rounded-lg border ${isCritical ? "bg-rose-50/40 border-rose-200" : "bg-slate-50 border-slate-100"}`}>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-800">{item.feedName}</span>
                            <span className={`text-sm font-bold ${isCritical ? "text-rose-700" : "text-slate-800"}`}>
                              {item.daysRemaining !== null ? `${item.daysRemaining} días` : "Sin límite"}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                            <span>{item.currentStockKg} kg disponibles</span>
                            <span>{item.dailyNeedKg} kg/día</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-4 text-sm">Sin programas registrados</p>
                )}
              </Card>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                  <BarChart3 className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Huevos (últimos 14 días)</span>
                </h3>
                {data.recentEggs.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.recentEggs
                        .map((e) => ({
                          fecha: new Date(e.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" }),
                          huevos: e.total,
                        }))
                        .reverse()}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--iw-color-border)" />
                      <XAxis dataKey="fecha" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="huevos" fill="var(--iw-color-forest)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-slate-400 py-8 text-sm">Sin datos aún</p>
                )}
              </Card>

              {canSeeFinanceSummary && <Card>
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                  <Banknote className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Finanzas (últimos 30 días)</span>
                </h3>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">Ingresos</span>
                    <span className="text-sm font-bold text-emerald-800">${Number(data.finance.income).toLocaleString("es-CO")}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-600">Egresos</span>
                    <span className="text-sm font-bold text-rose-700">${Number(data.finance.expenses).toLocaleString("es-CO")}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                    <span className="text-sm font-semibold text-slate-800">
                      {data.operatingContext ? "Ganancia operativa real" : "Balance neto"}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        (data.operatingContext?.operatingNetProfitCop ?? profitVal) >= 0
                          ? "text-emerald-800"
                          : "text-amber-700"
                      }`}
                    >
                      ${Math.round(data.operatingContext?.operatingNetProfitCop ?? profitVal).toLocaleString("es-CO")}
                    </span>
                  </div>
                  {data.operatingContext && (
                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                      <div className="rounded-lg bg-emerald-50/80 border border-emerald-200 px-2.5 py-2">
                        <span className="text-emerald-800 block">Animales + bodega + equipos</span>
                        <span className="font-bold text-emerald-950">
                          ${Math.round(data.operatingContext.totalProductiveWealthCop).toLocaleString("es-CO")}
                        </span>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2">
                        <span className="text-slate-600 block">Dinero en caja (30 días)</span>
                        <span className="font-bold text-slate-900">
                          ${Math.round(profitVal).toLocaleString("es-CO")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>}
            </div>

            {data.feedChartData.length > 0 && (
              <Card>
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
                  <Wheat className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Alimento vs Huevos</span>
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.feedChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--iw-color-border)" />
                    <XAxis dataKey="fecha" fontSize={10} />
                    <YAxis yAxisId="left" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" fontSize={10} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="alimento" stroke="var(--iw-color-ochre)" strokeWidth={2} name="Alimento (kg)" dot={{ r: 2 }} />
                    <Line yAxisId="right" type="monotone" dataKey="huevos" stroke="var(--iw-color-forest)" strokeWidth={2} name="Huevos" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            <Card>
              <h3 className="font-semibold text-slate-800 mb-3 text-sm">
                Rendimiento del último mes
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-900">{data.fcr.feedConsumed30d}</p>
                  <p className="text-xs text-slate-500">kg de alimento</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-900">{data.fcr.fcrEggs}</p>
                  <p className="text-xs text-slate-500">kg por huevo</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-900">{data.fcr.totalBirdsSold}</p>
                  <p className="text-xs text-slate-500">animales vendidos</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-900">
                    {data.fcr.incubationEfficiency > 0 ? `${data.fcr.incubationEfficiency}%` : "—"}
                  </p>
                  <p className="text-xs text-slate-500">éxito de nacimientos</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </section>

      {/* Configuración pendiente + acceso rápido al asistente guiado */}
      {canManageSetup && !showWizardCta && completedVisibleSetupSteps < visibleSetupTrackerSteps.length && (
        <section className="mb-4 rounded-2xl border border-emerald-200/80 bg-white overflow-hidden shadow-xs" aria-labelledby="setup-title">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-emerald-50/40">
            <button
              id="setup-title"
              type="button"
              onClick={() => setShowSetup((v) => !v)}
              aria-expanded={showSetup}
              className="flex flex-1 min-w-0 items-center gap-2 text-left text-sm font-semibold text-slate-800 hover:text-emerald-900 transition-colors cursor-pointer"
            >
              <ChevronRight className={`w-4 h-4 text-emerald-700 shrink-0 transition-transform ${showSetup ? "rotate-90" : ""}`} aria-hidden="true" />
              <span className="truncate">Completar configuración de finca ({completedVisibleSetupSteps} de {visibleSetupTrackerSteps.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors shrink-0 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Abrir asistente inicial</span>
            </button>
          </div>
          {showSetup && (
            <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/40">
              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                {setupSteps
                  .filter((step) => showExtendedSetup || step.coreDay1 || (onboardingFlags && onboardingFlags.reportes_dian_roi_credito))
                  .map((step) =>
                    step.done ? (
                      <div key={step.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <AppIcon icon={step.icon} className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <Check className="w-3 h-3" aria-hidden="true" /> Listo
                          </span>
                        </div>
                        <span className="mt-2 block text-xs sm:text-sm font-semibold text-slate-600">{step.title}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 line-clamp-1">{step.description}</span>
                      </div>
                    ) : (
                      <Link
                        key={step.title}
                        href={step.href}
                        className="rounded-xl border border-slate-200 bg-white p-3 min-w-0 hover:border-emerald-600/60 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <AppIcon icon={step.icon} className="w-4 h-4 text-slate-700 shrink-0" />
                          <span className="text-[11px] font-medium text-slate-500">Pendiente</span>
                        </div>
                        <span className="mt-2 block text-xs sm:text-sm font-semibold text-slate-900">{step.title}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 line-clamp-1">{step.description}</span>
                      </Link>
                    ),
                  )}
              </div>
              {!(onboardingFlags && onboardingFlags.reportes_dian_roi_credito) && (
                <button
                  type="button"
                  onClick={() => setShowExtendedSetup((v) => !v)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                >
                  {showExtendedSetup ? "Mostrar solo esenciales" : "Ver pasos opcionales (presupuesto, contactos y activos)"}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Pie discreto para ajustes de escala y asistente */}
      {onboardingState && (
        <footer className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Modo {onboardingState.config.scale === "MEDIANO" ? "Avanzado" : "Básico"} · {unlockedCount} de{" "}
            {PROGRESSIVE_UNLOCKABLE_KEYS.length} módulos adicionales activos
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Asistente inicial (3 pasos)</span>
            </button>
            <Link href="/configuracion/modulos" className="font-semibold text-emerald-800 hover:underline">
              Personalizar módulos →
            </Link>
          </div>
        </footer>
      )}

      <OnboardingWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCompleted={() => loadHomeData()}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "positive" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-rose-700"
      : tone === "positive"
        ? "text-emerald-800"
        : "text-slate-900";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 min-w-0">
      <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">{label}</p>
      <p className={`mt-1 text-lg sm:text-2xl font-bold tracking-tight truncate ${valueClass}`}>{value}</p>
      <p className={`mt-0.5 text-[11px] truncate ${tone === "danger" ? "text-rose-600 font-medium" : "text-slate-500"}`}>
        {detail}
      </p>
    </div>
  );
}
