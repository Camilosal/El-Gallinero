"use client";

import { useEffect, useState, useCallback } from "react";
import { syncManager, SyncStatusEventDetail } from "./syncManager";
import {
  OfflineMirrorState,
  getOfflineMirrorState,
  subscribeOfflineMirror,
  syncFullOfflineCopy,
} from "./offlineMirror";
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
  const [mirrorState, setMirrorState] = useState<OfflineMirrorState>(() => getOfflineMirrorState());

  const refreshOutbox = useCallback(async () => {
    try {
      const items = await getAllOutboxMutations();
      setOutboxItems(items);
    } catch (err) {
      console.error("Error al obtener elementos de outbox", err);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Suscribirse a cambios de estado de syncManager y de la copia offline
    const unsubscribe = syncManager.subscribe((newStatus) => {
      if (!active) return;
      setStatus(newStatus);
      void refreshOutbox();
    });
    const unsubscribeMirror = subscribeOfflineMirror((newMirrorState) => {
      if (active) setMirrorState(newMirrorState);
    });

    void getAllOutboxMutations()
      .then((items) => {
        if (active) setOutboxItems(items);
      })
      .catch((err) => {
        console.error("Error al obtener elementos de outbox", err);
      });

    return () => {
      active = false;
      unsubscribe();
      unsubscribeMirror();
    };
  }, [refreshOutbox]);

  const syncNow = useCallback(async () => {
    const res = await syncManager.syncPending();
    await refreshOutbox();
    return res;
  }, [refreshOutbox]);

  const saveOfflineCopy = useCallback(async () => {
    return syncFullOfflineCopy({ force: true });
  }, []);

  const discardItem = useCallback(
    async (id: string) => {
      await removeOutboxMutation(id);
      await refreshOutbox();
    },
    [refreshOutbox]
  );

  return {
    ...status,
    mirrorState,
    outboxItems,
    syncNow,
    saveOfflineCopy,
    discardItem,
    refreshOutbox,
    executeMutation: syncManager.executeMutation.bind(syncManager),
    getCachedCatalog,
    setCachedCatalog,
    getCachedRecords,
    setCachedRecords,
  };
}
