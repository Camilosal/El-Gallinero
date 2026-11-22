"use client";

import { useEffect, useState } from "react";

export const ACTIVE_FARM_META_STORAGE_KEY = "galli-active-farm-meta";
export const LAST_FARM_CODE_STORAGE_KEY = "galli-last-farm-code";
export const FARM_META_CHANGED_EVENT = "iwage-farm-meta-changed";

export interface ActiveFarmMeta {
  id: string;
  name: string | null;
  slug: string | null;
  code: string | null;
}

let inFlightMetaPromise: Promise<ActiveFarmMeta | null> | null = null;

function notifyFarmMetaChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FARM_META_CHANGED_EVENT));
  }
}

export function readCachedActiveFarmMeta(): ActiveFarmMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_FARM_META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveFarmMeta> & {
      farmId?: unknown;
      farmName?: unknown;
      farmSlug?: unknown;
      farmCode?: unknown;
    };
    const resolvedId =
      typeof parsed?.id === "string"
        ? parsed.id
        : typeof parsed?.farmId === "string"
          ? parsed.farmId
          : null;
    if (!resolvedId) return null;
    return {
      id: resolvedId,
      name:
        typeof parsed.name === "string"
          ? parsed.name
          : typeof parsed.farmName === "string"
            ? parsed.farmName
            : null,
      slug:
        typeof parsed.slug === "string"
          ? parsed.slug
          : typeof parsed.farmSlug === "string"
            ? parsed.farmSlug
            : null,
      code:
        typeof parsed.code === "string"
          ? parsed.code
          : typeof parsed.farmCode === "string"
            ? parsed.farmCode
            : null,
    };
  } catch {
    return null;
  }
}

export function writeCachedActiveFarmMeta(meta: ActiveFarmMeta) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ACTIVE_FARM_META_STORAGE_KEY,
      JSON.stringify({
        ...meta,
        farmId: meta.id,
        farmName: meta.name,
        farmSlug: meta.slug,
        farmCode: meta.code,
      }),
    );
    if (meta.code) {
      window.localStorage.setItem(LAST_FARM_CODE_STORAGE_KEY, meta.code);
    }
  } catch {
    // Ignore storage restrictions
  }
  notifyFarmMetaChanged();
}

export function clearCachedActiveFarmMeta() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_FARM_META_STORAGE_KEY);
  } catch {
    // Ignore storage restrictions
  }
  notifyFarmMetaChanged();
}

export async function fetchActiveFarmMeta(): Promise<ActiveFarmMeta | null> {
  if (typeof window === "undefined") return null;
  if (!inFlightMetaPromise) {
    inFlightMetaPromise = fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || typeof data.farmId !== "string") return null;
        const meta: ActiveFarmMeta = {
          id: data.farmId,
          name: typeof data.farmName === "string" ? data.farmName : null,
          slug: typeof data.farmSlug === "string" ? data.farmSlug : null,
          code: typeof data.farmCode === "string" ? data.farmCode : null,
        };
        writeCachedActiveFarmMeta(meta);
        return meta;
      })
      .catch(() => null)
      .finally(() => {
        inFlightMetaPromise = null;
      });
  }
  return inFlightMetaPromise;
}

export function useActiveFarmState(enabled = true): {
  meta: ActiveFarmMeta | null;
  resolved: boolean;
} {
  const [meta, setMeta] = useState<ActiveFarmMeta | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const cached = readCachedActiveFarmMeta();
    if (cached) {
      queueMicrotask(() => {
        if (active) setMeta(cached);
      });
    }

    const syncFromServerOrOffline = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        queueMicrotask(() => {
          if (active) setResolved(true);
        });
        return;
      }
      void fetchActiveFarmMeta().then((loaded) => {
        if (!active) return;
        if (loaded) setMeta(loaded);
        setResolved(true);
      });
    };

    const handleChange = () => {
      if (!active) return;
      setMeta(readCachedActiveFarmMeta());
    };

    syncFromServerOrOffline();
    window.addEventListener(FARM_META_CHANGED_EVENT, handleChange);
    return () => {
      active = false;
      window.removeEventListener(FARM_META_CHANGED_EVENT, handleChange);
    };
  }, [enabled]);

  return { meta, resolved };
}

export function useActiveFarmMeta(enabled = true): ActiveFarmMeta | null {
  return useActiveFarmState(enabled).meta;
}
