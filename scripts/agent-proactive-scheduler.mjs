// C1: scheduler del agente proactivo. Dispara el briefing diario a las 06:00
// America/Bogota (una vez por día) contra /api/cron/agente-proactivo con el
// mismo patrón de auth CRON_SECRET que scripts/external-sources-scheduler.mjs.
const target = process.env.AGENT_PROACTIVE_URL || "http://app:3000/api/cron/agente-proactivo";
const secret = process.env.CRON_SECRET || "";
const runHourBogota = Number(process.env.AGENT_PROACTIVE_HOUR_BOGOTA || 6);
let running = false;
let lastRunDateBogota = "";

function bogotaParts() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }).format(now),
  );
  return { date, hour };
}

async function runDailyBriefings() {
  if (!secret) {
    console.error("[agente-proactivo] CRON_SECRET no configurado; briefing programado desactivado.");
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
        console.info(`[agente-proactivo] ${new Date().toISOString()} ${body}`);
        return;
      } catch (error) {
        if (attempt === 4) throw error;
        const delayMs = Math.min(60_000, 10_000 * 2 ** attempt);
        console.warn(
          `[agente-proactivo] Intento ${attempt + 1} fallido; nuevo intento en ${delayMs / 1000}s:`,
          error instanceof Error ? error.message : error,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (error) {
    console.error("[agente-proactivo] No se completó el ciclo:", error instanceof Error ? error.message : error);
  } finally {
    running = false;
  }
}

// Chequeo cada minuto: ejecuta una sola vez por día calendario de Bogotá.
setInterval(() => {
  const { date, hour } = bogotaParts();
  if (hour === runHourBogota && lastRunDateBogota !== date) {
    lastRunDateBogota = date;
    void runDailyBriefings();
  }
}, 60_000);

console.info(
  `[agente-proactivo] Scheduler activo: briefing diario a las ${String(runHourBogota).padStart(2, "0")}:00 America/Bogota → ${target}`,
);