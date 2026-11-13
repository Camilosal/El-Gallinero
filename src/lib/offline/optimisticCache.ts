import {
  getAllCachedRecordKeys,
  getCachedCatalog,
  getCachedRecords,
  setCachedCatalog,
  setCachedRecords,
} from "./db";

export const OFFLINE_QUEUED_EVENT = "gallinero-offline-queued";

function applyArrayMutation(
  list: any[],
  method: "POST" | "PUT" | "DELETE",
  payload: Record<string, any>,
  mutationId: string,
  targetId: string | null,
): any[] {
  if (method === "POST") {
    const id = String(payload.id || mutationId);
    const optimisticItem = {
      ...payload,
      id,
      _offlinePending: true,
      createdAt: payload.createdAt || new Date().toISOString(),
    };
    return [optimisticItem, ...list.filter((item) => item?.id !== id)];
  }
  if (method === "PUT" && targetId) {
    return list.map((item) =>
      item?.id === targetId ? { ...item, ...payload, id: targetId, _offlinePending: true } : item,
    );
  }
  if (method === "DELETE" && targetId) {
    return list.filter((item) => item?.id !== targetId);
  }
  return list;
}

/**
 * Actualiza optimistamente la copia en IndexedDB (cached_records) cuando una mutación
 * se encola offline, evitando que las pantallas pierdan visualmente el registro al recargar.
 */
export async function applyOptimisticMutationToCache(
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  payload: Record<string, any>,
  mutationId: string,
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const parsed = new URL(endpoint, "https://gallinero.local");
    const pathname = parsed.pathname;
    const targetId =
      parsed.searchParams.get("id") ||
      parsed.searchParams.get("saleId") ||
      parsed.searchParams.get("adjustId") ||
      (typeof payload.id === "string" ? payload.id : null);

    const keys = typeof getAllCachedRecordKeys === "function"
      ? await getAllCachedRecordKeys().catch(() => [])
      : [];

    const matchingKeys = keys.filter((key) => {
      if (!key.startsWith("api:")) return false;
      const keyPath = key.slice(4).split("?")[0];
      return keyPath === pathname;
    });

    for (const key of matchingKeys) {
      const cached = await getCachedRecords<any>(key).catch(() => null);
      if (Array.isArray(cached)) {
        await setCachedRecords(key, applyArrayMutation(cached, method, payload, mutationId, targetId));
      } else if (cached && typeof cached === "object" && Array.isArray(cached.logs)) {
        await setCachedRecords(key, {
          ...cached,
          logs: applyArrayMutation(cached.logs, method, payload, mutationId, targetId),
        });
      }
    }

    // Actualizar optimistamente las tareas clave del día si ya están cacheadas
    const tareasKey = "api:/api/dashboard/tareas-pendientes";
    const tareas = await getCachedRecords<any>(tareasKey).catch(() => null);
    if (tareas && typeof tareas === "object") {
      let dirty = false;
      const nextTareas = { ...tareas };

      if (pathname === "/api/produccion/huevos" && method === "POST") {
        nextTareas.eggCollectedToday = true;
        dirty = true;
      } else if (
        pathname === "/api/produccion/alimentacion/movimientos" &&
        method === "POST" &&
        payload.isEntry === false
      ) {
        nextTareas.feedMovedToday = true;
        dirty = true;
      } else if (
        pathname === "/api/operaciones/mantenimiento" &&
        method === "PUT" &&
        payload.status === "completado" &&
        targetId &&
        Array.isArray(nextTareas.maintenanceDue)
      ) {
        const filtered = nextTareas.maintenanceDue.filter((t: any) => t?.id !== targetId);
        if (filtered.length !== nextTareas.maintenanceDue.length) {
          nextTareas.maintenanceDue = filtered;
          nextTareas.maintenanceDueCount = Math.max(0, Number(nextTareas.maintenanceDueCount || 1) - 1);
          dirty = true;
        }
      } else if (pathname === "/api/sanidad/calendario" && targetId) {
        if (nextTareas.pendingSanitary?.id === targetId) {
          nextTareas.pendingSanitary = null;
          dirty = true;
        }
        if (Array.isArray(nextTareas.pendingSanitaryList)) {
          nextTareas.pendingSanitaryList = nextTareas.pendingSanitaryList.filter((s: any) => s?.id !== targetId);
          nextTareas.pendingSanitary = nextTareas.pendingSanitaryList[0] || null;
          dirty = true;
        }
      } else if (pathname === "/api/contactos" && method !== "DELETE" && nextTareas.setup) {
        if (!nextTareas.setup.contactsConfigured) {
          nextTareas.setup = { ...nextTareas.setup, contactsConfigured: true };
          dirty = true;
        }
      }

      if (dirty) {
        await setCachedRecords(tareasKey, nextTareas);
      }
    }

    if (pathname === "/api/contactos" && payload?.name) {
      const name = String(payload.name).trim();
      const role = String(payload.role || "cliente");
      const targetCategories =
        role === "ambos" ? ["comprador", "proveedor"] : role === "proveedor" ? ["proveedor"] : ["comprador"];
      for (const category of targetCategories) {
        const list = (await getCachedCatalog<any[]>(`catalog_${category}`).catch(() => null)) || [];
        const exists = list.some((item) => String(item?.value || "").trim().toLowerCase() === name.toLowerCase());
        if (!exists && method !== "DELETE") {
          const nextList = [
            ...list,
            { id: payload.id || `offline_${mutationId}_${category}`, category, value: name, isActive: payload.isActive !== false },
          ];
          await setCachedCatalog(`catalog_${category}`, nextList);
        }
      }
    }

    window.dispatchEvent(
      new CustomEvent(OFFLINE_QUEUED_EVENT, { detail: { endpoint, method, mutationId } }),
    );
  } catch {
    // Nunca fallar el guardado por un error de caché optimista
  }
}
