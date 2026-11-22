import { db } from "@/db";
import { budgets, budgetItems, transactions } from "@/db/schema";
import { findStandardExpenseById, findStandardExpenseFamily } from "@/lib/finance/standard-expense-catalog";
import { eq, sql, gte, lte, and, or, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const budgetId = searchParams.get("budgetId");
  if (!budgetId) {
    return NextResponse.json({ error: "budgetId requerido" }, { status: 400 });
  }

  const [budget] = await db.select().from(budgets).where(eq(budgets.id, budgetId));
  if (!budget) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  const items = await db
    .select()
    .from(budgetItems)
    .where(eq(budgetItems.budgetId, budgetId))
    .orderBy(budgetItems.category);

  const comparativo = await Promise.all(
    items.map(async (item) => {
      const matchers: SQL[] = [eq(transactions.category, item.category)];
      if (budget.type !== "ingreso") {
        if (item.expenseCatalogId) {
          matchers.push(eq(transactions.expenseCatalogId, item.expenseCatalogId));
        } else if (item.expenseFamily) {
          matchers.push(eq(transactions.expenseFamily, item.expenseFamily));
          matchers.push(eq(transactions.category, item.expenseFamily));
        } else {
          const fam = findStandardExpenseFamily(item.category);
          if (fam) matchers.push(eq(transactions.expenseFamily, fam.name));
          const std = findStandardExpenseById(item.category);
          if (std) matchers.push(eq(transactions.expenseCatalogId, std.id));
        }
      }

      const [actualRow] = await db
        .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text` })
        .from(transactions)
        .where(
          and(
            matchers.length > 1 ? or(...matchers) : matchers[0],
            gte(transactions.date, budget.periodStart),
            lte(transactions.date, budget.periodEnd),
          )
        );

      const target = Number(item.monthlyTarget);
      const actual = parseFloat(actualRow?.total || "0");
      const variance = actual - target;
      const variancePct = target > 0 ? ((variance / target) * 100) : 0;

      return {
        ...item,
        target,
        actual,
        variance: parseFloat(variance.toFixed(2)),
        variancePct: parseFloat(variancePct.toFixed(1)),
      };
    })
  );

  return NextResponse.json({ budget, items: comparativo });
});
