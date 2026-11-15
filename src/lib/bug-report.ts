import { navigationGroups } from "./navigation";
import { normalizeText } from "./text";

export type BugReportCategory =
  | "ui"
  | "calculo"
  | "guardado"
  | "acceso"
  | "norma_dato"
  | "mejora";

export type BugReportSeverity = "baja" | "media" | "alta" | "critica";

export type BugReportStatus = "abierto" | "en_revision" | "resuelto" | "descartado";

export type BugTriggerSource =
  | "topbar"
  | "sidebar"
  | "footer"
  | "nudge"
  | "pagina"
  | "error_boundary"
  | "manual";

export interface BugCapturedError {
  kind: "runtime" | "promise" | "network";
  message: string;
  source?: string;
  occurredAt: string;
}

export interface BugEnvironmentContext {
  online: boolean;
  deviceType: "movil" | "escritorio";
  viewport?: string;
  userAgent?: string;
  language?: string;
  standalonePwa?: boolean;
}

export interface BugOriginInfo {
  originPath: string;
  originQuery: string;
  originFullUrl: string;
  originModule: string;
  originGroup: string;
  triggerSource: BugTriggerSource;
}

export interface BugReportRecord {
  id: string;
  reportCode: string;
  status: BugReportStatus;
  category: BugReportCategory;
  severity: BugReportSeverity;
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  originPath: string;
  originQuery: string;
  originFullUrl: string;
  originModule: string;
  originGroup: string;
  triggerSource: BugTriggerSource;
  tags: string[];
  farmId: string;
  farmName: string;
  reporterId?: string | null;
  reporterUsername: string;
  reporterName: string;
  reporterRole: string;
  environment: BugEnvironmentContext;
  capturedErrors: BugCapturedError[];
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpenBugReportDetail {
  triggerSource?: BugTriggerSource;
  initialTitle?: string;
  initialDescription?: string;
  initialCategory?: BugReportCategory;
  initialSeverity?: BugReportSeverity;
  capturedError?: BugCapturedError;
}

export const OPEN_BUG_REPORT_EVENT = "gallinero-open-bug-report";
export const BUG_REPORT_UPDATED_EVENT = "gallinero-bug-report-updated";
const OFFLINE_QUEUE_KEY = "gallinero_pending_bug_reports_v1";

export const BUG_CATEGORY_LABELS: Record<BugReportCategory, string> = {
  ui: "Error visual o de pantalla",
  calculo: "Cálculo, KPI o curva incorrecta",
  guardado: "Fallo al guardar o sincronizar",
  acceso: "Acceso, permisos o sesión",
  norma_dato: "Norma, guía o dato externo",
  mejora: "Sugerencia o mejora operativa",
};

export const BUG_SEVERITY_LABELS: Record<BugReportSeverity, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const BUG_STATUS_LABELS: Record<BugReportStatus, string> = {
  abierto: "Abierto",
  en_revision: "En revisión",
  resuelto: "Resuelto",
  descartado: "Descartado",
};

export function openBugReportModal(detail: OpenBugReportDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenBugReportDetail>(OPEN_BUG_REPORT_EVENT, { detail }));
}

