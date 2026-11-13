import { db } from "@/db";
import { accountsPayable, accountsReceivable, feedInventory, feedMovements, payments, transactions } from "@/db/schema";
import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function upsertExpenseTransaction(
  tx: DbTransaction,
  input: {
    condition: SQL | undefined;
    date: string;
    category: string;
    description: string;
    amount: string;
    sourceType: string;
    sourceId: string;
    counterparty?: string | null;
    species?: string | null;
    locationId?: string | null;
    batchId?: string | null;
  },
): Promise<void> {
  if (!input.condition) throw new Error("No se puede vincular el egreso a un origen válido");
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Monto de egreso inválido");
  if (amount === 0) {
    await deleteTransactionsAndUnpaidAccounts(tx, input.condition);
    return;
  }

  const [existing] = await tx.select().from(transactions).where(input.condition).for("update");
  const values = {
    date: input.date,
    type: "egreso" as const,
    category: input.category,
    description: input.description,
    counterparty: input.counterparty ?? null,
    amount: amount.toFixed(2),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    ...(input.species !== undefined ? { species: input.species } : {}),
    ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
    ...(input.batchId !== undefined ? { batchId: input.batchId } : {}),
  };
  const [transaction] = existing
    ? await tx.update(transactions).set(values).where(eq(transactions.id, existing.id)).returning()
    : await tx.insert(transactions).values(values).returning();

  const [payable] = await tx.select().from(accountsPayable)
    .where(eq(accountsPayable.transactionId, transaction.id)).for("update");
  if (!existing?.isCredit && !payable) return;

  const paidAmount = Number(payable?.paidAmount || 0);
  if (amount < paidAmount) throw new Error("El total no puede quedar por debajo de los pagos ya registrados");
  const pendingAmount = amount - paidAmount;
  await tx.update(transactions).set({ isCredit: true }).where(eq(transactions.id, transaction.id));
  if (payable) {
    await tx.update(accountsPayable).set({
      totalAmount: amount.toFixed(2),
      paidAmount: String(paidAmount),
      pendingAmount: pendingAmount.toFixed(2),
      supplier: input.counterparty || payable.supplier,
      status: pendingAmount === 0 ? "pagado" : paidAmount > 0 ? "parcial" : "pendiente",
      updatedAt: new Date(),
    }).where(eq(accountsPayable.id, payable.id));
  } else {
    await tx.insert(accountsPayable).values({
      transactionId: transaction.id,
      supplier: input.counterparty || input.description || "Sin nombre",
      totalAmount: amount.toFixed(2),
      paidAmount: "0",
      pendingAmount: amount.toFixed(2),
      status: "pendiente",
    });
  }
}

/** Removes a source transaction only when its linked credit accounts have no payments. */
export async function deleteTransactionsAndUnpaidAccounts(tx: DbTransaction, condition: SQL | undefined): Promise<void> {
  if (!condition) return;
  const rows = await tx.select({ id: transactions.id }).from(transactions).where(condition).for("update");
  const transactionIds = rows.map((row) => row.id);
  if (transactionIds.length === 0) return;

  const [receivables, payables] = await Promise.all([
    tx.select().from(accountsReceivable).where(inArray(accountsReceivable.transactionId, transactionIds)).for("update"),
    tx.select().from(accountsPayable).where(inArray(accountsPayable.transactionId, transactionIds)).for("update"),
  ]);
  if (
    receivables.some((account) => Number(account.paidAmount) > 0) ||
    payables.some((account) => Number(account.paidAmount) > 0)
  ) {
    throw new Error("No se puede eliminar una transacción con pagos o cobros registrados");
  }

  const paymentConditions: SQL[] = [];
  if (receivables.length > 0) {
    paymentConditions.push(inArray(payments.receivableId, receivables.map((account) => account.id)));
  }
  if (payables.length > 0) {
    paymentConditions.push(inArray(payments.payableId, payables.map((account) => account.id)));
  }
  if (paymentConditions.length > 0) {
    const linkedPayments = await tx.select({ id: payments.id }).from(payments).where(or(...paymentConditions));
    if (linkedPayments.length > 0) {
      throw new Error("No se puede eliminar una transacción con pagos o cobros registrados");
    }
  }

  if (receivables.length > 0) {
    await tx.delete(accountsReceivable).where(inArray(accountsReceivable.id, receivables.map((account) => account.id)));
  }
  if (payables.length > 0) {
    await tx.delete(accountsPayable).where(inArray(accountsPayable.id, payables.map((account) => account.id)));
  }
  await tx.delete(transactions).where(condition);
}

