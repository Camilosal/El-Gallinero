export const KPI_WIDGET_IDS = [
  "laying_rate",
  "laying_haa",
  "cost_per_egg",
  "egg_margin",
  "mortality_rate",
  "feed_autonomy",
  "net_profit",
  "cost_per_kg_meat",
  "epef",
  "uniformity",
  "capex_roi",
  "biological_value",
  "patrimony_wealth",
  "chart_laying_curve",
  "chart_mortality_causes",
  "chart_cost_breakdown",
] as const;

export type KpiWidgetId = (typeof KPI_WIDGET_IDS)[number];

export type KpiPresetId = "auto" | "postura" | "engorde" | "gerencial" | "custom";

export type KpiResolvedPresetId = Exclude<KpiPresetId, "auto" | "custom">;

export type KpiWidgetKind = "metric" | "chart";

export type KpiWidgetSize = "compact" | "wide";

export type KpiWidgetCategory = "postura" | "engorde" | "sanidad" | "finanzas" | "operacion";

export type KpiDirection = "higher_is_better" | "lower_is_better" | "neutral";

export type KpiHealthStatus = "optimal" | "warning" | "critical" | "neutral";

export interface KpiStatusEvaluation {
  status: KpiHealthStatus;
  label: string;
}

export interface KpiWidgetCatalogItem {
  id: KpiWidgetId;
  kind: KpiWidgetKind;
  category: KpiWidgetCategory;
  title: string;
  shortTitle: string;
  description: string;
  unit: string;
  defaultSize: KpiWidgetSize;
  supportsCustomTarget: boolean;
  supportsPinToHome: boolean;
  direction: KpiDirection;
  defaultTarget: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  drilldownHref: string;
  drilldownLabel: string;
}

export interface KpiWidgetUserPref {
  id: KpiWidgetId;
  visible: boolean;
  order: number;
  size: KpiWidgetSize;
  customTarget: number | null;
  pinnedToHome: boolean;
}

export interface KpiDashboardConfig {
  version: number;
  preset: KpiPresetId;
  widgets: KpiWidgetUserPref[];
  updatedAt?: string;
}

export const KPI_DASHBOARD_VERSION = 1;
export const MAX_PINNED_KPI_WIDGETS = 4;

export const KPI_SPECIES_OPTIONS = [
  { value: "gallina", label: "Gallinas" },
  { value: "pollo", label: "Pollos" },
  { value: "codorniz", label: "Codornices" },
  { value: "pato", label: "Patos" },
  { value: "conejo", label: "Conejos" },
  { value: "cuy", label: "Cuyes" },
] as const;

export const KPI_PRESETS: Record<
  KpiPresetId,
  {
    id: KpiPresetId;
    label: string;
    description: string;
  }
> = {
  auto: {
    id: "auto",
    label: "Automático",
    description: "Se adapta a las especies y lotes activos de tu granja.",
  },
  postura: {
    id: "postura",
    label: "Postura",
    description: "Prioriza postura diaria, postura del lote alojado, costo y ganancia por huevo.",
  },
  engorde: {
    id: "engorde",
    label: "Engorde",
    description: "Enfocado en eficiencia de engorde, costo por kilo, qué tan parejo va el lote y alimento usado.",
  },
  gerencial: {
    id: "gerencial",
    label: "Gerencial",
    description: "Vista financiera, ganancia real, retorno de equipos y riesgos.",
  },
  custom: {
    id: "custom",
    label: "Personalizado",
    description: "Tu selección manual de métricas, orden, metas y gráficos.",
  },
};

