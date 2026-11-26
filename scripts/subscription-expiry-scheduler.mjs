import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_URL = "http://app:3000/api/cron/suscripciones-vencidas";
const INTERVAL_MS = 15 * 60_000;
const MAX_BATCHES = 10;

export async function runSubscriptionExpiryCycle({ target, secret, signal, fetcher = fetch, logger = console }) {
  let expired = 0;
  let remaining = 0;
  for (let batch = 0; batch < MAX_BATCHES && !signal.aborted; batch += 1) {
    const response = await fetcher(target, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
    });
    if (![200, 207].includes(response.status)) throw new Error(`Respuesta HTTP ${response.status}`);

    const result = await response.json();
    const validCount = (count) => Number.isSafeInteger(count) && count >= 0;
    if (
      !result || ![result.expired, result.failures, result.remaining].every(validCount) ||
      result.hasMore !== (result.remaining > 0) || result.ok !== (result.failures === 0) ||
      (response.status === 207) !== (result.failures > 0)
    ) {
      throw new Error("Resumen de vencimientos inválido");
    }
    expired += result.expired;
    remaining = result.remaining;
    if (result.failures > 0 || (result.hasMore && result.expired === 0)) {
      logger.warn(`[suscripciones-vencidas] vencidas=${expired} fallos=${result.failures} pendientes=${remaining}`);
      return;
    }
    if (!result.hasMore) break;
  }
  if (!signal.aborted) {
    const report = `[suscripciones-vencidas] vencidas=${expired} pendientes=${remaining}`;
    if (remaining > 0) logger.warn(report);
    else logger.info(report);
  }
}

async function main() {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) throw new Error("CRON_SECRET requerido");
  const target = new URL(process.env.SUBSCRIPTION_EXPIRY_URL || DEFAULT_URL);
  const internalHttp = target.protocol === "http:" && (
    (target.hostname === "app" && target.port === "3000") ||
    (process.env.NODE_ENV !== "production" && ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname))
  );
  if (
    (!internalHttp && target.protocol !== "https:") ||
    target.username || target.password || target.search || target.hash ||
    target.pathname !== "/api/cron/suscripciones-vencidas"
  ) throw new Error("URL de vencimientos inválida");

  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  const interval = Number(process.env.SUBSCRIPTION_EXPIRY_INTERVAL_MINUTES);
  const intervalMs = Number.isSafeInteger(interval) && interval >= 1 && interval <= 1440 ? interval * 60_000 : INTERVAL_MS;
  while (!controller.signal.aborted) {
    try {
      await runSubscriptionExpiryCycle({ target, secret, signal: controller.signal });
    } catch (error) {
      if (!controller.signal.aborted) console.error("[suscripciones-vencidas] No se completó el ciclo:", error.message);
    }
    await sleep(intervalMs, undefined, { signal: controller.signal }).catch((error) => {
      if (error.name !== "AbortError") throw error;
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
