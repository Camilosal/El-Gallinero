import { db } from "@/db";
import { supplyMovements, supplyInventory } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const movements = await db
    .select({
      id: supplyMovements.id,
      supplyId: supplyMovements.supplyId,
      quantity: supplyMovements.quantity,
      isEntry: supplyMovements.isEntry,
      movementType: supplyMovements.movementType,
      date: supplyMovements.date,
      notes: supplyMovements.notes,
      createdAt: supplyMovements.createdAt,
      supplyName: supplyInventory.name,
      supplyUnit: supplyInventory.unit,
    })
    .from(supplyMovements)
    .leftJoin(supplyInventory, eq(supplyMovements.supplyId, supplyInventory.id))
    .orderBy(desc(supplyMovements.createdAt));

  return NextResponse.json(movements);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { supplyId, quantity, isEntry, movementType, date, notes } = body;

  if (!supplyId || !quantity || isEntry === undefined || !movementType || !date) {
    return NextResponse.json({ error: "Campos requeridos: supplyId, quantity, isEntry, movementType, date" }, { status: 400 });
  }

  const [supply] = await db
    .select()
    .from(supplyInventory)
    .where(eq(supplyInventory.id, supplyId));

  if (!supply) {
    return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });
  }

  const qty = Number(quantity);
  const currentStock = Number(supply.currentStock);

  // Block negative stock
  if (!isEntry && qty > currentStock) {
    return NextResponse.json({ error: `Stock insuficiente. Disponible: ${currentStock} ${supply.unit}` }, { status: 400 });
  }

  // Update stock
  const newStock = isEntry ? currentStock + qty : currentStock - qty;

  const movement = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(supplyMovements)
      .values({
        supplyId,
        quantity: String(qty),
        isEntry,
        movementType,
        date,
        notes: notes || null,
      })
      .returning();

    await tx
      .update(supplyInventory)
      .set({
        currentStock: String(Math.max(0, newStock)),
        updatedAt: new Date(),
      })
      .where(eq(supplyInventory.id, supplyId));

    return row;
  });

  return NextResponse.json(movement, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [movement] = await db
    .select()
    .from(supplyMovements)
    .where(eq(supplyMovements.id, id));

  if (!movement) {
    return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    const [supply] = await tx
      .select()
      .from(supplyInventory)
      .where(eq(supplyInventory.id, movement.supplyId));

    if (supply) {
      const currentStock = Number(supply.currentStock);
      const qty = Number(movement.quantity);
      const newStock = movement.isEntry ? currentStock - qty : currentStock + qty;
      await tx
        .update(supplyInventory)
        .set({
          currentStock: String(Math.max(0, newStock)),
          updatedAt: new Date(),
        })
        .where(eq(supplyInventory.id, movement.supplyId));
    }

    await tx.delete(supplyMovements).where(eq(supplyMovements.id, id));
  });

  return NextResponse.json({ ok: true });
}
