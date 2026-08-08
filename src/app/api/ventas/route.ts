import { db } from "@/db";
import { eggSales, eggSalesItems, transactions, eggProductionDetails } from "@/db/schema";
import { eq, desc, sql, and, ne, inArray, notInArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Huevos disponibles por tamaño (producción por tamaño - ventas ya registradas)
async function getAvailableEggsBySize(excludeSaleIds?: string[]): Promise<Map<string, number>> {
  const [prod, sold] = await Promise.all([
    db.select({
      size: eggProductionDetails.size,
      total: sql<number>`coalesce(sum(${eggProductionDetails.quantity}), 0)::int`,
    }).from(eggProductionDetails).groupBy(eggProductionDetails.size),
    db.select({
      size: eggSalesItems.size,
      total: sql<number>`coalesce(sum(${eggSalesItems.quantity}), 0)::int`,
    }).from(eggSalesItems)
      .where(excludeSaleIds?.length ? notInArray(eggSalesItems.saleId, excludeSaleIds) : undefined)
      .groupBy(eggSalesItems.size),
  ]);

  const map = new Map<string, number>();
  for (const p of prod) if (p.size) map.set(p.size, p.total);
  for (const s of sold) if (s.size) map.set(s.size, (map.get(s.size) || 0) - s.total);
  return map;
}

// Huevos disponibles de un tamaño específico
async function getAvailableEggs(size: string, excludeId?: string): Promise<number> {
  const [prod, sold] = await Promise.all([
    db.select({
      total: sql<number>`coalesce(sum(${eggProductionDetails.quantity}), 0)::int`,
    }).from(eggProductionDetails).where(eq(eggProductionDetails.size, size)),
    db.select({
      total: sql<number>`coalesce(sum(${eggSalesItems.quantity}), 0)::int`,
    }).from(eggSalesItems)
      .where(and(eq(eggSalesItems.size, size), excludeId ? ne(eggSalesItems.saleId, excludeId) : undefined)),
  ]);

  return (prod[0]?.total || 0) - (sold[0]?.total || 0);
}

// GET /api/ventas — lista de ventas
export async function GET() {
  const data = await db.select().from(eggSales).orderBy(desc(eggSales.date)).limit(100);

  // For each sale, load its items
  const result = [];
  for (const sale of data) {
    const items = await db.select().from(eggSalesItems).where(eq(eggSalesItems.saleId, sale.id));
    result.push({ ...sale, items });
  }
  return NextResponse.json(result);
}

// GET /api/ventas?available=1 — inventario disponible por tamaño
// (handled in same GET — we always return items, frontend can also call /api/huevos/inventario)

// POST /api/ventas — crear venta (soporta items[] multi-tamaño o formato legacy single-size)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const items: { size: string; quantity: number; presentations?: number; pricePerUnit: number; presentation?: string }[] = body.items;

  // Validate items array
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "La venta debe tener al menos un tamaño" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.size) return NextResponse.json({ error: "Selecciona el tamaño del huevo" }, { status: 400 });
    if (!item.quantity || item.quantity < 1) return NextResponse.json({ error: `Cantidad inválida para tamaño ${item.size}` }, { status: 400 });
    if (!item.pricePerUnit || item.pricePerUnit <= 0) return NextResponse.json({ error: `Precio inválido para tamaño ${item.size}` }, { status: 400 });
  }

  // Check stock for each size
  const available = await getAvailableEggsBySize();
  for (const item of items) {
    const avail = available.get(item.size) || 0;
    if (item.quantity > avail) {
      return NextResponse.json(
        { error: `No hay suficientes huevos tamaño ${item.size}. Disponibles: ${avail}` },
        { status: 400 }
      );
    }
  }

  // Calculate total from items: presentations × pricePerUnit (price per presentation)
  const grandTotal = items.reduce((sum, item) => {
    const presentations = item.presentations || item.quantity; // fallback to quantity if presentations not provided
    return sum + presentations * Number(item.pricePerUnit);
  }, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Create the parent sale record (summary)
  const [created] = await db.insert(eggSales).values({
    date: body.date,
    quantity: totalQuantity,
    pricePerUnit: "0",
    totalAmount: grandTotal.toFixed(2),
    size: items.length === 1 ? items[0].size : null,
    presentation: items.length === 1 ? (items[0].presentation || null) : null,
    buyer: body.buyer || null,
    notes: body.notes || null,
  }).returning();

  // Create sale items
  const createdItems = await db.insert(eggSalesItems).values(
    items.map((item) => {
      const presentations = item.presentations || item.quantity;
      return {
        saleId: created.id,
        size: item.size,
        quantity: item.quantity,
        pricePerUnit: String(item.pricePerUnit),
        totalAmount: (presentations * Number(item.pricePerUnit)).toFixed(2),
        presentation: item.presentation || null,
      };
    })
  ).returning();

  // Create linked income transaction
  const sizeDesc = items.length === 1
    ? items[0].size
    : items.map((i) => `${i.quantity} ${i.size}`).join(", ");
  await db.insert(transactions).values({
    date: body.date,
    type: "ingreso",
    category: "Venta de huevos",
    description: `Venta de ${sizeDesc}${body.buyer ? ` a ${body.buyer}` : ""}`,
    amount: grandTotal.toFixed(2),
    quantity: String(totalQuantity),
    unitPrice: items.length === 1 ? String(items[0].pricePerUnit) : null,
    unit: "unidades",
    counterparty: body.buyer || null,
    sourceType: "venta",
    sourceId: created.id,
  });

  return NextResponse.json({ ...created, items: createdItems }, { status: 201 });
}