const EXTRA_ORIGIN_ROUTES: ReadonlyArray<{
  prefix: string;
  moduleLabel: string;
  groupLabel: string;
}> = [
  { prefix: "/escanear", moduleLabel: "Escáner QR de campo", groupLabel: "General" },
  { prefix: "/analisis/normas", moduleLabel: "Normas, estándares y guías aplicables", groupLabel: "Análisis" },
  { prefix: "/analisis/fuentes-externas", moduleLabel: "Clima, mercado y entorno", groupLabel: "Análisis" },
  { prefix: "/configuracion/fallas", moduleLabel: "Reportes de fallas y diagnóstico", groupLabel: "Configuración" },
  { prefix: "/configuracion/catalogos", moduleLabel: "Catálogos y Datos Maestros", groupLabel: "Configuración" },
  { prefix: "/configuracion/granjas", moduleLabel: "Panel Super-Admin de Granjas", groupLabel: "Configuración" },
  { prefix: "/configuracion/usuarios", moduleLabel: "Usuarios y Roles", groupLabel: "Configuración" },
  { prefix: "/configuracion/kit-campo", moduleLabel: "Kit de Campo y QR", groupLabel: "Configuración" },
  { prefix: "/configuracion/modulos", moduleLabel: "Módulos Progresivos y Escala", groupLabel: "Configuración" },
  { prefix: "/configuracion/plan", moduleLabel: "Plan y Pagos", groupLabel: "Configuración" },
  { prefix: "/configuracion", moduleLabel: "Configuración del sistema", groupLabel: "Configuración" },
  { prefix: "/exportar", moduleLabel: "Exportación de datos", groupLabel: "Configuración" },
  { prefix: "/manual", moduleLabel: "Manual y Guías de Usuario", groupLabel: "Guía" },
  { prefix: "/produccion/peso", moduleLabel: "Control de peso y biometría", groupLabel: "Animales" },
  { prefix: "/produccion/huevos", moduleLabel: "Producción · Huevos", groupLabel: "Producción" },
  { prefix: "/produccion/gallinas", moduleLabel: "Fichas de gallinas", groupLabel: "Animales" },
  { prefix: "/produccion/pollos", moduleLabel: "Lotes de engorde", groupLabel: "Animales" },
  { prefix: "/ubicaciones", moduleLabel: "Lugares de manejo", groupLabel: "Animales" },
  { prefix: "/lote/", moduleLabel: "Ficha pública/QR de lote", groupLabel: "Animales" },
  { prefix: "/guia", moduleLabel: "Manual público de uso", groupLabel: "Guía" },
];

export function resolveBugOriginInfo(
  pathname: string,
  searchQuery = "",
  triggerSource: BugTriggerSource = "topbar",
): BugOriginInfo {
  const cleanPath = (pathname || "/inicio").split("?")[0].replace(/\/+$/, "") || "/";
  const cleanQuery = searchQuery.startsWith("?") ? searchQuery.slice(1) : searchQuery;
  const fullWithQuery = cleanQuery ? `${cleanPath}?${cleanQuery}` : cleanPath;

  // 1. Coincidencia exacta con elementos de navegación (incluyendo query `?tab=`)
  for (const group of navigationGroups) {
    for (const item of group.items) {
      const [itemPath, itemQuery = ""] = item.href.split("?");
      if (itemQuery && fullWithQuery.startsWith(`${itemPath}?${itemQuery}`)) {
        return {
          originPath: cleanPath,
          originQuery: cleanQuery,
          originFullUrl: fullWithQuery,
          originModule: `${group.label} · ${item.label}`,
          originGroup: group.label,
          triggerSource,
        };
      }
      if (!itemQuery && cleanPath === itemPath) {
        return {
          originPath: cleanPath,
          originQuery: cleanQuery,
          originFullUrl: fullWithQuery,
          originModule: `${group.label} · ${item.label}`,
          originGroup: group.label,
          triggerSource,
        };
      }
    }
    if (cleanPath === group.indexHref) {
      return {
        originPath: cleanPath,
        originQuery: cleanQuery,
        originFullUrl: fullWithQuery,
        originModule: `${group.label} · Resumen`,
        originGroup: group.label,
        triggerSource,
      };
    }
  }

  // 2. Coincidencia con rutas auxiliares / configuración / guías
  for (const extra of EXTRA_ORIGIN_ROUTES) {
    if (cleanPath === extra.prefix || cleanPath.startsWith(extra.prefix)) {
      return {
        originPath: cleanPath,
        originQuery: cleanQuery,
        originFullUrl: fullWithQuery,
        originModule: extra.moduleLabel,
        originGroup: extra.groupLabel,
        triggerSource,
      };
    }
  }

  if (cleanPath === "/inicio") {
    return {
      originPath: "/inicio",
      originQuery: cleanQuery,
      originFullUrl: fullWithQuery,
      originModule: "Inicio · Panel principal",
      originGroup: "General",
      triggerSource,
    };
  }

  // 3. Fallback por prefijo de grupo
  for (const group of navigationGroups) {
    if (cleanPath.startsWith(group.indexHref)) {
      return {
        originPath: cleanPath,
        originQuery: cleanQuery,
        originFullUrl: fullWithQuery,
        originModule: `${group.label} · Vista interna`,
        originGroup: group.label,
        triggerSource,
      };
    }
  }

  return {
    originPath: cleanPath,
    originQuery: cleanQuery,
    originFullUrl: fullWithQuery,
    originModule: cleanPath === "/" ? "Inicio público" : `Ruta ${cleanPath}`,
    originGroup: "General",
    triggerSource,
  };
}

