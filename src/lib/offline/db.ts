/**
 * Motor de almacenamiento local para funcionamiento Offline-First
 * Utiliza IndexedDB nativo del navegador (sin dependencias externas).
 * Seguro para SSR (retorna null/vacío en servidor).
 */

export interface OutboxMutation {
  id: string; // UUID v4 único
  endpoint: string; // ej: '/api/produccion/huevos'
  method: "POST" | "PUT" | "DELETE";
  entity: "huevos" | "mortalidad" | "alimentacion" | "pesaje" | "general";
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

export interface CachedRecordEntry<T = any> {
  key: string;
  data: T;
  updatedAt: number;
}

const DB_NAME = "gallinero_offline_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDBSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window && window.indexedDB !== null;
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

export async function addOutboxMutation(
  item: Omit<OutboxMutation, "status" | "retries" | "createdAt"> & {
    status?: OutboxMutation["status"];
  }
): Promise<OutboxMutation> {
  if (!isIndexedDBSupported()) {
    throw new Error("No hay soporte de IndexedDB");
  }

  const db = await getOfflineDB();
  const mutation: OutboxMutation = {
    ...item,
    status: item.status || "pending",
    retries: 0,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const req = store.put(mutation);

    req.onsuccess = () => resolve(mutation);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingMutations(): Promise<OutboxMutation[]> {
  if (!isIndexedDBSupported()) return [];
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const store = tx.objectStore("outbox");
    const req = store.getAll();

    req.onsuccess = () => {
      const all: OutboxMutation[] = req.result || [];
      // Ordenar por createdAt FIFO (más antiguo primero)
      const pending = all
        .filter((m) => m.status === "pending" || m.status === "failed")
        .sort((a, b) => a.createdAt - b.createdAt);
      resolve(pending);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOutboxMutations(): Promise<OutboxMutation[]> {
  if (!isIndexedDBSupported()) return [];
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const store = tx.objectStore("outbox");
    const req = store.getAll();

    req.onsuccess = () => {
      const all: OutboxMutation[] = req.result || [];
      resolve(all.sort((a, b) => b.createdAt - a.createdAt));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingMutations();
  return pending.length;
}

export async function updateOutboxMutation(
  id: string,
  updates: Partial<OutboxMutation>
): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const current = getReq.result;
      if (!current) {
        resolve();
        return;
      }
      const updated = { ...current, ...updates };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
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

export async function setCachedCatalog<T>(key: string, data: T): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("catalogs", "readwrite");
    const store = tx.objectStore("catalogs");
    const entry: CatalogEntry<T> = {
      key,
      data,
      updatedAt: Date.now(),
    };
    const req = store.put(entry);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedCatalog<T>(key: string): Promise<T | null> {
  if (!isIndexedDBSupported()) return null;
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("catalogs", "readonly");
    const store = tx.objectStore("catalogs");
    const req = store.get(key);

    req.onsuccess = () => {
      const entry = req.result as CatalogEntry<T> | undefined;
      resolve(entry ? entry.data : null);
    };
    req.onerror = () => reject(req.error);
  });
}

// ─────────────────────────────────────────────────────────────
// Almacenamiento de Registros Recientes (Caché de consultas offline)
// ─────────────────────────────────────────────────────────────

export async function setCachedRecords<T>(key: string, data: T): Promise<void> {
  if (!isIndexedDBSupported()) return;
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached_records", "readwrite");
    const store = tx.objectStore("cached_records");
    const entry: CachedRecordEntry<T> = {
      key,
      data,
      updatedAt: Date.now(),
    };
    const req = store.put(entry);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedRecords<T>(key: string): Promise<T | null> {
  const entry = await getCachedRecordEntry<T>(key);
  return entry ? entry.data : null;
}

export async function getCachedRecordEntry<T>(key: string): Promise<CachedRecordEntry<T> | null> {
  if (!isIndexedDBSupported()) return null;
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached_records", "readonly");
    const store = tx.objectStore("cached_records");
    const req = store.get(key);

    req.onsuccess = () => {
      const entry = req.result as CachedRecordEntry<T> | undefined;
      resolve(entry ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllCachedRecordKeys(): Promise<string[]> {
  if (!isIndexedDBSupported()) return [];
  const db = await getOfflineDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached_records", "readonly");
    const store = tx.objectStore("cached_records");
    const req = store.getAllKeys();

    req.onsuccess = () => {
      const keys = Array.isArray(req.result) ? req.result.map(String) : [];
      resolve(keys);
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