// PUT /api/ventas — actualizar venta
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const items: { size: string; quantity: number; presentations?: number; pricePerUnit: number; presentation?: string }[] = body.items;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "La venta debe tener al menos un tamaño" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.size) return NextResponse.json({ error: "Selecciona el tamaño del huevo" }, { status: 400 });
    if (!item.quantity || item.quantity < 1) return NextResponse.json({ error: `Cantidad inválida para tamaño ${item.size}` }, { status: 400 });
  }

  // Check stock excluding this sale
  const available = await getAvailableEggsBySize([body.id]);
  for (const item of items) {
    const avail = available.get(item.size) || 0;
    if (item.quantity > avail) {
      return NextResponse.json(
        { error: `No hay suficientes huevos tamaño ${item.size}. Disponibles: ${avail}` },
        { status: 400 }
      );
    }
  }

  const grandTotal = items.reduce((sum, item) => {
    const presentations = item.presentations || item.quantity;
    return sum + presentations * Number(item.pricePerUnit);
  }, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Update parent sale
  const [updated] = await db.update(eggSales).set({
    date: body.date,
    quantity: totalQuantity,
    totalAmount: grandTotal.toFixed(2),
    size: items.length === 1 ? items[0].size : null,
    presentation: items.length === 1 ? (items[0].presentation || null) : null,
    buyer: body.buyer || null,
    notes: body.notes || null,
  }).where(eq(eggSales.id, body.id)).returning();

  // Replace items: delete old, insert new
  await db.delete(eggSalesItems).where(eq(eggSalesItems.saleId, body.id));
  const createdItems = await db.insert(eggSalesItems).values(
    items.map((item) => {
      const presentations = item.presentations || item.quantity;
      return {
        saleId: body.id,
        size: item.size,
        quantity: item.quantity,
        pricePerUnit: String(item.pricePerUnit),
        totalAmount: (presentations * Number(item.pricePerUnit)).toFixed(2),
        presentation: item.presentation || null,
      };
    })
  ).returning();

  // Sync linked income transaction
  const [existing] = await db.select().from(transactions)
    .where(and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, body.id)));

  const sizeDesc = items.length === 1
    ? items[0].size
    : items.map((i) => `${i.quantity} ${i.size}`).join(", ");
  const values = {
    date: body.date,
    description: `Venta de ${sizeDesc}${body.buyer ? ` a ${body.buyer}` : ""}`,
    amount: grandTotal.toFixed(2),
    quantity: String(totalQuantity),
    unitPrice: items.length === 1 ? String(items[0].pricePerUnit) : null,
    unit: "unidades",
    counterparty: body.buyer || null,
  };

  if (existing) {
    await db.update(transactions).set(values).where(eq(transactions.id, existing.id));
  } else {
    await db.insert(transactions).values({ ...values, type: "ingreso", category: "Venta de huevos", sourceType: "venta", sourceId: body.id });
  }

  return NextResponse.json({ ...updated, items: createdItems });
}

// DELETE /api/ventas — eliminar venta
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.delete(transactions).where(and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, id)));
  await db.delete(eggSalesItems).where(eq(eggSalesItems.saleId, id));
  await db.delete(eggSales).where(eq(eggSales.id, id));
  return NextResponse.json({ ok: true });
}
