import { getCachedRecords, setCachedRecords } from "./offline/db";
import { syncManager } from "./offline/syncManager";
import { readCachedActiveFarmMeta } from "./active-farm-client";

const NON_CACHEABLE_GET_PREFIXES = ["/api/health", "/api/auth/login", "/api/auth/logout", "/api/auth/register", "/api/asistente/cuota", "/api/billing/", "/api/superadmin/"];
const NON_QUEUEABLE_MUTATION_PREFIXES = [
  "/api/auth/",
  "/api/asistente",
  "/api/sync/",
  "/api/produccion/alimentacion/prediccion",
  "/api/configuracion/fuentes-externas/importar",
];

const METHOD_LABELS: Record<string, string> = {
  POST: "Crear",
  PUT: "Actualizar",
  DELETE: "Eliminar",
};

export function getApiCacheKey(pathnameWithSearch: string, farmId?: string | null): string {
  const effectiveFarmId =
    farmId !== undefined ? farmId : readCachedActiveFarmMeta()?.id ?? null;
  const trimmed = typeof effectiveFarmId === "string" ? effectiveFarmId.trim() : "";
  return trimmed ? `api:${trimmed}:${pathnameWithSearch}` : `api:${pathnameWithSearch}`;
}

export function shouldCacheApiGet(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  return !NON_CACHEABLE_GET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function shouldQueueApiMutation(pathname: string, method: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (method !== "POST" && method !== "PUT" && method !== "DELETE") return false;
  return !NON_QUEUEABLE_MUTATION_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function describeOfflineMutation(method: string, pathname: string): string {
  const action = METHOD_LABELS[method] || method;
  const cleanSection = pathname.replace(/^\/api\//, "").replace(/\//g, " · ");
  return `${action} (${cleanSection})`;
}

function buildJsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function parseJsonBody(body: BodyInit | null | undefined): { valid: boolean; data: Record<string, any> } {
  if (body === undefined || body === null) return { valid: true, data: {} };
  if (typeof body !== "string") return { valid: false, data: {} };
  if (body.trim() === "") return { valid: true, data: {} };
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { valid: true, data: parsed as Record<string, any> };
    }
    return { valid: false, data: {} };
  } catch {
    return { valid: false, data: {} };
  }
}

class SessionExpiredError extends Error {
  constructor() {
    super("Sesión expirada");
    this.name = "SessionExpiredError";
  }
}

export async function apiFetch(url: string, options?: RequestInit, cookies?: string) {
  const headers = new Headers(options?.headers);

  // If cookies are provided (server-side), add them to the request
  if (cookies) {
    headers.set("Cookie", cookies);
  }

  const isBrowser = typeof window !== "undefined" && !cookies;
  const method = (options?.method || "GET").toUpperCase();
  const parsedUrl = isBrowser ? new URL(url, window.location.origin) : null;
  const isSameOriginApi = Boolean(parsedUrl && parsedUrl.origin === window.location.origin);
  const endpoint = parsedUrl ? `${parsedUrl.pathname}${parsedUrl.search}` : url;
  const activeFarmId = isBrowser ? readCachedActiveFarmMeta()?.id ?? null : null;
  let clientMutationId = headers.get("X-Client-Mutation-Id")?.trim() || undefined;
  if (
    isSameOriginApi &&
    (method === "POST" || method === "PUT" || method === "DELETE") &&
    !clientMutationId
  ) {
    clientMutationId = crypto.randomUUID();
    headers.set("X-Client-Mutation-Id", clientMutationId);
  }
  const cacheableGet = Boolean(isSameOriginApi && method === "GET" && parsedUrl && shouldCacheApiGet(parsedUrl.pathname));
  const cacheKey = getApiCacheKey(endpoint, activeFarmId);

  // En modo offline para GET: responder inmediatamente desde IndexedDB si existe copia local
  if (cacheableGet && isBrowser && navigator.onLine === false) {
    const cached = await getCachedRecords(cacheKey).catch(() => null);
    if (cached !== null) {
      return buildJsonResponse(cached, 200, { "X-Gallinero-Offline-Cache": "1" });
    }
  }

  // En modo offline para mutaciones generales (POST/PUT/DELETE): encolar en Outbox
  const queueableMutation = Boolean(
    isSameOriginApi && parsedUrl && shouldQueueApiMutation(parsedUrl.pathname, method) && !headers.has("X-Skip-Offline-Queue")
  );
  const enqueueOfflineAndRespond = async (): Promise<Response | null> => {
    if (!queueableMutation || !parsedUrl) return null;
    const parsedBody = parseJsonBody(options?.body);
    if (!parsedBody.valid) return null;
    const stored = await syncManager.enqueueOfflineMutation({
      id: clientMutationId,
      farmId: activeFarmId,
      endpoint,
      method: method as "POST" | "PUT" | "DELETE",
      entity: "general",
      description: describeOfflineMutation(method, parsedUrl.pathname),
      payload: parsedBody.data,
    });
    return buildJsonResponse(
      { ...parsedBody.data, ok: true, offline: true, queued: true, mutationId: stored.id, id: stored.id },
      202,
      { "X-Gallinero-Offline-Queued": "1" }
    );
  };

  if (queueableMutation && isBrowser && navigator.onLine === false) {
    const queuedRes = await enqueueOfflineAndRespond();
    if (queuedRes) return queuedRes;
  }

  try {
    const res = await fetch(url, {
      ...options,
      cache: "no-store",
      credentials: cookies ? "omit" : "include", // Use omit when manually providing cookies
      headers,
    });

    if (res.status === 401) {
      if (typeof window !== "undefined") {
        window.location.assign(new URL("/login", window.location.origin).toString());
      }
      throw new SessionExpiredError();
    }

    // Persistir respuesta JSON exitosa de consultas GET para disponibilidad offline
    if (cacheableGet && res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          const clonedData = await res.clone().json();
          await setCachedRecords(cacheKey, clonedData);
        } catch {
          // Ignorar errores al parsear o persistir caché
        }
      }
      return res;
    }

    // Si el servidor o proxy respondió 5xx de disponibilidad, servir caché local o encolar mutación
    if (res.status >= 502) {
      if (cacheableGet) {
        const cached = await getCachedRecords(cacheKey).catch(() => null);
        if (cached !== null) {
          return buildJsonResponse(cached, 200, { "X-Gallinero-Offline-Cache": "1" });
        }
      }
      const queuedRes = await enqueueOfflineAndRespond();
      if (queuedRes) return queuedRes;
    }

    return res;
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      throw err;
    }

    // Fallback offline para GET cuando la red falla en caliente
    if (cacheableGet) {
      const cached = await getCachedRecords(cacheKey).catch(() => null);
      if (cached !== null) {
        return buildJsonResponse(cached, 200, { "X-Gallinero-Offline-Cache": "1" });
      }
    }

    // Fallback offline para mutaciones cuando la red falla en caliente
    const queuedRes = await enqueueOfflineAndRespond();
    if (queuedRes) return queuedRes;

    throw err;
  }
}

// Server-side version that accepts cookies from the request
export async function apiFetchServer(url: string, cookieHeader: string | null, options?: RequestInit) {
  return apiFetch(url, options, cookieHeader || undefined);
}
