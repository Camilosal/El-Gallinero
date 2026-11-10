import { db } from "@/db";
import { chickenSales, transactions } from "@/db/schema";
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { deleteTransactionsAndUnpaidAccounts } from "@/lib/financial-records";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Deletes an animal's sale history without orphaning unpaid receivables or paid cash records. */
export async function deleteChickenSalesAndLinkedFinance(tx: DbTransaction, saleCondition: SQL): Promise<void> {
  const sales = await tx.select({ id: chickenSales.id }).from(chickenSales).where(saleCondition);
  const saleIds = sales.map((sale) => sale.id);
  if (saleIds.length === 0) return;

  const sourceCondition = and(
    eq(transactions.sourceType, "venta_ave"),
    inArray(transactions.sourceId, saleIds),
  );
  await deleteTransactionsAndUnpaidAccounts(tx, sourceCondition);

  await tx.delete(chickenSales).where(saleCondition);
}