export const KPI_WIDGET_CATALOG: Record<KpiWidgetId, KpiWidgetCatalogItem> = {
  laying_rate: {
    id: "laying_rate",
    kind: "metric",
    category: "postura",
    title: "Postura del lote (Gallina-Día)",
    shortTitle: "Postura %",
    description: "Porcentaje de huevos frente a aves elegibles activas en el período.",
    unit: "%",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "higher_is_better",
    defaultTarget: 82,
    warningThreshold: 72,
    criticalThreshold: 60,
    drilldownHref: "/dashboard/produccion/huevos",
    drilldownLabel: "Ver registros de postura",
  },
  laying_haa: {
    id: "laying_haa",
    kind: "metric",
    category: "postura",
    title: "Postura sobre lote inicial",
    shortTitle: "Postura lote inicial",
    description: "Mide productividad incluyendo bajas del lote desde el alojamiento (en zootecnia: HAA).",
    unit: "%",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "higher_is_better",
    defaultTarget: 78,
    warningThreshold: 68,
    criticalThreshold: 55,
    drilldownHref: "/dashboard/produccion/huevos",
    drilldownLabel: "Auditar postura y aves",
  },
  cost_per_egg: {
    id: "cost_per_egg",
    kind: "metric",
    category: "finanzas",
    title: "Costo unitario por huevo",
    shortTitle: "Costo / huevo",
    description: "Costo asignado de alimento y operación prorrateada por huevo.",
    unit: "COP",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "lower_is_better",
    defaultTarget: 350,
    warningThreshold: 430,
    criticalThreshold: 520,
    drilldownHref: "/dashboard/finanzas",
    drilldownLabel: "Revisar costos de postura",
  },
  egg_margin: {
    id: "egg_margin",
    kind: "metric",
    category: "finanzas",
    title: "Margen por huevo",
    shortTitle: "Margen / huevo",
    description: "Diferencia entre precio promedio de venta y costo unitario del huevo.",
    unit: "COP",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "higher_is_better",
    defaultTarget: 80,
    warningThreshold: 0,
    criticalThreshold: -0.01,
    drilldownHref: "/dashboard/finanzas/ventas",
    drilldownLabel: "Ver ventas y equilibrio",
  },
  mortality_rate: {
    id: "mortality_rate",
    kind: "metric",
    category: "sanidad",
    title: "Mortalidad del período",
    shortTitle: "Mortalidad %",
    description: "Porcentaje de bajas registradas sobre la población del alcance filtrado.",
    unit: "%",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "lower_is_better",
    defaultTarget: 1.5,
    warningThreshold: 3,
    criticalThreshold: 5,
    drilldownHref: "/dashboard/produccion/mortalidad",
    drilldownLabel: "Ver historial de bajas",
  },
  feed_autonomy: {
    id: "feed_autonomy",
    kind: "metric",
    category: "operacion",
    title: "Autonomía de alimento",
    shortTitle: "Cobertura alimento",
    description: "Días estimados de inventario en bodega frente al consumo diario actual.",
    unit: "días",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "higher_is_better",
    defaultTarget: 10,
    warningThreshold: 5,
    criticalThreshold: 3,
    drilldownHref: "/dashboard/inventarios/alimentacion",
    drilldownLabel: "Ver inventario de alimento",
  },
  net_profit: {
    id: "net_profit",
    kind: "metric",
    category: "finanzas",
    title: "Utilidad neta del período",
    shortTitle: "Utilidad neta",
    description: "Balance entre ingresos por ventas y egresos operativos registrados.",
    unit: "COP",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "higher_is_better",
    defaultTarget: 1,
    warningThreshold: 0,
    criticalThreshold: -0.01,
    drilldownHref: "/dashboard/finanzas",
    drilldownLabel: "Ver flujo financiero",
  },
  cost_per_kg_meat: {
    id: "cost_per_kg_meat",
    kind: "metric",
    category: "engorde",
    title: "Costo por kg de carne",
    shortTitle: "Costo / kg carne",
    description: "Costo unitario asignado a carne beneficiada / canal vendible.",
    unit: "COP/kg",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "lower_is_better",
    defaultTarget: 8500,
    warningThreshold: 10500,
    criticalThreshold: 12500,
    drilldownHref: "/dashboard/inventarios/carne",
    drilldownLabel: "Ver inventario de carne",
  },
  epef: {
    id: "epef",
    kind: "metric",
    category: "engorde",
    title: "Eficiencia de engorde",
    shortTitle: "Eficiencia engorde",
    description: "Puntaje de qué tan bien engorda el lote según supervivencia, peso logrado y alimento usado (EPEF).",
    unit: "pts",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "higher_is_better",
    defaultTarget: 300,
    warningThreshold: 250,
    criticalThreshold: 200,
    drilldownHref: "/dashboard/produccion/pollos",
    drilldownLabel: "Ver lotes de engorde",
  },
  uniformity: {
    id: "uniformity",
    kind: "metric",
    category: "engorde",
    title: "Lote parejo (Uniformidad)",
    shortTitle: "Uniformidad %",
    description: "Porcentaje de animales con peso cercano al promedio del lote (±10%).",
    unit: "%",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: true,
    direction: "higher_is_better",
    defaultTarget: 80,
    warningThreshold: 70,
    criticalThreshold: 60,
    drilldownHref: "/dashboard/produccion/peso",
    drilldownLabel: "Revisar pesajes y lotes",
  },
  capex_roi: {
    id: "capex_roi",
    kind: "metric",
    category: "finanzas",
    title: "Retorno anual de equipos e instalaciones",
    shortTitle: "Retorno equipos",
    description: "Cuánto rinde al año la inversión hecha en equipos, comederos e infraestructura.",
    unit: "%",
    defaultSize: "compact",
    supportsCustomTarget: true,
    supportsPinToHome: false,
    direction: "higher_is_better",
    defaultTarget: 20,
    warningThreshold: 8,
    criticalThreshold: 0,
    drilldownHref: "/dashboard/operaciones/activos",
    drilldownLabel: "Ver inversión y activos",
  },
  chart_laying_curve: {
    id: "chart_laying_curve",
    kind: "chart",
    category: "postura",
    title: "Curva de postura vs. meta de raza",
    shortTitle: "Curva de postura",
    description: "Evolución diaria de producción comparada frente a la meta productiva.",
    unit: "%",
    defaultSize: "wide",
    supportsCustomTarget: false,
    supportsPinToHome: false,
    direction: "neutral",
    defaultTarget: null,
    warningThreshold: null,
    criticalThreshold: null,
    drilldownHref: "/dashboard/produccion/huevos",
    drilldownLabel: "Ir a producción diaria",
  },
  chart_mortality_causes: {
    id: "chart_mortality_causes",
    kind: "chart",
    category: "sanidad",
    title: "Causas de mortalidad",
    shortTitle: "Causas mortalidad",
    description: "Distribución de bajas por causa registrada en el período.",
    unit: "casos",
    defaultSize: "wide",
    supportsCustomTarget: false,
    supportsPinToHome: false,
    direction: "neutral",
    defaultTarget: null,
    warningThreshold: null,
    criticalThreshold: null,
    drilldownHref: "/dashboard/sanidad",
    drilldownLabel: "Ir a sanidad",
  },
  chart_cost_breakdown: {
    id: "chart_cost_breakdown",
    kind: "chart",
    category: "finanzas",
    title: "Desglose de egresos y equilibrio",
    shortTitle: "Desglose de costos",
    description: "Estructura de gastos por categoría operativa e ingresos comparados.",
    unit: "COP",
    defaultSize: "wide",
    supportsCustomTarget: false,
    supportsPinToHome: false,
    direction: "neutral",
    defaultTarget: null,
    warningThreshold: null,
    criticalThreshold: null,
    drilldownHref: "/dashboard/finanzas",
    drilldownLabel: "Ir a finanzas",
  },
  biological_value: {
    id: "biological_value",
    kind: "metric",
    category: "finanzas",
    title: "Valor actual de tus animales",
    shortTitle: "Valor animales",
    description:
      "Cuánto valen hoy tus aves y animales vivos según su edad y peso (separado del dinero en caja).",
    unit: "COP",
    defaultSize: "compact",
    supportsCustomTarget: false,
    supportsPinToHome: true,
    direction: "higher_is_better",
    defaultTarget: null,
    warningThreshold: null,
    criticalThreshold: null,
    drilldownHref: "/dashboard/analisis/reportes",
    drilldownLabel: "Ver valor de tus animales",
  },
  patrimony_wealth: {
    id: "patrimony_wealth",
    kind: "metric",
    category: "finanzas",
    title: "Patrimonio total de la granja",
    shortTitle: "Patrimonio",
    description:
      "Suma del valor de tus animales vivos + alimento disponible en bodega + valor restante de equipos.",
    unit: "COP",
    defaultSize: "compact",
    supportsCustomTarget: false,
    supportsPinToHome: true,
    direction: "higher_is_better",
    defaultTarget: null,
    warningThreshold: null,
    criticalThreshold: null,
    drilldownHref: "/dashboard/operaciones/activos",
    drilldownLabel: "Ver equipos y bodega",
  },
};

