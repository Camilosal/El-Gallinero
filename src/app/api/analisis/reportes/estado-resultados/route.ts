import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { normalizeFeedingSpecies } from "@/lib/species";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0];
  const speciesParam = searchParams.get("species");
  const species = speciesParam ? normalizeFeedingSpecies(speciesParam) : null;
  if (speciesParam && !species) {
    return NextResponse.json({ error: "Especie no válida" }, { status: 400 });
  }
  const locationId = searchParams.get("locationId");
  const batchId = searchParams.get("batchId");

  const conditions = [gte(transactions.date, from), lte(transactions.date, to)];
  if (species) conditions.push(eq(transactions.species, species));
  if (locationId) conditions.push(eq(transactions.locationId, locationId));
  if (batchId) conditions.push(eq(transactions.batchId, batchId));

  const txs = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(transactions.date);

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
    filters: { species, locationId: locationId || null, batchId: batchId || null },
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
