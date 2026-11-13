import { db } from "@/db";
import { manureAdjustments, manureSales, transactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { deleteTransactionsAndUnpaidAccounts, syncCreditReceivable } from "@/lib/financial-records";
import { lockAndReadManureStock } from "@/lib/manure-stock";
import { resolveDimensions } from "@/lib/analytics-dimensions";
import { assertDateNotClosed } from "@/lib/sanitary-locks";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ManureSaleInput {
  date: string;
  quantityKg: number;
  pricePerKg: number;
  presentation?: string | null;
  buyer?: string | null;
  notes?: string | null;
  species?: string | null;
  locationId?: string | null;
  batchId?: string | null;
  isCredit?: boolean;
  dueDate?: string | null;
}

export async function createManureSale(tx: DbTransaction, input: ManureSaleInput) {
  await assertDateNotClosed(tx, { date: input.date });
  const availableKg = await lockAndReadManureStock(tx);
  if (input.quantityKg > availableKg) {
    throw new Error(`Stock insuficiente: disponibles ${Math.max(0, availableKg).toFixed(2)} kg`);
  }

  const dimRes = await resolveDimensions(tx, {
    species: input.species,
    locationId: input.locationId,
    batchId: input.batchId,
  });
  if ("error" in dimRes) throw new Error(dimRes.error);
  const dims = dimRes.dimensions;

  const totalAmount = (input.quantityKg * input.pricePerKg).toFixed(2);
  const [created] = await tx.insert(manureSales).values({
    date: input.date,
    species: dims.species,
    locationId: dims.locationId,
    batchId: dims.batchId,
    quantityKg: input.quantityKg.toFixed(2),
    pricePerKg: input.pricePerKg.toFixed(2),
    totalAmount,
    presentation: input.presentation || null,
    buyer: input.buyer || null,
    notes: input.notes || null,
  }).returning();

  const [txRow] = await tx.insert(transactions).values({
    date: input.date,
    type: "ingreso",
    category: "Venta de abono/gallinaza",
    description: `Venta de gallinaza (${input.quantityKg} kg)${input.buyer ? ` a ${input.buyer}` : ""}`,
    counterparty: input.buyer || null,
    amount: totalAmount,
    quantity: input.quantityKg.toFixed(2),
    unitPrice: input.pricePerKg.toFixed(2),
    unit: "kg",
    presentation: input.presentation || null,
    sourceType: "gallinaza",
    sourceId: created.id,
    species: dims.species,
    locationId: dims.locationId,
    batchId: dims.batchId,
    notes: input.notes || null,
  }).returning();

  if (input.isCredit) {
    await syncCreditReceivable(tx, {
      transactionId: txRow.id,
      totalAmount,
      isCredit: true,
      dueDate: input.dueDate || null,
      buyer: input.buyer || null,
    });
  }

  return { ...created, transactionId: txRow.id };
}

export async function deleteManureSale(tx: DbTransaction, saleId: string): Promise<boolean> {
  await lockAndReadManureStock(tx);
  const [sale] = await tx.select({ id: manureSales.id }).from(manureSales).where(eq(manureSales.id, saleId));
  if (!sale) return false;

  await deleteTransactionsAndUnpaidAccounts(
    tx,
    and(eq(transactions.sourceType, "gallinaza"), eq(transactions.sourceId, saleId)),
  );
  await tx.delete(manureSales).where(eq(manureSales.id, saleId));
  return true;
}

export async function createManureAdjustment(
  tx: DbTransaction,
  input: { date: string; deltaKg: number; reason: string },
) {
  const availableKg = await lockAndReadManureStock(tx);
  if (availableKg + input.deltaKg < -0.001) {
    throw new Error(`Stock insuficiente: disponibles ${Math.max(0, availableKg).toFixed(2)} kg para el ajuste`);
  }
  const [created] = await tx.insert(manureAdjustments).values({
    date: input.date,
    deltaKg: input.deltaKg.toFixed(2),
    reason: input.reason.trim(),
  }).returning();
  return created;
}

export async function deleteManureAdjustment(tx: DbTransaction, adjustmentId: string): Promise<boolean> {
  const availableKg = await lockAndReadManureStock(tx);
  const [adjustment] = await tx.select().from(manureAdjustments).where(eq(manureAdjustments.id, adjustmentId));
  if (!adjustment) return false;
  const stockAfterDeletion = availableKg - Number(adjustment.deltaKg);
  if (stockAfterDeletion < -0.001) {
    throw new Error("No se puede eliminar el ajuste porque dejaría el inventario de gallinaza negativo");
  }
  await tx.delete(manureAdjustments).where(eq(manureAdjustments.id, adjustmentId));
  return true;
}
