/**
 * Motor de almacenamiento local para funcionamiento Offline-First
 * Utiliza IndexedDB nativo del navegador (sin dependencias externas).
 * Seguro para SSR (retorna null/vacío en servidor).
 */

import {
  decryptBlobPayload,
  decryptJsonPayload,
  encryptBlobPayload,
  encryptJsonPayload,
} from "./crypto";
import { readCachedActiveFarmMeta } from "../active-farm-client";

export interface OutboxMutation {
  id: string; // UUID v4 único
  farmId?: string | null; // Granja origen para aislamiento multi-finca (OFF-01)
  userId?: string | null; // Usuario origen opcional
  endpoint: string; // ej: '/api/produccion/huevos'
  method: "POST" | "PUT" | "DELETE";
  entity:
    | "huevos"
    | "mortalidad"
    | "alimentacion"
    | "pesaje"
    | "sanidad"
    | "reproduccion"
    | "bioseguridad"
    | "cierre_diario"
    | "general";
  description: string; // Resumen legible (ej: "45 huevos recolectados en Galpón A")
  payload: Record<string, any>;
  clientTimestamp: string; // Fecha/hora ISO del dispositivo
  status: "pending" | "syncing" | "failed" | "synced";
  error?: string;
  retries: number;
  createdAt: number;
  syncedAt?: number;
}

export interface CatalogEntry<T = any> {
  key: string;
  data: T;
  updatedAt: number;
}

export interface VoiceNoteEntry {
  id: string;
  audioBlob: Blob;
  mimeType: string;
  durationSec: number;
  transcriptHint?: string;
  status: "pending" | "transcribed" | "sent" | "error";
  error?: string;
  createdAt: number;
  conversationId?: string | null;
}

export interface CachedRecordEntry<T = any> {
  key: string;
  data: T;
  updatedAt: number;
}

const DB_NAME = "gallinero_offline_db";
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window && window.indexedDB !== null;
}

export function resolveEffectiveOfflineFarmId(farmId?: string | null): string | null {
  const candidate = farmId !== undefined ? farmId : readCachedActiveFarmMeta()?.id ?? null;
  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveScopedOfflineKey(rawKey: string, farmId?: string | null): string {
  if (!rawKey || rawKey.startsWith("__offline_") || rawKey.startsWith("farm:")) {
    return rawKey;
  }
  const effectiveFarmId = resolveEffectiveOfflineFarmId(farmId);
  if (!effectiveFarmId) return rawKey;
  if (rawKey.startsWith(`api:${effectiveFarmId}:`)) {
    return rawKey;
  }
  return `farm:${effectiveFarmId}:${rawKey}`;
}

export function mutationMatchesFarm(
  mutation: Pick<OutboxMutation, "farmId">,
  farmId?: string | null,
): boolean {
  const effectiveFarmId = resolveEffectiveOfflineFarmId(farmId);
  if (!effectiveFarmId) return true;
  if (!mutation.farmId) return true;
  return mutation.farmId === effectiveFarmId;
}

/**
 * Abre y migra la base de datos IndexedDB si es necesario.
 */
export function getOfflineDB(): Promise<IDBDatabase> {
  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error("IndexedDB no está soportado en este entorno"));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Store: outbox (cola de mutaciones pendientes)
      if (!db.objectStoreNames.contains("outbox")) {
        const outboxStore = db.createObjectStore("outbox", { keyPath: "id" });
        outboxStore.createIndex("status", "status", { unique: false });
        outboxStore.createIndex("entity", "entity", { unique: false });
        outboxStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // 2. Store: catalogs (almacenamiento de catálogos y referencias para dropdowns)
      if (!db.objectStoreNames.contains("catalogs")) {
        db.createObjectStore("catalogs", { keyPath: "key" });
      }

      // 3. Store: cached_records (registros recientes para consulta offline)
      if (!db.objectStoreNames.contains("cached_records")) {
        db.createObjectStore("cached_records", { keyPath: "key" });
      }

      // 4. Store: voice_notes (notas de voz grabadas en campo sin conexión)
      if (!db.objectStoreNames.contains("voice_notes")) {
        const voiceStore = db.createObjectStore("voice_notes", { keyPath: "id" });
        voiceStore.createIndex("status", "status", { unique: false });
        voiceStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("Error abriendo IndexedDB"));
    };
  });

  return dbPromise;
}

// ─────────────────────────────────────────────────────────────
// Operaciones de Outbox (Cola de mutaciones pendientes)
// ─────────────────────────────────────────────────────────────

