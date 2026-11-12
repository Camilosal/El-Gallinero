"use client";

import { apiFetch, getApiCacheKey } from "@/lib/fetch";
import { guides } from "@/lib/guide-data";
import { navigationGroups } from "@/lib/navigation";
import { getStandardCurves, type CurveSpecies } from "@/lib/standard-curves";
import {
  getMetaValue,
  setCachedCatalog,
  setCachedRecords,
  setMetaValue,
} from "./db";
import { SYNC_COMPLETED_EVENT } from "./syncManager";

export const OFFLINE_MIRROR_EVENT = "gallinero-offline-mirror";
const MIRROR_META_KEY = "offline_mirror_v1";
const SW_CACHE_VERSION = "v5";
const DEFAULT_MIRROR_COOLDOWN_MS = 15 * 60 * 1000;
const ASSET_REGEX = /\/_next\/static\/[^\s"'<>\\`)]+/g;

const KNOWN_CATALOG_CATEGORIES = [
  "comprador",
  "tamano_huevo",
  "raza",
  "proveedor",
  "estado_gallina",
  "unidad_medida",
  "categoria_alimento",
  "tipo_alimento",
  "tipo_sanidad",
  "tipo_mantenimiento",
  "categoria_egreso",
  "categoria_ingreso",
  "presentacion_venta",
  "tipo_ave",
];

const STATIC_DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/almacen",
  "/dashboard/analisis",
  "/dashboard/analisis/kpis",
  "/dashboard/analisis/razas",
  "/dashboard/analisis/reportes",
  "/dashboard/animales",
  "/dashboard/configuracion",
  "/dashboard/configuracion/catalogos",
  "/dashboard/escanear",
  "/dashboard/finanzas",
  "/dashboard/finanzas/cuentas",
  "/dashboard/finanzas/egresos",
  "/dashboard/finanzas/finanzas",
  "/dashboard/finanzas/presupuestos",
  "/dashboard/finanzas/ventas",
  "/dashboard/guia",
  "/dashboard/inventarios",
  "/dashboard/inventarios/alimentacion",
  "/dashboard/inventarios/balance",
  "/dashboard/inventarios/carne",
  "/dashboard/inventarios/gallinaza",
  "/dashboard/inventarios/huevos",
  "/dashboard/inventarios/insumos",
  "/dashboard/operaciones",
  "/dashboard/operaciones/activos",
  "/dashboard/operaciones/gallinaza",
  "/dashboard/operaciones/mantenimiento",
  "/dashboard/planeacion",
  "/dashboard/produccion",
  "/dashboard/produccion/adquisiciones",
  "/dashboard/produccion/alimentacion",
  "/dashboard/produccion/gallinas",
  "/dashboard/produccion/huevos",
  "/dashboard/produccion/incubacion",
  "/dashboard/produccion/mortalidad",
  "/dashboard/produccion/peso",
  "/dashboard/produccion/plan-parvada",
  "/dashboard/produccion/pollos",
  "/dashboard/produccion/sacrificio",
  "/dashboard/sanidad",
  "/dashboard/sanidad/alertas",
  "/dashboard/sanidad/calendario",
  "/dashboard/sanidad/control",
  "/dashboard/soberania",
  "/dashboard/ubicaciones",
];

export interface OfflineMirrorMeta {
  lastSyncedAt: number | null;
  routesCached: number;
  endpointsCached: number;
  assetsCached: number;
  swCacheVersion?: string | null;
  lastError: string | null;
}

export interface OfflineMirrorState extends OfflineMirrorMeta {
  isMirroring: boolean;
  phase: "idle" | "routes" | "data" | "details" | "done" | "error";
  completed: number;
  total: number;
  currentLabel: string;
}

const initialState: OfflineMirrorState = {
  isMirroring: false,
  phase: "idle",
  completed: 0,
  total: 0,
  currentLabel: "",
  lastSyncedAt: null,
  routesCached: 0,
  endpointsCached: 0,
  assetsCached: 0,
  lastError: null,
};

let currentState: OfflineMirrorState = { ...initialState };
let activeMirrorPromise: Promise<OfflineMirrorState> | null = null;
let autoSyncRegistered = false;
const listeners = new Set<(state: OfflineMirrorState) => void>();

