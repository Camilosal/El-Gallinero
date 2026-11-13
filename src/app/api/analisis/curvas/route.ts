import { db } from "@/db";
import { broilerBatches, catalogos, eggProduction, farmLocations, hens, weightLogs } from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { getStandardCurve, interpolateStandard } from "@/lib/standard-curves";
import { calibrateTargetForEnvironment } from "@/lib/zootechnics";

export const dynamic = "force-dynamic";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ageInWeeks(start: string | Date, end: string | Date): number {
  const startMs = new Date(`${isoDate(new Date(start))}T12:00:00`).getTime();
  const endMs = new Date(`${isoDate(new Date(end))}T12:00:00`).getTime();
  return Math.max(0, (endMs - startMs) / (7 * 86400000));
}

function performanceStatus(actual: number, min: number, max: number): "por_debajo" | "alineado" | "por_encima" {
  if (actual < min) return "por_debajo";
  if (actual > max) return "por_encima";
  return "alineado";
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const species = searchParams.get("species") || "gallina";
  const breed = searchParams.get("breed");
  const locationId = searchParams.get("locationId") || null;
  const baseCurve = getStandardCurve(species, breed);
  if (!baseCurve) return NextResponse.json({ error: "No hay una curva de referencia para esta especie" }, { status: 404 });

  const [selectedLoc] = locationId
    ? await db.select().from(farmLocations).where(eq(farmLocations.id, locationId)).limit(1)
    : [undefined];
  const envCal = calibrateTargetForEnvironment(
    species,
    selectedLoc?.altitudeMeters ?? null,
    selectedLoc?.floorType ?? null,
  );
  const curve = baseCurve.metric === "peso" && envCal.factor !== 1
    ? {
        ...baseCurve,
        points: baseCurve.points.map((pt) => ({
          ...pt,
          target: Math.round(pt.target * envCal.factor),
          min: Math.round(pt.min * envCal.factor),
          max: Math.round(pt.max * envCal.factor),
        })),
      }
    : baseCurve;

  const today = new Date();
  const todayStr = isoDate(today);
  const sevenDaysAgo = new Date(`${todayStr}T12:00:00`);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenDaysAgoStr = isoDate(sevenDaysAgo);

  const rawWeightLogs = await db.select({
    id: weightLogs.id,
    date: weightLogs.date,
    batchId: weightLogs.batchId,
    henGroup: weightLogs.henGroup,
    breed: weightLogs.breed,
    weekNumber: weightLogs.weekNumber,
    species: weightLogs.species,
    locationId: weightLogs.locationId,
    avgWeightKg: weightLogs.avgWeightKg,
    sampleSize: weightLogs.sampleSize,
    cvPercent: weightLogs.cvPercent,
    uniformityPct: weightLogs.uniformityPct,
    dailyGainG: weightLogs.dailyGainG,
    notes: weightLogs.notes,
    batchSpecies: broilerBatches.species,
    batchBreed: broilerBatches.breed,
    batchStartDate: broilerBatches.startDate,
    batchCode: broilerBatches.code,
  })
    .from(weightLogs)
    .leftJoin(broilerBatches, eq(weightLogs.batchId, broilerBatches.id))
    .orderBy(desc(weightLogs.date))
    .limit(500);

  const logs = rawWeightLogs
    .filter((log) => !locationId || log.locationId === locationId)
    .map((log) => {
      const logSpecies = log.species || log.batchSpecies || "gallina";
      const measuredAtWeeks = log.weekNumber != null
        ? Number(log.weekNumber)
        : log.batchStartDate
          ? ageInWeeks(log.batchStartDate, log.date)
          : null;
      return {
        id: log.id,
        date: log.date,
        species: logSpecies,
        breed: log.breed || log.batchBreed || "",
        batchId: log.batchId,
        batchCode: log.batchCode,
        henGroup: log.henGroup,
        week: measuredAtWeeks,
        avgWeightKg: Number(log.avgWeightKg || 0),
        avgWeightG: Number(log.avgWeightKg || 0) * 1000,
        sampleSize: log.sampleSize || 1,
        cvPercent: log.cvPercent != null ? Number(log.cvPercent) : null,
        uniformityPct: log.uniformityPct != null ? Number(log.uniformityPct) : null,
        dailyGainG: log.dailyGainG != null ? Number(log.dailyGainG) : null,
        notes: log.notes,
      };
    })
    .filter((log) => log.species === species && log.week != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  let comparison: Record<string, unknown> | null = null;
  let actualPoints: { week: number; actual: number; date: string; count: number }[] = [];

  if (species === "gallina") {
    const [productiveStages, activeHens, recentEggSummary] = await Promise.all([
      db.select({ minWeeks: catalogos.minWeeks, maxWeeks: catalogos.maxWeeks })
        .from(catalogos)
        .where(and(
          eq(catalogos.category, "etapa_crecimiento"),
          eq(catalogos.isActive, true),
          sql`coalesce(${catalogos.expectedEggsPerHen}, 0) > 0`,
        )),
      db.select({ birthDate: hens.birthDate }).from(hens).where(eq(hens.status, "activa")),
      db.select({
        total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int`,
        days: sql<number>`count(distinct ${eggProduction.date})::int`,
      }).from(eggProduction).where(and(
        eq(eggProduction.species, "gallina"),
        gte(eggProduction.date, sevenDaysAgoStr),
        lte(eggProduction.date, todayStr),
      )),
    ]);

    const layerAges = activeHens
      .map((hen) => ageInWeeks(hen.birthDate, today))
      .filter((week) => productiveStages.some((stage) =>
        week >= (stage.minWeeks ?? 0) && (stage.maxWeeks == null || week < stage.maxWeeks),
      ));
    const layerCount = layerAges.length;
    const averageAgeWeeks = layerCount > 0
      ? layerAges.reduce((sum, week) => sum + week, 0) / layerCount
      : null;
    const eggs = Number(recentEggSummary[0]?.total || 0);
    const collectionDays = Number(recentEggSummary[0]?.days || 0);
    const actualRate = layerCount > 0 && collectionDays > 0
      ? eggs / (layerCount * collectionDays) * 100
      : null;
    const target = averageAgeWeeks == null ? null : interpolateStandard(curve, averageAgeWeeks);

    if (averageAgeWeeks != null && actualRate != null && target) {
      comparison = {
        week: averageAgeWeeks,
        actual: actualRate,
        target: target.target,
        min: target.min,
        max: target.max,
        variancePercent: target.target > 0 ? ((actualRate - target.target) / target.target) * 100 : null,
        status: performanceStatus(actualRate, target.min, target.max),
        date: todayStr,
        eligibleAnimals: layerCount,
        eggsLastSevenDays: eggs,
        collectionDays,
      };
      actualPoints = [{ week: averageAgeWeeks, actual: actualRate, date: todayStr, count: layerCount }];
    } else {
      comparison = {
        week: averageAgeWeeks,
        actual: actualRate,
        target: target?.target ?? null,
        min: target?.min ?? null,
        max: target?.max ?? null,
        variancePercent: null,
        status: "sin_datos",
        date: todayStr,
        eligibleAnimals: layerCount,
        eggsLastSevenDays: eggs,
        collectionDays,
      };
    }
  } else {
    actualPoints = logs.map((log) => ({
      week: log.week!,
      actual: log.avgWeightG,
      date: log.date,
      count: log.sampleSize,
    }));
    const latest = [...logs].reverse().find((log) => log.avgWeightG > 0);
    if (latest?.week != null) {
      const target = interpolateStandard(curve, latest.week);
      if (target) {
        comparison = {
          week: latest.week,
          actual: latest.avgWeightG,
          target: target.target,
          min: target.min,
          max: target.max,
          variancePercent: target.target > 0 ? ((latest.avgWeightG - target.target) / target.target) * 100 : null,
          status: performanceStatus(latest.avgWeightG, target.min, target.max),
          date: latest.date,
          eligibleAnimals: latest.sampleSize,
          batchCode: latest.batchCode,
        };
      }
    }
  }

  const latestMetrics = [...logs].reverse().find((l) => l.cvPercent != null || l.dailyGainG != null);
  return NextResponse.json({
    curve,
    logs,
    actualPoints,
    comparison,
    environmentAdjustment: {
      locationName: selectedLoc?.name || null,
      ...envCal,
    },
    zootechnics: latestMetrics
      ? {
          cvPercent: latestMetrics.cvPercent,
          uniformityPct: latestMetrics.uniformityPct,
          dailyGainG: latestMetrics.dailyGainG,
        }
      : null,
  });
});
