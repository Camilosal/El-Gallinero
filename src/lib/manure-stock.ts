import { db } from "@/db";
import { manureAdjustments, manureProduction, manureSales } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { AUTO_MANURE_SOURCE } from "@/lib/manure";
import { buildManureEstimate } from "@/lib/manure-estimate";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Ensures one estimated production entry for today; missed days are not backfilled. */
async function recordDailyEstimate(tx: DbTransaction, estimatedDailyKg?: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const [existing] = await tx.select({ id: manureProduction.id })
    .from(manureProduction)
    .where(and(eq(manureProduction.date, today), eq(manureProduction.source, AUTO_MANURE_SOURCE)))
    .limit(1);
  if (existing) return;

  const estimate = estimatedDailyKg ?? (await buildManureEstimate()).totalKgPerDay;
  if (!Number.isFinite(estimate) || estimate <= 0) return;

  await tx.insert(manureProduction).values({
    date: today,
    kgProduced: estimate.toFixed(2),
    source: AUTO_MANURE_SOURCE,
    notes: "Estimación diaria automática; no se reconstruyen días sin registro.",
  }).onConflictDoNothing();
}

/** Serializes stock-changing manure operations, accrues today's estimate, and reads stock. */
export async function lockAndReadManureStock(tx: DbTransaction, estimatedDailyKg?: number): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(41827411)`);
  await recordDailyEstimate(tx, estimatedDailyKg);

  const [[production], [adjustments], [sales]] = await Promise.all([
    tx.select({ total: sql<string>`coalesce(sum(${manureProduction.kgProduced}), 0)::text` }).from(manureProduction),
    tx.select({ total: sql<string>`coalesce(sum(${manureAdjustments.deltaKg}), 0)::text` }).from(manureAdjustments),
    tx.select({ total: sql<string>`coalesce(sum(${manureSales.quantityKg}), 0)::text` }).from(manureSales),
  ]);

  return Number(production.total) + Number(adjustments.total) - Number(sales.total);
}
