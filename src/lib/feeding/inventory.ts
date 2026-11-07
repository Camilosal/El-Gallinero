import { db } from "@/db";
import { feedInventory, feedMovements } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { runFeedProgramCatchup } from "./runProgram";

export interface FeedInventoryProjection {
  id: string;
  name: string;
  category: string;
  feedType: string;
  unit: string;
  currentStock: string;
  minStock: string;
  costPerUnit: string;
  supplier: string | null;
  estimatedValue: number;
  isLow: boolean;
  daysRemaining: number | null;
}

/**
 * Devuelve el inventario de alimentos con su valor estimado y la proyección
 * de días restantes según el consumo registrado en los últimos `days` días.
 *
 * Antes de calcular, materializa los consumos pendientes del programa de
 * alimentación (catch-up idempotente), igual que hacía el endpoint GET.
 */
export async function getFeedInventoryProjection(
  days: number = 30,
): Promise<FeedInventoryProjection[]> {
  const period = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;

  await runFeedProgramCatchup();

  const inventory = await db
    .select()
    .from(feedInventory)
    .orderBy(desc(feedInventory.createdAt));

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - period);
  const sinceStr = sinceDate.toISOString().split("T")[0];

  const movements = await db
    .select()
    .from(feedMovements)
    .where(
      and(
        eq(feedMovements.isEntry, false),
        sql`${feedMovements.date} >= ${sinceStr}`,
      ),
    );

  // Consumo promedio diario por alimento
  const consumptionByFeed = new Map<string, number>();
  for (const m of movements) {
    const daily = Number(m.quantity) / period;
    consumptionByFeed.set(
      m.feedId,
      (consumptionByFeed.get(m.feedId) || 0) + daily,
    );
  }

  return inventory.map((f) => {
    const dailyConsumption = consumptionByFeed.get(f.id) || 0;
    const currentStock = Number(f.currentStock);
    const estimatedValue = currentStock * Number(f.costPerUnit);
    const isLow = dailyConsumption > 0 && currentStock / dailyConsumption <= 7;
    const daysRemaining =
      dailyConsumption > 0 ? Math.floor(currentStock / dailyConsumption) : null;

    return {
      id: f.id,
      name: f.name,
      category: f.category,
      feedType: f.feedType,
      unit: f.unit,
      currentStock: f.currentStock,
      minStock: f.minStock,
      costPerUnit: f.costPerUnit,
      supplier: f.supplier,
      estimatedValue,
      isLow,
      daysRemaining,
    };
  });
}