function emitState(patch: Partial<OfflineMirrorState>) {
  currentState = { ...currentState, ...patch };
  listeners.forEach((listener) => listener(currentState));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_MIRROR_EVENT, { detail: currentState }));
  }
}

export function getOfflineMirrorState(): OfflineMirrorState {
  return currentState;
}

export function subscribeOfflineMirror(listener: (state: OfflineMirrorState) => void): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadSavedOfflineMirrorMeta(): Promise<OfflineMirrorMeta | null> {
  try {
    const saved = await getMetaValue<OfflineMirrorMeta>(MIRROR_META_KEY);
    if (saved) {
      emitState({
        lastSyncedAt: saved.lastSyncedAt ?? null,
        routesCached: saved.routesCached ?? 0,
        endpointsCached: saved.endpointsCached ?? 0,
        assetsCached: saved.assetsCached ?? 0,
        lastError: saved.lastError ?? null,
      });
    }
    return saved;
  } catch {
    return null;
  }
}

export function buildStaticDashboardRoutes(): string[] {
  const routes = new Set<string>(STATIC_DASHBOARD_ROUTES);

  for (const group of navigationGroups) {
    if (group.indexHref) routes.add(group.indexHref.split("?")[0]);
    for (const item of group.items) {
      if (item.href) routes.add(item.href.split("?")[0]);
    }
  }
  for (const guide of guides) {
    if (guide.slug) routes.add(`/dashboard/guia/${guide.slug}`);
  }

  return Array.from(routes);
}

export function buildCoreApiEndpoints(now = new Date()): string[] {
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const endpoints = new Set<string>([
    "/api/auth/me",
    "/api/dashboard",
    "/api/dashboard/tareas-pendientes",
    "/api/ubicaciones",
    "/api/ubicaciones?active=true",
    "/api/configuracion/catalogos",
    "/api/configuracion/parametros",
    "/api/configuracion/vacunas",
    "/api/configuracion/estandares-peso",
    "/api/configuracion/factores-gallinaza",
    "/api/configuracion/programas-alimentacion",
    "/api/especies/params",
    "/api/produccion/resumen",
    "/api/produccion/alertas",
    "/api/produccion/gallinas",
    "/api/produccion/gallos",
    "/api/produccion/pollos",
    "/api/produccion/huevos",
    "/api/produccion/huevos/inventario",
    "/api/produccion/alimentacion",
    "/api/produccion/alimentacion/movimientos",
    "/api/produccion/alimentacion/comparativo?days=7",
    "/api/produccion/alimentacion/comparativo?days=14",
    "/api/produccion/alimentacion/comparativo?days=30",
    "/api/produccion/adquisiciones",
    "/api/produccion/etapas",
    "/api/produccion/etapas/resumen",
    "/api/produccion/incubacion",
    "/api/produccion/mortalidad?period=30",
    "/api/perdidas-huevos?period=30",
    "/api/produccion/peso?breed=ISA%20Brown",
    "/api/produccion/plan-parvada",
    "/api/produccion/sacrificio",
    "/api/inventarios/resumen",
    "/api/inventarios/animales",
    "/api/inventarios/carne",
    "/api/inventarios/gallinaza",
    "/api/inventarios/huevos/consolidado?days=30",
    "/api/inventarios/insumos",
    "/api/inventarios/insumos/movimientos",
    "/api/operaciones/resumen",
    "/api/operaciones/activos",
    "/api/operaciones/activos?active=true",
    "/api/operaciones/gallinaza",
    "/api/operaciones/mantenimiento",
    "/api/purchase-products",
    "/api/sanidad/resumen",
    "/api/sanidad/plan?days=30",
    "/api/sanidad/control",
    "/api/sanidad/calendario",
    "/api/calendario-sanitario",
    "/api/calendario-sanitario/alertas",
    "/api/finanzas/resumen",
    "/api/finanzas/finanzas?period=30",
    "/api/finanzas/finanzas/ventas",
    "/api/finanzas/finanzas/ventas-aves",
    "/api/presupuestos",
    "/api/cuentas-cobrar",
    "/api/cuentas-pagar",
    "/api/pagos",
    "/api/soberania",
    "/api/analisis/resumen",
    "/api/analisis/kpis?period=30",
    "/api/analisis/pesos",
    `/api/analisis/reportes/estado-resultados?from=${yearStart}&to=${today}`,
    `/api/analisis/reportes/rentabilidad?from=${yearStart}&to=${today}`,
  ]);

  const curveSpecies: CurveSpecies[] = ["gallina", "pollo", "codorniz", "pato", "conejo"];
  for (const species of curveSpecies) {
    const firstCurve = getStandardCurves(species)[0];
    if (firstCurve) {
      const params = new URLSearchParams({ species, breed: firstCurve.breed });
      endpoints.add(`/api/analisis/curvas?${params.toString()}`);
    }
  }

  return Array.from(endpoints);
}

