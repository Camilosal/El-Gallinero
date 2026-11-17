"use client";

/**
 * Telemetría de adopción (KPIs del Plan Maestro §8) con cola offline.
 * Las muestras de captura y la duración del onboarding se envían a
 * /api/analisis/kpis-adopcion; si no hay red, se encolan en localStorage
 * (metadatos no sensibles: modo + duración + fecha) y se vacían al
 * recuperar conexión o al completar una sincronización.
 */

const QUEUE_KEY = "gallinero_adoption_telemetry_v1";
const MAX_QUEUE = 200;

export interface AdoptionCaptureSample {
  mode: string;
  durationSec: number;
  recordedAt: string;
}

interface QueuedTelemetry {
  type: "capture" | "onboarding";
  mode?: string;
  durationSec: number;
  recordedAt: string;
}

function readQueue(): QueuedTelemetry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as QueuedTelemetry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedTelemetry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
  } catch {
    // almacenamiento lleno o bloqueado: la telemetría nunca debe romper la captura
  }
}

function enqueue(item: QueuedTelemetry): void {
  writeQueue([...readQueue(), item]);
}

async function postTelemetry(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/analisis/kpis-adopcion", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Registra una muestra de duración de captura rápida (online u offline). */
export function trackAdoptionSample(mode: string, durationSec: number): void {
  if (typeof window === "undefined") return;
  const safeDuration = Math.max(1, Math.min(3600, Math.round(durationSec)));
  const sample: AdoptionCaptureSample = {
    mode: String(mode || "general").slice(0, 40),
    durationSec: safeDuration,
    recordedAt: new Date().toISOString(),
  };
  if (navigator.onLine) {
    void postTelemetry({ type: "capture", ...sample }).then((ok) => {
      if (!ok) enqueue({ type: "capture", ...sample });
    });
  } else {
    enqueue({ type: "capture", ...sample });
  }
}

/** Registra la duración del wizard Día 1 al completarse (no al descartarse). */
export function trackOnboardingCompletion(durationSec: number): void {
  if (typeof window === "undefined") return;
  const safeDuration = Math.max(1, Math.min(3600, Math.round(durationSec)));
  const item: QueuedTelemetry = {
    type: "onboarding",
    durationSec: safeDuration,
    recordedAt: new Date().toISOString(),
  };
  if (navigator.onLine) {
    void postTelemetry({ type: "onboarding", durationSec: safeDuration }).then((ok) => {
      if (!ok) enqueue(item);
    });
  } else {
    enqueue(item);
  }
}

/** Vacía la cola local enviando las muestras en lote (deduplica el servidor). */
export async function flushAdoptionTelemetry(): Promise<number> {
  if (typeof window === "undefined" || !navigator.onLine) return 0;
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const samples = queue
    .filter((item) => item.type === "capture")
    .map(({ mode, durationSec, recordedAt }) => ({ mode: mode || "general", durationSec, recordedAt }));
  const onboarding = queue.filter((item) => item.type === "onboarding").slice(-1)[0];

  let flushed = 0;
  if (samples.length > 0) {
    const ok = await postTelemetry({ type: "capture", samples: samples.slice(0, MAX_QUEUE) });
    if (!ok) return 0;
    flushed += samples.length;
  }
  if (onboarding) {
    const ok = await postTelemetry({ type: "onboarding", durationSec: onboarding.durationSec });
    if (!ok) return flushed;
    flushed += 1;
  }
  writeQueue([]);
  return flushed;
}