/**
 * Gestor de Sincronización Offline-First
 * Maneja eventos de conectividad, reintentos automáticos,
 * vaciado de la cola (Outbox) y notificación a la interfaz de usuario.
 */

import {
  OutboxMutation,
  getPendingMutations,
  updateOutboxMutation,
  removeOutboxMutation,
  getPendingCount,
  addOutboxMutation,
} from "./db";
import { v4 as uuidv4 } from "uuid";
import { applyOptimisticMutationToCache } from "./optimisticCache";

const BATCHABLE_ENTITIES = new Set<OutboxMutation["entity"]>([
  "huevos",
  "mortalidad",
  "alimentacion",
  "pesaje",
  "sanidad",
  "reproduccion",
  "bioseguridad",
  "cierre_diario",
]);

export const SYNC_COMPLETED_EVENT = "gallinero-sync-completed";

export function partitionPendingMutations(pending: OutboxMutation[]): {
  batchable: OutboxMutation[];
  individual: OutboxMutation[];
} {
  const batchable: OutboxMutation[] = [];
  const individual: OutboxMutation[] = [];
  for (const m of pending) {
    if (m.method === "POST" && BATCHABLE_ENTITIES.has(m.entity)) {
      batchable.push(m);
    } else {
      individual.push(m);
    }
  }
  return { batchable, individual };
}

export function buildIndividualSyncRequestInit(mutation: OutboxMutation): RequestInit {
  const payload = mutation.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const hasPayloadKeys = Object.keys(payload).length > 0;
  const omitBody = mutation.method === "DELETE" && !hasPayloadKeys;
  const headers: Record<string, string> = {
    "X-Client-Mutation-Id": mutation.id,
    "X-Client-Timestamp": mutation.clientTimestamp,
  };

  if (!omitBody) {
    headers["Content-Type"] = "application/json";
  }

  const serializedPayload =
    mutation.entity === "general"
      ? payload
      : {
          ...payload,
          id: mutation.id, // Idempotencia: enviar el UUID generado en el móvil
          clientTimestamp: mutation.clientTimestamp,
        };

  return {
    method: mutation.method,
    credentials: "include",
    headers,
    ...(omitBody ? {} : { body: JSON.stringify(serializedPayload) }),
  };
}

export type SyncState = "idle" | "syncing" | "error" | "success";

export interface SyncStatusEventDetail {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  syncError: string | null;
}

