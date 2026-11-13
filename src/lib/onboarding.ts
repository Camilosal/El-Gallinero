export const SANITARY_CALENDAR_REVIEW_KEY = "onboarding.sanitary_calendar_reviewed_at";
export const PROGRESSIVE_CONFIG_SETTING_KEY = "onboarding.progressive_config.v1";
export const ACTIVATION_HISTORY_SETTING_KEY = "onboarding.activation_history.v1";
export const ONBOARDING_UPDATED_EVENT = "gallinero:onboarding-updated";

export type ProducerScale = "PEQUENO" | "MEDIANO";

export type CoreFeatureFlagKey =
  | "core_captura_diaria_offline"
  | "inventario_bodega_cobertura"
  | "sanidad_retiros_compostaje"
  | "whatsapp_parte_diario";

export type ProgressiveUnlockableFlagKey =
  | "auditoria_poe_gab_ica"
  | "centros_costo_prorrateo"
  | "clasificacion_ntc1240_calibres"
  | "reportes_dian_roi_credito"
  | "genealogia_3gen_qr_iot";

export type FeatureFlagKey = CoreFeatureFlagKey | ProgressiveUnlockableFlagKey;

export type ActivationOrigin =
  | "PERFIL_INICIAL"
  | "MANUAL_USUARIO"
  | "AUTO_TRIGGER_CRECIMIENTO";

export interface FeatureFlagDefinition {
  key: FeatureFlagKey;
  name: string;
  description: string;
  defaultPequeno: boolean;
  defaultMediano: boolean;
  manualUnlock: boolean;
  autoTriggerExpr: string | null;
  autoTriggerDescription: string | null;
  category: "core" | "sanidad" | "finanzas" | "produccion" | "tecnologia";
  affectedRoutes: string[];
  configHref: string;
}

export interface ProgressiveConfig {
  scale: ProducerScale;
  onboardingCompleted: boolean;
  wizardDismissed: boolean;
  operationStartDate: string;
  selectedSpecies: string[];
  solicitaReporteFormal: boolean;
  flags: Record<ProgressiveUnlockableFlagKey, boolean>;
  /** Explicit user choices (`MANUAL_USUARIO`): `false` prevents auto-trigger from overriding an intentional disable. */
  manualOverrides: Partial<Record<ProgressiveUnlockableFlagKey, boolean>>;
  updatedAt: string;
}

export interface ActivationHistoryEntry {
  id: string;
  featureKey: FeatureFlagKey;
  estadoAnterior: boolean;
  estadoNuevo: boolean;
  origin: ActivationOrigin;
  triggerReason: string;
  activatedAt: string;
}

export interface LiveFarmMetrics {
  avesActivasTotales: number;
  gallinasPonedorasActivas: number;
  reproductoresMamiferos: number;
  especiesActivas: number;
  especiesList: string[];
  locationsCount: number;
  animalsTotal: number;
  feedInventoryCount: number;
  feedStockKg: number;
  hasExistingOperation: boolean;
}

export interface AutoTriggerProgressItem {
  key: ProgressiveUnlockableFlagKey;
  name: string;
  currentValue: number;
  threshold: number;
  unitLabel: string;
  percent: number;
  met: boolean;
  active: boolean;
  autoTriggerExpr: string;
}

export interface AutoTriggerEvaluation {
  triggeredFlags: ProgressiveUnlockableFlagKey[];
  newlyActivatedFlags: ProgressiveUnlockableFlagKey[];
  progress: AutoTriggerProgressItem[];
}

export interface Day1StarterRow {
  nombreInstalacion: string;
  tipoInstalacion: string;
  especie: string;
  codigoLote: string;
  lineaGenetica: string;
  edadActualDias: number;
  cantidadVivaHoy: number;
  saldoConcentradoBultos40kg: number;
}

export interface Day1CsvParseResult {
  rows: Day1StarterRow[];
  errors: string[];
}

export const DAY1_ONBOARDING_RULES = {
  exigirHistorialPasado: false,
  pasosMaximosWizard: 3,
  tiempoObjetivoSetupMinutos: 5,
  datosMinimosArranque: [
    "nombre_predio_y_altitud",
    "inventario_vivo_actual_por_unidad",
    "saldo_bodega_concentrado_bultos_40kg",
  ] as const,
} as const;