function toTagSlug(raw: string): string {
  return normalizeText(raw)
    .replace(/[^a-z0-9/_:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildBugTags(params: {
  originPath: string;
  originModule: string;
  originGroup: string;
  triggerSource: BugTriggerSource;
  category: BugReportCategory;
  severity: BugReportSeverity;
  online: boolean;
  deviceType: "movil" | "escritorio";
  reporterRole?: string;
  farmName?: string;
}): string[] {
  const rawTags = [
    `ruta:${params.originPath || "/"}`,
    `grupo:${toTagSlug(params.originGroup) || "general"}`,
    `modulo:${toTagSlug(params.originModule) || "general"}`,
    `origen:${params.triggerSource}`,
    `categoria:${params.category}`,
    `severidad:${params.severity}`,
    `red:${params.online ? "online" : "offline"}`,
    `dispositivo:${params.deviceType}`,
    params.reporterRole ? `rol:${toTagSlug(params.reporterRole)}` : "",
    params.farmName ? `granja:${toTagSlug(params.farmName)}` : "",
  ].filter(Boolean);

  return Array.from(new Set(rawTags));
}

export function formatBugReportPreviewText(input: {
  reportCode?: string;
  title: string;
  category: BugReportCategory;
  severity: BugReportSeverity;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  originFullUrl: string;
  originModule: string;
  originGroup: string;
  triggerSource: BugTriggerSource;
  tags: string[];
  farmName?: string;
  reporterUsername?: string;
  reporterRole?: string;
  environment?: BugEnvironmentContext;
  capturedErrors?: BugCapturedError[];
}): string {
  const lines: string[] = [
    `=== REPORTE DE FALLA · EL GALLINERO ===`,
    ...(input.reportCode ? [`Radicado: ${input.reportCode}`] : ["Estado: Borrador listo para envío"]),
    `Severidad: ${BUG_SEVERITY_LABELS[input.severity]} (${input.severity})`,
    `Categoría: ${BUG_CATEGORY_LABELS[input.category]}`,
    `Título: ${input.title || "(Sin título)"}`,
    ``,
    `--- ORIGEN Y ETIQUETAS (TAGS) ---`,
    `Módulo: ${input.originModule} (Grupo: ${input.originGroup})`,
    `Ruta exacta: ${input.originFullUrl}`,
    `Disparador: ${input.triggerSource}`,
    `Tags: ${input.tags.map((t) => `[${t}]`).join(" ")}`,
    ...(input.farmName ? [`Granja: ${input.farmName}`] : []),
    ...(input.reporterUsername ? [`Usuario: ${input.reporterUsername} (${input.reporterRole || "USUARIO"})`] : []),
    ...(input.environment
      ? [
          `Entorno: ${input.environment.deviceType} · ${input.environment.online ? "Online" : "Sin conexión"}${
            input.environment.viewport ? ` · ${input.environment.viewport}` : ""
          }`,
        ]
      : []),
    ``,
    `--- DESCRIPCIÓN ---`,
    input.description || "(Sin descripción)",
  ];

  if (input.stepsToReproduce?.trim()) {
    lines.push("", "--- PASOS PARA REPRODUCIR ---", input.stepsToReproduce.trim());
  }
  if (input.expectedBehavior?.trim()) {
    lines.push("", "--- RESULTADO ESPERADO ---", input.expectedBehavior.trim());
  }
  if (input.capturedErrors && input.capturedErrors.length > 0) {
    lines.push(
      "",
      `--- DIAGNÓSTICO TÉCNICO (${input.capturedErrors.length}) ---`,
      ...input.capturedErrors.map(
        (err, idx) => `${idx + 1}. [${err.kind}] ${err.occurredAt} — ${err.message}${err.source ? ` (${err.source})` : ""}`,
      ),
    );
  }

  return lines.join("\n");
}

// ─── Captura pasiva en memoria de errores recientes del navegador ───
const RECENT_ERRORS_BUFFER: BugCapturedError[] = [];
const MAX_BUFFER_SIZE = 10;
let listenersInstalled = false;

export function recordCapturedError(err: BugCapturedError): void {
  const cleanMsg = String(err.message || "").trim().slice(0, 400);
  if (!cleanMsg) return;
  RECENT_ERRORS_BUFFER.push({
    kind: err.kind,
    message: cleanMsg,
    source: err.source ? String(err.source).slice(0, 180) : undefined,
    occurredAt: err.occurredAt || new Date().toISOString(),
  });
  if (RECENT_ERRORS_BUFFER.length > MAX_BUFFER_SIZE) {
    RECENT_ERRORS_BUFFER.splice(0, RECENT_ERRORS_BUFFER.length - MAX_BUFFER_SIZE);
  }
}

export function getRecentCapturedErrors(): BugCapturedError[] {
  return [...RECENT_ERRORS_BUFFER];
}

export function clearCapturedErrors(): void {
  RECENT_ERRORS_BUFFER.length = 0;
}

export function installClientErrorCapture(): () => void {
  if (typeof window === "undefined" || listenersInstalled) {
    return () => undefined;
  }
  listenersInstalled = true;

  const onError = (event: ErrorEvent) => {
    recordCapturedError({
      kind: "runtime",
      message: event.message || "Error de ejecución en navegador",
      source: event.filename ? `${event.filename}:${event.lineno}` : undefined,
      occurredAt: new Date().toISOString(),
    });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Promesa rechazada sin capturar";
    recordCapturedError({
      kind: "promise",
      message,
      occurredAt: new Date().toISOString(),
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    listenersInstalled = false;
  };
}

export function detectBugEnvironment(): BugEnvironmentContext {
  if (typeof window === "undefined") {
    return { online: true, deviceType: "escritorio" };
  }
  const width = window.innerWidth || 1280;
  const height = window.innerHeight || 720;
  const standalonePwa =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)").matches
      : false;
  return {
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    deviceType: width < 768 ? "movil" : "escritorio",
    viewport: `${width}x${height}`,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : undefined,
    language: typeof navigator !== "undefined" ? navigator.language : "es-CO",
    standalonePwa,
  };
}

// ─── Cola offline en localStorage para reportes radicados sin señal ───
export interface QueuedOfflineBugReport {
  localId: string;
  queuedAt: string;
  payload: Record<string, unknown>;
  title: string;
  originModule: string;
  tags: string[];
}

export function getOfflineBugReports(): QueuedOfflineBugReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedOfflineBugReport[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineBugReport(item: QueuedOfflineBugReport): QueuedOfflineBugReport[] {
  const existing = getOfflineBugReports();
  const next = [item, ...existing].slice(0, 20);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota error
    }
  }
  return next;
}

export function removeOfflineBugReport(localId: string): QueuedOfflineBugReport[] {
  const next = getOfflineBugReports().filter((item) => item.localId !== localId);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
  }
  return next;
}
