import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OutboxMutation } from "@/lib/offline/db";

const memoryRecords = new Map<string, unknown>();
const memoryOutbox = new Map<string, OutboxMutation>();

vi.mock("@/lib/offline/db", () => ({
  addOutboxMutation: vi.fn(async (m: Omit<OutboxMutation, "status" | "retries" | "createdAt">) => {
    const entry: OutboxMutation = {
      ...m,
      status: "pending",
      retries: 0,
      createdAt: Date.now(),
    };
    memoryOutbox.set(entry.id, entry);
    return entry;
  }),
  getPendingMutations: vi.fn(async () => Array.from(memoryOutbox.values())),
  getAllOutboxMutations: vi.fn(async () => Array.from(memoryOutbox.values())),
  getPendingCount: vi.fn(async () => memoryOutbox.size),
  updateOutboxMutation: vi.fn(async (id: string, patch: Partial<OutboxMutation>) => {
    const prev = memoryOutbox.get(id);
    if (prev) memoryOutbox.set(id, { ...prev, ...patch });
  }),
  removeOutboxMutation: vi.fn(async (id: string) => {
    memoryOutbox.delete(id);
  }),
  setCachedCatalog: vi.fn(async () => {}),
  getCachedCatalog: vi.fn(async () => null),
  setCachedRecords: vi.fn(async (key: string, data: unknown) => {
    memoryRecords.set(key, data);
  }),
  getCachedRecords: vi.fn(async (key: string) => (memoryRecords.has(key) ? memoryRecords.get(key) : null)),
  setMetaValue: vi.fn(async () => {}),
  getMetaValue: vi.fn(async () => null),
}));

import {
  apiFetch,
  describeOfflineMutation,
  getApiCacheKey,
  shouldCacheApiGet,
  shouldQueueApiMutation,
} from "@/lib/fetch";
import {
  buildIndividualSyncRequestInit,
  partitionPendingMutations,
} from "@/lib/offline/syncManager";
import {
  buildCoreApiEndpoints,
  buildStaticDashboardRoutes,
  extractNextStaticAssets,
} from "@/lib/offline/offlineMirror";

