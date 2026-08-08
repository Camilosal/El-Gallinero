import { db } from "@/db";
import { budgets, budgetItems, transactions } from "@/db/schema";
import { eq, desc, sql, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const allBudgets = await db
    .select()
    .from(budgets)
    .orderBy(desc(budgets.createdAt));

  const result = await Promise.all(
    allBudgets.map(async (b) => {
      const items = await db
        .select()
        .from(budgetItems)
        .where(eq(budgetItems.budgetId, b.id))
        .orderBy(budgetItems.category);

      // Enrich items with actual amounts
      const enrichedItems = await Promise.all(
        items.map(async (item) => {
          const [actualRow] = await db
            .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text` })
            .from(transactions)
            .where(
              and(
                eq(transactions.category, item.category),
                gte(transactions.date, b.periodStart),
                lte(transactions.date, b.periodEnd),
              )
            );
          return {
            ...item,
            actualAmount: parseFloat(actualRow?.total || "0"),
          };
        })
      );

      return { ...b, items: enrichedItems };
    })
  );

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, periodStart, periodEnd, type, items } = body;

  if (!name || !periodStart || !periodEnd || !type) {
    return NextResponse.json({ error: "Nombre, período y tipo son requeridos" }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    const [budget] = await tx
      .insert(budgets)
      .values({ name, periodStart, periodEnd, type })
      .returning();

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await tx.insert(budgetItems).values({
          budgetId: budget.id,
          category: item.category,
          description: item.description || null,
          monthlyTarget: String(item.monthlyTarget),
          unit: item.unit || null,
          notes: item.notes || null,
        });
      }
    }

    return budget;
  });

  return NextResponse.json(result, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const [existing] = await db.select().from(budgets).where(eq(budgets.id, body.id));
  if (!existing) {
    return NextResponse.json({ error: "Presupuesto no encontrado" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(budgets)
      .set({
        name: body.name ?? existing.name,
        periodStart: body.periodStart ?? existing.periodStart,
        periodEnd: body.periodEnd ?? existing.periodEnd,
        type: body.type ?? existing.type,
        updatedAt: new Date(),
      })
      .where(eq(budgets.id, body.id));

    if (body.items && Array.isArray(body.items)) {
      // Delete existing items and re-create
      await tx.delete(budgetItems).where(eq(budgetItems.budgetId, body.id));
      for (const item of body.items) {
        await tx.insert(budgetItems).values({
          budgetId: body.id,
          category: item.category,
          description: item.description || null,
          monthlyTarget: String(item.monthlyTarget),
          unit: item.unit || null,
          notes: item.notes || null,
        });
      }
    }
  });

  const [updated] = await db.select().from(budgets).where(eq(budgets.id, body.id));
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(budgetItems).where(eq(budgetItems.budgetId, id));
    await tx.delete(budgets).where(eq(budgets.id, id));
  });
  return NextResponse.json({ ok: true });
}
