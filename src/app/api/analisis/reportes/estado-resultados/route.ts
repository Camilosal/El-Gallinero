import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, sql, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

  const txs = await db
    .select()
    .from(transactions)
    .where(and(gte(transactions.date, from), lte(transactions.date, to)))
    .orderBy(transactions.date);

  // Group by type and category
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const t of txs) {
    const amount = Number(t.amount);
    if (t.type === "ingreso") {
      incomeMap.set(t.category, (incomeMap.get(t.category) || 0) + amount);
    } else {
      expenseMap.set(t.category, (expenseMap.get(t.category) || 0) + amount);
    }
  }

  const incomeCategories = Array.from(incomeMap.entries())
    .map(([category, total]) => ({ category, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const expenseCategories = Array.from(expenseMap.entries())
    .map(([category, total]) => ({ category, total: parseFloat(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const totalIncome = incomeCategories.reduce((s, c) => s + c.total, 0);
  const totalExpenses = expenseCategories.reduce((s, c) => s + c.total, 0);
  const netProfit = parseFloat((totalIncome - totalExpenses).toFixed(2));

  return NextResponse.json({
    from,
    to,
    income: {
      categories: incomeCategories,
      total: parseFloat(totalIncome.toFixed(2)),
    },
    expenses: {
      categories: expenseCategories,
      total: parseFloat(totalExpenses.toFixed(2)),
    },
    netProfit,
    transactionCount: txs.length,
  });
});