export function extractNextStaticAssets(rawBody: string): string[] {
  const matches = rawBody.match(ASSET_REGEX) || [];
  const assets = new Set<string>();
  for (const match of matches) {
    const clean = match.replace(/[\\'"`)\],;]+$/g, "");
    if (clean.startsWith("/_next/static/")) {
      assets.add(clean);
    }
  }
  return Array.from(assets);
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function isLoginRedirectResponse(requestPath: string, res: Response): boolean {
  if (!res.url) return false;
  try {
    const finalPath = new URL(res.url).pathname;
    return !requestPath.startsWith("/login") && finalPath.startsWith("/login");
  } catch {
    return false;
  }
}

async function warmRouteHtmlAndRsc(
  route: string,
  discoveredAssets: Set<string>
): Promise<{ ok: boolean; unauthorized: boolean }> {
  const rscUrl = route.includes("?") ? `${route}&_rsc` : `${route}?_rsc`;

  try {
    const [htmlRes, rscRes] = await Promise.all([
      fetch(route, { credentials: "include", headers: { Accept: "text/html" } }),
      fetch(rscUrl, { credentials: "include", headers: { RSC: "1" } }),
    ]);

    if (isLoginRedirectResponse(route, htmlRes) || isLoginRedirectResponse(route, rscRes)) {
      return { ok: false, unauthorized: true };
    }

    if (htmlRes.ok) {
      const htmlText = await htmlRes.text();
      for (const asset of extractNextStaticAssets(htmlText)) {
        discoveredAssets.add(asset);
      }
    }

    if (rscRes.ok) {
      const rscText = await rscRes.text();
      for (const asset of extractNextStaticAssets(rscText)) {
        discoveredAssets.add(asset);
      }
    }

    return { ok: htmlRes.ok || rscRes.ok, unauthorized: false };
  } catch {
    return { ok: false, unauthorized: false };
  }
}

async function hydrateCatalogStores(rawCatalogs: unknown): Promise<void> {
  if (!Array.isArray(rawCatalogs)) return;
  const grouped = new Map<string, any[]>();
  for (const cat of KNOWN_CATALOG_CATEGORIES) {
    grouped.set(cat, []);
  }

  for (const row of rawCatalogs) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, any>;
    if (item.isActive === false) continue;
    const category = typeof item.category === "string" ? item.category : "";
    if (!category) continue;
    const list = grouped.get(category) || [];
    list.push(item);
    grouped.set(category, list);
  }

  for (const [category, items] of grouped.entries()) {
    await Promise.all([
      setCachedCatalog(`catalog_${category}`, items),
      setCachedRecords(getApiCacheKey(`/api/configuracion/catalogos?category=${encodeURIComponent(category)}`), items),
    ]);
  }
}

async function fetchJsonEndpoint(endpoint: string): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await apiFetch(endpoint, {
      headers: { "X-Offline-Mirror": "1" },
    });
    if (!res.ok) return { ok: false, data: null };
    const data = await res.json().catch(() => null);
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  }
}

async function waitForServiceWorkerReady(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch {
    // Continuar aunque el Service Worker no esté disponible (p.ej. contexto de pruebas)
  }
}

/**
 * Descarga y replica localmente todas las rutas, chunks JS/CSS y datos de la granja
 * para que la app sea completamente navegable y operativa en modo sin conexión.
 */
