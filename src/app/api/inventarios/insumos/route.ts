import { db } from "@/db";
import { supplyInventory, supplyMovements } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const items = await db
    .select()
    .from(supplyInventory)
    .orderBy(supplyInventory.name);

  return NextResponse.json(items);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { name, category, unit, currentStock, minStock, costPerUnit, supplier, expiryDate } = body;

  if (!name || !category || !unit) {
    return NextResponse.json({ error: "Nombre, categoría y unidad son requeridos" }, { status: 400 });
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(supplyInventory)
      .values({
        name,
        category,
        unit,
        currentStock: String(currentStock || 0),
        minStock: String(minStock || 0),
        costPerUnit: String(costPerUnit || 0),
        supplier: supplier || null,
        expiryDate: expiryDate || null,
      })
      .returning();

    // If initial stock provided, create a movement
    if (currentStock && Number(currentStock) > 0) {
      await tx.insert(supplyMovements).values({
        supplyId: row.id,
        quantity: String(currentStock),
        isEntry: true,
        movementType: "compra",
        date: new Date().toISOString().split("T")[0],
        notes: `Stock inicial de ${name}`,
      });
    }

    return row;
  });

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(supplyInventory)
    .where(eq(supplyInventory.id, body.id));

  if (!existing) {
    return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });
  }

  const [updated] = await db
    .update(supplyInventory)
    .set({
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      unit: body.unit ?? existing.unit,
      currentStock: body.currentStock != null ? String(body.currentStock) : existing.currentStock,
      minStock: body.minStock != null ? String(body.minStock) : existing.minStock,
      costPerUnit: body.costPerUnit != null ? String(body.costPerUnit) : existing.costPerUnit,
      supplier: body.supplier !== undefined ? body.supplier : existing.supplier,
      expiryDate: body.expiryDate !== undefined ? body.expiryDate : existing.expiryDate,
      updatedAt: new Date(),
    })
    .where(eq(supplyInventory.id, body.id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(supplyMovements).where(eq(supplyMovements.supplyId, id));
    await tx.delete(supplyInventory).where(eq(supplyInventory.id, id));
  });
  return NextResponse.json({ ok: true });
});
