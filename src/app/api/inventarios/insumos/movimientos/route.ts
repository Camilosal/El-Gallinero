import { db } from "@/db";
import { supplyMovements, supplyInventory } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
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
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { supplyId, quantity, isEntry, movementType, date, notes } = body;

  if (!supplyId || !quantity || isEntry === undefined || !movementType || !date) {
    return NextResponse.json({ error: "Campos requeridos: supplyId, quantity, isEntry, movementType, date" }, { status: 400 });
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty < 1) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }

  const movement = await db.transaction(async (tx) => {
    // Verify supply exists inside transaction
    const [supply] = await tx
      .select()
      .from(supplyInventory)
      .where(eq(supplyInventory.id, supplyId));

    if (!supply) {
      throw new Error("Insumo no encontrado");
    }

    // For withdrawals, check stock inside the transaction using SQL
    if (!isEntry) {
      const currentStock = Number(supply.currentStock);
      if (qty > currentStock) {
        return NextResponse.json(
          { error: `Stock insuficiente. Disponible: ${currentStock} ${supply.unit}` },
          { status: 400 },
        );
      }
    }

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

    // Use relative SQL update to avoid race conditions
    if (isEntry) {
      await tx
        .update(supplyInventory)
        .set({
          currentStock: sql`(${supplyInventory.currentStock}::numeric + ${qty})`,
          updatedAt: new Date(),
        })
        .where(eq(supplyInventory.id, supplyId));
    } else {
      await tx
        .update(supplyInventory)
        .set({
          currentStock: sql`GREATEST(0, ${supplyInventory.currentStock}::numeric - ${qty})`,
          updatedAt: new Date(),
        })
        .where(eq(supplyInventory.id, supplyId));
    }

    return row;
  });

  return NextResponse.json(movement, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [movement] = await tx
      .select()
      .from(supplyMovements)
      .where(eq(supplyMovements.id, id));

    if (!movement) {
      throw new Error("Movimiento no encontrado");
    }

    // Reverse stock using relative SQL update
    const qty = Number(movement.quantity);
    if (movement.isEntry) {
      await tx
        .update(supplyInventory)
        .set({
          currentStock: sql`GREATEST(0, ${supplyInventory.currentStock}::numeric - ${qty})`,
          updatedAt: new Date(),
        })
        .where(eq(supplyInventory.id, movement.supplyId));
    } else {
      await tx
        .update(supplyInventory)
        .set({
          currentStock: sql`(${supplyInventory.currentStock}::numeric + ${qty})`,
          updatedAt: new Date(),
        })
        .where(eq(supplyInventory.id, movement.supplyId));
    }

    await tx.delete(supplyMovements).where(eq(supplyMovements.id, id));
  });

  return NextResponse.json({ ok: true });
});
