import { db } from "@/db";
import {
  catalogos, hens, roosters, broilerBatches,
  feedInventory, feedMovements, eggProductionDetails,
  manureInventory,
} from "@/db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runFeedProgramCatchup } from "@/lib/feeding/runProgram";
import { computeEggInventory } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventario/consolidado
 * Balance consolidado de todo el inventario del gallinero:
 * 1. Alimentos (stock actual, valor estimado, días restantes por consumo)
 * 2. Huevos por tamaño (PEPS: disponible y valor)
 * 3. Aves por estado (gallinas, gallos, lotes de engorde)
 * 4. Gallinaza (stock)
 * 5. Resumen de entradas/salidas por motivo (movimientos clasificados)
 * 6. Valor total del inventario (resumen financiero)
 *
 * Query params:
 * - days: días hacia atrás para el resumen de movimientos por motivo (default: 30)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10), 1), 365);

  // Asegurar que consumo automático y stock estén al día
  await runFeedProgramCatchup();

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split("T")[0];

  const [
    feeds,
    hensByStatus,
    roostersByStatus,
    batches,
    eggInv,
    manureRows,
    sizeCatalog,
    movementsByType,
  ] = await Promise.all([
    // 1. Alimentos
    db.select().from(feedInventory).orderBy(desc(feedInventory.category)),

    // 3. Aves: gallinas por estado
    db.select({ status: hens.status, count: sql<number>`count(*)::int` }).from(hens).groupBy(hens.status),

    // 3. Aves: gallos por estado
    db.select({ status: roosters.status, count: sql<number>`count(*)::int` }).from(roosters).groupBy(roosters.status),

    // 3. Aves: lotes de engorde activos
    db.select().from(broilerBatches).where(eq(broilerBatches.status, "activo")),

    // 2. Huevos (PEPS)
    computeEggInventory(),

    // 4. Gallinaza
    db.select().from(manureInventory),

    // Precios de huevo por tamaño del catálogo
    db.select({ value: catalogos.value, price: catalogos.price })
      .from(catalogos)
      .where(and(eq(catalogos.category, "tamano_huevo"), eq(catalogos.isActive, true))),

    // 5. Movimientos clasificados por motivo (entradas y salidas)
    db.select({
      movementType: feedMovements.movementType,
      isEntry: feedMovements.isEntry,
      totalQty: sql<string>`coalesce(sum(${feedMovements.quantity}), 0)`,
    })
      .from(feedMovements)
      .where(gte(feedMovements.date, startStr))
      .groupBy(feedMovements.movementType, feedMovements.isEntry),
  ]);

  // 1. Alimentos con valor y días restantes
  const foodItems = feeds.map((f) => {
    const currentStockKg = Number(f.currentStock);
    const costPerUnit = Number(f.costPerUnit);
    const minStock = Number(f.minStock);
    return {
      feedId: f.id,
      name: f.name,
      category: f.category,
      feedType: f.feedType,
      unit: f.unit,
      currentStock: currentStockKg,
      minStock,
      costPerUnit,
      estimatedValue: Math.round(currentStockKg * costPerUnit * 100) / 100,
      isLow: currentStockKg <= minStock,
    };
  });

  const totalFoodValue = foodItems.reduce((s, f) => s + f.estimatedValue, 0);

  // 2. Huevos (ya traen valor PEPS)
  const eggSummary = eggInv.summary.sizes.map((s) => ({
    size: s.size,
    price: s.price,
    available: s.available,
    produced: s.produced,
    sold: s.sold,
    value: s.value,
  }));

  // 3. Aves por estado
  const henStatusMap = Object.fromEntries(hensByStatus.map((h) => [h.status, h.count]));
  const roosterStatusMap = Object.fromEntries(roostersByStatus.map((r) => [r.status, r.count]));

  const hensActive = (henStatusMap.activa || 0) + (henStatusMap.empollando || 0);
  const birds = {
    hens: {
      active: hensActive,
      sick: henStatusMap.enferma || 0,
      recommendedSlaughter: henStatusMap.recomendada_sacrificio || 0,
      sold: henStatusMap.vendida || 0,
      slaughtered: henStatusMap.faena || 0,
      dead: henStatusMap.muerta || 0,
      total: hensByStatus.reduce((s, h) => s + h.count, 0),
    },
    roosters: {
      active: roosterStatusMap.activo || 0,
      sold: roosterStatusMap.vendido || 0,
      slaughtered: roosterStatusMap.faena || 0,
      total: roostersByStatus.reduce((s, r) => s + r.count, 0),
    },
    batches: batches.map((b) => ({
      batchId: b.id,
      code: b.code,
      breed: b.breed,
      currentQuantity: b.currentQuantity,
      startDate: b.startDate,
      avgWeightKg: Number(b.avgWeightKg || 0),
    })),
    totalBirdsInProduction: hensActive + (roosterStatusMap.activo || 0) + batches.reduce((s, b) => s + b.currentQuantity, 0),
  };

  // 4. Gallinaza
  const manureRow = manureRows[0];
  const manure = {
    currentStockKg: Number(manureRow?.currentStockKg || 0),
    lastAccumulatedDate: manureRow?.lastAccumulatedDate || null,
  };

  // 5. Resumen de movimientos por motivo
  const entriesByType: Record<string, number> = {};
  const exitsByType: Record<string, number> = {};
  let totalEntries = 0;
  let totalExits = 0;
  for (const m of movementsByType) {
    const qty = Number(m.totalQty);
    if (m.isEntry) {
      entriesByType[m.movementType] = (entriesByType[m.movementType] || 0) + qty;
      totalEntries += qty;
    } else {
      exitsByType[m.movementType] = (exitsByType[m.movementType] || 0) + qty;
      totalExits += qty;
    }
  }

  // 6. Valor total
  const eggValue = eggInv.estimatedValue;
  const birdsValue = birds.batches.reduce((s, b) => s + b.currentQuantity * b.avgWeightKg, 0); // valor informativo en kg de carne en pie
  const totalValue = Math.round((totalFoodValue + eggValue) * 100) / 100;

  return NextResponse.json({
    generatedAt: today.toISOString(),
    periodDays: days,
    summary: {
      totalFeeds: foodItems.length,
      lowStockFeeds: foodItems.filter((f) => f.isLow).length,
      totalHensActive: birds.hens.active,
      totalEggsAvailable: eggInv.summary.available,
      totalManureKg: manure.currentStockKg,
      totalValue,
      foodValue: Math.round(totalFoodValue * 100) / 100,
      eggValue: Math.round(eggValue * 100) / 100,
      birdsValue: Math.round(birdsValue * 100) / 100,
    },
    foods: foodItems,
    eggs: eggSummary,
    birds,
    manure,
    movements: {
      entriesByType,
      exitsByType,
      totalEntries: Math.round(totalEntries * 100) / 100,
      totalExits: Math.round(totalExits * 100) / 100,
    },
  });
}
