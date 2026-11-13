import { db } from "@/db";
import { feedPrograms, feedInventory, feedMovements, broilerBatches, weightLogs, catalogos } from "@/db/schema";
import { eq, and, sql, desc, gte, inArray } from "drizzle-orm";
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

  // 8. Comparativo zootécnico por especie/dieta (FCR y costo por kg ganado) + alertas nutricionales
  const [activeBatches, recentWeights, feedsList, stageCats] = await Promise.all([
    db.select().from(broilerBatches).where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"])),
    db.select().from(weightLogs).orderBy(desc(weightLogs.date)).limit(500),
    db.select().from(feedInventory),
    db.select().from(catalogos).where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true))),
  ]);

  const feedCostMap = new Map(feedsList.map((f) => [f.id, Number(f.costPerUnit) || 0]));
  const weightsByBatch = new Map<string, number[]>();
  for (const w of recentWeights) {
    if (!w.batchId) continue;
    const arr = weightsByBatch.get(w.batchId) || [];
    arr.push(Number(w.avgWeightKg) || 0);
    weightsByBatch.set(w.batchId, arr);
  }

  const stageCostBySpecies = new Map<string, { dailyFeedKgPerAnimal: number; weightedCostPerKg: number; programCount: number }>();
  const stageSpeciesMap = new Map(stageCats.map((c) => [c.id, (c.tipo || "gallina").toLowerCase()]));
  for (const p of programs) {
    const sp = stageSpeciesMap.get(p.stageCatalogoId) || "gallina";
    const cur = stageCostBySpecies.get(sp) || { dailyFeedKgPerAnimal: 0, weightedCostPerKg: 0, programCount: 0 };
    const dailyKg = Number(p.dailyAmountPerHen || 0) / 1000;
    const unitCost = feedCostMap.get(p.feedId) || 0;
    const prevTotalKg = cur.dailyFeedKgPerAnimal;
    cur.dailyFeedKgPerAnimal = prevTotalKg + dailyKg;
    cur.weightedCostPerKg = (prevTotalKg * cur.weightedCostPerKg + dailyKg * unitCost) / (cur.dailyFeedKgPerAnimal || 1);
    cur.programCount += 1;
    stageCostBySpecies.set(sp, cur);
  }

  const speciesBatches = new Map<string, { animals: number; totalGainKg: number; estimatedFeedKg: number; estimatedFeedCost: number }>();
  for (const b of activeBatches) {
    const sp = (b.species || "pollo").toLowerCase();
    const cur = speciesBatches.get(sp) || { animals: 0, totalGainKg: 0, estimatedFeedKg: 0, estimatedFeedCost: 0 };
    const qty = Math.max(0, Number(b.currentQuantity) || 0);
    const wArr = weightsByBatch.get(b.id) || [];
    const avgCurrentW = wArr.length > 0 ? wArr[0] : (b.avgWeightKg ? Number(b.avgWeightKg) : 0);
    const initialAvgW = wArr.length > 1 ? wArr[wArr.length - 1] : (sp === "cuy" ? 0.12 : sp === "conejo" ? 0.45 : sp === "codorniz" ? 0.02 : 0.045);
    const gainKgPerAnimal = Math.max(0, avgCurrentW - initialAvgW);
    const stageStats = stageCostBySpecies.get(sp);
    const daysElapsed = Math.max(1, Math.min(days, Math.round((today.getTime() - new Date(`${b.startDate}T12:00:00`).getTime()) / 86400000)));
    const dailyFeedKg = stageStats?.dailyFeedKgPerAnimal || (sp === "cuy" ? 0.065 : sp === "conejo" ? 0.13 : sp === "codorniz" ? 0.025 : 0.11);
    const feedKg = qty * dailyFeedKg * daysElapsed;
    const costPerKg = stageStats?.weightedCostPerKg || 0;
    cur.animals += qty;
    cur.totalGainKg += qty * gainKgPerAnimal;
    cur.estimatedFeedKg += feedKg;
    cur.estimatedFeedCost += feedKg * costPerKg;
    speciesBatches.set(sp, cur);
  }

  const dietPerformance = Array.from(new Set([...speciesBatches.keys(), ...stageCostBySpecies.keys()])).map((sp) => {
    const batchStats = speciesBatches.get(sp) || { animals: 0, totalGainKg: 0, estimatedFeedKg: 0, estimatedFeedCost: 0 };
    const stageStats = stageCostBySpecies.get(sp);
    const fcr = batchStats.totalGainKg > 0 && batchStats.estimatedFeedKg > 0
      ? Number((batchStats.estimatedFeedKg / batchStats.totalGainKg).toFixed(2))
      : null;
    const costPerKgGain = batchStats.totalGainKg > 0 && batchStats.estimatedFeedCost > 0
      ? Math.round(batchStats.estimatedFeedCost / batchStats.totalGainKg)
      : null;
    return {
      species: sp,
      activeAnimals: batchStats.animals,
      dailyFeedPerAnimalKg: stageStats ? Number(stageStats.dailyFeedKgPerAnimal.toFixed(3)) : null,
      feedCostPerKg: stageStats ? Math.round(stageStats.weightedCostPerKg) : null,
      totalWeightGainKg: Number(batchStats.totalGainKg.toFixed(2)),
      estimatedFeedKg: Number(batchStats.estimatedFeedKg.toFixed(2)),
      fcr,
      costPerKgGain,
    };
  });

  const hasForage = feedsList.some((f) => /forraje|pasto|alfalfa|raygrass|morera|ramio/i.test(`${f.name} ${f.feedType} ${f.category}`));
  const hasCuy = speciesBatches.has("cuy") || stageCostBySpecies.has("cuy");
  const hasConejo = speciesBatches.has("conejo") || stageCostBySpecies.has("conejo");

  return NextResponse.json({
    days,
    comparativo: comparativo.reverse(),
    dailyData: dailyData.reverse(),
    dietPerformance,
    nutritionAlerts: {
      forageWiltingRecommended: hasForage || hasCuy || hasConejo,
      vitaminCForCuyRecommended: hasCuy,
    },
  });
});
