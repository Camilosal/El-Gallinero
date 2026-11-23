import { db } from "@/db";
import { budgets, budgetItems, transactions } from "@/db/schema";
import { findStandardExpenseById, findStandardExpenseFamily } from "@/lib/finance/standard-expense-catalog";
import { eq, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

function getBudgetItemMatchSpecificity(
  tx: { category: string; type: string; expenseCatalogId: string | null; expenseFamily: string | null },
  item: { category: string; expenseCatalogId: string | null; expenseFamily: string | null },
  budgetType: string,
): number {
  if (budgetType === "ingreso" && tx.type !== "ingreso") return 0;
  if (budgetType !== "ingreso" && tx.type !== "egreso") return 0;

  if (budgetType !== "ingreso") {
    if (item.expenseCatalogId && tx.expenseCatalogId === item.expenseCatalogId) {
      return 3;
    }
    if (!item.expenseCatalogId && !item.expenseFamily) {
      const std = findStandardExpenseById(item.category);
      if (std && tx.expenseCatalogId === std.id) {
        return 3;
      }
    }
  }

  if (tx.category === item.category) {
    return 2;
  }

  if (budgetType !== "ingreso") {
    if (item.expenseFamily) {
      if (tx.expenseFamily === item.expenseFamily || tx.category === item.expenseFamily) {
        return 1;
      }
    } else if (!item.expenseCatalogId) {
      const fam = findStandardExpenseFamily(item.category);
      if (fam && tx.expenseFamily === fam.name) {
        return 1;
      }
    }
  }

  return 0;
}

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

  const [items, periodTransactions] = await Promise.all([
    db
      .select()
      .from(budgetItems)
      .where(eq(budgetItems.budgetId, budgetId))
      .orderBy(budgetItems.category),
    db
      .select({
        id: transactions.id,
        category: transactions.category,
        type: transactions.type,
        amount: transactions.amount,
        expenseCatalogId: transactions.expenseCatalogId,
        expenseFamily: transactions.expenseFamily,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, budget.periodStart),
          lte(transactions.date, budget.periodEnd),
        ),
      ),
  ]);

  // DAT-07: Imputación exclusiva por transacción (prioriza criterio más específico)
  // y advertencia explícita cuando dos partidas tienen reglas superpuestas.
  const actualByItemId = new Map<string, number>(items.map((it) => [it.id, 0]));
  const overlapTxIdsByItemId = new Map<string, string[]>(items.map((it) => [it.id, []]));
  let deduplicatedOverlapCount = 0;

  for (const tx of periodTransactions) {
    const matches: Array<{ item: (typeof items)[number]; specificity: number }> = [];
    for (const item of items) {
      const spec = getBudgetItemMatchSpecificity(tx, item, budget.type);
      if (spec > 0) {
        matches.push({ item, specificity: spec });
      }
    }

    if (matches.length === 0) continue;

    matches.sort((a, b) => b.specificity - a.specificity);
    const winner = matches[0].item;
    actualByItemId.set(
      winner.id,
      (actualByItemId.get(winner.id) || 0) + Number(tx.amount || 0),
    );

    if (matches.length > 1) {
      deduplicatedOverlapCount += 1;
      for (const m of matches) {
        const list = overlapTxIdsByItemId.get(m.item.id) || [];
        list.push(tx.id);
        overlapTxIdsByItemId.set(m.item.id, list);
      }
    }
  }

  const comparativo = items.map((item) => {
    const target = Number(item.monthlyTarget);
    const actual = parseFloat((actualByItemId.get(item.id) || 0).toFixed(2));
    const variance = actual - target;
    const variancePct = target > 0 ? (variance / target) * 100 : 0;
    const overlappingTransactionIds = overlapTxIdsByItemId.get(item.id) || [];

    return {
      ...item,
      target,
      actual,
      variance: parseFloat(variance.toFixed(2)),
      variancePct: parseFloat(variancePct.toFixed(1)),
      overlappingTransactionIds,
      overlapWarning:
        overlappingTransactionIds.length > 0
          ? `Se detectaron ${overlappingTransactionIds.length} transacción(es) compartida(s) con otras partidas; cada transacción se imputó una sola vez por especificidad.`
          : null,
    };
  });

  const totalTarget = parseFloat(
    comparativo.reduce((sum, item) => sum + item.target, 0).toFixed(2),
  );
  const totalActual = parseFloat(
    comparativo.reduce((sum, item) => sum + item.actual, 0).toFixed(2),
  );

  return NextResponse.json({
    budget,
    items: comparativo,
    summary: {
      totalTarget,
      totalActual,
      deduplicatedOverlapCount,
      hasOverlappingRules: deduplicatedOverlapCount > 0,
    },
  });
});
