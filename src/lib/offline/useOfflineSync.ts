"use client";

import { useEffect, useState, useCallback } from "react";
import { syncManager, SyncStatusEventDetail } from "./syncManager";
import {
  OutboxMutation,
  getAllOutboxMutations,
  removeOutboxMutation,
  getCachedCatalog,
  setCachedCatalog,
  getCachedRecords,
  setCachedRecords,
} from "./db";

export function useOfflineSync() {
  const [status, setStatus] = useState<SyncStatusEventDetail>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    syncError: null,
  });
  const [outboxItems, setOutboxItems] = useState<OutboxMutation[]>([]);

  const refreshOutbox = useCallback(async () => {
    try {
      const items = await getAllOutboxMutations();
      setOutboxItems(items);
    } catch (err) {
      console.error("Error al obtener elementos de outbox", err);
    }
  }, []);

  useEffect(() => {
    // Suscribirse a cambios de estado de syncManager
    const unsubscribe = syncManager.subscribe((newStatus) => {
      setStatus(newStatus);
      void refreshOutbox();
    });

    void refreshOutbox();

    return () => {
      unsubscribe();
    };
  }, [refreshOutbox]);

  const syncNow = useCallback(async () => {
    const res = await syncManager.syncPending();
    await refreshOutbox();
    return res;
  }, [refreshOutbox]);

  const discardItem = useCallback(
    async (id: string) => {
      await removeOutboxMutation(id);
      await refreshOutbox();
    },
    [refreshOutbox]
  );

  return {
    ...status,
    outboxItems,
    syncNow,
    discardItem,
    refreshOutbox,
    executeMutation: syncManager.executeMutation.bind(syncManager),
    getCachedCatalog,
    setCachedCatalog,
    getCachedRecords,
    setCachedRecords,
  };
}
