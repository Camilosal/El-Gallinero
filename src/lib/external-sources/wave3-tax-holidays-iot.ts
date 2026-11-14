import { desc, gte } from "drizzle-orm";
import { db } from "@/db";
import { sensorReadings } from "@/db/schema";
import { getExternalSyncConfig, getTaxAndFinanceDefaults } from "@/lib/settings";
import {
  fetchJsonWithTimeout,
  getExternalSnapshot,
  isSnapshotExpired,
  saveExternalSnapshot,
  type StoredExternalSnapshot,
} from "./snapshot-store";
import { syncWeatherSnapshot } from "./wave1-territory-weather-market";

export interface ColombianHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  localName: string;
  type: "fijo" | "emiliani" | "pascua";
}

function formatUtcIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function nextMondayEmiliani(year: number, month1Based: number, day: number): Date {
  const d = new Date(Date.UTC(year, month1Based - 1, day, 12, 0, 0));
  const dow = d.getUTCDay(); // 0 = Sun, 1 = Mon
  if (dow === 1) return d;
  const delta = dow === 0 ? 1 : 8 - dow;
  return addUtcDays(d, delta);
}

function easterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/**
 * Motor determinístico completo de Festivos Oficiales de Colombia (Ley 51 de 1983 / Ley Emiliani).
 */
