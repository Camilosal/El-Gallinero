import { db } from "@/db";
import { transactions } from "@/db/schema";
import { sql, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

interface ProductLine {
  line: string;
  revenue: number;
  cost: number;
  profit: number;
}

function classifyTransaction(t: { category: string; type: string; sourceType: string | null; amount: number }): string {
  const cat = t.category.toLowerCase();
  // Eggs
  if (cat.includes("huevo")) return "huevos";
  // Meat
  if (cat.includes("carne") || cat.includes("sacrificio") || t.sourceType === "sacrificio") return "carne";
  // Manure
  if (cat.includes("gallinaza") || cat.includes("abono")) return "gallinaza";
  // Birds
  if (cat.includes("aves") || cat.includes("gallina") || cat.includes("gallo") || cat.includes("pollo") || t.sourceType === "venta_aves") return "aves";
  return "otros";
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0];

  const txs = await db
    .select()
    .from(transactions)
    .where(and(gte(transactions.date, from), lte(transactions.date, to)))
    .orderBy(transactions.date);

  const lines: Record<string, { revenue: number; cost: number }> = {
    huevos: { revenue: 0, cost: 0 },
    carne: { revenue: 0, cost: 0 },
    gallinaza: { revenue: 0, cost: 0 },
    aves: { revenue: 0, cost: 0 },
    otros: { revenue: 0, cost: 0 },
  };

  for (const t of txs) {
    const amount = Number(t.amount);
    const line = classifyTransaction({
      category: t.category,
      type: t.type,
      sourceType: t.sourceType,
      amount,
    });

    if (t.type === "ingreso") {
      lines[line].revenue += amount;
    } else {
      lines[line].cost += amount;
    }
  }

  const result: ProductLine[] = Object.entries(lines).map(([line, data]) => ({
    line,
    revenue: parseFloat(data.revenue.toFixed(2)),
    cost: parseFloat(data.cost.toFixed(2)),
    profit: parseFloat((data.revenue - data.cost).toFixed(2)),
  }));

  const totalRevenue = result.reduce((s, l) => s + l.revenue, 0);
  const totalCost = result.reduce((s, l) => s + l.cost, 0);

  return NextResponse.json({
    from,
    to,
    productLines: result,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    totalProfit: parseFloat((totalRevenue - totalCost).toFixed(2)),
  });
});
