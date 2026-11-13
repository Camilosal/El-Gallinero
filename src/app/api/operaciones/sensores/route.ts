import { db } from "@/db";
import { sensorReadings, farmLocations } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, withErrorHandler, safeParseJson } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac-server";

export const dynamic = "force-dynamic";

const VALID_METRICS = new Set([
  "temperatura",
  "humedad",
  "ith",
  "amoniaco_ppm",
  "peso_bascula",
  "consumo_agua",
  "otro",
]);

export function computeIth(tempC: number, humidityPct: number): number {
  const hr = Math.max(0, Math.min(100, humidityPct));
  const ith = 1.8 * tempC + 32 - (0.55 - 0.0055 * hr) * (1.8 * tempC - 26);
  return Number(ith.toFixed(2));
}

export function evaluateSensorAlert(metricType: string, value: number, ithIndex: number | null): {
  triggered: boolean;
  reason: string | null;
} {
  if (ithIndex != null && ithIndex >= 72) {
    return {
      triggered: true,
      reason: ithIndex >= 78
        ? `Estrés calórico severo (ITH ${ithIndex} ≥ 78)`
        : `Alerta estrés calórico moderado (ITH ${ithIndex} ≥ 72)`,
    };
  }
  if (metricType === "amoniaco_ppm" && value >= 20) {
    return {
      triggered: true,
      reason: `Nivel crítico de amoníaco NH3 (${value} ppm ≥ 20 ppm): reforzar ventilación`,
    };
  }
  if (metricType === "temperatura" && (value > 32 || value < 10)) {
    return {
      triggered: true,
      reason: `Temperatura fuera de rango confortable (${value} °C)`,
    };
  }
  if (metricType === "humedad" && (value > 85 || value < 40)) {
    return {
      triggered: true,
      reason: `Humedad relativa fuera de rango (${value} %)`,
    };
  }
  if (metricType === "ith" && value >= 72) {
    return {
      triggered: true,
      reason: `Estrés calórico detectado (ITH ${value} ≥ 72)`,
    };
  }
  return { triggered: false, reason: null };
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  const metricType = searchParams.get("metricType");
  const onlyAlerts = searchParams.get("onlyAlerts") === "true";

  const conditions = [];
  if (locationId) conditions.push(eq(sensorReadings.locationId, locationId));
  if (metricType && VALID_METRICS.has(metricType)) conditions.push(eq(sensorReadings.metricType, metricType));
  if (onlyAlerts) conditions.push(eq(sensorReadings.alertTriggered, true));

  const [readings, locations] = await Promise.all([
    conditions.length > 0
      ? db.select().from(sensorReadings).where(and(...conditions)).orderBy(desc(sensorReadings.recordedAt)).limit(150)
      : db.select().from(sensorReadings).orderBy(desc(sensorReadings.recordedAt)).limit(150),
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
  ]);

  const locMap = new Map(locations.map((l) => [l.id, l.name]));
  const enriched = readings.map((r) => ({
    ...r,
    locationName: r.locationId ? locMap.get(r.locationId) || null : null,
  }));

  const activeAlerts = enriched.filter((r) => r.alertTriggered);
  const ithValues = enriched.map((r) => r.ithIndex != null ? Number(r.ithIndex) : r.metricType === "ith" ? Number(r.value) : null).filter((v): v is number => v != null && Number.isFinite(v));
  const nh3Values = enriched.filter((r) => r.metricType === "amoniaco_ppm").map((r) => Number(r.value)).filter(Number.isFinite);
  const latestScale = enriched.find((r) => r.metricType === "peso_bascula");

  return NextResponse.json({
    readings: enriched,
    summary: {
      totalReadings: enriched.length,
      alertCount: activeAlerts.length,
      maxIth: ithValues.length ? Math.max(...ithValues) : null,
      maxNh3Ppm: nh3Values.length ? Math.max(...nh3Values) : null,
      latestScaleKg: latestScale ? Number(latestScale.value) : null,
    },
  });
});

// Soporta sesión autenticada o webhook IoT con x-sensor-token (cuando SENSOR_WEBHOOK_TOKEN esté configurado)
export const POST = withErrorHandler(async (req: NextRequest) => {
  const configuredToken = process.env.SENSOR_WEBHOOK_TOKEN?.trim();
  const headerToken = req.headers.get("x-sensor-token")?.trim();
  const hasWebhookAuth = Boolean(configuredToken && headerToken && headerToken === configuredToken);

  if (!hasWebhookAuth) {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const denied = await requirePermission("production:write");
    if (denied) return denied;
  }

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload de sensor inválido" }, { status: 400 });
  }

  const deviceId = typeof body.deviceId === "string" && body.deviceId.trim()
    ? body.deviceId.trim().slice(0, 100)
    : "sensor-manual";

  const hasTemp = body.temperatureC !== undefined && body.temperatureC !== null && body.temperatureC !== "";
  const hasHumidity = body.humidityPct !== undefined && body.humidityPct !== null && body.humidityPct !== "";

  let metricType = typeof body.metricType === "string" ? body.metricType.trim() : "";
  if (!metricType) {
    if (hasTemp && hasHumidity) metricType = "ith";
    else if (hasTemp) metricType = "temperatura";
    else if (hasHumidity) metricType = "humedad";
  }
  if (!VALID_METRICS.has(metricType)) {
    return NextResponse.json({ error: "Tipo de métrica de sensor no válida" }, { status: 400 });
  }

  const tempVal = hasTemp ? Number(body.temperatureC) : null;
  const humVal = hasHumidity ? Number(body.humidityPct) : null;
  let ithIndex: number | null = body.ithIndex != null && body.ithIndex !== "" ? Number(body.ithIndex) : null;
  if (ithIndex == null && tempVal != null && humVal != null && Number.isFinite(tempVal) && Number.isFinite(humVal)) {
    ithIndex = computeIth(tempVal, humVal);
  }

  const rawValue = body.value !== undefined && body.value !== null && body.value !== ""
    ? Number(body.value)
    : metricType === "ith" && ithIndex != null
      ? ithIndex
      : metricType === "temperatura" && tempVal != null
        ? tempVal
        : metricType === "humedad" && humVal != null
          ? humVal
          : NaN;

  if (!Number.isFinite(rawValue)) {
    return NextResponse.json({ error: "Valor numérico de lectura requerido" }, { status: 400 });
  }

  const unitMap: Record<string, string> = {
    temperatura: "°C",
    humedad: "%",
    ith: "ITH",
    amoniaco_ppm: "ppm",
    peso_bascula: "kg",
    consumo_agua: "L",
    otro: "ud",
  };
  const unit = typeof body.unit === "string" && body.unit.trim() ? body.unit.trim().slice(0, 20) : unitMap[metricType];
  const alertEval = evaluateSensorAlert(metricType, rawValue, ithIndex);

  const [created] = await db.insert(sensorReadings).values({
    locationId: typeof body.locationId === "string" && body.locationId ? body.locationId : null,
    batchId: typeof body.batchId === "string" && body.batchId ? body.batchId : null,
    deviceId,
    metricType,
    value: rawValue.toFixed(3),
    unit,
    ithIndex: ithIndex != null && Number.isFinite(ithIndex) ? ithIndex.toFixed(2) : null,
    alertTriggered: alertEval.triggered,
    rawPayload: body as Record<string, unknown>,
  }).returning();

  return NextResponse.json(
    {
      reading: created,
      ithIndex,
      alertTriggered: alertEval.triggered,
      alertReason: alertEval.reason,
    },
    { status: 201 },
  );
});
