import { db } from "@/db";
import { slaughter, transactions, hens, roosters, broilerBatches } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import {
  validateRoosterForExit, validateBatchForExit,
  applyRoosterExit, restoreRoosterExit, applyBatchExit, restoreBatchExit,
} from "@/lib/birdExit";

export const dynamic = "force-dynamic";

// GET /api/sacrificio — lista de registros de sacrificio (con info de gallina)
export async function GET() {
  const data = await db.select().from(slaughter).orderBy(desc(slaughter.date)).limit(100);
  
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

// POST /api/sacrificio — registrar sacrificio
export async function POST(req: NextRequest) {
  const body = await req.json();

  const qty = Number(body.quantity);
  if (!body.birdType) return NextResponse.json({ error: "Tipo de ave requerido" }, { status: 400 });
  if (!qty || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const weightKg = Number(body.weightKg);
  if (!weightKg || weightKg <= 0) return NextResponse.json({ error: "Peso requerido" }, { status: 400 });

  // Se requiere vincular un ave: gallina, gallo o lote
  if (!body.henId && !body.roosterId && !body.batchId) {
    return NextResponse.json({ error: "Debe seleccionar una gallina, un gallo o un lote" }, { status: 400 });
  }

  // Validate hen exists and is active
  if (body.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para sacrificio (estado: ${hen.status})` }, { status: 400 });
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

  const destination = body.destination || "consumo_propio";
  const pricePerKg = body.pricePerKg ? Number(body.pricePerKg) : null;
  const totalAmount = destination === "venta" && pricePerKg ? (pricePerKg * weightKg).toFixed(2) : null;

  const [created] = await db.insert(slaughter).values({
    date: body.date,
    birdType: body.birdType,
    quantity: qty,
    weightKg: String(weightKg),
    destination,
    pricePerKg: pricePerKg ? String(pricePerKg) : null,
    totalAmount,
    henId: body.henId || null,
    roosterId: body.roosterId || null,
    batchId: body.batchId || null,
    notes: body.notes || null,
  }).returning();

  // Change hen status to "faena" if linked
  if (body.henId) {
    await db.update(hens).set({ status: "faena" }).where(eq(hens.id, body.henId));
  }
  // Change rooster status to "faena" if linked
  if (body.roosterId) {
    await applyRoosterExit(body.roosterId, "sacrificio");
  }
  // Discount batch quantity if linked
  if (body.batchId) {
    await applyBatchExit(body.batchId, qty, "sacrificio");
  }

  // If destination is "venta", create income transaction
  if (destination === "venta" && totalAmount && pricePerKg) {
    const birdLabel = body.birdType.replace(/_/g, " ");
    await db.insert(transactions).values({
      date: body.date,
      type: "ingreso",
      category: "Venta de carne",
      description: `Venta de ${weightKg} kg carne de ${birdLabel} (${qty} ave${qty > 1 ? "s" : ""})`,
      amount: totalAmount,
      quantity: String(weightKg),
      unitPrice: String(pricePerKg),
      unit: "kg",
      sourceType: "sacrificio",
      sourceId: created.id,
    });
  }

  return NextResponse.json(created, { status: 201 });
}

// PUT /api/sacrificio — actualizar registro
export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const qty = Number(body.quantity);
  const weightKg = Number(body.weightKg);
  if (!qty || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  if (!weightKg || weightKg <= 0) return NextResponse.json({ error: "Peso requerido" }, { status: 400 });

  // Get existing record to check old henId
  const [existing] = await db.select().from(slaughter).where(eq(slaughter.id, body.id));
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Validate new hen if changed
  if (body.henId && body.henId !== existing.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para sacrificio (estado: ${hen.status})` }, { status: 400 });
    }
  }

  // Validate new rooster/batch if changed (revertir el anterior para validar stock real)
  if (existing.batchId) await restoreBatchExit(existing.batchId, existing.quantity);
  if (body.roosterId && body.roosterId !== existing.roosterId) {
    const err = await validateRoosterForExit(body.roosterId);
    if (err) {
      if (existing.batchId) await applyBatchExit(existing.batchId, existing.quantity, "sacrificio");
      return NextResponse.json({ error: err }, { status: err === "Gallo no encontrado" ? 404 : 400 });
    }
  }
  if (body.batchId) {
    const err = await validateBatchForExit(body.batchId, qty);
    if (err) {
      if (existing.batchId) await applyBatchExit(existing.batchId, existing.quantity, "sacrificio");
      return NextResponse.json({ error: err }, { status: err === "Lote no encontrado" ? 404 : 400 });
    }
  }

  const destination = body.destination || "consumo_propio";
  const pricePerKg = body.pricePerKg ? Number(body.pricePerKg) : null;
  const totalAmount = destination === "venta" && pricePerKg ? (pricePerKg * weightKg).toFixed(2) : null;

  const [updated] = await db.update(slaughter).set({
    date: body.date,
    birdType: body.birdType,
    quantity: qty,
    weightKg: String(weightKg),
    destination,
    pricePerKg: pricePerKg ? String(pricePerKg) : null,
    totalAmount,
    henId: body.henId || null,
    roosterId: body.roosterId || null,
    batchId: body.batchId || null,
    notes: body.notes || null,
  }).where(eq(slaughter.id, body.id)).returning();

  // Update hen statuses
  // Restore old hen to "activa" if it was linked
  if (existing.henId && existing.henId !== body.henId) {
    await db.update(hens).set({ status: "activa" }).where(eq(hens.id, existing.henId));
  }
  // Set new hen to "faena" if linked
  if (body.henId && body.henId !== existing.henId) {
    await db.update(hens).set({ status: "faena" }).where(eq(hens.id, body.henId));
  }

  // Update rooster/batch statuses (el lote ya fue restaurado arriba para validar)
  if (existing.roosterId && existing.roosterId !== body.roosterId) {
    await restoreRoosterExit(existing.roosterId);
  }
  if (body.roosterId && body.roosterId !== existing.roosterId) {
    await applyRoosterExit(body.roosterId, "sacrificio");
  }
  if (body.batchId) {
    await applyBatchExit(body.batchId, qty, "sacrificio");
  }

  // Sync transaction
  const [existingTx] = await db.select().from(transactions)
    .where(and(eq(transactions.sourceType, "sacrificio"), eq(transactions.sourceId, body.id)));

  if (destination === "venta" && totalAmount && pricePerKg) {
    const birdLabel = body.birdType.replace(/_/g, " ");
    const values = {
      date: body.date,
      description: `Venta de ${weightKg} kg carne de ${birdLabel} (${qty} ave${qty > 1 ? "s" : ""})`,
      amount: totalAmount,
      quantity: String(weightKg),
      unitPrice: String(pricePerKg),
      unit: "kg",
    };
    if (existingTx) {
      await db.update(transactions).set(values).where(eq(transactions.id, existingTx.id));
    } else {
      await db.insert(transactions).values({ ...values, type: "ingreso", category: "Venta de carne", sourceType: "sacrificio", sourceId: body.id });
    }
  } else if (existingTx) {
    // No longer a sale — remove transaction
    await db.delete(transactions).where(eq(transactions.id, existingTx.id));
  }

  return NextResponse.json(updated);
}

// DELETE /api/sacrificio — eliminar registro
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // Get record to check henId
  const [record] = await db.select().from(slaughter).where(eq(slaughter.id, id));
  
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

  await db.delete(transactions).where(and(eq(transactions.sourceType, "sacrificio"), eq(transactions.sourceId, id)));
  await db.delete(slaughter).where(eq(slaughter.id, id));
  return NextResponse.json({ ok: true });
}
