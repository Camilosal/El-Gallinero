import { db } from "@/db";
import { chickenSales, transactions, hens, roosters, broilerBatches } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import {
  validateRoosterForExit, validateBatchForExit,
  applyRoosterExit, restoreRoosterExit, applyBatchExit, restoreBatchExit,
} from "@/lib/birdExit";

export const dynamic = "force-dynamic";

// GET /api/ventas-aves — lista de ventas de aves (con info de gallina)
export async function GET() {
  const data = await db.select().from(chickenSales).orderBy(desc(chickenSales.date)).limit(100);
  
  // Enriquecer con datos de gallina/gallo/lote si existen
  const enriched = await Promise.all(
    data.map(async (record) => {
      const [hen] = record.henId
        ? await db.select().from(hens).where(eq(hens.id, record.henId))
        : [undefined];
      const [rooster] = record.roosterId
        ? await db.select().from(roosters).where(eq(roosters.id, record.roosterId))
        : [undefined];
      const [batch] = record.batchId
        ? await db.select().from(broilerBatches).where(eq(broilerBatches.id, record.batchId))
        : [undefined];
      return { ...record, hen: hen || null, rooster: rooster || null, batch: batch || null };
    })
  );
  
  return NextResponse.json(enriched);
}

// POST /api/ventas-aves — crear venta de aves
export async function POST(req: NextRequest) {
  const body = await req.json();

  const qty = Number(body.quantity);
  if (!body.birdType) return NextResponse.json({ error: "Tipo de ave requerido" }, { status: 400 });
  if (!qty || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const pricePerUnit = Number(body.pricePerUnit);
  if (!pricePerUnit || pricePerUnit <= 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });

  // Se requiere vincular un ave: gallina, gallo o lote
  if (!body.henId && !body.roosterId && !body.batchId) {
    return NextResponse.json({ error: "Debe seleccionar una gallina, un gallo o un lote" }, { status: 400 });
  }

  // Validate hen exists and is active if henId provided
  if (body.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para venta (estado: ${hen.status})` }, { status: 400 });
    }
  }

  // Validate rooster if provided
  if (body.roosterId) {
    const err = await validateRoosterForExit(body.roosterId);
    if (err) return NextResponse.json({ error: err }, { status: err === "Gallo no encontrado" ? 404 : 400 });
  }

  // Validate batch if provided
  if (body.batchId) {
    const err = await validateBatchForExit(body.batchId, qty);
    if (err) return NextResponse.json({ error: err }, { status: err === "Lote no encontrado" ? 404 : 400 });
  }

  const priceMode = body.priceMode || "por_ave";
  const weightKg = body.weightKg ? Number(body.weightKg) : null;
  const totalAmount = priceMode === "por_kg" && weightKg
    ? (pricePerUnit * weightKg).toFixed(2)
    : (pricePerUnit * qty).toFixed(2);

  const [created] = await db.insert(chickenSales).values({
    date: body.date,
    birdType: body.birdType,
    quantity: qty,
    weightKg: weightKg ? String(weightKg) : null,
    pricePerUnit: String(pricePerUnit),
    priceMode,
    totalAmount,
    buyer: body.buyer || null,
    presentation: body.presentation || null,
    henId: body.henId || null,
    roosterId: body.roosterId || null,
    batchId: body.batchId || null,
    notes: body.notes || null,
  }).returning();

  // Change hen status to "vendida" if linked
  if (body.henId) {
    await db.update(hens).set({ status: "vendida" }).where(eq(hens.id, body.henId));
  }
  // Change rooster status to "vendido" if linked
  if (body.roosterId) {
    await applyRoosterExit(body.roosterId, "venta");
  }
  // Discount batch quantity if linked
  if (body.batchId) {
    await applyBatchExit(body.batchId, qty, "venta");
  }

  // Create linked income transaction
  const birdLabel = body.birdType.replace(/_/g, " ");
  const weightDesc = weightKg ? ` (${weightKg} kg)` : "";
  await db.insert(transactions).values({
    date: body.date,
    type: "ingreso",
    category: "Venta de aves",
    description: `Venta de ${qty} ${birdLabel}${weightDesc}${body.buyer ? ` a ${body.buyer}` : ""}`,
    amount: totalAmount,
    quantity: String(qty),
    unitPrice: String(pricePerUnit),
    unit: priceMode === "por_kg" ? "kg" : "aves",
    counterparty: body.buyer || null,
    sourceType: "venta_ave",
    sourceId: created.id,
  });

  return NextResponse.json(created, { status: 201 });
}

// PUT /api/ventas-aves — actualizar venta de aves
export async function PUT(req: NextRequest) {
  const body = await req.json();

  const qty = Number(body.quantity);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (!qty || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const pricePerUnit = Number(body.pricePerUnit);
  if (!pricePerUnit || pricePerUnit <= 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });

  // Se requiere vincular un ave: gallina, gallo o lote
  if (!body.henId && !body.roosterId && !body.batchId) {
    return NextResponse.json({ error: "Debe seleccionar una gallina, un gallo o un lote" }, { status: 400 });
  }

  // Get existing record to check old henId
  const [existing] = await db.select().from(chickenSales).where(eq(chickenSales.id, body.id));
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Validate new hen if changed
  if (body.henId && body.henId !== existing.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para venta (estado: ${hen.status})` }, { status: 400 });
    }
  }

  // Validate new rooster/batch if changed (revertir el anterior para validar stock real)
  if (existing.batchId) await restoreBatchExit(existing.batchId, existing.quantity);
  if (body.roosterId && body.roosterId !== existing.roosterId) {
    const err = await validateRoosterForExit(body.roosterId);
    if (err) {
      if (existing.batchId) await applyBatchExit(existing.batchId, existing.quantity, "venta");
      return NextResponse.json({ error: err }, { status: err === "Gallo no encontrado" ? 404 : 400 });
    }
  }
  if (body.batchId) {
    const err = await validateBatchForExit(body.batchId, qty);
    if (err) {
      if (existing.batchId) await applyBatchExit(existing.batchId, existing.quantity, "venta");
      return NextResponse.json({ error: err }, { status: err === "Lote no encontrado" ? 404 : 400 });
    }
  }

  const priceMode = body.priceMode || "por_ave";
  const weightKg = body.weightKg ? Number(body.weightKg) : null;
  const totalAmount = priceMode === "por_kg" && weightKg
    ? (pricePerUnit * weightKg).toFixed(2)
    : (pricePerUnit * qty).toFixed(2);

  const [updated] = await db.update(chickenSales).set({
    date: body.date,
    birdType: body.birdType,
    quantity: qty,
    weightKg: weightKg ? String(weightKg) : null,
    pricePerUnit: String(pricePerUnit),
    priceMode,
    totalAmount,
    buyer: body.buyer || null,
    presentation: body.presentation || null,
    henId: body.henId || null,
    roosterId: body.roosterId || null,
    batchId: body.batchId || null,
    notes: body.notes || null,
  }).where(eq(chickenSales.id, body.id)).returning();

  // Update hen statuses
  // Restore old hen to "activa" if it was linked
  if (existing.henId && existing.henId !== body.henId) {
    await db.update(hens).set({ status: "activa" }).where(eq(hens.id, existing.henId));
  }
  // Set new hen to "vendida" if linked
  if (body.henId && body.henId !== existing.henId) {
    await db.update(hens).set({ status: "vendida" }).where(eq(hens.id, body.henId));
  }

  // Update rooster statuses (el lote ya fue restaurado arriba para validar)
  if (existing.roosterId && existing.roosterId !== body.roosterId) {
    await restoreRoosterExit(existing.roosterId);
  }
  if (body.roosterId && body.roosterId !== existing.roosterId) {
    await applyRoosterExit(body.roosterId, "venta");
  }
  if (body.batchId) {
    await applyBatchExit(body.batchId, qty, "venta");
  }

  // Sync linked income transaction
  const [existingTx] = await db.select().from(transactions)
    .where(and(eq(transactions.sourceType, "venta_ave"), eq(transactions.sourceId, body.id)));

  const birdLabel = body.birdType.replace(/_/g, " ");
  const weightDesc = weightKg ? ` (${weightKg} kg)` : "";
  const values = {
    date: body.date,
    description: `Venta de ${qty} ${birdLabel}${weightDesc}${body.buyer ? ` a ${body.buyer}` : ""}`,
    amount: totalAmount,
    quantity: String(qty),
    unitPrice: String(pricePerUnit),
    unit: priceMode === "por_kg" ? "kg" : "aves",
    counterparty: body.buyer || null,
  };

  if (existingTx) {
    await db.update(transactions).set(values).where(eq(transactions.id, existingTx.id));
  } else {
    await db.insert(transactions).values({ ...values, type: "ingreso", category: "Venta de aves", sourceType: "venta_ave", sourceId: body.id });
  }

  return NextResponse.json(updated);
}

// DELETE /api/ventas-aves — eliminar venta de aves
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // Get record to check henId
  const [record] = await db.select().from(chickenSales).where(eq(chickenSales.id, id));
  
  // Restore hen status to "activa" if linked
  if (record?.henId) {
    await db.update(hens).set({ status: "activa" }).where(eq(hens.id, record.henId));
  }
  // Restore rooster status if linked
  if (record?.roosterId) {
    await restoreRoosterExit(record.roosterId);
  }
  // Return quantity to batch if linked
  if (record?.batchId) {
    await restoreBatchExit(record.batchId, record.quantity);
  }

  await db.delete(transactions).where(and(eq(transactions.sourceType, "venta_ave"), eq(transactions.sourceId, id)));
  await db.delete(chickenSales).where(eq(chickenSales.id, id));
  return NextResponse.json({ ok: true });
}