/** Reverses the stock effect and linked expense before removing a feed movement. */
export async function deleteFeedMovementAndReverseStock(
  tx: DbTransaction,
  movementId: string,
  transactionId?: string,
): Promise<void> {
  const [movement] = await tx.select().from(feedMovements)
    .where(eq(feedMovements.id, movementId)).for("update");
  if (!movement) throw new Error("Movimiento de alimento no encontrado");

  const [feed] = await tx.select().from(feedInventory)
    .where(eq(feedInventory.id, movement.feedId)).for("update");
  if (!feed) throw new Error("Alimento no encontrado");

  if (transactionId) {
    const [transaction] = await tx.select({ id: transactions.id, sourceType: transactions.sourceType, sourceId: transactions.sourceId })
      .from(transactions).where(eq(transactions.id, transactionId)).for("update");
    if (!transaction || transaction.sourceType !== "alimento" || transaction.sourceId !== movementId) {
      throw new Error("Transacción vinculada: la compra de alimento cambió mientras se eliminaba");
    }
  }

  const quantity = Number(movement.quantity);
  const currentStock = Number(feed.currentStock);
  if (movement.isEntry && currentStock + 0.0001 < quantity) {
    throw new Error("No se puede eliminar una compra de alimento que ya fue consumida");
  }
  const nextStock = movement.isEntry ? currentStock - quantity : currentStock + quantity;
  let nextCostPerUnit = Number(feed.costPerUnit);

  if (movement.isEntry && movement.movementType === "compra") {
    const [purchase] = await tx.select({ unitPrice: transactions.unitPrice }).from(transactions)
      .where(and(eq(transactions.sourceType, "alimento"), eq(transactions.sourceId, movementId)))
      .limit(1);
    const purchaseUnitPrice = Number(purchase?.unitPrice);
    if (Number.isFinite(purchaseUnitPrice) && purchaseUnitPrice >= 0) {
      const remainingValue = currentStock * nextCostPerUnit - quantity * purchaseUnitPrice;
      nextCostPerUnit = nextStock > 0 ? Math.max(0, remainingValue / nextStock) : 0;
    }
  }

  await tx.update(feedInventory).set({
    currentStock: nextStock.toFixed(2),
    costPerUnit: nextCostPerUnit.toFixed(2),
    updatedAt: new Date(),
  }).where(eq(feedInventory.id, movement.feedId));

  await deleteTransactionsAndUnpaidAccounts(
    tx,
    and(eq(transactions.sourceType, "alimento"), eq(transactions.sourceId, movementId)),
  );
  await tx.delete(feedMovements).where(eq(feedMovements.id, movementId));
}

/**
 * Sincroniza la cuenta por cobrar (accounts_receivable) vinculada a una venta/ingreso.
 * Si isCredit=true crea o actualiza la CxC respetando los cobros ya registrados;
 * si isCredit=false la elimina únicamente si no tiene abonos aplicados.
 */
export async function syncCreditReceivable(
  tx: DbTransaction,
  input: {
    transactionId: string;
    totalAmount: string | number;
    isCredit: boolean;
    dueDate?: string | null;
    buyer?: string | null;
  },
): Promise<void> {
  const totalNum = Number(input.totalAmount);
  const totalStr = Number.isFinite(totalNum) ? totalNum.toFixed(2) : "0.00";
  const [receivable] = await tx
    .select()
    .from(accountsReceivable)
    .where(eq(accountsReceivable.transactionId, input.transactionId))
    .for("update");

  if (input.isCredit) {
    const paidAmount = Number(receivable?.paidAmount || 0);
    if (totalNum < paidAmount) {
      throw new Error("El total no puede quedar por debajo de los pagos ya recibidos");
    }
    await tx.update(transactions).set({ isCredit: true }).where(eq(transactions.id, input.transactionId));
    if (receivable) {
      const pendingAmount = Math.max(0, totalNum - paidAmount);
      await tx.update(accountsReceivable).set({
        buyer: input.buyer || receivable.buyer,
        totalAmount: totalStr,
        paidAmount: String(paidAmount),
        pendingAmount: pendingAmount.toFixed(2),
        dueDate: input.dueDate !== undefined ? input.dueDate || null : receivable.dueDate,
        status: pendingAmount === 0 ? "pagado" : paidAmount > 0 ? "parcial" : "pendiente",
        updatedAt: new Date(),
      }).where(eq(accountsReceivable.id, receivable.id));
    } else {
      await tx.insert(accountsReceivable).values({
        transactionId: input.transactionId,
        buyer: input.buyer || "Sin nombre",
        totalAmount: totalStr,
        paidAmount: "0",
        pendingAmount: totalStr,
        dueDate: input.dueDate || null,
        status: "pendiente",
      });
    }
    return;
  }

  if (receivable) {
    const linkedPayments = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.receivableId, receivable.id));
    if (Number(receivable.paidAmount) > 0 || linkedPayments.length > 0) {
      throw new Error("No se puede convertir a contado una venta que ya tiene cobros recibidos");
    }
    await tx.delete(accountsReceivable).where(eq(accountsReceivable.id, receivable.id));
  }
  await tx.update(transactions).set({ isCredit: false }).where(eq(transactions.id, input.transactionId));
}

export interface SaleCreditMeta {
  transactionId: string | null;
  isCredit: boolean;
  dueDate: string | null;
}

/** Obtiene metadatos de crédito/cartera vinculados a una lista de registros por sourceType. */
export async function getCreditMetaBySourceIds(
  sourceType: string,
  sourceIds: string[],
): Promise<Map<string, SaleCreditMeta>> {
  const result = new Map<string, SaleCreditMeta>();
  if (sourceIds.length === 0) return result;

  const linkedTxs = await db
    .select({
      id: transactions.id,
      sourceId: transactions.sourceId,
      isCredit: transactions.isCredit,
    })
    .from(transactions)
    .where(and(eq(transactions.sourceType, sourceType), inArray(transactions.sourceId, sourceIds)));

  const txIds = linkedTxs.map((t) => t.id);
  const receivables = txIds.length
    ? await db
        .select({ transactionId: accountsReceivable.transactionId, dueDate: accountsReceivable.dueDate })
        .from(accountsReceivable)
        .where(inArray(accountsReceivable.transactionId, txIds))
    : [];
  const dueByTx = new Map(receivables.map((r) => [r.transactionId, r.dueDate || null]));

  for (const tx of linkedTxs) {
    if (!tx.sourceId) continue;
    result.set(tx.sourceId, {
      transactionId: tx.id,
      isCredit: Boolean(tx.isCredit),
      dueDate: dueByTx.get(tx.id) || null,
    });
  }
  return result;
}
