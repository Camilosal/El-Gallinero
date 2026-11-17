"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";

export type MasterSettingValues = Record<string, string>;

let cachedSettings: MasterSettingValues | null = null;
let cachedAt = 0;
let settingsRequest: Promise<MasterSettingValues> | null = null;
const SETTINGS_CACHE_TTL_MS = 30_000;
const settingsSubscribers = new Set<(values: MasterSettingValues) => void>();

function publishSettings(values: MasterSettingValues): void {
  for (const subscriber of settingsSubscribers) subscriber(values);
}

export async function loadMasterSettings(forceRefresh = false): Promise<MasterSettingValues> {
  if (!forceRefresh && cachedSettings && Date.now() - cachedAt < SETTINGS_CACHE_TTL_MS) return cachedSettings;
  if (!settingsRequest) {
    settingsRequest = apiFetch("/api/configuracion/parametros")
      .then((response) => (response.ok ? response.json() : []))
      .then((items: Array<{ key: string; value: string }>) => {
        cachedSettings = Object.fromEntries(items.map((item) => [item.key, item.value]));
        cachedAt = Date.now();
        publishSettings(cachedSettings);
        return cachedSettings;
      })
      .catch(() => cachedSettings || {})
      .finally(() => { settingsRequest = null; });
  }
  return settingsRequest;
}

export function invalidateMasterSettingsCache(): void {
  cachedSettings = null;
  cachedAt = 0;
  if (settingsSubscribers.size > 0) void loadMasterSettings(true);
}

export function useMasterSettings() {
  const [values, setValues] = useState<MasterSettingValues>(cachedSettings || {});
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    let active = true;
    const update = (loaded: MasterSettingValues) => {
      if (!active) return;
      setValues(loaded);
      setLoading(false);
    };
    settingsSubscribers.add(update);
    loadMasterSettings().then(update);
    return () => {
      active = false;
      settingsSubscribers.delete(update);
    };
  }, []);

  return { values, loading };
}
