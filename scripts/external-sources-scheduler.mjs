const target = process.env.EXTERNAL_SOURCES_SYNC_URL || "http://app:3000/api/cron/fuentes-externas";
const secret = process.env.CRON_SECRET || "";
const configuredInterval = Number(process.env.EXTERNAL_SOURCES_SYNC_INTERVAL_MINUTES || 60);
const intervalMinutes = Number.isFinite(configuredInterval) ? Math.max(5, configuredInterval) : 60;
let running = false;

async function syncDueSources() {
  if (!secret) {
    console.error("[fuentes-externas] CRON_SECRET no configurado; sincronización programada desactivada.");
    return;
  }
  if (running) return;
  running = true;
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);
      try {
        const response = await fetch(target, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
          signal: controller.signal,
        });
        const body = await response.text();
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
        try {
          const result = JSON.parse(body);
          if (result?.ok === false) {
            const failureCount = Number(result.sourceFailures || 0);
            console.warn(`[fuentes-externas] ${failureCount} fuentes fallaron; se reintentarán en el siguiente intervalo.`);
          }
        } catch (error) {
          if (error instanceof SyntaxError) {
            console.warn("[fuentes-externas] La respuesta no contiene resumen JSON parseable.");
          } else {
            throw error;
          }
        }
        console.info(`[fuentes-externas] ${new Date().toISOString()} ${body}`);
        return;
      } catch (error) {
        if (attempt === 4) throw error;
        const delayMs = Math.min(30_000, 5_000 * 2 ** attempt);
        console.warn(`[fuentes-externas] Intento ${attempt + 1} fallido; nuevo intento en ${delayMs / 1000}s:`, error instanceof Error ? error.message : error);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (error) {
    console.error("[fuentes-externas] No se completó el ciclo:", error instanceof Error ? error.message : error);
  } finally {
    running = false;
  }
}

setTimeout(() => {
  void syncDueSources();
  setInterval(() => void syncDueSources(), intervalMinutes * 60 * 1000);
}, 30_000);
