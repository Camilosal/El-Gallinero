import { db } from "@/db";
import { accountsPayable, accountsReceivable, payments, transactions } from "@/db/schema";
import { eq, inArray, or, type SQL } from "drizzle-orm";

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