export const PROGRESSIVE_UNLOCKABLE_KEYS: ProgressiveUnlockableFlagKey[] = [
  "auditoria_poe_gab_ica",
  "centros_costo_prorrateo",
  "clasificacion_ntc1240_calibres",
  "reportes_dian_roi_credito",
  "genealogia_3gen_qr_iot",
];

export const FEATURE_FLAG_CATALOG: FeatureFlagDefinition[] = [
  {
    key: "core_captura_diaria_offline",
    name: "Captura Diaria Rápida (Offline + Alertas Biológicas)",
    description: "Registro de postura, bajas, alimentación y peso desde campo sin conexión, con operación activa desde el Día 1.",
    defaultPequeno: true,
    defaultMediano: true,
    manualUnlock: false,
    autoTriggerExpr: null,
    autoTriggerDescription: "Siempre activo en todas las escalas productivas.",
    category: "core",
    affectedRoutes: ["/dashboard", "/dashboard/produccion", "/dashboard/escanear"],
    configHref: "/dashboard/produccion",
  },
  {
    key: "inventario_bodega_cobertura",
    name: "Inventario de Alimento por Bultos y Días de Cobertura",
    description: "Control de bodega en bultos de 40 kg o kg con proyección automática de días de autonomía.",
    defaultPequeno: true,
    defaultMediano: true,
    manualUnlock: false,
    autoTriggerExpr: null,
    autoTriggerDescription: "Siempre activo en todas las escalas productivas.",
    category: "core",
    affectedRoutes: ["/dashboard/almacen", "/dashboard/produccion?tab=alimentacion"],
    configHref: "/dashboard/almacen",
  },
  {
    key: "sanidad_retiros_compostaje",
    name: "Plan Sanitario, Tiempos de Retiro y Compostaje Rápido",
    description: "Vacunación esencial, alertas de carencia farmacológica e higienización básica de mortalidad.",
    defaultPequeno: true,
    defaultMediano: true,
    manualUnlock: false,
    autoTriggerExpr: null,
    autoTriggerDescription: "Siempre activo en todas las escalas productivas.",
    category: "core",
    affectedRoutes: ["/dashboard/sanidad", "/dashboard/operaciones/compostaje"],
    configHref: "/dashboard/sanidad",
  },
  {
    key: "whatsapp_parte_diario",
    name: "Resumen y Alertas por WhatsApp",
    description: "Parte operativo diario y recordatorios rápidos de rutina o stock crítico.",
    defaultPequeno: true,
    defaultMediano: true,
    manualUnlock: false,
    autoTriggerExpr: null,
    autoTriggerDescription: "Siempre activo en todas las escalas productivas.",
    category: "core",
    affectedRoutes: ["/dashboard/planeacion/calendario"],
    configHref: "/dashboard/planeacion/calendario",
  },
  {
    key: "auditoria_poe_gab_ica",
    name: "Auditoría POE GAB y Bienestar ICA (Res. 3651/8452)",
    description: "Listas de chequeo de bioseguridad, vacío sanitario, certificaciones de personal y bienestar animal.",
    defaultPequeno: false,
    defaultMediano: true,
    manualUnlock: true,
    autoTriggerExpr: "aves_activas_totales > 200",
    autoTriggerDescription: "Se activa automáticamente cuando las aves activas superan 200 ejemplares.",
    category: "sanidad",
    affectedRoutes: ["/dashboard/sanidad/bioseguridad"],
    configHref: "/dashboard/sanidad/bioseguridad",
  },
  {
    key: "centros_costo_prorrateo",
    name: "Centros de Costo por Especie y Prorrateo",
    description: "Contabilidad analítica anti-subsidio cruzado, reparto de gastos indirectos compartidos y punto de equilibrio por especie.",
    defaultPequeno: false,
    defaultMediano: true,
    manualUnlock: true,
    autoTriggerExpr: "especies_activas >= 2",
    autoTriggerDescription: "Se activa automáticamente al operar 2 o más especies activas en la granja.",
    category: "finanzas",
    affectedRoutes: ["/dashboard/analisis/reportes?tab=analitica"],
    configHref: "/dashboard/analisis/reportes?tab=analitica",
  },
  {
    key: "clasificacion_ntc1240_calibres",
    name: "Clasificación NTC 1240 (Jumbo a C) y Stock PEPS",
    description: "Desglose por calibres comerciales NTC 1240, lotes PEPS, margen por talla y monitoreo ambiental de almacenamiento.",
    defaultPequeno: false,
    defaultMediano: true,
    manualUnlock: true,
    autoTriggerExpr: "gallinas_ponedoras_activas >= 150",
    autoTriggerDescription: "Se activa automáticamente al alcanzar 150 o más gallinas ponedoras activas.",
    category: "produccion",
    affectedRoutes: ["/dashboard/produccion?tab=huevos", "/dashboard/inventarios/huevos"],
    configHref: "/dashboard/produccion?tab=huevos",
  },
  {
    key: "reportes_dian_roi_credito",
    name: "Reportes Formales DIAN, Crédito Banco Agrario y ROI CapEx",
    description: "Presupuestos formales, exportación tributaria DIAN, flujo para crédito agropecuario y retorno de inversión en activos.",
    defaultPequeno: false,
    defaultMediano: true,
    manualUnlock: true,
    autoTriggerExpr: "solicita_reporte_formal == true",
    autoTriggerDescription: "Se activa automáticamente al habilitar la solicitud de reportes formales DIAN/crédito.",
    category: "finanzas",
    affectedRoutes: ["/dashboard/finanzas/presupuestos", "/dashboard/analisis/reportes"],
    configHref: "/dashboard/analisis/reportes",
  },
  {
    key: "genealogia_3gen_qr_iot",
    name: "Genealogía 3 Generaciones, Carnets QR y Sensores IoT",
    description: "Pedigrí 3 generaciones (control de consanguinidad), cierre diario auditable antifraude y telemetría IoT (ITH/NH3/báscula).",
    defaultPequeno: false,
    defaultMediano: true,
    manualUnlock: true,
    autoTriggerExpr: "reproductores_mamiferos >= 30",
    autoTriggerDescription: "Se activa automáticamente al registrar 30 o más animales mamíferos (conejos/cuyes) o pie de cría.",
    category: "tecnologia",
    affectedRoutes: ["/dashboard/operaciones/cierre", "/dashboard/produccion?tab=reproduccion"],
    configHref: "/dashboard/operaciones/cierre",
  },
];