class SyncManager {
  private isSyncing = false;
  private lastSyncTime: number | null = null;
  private syncError: string | null = null;
  private listeners: Set<(detail: SyncStatusEventDetail) => void> = new Set();
  private autoSyncInterval: any = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.initEventListeners();
    }
  }

  private initEventListeners() {
    window.addEventListener("online", () => {
      this.notifyListeners();
      // Auto sincronizar cuando regresa la conexión
      void this.syncPending();
    });

    window.addEventListener("offline", () => {
      this.notifyListeners();
    });

    // Revisar periódicamente cada 60 segundos si hay conexión y pendientes
    this.autoSyncInterval = setInterval(() => {
      if (this.isOnline() && !this.isSyncing) {
        void this.syncPending();
      }
    }, 60000);
  }

  public isOnline(): boolean {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  }

  public subscribe(callback: (detail: SyncStatusEventDetail) => void): () => void {
    this.listeners.add(callback);
    // Notificar estado actual inmediatamente
    void this.getStatus().then(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  public async getStatus(): Promise<SyncStatusEventDetail> {
    const pendingCount = await getPendingCount().catch(() => 0);
    return {
      isOnline: this.isOnline(),
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncTime: this.lastSyncTime,
      syncError: this.syncError,
    };
  }

  private async notifyListeners() {
    const status = await this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (e) {
        console.error("Error en listener de SyncManager", e);
      }
    });

    // Emitir también evento global en window
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("gallinero-sync-status", { detail: status })
      );
    }
  }

  /**
   * Sincroniza todas las mutaciones pendientes en la cola.
   * Primero intenta la sincronización en lote mediante /api/sync/batch.
   * Si falla, reintenta secuencialmente endpoint por endpoint con idempotencia.
   */
  public async syncPending(): Promise<{ success: boolean; synced: number; failed: number }> {
    if (this.isSyncing) {
      return { success: false, synced: 0, failed: 0 };
    }

    if (!this.isOnline()) {
      await this.notifyListeners();
      return { success: false, synced: 0, failed: 0 };
    }

    const pending = await getPendingMutations();
    if (pending.length === 0) {
      this.isSyncing = false;
      this.syncError = null;
      await this.notifyListeners();
      return { success: true, synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.syncError = null;
    await this.notifyListeners();

    let syncedCount = 0;
    let failedCount = 0;

    try {
      const { batchable, individual } = partitionPendingMutations(pending);
      const fallbackIndividual = [...individual];

      // 1. Intentar sincronización en lote solo para entidades compatibles (POST)
      if (batchable.length > 0) {
        const batchSuccess = await this.attemptBatchSync(batchable);
        if (batchSuccess.handled) {
          syncedCount += batchSuccess.synced;
          failedCount += batchSuccess.failed;
        } else {
          fallbackIndividual.unshift(...batchable);
        }
      }

      // 2. Enviar individualmente mutaciones generales, PUT, DELETE o fallback de lote
      if (fallbackIndividual.length > 0) {
        const individualResult = await this.syncIndividually(fallbackIndividual);
        syncedCount += individualResult.synced;
        failedCount += individualResult.failed;
      }

      this.lastSyncTime = Date.now();
      if (failedCount > 0) {
        this.syncError = `${failedCount} registro(s) no pudieron sincronizarse. Revisa los detalles.`;
      } else {
        this.syncError = null;
      }

      if (syncedCount > 0 && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(SYNC_COMPLETED_EVENT, {
            detail: { syncedCount, failedCount },
          })
        );
      }
    } catch (err: any) {
      console.error("Error en sincronización", err);
      this.syncError = err.message || "Error al sincronizar con el servidor";
    } finally {
      this.isSyncing = false;
      await this.notifyListeners();
    }

    return {
      success: failedCount === 0,
      synced: syncedCount,
      failed: failedCount,
    };
  }

  private async attemptBatchSync(
    mutations: OutboxMutation[]
  ): Promise<{ handled: boolean; synced: number; failed: number }> {
    try {
      const response = await fetch("/api/sync/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mutations }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Endpoint no existe aún, pasar a individual
          return { handled: false, synced: 0, failed: 0 };
        }
        throw new Error(`Error en servidor batch: HTTP ${response.status}`);
      }

      const result = await response.json();
      const results: Array<{ id: string; status: "synced" | "error"; error?: string }> =
        result.results || [];

      let synced = 0;
      let failed = 0;

      for (const item of results) {
        if (item.status === "synced") {
          await removeOutboxMutation(item.id);
          synced++;
        } else {
          await updateOutboxMutation(item.id, {
            status: "failed",
            error: item.error || "Error al procesar",
            retries: (mutations.find((m) => m.id === item.id)?.retries || 0) + 1,
          });
          failed++;
        }
      }

      return { handled: true, synced, failed };
    } catch {
      return { handled: false, synced: 0, failed: 0 };
    }
  }

  private async syncIndividually(
    mutations: OutboxMutation[]
  ): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    for (const mutation of mutations) {
      try {
        await updateOutboxMutation(mutation.id, { status: "syncing" });

        const res = await fetch(mutation.endpoint, buildIndividualSyncRequestInit(mutation));

        if (res.ok || res.status === 409) {
          // 200/201 o 409 (ya existía por idempotencia)
          await removeOutboxMutation(mutation.id);
          synced++;
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error || `HTTP ${res.status}`;
          await updateOutboxMutation(mutation.id, {
            status: "failed",
            error: errMsg,
            retries: mutation.retries + 1,
          });
          failed++;
        }
      } catch (err: any) {
        await updateOutboxMutation(mutation.id, {
          status: "failed",
          error: err.message || "Error de red",
          retries: mutation.retries + 1,
        });
        failed++;
      }
    }

    return { synced, failed };
  }

  /**
   * Encola directamente en IndexedDB sin intentar red (usado por el fallback offline de apiFetch).
   * Preserva el payload original sin inyectar campos extra.
   */
  public async enqueueOfflineMutation(params: {
    endpoint: string;
    method: "POST" | "PUT" | "DELETE";
    description: string;
    payload?: Record<string, any>;
    entity?: OutboxMutation["entity"];
  }): Promise<OutboxMutation> {
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : uuidv4();
    const clientTimestamp = new Date().toISOString();
    const payload = params.payload ?? {};
    const stored = await addOutboxMutation({
      id,
      endpoint: params.endpoint,
      method: params.method,
      entity: params.entity ?? "general",
      description: params.description,
      payload,
      clientTimestamp,
    });
    await applyOptimisticMutationToCache(params.endpoint, params.method, payload, id);
    await this.notifyListeners();
    return stored;
  }

  /**
   * Helper para guardar una operación:
   * Si está online, intenta enviarla directo al servidor.
   * Si está offline o la red falla, la almacena en la cola local de Outbox.
   */
  public async executeMutation<T = any>(params: {
    endpoint: string;
    method?: "POST" | "PUT" | "DELETE";
    entity: OutboxMutation["entity"];
    description: string;
    payload: Record<string, any>;
    onOptimisticUpdate?: (item: OutboxMutation) => void;
  }): Promise<{ ok: boolean; status?: number; data?: T; error?: string; offline: boolean; mutationId: string }> {
    const id = params.payload.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : uuidv4());
    const method = params.method || "POST";
    const clientTimestamp = new Date().toISOString();

    const mutationPayload = {
      ...params.payload,
      id,
    };

    // Si no hay red, guardar directo en outbox
    if (!this.isOnline()) {
      const stored = await addOutboxMutation({
        id,
        endpoint: params.endpoint,
        method,
        entity: params.entity,
        description: params.description,
        payload: mutationPayload,
        clientTimestamp,
      });

      await applyOptimisticMutationToCache(params.endpoint, method, mutationPayload, id);
      if (params.onOptimisticUpdate) {
        params.onOptimisticUpdate(stored);
      }

      await this.notifyListeners();
      return {
        ok: true,
        offline: true,
        mutationId: id,
        data: mutationPayload as unknown as T,
      };
    }

    // Si hay red, intentar enviar de inmediato
    try {
      const response = await fetch(params.endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Client-Mutation-Id": id,
          "X-Client-Timestamp": clientTimestamp,
        },
        body: JSON.stringify(mutationPayload),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          ok: true,
          status: response.status,
          offline: false,
          mutationId: id,
          data,
        };
      }

      // Si el proxy o servidor no está disponible (502/503/504), respaldar en Outbox
      if (response.status >= 502) {
        const stored = await addOutboxMutation({
          id,
          endpoint: params.endpoint,
          method,
          entity: params.entity,
          description: params.description,
          payload: mutationPayload,
          clientTimestamp,
        });
        await applyOptimisticMutationToCache(params.endpoint, method, mutationPayload, id);
        if (params.onOptimisticUpdate) {
          params.onOptimisticUpdate(stored);
        }
        await this.notifyListeners();
        return {
          ok: true,
          offline: true,
          mutationId: id,
          data: mutationPayload as unknown as T,
        };
      }

      // Si fue un error de validación (4xx / 500) con conexión activa:
      const errJson = await response.json().catch(() => ({}));
      return {
        ok: false,
        status: response.status,
        offline: false,
        mutationId: id,
        error: errJson.error || `Error del servidor (HTTP ${response.status})`,
      };
    } catch {
      // Cayó la conexión durante el envío: guardar en outbox como respaldo
      const stored = await addOutboxMutation({
        id,
        endpoint: params.endpoint,
        method,
        entity: params.entity,
        description: params.description,
        payload: mutationPayload,
        clientTimestamp,
      });

      await applyOptimisticMutationToCache(params.endpoint, method, mutationPayload, id);
      if (params.onOptimisticUpdate) {
        params.onOptimisticUpdate(stored);
      }

      await this.notifyListeners();
      return {
        ok: true,
        offline: true,
        mutationId: id,
        data: mutationPayload as unknown as T,
      };
    }
  }
}

// Instancia única (Singleton) para la aplicación
export const syncManager = new SyncManager();