export interface FarmPresetSignals {
  activeSpecies?: string[];
  totalEggs?: number;
  totalMeatKg?: number;
  hasBroilerBatches?: boolean;
  hasLayingAnimals?: boolean;
}

const POSTURA_ORDER: KpiWidgetId[] = [
  "laying_rate",
  "laying_haa",
  "cost_per_egg",
  "egg_margin",
  "mortality_rate",
  "feed_autonomy",
  "net_profit",
  "biological_value",
  "patrimony_wealth",
  "chart_laying_curve",
  "chart_cost_breakdown",
  "chart_mortality_causes",
  "capex_roi",
  "uniformity",
  "cost_per_kg_meat",
  "epef",
];

const POSTURA_VISIBLE = new Set<KpiWidgetId>([
  "laying_rate",
  "laying_haa",
  "cost_per_egg",
  "egg_margin",
  "mortality_rate",
  "feed_autonomy",
  "net_profit",
  "biological_value",
  "chart_laying_curve",
  "chart_cost_breakdown",
  "chart_mortality_causes",
]);

const ENGORDE_ORDER: KpiWidgetId[] = [
  "epef",
  "cost_per_kg_meat",
  "uniformity",
  "mortality_rate",
  "feed_autonomy",
  "biological_value",
  "patrimony_wealth",
  "net_profit",
  "capex_roi",
  "chart_mortality_causes",
  "chart_cost_breakdown",
  "laying_rate",
  "laying_haa",
  "cost_per_egg",
  "egg_margin",
  "chart_laying_curve",
];