export const FEATURE_FLAG_BY_KEY: Record<FeatureFlagKey, FeatureFlagDefinition> = Object.fromEntries(
  FEATURE_FLAG_CATALOG.map((item) => [item.key, item]),
) as Record<FeatureFlagKey, FeatureFlagDefinition>;

/** Prefijos/rutas cuya visibilidad en navegación se controla progresivamente según escala o feature flag. */
export const PROGRESSIVE_ROUTE_GATES: ReadonlyArray<{
  prefix: string;
  flag: ProgressiveUnlockableFlagKey;
  exactMatch?: boolean;
}> = [
  { prefix: "/dashboard/sanidad/bioseguridad", flag: "auditoria_poe_gab_ica" },
  { prefix: "/dashboard/guia/bioseguridad-bienestar", flag: "auditoria_poe_gab_ica" },
  { prefix: "/dashboard/analisis/reportes?tab=analitica", flag: "centros_costo_prorrateo" },
  { prefix: "/dashboard/analisis/kpis", flag: "centros_costo_prorrateo" },
  { prefix: "/dashboard/inventarios/huevos", flag: "clasificacion_ntc1240_calibres" },
  { prefix: "/dashboard/analisis/razas", flag: "clasificacion_ntc1240_calibres" },
  { prefix: "/dashboard/finanzas/presupuestos", flag: "reportes_dian_roi_credito" },
  { prefix: "/dashboard/guia/presupuestos", flag: "reportes_dian_roi_credito" },
  { prefix: "/dashboard/operaciones/activos", flag: "reportes_dian_roi_credito" },
  { prefix: "/dashboard/operaciones/mantenimiento", flag: "reportes_dian_roi_credito" },
  { prefix: "/dashboard/operaciones/cierre", flag: "genealogia_3gen_qr_iot" },
  { prefix: "/dashboard/guia/cierre-sensores", flag: "genealogia_3gen_qr_iot" },
];