async function serializeOutboxMutation(mutation: OutboxMutation): Promise<Record<string, any>> {
  const [encryptedPayload, encryptedDescription] = await Promise.all([
    encryptJsonPayload(mutation.payload),
    encryptJsonPayload(mutation.description),
  ]);
  return {
    ...mutation,
    farmId: mutation.farmId ?? null,
    userId: mutation.userId ?? null,
    payload: encryptedPayload,
    description: encryptedDescription,
  };
}

async function deserializeOutboxMutation(raw: Record<string, any>): Promise<OutboxMutation> {
  const [payload, description] = await Promise.all([
    decryptJsonPayload<Record<string, any>>(raw.payload),
    decryptJsonPayload<string>(raw.description),
  ]);
  return {
    ...(raw as OutboxMutation),
    farmId: typeof raw.farmId === "string" ? raw.farmId : null,
    userId: typeof raw.userId === "string" ? raw.userId : null,
    payload,
    description,
  };
}

export async function addOutboxMutation(
  item: Omit<OutboxMutation, "status" | "retries" | "createdAt"> & {
    status?: OutboxMutation["status"];
  }
): Promise<OutboxMutation> {
  if (!isIndexedDBSupported()) {
    throw new Error("No hay soporte de IndexedDB");
  }

  const resolvedFarmId = item.farmId !== undefined ? item.farmId : resolveEffectiveOfflineFarmId();
  const mutation: OutboxMutation = {
    ...item,
    farmId: resolvedFarmId,
    userId: item.userId ?? null,
    status: item.status || "pending",
    retries: 0,
    createdAt: Date.now(),
  };
  const storedMutation = await serializeOutboxMutation(mutation);
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const req = store.put(storedMutation);

    req.onsuccess = () => resolve(mutation);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingMutations(farmId?: string | null): Promise<OutboxMutation[]> {
  if (!isIndexedDBSupported()) return [];
  const db = await getOfflineDB();
  const effectiveFarmId = resolveEffectiveOfflineFarmId(farmId);

  const rawPending = await new Promise<Record<string, any>[]>((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const store = tx.objectStore("outbox");
    const req = store.getAll();

    req.onsuccess = () => {
      const all: Record<string, any>[] = req.result || [];
      // Ordenar por createdAt FIFO (más antiguo primero) y aislar por granja
      const pending = all
        .filter(
          (m) =>
            (m.status === "pending" || m.status === "failed") &&
            mutationMatchesFarm({ farmId: typeof m.farmId === "string" ? m.farmId : null }, effectiveFarmId),
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      resolve(pending);
    };
    req.onerror = () => reject(req.error);
  });

  return Promise.all(rawPending.map(deserializeOutboxMutation));
}

export async function getAllOutboxMutations(farmId?: string | null): Promise<OutboxMutation[]> {
  if (!isIndexedDBSupported()) return [];
  const db = await getOfflineDB();
  const effectiveFarmId = resolveEffectiveOfflineFarmId(farmId);

  const rawAll = await new Promise<Record<string, any>[]>((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const store = tx.objectStore("outbox");
    const req = store.getAll();

    req.onsuccess = () => {
      const all: Record<string, any>[] = req.result || [];
      const filtered = all
        .filter((m) => mutationMatchesFarm({ farmId: typeof m.farmId === "string" ? m.farmId : null }, effectiveFarmId))
        .sort((a, b) => b.createdAt - a.createdAt);
      resolve(filtered);
    };
    req.onerror = () => reject(req.error);
  });

  return Promise.all(rawAll.map(deserializeOutboxMutation));
}

export async function getPendingCount(farmId?: string | null): Promise<number> {
  const pending = await getPendingMutations(farmId);
  return pending.length;
}

export async function updateOutboxMutation(
  id: string,
  updates: Partial<OutboxMutation>
): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const db = await getOfflineDB();

  const rawCurrent = await new Promise<Record<string, any> | undefined>((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const store = tx.objectStore("outbox");
    const getReq = store.get(id);
    getReq.onsuccess = () => resolve(getReq.result as Record<string, any> | undefined);
    getReq.onerror = () => reject(getReq.error);
  });

  if (!rawCurrent) return;

  const current = await deserializeOutboxMutation(rawCurrent);
  const updated: OutboxMutation = { ...current, ...updates };
  const storedUpdated = await serializeOutboxMutation(updated);

  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const putReq = store.put(storedUpdated);
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
}

export async function removeOutboxMutation(id: string): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearSyncedOutbox(): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const req = store.getAll();

    req.onsuccess = () => {
      const all: OutboxMutation[] = req.result || [];
      const syncedIds = all.filter((m) => m.status === "synced").map((m) => m.id);
      for (const id of syncedIds) {
        store.delete(id);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// ─────────────────────────────────────────────────────────────
// Almacenamiento de Catálogos (Cache local de Lotes, Ubicaciones, etc.)
// ─────────────────────────────────────────────────────────────

export async function setCachedCatalog<T>(key: string, data: T, farmId?: string | null): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const scopedKey = resolveScopedOfflineKey(key, farmId);
  const encryptedData = await encryptJsonPayload(data);
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("catalogs", "readwrite");
    const store = tx.objectStore("catalogs");
    const entry = {
      key: scopedKey,
      data: encryptedData,
      updatedAt: Date.now(),
    };
    const req = store.put(entry);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedCatalog<T>(key: string, farmId?: string | null): Promise<T | null> {
  if (!isIndexedDBSupported()) return null;
  const scopedKey = resolveScopedOfflineKey(key, farmId);
  const db = await getOfflineDB();

  const entry = await new Promise<CatalogEntry<unknown> | undefined>((resolve, reject) => {
    const tx = db.transaction("catalogs", "readonly");
    const store = tx.objectStore("catalogs");
    const req = store.get(scopedKey);

    req.onsuccess = () => resolve(req.result as CatalogEntry<unknown> | undefined);
    req.onerror = () => reject(req.error);
  });

  if (!entry) return null;
  return decryptJsonPayload<T>(entry.data);
}

// ─────────────────────────────────────────────────────────────
// Almacenamiento de Registros Recientes (Caché de consultas offline)
// ─────────────────────────────────────────────────────────────

export async function setCachedRecords<T>(key: string, data: T, farmId?: string | null): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const scopedKey = resolveScopedOfflineKey(key, farmId);
  const encryptedData = await encryptJsonPayload(data);
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached_records", "readwrite");
    const store = tx.objectStore("cached_records");
    const entry = {
      key: scopedKey,
      data: encryptedData,
      updatedAt: Date.now(),
    };
    const req = store.put(entry);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedRecords<T>(key: string, farmId?: string | null): Promise<T | null> {
  const entry = await getCachedRecordEntry<T>(key, farmId);
  return entry ? entry.data : null;
}

export async function getCachedRecordEntry<T>(key: string, farmId?: string | null): Promise<CachedRecordEntry<T> | null> {
  if (!isIndexedDBSupported()) return null;
  const scopedKey = resolveScopedOfflineKey(key, farmId);
  const db = await getOfflineDB();

  const entry = await new Promise<CachedRecordEntry<unknown> | undefined>((resolve, reject) => {
    const tx = db.transaction("cached_records", "readonly");
    const store = tx.objectStore("cached_records");
    const req = store.get(scopedKey);

    req.onsuccess = () => resolve(req.result as CachedRecordEntry<unknown> | undefined);
    req.onerror = () => reject(req.error);
  });

  if (!entry) return null;
  const decryptedData = await decryptJsonPayload<T>(entry.data);
  return {
    key: entry.key,
    data: decryptedData,
    updatedAt: entry.updatedAt,
  };
}

export async function getAllCachedRecordKeys(farmId?: string | null): Promise<string[]> {
  if (!isIndexedDBSupported()) return [];
  const db = await getOfflineDB();
  const effectiveFarmId = resolveEffectiveOfflineFarmId(farmId);

  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached_records", "readonly");
    const store = tx.objectStore("cached_records");
    const req = store.getAllKeys();

    req.onsuccess = () => {
      const keys = Array.isArray(req.result) ? req.result.map(String) : [];
      if (!effectiveFarmId) {
        resolve(keys.filter((k) => !k.startsWith("farm:")));
        return;
      }
      resolve(
        keys.filter(
          (k) =>
            k.startsWith(`api:${effectiveFarmId}:`) ||
            k.startsWith(`farm:${effectiveFarmId}:`),
        ),
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export interface OfflineStorageStats {
  cachedEndpointCount: number;
  cachedCatalogCount: number;
  lastEndpointUpdateAt: number | null;
}

export async function getOfflineStorageStats(): Promise<OfflineStorageStats> {
  if (!isIndexedDBSupported()) {
    return { cachedEndpointCount: 0, cachedCatalogCount: 0, lastEndpointUpdateAt: null };
  }
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["cached_records", "catalogs"], "readonly");
    const recordsReq = tx.objectStore("cached_records").getAll();
    const catalogsReq = tx.objectStore("catalogs").getAllKeys();

    let records: CachedRecordEntry[] = [];
    let catalogKeys: string[] = [];

    recordsReq.onsuccess = () => {
      records = (recordsReq.result as CachedRecordEntry[]) || [];
    };
    catalogsReq.onsuccess = () => {
      catalogKeys = Array.isArray(catalogsReq.result)
        ? catalogsReq.result.map(String).filter((k) => !k.startsWith("__offline_"))
        : [];
    };

    tx.oncomplete = () => {
      let lastEndpointUpdateAt: number | null = null;
      for (const entry of records) {
        if (typeof entry.updatedAt === "number") {
          if (lastEndpointUpdateAt === null || entry.updatedAt > lastEndpointUpdateAt) {
            lastEndpointUpdateAt = entry.updatedAt;
          }
        }
      }
      resolve({
        cachedEndpointCount: records.length,
        cachedCatalogCount: catalogKeys.length,
        lastEndpointUpdateAt,
      });
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
  return setCachedCatalog<T>(`__offline_meta_${key}`, value);
}

export async function getMetaValue<T>(key: string): Promise<T | null> {
  return getCachedCatalog<T>(`__offline_meta_${key}`);
}

// ─────────────────────────────────────────────────────────────
// Operaciones de Voice Notes (Notas de voz offline)
// ─────────────────────────────────────────────────────────────

async function serializeVoiceNote(entry: VoiceNoteEntry): Promise<Record<string, any>> {
  const encryptedBlob = await encryptBlobPayload(entry.audioBlob);
  const encryptedHint =
    entry.transcriptHint !== undefined ? await encryptJsonPayload(entry.transcriptHint) : undefined;
  return {
    ...entry,
    audioBlob: encryptedBlob,
    transcriptHint: encryptedHint,
  };
}

async function deserializeVoiceNote(raw: Record<string, any>): Promise<VoiceNoteEntry> {
  const [audioBlob, transcriptHint] = await Promise.all([
    decryptBlobPayload(raw.audioBlob, raw.mimeType || "audio/webm"),
    raw.transcriptHint !== undefined ? decryptJsonPayload<string>(raw.transcriptHint) : Promise.resolve(undefined),
  ]);
  return {
    ...(raw as VoiceNoteEntry),
    audioBlob,
    transcriptHint,
  };
}

export async function addVoiceNote(
  note: Omit<VoiceNoteEntry, "status" | "createdAt"> & { status?: VoiceNoteEntry["status"] }
): Promise<VoiceNoteEntry> {
  if (!isIndexedDBSupported()) {
    throw new Error("No hay soporte de IndexedDB");
  }
  const entry: VoiceNoteEntry = {
    ...note,
    status: note.status || "pending",
    createdAt: Date.now(),
  };
  const storedEntry = await serializeVoiceNote(entry);
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("voice_notes", "readwrite");
    const req = tx.objectStore("voice_notes").put(storedEntry);
    req.onsuccess = () => resolve(entry);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllVoiceNotes(): Promise<VoiceNoteEntry[]> {
  if (!isIndexedDBSupported()) return [];
  const db = await getOfflineDB();
  const rawList = await new Promise<Record<string, any>[]>((resolve, reject) => {
    const tx = db.transaction("voice_notes", "readonly");
    const req = tx.objectStore("voice_notes").getAll();
    req.onsuccess = () => {
      const list: Record<string, any>[] = req.result || [];
      resolve(list.sort((a, b) => b.createdAt - a.createdAt));
    };
    req.onerror = () => reject(req.error);
  });
  return Promise.all(rawList.map(deserializeVoiceNote));
}

export async function getPendingVoiceNotes(): Promise<VoiceNoteEntry[]> {
  const all = await getAllVoiceNotes();
  return all.filter((n) => n.status === "pending" || n.status === "error").sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPendingVoiceNotesCount(): Promise<number> {
  const pending = await getPendingVoiceNotes();
  return pending.length;
}

export async function updateVoiceNote(id: string, patch: Partial<VoiceNoteEntry>): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const db = await getOfflineDB();
  const rawCurrent = await new Promise<Record<string, any> | undefined>((resolve, reject) => {
    const tx = db.transaction("voice_notes", "readonly");
    const store = tx.objectStore("voice_notes");
    const getReq = store.get(id);
    getReq.onsuccess = () => resolve(getReq.result as Record<string, any> | undefined);
    getReq.onerror = () => reject(getReq.error);
  });

  if (!rawCurrent) return;

  const current = await deserializeVoiceNote(rawCurrent);
  const updated: VoiceNoteEntry = { ...current, ...patch };
  const storedUpdated = await serializeVoiceNote(updated);

  return new Promise((resolve, reject) => {
    const tx = db.transaction("voice_notes", "readwrite");
    const store = tx.objectStore("voice_notes");
    const putReq = store.put(storedUpdated);
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });
}

export async function removeVoiceNote(id: string): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("voice_notes", "readwrite");
    const req = tx.objectStore("voice_notes").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
