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
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  const { name, category, unit, currentStock, minStock, costPerUnit, supplier, expiryDate } = body;

  if (!name || !category || !unit) {
    return NextResponse.json({ error: "Nombre, categoría y unidad son requeridos" }, { status: 400 });
  }
  const initialStock = Number(currentStock ?? 0);
  if (!Number.isFinite(initialStock) || initialStock < 0) return NextResponse.json({ error: "Stock inicial inválido" }, { status: 400 });

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(supplyInventory)
      .values({
        name,
        category,
        unit,
        currentStock: initialStock.toFixed(2),
        minStock: String(minStock || 0),
        costPerUnit: String(costPerUnit || 0),
        supplier: supplier || null,
        expiryDate: expiryDate || null,
      })
      .returning();

    // If initial stock provided, create a movement
    if (initialStock > 0) {
      await tx.insert(supplyMovements).values({
        supplyId: row.id,
        quantity: initialStock.toFixed(2),
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
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const [updated] = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(supplyInventory).where(eq(supplyInventory.id, body.id)).for("update");
    if (!existing) return [];
    const nextStock = body.currentStock != null ? Number(body.currentStock) : Number(existing.currentStock);
    if (!Number.isFinite(nextStock) || nextStock < 0) throw new Error("Stock inválido");
    const previousStock = Number(existing.currentStock);
    const expiryDate = body.expiryDate !== undefined
      ? (body.expiryDate ? body.expiryDate : null)
      : existing.expiryDate;
    const [row] = await tx.update(supplyInventory).set({
      name: body.name ?? existing.name,
      category: body.category ?? existing.category,
      unit: body.unit ?? existing.unit,
      currentStock: nextStock.toFixed(2),
      minStock: body.minStock != null ? String(body.minStock) : existing.minStock,
      costPerUnit: body.costPerUnit != null ? String(body.costPerUnit) : existing.costPerUnit,
      supplier: body.supplier !== undefined ? body.supplier : existing.supplier,
      expiryDate,
      updatedAt: new Date(),
    }).where(eq(supplyInventory.id, body.id)).returning();

    if (Math.abs(nextStock - previousStock) >= 0.005) {
      const delta = nextStock - previousStock;
      await tx.insert(supplyMovements).values({
        supplyId: existing.id,
        quantity: Math.abs(delta).toFixed(2),
        isEntry: delta > 0,
        movementType: "ajuste_inventario",
        date: new Date().toISOString().slice(0, 10),
        notes: "Ajuste manual del stock desde el catálogo de insumos",
      });
    }
    return [row];
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const result = await db.transaction(async (tx) => {
    const [supply] = await tx.select().from(supplyInventory).where(eq(supplyInventory.id, id)).for("update");
    if (!supply) return "missing" as const;
    const [linkedMovement] = await tx.select({ id: supplyMovements.id })
      .from(supplyMovements)
      .where(sql`${supplyMovements.supplyId} = ${id} AND ${supplyMovements.healthControlId} IS NOT NULL`)
      .limit(1);
    if (linkedMovement) return "linked" as const;
    await tx.delete(supplyMovements).where(eq(supplyMovements.supplyId, id));
    await tx.delete(supplyInventory).where(eq(supplyInventory.id, id));
    return "deleted" as const;
  });
  if (result === "missing") return NextResponse.json({ error: "Insumo no encontrado" }, { status: 404 });
  if (result === "linked") {
    return NextResponse.json({ error: "Este insumo tiene movimientos ligados a controles sanitarios y no se puede eliminar." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
});
