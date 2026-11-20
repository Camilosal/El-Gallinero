"use client";

import { useEffect } from "react";
import { syncManager } from "@/lib/offline/syncManager";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV !== "production") {
        void navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        ).catch(() => {});
        void caches.keys().then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("gallinero-"))
              .map((key) => caches.delete(key)),
          ),
        ).catch(() => {});
        return;
      }

      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          // Registrar tag de background sync si el navegador lo soporta
          if ("sync" in registration && typeof (registration as any).sync?.register === "function") {
            (registration as any).sync.register("gallinero-sync").catch(() => {});
          }
        })
        .catch(console.error);

      // Escuchar eventos emitidos por el service worker
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === "GALLINERO_TRIGGER_SYNC") {
          void syncManager.syncPending();
        }
      };

      navigator.serviceWorker.addEventListener("message", messageHandler);
      return () => {
        navigator.serviceWorker.removeEventListener("message", messageHandler);
      };
    }
  }, []);

  return null;
}
