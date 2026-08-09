import { db } from "@/db";
import { eggSales, eggSalesItems, eggProductionDetails, eggProduction } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const saleId = searchParams.get("saleId");

  // Get sales (optionally filtered by saleId)
  const salesQuery = saleId
    ? await db.select().from(eggSales).where(eq(eggSales.id, saleId)).limit(1)
    : await db.select().from(eggSales).orderBy(desc(eggSales.date)).limit(50);

  const result = [];
  for (const sale of salesQuery) {
    // Get items for this sale
    const items = await db.select().from(eggSalesItems).where(eq(eggSalesItems.saleId, sale.id));

    // If no items (legacy format), use the sale's own size/quantity
    const saleItems = items.length > 0 ? items : [{ saleId: sale.id, size: sale.size, quantity: sale.quantity }];

    const enrichedItems = [];
    for (const item of saleItems) {
      if (!item.size) continue;

      // Find production records that could have supplied this sale
      // Match by size and date <= sale date
      const productions = await db.select({
        id: eggProduction.id,
        date: eggProduction.date,
        totalCollected: eggProduction.totalCollected,
      }).from(eggProduction)
        .innerJoin(eggProductionDetails, eq(eggProduction.id, eggProductionDetails.productionId))
        .where(and(
          eq(eggProductionDetails.size, item.size),
          // Production must be on or before sale date
        ))
        .orderBy(desc(eggProduction.date))
        .limit(10);

      // Filter to only productions on or before sale date
      const matchingProductions = productions.filter(p => p.date <= sale.date);

      enrichedItems.push({
        size: item.size,
        quantity: item.quantity,
        possibleProductionDates: matchingProductions.map(p => p.date),
        possibleProductionIds: matchingProductions.map(p => p.id),
      });
    }

    result.push({
      saleId: sale.id,
      date: sale.date,
      buyer: sale.buyer,
      totalAmount: sale.totalAmount,
      items: enrichedItems,
    });
  }

  return NextResponse.json(result);
}
