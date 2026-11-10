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
      healthControlId: supplyMovements.healthControlId,
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
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  const { supplyId, quantity, isEntry, movementType, date, notes } = body;

  if (!supplyId || !quantity || isEntry === undefined || !movementType || !date) {
    return NextResponse.json({ error: "Campos requeridos: supplyId, quantity, isEntry, movementType, date" }, { status: 400 });
  }
  if (typeof isEntry !== "boolean") return NextResponse.json({ error: "Tipo de movimiento inválido" }, { status: 400 });
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime()) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }

  const movement = await db.transaction(async (tx) => {
    // Verify supply exists inside transaction
    const [supply] = await tx
      .select()
      .from(supplyInventory)
      .where(eq(supplyInventory.id, supplyId))
      .for("update");

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

  const result = await db.transaction(async (tx) => {
    const [movement] = await tx
      .select()
      .from(supplyMovements)
      .where(eq(supplyMovements.id, id))
      .for("update");

    if (!movement) {
      return "missing" as const;
    }
    if (movement.healthControlId) return "linked" as const;

    const qty = Number(movement.quantity);
    const [supply] = await tx
      .select()
      .from(supplyInventory)
      .where(eq(supplyInventory.id, movement.supplyId))
      .for("update");
    if (!supply) throw new Error("Insumo no encontrado");
    if (movement.isEntry && Number(supply.currentStock) + 0.0001 < qty) {
      throw new Error("No se puede eliminar una entrada de insumo que ya fue consumida");
    }
    if (movement.isEntry) {
      await tx
        .update(supplyInventory)
        .set({
          currentStock: sql`(${supplyInventory.currentStock}::numeric - ${qty})`,
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
    return "deleted" as const;
  });

  if (result === "missing") return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
  if (result === "linked") {
    return NextResponse.json({ error: "Este movimiento pertenece a un control sanitario. Elimínalo desde Sanidad." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
});
