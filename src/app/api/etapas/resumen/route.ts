import { db } from "@/db";
import { catalogos, hens, feedPrograms, feedInventory, feedMovements } from "@/db/schema";
import { eq, and, sql, or, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runFeedProgramCatchup } from "@/lib/feeding/runProgram";

export const dynamic = "force-dynamic";

/**
 * Resumen correlacionado: stock necesario, consumo esperado y producción de huevos
 * calculados automáticamente según la cantidad de gallinas por etapa.
 * 
 * Query params:
 * - days: número de días para calcular stock mínimo automático (ej: 7, 14, 30)
 */
export async function GET(req?: NextRequest) {
  const url = req?.url ? new URL(req.url) : new URL("http://localhost/api/etapas/resumen");
  const daysParam = url.searchParams.get("days");
  const stockDays = daysParam ? parseInt(daysParam, 10) : null;
  const today = new Date();

  // Ejecutar el programa hasta hoy para que inventario y consumo estén al día
  await runFeedProgramCatchup();

  // 1. Obtener todas las etapas activas
  const stages = await db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
    .orderBy(sql`${catalogos.sortOrder}`);

  // 2. Para cada etapa, contar gallinas y calcular métricas
  const stageMetrics = [];
  const feedNeedsAggregated: Record<string, { feedName: string; feedUnit: string; dailyGrams: number; currentStock: string; costPerUnit: string }> = {};
  let totalExpectedEggs = 0;
  let totalHens = 0;

  for (const stage of stages) {
    const minWeeks = stage.minWeeks ?? 0;
    const maxWeeks = stage.maxWeeks;
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - minWeeks * 7);

    let countResult;
    if (maxWeeks === null) {
      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            or(eq(hens.status, "activa"), eq(hens.status, "empollando"), eq(hens.status, "recomendada_sacrificio"))
          )
        );
    } else {
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() - maxWeeks * 7);
      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            sql`${hens.birthDate}::date > ${maxDate.toISOString().split("T")[0]}::date`,
            or(eq(hens.status, "activa"), eq(hens.status, "empollando"), eq(hens.status, "recomendada_sacrificio"))
          )
        );
    }

    const henCount = countResult?.[0]?.count ?? 0;
    totalHens += henCount;

    // Programa alimenticio de esta etapa
    const programs = await db
      .select({
        id: feedPrograms.id,
        feedId: feedPrograms.feedId,
        feedName: feedInventory.name,
        feedUnit: feedInventory.unit,
        percentage: feedPrograms.percentage,
        dailyAmountPerHen: feedPrograms.dailyAmountPerHen,
        currentStock: feedInventory.currentStock,
        costPerUnit: feedInventory.costPerUnit,
      })
      .from(feedPrograms)
      .leftJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id))
      .where(eq(feedPrograms.stageCatalogoId, stage.id));

    // Calcular consumo diario total para esta etapa
    const dailyFeedPerFeed = programs.map((p) => {
      const gramsPerHen = Number(p.dailyAmountPerHen);
      const dailyGrams = gramsPerHen * henCount;
      return {
        feedId: p.feedId,
        feedName: p.feedName || "",
        feedUnit: p.feedUnit || "kg",
        gramsPerHen,
        dailyGrams,
        dailyKg: dailyGrams / 1000,
      };
    });

    const totalDailyGrams = dailyFeedPerFeed.reduce((s, f) => s + f.dailyGrams, 0);

    // Producción esperada de huevos para esta etapa
    const eggsPerHen = Number(stage.expectedEggsPerHen || 0);
    const expectedEggs = Math.round(eggsPerHen * henCount * 10) / 10;

    totalExpectedEggs += expectedEggs;

    // Agregar necesidades de alimento al total global
    for (const f of dailyFeedPerFeed) {
      if (!feedNeedsAggregated[f.feedId]) {
        const prog = programs.find((p) => p.feedId === f.feedId);
        feedNeedsAggregated[f.feedId] = {
          feedName: f.feedName,
          feedUnit: f.feedUnit,
          dailyGrams: 0,
          currentStock: prog?.currentStock || "0",
          costPerUnit: prog?.costPerUnit || "0",
        };
      }
      feedNeedsAggregated[f.feedId].dailyGrams += f.dailyGrams;
    }

    stageMetrics.push({
      stageId: stage.id,
      stageName: stage.value,
      minWeeks: stage.minWeeks,
      maxWeeks: stage.maxWeeks,
      henCount,
      expectedEggsPerHen: eggsPerHen,
      expectedEggs,
      totalDailyFeedGrams: totalDailyGrams,
      totalDailyFeedKg: Math.round(totalDailyGrams / 10) / 100,
      feedBreakdown: dailyFeedPerFeed,
    });
  }

  // 3. Calcular días de stock restante por alimento
  const stockProjection = Object.entries(feedNeedsAggregated).map(([feedId, data]) => {
    const currentStockKg = Number(data.currentStock);
    const dailyKg = data.dailyGrams / 1000;
    const daysRemaining = dailyKg > 0 ? Math.floor(currentStockKg / dailyKg) : Infinity;
    const calculatedMinStock = stockDays ? Math.round(dailyKg * stockDays * 100) / 100 : null;
    return {
      feedId,
      feedName: data.feedName,
      feedUnit: data.feedUnit,
      currentStockKg,
      dailyNeedKg: Math.round(dailyKg * 100) / 100,
      daysRemaining: daysRemaining === Infinity ? null : daysRemaining,
      costPerUnit: Number(data.costPerUnit),
      calculatedMinStock,
    };
  });

  // 4. Consumo real de los últimos 7 días vs esperado
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateStr = sevenDaysAgo.toISOString().split("T")[0];

  const recentConsumption = await db
    .select({
      feedId: feedMovements.feedId,
      feedName: feedInventory.name,
      totalQty: sql<string>`coalesce(sum(${feedMovements.quantity}), 0)`,
    })
    .from(feedMovements)
    .leftJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
    .where(and(
      eq(feedMovements.isEntry, false),
      sql`${feedMovements.date} >= ${dateStr}`,
    ))
    .groupBy(feedMovements.feedId, feedInventory.name);

  const consumptionMap: Record<string, { actual7d: number; expected7d: number; feedName: string }> = {};
  for (const c of recentConsumption) {
    const fid = c.feedId;
    const actual7d = Number(c.totalQty);
    const agg = feedNeedsAggregated[fid];
    const expected7d = agg ? (agg.dailyGrams / 1000) * 7 : 0;
    consumptionMap[fid] = {
      actual7d,
      expected7d: Math.round(expected7d * 100) / 100,
      feedName: c.feedName || "",
    };
  }

  // 5. Producción real de huevos (últimos 7 días)
  const { eggProduction } = await import("@/db/schema");
  const recentEggs = await db
    .select({
      total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int`,
      days: sql<number>`count(*)::int`,
    })
    .from(eggProduction)
    .where(sql`${eggProduction.date} >= ${dateStr}`);

  const actualEggs7d = recentEggs[0]?.total || 0;
  const eggDays = recentEggs[0]?.days || 0;
  const expectedEggs7d = Math.round(totalExpectedEggs * 7);

  return NextResponse.json({
    totalHens,
    totalExpectedEggsPerDay: Math.round(totalExpectedEggs * 10) / 10,
    expectedEggs7d,
    actualEggs7d,
    eggDaysRecorded: eggDays,
    stages: stageMetrics,
    stockProjection,
    consumptionVsExpected: Object.entries(consumptionMap).map(([feedId, data]) => ({
      feedId,
      feedName: data.feedName,
      actual7d: data.actual7d,
      expected7d: data.expected7d,
      variance: Math.round((data.actual7d - data.expected7d) * 100) / 100,
    })),
  });
}