export function buildScaleDefaultFlags(
  scale: ProducerScale,
): Record<ProgressiveUnlockableFlagKey, boolean> {
  const isMediano = scale === "MEDIANO";
  return {
    auditoria_poe_gab_ica: isMediano,
    centros_costo_prorrateo: isMediano,
    clasificacion_ntc1240_calibres: isMediano,
    reportes_dian_roi_credito: isMediano,
    genealogia_3gen_qr_iot: isMediano,
  };
}

export function createDefaultProgressiveConfig(
  scale: ProducerScale = "PEQUENO",
): ProgressiveConfig {
  const now = new Date().toISOString();
  return {
    scale,
    onboardingCompleted: false,
    wizardDismissed: false,
    operationStartDate: now.slice(0, 10),
    selectedSpecies: ["gallina"],
    solicitaReporteFormal: scale === "MEDIANO",
    flags: buildScaleDefaultFlags(scale),
    manualOverrides: {},
    updatedAt: now,
  };
}

export function sanitizeProgressiveConfig(raw: unknown): ProgressiveConfig {
  const base = createDefaultProgressiveConfig("PEQUENO");
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  const scale: ProducerScale = obj.scale === "MEDIANO" ? "MEDIANO" : "PEQUENO";
  const defaultFlags = buildScaleDefaultFlags(scale);
  const rawFlags = (obj.flags && typeof obj.flags === "object"
    ? obj.flags
    : {}) as Record<string, unknown>;
  const rawOverrides = (obj.manualOverrides && typeof obj.manualOverrides === "object"
    ? obj.manualOverrides
    : {}) as Record<string, unknown>;

  const flags: Record<ProgressiveUnlockableFlagKey, boolean> = {
    auditoria_poe_gab_ica: typeof rawFlags.auditoria_poe_gab_ica === "boolean" ? rawFlags.auditoria_poe_gab_ica : defaultFlags.auditoria_poe_gab_ica,
    centros_costo_prorrateo: typeof rawFlags.centros_costo_prorrateo === "boolean" ? rawFlags.centros_costo_prorrateo : defaultFlags.centros_costo_prorrateo,
    clasificacion_ntc1240_calibres: typeof rawFlags.clasificacion_ntc1240_calibres === "boolean" ? rawFlags.clasificacion_ntc1240_calibres : defaultFlags.clasificacion_ntc1240_calibres,
    reportes_dian_roi_credito: typeof rawFlags.reportes_dian_roi_credito === "boolean" ? rawFlags.reportes_dian_roi_credito : defaultFlags.reportes_dian_roi_credito,
    genealogia_3gen_qr_iot: typeof rawFlags.genealogia_3gen_qr_iot === "boolean" ? rawFlags.genealogia_3gen_qr_iot : defaultFlags.genealogia_3gen_qr_iot,
  };

  const manualOverrides: Partial<Record<ProgressiveUnlockableFlagKey, boolean>> = {};
  for (const key of PROGRESSIVE_UNLOCKABLE_KEYS) {
    if (typeof rawOverrides[key] === "boolean") {
      manualOverrides[key] = rawOverrides[key] as boolean;
    }
  }

  return {
    scale,
    onboardingCompleted: Boolean(obj.onboardingCompleted),
    wizardDismissed: Boolean(obj.wizardDismissed),
    operationStartDate: typeof obj.operationStartDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.operationStartDate)
      ? obj.operationStartDate
      : base.operationStartDate,
    selectedSpecies: Array.isArray(obj.selectedSpecies)
      ? obj.selectedSpecies.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : base.selectedSpecies,
    solicitaReporteFormal: typeof obj.solicitaReporteFormal === "boolean"
      ? obj.solicitaReporteFormal
      : scale === "MEDIANO",
    flags,
    manualOverrides,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : base.updatedAt,
  };
}

