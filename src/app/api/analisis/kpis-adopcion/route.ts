import { db } from "@/db";
import { getCurrentFarmId } from "@/db/tenant-context";
import {
  appSettings,
  broilerBatches,
  dailyClosures,
  eggProduction,
  farms,
  farmLocations,
  feedMovements,
  hens,
  mortalityRecords,
  sanitaryCalendar,
  transactions,
} from "@/db/schema";
import { and, eq, gte, inArray, gt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { todayColombiaIso } from "@/lib/date-validation";
import { PROGRESSIVE_CONFIG_SETTING_KEY } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export const ADOPTION_TELEMETRY_KEY = "telemetry.adoption_metrics";

interface CaptureSample {
  mode: string;
  durationSec: number;
  recordedAt: string;
}

interface AdoptionTelemetryState {
  onboardingDurationSec: number | null;
  onboardingCompletedAt: string | null;
  captureSamples: CaptureSample[];
}

function emptyTelemetry(): AdoptionTelemetryState {
  return {
    onboardingDurationSec: null,
    onboardingCompletedAt: null,
    captureSamples: [],
  };
}

function parseTelemetry(raw: string | undefined | null): AdoptionTelemetryState {
  if (!raw) return emptyTelemetry();
  try {
    const parsed = JSON.parse(raw) as Partial<AdoptionTelemetryState>;
    return {
      onboardingDurationSec:
        typeof parsed.onboardingDurationSec === "number" && Number.isFinite(parsed.onboardingDurationSec)
          ? parsed.onboardingDurationSec
          : null,
      onboardingCompletedAt:
        typeof parsed.onboardingCompletedAt === "string" ? parsed.onboardingCompletedAt : null,
      captureSamples: Array.isArray(parsed.captureSamples)
        ? parsed.captureSamples
            .filter(
              (s): s is CaptureSample =>
                Boolean(s) &&
                typeof s.mode === "string" &&
                typeof s.durationSec === "number" &&
                Number.isFinite(s.durationSec) &&
                s.durationSec > 0,
            )
            .slice(-100)
        : [],
    };
  } catch {
    return emptyTelemetry();
  }
}

function shiftIsoDays(baseIso: string, deltaDays: number): string {
  const dt = new Date(`${baseIso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export const POST = withApiHandler(async (req: NextRequest, user) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const type = String(body.type || "");
  if (type !== "onboarding" && type !== "capture") {
    return NextResponse.json({ error: "Tipo de telemetría inválido (onboarding | capture)." }, { status: 400 });
  }

  const rawDuration = Number(body.durationSec);
  if (!Number.isFinite(rawDuration) || rawDuration <= 0 || rawDuration > 3600) {
    return NextResponse.json({ error: "durationSec debe estar entre 1 y 3600." }, { status: 400 });
  }
  const durationSec = Math.round(rawDuration * 10) / 10;
  const farmId = getCurrentFarmId();

  const [existing] = await db
    .select()
    .from(appSettings)
    .where(and(eq(appSettings.farmId, farmId), eq(appSettings.key, ADOPTION_TELEMETRY_KEY)))
    .limit(1);

  const state = parseTelemetry(existing?.value);
  const nowIso = new Date().toISOString();

  if (type === "onboarding") {
    state.onboardingDurationSec = durationSec;
    state.onboardingCompletedAt = nowIso;
  } else {
    state.captureSamples = [
      ...state.captureSamples.slice(-99),
      {
        mode: String(body.mode || "general").slice(0, 40),
        durationSec,
        recordedAt: nowIso,
      },
    ];
  }

  await db
    .insert(appSettings)
    .values({
      farmId,
      key: ADOPTION_TELEMETRY_KEY,
      value: JSON.stringify(state),
      updatedBy: user?.id ?? null,
    })
    .onConflictDoUpdate({
      target: [appSettings.farmId, appSettings.key],
      set: {
        value: JSON.stringify(state),
        updatedBy: user?.id ?? null,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true, telemetry: state }, { status: 201 });
});

export const GET = withApiHandler(async () => {
  const farmId = getCurrentFarmId();
  const todayIso = todayColombiaIso();
  const cutoff7d = shiftIsoDays(todayIso, -6);
  const cutoff21d = shiftIsoDays(todayIso, -20);

  const [
    settingsRows,
    [farmRow],
    closures21d,
    eggs21d,
    feeds21d,
    morts21d,
    activeHensRows,
    activeBatchRows,
    activeSanitaryRows,
    txRows,
    activeLocationRows,
  ] = await Promise.all([
    db
      .select()
      .from(appSettings)
      .where(
        and(
          eq(appSettings.farmId, farmId),
          inArray(appSettings.key, [ADOPTION_TELEMETRY_KEY, PROGRESSIVE_CONFIG_SETTING_KEY]),
        ),
      ),
    db.select().from(farms).where(eq(farms.id, farmId)).limit(1),
    db
      .select({ closureDate: dailyClosures.closureDate, status: dailyClosures.status })
      .from(dailyClosures)
      .where(and(eq(dailyClosures.farmId, farmId), gte(dailyClosures.closureDate, cutoff21d))),
    db
      .select({ date: eggProduction.date })
      .from(eggProduction)
      .where(and(eq(eggProduction.farmId, farmId), gte(eggProduction.date, cutoff21d))),
    db
      .select({ date: feedMovements.date })
      .from(feedMovements)
      .where(and(eq(feedMovements.farmId, farmId), gte(feedMovements.date, cutoff21d))),
    db
      .select({ date: mortalityRecords.date })
      .from(mortalityRecords)
      .where(and(eq(mortalityRecords.farmId, farmId), gte(mortalityRecords.date, cutoff21d))),
    db
      .select({ id: hens.id, breed: hens.breed })
      .from(hens)
      .where(and(eq(hens.farmId, farmId), inArray(hens.status, ["activa", "empollando"]))),
    db
      .select({ id: broilerBatches.id, breed: broilerBatches.breed, species: broilerBatches.species })
      .from(broilerBatches)
      .where(
        and(
          eq(broilerBatches.farmId, farmId),
          inArray(broilerBatches.status, ["activo", "listo_sacrificio"]),
          gt(broilerBatches.currentQuantity, 0),
        ),
      ),
    db
      .select({ id: sanitaryCalendar.id, targetBirds: sanitaryCalendar.targetBirds })
      .from(sanitaryCalendar)
      .where(and(eq(sanitaryCalendar.farmId, farmId), eq(sanitaryCalendar.isActive, true))),
    db
      .select({ species: transactions.species, locationId: transactions.locationId })
      .from(transactions)
      .where(eq(transactions.farmId, farmId)),
    db
      .select({ id: farmLocations.id })
      .from(farmLocations)
      .where(and(eq(farmLocations.farmId, farmId), eq(farmLocations.status, "activa"))),
  ]);

  const telemetryRaw = settingsRows.find((r) => r.key === ADOPTION_TELEMETRY_KEY)?.value;
  const telemetry = parseTelemetry(telemetryRaw);

  const onboardingConfigRaw = settingsRows.find((r) => r.key === PROGRESSIVE_CONFIG_SETTING_KEY)?.value;
  let onboardingCompletedAtIso: string | null = telemetry.onboardingCompletedAt;
  if (!onboardingCompletedAtIso && onboardingConfigRaw) {
    try {
      const parsedCfg = JSON.parse(onboardingConfigRaw) as { completedAt?: string; onboardingCompletedAt?: string };
      onboardingCompletedAtIso = parsedCfg.onboardingCompletedAt || parsedCfg.completedAt || null;
    } catch {
      // ignore invalid JSON
    }
  }

  // 1. Time to Value (minutos desde inicio/registro hasta completar onboarding)
  let timeToValueMinutes: number | null = null;
  if (telemetry.onboardingDurationSec !== null) {
    timeToValueMinutes = Math.round((telemetry.onboardingDurationSec / 60) * 100) / 100;
  } else if (farmRow?.createdAt && onboardingCompletedAtIso) {
    const diffMs = new Date(onboardingCompletedAtIso).getTime() - new Date(farmRow.createdAt).getTime();
    if (Number.isFinite(diffMs) && diffMs >= 0) {
      timeToValueMinutes = Math.round((diffMs / 60000) * 100) / 100;
    }
  }

  // 2. Tiempo medio de captura en galpón
  const captureSamplesCount = telemetry.captureSamples.length;
  const avgFieldCaptureSeconds =
    captureSamplesCount > 0
      ? Math.round(
          (telemetry.captureSamples.reduce((sum, s) => sum + s.durationSec, 0) / captureSamplesCount) * 10,
        ) / 10
      : null;

  // 3. Adherencia semanal / 21 días (días con cierre cerrado o actividad diaria)
  const closedDays7 = new Set<string>();
  const activeDays7 = new Set<string>();
  const activeDays21 = new Set<string>();

  for (const c of closures21d) {
    if (c.status === "cerrado") {
      activeDays21.add(c.closureDate);
      if (c.closureDate >= cutoff7d) {
        closedDays7.add(c.closureDate);
        activeDays7.add(c.closureDate);
      }
    }
  }
  for (const row of [...eggs21d, ...feeds21d, ...morts21d]) {
    if (!row.date) continue;
    activeDays21.add(row.date);
    if (row.date >= cutoff7d) activeDays7.add(row.date);
  }

  const weeklyClosureDaysCount = closedDays7.size > 0 ? closedDays7.size : activeDays7.size;
  const weeklyClosureAdherencePct = Math.min(100, Math.round((weeklyClosureDaysCount / 7) * 100));
  const adherence21dPct = Math.min(100, Math.round((activeDays21.size / 21) * 100));

  // 4. Integridad sanitaria y genealógica/raza (% unidades activas con raza + cobertura sanitaria activa)
  const totalActiveUnits = activeHensRows.length + activeBatchRows.length;
  const hasSanitaryPlan = activeSanitaryRows.length > 0;
  let unitsWithIntegrity = 0;
  for (const h of activeHensRows) {
    if (Boolean(h.breed && h.breed.trim().length > 0) && hasSanitaryPlan) {
      unitsWithIntegrity += 1;
    }
  }
  for (const b of activeBatchRows) {
    if (Boolean(b.breed && b.breed.trim().length > 0) && hasSanitaryPlan) {
      unitsWithIntegrity += 1;
    }
  }
  const sanitaryAndGenealogyIntegrityPct =
    totalActiveUnits > 0 ? Math.round((unitsWithIntegrity / totalActiveUnits) * 100) : hasSanitaryPlan ? 100 : 0;

  // 5. Centros de costos analíticos activos (anti-subsidio cruzado)
  const costCenters = new Set<string>();
  const speciesSet = new Set<string>();
  for (const tx of txRows) {
    if (tx.species) speciesSet.add(tx.species);
    if (tx.species || tx.locationId) {
      costCenters.add(`${tx.species || "general"}:${tx.locationId || "general"}`);
    }
  }

  return NextResponse.json({
    farmId,
    timeToValueMinutes,
    avgFieldCaptureSeconds,
    captureSamplesCount,
    weeklyClosureAdherencePct,
    adherence21dPct,
    activeDays7: activeDays7.size,
    closedDays7: closedDays7.size,
    activeDays21: activeDays21.size,
    sanitaryAndGenealogyIntegrityPct,
    totalActiveUnits,
    activeSanitaryEventsCount: activeSanitaryRows.length,
    costCentersActiveCount: costCenters.size,
    distinctSpeciesWithTransactions: Array.from(speciesSet),
    activeLocationsCount: activeLocationRows.length,
  });
});
