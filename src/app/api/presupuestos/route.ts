import { db } from "@/db";
import { budgets, budgetItems, transactions } from "@/db/schema";
import { findStandardExpenseById, findStandardExpenseFamily, resolveExpenseClassification } from "@/lib/finance/standard-expense-catalog";
import { eq, desc, sql, gte, lte, and, or, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

function buildBudgetActualCondition(
  item: { category: string; expenseCatalogId?: string | null; expenseFamily?: string | null },
  budgetType: string,
  periodStart: string,
  periodEnd: string,
) {
  const matchers: SQL[] = [eq(transactions.category, item.category)];
  if (budgetType !== "ingreso") {
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
  return and(
    matchers.length > 1 ? or(...matchers) : matchers[0],
    gte(transactions.date, periodStart),
    lte(transactions.date, periodEnd),
  );
}

export const GET = withApiHandler(async () => {
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

      // Enrich items with actual amounts (matched across standard family, CST-xxx code or category)
      const enrichedItems = await Promise.all(
        items.map(async (item) => {
          const [actualRow] = await db
            .select({ total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text` })
            .from(transactions)
            .where(buildBudgetActualCondition(item, b.type, b.periodStart, b.periodEnd));
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
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
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
        const resolved = type !== "ingreso"
          ? resolveExpenseClassification({
              type: "egreso",
              category: item.category,
              expenseCatalogId: item.expenseCatalogId,
              expenseFamily: item.expenseFamily,
              description: item.description,
            })
          : null;
        await tx.insert(budgetItems).values({
          budgetId: budget.id,
          category: item.category,
          expenseCatalogId: resolved?.expenseCatalogId ?? item.expenseCatalogId ?? null,
          expenseFamily: resolved?.expenseFamily ?? item.expenseFamily ?? null,
          description: item.description || resolved?.expenseConcept || null,
          monthlyTarget: item.monthlyTarget != null ? String(item.monthlyTarget) : "0",
          unit: item.unit || null,
          notes: item.notes || null,
        });
      }
    }

    return budget;
  });

  return NextResponse.json(result, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
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
      const nextType = body.type ?? existing.type;
      // Delete existing items and re-create
      await tx.delete(budgetItems).where(eq(budgetItems.budgetId, body.id));
      for (const item of body.items) {
        const resolved = nextType !== "ingreso"
          ? resolveExpenseClassification({
              type: "egreso",
              category: item.category,
              expenseCatalogId: item.expenseCatalogId,
              expenseFamily: item.expenseFamily,
              description: item.description,
            })
          : null;
        await tx.insert(budgetItems).values({
          budgetId: body.id,
          category: item.category,
          expenseCatalogId: resolved?.expenseCatalogId ?? item.expenseCatalogId ?? null,
          expenseFamily: resolved?.expenseFamily ?? item.expenseFamily ?? null,
          description: item.description || resolved?.expenseConcept || null,
          monthlyTarget: item.monthlyTarget != null ? String(item.monthlyTarget) : "0",
          unit: item.unit || null,
          notes: item.notes || null,
        });
      }
    }
  });

  const [updated] = await db.select().from(budgets).where(eq(budgets.id, body.id));
  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(budgetItems).where(eq(budgetItems.budgetId, id));
    await tx.delete(budgets).where(eq(budgets.id, id));
  });
  return NextResponse.json({ ok: true });
});