/** Resuelve el mapa completo de 9 flags (4 core siempre activos + 5 progresivos). */
export function getEffectiveFlags(
  config: ProgressiveConfig,
): Record<FeatureFlagKey, boolean> {
  return {
    core_captura_diaria_offline: true,
    inventario_bodega_cobertura: true,
    sanidad_retiros_compostaje: true,
    whatsapp_parte_diario: true,
    auditoria_poe_gab_ica: Boolean(config.flags.auditoria_poe_gab_ica),
    centros_costo_prorrateo: Boolean(config.flags.centros_costo_prorrateo),
    clasificacion_ntc1240_calibres: Boolean(config.flags.clasificacion_ntc1240_calibres),
    reportes_dian_roi_credito: Boolean(config.flags.reportes_dian_roi_credito),
    genealogia_3gen_qr_iot: Boolean(config.flags.genealogia_3gen_qr_iot),
  };
}

/**
 * Evalúa las reglas declarativas de auto-activación (`auto_trigger`) definidas en
 * `feature_flags_escala.json` contra los conteos vivos de la granja y detecta qué
 * capacidades nuevas deben desbloquearse sin perder compatibilidad con toggles manuales.
 */
export function evaluateProgressiveTriggers(
  config: ProgressiveConfig,
  metrics: LiveFarmMetrics,
): AutoTriggerEvaluation {
  const effective = getEffectiveFlags(config);
  const items: AutoTriggerProgressItem[] = [
    {
      key: "auditoria_poe_gab_ica",
      name: FEATURE_FLAG_BY_KEY.auditoria_poe_gab_ica.name,
      currentValue: metrics.avesActivasTotales,
      threshold: 201,
      unitLabel: "aves activas (> 200)",
      percent: Math.min(100, Math.round((metrics.avesActivasTotales / 201) * 100)),
      met: metrics.avesActivasTotales > 200,
      active: effective.auditoria_poe_gab_ica,
      autoTriggerExpr: "aves_activas_totales > 200",
    },
    {
      key: "centros_costo_prorrateo",
      name: FEATURE_FLAG_BY_KEY.centros_costo_prorrateo.name,
      currentValue: metrics.especiesActivas,
      threshold: 2,
      unitLabel: "especies activas (≥ 2)",
      percent: Math.min(100, Math.round((metrics.especiesActivas / 2) * 100)),
      met: metrics.especiesActivas >= 2,
      active: effective.centros_costo_prorrateo,
      autoTriggerExpr: "especies_activas >= 2",
    },
    {
      key: "clasificacion_ntc1240_calibres",
      name: FEATURE_FLAG_BY_KEY.clasificacion_ntc1240_calibres.name,
      currentValue: metrics.gallinasPonedorasActivas,
      threshold: 150,
      unitLabel: "ponedoras activas (≥ 150)",
      percent: Math.min(100, Math.round((metrics.gallinasPonedorasActivas / 150) * 100)),
      met: metrics.gallinasPonedorasActivas >= 150,
      active: effective.clasificacion_ntc1240_calibres,
      autoTriggerExpr: "gallinas_ponedoras_activas >= 150",
    },
    {
      key: "reportes_dian_roi_credito",
      name: FEATURE_FLAG_BY_KEY.reportes_dian_roi_credito.name,
      currentValue: config.solicitaReporteFormal ? 1 : 0,
      threshold: 1,
      unitLabel: "solicitud formal DIAN/crédito",
      percent: config.solicitaReporteFormal ? 100 : 0,
      met: config.solicitaReporteFormal,
      active: effective.reportes_dian_roi_credito,
      autoTriggerExpr: "solicita_reporte_formal == true",
    },
    {
      key: "genealogia_3gen_qr_iot",
      name: FEATURE_FLAG_BY_KEY.genealogia_3gen_qr_iot.name,
      currentValue: metrics.reproductoresMamiferos,
      threshold: 30,
      unitLabel: "mamíferos activos / pie de cría (≥ 30)",
      percent: Math.min(100, Math.round((metrics.reproductoresMamiferos / 30) * 100)),
      met: metrics.reproductoresMamiferos >= 30,
      active: effective.genealogia_3gen_qr_iot,
      autoTriggerExpr: "reproductores_mamiferos >= 30",
    },
  ];

  const triggeredFlags = items.filter((item) => item.met).map((item) => item.key);
  const newlyActivatedFlags = items
    .filter(
      (item) =>
        item.met &&
        !config.flags[item.key] &&
        config.manualOverrides[item.key] !== false,
    )
    .map((item) => item.key);

  return {
    triggeredFlags,
    newlyActivatedFlags,
    progress: items,
  };
}

