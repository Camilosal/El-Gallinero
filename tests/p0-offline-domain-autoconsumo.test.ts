import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { OutboxMutation } from "@/lib/offline/db";

const mockOutbox = new Map<string, OutboxMutation>();
const mockRecords = new Map<string, unknown>();

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return {
    ...actual,
    addOutboxMutation: vi.fn(
      async (
        item: Omit<OutboxMutation, "status" | "retries" | "createdAt"> & {
          status?: OutboxMutation["status"];
        },
      ) => {
        const resolvedFarmId =
          item.farmId !== undefined ? item.farmId : actual.resolveEffectiveOfflineFarmId();
        const entry: OutboxMutation = {
          ...item,
          farmId: resolvedFarmId,
          userId: item.userId ?? null,
          status: item.status || "pending",
          retries: 0,
          createdAt: Date.now(),
        };
        mockOutbox.set(entry.id, entry);
        return entry;
      },
    ),
    getPendingMutations: vi.fn(async (farmId?: string | null) => {
      const effectiveFarmId = actual.resolveEffectiveOfflineFarmId(farmId);
      return Array.from(mockOutbox.values())
        .filter(
          (m) =>
            (m.status === "pending" || m.status === "failed") &&
            actual.mutationMatchesFarm({ farmId: m.farmId ?? null }, effectiveFarmId),
        )
        .sort((a, b) => a.createdAt - b.createdAt);
    }),
    getAllOutboxMutations: vi.fn(async (farmId?: string | null) => {
      const effectiveFarmId = actual.resolveEffectiveOfflineFarmId(farmId);
      return Array.from(mockOutbox.values())
        .filter((m) => actual.mutationMatchesFarm({ farmId: m.farmId ?? null }, effectiveFarmId))
        .sort((a, b) => b.createdAt - a.createdAt);
    }),
    getPendingCount: vi.fn(async (farmId?: string | null) => {
      const effectiveFarmId = actual.resolveEffectiveOfflineFarmId(farmId);
      return Array.from(mockOutbox.values()).filter(
        (m) =>
          (m.status === "pending" || m.status === "failed") &&
          actual.mutationMatchesFarm({ farmId: m.farmId ?? null }, effectiveFarmId),
      ).length;
    }),
    updateOutboxMutation: vi.fn(async (id: string, patch: Partial<OutboxMutation>) => {
      const prev = mockOutbox.get(id);
      if (prev) mockOutbox.set(id, { ...prev, ...patch });
    }),
    removeOutboxMutation: vi.fn(async (id: string) => {
      mockOutbox.delete(id);
    }),
    setCachedRecords: vi.fn(async (key: string, data: unknown, farmId?: string | null) => {
      mockRecords.set(actual.resolveScopedOfflineKey(key, farmId), data);
    }),
    getCachedRecords: vi.fn(async (key: string, farmId?: string | null) => {
      const scoped = actual.resolveScopedOfflineKey(key, farmId);
      return mockRecords.has(scoped) ? mockRecords.get(scoped) : null;
    }),
    getAllCachedRecordKeys: vi.fn(async (farmId?: string | null) => {
      const effectiveFarmId = actual.resolveEffectiveOfflineFarmId(farmId);
      const keys = Array.from(mockRecords.keys());
      if (!effectiveFarmId) return keys.filter((k) => !k.startsWith("farm:"));
      return keys.filter(
        (k) => k.startsWith(`api:${effectiveFarmId}:`) || k.startsWith(`farm:${effectiveFarmId}:`),
      );
    }),
  };
});