export async function syncFullOfflineCopy(options?: { force?: boolean }): Promise<OfflineMirrorState> {
  if (typeof window === "undefined") return currentState;
  if (activeMirrorPromise) return activeMirrorPromise;
  if (navigator.onLine === false) {
    emitState({ lastError: "Sin conexión a Internet para actualizar la copia offline" });
    return currentState;
  }

  if (!options?.force) {
    const saved = await loadSavedOfflineMirrorMeta();
    const versionMatches = saved?.swCacheVersion === SW_CACHE_VERSION;
    if (
      saved?.lastSyncedAt &&
      versionMatches &&
      Date.now() - saved.lastSyncedAt < DEFAULT_MIRROR_COOLDOWN_MS
    ) {
      return currentState;
    }
  }

  activeMirrorPromise = (async () => {
    await waitForServiceWorkerReady();
    const routes = buildStaticDashboardRoutes();
    const endpoints = buildCoreApiEndpoints();
    const discoveredAssets = new Set<string>();
    let routesCached = 0;
    let endpointsCached = 0;
    let assetsCached = 0;
    let unauthorized = false;

    try {
      const baseTotal = routes.length + endpoints.length;
      let completed = 0;

      emitState({
        isMirroring: true,
        phase: "routes",
        completed: 0,
        total: baseTotal,
        currentLabel: "Descargando pantallas y recursos de la app...",
        lastError: null,
      });

      await runWithConcurrency(routes, 4, async (route) => {
        if (unauthorized) return;
        const result = await warmRouteHtmlAndRsc(route, discoveredAssets);
        if (result.unauthorized) {
          unauthorized = true;
          return;
        }
        if (result.ok) routesCached++;
        completed++;
        emitState({
          completed,
          total: baseTotal + discoveredAssets.size,
          currentLabel: `Pantalla: ${route.replace("/dashboard", "") || "/inicio"}`,
        });
      });

      if (unauthorized) {
        throw new Error("Inicia sesión primero para guardar una copia offline completa");
      }

      const assetList = Array.from(discoveredAssets);
      await runWithConcurrency(assetList, 6, async (assetUrl) => {
        try {
          const res = await fetch(assetUrl, { credentials: "include" });
          if (res.ok) assetsCached++;
        } catch {
          // Ignorar asset fallido puntual
        } finally {
          completed++;
          emitState({ completed, total: baseTotal + assetList.length });
        }
      });

      emitState({
        phase: "data",
        currentLabel: "Sincronizando datos operativos de la granja...",
      });

      let rawLocationsAll: unknown = null;
      let rawLocationsActive: unknown = null;
      let rawHens: unknown = null;
      let rawCatalogs: unknown = null;
      let rawFeeds: unknown = null;
      let rawFeedMovements: unknown = null;

      await runWithConcurrency(endpoints, 4, async (endpoint) => {
        const result = await fetchJsonEndpoint(endpoint);
        if (result.ok) {
          endpointsCached++;
          if (endpoint === "/api/ubicaciones") rawLocationsAll = result.data;
          else if (endpoint === "/api/ubicaciones?active=true") rawLocationsActive = result.data;
          else if (endpoint === "/api/produccion/gallinas") rawHens = result.data;
          else if (endpoint === "/api/configuracion/catalogos") rawCatalogs = result.data;
          else if (endpoint === "/api/produccion/alimentacion") rawFeeds = result.data;
          else if (endpoint === "/api/produccion/alimentacion/movimientos") rawFeedMovements = result.data;
        }
        completed++;
        emitState({
          completed,
          total: baseTotal + assetList.length,
          currentLabel: `Datos: ${endpoint.replace("/api/", "")}`,
        });
      });

      // Hidratar stores de catálogos e inventario de alimento usados por hooks offline
      if (rawCatalogs) {
        await hydrateCatalogStores(rawCatalogs);
      }
      if (Array.isArray(rawLocationsAll)) {
        await setCachedCatalog("farm_locations_all", rawLocationsAll);
      }
      if (Array.isArray(rawLocationsActive)) {
        await setCachedCatalog("farm_locations_active", rawLocationsActive);
      }
      if (Array.isArray(rawFeeds)) {
        await setCachedCatalog("feed_inventory", rawFeeds);
      }
      if (Array.isArray(rawFeedMovements)) {
        await setCachedRecords("feed_movements", rawFeedMovements);
      }

      // Detalles dinámicos (ubicaciones individuales y gallinas activas recientes)
      const detailUrls: string[] = [];
      const detailRoutes: string[] = [];

      if (Array.isArray(rawLocationsAll)) {
        for (const loc of rawLocationsAll) {
          if (loc && typeof loc === "object" && "id" in loc && typeof loc.id === "string") {
            detailRoutes.push(`/dashboard/ubicaciones/${loc.id}`);
            detailUrls.push(`/api/ubicaciones/movimientos?locationId=${encodeURIComponent(loc.id)}`);
          }
        }
      }

      if (Array.isArray(rawHens)) {
        const presentHens = rawHens.filter(
          (h: any) => h && typeof h.id === "string" && !["muerta", "vendida", "sacrificada"].includes(h.status)
        );
        const targetHens = (presentHens.length > 0 ? presentHens : rawHens).slice(0, 120);
        for (const hen of targetHens) {
          if (hen && typeof hen.id === "string") {
            if (detailRoutes.length < 60) {
              detailRoutes.push(`/dashboard/produccion/gallinas/${hen.id}`);
            }
            detailUrls.push(`/api/produccion/gallinas/historial?henId=${encodeURIComponent(hen.id)}`);
          }
        }
      }

      const detailTotal = detailRoutes.length + detailUrls.length;
      if (detailTotal > 0) {
        emitState({
          phase: "details",
          total: baseTotal + assetList.length + detailTotal,
          currentLabel: "Guardando fichas de ubicaciones y aves...",
        });

        await runWithConcurrency(detailRoutes, 4, async (route) => {
          const r = await warmRouteHtmlAndRsc(route, discoveredAssets);
          if (r.ok) routesCached++;
          completed++;
          emitState({ completed });
        });

        await runWithConcurrency(detailUrls, 4, async (endpoint) => {
          const r = await fetchJsonEndpoint(endpoint);
          if (r.ok) endpointsCached++;
          completed++;
          emitState({ completed });
        });
      }

      const meta: OfflineMirrorMeta = {
        lastSyncedAt: Date.now(),
        routesCached,
        endpointsCached,
        assetsCached,
        swCacheVersion: SW_CACHE_VERSION,
        lastError: null,
      };
      await setMetaValue(MIRROR_META_KEY, meta);

      emitState({
        ...meta,
        isMirroring: false,
        phase: "done",
        completed: currentState.total,
        currentLabel: "Copia offline lista",
      });
      return currentState;
    } catch (err: any) {
      const msg = err?.message || "No se pudo completar la copia offline";
      emitState({
        isMirroring: false,
        phase: "error",
        lastError: msg,
        currentLabel: msg,
      });
      return currentState;
    } finally {
      activeMirrorPromise = null;
    }
  })();

  return activeMirrorPromise;
}

/**
 * Inicializa la réplica automática en segundo plano (con cooldown) y la refresca
 * cuando terminan de sincronizarse registros pendientes de la cola local.
 */
export function initOfflineMirrorAutoSync(): () => void {
  if (typeof window === "undefined") return () => {};

  const hadController = typeof navigator !== "undefined" && "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);

  void loadSavedOfflineMirrorMeta().then(() => {
    if (navigator.onLine !== false) {
      void syncFullOfflineCopy({ force: false });
    }
  });

  if (autoSyncRegistered) return () => {};
  autoSyncRegistered = true;

  const onOnline = () => {
    void syncFullOfflineCopy({ force: false });
  };
  const onSyncCompleted = () => {
    void syncFullOfflineCopy({ force: true });
  };
  const onControllerChange = () => {
    if (hadController && navigator.onLine !== false) {
      void syncFullOfflineCopy({ force: true });
    }
  };

  window.addEventListener("online", onOnline);
  window.addEventListener(SYNC_COMPLETED_EVENT, onSyncCompleted);
  navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

  return () => {
    autoSyncRegistered = false;
    window.removeEventListener("online", onOnline);
    window.removeEventListener(SYNC_COMPLETED_EVENT, onSyncCompleted);
    navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
  };
}
