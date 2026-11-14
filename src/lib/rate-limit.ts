import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  expiresAt: number;
}

const bucketsByNamespace = new Map<string, Map<string, Bucket>>();

/**
 * Extrae la IP de cliente considerando proxies inversos habituales.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "local";
  return forwarded.split(",")[0].trim().slice(0, 100) || "local";
}

/**
 * Evalúa si la petición debe ser limitada por tasa.
 * En `NODE_ENV === "test"` solo aplica cuando `x-enforce-rate-limit` es `"1"`.
 */
export function isRequestRateLimited(
  req: NextRequest,
  options: {
    namespace: string;
    key?: string;
    windowMs?: number;
    maxAttempts?: number;
  },
): boolean {
  if (process.env.NODE_ENV === "test" && req.headers.get("x-enforce-rate-limit") !== "1") {
    return false;
  }

  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const maxAttempts = options.maxAttempts ?? 10;
  const key = options.key || getClientIp(req);
  const now = Date.now();

  let store = bucketsByNamespace.get(options.namespace);
  if (!store) {
    store = new Map();
    bucketsByNamespace.set(options.namespace, store);
  }

  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }

  const current = store.get(key);
  if (current && current.expiresAt > now && current.count >= maxAttempts) {
    return true;
  }

  store.set(
    key,
    current && current.expiresAt > now
      ? { count: current.count + 1, expiresAt: current.expiresAt }
      : { count: 1, expiresAt: now + windowMs },
  );
  return false;
}

/** Limpia los contadores en memoria (útil en pruebas unitarias). */
export function resetRateLimits(namespace?: string): void {
  if (namespace) {
    bucketsByNamespace.delete(namespace);
    return;
  }
  bucketsByNamespace.clear();
}