import {
  addOutboxMutation,
  getAllOutboxMutations,
  getCachedRecords,
  mutationMatchesFarm,
  resolveScopedOfflineKey,
  setCachedRecords,
} from "@/lib/offline/db";
import { apiFetch, getApiCacheKey } from "@/lib/fetch";
import { classifySyncHttpResponse, syncManager } from "@/lib/offline/syncManager";
import { extractPathnameFromApiCacheKey } from "@/lib/offline/optimisticCache";
import {
  resolveNudgeFeedbackStorageKey,
  recordNudgeFeedback,
  getNudgeFeedbackMap,
} from "@/lib/behavioral-nudges";
import { resolveTelemetryQueueKey } from "@/lib/offline/telemetry";
import { writeCachedActiveFarmMeta, clearCachedActiveFarmMeta } from "@/lib/active-farm-client";
import { isQueuedOfflineOnboardingResponse } from "@/components/OnboardingWizardModal";
import {
  cleanup,
  createCleanup,
  createTestFarmLocation,
  createTestFeed,
  db,
  mockRequest,
  parseJson,
  type TestCleanup,
} from "./helpers";
import {
  autoconsumoLogs,
  broilerBatches,
  eggProduction,
  slaughter,
  feedInventory,
  feedMovements,
  hens,
  offlineMutationReceipts,
} from "@/db/schema";
import { todayColombiaIso } from "@/lib/date-validation";
import { POST as huevosPOST, PUT as huevosPUT } from "@/app/api/produccion/huevos/route";
import { POST as movimientosPOST } from "@/app/api/produccion/alimentacion/movimientos/route";
import { POST as syncBatchPOST } from "@/app/api/sync/batch/route";
import { GET as soberaniaGET, POST as soberaniaPOST } from "@/app/api/soberania/route";
import { POST as sacrificioPOST, PUT as sacrificioPUT, DELETE as sacrificioDELETE } from "@/app/api/produccion/sacrificio/route";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, String(val));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

let cleanupData: TestCleanup | null = null;
const extraMutationIds: string[] = [];
const extraAutoconsumoIds: string[] = [];