export function getColombianHolidaysForYear(year: number): ColombianHoliday[] {
  const easter = easterSundayUtc(year);
  const list: ColombianHoliday[] = [
    { date: `${year}-01-01`, name: "New Year's Day", localName: "Año Nuevo", type: "fijo" },
    { date: formatUtcIso(nextMondayEmiliani(year, 1, 6)), name: "Epiphany", localName: "Día de los Reyes Magos", type: "emiliani" },
    { date: formatUtcIso(nextMondayEmiliani(year, 3, 19)), name: "Saint Joseph's Day", localName: "Día de San José", type: "emiliani" },
    { date: formatUtcIso(addUtcDays(easter, -3)), name: "Maundy Thursday", localName: "Jueves Santo", type: "pascua" },
    { date: formatUtcIso(addUtcDays(easter, -2)), name: "Good Friday", localName: "Viernes Santo", type: "pascua" },
    { date: `${year}-05-01`, name: "Labour Day", localName: "Día del Trabajo", type: "fijo" },
    { date: formatUtcIso(addUtcDays(easter, 43)), name: "Ascension Day", localName: "Ascensión del Señor", type: "pascua" },
    { date: formatUtcIso(addUtcDays(easter, 64)), name: "Corpus Christi", localName: "Corpus Christi", type: "pascua" },
    { date: formatUtcIso(addUtcDays(easter, 71)), name: "Sacred Heart", localName: "Sagrado Corazón de Jesús", type: "pascua" },
    { date: formatUtcIso(nextMondayEmiliani(year, 6, 29)), name: "Saint Peter and Saint Paul", localName: "San Pedro y San Pablo", type: "emiliani" },
    { date: `${year}-07-20`, name: "Independence Day", localName: "Día de la Independencia", type: "fijo" },
    { date: `${year}-08-07`, name: "Battle of Boyacá", localName: "Batalla de Boyacá", type: "fijo" },
    { date: formatUtcIso(nextMondayEmiliani(year, 8, 15)), name: "Assumption of Mary", localName: "Asunción de la Virgen", type: "emiliani" },
    { date: formatUtcIso(nextMondayEmiliani(year, 10, 12)), name: "Columbus Day", localName: "Día de la Raza", type: "emiliani" },
    { date: formatUtcIso(nextMondayEmiliani(year, 11, 1)), name: "All Saints' Day", localName: "Todos los Santos", type: "emiliani" },
    { date: formatUtcIso(nextMondayEmiliani(year, 11, 11)), name: "Independence of Cartagena", localName: "Independencia de Cartagena", type: "emiliani" },
    { date: `${year}-12-08`, name: "Immaculate Conception", localName: "Inmaculada Concepción", type: "fijo" },
    { date: `${year}-12-25`, name: "Christmas Day", localName: "Navidad", type: "fijo" },
  ];

  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function getColombianHolidaysInRange(fromIso: string, toIso: string): ColombianHoliday[] {
  const fromYear = Number(fromIso.slice(0, 4)) || new Date().getUTCFullYear();
  const toYear = Number(toIso.slice(0, 4)) || fromYear;
  const all: ColombianHoliday[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    all.push(...getColombianHolidaysForYear(y));
  }
  return all.filter((h) => h.date >= fromIso && h.date <= toIso);
}

export interface TaxHolidaysSnapshotPayload extends Record<string, unknown> {
  year: number;
  holidays: ColombianHoliday[];
  holidaysCount: number;
  nextHoliday: ColombianHoliday | null;
  uvtCop: number;
  retentionPurchases27UvtCop: number;
  retentionAgro92UvtCop: number;
  finagroIbrEaPct: number;
  finagroLines: Array<{ segment: string; rateNote: string; termNote: string }>;
}

export async function syncColombianTaxAndHolidaysSnapshot(
  options?: { year?: number; forceRefresh?: boolean },
): Promise<StoredExternalSnapshot<TaxHolidaysSnapshotPayload>> {
  const currentYear = options?.year || new Date().getUTCFullYear();
  const scopeKey = `year-${currentYear}`;

  const [existing, syncConfig, taxDefaults] = await Promise.all([
    getExternalSnapshot<TaxHolidaysSnapshotPayload>("colombia_tax_holidays", scopeKey),
    getExternalSyncConfig(),
    getTaxAndFinanceDefaults(),
  ]);

  if (!options?.forceRefresh && existing && !isSnapshotExpired(existing) && existing.payload.uvtCop === taxDefaults.uvtCop) {
    return existing;
  }

  let holidays = getColombianHolidaysForYear(currentYear);
  let status: "ok" | "fallback" = "fallback";
  let lastError: string | null = null;

  if (syncConfig.syncEnabled) {
    const res = await fetchJsonWithTimeout<Array<{ date?: string; name?: string; localName?: string }>>(
      `https://date.nager.at/api/v3/PublicHolidays/${currentYear}/CO`,
      3500,
    );
    if (res.ok && Array.isArray(res.data) && res.data.length >= 15) {
      status = "ok";
      const localMap = new Map(holidays.map((h) => [h.date, h]));
      const merged: ColombianHoliday[] = [];
      for (const item of res.data) {
        if (!item.date) continue;
        const existingLocal = localMap.get(item.date);
        merged.push({
          date: item.date,
          name: item.name || existingLocal?.name || "Public Holiday",
          localName: item.localName || existingLocal?.localName || item.name || "Festivo Nacional",
          type: existingLocal?.type || "emiliani",
        });
      }
      if (merged.length >= 15) {
        holidays = merged.sort((a, b) => a.date.localeCompare(b.date));
      }
    } else if (!res.ok) {
      lastError = res.error;
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const nextHoliday = holidays.find((h) => h.date >= todayIso) || holidays[0] || null;
  const uvtCop = taxDefaults.uvtCop;

  const payload: TaxHolidaysSnapshotPayload = {
    year: currentYear,
    holidays,
    holidaysCount: holidays.length,
    nextHoliday,
    uvtCop,
    retentionPurchases27UvtCop: Math.round(uvtCop * 27),
    retentionAgro92UvtCop: Math.round(uvtCop * 92),
    finagroIbrEaPct: taxDefaults.finagroIbrEaPct,
    finagroLines: [
      { segment: "Pequeño productor / Agricultura familiar", rateNote: "IBR - 2% a +2% E.A. (subsidio LEC)", termNote: "Capital de trabajo 24 meses / Inversión hasta 8 años" },
      { segment: "Mediano productor agropecuario", rateNote: `IBR + 1.5% a +3.5% E.A. (ref. ${taxDefaults.finagroIbrEaPct}%)`, termNote: "Galpones, equipo solar, automatización hasta 10 años" },
    ],
  };

  return saveExternalSnapshot({
    sourceKey: "colombia_tax_holidays",
    wave: 3,
    status,
    providerName: status === "ok" ? "Nager.Date Colombia + DIAN UVT / Finagro" : "Calendario Ley 51/83 + DIAN UVT / Finagro",
    sourceUrl: `https://date.nager.at/api/v3/PublicHolidays/${currentYear}/CO`,
    scopeKey,
    payload,
    summary: `${holidays.length} festivos CO ${currentYear} · UVT DIAN $${uvtCop.toLocaleString("es-CO")} · Tope agro 92 UVT ($${Math.round(uvtCop * 92).toLocaleString("es-CO")}) · Finagro ref. ${taxDefaults.finagroIbrEaPct}% E.A.`,
    ttlHours: 24 * 7,
    lastError,
  });
}

export interface IotBridgeSnapshotPayload extends Record<string, unknown> {
  webhookConfigured: boolean;
  webhookEndpoint: string;
  readingsLast24h: number;
  alertsLast24h: number;
  activeDevices: string[];
  latestReadingAt: string | null;
  maxIthLast24h: number | null;
  latestTempC: number | null;
}

export async function syncIotTelemetryStatusSnapshot(
  options?: { forceRefresh?: boolean },
): Promise<StoredExternalSnapshot<IotBridgeSnapshotPayload>> {
  const existing = await getExternalSnapshot<IotBridgeSnapshotPayload>("iot_telemetry_bridge");
  if (!options?.forceRefresh && existing && !isSnapshotExpired(existing)) {
    return existing;
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const recent = await db
    .select()
    .from(sensorReadings)
    .where(gte(sensorReadings.recordedAt, since))
    .orderBy(desc(sensorReadings.recordedAt))
    .limit(200);

  const devices = Array.from(new Set(recent.map((r) => r.deviceId).filter(Boolean)));
  const iths = recent
    .map((r) => (r.ithIndex != null ? Number(r.ithIndex) : r.metricType === "ith" ? Number(r.value) : null))
    .filter((v): v is number => v != null && Number.isFinite(v));
  const latestTemp = recent.find((r) => r.metricType === "temperatura");
  const webhookConfigured = Boolean(process.env.SENSOR_WEBHOOK_TOKEN?.trim());

  const payload: IotBridgeSnapshotPayload = {
    webhookConfigured,
    webhookEndpoint: "/api/operaciones/sensores",
    readingsLast24h: recent.length,
    alertsLast24h: recent.filter((r) => r.alertTriggered).length,
    activeDevices: devices,
    latestReadingAt: recent[0]?.recordedAt ? new Date(recent[0].recordedAt).toISOString() : null,
    maxIthLast24h: iths.length > 0 ? Math.max(...iths) : null,
    latestTempC: latestTemp ? Number(latestTemp.value) : null,
  };

  return saveExternalSnapshot({
    sourceKey: "iot_telemetry_bridge",
    wave: 3,
    status: recent.length > 0 || webhookConfigured ? "ok" : "fallback",
    providerName: "Puente IoT Sensores (HTTP Webhook / MQTT / Clima Bridge)",
    sourceUrl: "/api/operaciones/sensores",
    payload,
    summary: `${recent.length} lecturas (24h) · ${devices.length} dispositivo(s) · Webhook IoT ${webhookConfigured ? "activo" : "listo para token SENSOR_WEBHOOK_TOKEN"}`,
    ttlHours: 1,
  });
}

export async function bridgeWeatherToSensorReading(locationId?: string | null) {
  const weather = await syncWeatherSnapshot({ forceRefresh: true });
  const w = weather.payload;
  const triggered = w.currentIth >= 72;

  const [created] = await db
    .insert(sensorReadings)
    .values({
      locationId: locationId || null,
      batchId: null,
      deviceId: "open-meteo-bridge",
      metricType: "ith",
      value: w.currentIth.toFixed(2),
      unit: "ITH",
      ithIndex: w.currentIth.toFixed(2),
      alertTriggered: triggered,
      rawPayload: {
        source: weather.providerName,
        locationLabel: w.locationLabel,
        temperatureC: w.currentTempC,
        humidityPct: w.currentHumidityPct,
        ithIndex: w.currentIth,
      },
    })
    .returning();

  const statusSnap = await syncIotTelemetryStatusSnapshot({ forceRefresh: true });
  return { reading: created, statusSnap };
}
