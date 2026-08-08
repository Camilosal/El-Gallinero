import { db } from "@/db";
import { catalogos, hens, feedPrograms, feedInventory, feedMovements } from "@/db/schema";
import { eq, and, sql, or, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runFeedProgramCatchup, countHensByStageForDate } from "@/lib/feeding/runProgram";

export const dynamic = "force-dynamic";

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(dateStrValue: string, days: number): string {
  const d = new Date(dateStrValue + "T12:00:00");
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

/**
 * GET /api/alimentacion/prediccion
 * Proyección de stock por alimento: estima cuándo se agotará el inventario
 * según el consumo diario esperado (programas por etapa × gallinas actuales).
 *
 * Query params:
 * - days: horizonte de predicción en días (default: 30)
 *
 * Cada alimento devuelve:
 * - currentStockKg / dailyNeedKg: punto de partida y ritmo de consumo
 * - daysRemaining y outOfStockDate: cuándo se agota si no se repone
 * - projectedStock: evolución diaria del stock dentro del horizonte
 * - alertLevel: ok | bajo | critico | agotado | sin_programa
 * - suggestedOrderQty: compra sugerida (14 días de consumo)
 * - reorderDate: fecha sugerida para reponer antes de llegar al mínimo
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const horizonDays = parseInt(searchParams.get("days") || "30", 10);
  const safeHorizon = Math.min(Math.max(horizonDays, 1), 365);

  const today = new Date();
  const todayStr = dateStr(today);

  // Asegurar que stock y consumo estén al día
  await runFeedProgramCatchup();

  // 1. Consumo esperado por alimento (kg/día) según gallinas actuales por etapa
  const henCounts = await countHensByStageForDate(today);

  const programs = await db
    .select({
      feedId: feedPrograms.feedId,
      feedName: feedInventory.name,
      feedUnit: feedInventory.unit,
      currentStock: feedInventory.currentStock,
      minStock: feedInventory.minStock,
      costPerUnit: feedInventory.costPerUnit,
      stageCatalogoId: feedPrograms.stageCatalogoId,
      dailyAmountPerHen: feedPrograms.dailyAmountPerHen,
    })
    .from(feedPrograms)
    .leftJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id));

  const needByFeed: Record<
    string,
    {
      feedName: string;
      feedUnit: string;
      currentStockKg: number;
      minStockKg: number;
      costPerUnit: number;
      dailyNeedKg: number;
    }
  > = {};

  for (const p of programs) {
    if (!p.feedId) continue;
    const henCount = henCounts[p.stageCatalogoId] || 0;
    const gramsPerHen = Number(p.dailyAmountPerHen);
    const dailyKg = (gramsPerHen * henCount) / 1000;
    if (dailyKg <= 0) continue;

    if (!needByFeed[p.feedId]) {
      needByFeed[p.feedId] = {
        feedName: p.feedName || "",
        feedUnit: p.feedUnit || "kg",
        currentStockKg: Number(p.currentStock),
        minStockKg: Number(p.minStock),
        costPerUnit: Number(p.costPerUnit),
        dailyNeedKg: 0,
      };
    }
    needByFeed[p.feedId].dailyNeedKg += dailyKg;
  }

  // 2. Consumo real de los últimos 7 días (referencia de desviación)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = dateStr(sevenDaysAgo);

  const recentConsumption = await db
    .select({
      feedId: feedMovements.feedId,
      totalQty: sql<string>`coalesce(sum(${feedMovements.quantity}), 0)`,
    })
    .from(feedMovements)
    .leftJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
    .where(and(
      eq(feedMovements.isEntry, false),
      gte(feedMovements.date, sevenDaysAgoStr),
    ))
    .groupBy(feedMovements.feedId);

  const actual7dByFeed: Record<string, number> = {};
  for (const c of recentConsumption) {
    actual7dByFeed[c.feedId] = Number(c.totalQty);
  }

  // 3. Construir proyección diaria y métricas por alimento
  const REORDER_DAYS = 7; // días de stock de seguridad antes de reponer
  const SUGGESTED_COVERAGE_DAYS = 14; // compra sugerida para cubrir N días

  const predictions = [];
  const dailyProjection: { day: number; date: string; stocks: Record<string, number> }[] = [];

  for (const [feedId, data] of Object.entries(needByFeed)) {
    let stock = data.currentStockKg;
    const projected: { day: number; date: string; projectedStockKg: number }[] = [];
    let outOfStockDate: string | null = null;
    let daysRemaining: number | null = null;
    let reorderDate: string | null = null;

    const daily = data.dailyNeedKg;
    for (let i = 1; i <= safeHorizon; i++) {
      stock = Math.max(0, stock - daily);
      const dayDate = addDays(todayStr, i);
      projected.push({
        day: i,
        date: dayDate,
        projectedStockKg: Math.round(stock * 100) / 100,
      });
      if (outOfStockDate === null && stock === 0) {
        outOfStockDate = dayDate;
        daysRemaining = i;
      }
      if (reorderDate === null && stock < data.minStockKg) {
        reorderDate = dayDate;
      }
    }

    // Si nunca llega a 0 dentro del horizonte, queda como null (no se agota)
    let alertLevel: string;
    if (data.currentStockKg <= 0) {
      alertLevel = "agotado";
    } else if (daysRemaining === null) {
      alertLevel = daily <= 0 ? "sin_programa" : "ok";
    } else if (daysRemaining <= 3) {
      alertLevel = "critico";
    } else if (daysRemaining <= REORDER_DAYS) {
      alertLevel = "bajo";
    } else {
      alertLevel = "ok";
    }

    const expected7d = Math.round(daily * 7 * 100) / 100;
    const actual7d = actual7dByFeed[feedId] || 0;
    const suggestedOrderQty = Math.max(
      Math.round(daily * SUGGESTED_COVERAGE_DAYS * 100) / 100,
      Math.round(data.minStockKg * 100) / 100
    );

    predictions.push({
      feedId,
      feedName: data.feedName,
      feedUnit: data.feedUnit,
      currentStockKg: Math.round(data.currentStockKg * 100) / 100,
      dailyNeedKg: Math.round(daily * 100) / 100,
      minStockKg: Math.round(data.minStockKg * 100) / 100,
      costPerUnit: data.costPerUnit,
      daysRemaining,
      outOfStockDate,
      reorderDate,
      alertLevel,
      expected7d,
      actual7d,
      suggestedOrderQty,
      projectedStock: projected,
    });
  }

  // 4. Proyección agregada por día para la gráfica
  for (let i = 1; i <= safeHorizon; i++) {
    const dayDate = addDays(todayStr, i);
    const stocks: Record<string, number> = {};
    for (const p of predictions) {
      const entry = p.projectedStock.find((e) => e.day === i);
      if (entry) stocks[p.feedName] = entry.projectedStockKg;
    }
    dailyProjection.push({ day: i, date: dayDate, stocks });
  }

  // 5. Totales consolidados
  const totalDailyNeed = Object.values(needByFeed).reduce((s, d) => s + d.dailyNeedKg, 0);
  const totalStock = Object.values(needByFeed).reduce((s, d) => s + d.currentStockKg, 0);
  const criticalCount = predictions.filter((p) => p.alertLevel === "critico").length;
  const lowCount = predictions.filter((p) => p.alertLevel === "bajo").length;
  const outCount = predictions.filter((p) => p.alertLevel === "agotado").length;

  predictions.sort((a, b) => (a.alertLevel === b.alertLevel ? 0 : a.alertLevel === "critico" ? -1 : a.alertLevel === "bajo" && b.alertLevel !== "critico" ? -1 : 1));

  return NextResponse.json({
    days: safeHorizon,
    generatedAt: todayStr,
    summary: {
      totalFeeds: predictions.length,
      totalCurrentStockKg: Math.round(totalStock * 100) / 100,
      totalDailyNeedKg: Math.round(totalDailyNeed * 100) / 100,
      criticalCount,
      lowCount,
      outCount,
    },
    predictions,
    dailyProjection,
  });
}