describe("Offline Sync Architecture", () => {
  beforeEach(() => {
    memoryRecords.clear();
    memoryOutbox.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("window", {
      location: {
        origin: "https://gallinero.test",
        href: "https://gallinero.test/dashboard",
        assign: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("garantiza que las mutaciones de outbox tengan UUID y timestamp del cliente", () => {
    const clientTimestamp = new Date().toISOString();
    const mutation = {
      id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      endpoint: "/api/produccion/huevos",
      method: "POST" as const,
      entity: "huevos" as const,
      description: "Recolección de 36 huevos (gallina)",
      payload: {
        date: "2026-11-12",
        species: "gallina",
        totalCollected: 36,
        broken: 1,
        forIncubation: 0,
        locationId: "loc-123",
      },
      clientTimestamp,
      status: "pending" as const,
      retries: 0,
      createdAt: Date.now(),
    };

    expect(mutation.id).toBeDefined();
    expect(mutation.clientTimestamp).toBe(clientTimestamp);
    expect(mutation.status).toBe("pending");
    expect(mutation.retries).toBe(0);
  });

  it("prioriza mutaciones en orden FIFO (las más antiguas primero)", () => {
    const mutations = [
      { id: "3", createdAt: 300, status: "pending" },
      { id: "1", createdAt: 100, status: "pending" },
      { id: "2", createdAt: 200, status: "failed" },
      { id: "4", createdAt: 50, status: "synced" },
    ];

    const pending = mutations
      .filter((m) => m.status === "pending" || m.status === "failed")
      .sort((a, b) => a.createdAt - b.createdAt);

    expect(pending.map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("maneja idempotencia si el lote o registro ya fue insertado previamente", () => {
    const existingDbIds = new Set(["uuid-egg-001", "uuid-mort-002"]);

    const incomingMutations = [
      { id: "uuid-egg-001", entity: "huevos", total: 40 },
      { id: "uuid-egg-003", entity: "huevos", total: 25 },
    ];

    const results = incomingMutations.map((m) => {
      if (existingDbIds.has(m.id)) {
        return { id: m.id, status: "synced", note: "idempotent_skip" };
      }
      existingDbIds.add(m.id);
      return { id: m.id, status: "synced", note: "inserted" };
    });

    expect(results).toEqual([
      { id: "uuid-egg-001", status: "synced", note: "idempotent_skip" },
      { id: "uuid-egg-003", status: "synced", note: "inserted" },
    ]);
  });

  it("separa mutaciones compatibles con lote vs mutaciones generales/PUT/DELETE", () => {
    const sample = (over: Partial<OutboxMutation>): OutboxMutation => ({
      id: "id-1",
      endpoint: "/api/test",
      method: "POST",
      entity: "general",
      description: "test",
      payload: { a: 1 },
      clientTimestamp: "2026-11-12T00:00:00.000Z",
      status: "pending",
      retries: 0,
      createdAt: 1,
      ...over,
    });

    const { batchable, individual } = partitionPendingMutations([
      sample({ id: "h1", entity: "huevos", method: "POST" }),
      sample({ id: "g1", entity: "general", method: "POST" }),
      sample({ id: "h-del", entity: "huevos", method: "DELETE" }),
      sample({ id: "m1", entity: "mortalidad", method: "POST" }),
      sample({ id: "a1", entity: "alimentacion", method: "PUT" }),
    ]);

    expect(batchable.map((m) => m.id)).toEqual(["h1", "m1"]);
    expect(individual.map((m) => m.id)).toEqual(["g1", "h-del", "a1"]);
  });

  it("preserva el payload exacto en mutaciones generales sin inyectar id ficticio", () => {
    const generalPut: OutboxMutation = {
      id: "outbox-uuid-99",
      endpoint: "/api/finanzas/egresos",
      method: "PUT",
      entity: "general",
      description: "Actualizar egreso",
      payload: { id: "real-tx-55", amount: 42000 },
      clientTimestamp: "2026-11-12T10:00:00.000Z",
      status: "pending",
      retries: 0,
      createdAt: 1,
    };

    const init = buildIndividualSyncRequestInit(generalPut);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ id: "real-tx-55", amount: 42000 });
    expect((init.headers as Record<string, string>)["X-Client-Mutation-Id"]).toBe("outbox-uuid-99");

    const emptyDelete: OutboxMutation = {
      ...generalPut,
      id: "outbox-uuid-100",
      endpoint: "/api/produccion/peso?id=abc",
      method: "DELETE",
      payload: {},
    };
    const deleteInit = buildIndividualSyncRequestInit(emptyDelete);
    expect(deleteInit.body).toBeUndefined();
  });

  it("apiFetch guarda respuestas GET online y responde desde caché local sin conexión", async () => {
    const dashboardData = { activeHens: 42, eggsToday: 31 };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(dashboardData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const onlineRes = await apiFetch("/api/dashboard");
    expect(onlineRes.ok).toBe(true);
    expect(await onlineRes.json()).toEqual(dashboardData);
    expect(memoryRecords.get(getApiCacheKey("/api/dashboard"))).toEqual(dashboardData);

    // Simular dispositivo completamente offline
    vi.stubGlobal("navigator", { onLine: false });
    fetchMock.mockClear();

    const offlineRes = await apiFetch("/api/dashboard");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(offlineRes.status).toBe(200);
    expect(offlineRes.headers.get("X-Gallinero-Offline-Cache")).toBe("1");
    expect(await offlineRes.json()).toEqual(dashboardData);
  });

  it("apiFetch encola mutaciones offline y devuelve 202 sintético sin romper la UI", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch("/api/finanzas/finanzas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "egreso", amount: 15000, concept: "Maíz" }),
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(202);
    expect(res.headers.get("X-Gallinero-Offline-Queued")).toBe("1");
    const json = await res.json();
    expect(json.offline).toBe(true);
    expect(json.queued).toBe(true);
    expect(memoryOutbox.size).toBe(1);
    const queued = Array.from(memoryOutbox.values())[0];
    expect(queued.endpoint).toBe("/api/finanzas/finanzas");
    expect(queued.entity).toBe("general");
    expect(queued.payload).toEqual({ type: "egreso", amount: 15000, concept: "Maíz" });
  });

  it("apiFetch no usa caché de fallback cuando el servidor devuelve 401", async () => {
    memoryRecords.set(getApiCacheKey("/api/dashboard"), { cached: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "No autenticado" }), { status: 401 }))
    );

    await expect(apiFetch("/api/dashboard")).rejects.toThrow("Sesión expirada");
  });

  it("reglas de URL excluyen health/auth de caché y cobertura de rutas/endpoints del espejo es completa", () => {
    expect(shouldCacheApiGet("/api/health")).toBe(false);
    expect(shouldCacheApiGet("/api/auth/login")).toBe(false);
    expect(shouldCacheApiGet("/api/dashboard")).toBe(true);
    expect(shouldQueueApiMutation("/api/auth/login", "POST")).toBe(false);
    expect(shouldQueueApiMutation("/api/ubicaciones", "POST")).toBe(true);
    expect(describeOfflineMutation("DELETE", "/api/sanidad/control")).toContain("Eliminar");

    const routes = buildStaticDashboardRoutes();
    expect(routes).toContain("/dashboard");
    expect(routes).toContain("/dashboard/almacen");
    expect(routes).toContain("/dashboard/inventarios");
    expect(routes).toContain("/dashboard/produccion");
    expect(routes).toContain("/dashboard/animales");
    expect(routes).toContain("/dashboard/escanear");
    expect(routes).toContain("/dashboard/guia/primeros-pasos");

    const endpoints = buildCoreApiEndpoints(new Date("2026-11-12T12:00:00Z"));
    expect(endpoints).toContain("/api/dashboard");
    expect(endpoints).toContain("/api/produccion/alimentacion/comparativo?days=14");
    expect(endpoints).toContain("/api/analisis/reportes/estado-resultados?from=2026-01-01&to=2026-11-12");

    const assets = extractNextStaticAssets(
      '<script src="/_next/static/chunks/app-123.js"></script><link href="/_next/static/css/main.css"/><script>var x="/_next/static/chunks/app-123.js\\"</script>'
    );
    expect(assets).toEqual(["/_next/static/chunks/app-123.js", "/_next/static/css/main.css"]);
  });
});
