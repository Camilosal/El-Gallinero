import { db } from "@/db";
import { hens, eggProduction, sanitaryCalendar, weightLogs, breedWeightStandards, catalogos, broilerBatches } from "@/db/schema";
import { eq, sql, and, lt, gte, desc, inArray, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ageInWeeks } from "@/lib/lifecycle";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { evaluateHarvestWindowWarning } from "@/lib/micro-insights";

export const dynamic = "force-dynamic";

interface Alert {
  type: "feed_change" | "point_of_lay" | "overdue_vaccination" | "production_drop" | "weight_deviation" | "harvest_window";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  date: string;
  birdGroup?: string;
}

export const GET = withApiHandler(async () => {
  const alerts: Alert[] = [];
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // 1. Point of lay: hens 16-20 weeks old, status activa
  const allHens = await db.select({ id: hens.id, birthDate: hens.birthDate, status: hens.status }).from(hens);
  const approachingLay = allHens.filter((h) => {
    if (h.status !== "activa") return false;
    const weeks = ageInWeeks(h.birthDate, today);
    return weeks >= 14 && weeks <= 20;
  });
  if (approachingLay.length > 0) {
    alerts.push({
      type: "point_of_lay",
      severity: "info",
      title: `${approachingLay.length} gallinas próximas a postura`,
      message: `Edad 14-20 semanas: preparar alimentación de postura y nidos`,
      date: todayStr,
    });
  }

  // 2. Feed change alerts: hens near stage boundaries
  const stages = await db
    .select()
    .from(catalogos)
    .where(eq(catalogos.category, "etapa_crecimiento"))
    .orderBy(catalogos.minWeeks);

  for (const stage of stages) {
    if (stage.maxWeeks == null) continue;
    const hensNearBoundary = allHens.filter((h) => {
      if (h.status !== "activa") return false;
      const weeks = ageInWeeks(h.birthDate, today);
      return weeks >= stage.maxWeeks! - 2 && weeks <= stage.maxWeeks! + 1;
    });
    if (hensNearBoundary.length > 0) {
      alerts.push({
        type: "feed_change",
        severity: "warning",
        title: `Transición de alimentación próxima`,
        message: `${hensNearBoundary.length} gallinas cerca de cambiar de etapa (${stage.value}, ${stage.maxWeeks} sem)`,
        date: todayStr,
        birdGroup: stage.value,
      });
    }
  }

  // 3. Overdue vaccinations
  const overdue = await db
    .select()
    .from(sanitaryCalendar)
    .where(and(
      eq(sanitaryCalendar.isActive, true),
      eq(sanitaryCalendar.type, "vacunacion"),
      lt(sanitaryCalendar.nextDueDate, todayStr)
    ));

  for (const v of overdue) {
    const dueDate = new Date(v.nextDueDate + "T12:00:00");
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
    alerts.push({
      type: "overdue_vaccination",
      severity: daysOverdue > 14 ? "critical" : "warning",
      title: `${v.name} vencida`,
      message: `${daysOverdue} días de retraso`,
      date: v.nextDueDate,
      birdGroup: v.targetBirds || undefined,
    });
  }

  // 4. Production drop: compare last 7 days vs previous 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const sevenStr = sevenDaysAgo.toISOString().split("T")[0];
  const fourteenStr = fourteenDaysAgo.toISOString().split("T")[0];

  const [recentRow] = await db
    .select({ total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int` })
    .from(eggProduction)
    .where(gte(eggProduction.date, sevenStr));

  const [prevRow] = await db
    .select({ total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int` })
    .from(eggProduction)
    .where(and(gte(eggProduction.date, fourteenStr), lt(eggProduction.date, sevenStr)));

  const recentTotal = recentRow?.total || 0;
  const prevTotal = prevRow?.total || 0;
  if (prevTotal > 0) {
    const dropPercent = ((prevTotal - recentTotal) / prevTotal) * 100;
    if (dropPercent > 20) {
      alerts.push({
        type: "production_drop",
        severity: dropPercent > 40 ? "critical" : "warning",
        title: `Caída de producción: ${dropPercent.toFixed(0)}%`,
        message: `${prevTotal} → ${recentTotal} huevos (últimos 7 días vs anteriores)`,
        date: todayStr,
      });
    }
  }

  // 5. Weight deviation: latest weight log vs breed standard
  const latestWeights = await db
    .select()
    .from(weightLogs)
    .orderBy(desc(weightLogs.date))
    .limit(10);

  for (const w of latestWeights) {
    if (!w.breed || w.weekNumber == null) continue;
    const standards = await db
      .select()
      .from(breedWeightStandards)
      .where(and(
        eq(breedWeightStandards.breed, w.breed),
        eq(breedWeightStandards.weekNumber, w.weekNumber)
      ))
      .limit(1);

    if (standards.length === 0) continue;
    if (!w.avgWeightKg) continue;
    const std = standards[0];
    const actualG = parseFloat(w.avgWeightKg) * 1000;
    const targetG = parseFloat(std.targetWeightG);
    const deviation = Math.abs(actualG - targetG) / targetG;

    if (deviation > 0.15) {
      alerts.push({
        type: "weight_deviation",
        severity: deviation > 0.25 ? "critical" : "warning",
        title: `Desviación de peso: ${(deviation * 100).toFixed(0)}%`,
        message: `${w.breed} semana ${w.weekNumber}: ${actualG.toFixed(0)}g vs objetivo ${targetG.toFixed(0)}g`,
        date: w.date,
        birdGroup: w.henGroup || undefined,
      });
    }
  }

  // 6. Ventana óptima de sacrificio / venta (lotes de carne)
  const activeBatches = await db
    .select({
      code: broilerBatches.code,
      species: broilerBatches.species,
      startDate: broilerBatches.startDate,
    })
    .from(broilerBatches)
    .where(and(inArray(broilerBatches.status, ["activo", "listo_sacrificio"]), gt(broilerBatches.currentQuantity, 0)));

  const todayMs = Date.now();
  for (const b of activeBatches) {
    const startMs = new Date(`${b.startDate}T00:00:00Z`).getTime();
    const ageDays = Number.isFinite(startMs) ? Math.max(0, Math.floor((todayMs - startMs) / 86400000)) : 0;
    const hw = evaluateHarvestWindowWarning({ species: b.species, ageDays, code: b.code });
    if (hw) {
      alerts.push({
        type: "harvest_window",
        severity: hw.severity,
        title: hw.title,
        message: hw.message,
        date: todayStr,
        birdGroup: b.code,
      });
    }
  }

  return NextResponse.json(alerts);
});
