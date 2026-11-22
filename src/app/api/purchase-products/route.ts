import { db } from "@/db";
import { purchaseProducts } from "@/db/schema";
import { resolveExpenseClassification } from "@/lib/finance/standard-expense-catalog";
import { eq, and, desc, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/** List all active purchase products, optionally filtered by expense category or standard family */
export const GET = withApiHandler(async (req: NextRequest) => {
  const category = req.nextUrl.searchParams.get("category");
  const family = req.nextUrl.searchParams.get("family");

  if (category || family) {
    const resolved = resolveExpenseClassification({
      type: "egreso",
      category,
      expenseFamily: family,
    });
    const filters = [];
    if (category) filters.push(eq(purchaseProducts.expenseCategory, category));
    if (resolved.expenseFamily) filters.push(eq(purchaseProducts.expenseFamily, resolved.expenseFamily));
    if (resolved.expenseCatalogId) filters.push(eq(purchaseProducts.expenseCatalogId, resolved.expenseCatalogId));

    const data = await db
      .select()
      .from(purchaseProducts)
      .where(and(eq(purchaseProducts.isActive, true), filters.length > 1 ? or(...filters) : filters[0]))
      .orderBy(desc(purchaseProducts.updatedAt));
    return NextResponse.json(data);
  }

  const data = await db
    .select()
    .from(purchaseProducts)
    .where(eq(purchaseProducts.isActive, true))
    .orderBy(desc(purchaseProducts.updatedAt));
  return NextResponse.json(data);
});

/** Create a new purchase product */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.name || !body.expenseCategory) {
    return NextResponse.json({ error: "Nombre y categoría son requeridos" }, { status: 400 });
  }

  const resolved = resolveExpenseClassification({
    type: "egreso",
    category: body.expenseCategory,
    expenseCatalogId: body.expenseCatalogId,
    expenseFamily: body.expenseFamily,
    description: body.name,
  });

  const [created] = await db
    .insert(purchaseProducts)
    .values({
      name: body.name,
      expenseCategory: body.expenseCategory,
      expenseCatalogId: resolved.expenseCatalogId,
      expenseFamily: resolved.expenseFamily,
      defaultPresentation: body.defaultPresentation || null,
      defaultUnit: body.defaultUnit || "unidades",
      lastPricePerPresentation: body.lastPricePerPresentation || null,
      defaultSupplier: body.defaultSupplier || null,
      notes: body.notes || null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});

/** Update a purchase product */
export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const resolved = resolveExpenseClassification({
    type: "egreso",
    category: body.expenseCategory,
    expenseCatalogId: body.expenseCatalogId,
    expenseFamily: body.expenseFamily,
    description: body.name,
  });

  const [updated] = await db
    .update(purchaseProducts)
    .set({
      name: body.name,
      expenseCategory: body.expenseCategory,
      expenseCatalogId: resolved.expenseCatalogId,
      expenseFamily: resolved.expenseFamily,
      defaultPresentation: body.defaultPresentation || null,
      defaultUnit: body.defaultUnit || "unidades",
      lastPricePerPresentation: body.lastPricePerPresentation || null,
      defaultSupplier: body.defaultSupplier || null,
      notes: body.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(purchaseProducts.id, body.id))
    .returning();

  return NextResponse.json(updated);
});

/** Soft-delete a purchase product (set isActive=false) */
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db
    .update(purchaseProducts)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(purchaseProducts.id, id));

  return NextResponse.json({ ok: true });
});