const ENGORDE_VISIBLE = new Set<KpiWidgetId>([
  "epef",
  "cost_per_kg_meat",
  "uniformity",
  "mortality_rate",
  "feed_autonomy",
  "biological_value",
  "patrimony_wealth",
  "net_profit",
  "capex_roi",
  "chart_mortality_causes",
  "chart_cost_breakdown",
]);

const GERENCIAL_ORDER: KpiWidgetId[] = [
  "net_profit",
  "patrimony_wealth",
  "biological_value",
  "mortality_rate",
  "feed_autonomy",
  "capex_roi",
  "laying_rate",
  "cost_per_egg",
  "egg_margin",
  "cost_per_kg_meat",
  "epef",
  "uniformity",
  "laying_haa",
  "chart_cost_breakdown",
  "chart_laying_curve",
  "chart_mortality_causes",
];

const GERENCIAL_VISIBLE = new Set<KpiWidgetId>([
  "net_profit",
  "patrimony_wealth",
  "biological_value",
  "mortality_rate",
  "feed_autonomy",
  "capex_roi",
  "laying_rate",
  "cost_per_egg",
  "egg_margin",
  "cost_per_kg_meat",
  "chart_cost_breakdown",
  "chart_laying_curve",
  "chart_mortality_causes",
]);

const DEFAULT_PINNED_BY_PRESET: Record<KpiResolvedPresetId, KpiWidgetId[]> = {
  postura: ["laying_rate", "cost_per_egg", "mortality_rate", "feed_autonomy"],
  engorde: ["epef", "cost_per_kg_meat", "mortality_rate", "feed_autonomy"],
  gerencial: ["net_profit", "laying_rate", "mortality_rate", "feed_autonomy"],
};

const MEAT_SPECIES = new Set(["pollo", "pollo_engorde", "pato", "conejo", "cuy"]);
const EGG_SPECIES = new Set(["gallina", "gallina_ponedora", "codorniz", "pato"]);

export function resolveRecommendedPreset(signals: FarmPresetSignals): KpiResolvedPresetId {
  const species = signals.activeSpecies ?? [];
  const hasEggSpecies = Boolean(signals.hasLayingAnimals) || species.some((sp) => EGG_SPECIES.has(sp));
  const hasMeatSpecies = Boolean(signals.hasBroilerBatches) || species.some((sp) => MEAT_SPECIES.has(sp));
  const totalEggs = signals.totalEggs ?? 0;
  const totalMeatKg = signals.totalMeatKg ?? 0;

  if (hasMeatSpecies && !hasEggSpecies) return "engorde";
  if (hasEggSpecies && !hasMeatSpecies) return "postura";
  if (hasMeatSpecies && hasEggSpecies) {
    if (totalMeatKg > 0 && totalEggs === 0) return "engorde";
    if (totalEggs > 0 && totalMeatKg === 0) return "postura";
    return "gerencial";
  }
  if (totalEggs > 0 && totalMeatKg <= 0) return "postura";
  if (totalMeatKg > 0 && totalEggs <= 0) return "engorde";
  return "gerencial";
}

