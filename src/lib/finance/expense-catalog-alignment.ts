import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { budgetItems, catalogos, costAllocations, purchaseProducts, transactions } from "@/db/schema";
import {
  findStandardExpenseFamily,
  NON_FEED_STANDARD_EXPENSE_FAMILIES,
  resolveExpenseClassification,
} from "./standard-expense-catalog";

type DbClient = Pick<typeof db, "select" | "update" | "insert">;

export interface AlignExpenseCatalogResult {
  updatedTransactions: number;
  updatedBudgetItems: number;
  updatedPurchaseProducts: number;
  updatedAllocations: number;
  addedCatalogEntries: number;
}

/**
 * Estandariza idempotentemente los registros históricos de egresos de una finca
 * (`transactions`, `budget_items`, `purchase_products`, `cost_allocations` y
 * lista `categoria_egreso` en `catalogos`) según `Catalogo Egresos.csv`.
 * Nunca modifica montos, fechas, saldos ni cuentas por pagar.
 */
export async function alignFarmExpenseCatalog(
  farmId: string,
  client: DbClient = db,
  options: { syncCatalogosList?: boolean } = {},
): Promise<AlignExpenseCatalogResult> {
  const [txRows, bItems, products, allocations] = await Promise.all([
    client.select().from(transactions).where(eq(transactions.farmId, farmId)),
    client.select().from(budgetItems).where(eq(budgetItems.farmId, farmId)),
    client.select().from(purchaseProducts).where(eq(purchaseProducts.farmId, farmId)),
    client.select().from(costAllocations).where(eq(costAllocations.farmId, farmId)),
  ]);

  let updatedTransactions = 0;
  for (const row of txRows) {
    if (row.type !== "egreso") continue;
    const resolved = resolveExpenseClassification({
      type: row.type,
      category: row.category,
      expenseCatalogId: row.expenseCatalogId,
      expenseFamily: row.expenseFamily,
      expenseConcept: row.expenseConcept,
      expenseTreatment: row.expenseTreatment,
      expenseDriver: row.expenseDriver,
      description: row.description,
      sourceType: row.sourceType,
    });

    const nextCatalogId = row.expenseCatalogId ?? resolved.expenseCatalogId ?? null;
    const nextFamily = row.expenseFamily ?? resolved.expenseFamily ?? null;
    const nextConcept = row.expenseConcept ?? resolved.expenseConcept ?? null;
    const nextTreatment = row.expenseTreatment ?? resolved.expenseTreatment ?? null;
    const nextDriver = row.expenseDriver ?? resolved.expenseDriver ?? null;

    if (
      nextCatalogId !== row.expenseCatalogId ||
      nextFamily !== row.expenseFamily ||
      nextConcept !== row.expenseConcept ||
      nextTreatment !== row.expenseTreatment ||
      nextDriver !== row.expenseDriver
    ) {
      await client
        .update(transactions)
        .set({
          expenseCatalogId: nextCatalogId,
          expenseFamily: nextFamily,
          expenseConcept: nextConcept,
          expenseTreatment: nextTreatment,
          expenseDriver: nextDriver,
        })
        .where(eq(transactions.id, row.id));
      updatedTransactions++;
    }
  }

  let updatedBudgetItems = 0;
  for (const item of bItems) {
    const resolved = resolveExpenseClassification({
      type: "egreso",
      category: item.category,
      expenseCatalogId: item.expenseCatalogId,
      expenseFamily: item.expenseFamily,
      description: item.description,
    });
    const fam = findStandardExpenseFamily(item.category)?.name ?? item.expenseFamily ?? resolved.expenseFamily;
    const catId = item.expenseCatalogId ?? resolved.expenseCatalogId;
    if ((fam && fam !== item.expenseFamily) || (catId && catId !== item.expenseCatalogId)) {
      await client
        .update(budgetItems)
        .set({
          expenseFamily: fam ?? null,
          expenseCatalogId: catId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(budgetItems.id, item.id));
      updatedBudgetItems++;
    }
  }

  let updatedPurchaseProducts = 0;
  for (const prod of products) {
    const resolved = resolveExpenseClassification({
      type: "egreso",
      category: prod.expenseCategory,
      expenseCatalogId: prod.expenseCatalogId,
      expenseFamily: prod.expenseFamily,
      description: prod.name,
    });
    const nextFamily = prod.expenseFamily ?? resolved.expenseFamily ?? null;
    const nextCatalogId = prod.expenseCatalogId ?? resolved.expenseCatalogId ?? null;
    if (nextFamily !== prod.expenseFamily || nextCatalogId !== prod.expenseCatalogId) {
      await client
        .update(purchaseProducts)
        .set({
          expenseFamily: nextFamily,
          expenseCatalogId: nextCatalogId,
          updatedAt: new Date(),
        })
        .where(eq(purchaseProducts.id, prod.id));
      updatedPurchaseProducts++;
    }
  }

  let updatedAllocations = 0;
  for (const alloc of allocations) {
    if (alloc.expenseFamily && alloc.expenseCatalogId) continue;
    const resolved = resolveExpenseClassification({
      type: "egreso",
      category: alloc.expenseCategory || alloc.title,
      expenseCatalogId: alloc.expenseCatalogId,
      expenseFamily: alloc.expenseFamily,
      description: alloc.title,
    });
    const nextFamily = alloc.expenseFamily ?? resolved.expenseFamily ?? null;
    const nextCatalogId = alloc.expenseCatalogId ?? resolved.expenseCatalogId ?? null;
    if (nextFamily !== alloc.expenseFamily || nextCatalogId !== alloc.expenseCatalogId) {
      await client
        .update(costAllocations)
        .set({
          expenseFamily: nextFamily,
          expenseCatalogId: nextCatalogId,
        })
        .where(eq(costAllocations.id, alloc.id));
      updatedAllocations++;
    }
  }

  let addedCatalogEntries = 0;
  if (options.syncCatalogosList !== false) {
    const existingCats = await client
      .select({ value: catalogos.value, sortOrder: catalogos.sortOrder })
      .from(catalogos)
      .where(and(eq(catalogos.farmId, farmId), eq(catalogos.category, "categoria_egreso")));

    const existingSet = new Set(existingCats.map((c) => c.value.trim()));
    let nextSort = existingCats.reduce((max, c) => Math.max(max, Number(c.sortOrder || 0)), -1) + 1;

    for (const fam of NON_FEED_STANDARD_EXPENSE_FAMILIES) {
      if (existingSet.has(fam.name)) continue;
      await client.insert(catalogos).values({
        farmId,
        category: "categoria_egreso",
        value: fam.name,
        tipo: fam.defaultTreatment,
        description: `${fam.conceptsCount} conceptos (${fam.p1Count} P1) del Catálogo Maestro de Egresos`,
        sortOrder: nextSort++,
        isActive: true,
      });
      existingSet.add(fam.name);
      addedCatalogEntries++;
    }
  }

  return {
    updatedTransactions,
    updatedBudgetItems,
    updatedPurchaseProducts,
    updatedAllocations,
    addedCatalogEntries,
  };
}
