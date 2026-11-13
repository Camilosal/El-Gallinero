import { AsyncLocalStorage } from "node:async_hooks";

export const DEFAULT_FARM_ID = "00000000-0000-0000-0000-000000000001";

interface TenantStore {
  farmId: string;
  enforceRls: boolean;
}

const farmStorage = new AsyncLocalStorage<TenantStore>();

export function getCurrentFarmId(): string {
  return farmStorage.getStore()?.farmId ?? DEFAULT_FARM_ID;
}

export function hasActiveFarmContext(): boolean {
  return Boolean(farmStorage.getStore()?.enforceRls);
}

/**
 * Ejecuta una operación delimitada a una granja específica activando RLS
 * en PostgreSQL (`app.current_farm_id` + rol no-superusuario).
 */
export function runWithFarmContext<T>(farmId: string, fn: () => Promise<T>): Promise<T> {
  const cleanId = String(farmId || DEFAULT_FARM_ID).trim() || DEFAULT_FARM_ID;
  return farmStorage.run({ farmId: cleanId, enforceRls: true }, fn);
}