export function buildPresetConfig(
  preset: KpiPresetId,
  recommended: KpiResolvedPresetId = "gerencial"
): KpiDashboardConfig {
  const effectivePreset: KpiResolvedPresetId =
    preset === "auto" || preset === "custom" ? recommended : preset;

  const order =
    effectivePreset === "postura"
      ? POSTURA_ORDER
      : effectivePreset === "engorde"
        ? ENGORDE_ORDER
        : GERENCIAL_ORDER;

  const visibleSet =
    effectivePreset === "postura"
      ? POSTURA_VISIBLE
      : effectivePreset === "engorde"
        ? ENGORDE_VISIBLE
        : GERENCIAL_VISIBLE;

  const pinnedSet = new Set(DEFAULT_PINNED_BY_PRESET[effectivePreset]);

  const widgets: KpiWidgetUserPref[] = order.map((id, idx) => {
    const catalog = KPI_WIDGET_CATALOG[id];
    return {
      id,
      visible: visibleSet.has(id),
      order: idx,
      size: catalog.defaultSize,
      customTarget: null,
      pinnedToHome: catalog.supportsPinToHome && pinnedSet.has(id),
    };
  });

  return {
    version: KPI_DASHBOARD_VERSION,
    preset,
    widgets,
    updatedAt: new Date().toISOString(),
  };
}

export function isValidKpiWidgetId(value: unknown): value is KpiWidgetId {
  return typeof value === "string" && value in KPI_WIDGET_CATALOG;
}

export function isValidKpiPresetId(value: unknown): value is KpiPresetId {
  return typeof value === "string" && value in KPI_PRESETS;
}