/** Cambia la escala productiva recalculando flags por defecto sin migrar ni perder datos. */
export function applyScalePreset(
  config: ProgressiveConfig,
  nextScale: ProducerScale,
): {
  config: ProgressiveConfig;
  changes: Array<{ key: ProgressiveUnlockableFlagKey; from: boolean; to: boolean }>;
} {
  const defaults = buildScaleDefaultFlags(nextScale);
  const changes: Array<{ key: ProgressiveUnlockableFlagKey; from: boolean; to: boolean }> = [];
  const nextFlags = { ...config.flags };

  for (const key of PROGRESSIVE_UNLOCKABLE_KEYS) {
    const prevVal = Boolean(config.flags[key]);
    const targetVal = defaults[key];
    if (prevVal !== targetVal) {
      changes.push({ key, from: prevVal, to: targetVal });
      nextFlags[key] = targetVal;
    }
  }

  return {
    config: {
      ...config,
      scale: nextScale,
      solicitaReporteFormal: nextScale === "MEDIANO",
      flags: nextFlags,
      manualOverrides: {},
      updatedAt: new Date().toISOString(),
    },
    changes,
  };
}

/** Infierencia inicial sin fricción para granjas ya en producción antes del onboarding progresivo. */
export function inferLegacyFarmConfig(metrics: LiveFarmMetrics): ProgressiveConfig {
  const hitsEnterpriseThreshold =
    metrics.avesActivasTotales > 200 ||
    metrics.especiesActivas >= 2 ||
    metrics.gallinasPonedorasActivas >= 150 ||
    metrics.reproductoresMamiferos >= 30;
  const scale: ProducerScale = hitsEnterpriseThreshold ? "MEDIANO" : "PEQUENO";
  const base = createDefaultProgressiveConfig(scale);
  return {
    ...base,
    onboardingCompleted: metrics.hasExistingOperation,
    selectedSpecies: metrics.especiesList.length > 0 ? metrics.especiesList : ["gallina"],
  };
}

/** Determina si una ruta está habilitada según los feature flags activos. */
export function getGateFlagForHref(href: string): ProgressiveUnlockableFlagKey | null {
  const clean = href.trim();
  for (const rule of PROGRESSIVE_ROUTE_GATES) {
    if (rule.exactMatch) {
      if (clean === rule.prefix) return rule.flag;
    } else if (clean === rule.prefix || clean.startsWith(rule.prefix + "?") || clean.startsWith(rule.prefix + "&") || clean.startsWith(rule.prefix + "/")) {
      return rule.flag;
    }
  }
  return null;
}

export function isHrefEnabledByFlags(
  href: string,
  flags: Partial<Record<FeatureFlagKey, boolean>> | null | undefined,
): boolean {
  if (!flags) return true;
  const gate = getGateFlagForHref(href);
  if (!gate) return true;
  return flags[gate] !== false;
}

const CSV_SPECIES_ALIASES: Record<string, string> = {
  gallina: "gallina",
  gallina_ponedora: "gallina",
  ponedora: "gallina",
  ponedoras: "gallina",
  gallo: "gallo",
  gallo_reproductor: "gallo",
  pollo: "pollo",
  pollo_engorde: "pollo",
  pollos: "pollo",
  broiler: "pollo",
  codorniz: "codorniz",
  codornices: "codorniz",
  pato: "pato",
  patos: "pato",
  conejo: "conejo",
  conejos: "conejo",
  cuy: "cuy",
  cuyes: "cuy",
  cobayo: "cuy",
  curi: "cuy",
};

