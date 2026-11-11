import { db } from "@/db";
import { feedPrograms, feedInventory, feedMovements } from "@/db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runFeedProgramCatchup, countAnimalsByStageForDate } from "@/lib/feeding/runProgram";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/**
 * GET /api/produccion/alimentacion/comparativo
 * Compara consumo planificado (de programas) vs consumo real (de movimientos)
 * por alimento, en un rango de fechas.
 * 
 * Query params:
 * - days: número de días hacia atrás (default: 14)
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get("days") || "14";
  const days = parseInt(daysParam, 10);

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  const dateStr = startDate.toISOString().split("T")[0];

  // Ejecutar el programa hasta hoy para que el consumo real esté al día
  await runFeedProgramCatchup();

  // 1. Contar los animales correspondientes a cada programa alimenticio.
  const stageAnimalCounts = await countAnimalsByStageForDate(today);

  // 2. Calcular consumo planificado por alimento (kg/día)
  const programs = await db
    .select({
      feedId: feedPrograms.feedId,
      feedName: feedInventory.name,
      feedUnit: feedInventory.unit,
      costPerUnit: feedInventory.costPerUnit,
      currentStock: feedInventory.currentStock,
      stageCatalogoId: feedPrograms.stageCatalogoId,
      dailyAmountPerHen: feedPrograms.dailyAmountPerHen,
    })
    .from(feedPrograms)
    .leftJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id));

  const plannedByFeed: Record<string, { feedName: string; dailyKg: number; costPerUnit: number; currentStock: number }> = {};
  for (const p of programs) {
    if (!p.feedId) continue;
    const animalCount = stageAnimalCounts[p.stageCatalogoId] || 0;
    const dailyGrams = Number(p.dailyAmountPerHen) * animalCount;
    const dailyKg = dailyGrams / 1000;

    if (!plannedByFeed[p.feedId]) {
      plannedByFeed[p.feedId] = {
        feedName: p.feedName || "",
        dailyKg: 0,
        costPerUnit: Number(p.costPerUnit),
        currentStock: Number(p.currentStock),
      };
    }
    plannedByFeed[p.feedId].dailyKg += dailyKg;
  }

  // 4. Obtener consumo real (movimientos de salida) en el rango
  const actualMovements = await db
    .select({
      feedId: feedMovements.feedId,
      feedName: feedInventory.name,
      totalQty: sql<string>`coalesce(sum(${feedMovements.quantity}), 0)`,
    })
    .from(feedMovements)
    .leftJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
    .where(and(
      eq(feedMovements.isEntry, false),
      gte(feedMovements.date, dateStr),
    ))
    .groupBy(feedMovements.feedId, feedInventory.name);

  // 5. Obtener entradas (compras) en el rango
  const entryMovements = await db
    .select({
      feedId: feedMovements.feedId,
      feedName: feedInventory.name,
      totalQty: sql<string>`coalesce(sum(${feedMovements.quantity}), 0)`,
    })
    .from(feedMovements)
    .leftJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
    .where(and(
      eq(feedMovements.isEntry, true),
      gte(feedMovements.date, dateStr),
    ))
    .groupBy(feedMovements.feedId, feedInventory.name);

  // 6. Construir resultado
  const allFeedIds = new Set([...Object.keys(plannedByFeed), ...actualMovements.map((m) => m.feedId)]);
  
  const comparativo = Array.from(allFeedIds).map((feedId) => {
    const planned = plannedByFeed[feedId];
    const actual = actualMovements.find((m) => m.feedId === feedId);
    const entries = entryMovements.find((m) => m.feedId === feedId);

    const plannedTotal = planned ? planned.dailyKg * days : 0;
    const actualTotal = actual ? Number(actual.totalQty) : 0;
    const entryTotal = entries ? Number(entries.totalQty) : 0;
    const variance = actualTotal - plannedTotal;
    const variancePercent = plannedTotal > 0 ? ((variance / plannedTotal) * 100) : 0;

    return {
      feedId,
      feedName: planned?.feedName || actual?.feedName || "",
      plannedDaily: planned ? Math.round(planned.dailyKg * 100) / 100 : 0,
      plannedTotal: Math.round(plannedTotal * 100) / 100,
      actualTotal: Math.round(actualTotal * 100) / 100,
      entryTotal: Math.round(entryTotal * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      variancePercent: Math.round(variancePercent),
      currentStock: planned?.currentStock || 0,
      costPerUnit: planned?.costPerUnit || 0,
    };
  });

  // 7. Datos para gráfica diaria (últimos N días)
  const dailyData: { fecha: string; planned: Record<string, number>; actual: Record<string, number> }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const fecha = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("es", { day: "2-digit", month: "short" });
    
    const actualForDay = await db
      .select({
        feedId: feedMovements.feedId,
        totalQty: sql<string>`coalesce(sum(${feedMovements.quantity}), 0)`,
      })
      .from(feedMovements)
      .where(and(
        eq(feedMovements.isEntry, false),
        eq(feedMovements.date, fecha),
      ))
      .groupBy(feedMovements.feedId);

    const actualMap: Record<string, number> = {};
    for (const m of actualForDay) {
      actualMap[m.feedId] = Number(m.totalQty);
    }

    const plannedMap: Record<string, number> = {};
    for (const [feedId, data] of Object.entries(plannedByFeed)) {
      plannedMap[feedId] = Math.round(data.dailyKg * 100) / 100;
    }

    dailyData.push({ fecha: label, planned: plannedMap, actual: actualMap });
  }

  return NextResponse.json({
    days,
    comparativo: comparativo.reverse(),
    dailyData: dailyData.reverse(),
  });
});