export function normalizeKpiDashboardConfig(
  raw: unknown,
  recommended: KpiResolvedPresetId = "gerencial"
): KpiDashboardConfig {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const preset: KpiPresetId = isValidKpiPresetId(input.preset) ? input.preset : "auto";
  const base = buildPresetConfig(preset, recommended);

  if (!Array.isArray(input.widgets) || input.widgets.length === 0) {
    return base;
  }

  const baseById = new Map<KpiWidgetId, KpiWidgetUserPref>(base.widgets.map((w) => [w.id, w]));
  const seen = new Set<KpiWidgetId>();
  const collected: KpiWidgetUserPref[] = [];

  for (const rawItem of input.widgets) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Record<string, unknown>;
    if (!isValidKpiWidgetId(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    const catalog = KPI_WIDGET_CATALOG[item.id];
    const fallback = baseById.get(item.id)!;

    const rawSize = item.size;
    const size: KpiWidgetSize =
      rawSize === "compact" || rawSize === "wide" ? rawSize : fallback.size;

    let customTarget: number | null = null;
    if (
      catalog.supportsCustomTarget &&
      typeof item.customTarget === "number" &&
      Number.isFinite(item.customTarget)
    ) {
      customTarget = Number(item.customTarget.toFixed(2));
    }

    collected.push({
      id: item.id,
      visible: typeof item.visible === "boolean" ? item.visible : fallback.visible,
      order:
        typeof item.order === "number" && Number.isFinite(item.order)
          ? item.order
          : collected.length,
      size,
      customTarget,
      pinnedToHome: catalog.supportsPinToHome && item.pinnedToHome === true,
    });
  }

  // Append any catalog widgets absent from stored payload so updates don't lose new widgets.
  for (const baseWidget of base.widgets) {
    if (!seen.has(baseWidget.id)) {
      collected.push({
        ...baseWidget,
        order: collected.length + baseWidget.order,
        pinnedToHome: false,
      });
    }
  }

  collected.sort((a, b) => a.order - b.order);

  let pinnedCount = 0;
  const normalizedWidgets: KpiWidgetUserPref[] = collected.map((widget, idx) => {
    let pinned = widget.pinnedToHome;
    if (pinned) {
      if (pinnedCount >= MAX_PINNED_KPI_WIDGETS) {
        pinned = false;
      } else {
        pinnedCount += 1;
      }
    }
    return {
      ...widget,
      order: idx,
      pinnedToHome: pinned,
    };
  });

  return {
    version: KPI_DASHBOARD_VERSION,
    preset,
    widgets: normalizedWidgets,
    updatedAt:
      typeof input.updatedAt === "string" && input.updatedAt.trim()
        ? input.updatedAt
        : new Date().toISOString(),
  };
}

export interface EvaluateKpiStatusOptions {
  direction: KpiDirection;
  customTarget?: number | null;
  benchmarkTarget?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
}

const STATUS_LABELS: Record<KpiHealthStatus, string> = {
  optimal: "Óptimo",
  warning: "Vigilar",
  critical: "Crítico",
  neutral: "Informativo",
};

export function evaluateKpiStatus(
  value: number | null | undefined,
  options: EvaluateKpiStatusOptions
): KpiStatusEvaluation {
  if (value === null || value === undefined || !Number.isFinite(value) || options.direction === "neutral") {
    return { status: "neutral", label: STATUS_LABELS.neutral };
  }

  const target =
    typeof options.customTarget === "number" && Number.isFinite(options.customTarget)
      ? options.customTarget
      : options.benchmarkTarget;

  if (options.direction === "higher_is_better") {
    if (typeof target === "number" && Number.isFinite(target)) {
      if (typeof options.customTarget === "number" && Number.isFinite(options.customTarget)) {
        const warnFloor = target > 0 ? target * 0.85 : target - Math.max(Math.abs(target) * 0.15, 1);
        if (value >= target) return { status: "optimal", label: STATUS_LABELS.optimal };
        if (value >= warnFloor) return { status: "warning", label: STATUS_LABELS.warning };
        return { status: "critical", label: STATUS_LABELS.critical };
      }

      if (value >= target) return { status: "optimal", label: STATUS_LABELS.optimal };
      if (typeof options.criticalThreshold === "number" && Number.isFinite(options.criticalThreshold)) {
        return value <= options.criticalThreshold
          ? { status: "critical", label: STATUS_LABELS.critical }
          : { status: "warning", label: STATUS_LABELS.warning };
      }
      if (typeof options.warningThreshold === "number" && Number.isFinite(options.warningThreshold)) {
        return value >= options.warningThreshold
          ? { status: "warning", label: STATUS_LABELS.warning }
          : { status: "critical", label: STATUS_LABELS.critical };
      }
      return { status: "warning", label: STATUS_LABELS.warning };
    }
    return { status: "neutral", label: STATUS_LABELS.neutral };
  }

  // lower_is_better
  if (typeof target === "number" && Number.isFinite(target)) {
    if (typeof options.customTarget === "number" && Number.isFinite(options.customTarget)) {
      const warnCeil = target > 0 ? target * 1.25 : target === 0 ? 1 : target * 0.75;
      if (value <= target) return { status: "optimal", label: STATUS_LABELS.optimal };
      if (value <= warnCeil) return { status: "warning", label: STATUS_LABELS.warning };
      return { status: "critical", label: STATUS_LABELS.critical };
    }

    if (value <= target) return { status: "optimal", label: STATUS_LABELS.optimal };
    if (typeof options.criticalThreshold === "number" && Number.isFinite(options.criticalThreshold)) {
      return value >= options.criticalThreshold
        ? { status: "critical", label: STATUS_LABELS.critical }
        : { status: "warning", label: STATUS_LABELS.warning };
    }
    if (typeof options.warningThreshold === "number" && Number.isFinite(options.warningThreshold)) {
      return value <= options.warningThreshold
        ? { status: "warning", label: STATUS_LABELS.warning }
        : { status: "critical", label: STATUS_LABELS.critical };
    }
    return { status: "warning", label: STATUS_LABELS.warning };
  }

  return { status: "neutral", label: STATUS_LABELS.neutral };
}

export function computeDeltaPct(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return null;
  }
  if (previous === 0) {
    return null;
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(pct)) return null;
  return Number(pct.toFixed(1));
}

export type KpiConfigSource = "user" | "farm_default" | "recommended";

export interface PreviousPeriodComparison {
  periodDays: number;
  startDate: string;
  endDate: string;
  mortalityRate: number;
  layingRate: number;
  layingHaaRate: number;
  costPerEgg: number;
  eggMargin: number;
  avgSalePricePerEgg: number;
  costPerKgMeat: number;
  netProfit: number;
  epef: number | null;
  uniformityPct: number | null;
  totalEggs: number;
  totalDeaths: number;
  deltas: {
    laying_rate: number | null;
    laying_haa: number | null;
    cost_per_egg: number | null;
    egg_margin: number | null;
    mortality_rate: number | null;
    net_profit: number | null;
    cost_per_kg_meat: number | null;
    epef: number | null;
    uniformity: number | null;
  };
}

