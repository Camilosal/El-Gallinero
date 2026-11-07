import { db } from "@/db";
import {
  catalogos, hens, roosters, broilerBatches,
  feedInventory, feedMovements, eggProductionDetails,
  supplyInventory, mortalityRecords,
} from "@/db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runFeedProgramCatchup } from "@/lib/feeding/runProgram";
import { computeEggInventory, computeManureInventory, computeMeatInventory } from "@/lib/inventory";
import { computeAnimalInventory } from "@/lib/animal-inventory";
import { getInventoryPrices } from "@/lib/settings";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventarios/huevos/consolidado
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
export const GET = withApiHandler(async (req: NextRequest) => {
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
    manureInv,
    sizeCatalog,
    movementsByType,
    supplyRows,
    meatInv,
    mortalityRows,
    animalInv,
    inventoryPrices,
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
    computeManureInventory(),

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

    // Supply inventory
    db.select().from(supplyInventory).orderBy(desc(supplyInventory.name)),

    // Meat inventory
    computeMeatInventory(),

    // Mortality records in period
    db.select({
      birdType: mortalityRecords.birdType,
      cause: mortalityRecords.cause,
      total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int`,
    }).from(mortalityRecords).where(gte(mortalityRecords.date, startStr))
      .groupBy(mortalityRecords.birdType, mortalityRecords.cause),

    // Inventario consolidado multiespecie
    computeAnimalInventory(),

    // Precios de valoración configurables
    getInventoryPrices(),
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
      species: b.species,
      purpose: b.purpose,
      breed: b.breed,
      currentQuantity: b.currentQuantity,
      startDate: b.startDate,
      avgWeightKg: Number(b.avgWeightKg || 0),
    })),
    totalBirdsInProduction: hensActive + (roosterStatusMap.activo || 0) + batches.reduce((s, b) => s + b.currentQuantity, 0),
    // Inventario multiespecie: la unidad es "animal", no "gallina".
    animals: animalInv,
    totalAnimals: animalInv.summary.totalAnimals,
    totalBirds: animalInv.summary.totalBirds,
    species: animalInv.species,
  };

  // 4. Gallinaza
  const manure = {
    currentStockKg: Math.round(manureInv.summary.available * 100) / 100,
    lastAccumulatedDate: null, // No longer tracked in singleton
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

  // Supplies section
  const supplies = supplyRows.map((s) => {
    const stock = Number(s.currentStock);
    const minStock = Number(s.minStock);
    const costPerUnit = Number(s.costPerUnit);
    return {
      supplyId: s.id,
      name: s.name,
      category: s.category,
      unit: s.unit,
      currentStock: stock,
      minStock,
      costPerUnit,
      estimatedValue: Math.round(stock * costPerUnit * 100) / 100,
      isLow: stock <= minStock,
      supplier: s.supplier,
      expiryDate: s.expiryDate,
    };
  });
  const totalSuppliesValue = supplies.reduce((s, x) => s + x.estimatedValue, 0);

  // Meat section
  const meat = meatInv.lots.map((m) => ({
    id: m.id,
    date: m.date,
    source: m.birdType, // Using birdType as source since structure changed
    birdType: m.birdType,
    quantityKg: Number(m.quantityKg),
    availableKg: Number(m.remainingKg),
    costPerKg: 0, // Cost tracking removed in new structure
  }));
  const totalMeatKg = meat.reduce((s, m) => s + m.availableKg, 0);
  const totalMeatValue = meat.reduce((s, m) => s + m.availableKg * m.costPerKg, 0);

  // Mortality section
  const mortalityByCause: Record<string, number> = {};
  let totalDeaths = 0;
  for (const m of mortalityRows) {
    totalDeaths += m.total;
    const cause = m.cause || "otro";
    mortalityByCause[cause] = (mortalityByCause[cause] || 0) + m.total;
  }

  // 6. Valor total
  const eggValue = eggInv.estimatedValue;

  // Valor de animales en pie: cálculo multiespecie con precios de Catálogos.
  const totalBirdsWeightKg = animalInv.summary.totalWeightKg;
  const birdsValue = animalInv.summary.totalValue;

  // Valor de gallinaza con precio configurable.
  const manureValue = Math.round(manure.currentStockKg * inventoryPrices.manurePricePerKg * 100) / 100;

  // Valor total del inventario
  const totalValue = Math.round((totalFoodValue + eggValue + totalSuppliesValue + totalMeatValue + birdsValue + manureValue) * 100) / 100;

  return NextResponse.json({
    generatedAt: today.toISOString(),
    periodDays: days,
    summary: {
      totalFeeds: foodItems.length,
      lowStockFeeds: foodItems.filter((f) => f.isLow).length,
      totalHensActive: birds.hens.active,
      totalAnimalsActive: animalInv.summary.totalAnimals,
      totalBirdsActive: animalInv.summary.totalBirds,
      totalEggsAvailable: eggInv.summary.available,
      totalManureKg: manure.currentStockKg,
      totalValue,
      foodValue: Math.round(totalFoodValue * 100) / 100,
      eggValue: Math.round(eggValue * 100) / 100,
      birdsValue: Math.round(birdsValue * 100) / 100,
      totalBirdsWeightKg: Math.round(totalBirdsWeightKg * 100) / 100,
      totalSupplies: supplies.length,
      lowStockSupplies: supplies.filter((s) => s.isLow).length,
      totalMeatKg: Math.round(totalMeatKg * 100) / 100,
      suppliesValue: Math.round(totalSuppliesValue * 100) / 100,
      meatValue: Math.round(totalMeatValue * 100) / 100,
      manureValue: Math.round(manureValue * 100) / 100,
      totalDeaths,
    },
    foods: foodItems,
    eggs: eggSummary,
    birds,
    animals: animalInv,
    manure,
    movements: {
      entriesByType,
      exitsByType,
      totalEntries: Math.round(totalEntries * 100) / 100,
      totalExits: Math.round(totalExits * 100) / 100,
    },
    supplies,
    meat,
    mortality: {
      byCause: mortalityByCause,
      totalDeaths,
    },
  });
});