const CSV_LOCATION_TYPE_ALIASES: Record<string, string> = {
  corral: "corral",
  jaula: "jaula",
  jaulas: "jaula",
  jaulas_elevadas: "jaula",
  galpon: "galpon",
  galpon_piso: "galpon",
  potrero: "potrero",
  poza: "corral",
  pozas: "corral",
  jardin: "jardin",
  patio: "patio",
  bodega: "bodega",
  cuarentena: "cuarentena",
  compostaje: "compostaje",
  otro: "otro",
};

export function normalizeDay1Species(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return CSV_SPECIES_ALIASES[key] ?? "pollo";
}

export function normalizeDay1LocationType(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return CSV_LOCATION_TYPE_ALIASES[key] ?? "corral";
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Parsea la plantilla de arranque Día 1 sin historial (`plantilla_arranque_dia1.csv`).
 * Columnas esperadas:
 * nombre_instalacion,tipo_instalacion,especie,codigo_lote,linea_genetica,edad_actual_dias,cantidad_viva_hoy,saldo_concentrado_bultos_40kg
 */
export function parseDay1StarterCsv(csvText: string): Day1CsvParseResult {
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) {
    return { rows: [], errors: ["El archivo CSV está vacío."] };
  }

  const headerCells = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = headerCells.includes("nombre_instalacion") || headerCells.includes("especie") || headerCells.includes("cantidad_viva_hoy");
  const startIdx = hasHeader ? 1 : 0;

  if (hasHeader && lines.length < 2) {
    return { rows: [], errors: ["Incluye al menos una fila con unidades productivas activas."] };
  }

  const rows: Day1StarterRow[] = [];
  const errors: string[] = [];

  for (let idx = startIdx; idx < lines.length; idx++) {
    const cells = splitCsvLine(lines[idx]);
    if (cells.length < 7) {
      errors.push(`Fila ${idx + 1}: faltan columnas obligatorias.`);
      continue;
    }
    const [
      nombreInstalacion,
      tipoInstalacionRaw,
      especieRaw,
      codigoLote,
      lineaGenetica,
      edadRaw,
      cantidadRaw,
      bultosRaw = "0",
    ] = cells;

    if (!nombreInstalacion) {
      errors.push(`Fila ${idx + 1}: nombre_instalacion es requerido.`);
      continue;
    }
    const edadActualDias = Number(edadRaw);
    const cantidadVivaHoy = Number(cantidadRaw);
    const saldoConcentradoBultos40kg = Number(bultosRaw || 0);

    if (!Number.isFinite(edadActualDias) || edadActualDias < 0) {
      errors.push(`Fila ${idx + 1}: edad_actual_dias inválida ("${edadRaw}").`);
      continue;
    }
    if (!Number.isInteger(cantidadVivaHoy) || cantidadVivaHoy <= 0) {
      errors.push(`Fila ${idx + 1}: cantidad_viva_hoy debe ser entero mayor a 0.`);
      continue;
    }
    if (!Number.isFinite(saldoConcentradoBultos40kg) || saldoConcentradoBultos40kg < 0) {
      errors.push(`Fila ${idx + 1}: saldo_concentrado_bultos_40kg inválido.`);
      continue;
    }

    rows.push({
      nombreInstalacion,
      tipoInstalacion: normalizeDay1LocationType(tipoInstalacionRaw),
      especie: normalizeDay1Species(especieRaw),
      codigoLote: codigoLote || "",
      lineaGenetica: lineaGenetica || "",
      edadActualDias: Math.round(edadActualDias),
      cantidadVivaHoy,
      saldoConcentradoBultos40kg,
    });
  }

  return { rows, errors };
}

export function exportDay1StarterCsvTemplate(): string {
  return [
    "nombre_instalacion,tipo_instalacion,especie,codigo_lote,linea_genetica,edad_actual_dias,cantidad_viva_hoy,saldo_concentrado_bultos_40kg",
    "Galpon Principal,galpon_piso,gallina_ponedora,LOTE-PON-01,Hy-Line Brown,182,80,4",
    "Cuyera Modulo A,poza,cuy,LOTE-CUY-01,Andino Mejorado,45,35,2",
    "Modulo Cunicola,jaulas_elevadas,conejo,LOTE-CON-01,Nueva Zelanda Blanco,60,18,1",
  ].join("\n");
}