export interface KpiFinanceSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  marginPct: number | null;
  cashOutflows?: number;
  cashNetFlow?: number;
  capexExcluded?: number;
  feedPurchasesExcluded?: number;
  periodDepreciation?: number;
  warehouseFeedAssetCop?: number;
  netEquipmentBookValueCop?: number;
  biologicalPortfolioValueCop?: number;
  totalProductiveWealthCop?: number;
  capexRecoveryPct?: number;
}

export interface KpiFeedAutonomy {
  daysRemaining: number | null;
  currentStockKg: number;
  dailyConsumptionKg: number;
  source: "movements" | "estimated" | "no_data";
}

export interface KpiBenchmarks {
  layingTargetPct: number;
  mortalityMaxPct: number;
  fcrTarget: number;
  epefTarget: number;
  uniformityTargetPct: number;
  feedAutonomyMinDays: number;
  referenceEggPrice: number | null;
  referenceMeatPriceKg: number | null;
  breedLabel: string;
}

export interface KpiFarmContext {
  activeSpecies: Array<{ species: string; label: string; count: number }>;
  locations: Array<{ id: string; code: string; name: string; type: string; activeCount: number }>;
  activeBatches: Array<{
    id: string;
    code: string;
    species: string;
    speciesLabel: string;
    purpose: string;
    breed: string;
    currentQuantity: number;
    initialQuantity: number;
    locationId: string | null;
  }>;
  recommendedPreset: KpiResolvedPresetId;
}

export interface KpiDashboardData {
  filters: {
    species: string | null;
    locationId: string | null;
    batchId: string | null;
  };
  mortality: {
    rate: number;
    totalDeaths: number;
    totalFlock: number;
    byCause: Array<{ cause: string; total: number }>;
  };
  laying: {
    rate: number;
    haaRate: number;
    totalEggs: number;
    eligibleEggs: number;
    eligibleAnimals: number;
    avgDaily: number;
    series: Array<{ date: string; total: number }>;
  };
  costPerUnit: {
    perEgg: number;
    perTray30: number;
    avgSalePricePerEgg: number;
    breakevenAlertEggs: boolean;
    perKgMeat: number;
    perLiveKgMeat: number;
    totalExpenses: number;
    proratedCostsInPeriod: number;
    eggFeedCost: number;
    meatEstimatedCost: number;
    saleableMeatKg: number;
    totalCarcassKg: number;
    totalLiveKg: number;
  };
  zootechnical: {
    cvPercent: number | null;
    uniformityPct: number | null;
    dailyGainG: number | null;
    epef: number | null;
    feedKgConsumed: number;
    slaughterWindowAlerts: Array<{
      id: string;
      code: string;
      species: string;
      currentQuantity: number;
      ageDays: number;
      targetDays: number;
      avgWeightKg: number | null;
      targetWeightKg: number;
    }>;
  };
  capexRoi: {
    totalCapex: number;
    roiAnnualizedPct: number | null;
    paybackMonths: number | null;
  };
  flock: {
    avgAgeWeeks: number;
    totalBirds: number;
    productiveRatio: number;
  };
  expenseByCategory: Array<{ category: string; total: number | string }>;
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
  previousPeriod: PreviousPeriodComparison;
  finance: KpiFinanceSummary;
  feedAutonomy: KpiFeedAutonomy;
  benchmarks: KpiBenchmarks;
  farmContext: KpiFarmContext;
  customConfig: {
    config: KpiDashboardConfig;
    source: KpiConfigSource;
    recommendedPreset: KpiResolvedPresetId;
  };
  biologicalContext?: {
    lifecycleMode: string;
    lifecycleLabel: string;
    lifecycleDescription: string;
    totalAliveAnimals: number;
    totalBiologicalValueCop: number;
    unrealizedBiologicalGainCop: number;
    projectedHarvestValueCop: number;
    capexRecoveryPct: number;
    warehouseFeedAssetCop: number;
    netEquipmentBookValueCop: number;
    totalProductiveWealthCop: number;
    alerts: Array<{
      id: string;
      species: string;
      entityName: string;
      severity: "info" | "warning" | "critical";
      title: string;
      detail: string;
      recommendedAction: string;
    }>;
  };
}