describe("P0 Integridad Offline, Aislamiento Multi-Finca, Dominio Único y Autoconsumo", () => {
  let memoryStorage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    mockOutbox.clear();
    mockRecords.clear();
    memoryStorage = createMemoryStorage();
    vi.restoreAllMocks();
    vi.stubGlobal("window", {
      localStorage: memoryStorage,
      location: {
        origin: "https://gallinero.test",
        href: "https://gallinero.test/inicio",
        assign: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("navigator", { onLine: true });
    clearCachedActiveFarmMeta();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (extraAutoconsumoIds.length) {
      await db.delete(autoconsumoLogs).where(inArray(autoconsumoLogs.id, extraAutoconsumoIds));
      extraAutoconsumoIds.length = 0;
    }
    if (extraMutationIds.length) {
      await db
        .delete(offlineMutationReceipts)
        .where(inArray(offlineMutationReceipts.mutationId, extraMutationIds));
      extraMutationIds.length = 0;
    }
    if (cleanupData) {
      await cleanup(cleanupData);
      cleanupData = null;
    }
  });

  it("INT-01: solo elimina del Outbox un HTTP 409 cuando confirma idempotencia explícita", async () => {
    expect(classifySyncHttpResponse(201, new Headers(), { ok: true })).toBe("confirmed");
    expect(
      classifySyncHttpResponse(201, new Headers({ "X-Idempotent-Replay": "1" }), { ok: true }),
    ).toBe("duplicate_confirmed");
    expect(classifySyncHttpResponse(409, new Headers(), { warning: true, error: "Excede umbral" })).toBe(
      "business_conflict",
    );
    expect(
      classifySyncHttpResponse(409, new Headers(), { code: "DUPLICATE_MUTATION", deduplicated: true }),
    ).toBe("duplicate_confirmed");
    expect(classifySyncHttpResponse(403, new Headers(), { error: "Forbidden" })).toBe(
      "permission_denied",
    );
    expect(classifySyncHttpResponse(503, new Headers(), {})).toBe("retryable_error");

    writeCachedActiveFarmMeta({ id: "farm-int01", name: "Granja INT01", slug: "int01", code: "G1" });

    // Caso A: PUT devuelve 409 por conflicto de negocio -> NO debe borrarse del Outbox
    const conflictId = crypto.randomUUID();
    await addOutboxMutation({
      id: conflictId,
      farmId: "farm-int01",
      endpoint: "/api/produccion/huevos",
      method: "PUT",
      entity: "huevos",
      description: "Actualización en conflicto",
      payload: { date: "2026-11-22", totalCollected: 500 },
      clientTimestamp: new Date().toISOString(),
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ warning: true, error: "Supera umbral esperado" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const resConflict = await syncManager.syncPending();
    expect(resConflict.synced).toBe(0);
    expect(resConflict.failed).toBe(1);
    const remaining = mockOutbox.get(conflictId);
    expect(remaining).toBeDefined();
    expect(remaining?.status).toBe("failed");
    expect(remaining?.retries).toBe(1);
    expect(remaining?.error).toContain("Supera umbral");

    // Caso B: Reintento devuelve 409 con confirmación explícita de idempotencia -> sí se elimina
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "DUPLICATE_MUTATION", deduplicated: true }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const resDedup = await syncManager.syncPending();
    expect(resDedup.synced).toBe(1);
    expect(resDedup.failed).toBe(0);
    expect(mockOutbox.has(conflictId)).toBe(false);
  });

  it("INT-03: conserva exactamente el mismo X-Client-Mutation-Id en fallback offline tras corte de red", async () => {
    writeCachedActiveFarmMeta({ id: "farm-int03", name: "Granja INT03", slug: "int03", code: "G3" });
    let capturedHeaderId: string | null = null;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const hdrs = new Headers(init?.headers);
        capturedHeaderId = hdrs.get("X-Client-Mutation-Id");
        throw new Error("Connection reset mid-flight");
      }),
    );

    const res = await apiFetch("/api/produccion/huevos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: "2026-11-22", totalCollected: 20, locationId: "loc-1" }),
    });

    expect(res.status).toBe(202);
    expect(res.headers.get("X-Gallinero-Offline-Queued")).toBe("1");
    const json = await res.json();
    expect(capturedHeaderId).toBeTruthy();
    expect(json.mutationId).toBe(capturedHeaderId);
    expect(mockOutbox.size).toBe(1);
    const queued = mockOutbox.get(capturedHeaderId!);
    expect(queued?.id).toBe(capturedHeaderId);
    expect(queued?.farmId).toBe("farm-int03");
  });

  it("OFF-01 / OFF-07: aísla outbox, cachés IndexedDB y claves locales al cambiar de granja", async () => {
    writeCachedActiveFarmMeta({ id: "farm-A", name: "Granja A", slug: "fa", code: "FA" });
    expect(getApiCacheKey("/api/dashboard")).toBe("api:farm-A:/api/dashboard");
    expect(resolveScopedOfflineKey("produccion_huevos")).toBe("farm:farm-A:produccion_huevos");
    expect(resolveScopedOfflineKey("__offline_meta_sync")).toBe("__offline_meta_sync");
    expect(extractPathnameFromApiCacheKey("api:farm-A:/api/produccion/huevos?species=gallina")).toBe(
      "/api/produccion/huevos",
    );
    expect(extractPathnameFromApiCacheKey("farm:farm-A:api:farm-A:/api/dashboard")).toBe("/api/dashboard");

    await setCachedRecords("produccion_huevos", [{ id: "egg-from-A" }]);
    const mutA = await addOutboxMutation({
      id: crypto.randomUUID(),
      endpoint: "/api/produccion/huevos",
      method: "POST",
      entity: "huevos",
      description: "Recolección Granja A",
      payload: { totalCollected: 12 },
      clientTimestamp: new Date().toISOString(),
    });
    expect(mutA.farmId).toBe("farm-A");
    expect(mutationMatchesFarm(mutA, "farm-A")).toBe(true);
    expect(mutationMatchesFarm(mutA, "farm-B")).toBe(false);

    recordNudgeFeedback("ini-1", "acted", memoryStorage, 1000, "farm-A");
    expect(resolveNudgeFeedbackStorageKey("farm-A")).not.toBe(
      resolveNudgeFeedbackStorageKey("farm-B"),
    );
    expect(resolveTelemetryQueueKey("farm-A")).not.toBe(resolveTelemetryQueueKey("farm-B"));

    // Cambiar contexto a Granja B: NO debe ver cachés ni despachar mutaciones de Granja A
    writeCachedActiveFarmMeta({ id: "farm-B", name: "Granja B", slug: "fb", code: "FB" });
    expect(await getCachedRecords("produccion_huevos")).toBeNull();
    expect(await getAllOutboxMutations()).toHaveLength(0);
    expect(Object.keys(getNudgeFeedbackMap(memoryStorage, "farm-B"))).toHaveLength(0);

    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true, results: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const syncB = await syncManager.syncPending();
    expect(syncB.synced).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    // La mutación de Granja A permanece intacta en el dispositivo
    expect(mockOutbox.has(mutA.id)).toBe(true);
  });

  it("OFF-02: distingue HTTP 202 encolado de configuración confirmada y conserva el borrador", async () => {
    expect(
      isQueuedOfflineOnboardingResponse(202, new Headers({ "X-Gallinero-Offline-Queued": "1" }), {
        ok: true,
        queued: true,
      }),
    ).toBe(true);
    expect(
      isQueuedOfflineOnboardingResponse(201, new Headers(), {
        ok: true,
        created: { locationsCreated: 1 },
      }),
    ).toBe(false);

    writeCachedActiveFarmMeta({ id: "farm-off02", name: "Granja OFF02", slug: "off02", code: "O2" });
    const draftKey = "gallinero:onboarding_draft:v1:farm-off02";
    memoryStorage.setItem(draftKey, JSON.stringify({ step: 3, purposes: ["hogar"] }));
    vi.stubGlobal("navigator", { onLine: false });

    const res = await apiFetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombrePredio: "Finca Sin Señal" }),
    });
    const json = await res.json();
    expect(res.status).toBe(202);
    expect(isQueuedOfflineOnboardingResponse(res.status, res.headers, json)).toBe(true);
    // El borrador NO se borra hasta confirmación real del servidor
    expect(memoryStorage.getItem(draftKey)).not.toBeNull();
  });

  it("INT-04: online y /api/sync/batch usan el mismo servicio para alimento (stock insuficiente y unitCost)", async () => {
    cleanupData = createCleanup();
    const loc = await createTestFarmLocation();
    cleanupData.locationIds.push(loc.id);
    const feed = await createTestFeed({
      category: "suplementario",
      currentStock: "5.00",
      costPerUnit: "2500.00",
    });
    cleanupData.feedIds.push(feed.id);
    const today = todayColombiaIso();

    // 1. Online intenta consumir 10 kg cuando hay 5 kg -> 400 Stock insuficiente
    const onlineFail = await movimientosPOST(
      mockRequest("http://localhost/api/produccion/alimentacion/movimientos", {
        method: "POST",
        body: {
          feedId: feed.id,
          quantity: 10,
          isEntry: false,
          locationId: loc.id,
          date: today,
          species: "gallina",
        },
      }),
    );
    expect(onlineFail.status).toBe(400);
    const onlineErr = await parseJson(onlineFail);
    expect(onlineErr.error).toContain("Stock insuficiente");

    // 2. Batch intenta exactamente el mismo consumo de 10 kg -> rechazado igual, sin dejar stock negativo
    const overBatchId = crypto.randomUUID();
    const batchFail = await syncBatchPOST(
      mockRequest("http://localhost/api/sync/batch", {
        method: "POST",
        body: {
          mutations: [
            {
              id: overBatchId,
              entity: "alimentacion",
              endpoint: "/api/produccion/alimentacion/movimientos",
              method: "POST",
              payload: {
                feedId: feed.id,
                quantity: 10,
                isEntry: false,
                locationId: loc.id,
                date: today,
                species: "gallina",
              },
            },
          ],
        },
      }),
    );
    expect(batchFail.status).toBe(200);
    const batchFailJson = await parseJson(batchFail);
    expect(batchFailJson.results[0].status).toBe("error");
    expect(batchFailJson.results[0].error).toContain("Stock insuficiente");

    const [feedUnchanged] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(feedUnchanged.currentStock)).toBe(5);

    // 3. Batch válido de 3 kg conserva unitCost = 2500.00 igual que online
    const validBatchId = crypto.randomUUID();
    extraMutationIds.push(validBatchId);
    const batchOk = await syncBatchPOST(
      mockRequest("http://localhost/api/sync/batch", {
        method: "POST",
        body: {
          mutations: [
            {
              id: validBatchId,
              entity: "alimentacion",
              endpoint: "/api/produccion/alimentacion/movimientos",
              method: "POST",
              payload: {
                feedId: feed.id,
                quantity: 3,
                isEntry: false,
                locationId: loc.id,
                date: today,
                species: "gallina",
              },
            },
          ],
        },
      }),
    );
    const batchOkJson = await parseJson(batchOk);
    expect(batchOkJson.results[0].status).toBe("synced");
    cleanupData.movementIds.push(validBatchId);

    const [movRow] = await db.select().from(feedMovements).where(eq(feedMovements.id, validBatchId));
    expect(movRow).toBeDefined();
    expect(Number(movRow.unitCost)).toBe(2500);
    const [feedAfter] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(feedAfter.currentStock)).toBe(2);
  });

  it("INT-02 + DAT-01 + DAT-02 + DAT-04: paridad huevos online/batch, autoconsumo sin precio y conciliación Soberanía", async () => {
    cleanupData = createCleanup();
    const loc = await createTestFarmLocation();
    cleanupData.locationIds.push(loc.id);
    const birthDate = new Date(Date.now() - 245 * 86400000).toISOString().split("T")[0];
    const [hen] = await db
      .insert(hens)
      .values({
        code: `G-P0-${Date.now()}`,
        breed: "ISA Brown",
        birthDate,
        status: "activa",
        locationId: loc.id,
      })
      .returning();
    cleanupData.henIds.push(hen.id);
    const today = todayColombiaIso();

    // INT-02a: Ambos caminos rechazan asignación hogar + venta > huevos buenos
    const badAllocPayload = {
      date: today,
      species: "gallina",
      locationId: loc.id,
      broken: 0,
      forIncubation: 0,
      quantityAutoconsumo: 8,
      quantityExcedente: 5,
      sizes: [{ size: "AA", quantity: 10 }],
      overrideValidation: true,
    };
    const onlineBad = await huevosPOST(
      mockRequest("http://localhost/api/produccion/huevos", { method: "POST", body: badAllocPayload }),
    );
    expect(onlineBad.status).toBe(400);

    const batchBad = await syncBatchPOST(
      mockRequest("http://localhost/api/sync/batch", {
        method: "POST",
        body: {
          mutations: [
            {
              id: crypto.randomUUID(),
              entity: "huevos",
              endpoint: "/api/produccion/huevos",
              method: "POST",
              payload: badAllocPayload,
            },
          ],
        },
      }),
    );
    const batchBadJson = await parseJson(batchBad);
    expect(batchBadJson.results[0].status).toBe("error");
    expect(batchBadJson.results[0].resolution).toBe("validation_error");

    // INT-02b: Sin overrideValidation, ambos detectan conflicto biológico (409 / business_conflict)
    const overLimitPayload = {
      date: today,
      species: "gallina",
      locationId: loc.id,
      broken: 0,
      forIncubation: 0,
      sizes: [{ size: "AA", quantity: 999 }],
    };
    const onlineConflict = await huevosPOST(
      mockRequest("http://localhost/api/produccion/huevos", { method: "POST", body: overLimitPayload }),
    );
    expect(onlineConflict.status).toBe(409);

    const batchConflict = await syncBatchPOST(
      mockRequest("http://localhost/api/sync/batch", {
        method: "POST",
        body: {
          mutations: [
            {
              id: crypto.randomUUID(),
              entity: "huevos",
              endpoint: "/api/produccion/huevos",
              method: "POST",
              payload: overLimitPayload,
            },
          ],
        },
      }),
    );
    const batchConflictJson = await parseJson(batchConflict);
    expect(batchConflictJson.results[0].status).toBe("error");
    expect(batchConflictJson.results[0].resolution).toBe("business_conflict");

    // DAT-01: Recolección con 12 huevos al hogar SIN precio de referencia -> debe crear autoconsumoLogs
    const eggProdRes = await huevosPOST(
      mockRequest("http://localhost/api/produccion/huevos", {
        method: "POST",
        body: {
          date: today,
          species: "gallina",
          locationId: loc.id,
          broken: 0,
          forIncubation: 0,
          quantityAutoconsumo: 12,
          quantityExcedente: 0,
          referenceUnitPrice: "0",
          sizes: [{ size: "AA", quantity: 12 }],
          overrideValidation: true,
        },
      }),
    );
    expect(eggProdRes.status).toBe(201);
    const prod = await parseJson(eggProdRes);
    cleanupData.productionIds.push(prod.id);

    const autoLogsInitial = await db
      .select()
      .from(autoconsumoLogs)
      .where(eq(autoconsumoLogs.eggProductionId, prod.id));
    expect(autoLogsInitial).toHaveLength(1);
    expect(Number(autoLogsInitial[0].quantity)).toBe(12);
    expect(Number(autoLogsInitial[0].marketReferencePrice)).toBe(0);

    // DAT-02a: Editar la recolección a 18 huevos y precio $600 -> reconcilia el mismo log sin duplicar
    const eggPutRes = await huevosPUT(
      mockRequest("http://localhost/api/produccion/huevos", {
        method: "PUT",
        body: {
          id: prod.id,
          date: today,
          species: "gallina",
          locationId: loc.id,
          broken: 0,
          forIncubation: 0,
          quantityAutoconsumo: 18,
          quantityExcedente: 0,
          referenceUnitPrice: "600",
          sizes: [{ size: "AA", quantity: 18 }],
          overrideValidation: true,
        },
      }),
    );
    expect(eggPutRes.status).toBe(200);

    const autoLogsUpdated = await db
      .select()
      .from(autoconsumoLogs)
      .where(eq(autoconsumoLogs.eggProductionId, prod.id));
    expect(autoLogsUpdated).toHaveLength(1);
    expect(Number(autoLogsUpdated[0].quantity)).toBe(18);
    expect(Number(autoLogsUpdated[0].savingsAmount)).toBe(10800);

    // DAT-02b: Intento de registro manual duplicado en Soberanía con misma fecha/especie/cantidad -> 409
    const dupManualRes = await soberaniaPOST(
      mockRequest("http://localhost/api/soberania", {
        method: "POST",
        body: {
          date: today,
          species: "gallina",
          productType: "huevo",
          quantity: 18,
          marketReferencePrice: 600,
        },
      }),
    );
    expect(dupManualRes.status).toBe(409);

    // DAT-04: Registro manual recalcula savingsAmount en servidor ignorando el valor manipulado del cliente
    const manualTamperedRes = await soberaniaPOST(
      mockRequest("http://localhost/api/soberania", {
        method: "POST",
        body: {
          date: today,
          species: "gallina",
          productType: "huevo",
          quantity: 4,
          marketReferencePrice: 500,
          savingsAmount: 999999,
          notes: "Prueba recálculo servidor P0",
        },
      }),
    );
    expect(manualTamperedRes.status).toBe(201);
    const manualCreated = await parseJson(manualTamperedRes);
    extraAutoconsumoIds.push(manualCreated.id);
    expect(Number(manualCreated.savingsAmount)).toBe(2000);
    expect(manualCreated.originType).toBe("manual");
    expect(manualCreated.valuationStatus).toBe("valorizado");

    // DAT-01b: Registro manual en Soberanía sin precio ni valorización automática
    const manualZeroPriceRes = await soberaniaPOST(
      mockRequest("http://localhost/api/soberania", {
        method: "POST",
        body: {
          date: today,
          species: "gallina",
          productType: "abono_huerta",
          quantity: 7,
          marketReferencePrice: 0,
          savingsAmount: 88888,
        },
      }),
    );
    expect(manualZeroPriceRes.status).toBe(201);
    const zeroCreated = await parseJson(manualZeroPriceRes);
    extraAutoconsumoIds.push(zeroCreated.id);
    expect(Number(zeroCreated.quantity)).toBe(7);
    expect(Number(zeroCreated.savingsAmount)).toBe(0);
    expect(zeroCreated.valuationStatus).toBe("sin_precio_referencia");

    // GET /api/soberania expone originType y valuationStatus
    const sobGet = await soberaniaGET(mockRequest("http://localhost/api/soberania?species=gallina"));
    expect(sobGet.status).toBe(200);
    const sobData = await parseJson(sobGet);
    const linkedFromGet = sobData.logs.find((l: any) => l.eggProductionId === prod.id);
    const zeroFromGet = sobData.logs.find((l: any) => l.id === zeroCreated.id);
    expect(linkedFromGet?.originType).toBe("produccion_huevos");
    expect(linkedFromGet?.valuationStatus).toBe("valorizado");
    expect(zeroFromGet?.originType).toBe("manual");
    expect(zeroFromGet?.valuationStatus).toBe("sin_precio_referencia");
  });

  it("DAT-01 / DAT-02: /api/sync/batch registra autoconsumo de huevos sin precio y sacrificio PUT reconcilia autoconsumo_logs", async () => {
    cleanupData = createCleanup();
    const loc = await createTestFarmLocation();
    cleanupData.locationIds.push(loc.id);
    const today = todayColombiaIso();
    const birthDate = new Date(Date.now() - 245 * 86400000).toISOString().split("T")[0];
    const [hen] = await db
      .insert(hens)
      .values({
        code: `G-B2-${Date.now()}`,
        breed: "ISA Brown",
        birthDate,
        status: "activa",
        locationId: loc.id,
      })
      .returning();
    cleanupData.henIds.push(hen.id);

    const batchEggId = crypto.randomUUID();
    extraMutationIds.push(batchEggId);
    const batchEggRes = await syncBatchPOST(
      mockRequest("http://localhost/api/sync/batch", {
        method: "POST",
        body: {
          mutations: [
            {
              id: batchEggId,
              entity: "huevos",
              endpoint: "/api/produccion/huevos",
              method: "POST",
              payload: {
                date: today,
                species: "gallina",
                locationId: loc.id,
                broken: 0,
                forIncubation: 0,
                quantityAutoconsumo: 9,
                quantityExcedente: 0,
                referenceUnitPrice: "0",
                sizes: [{ size: "AA", quantity: 9 }],
                overrideValidation: true,
              },
            },
          ],
        },
      }),
    );
    const batchEggJson = await parseJson(batchEggRes);
    expect(batchEggJson.results[0].status).toBe("synced");
    cleanupData.productionIds.push(batchEggId);

    const [batchEggAuto] = await db
      .select()
      .from(autoconsumoLogs)
      .where(eq(autoconsumoLogs.eggProductionId, batchEggId));
    expect(batchEggAuto).toBeDefined();
    expect(Number(batchEggAuto.quantity)).toBe(9);
    expect(Number(batchEggAuto.marketReferencePrice)).toBe(0);

    // Sacrificio con lote de pollos -> POST + PUT reconcilia autoconsumo_logs vinculado por slaughterId
    const [batch] = await db
      .insert(broilerBatches)
      .values({
        code: `L-SAC-${Date.now()}`,
        species: "pollo",
        breed: "Ross 308",
        purpose: "engorde_carne",
        startDate: today,
        initialQuantity: 10,
        currentQuantity: 10,
        status: "activo",
        locationId: loc.id,
      })
      .returning();
    cleanupData.batchIds.push(batch.id);

    const sacPost = await sacrificioPOST(
      mockRequest("http://localhost/api/produccion/sacrificio", {
        method: "POST",
        body: {
          date: today,
          birdType: "lote_pollos",
          species: "pollo",
          quantity: 2,
          weightKg: "3.6",
          destination: "consumo_propio",
          headsAutoconsumo: 2,
          weightKgAutoconsumo: "3.6",
          batchId: batch.id,
          locationId: loc.id,
          notes: "Prueba sacrificio sin precio obligatorio",
        },
      }),
    );
    expect(sacPost.status).toBe(201);
    const sac = await parseJson(sacPost);
    cleanupData.slaughterIds.push(sac.id);

    const logsAfterPost = await db
      .select()
      .from(autoconsumoLogs)
      .where(eq(autoconsumoLogs.slaughterId, sac.id));
    expect(logsAfterPost).toHaveLength(1);
    expect(Number(logsAfterPost[0].quantity)).toBeCloseTo(3.6, 2);

    const sacPut = await sacrificioPUT(
      mockRequest("http://localhost/api/produccion/sacrificio", {
        method: "PUT",
        body: {
          id: sac.id,
          date: today,
          birdType: "lote_pollos",
          species: "pollo",
          quantity: 3,
          weightKg: "5.4",
          destination: "consumo_propio",
          headsAutoconsumo: 3,
          weightKgAutoconsumo: "5.4",
          batchId: batch.id,
          locationId: loc.id,
        },
      }),
    );
    expect(sacPut.status).toBe(200);

    const logsAfterPut = await db
      .select()
      .from(autoconsumoLogs)
      .where(eq(autoconsumoLogs.slaughterId, sac.id));
    expect(logsAfterPut).toHaveLength(1);
    expect(Number(logsAfterPut[0].quantity)).toBeCloseTo(5.4, 2);

    const sacDel = await sacrificioDELETE(
      mockRequest(`http://localhost/api/produccion/sacrificio?id=${sac.id}`, { method: "DELETE" }),
    );
    expect(sacDel.status).toBe(200);
    cleanupData.slaughterIds = [];
  });
});
