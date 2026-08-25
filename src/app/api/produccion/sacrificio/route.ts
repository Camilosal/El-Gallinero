import { db } from "@/db";
import { slaughter, hens, roosters, broilerBatches, chickenSales, mortalityRecords } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import {
  validateRoosterForExit, validateBatchForExit,
  applyRoosterExit, restoreRoosterExit, applyBatchExit, restoreBatchExit,
} from "@/lib/birdExit";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

// GET /api/produccion/sacrificio — lista de registros de sacrificio (producción de carne)
export const GET = withApiHandler(async () => {
  const data = await db.select().from(slaughter).orderBy(desc(slaughter.date)).limit(100);

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
});

// POST /api/produccion/sacrificio — registrar sacrificio (producción pura, siempre va a inventario)
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

  const qty = Number(body.quantity);
  if (!body.birdType) return NextResponse.json({ error: "Tipo de ave requerido" }, { status: 400 });
  if (!qty || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const weightKg = Number(body.weightKg);
  if (!weightKg || weightKg <= 0) return NextResponse.json({ error: "Peso requerido" }, { status: 400 });

  if (!body.henId && !body.roosterId && !body.batchId) {
    return NextResponse.json({ error: "Debe seleccionar una gallina, un gallo o un lote" }, { status: 400 });
  }

  if (body.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para sacrificio (estado: ${hen.status})` }, { status: 400 });
    }
  }

  if (body.roosterId) {
    const err = await validateRoosterForExit(body.roosterId);
    if (err) return NextResponse.json({ error: err }, { status: err === "Gallo no encontrado" ? 404 : 400 });
  }

  if (body.batchId) {
    const err = await validateBatchForExit(body.batchId, qty);
    if (err) return NextResponse.json({ error: err }, { status: err === "Lote no encontrado" ? 404 : 400 });
  }

  const destination = body.destination || "consumo_propio";

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(slaughter).values({
      date: body.date,
      birdType: body.birdType,
      quantity: qty,
      weightKg: String(weightKg),
      destination,
      pricePerKg: null,
      totalAmount: null,
      henId: body.henId || null,
      roosterId: body.roosterId || null,
      batchId: body.batchId || null,
      notes: body.notes || null,
    }).returning();

    if (body.henId) {
      await tx.update(hens).set({ status: "faena" }).where(eq(hens.id, body.henId));
    }
    if (body.roosterId) {
      await applyRoosterExit(body.roosterId, "sacrificio", tx);
    }
    if (body.batchId) {
      await applyBatchExit(body.batchId, qty, "sacrificio", tx);
    }

    return inserted;
  });

  return NextResponse.json(created, { status: 201 });
});

// PUT /api/produccion/sacrificio — actualizar registro
export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const qty = Number(body.quantity);
  const weightKg = Number(body.weightKg);
  if (!qty || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  if (!weightKg || weightKg <= 0) return NextResponse.json({ error: "Peso requerido" }, { status: 400 });

  const [existing] = await db.select().from(slaughter).where(eq(slaughter.id, body.id));
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (body.henId && body.henId !== existing.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para sacrificio (estado: ${hen.status})` }, { status: 400 });
    }
  }

  const destination = body.destination || "consumo_propio";

  let updated;
  try {
    updated = await db.transaction(async (tx) => {
      if (body.roosterId && body.roosterId !== existing.roosterId) {
        const err = await validateRoosterForExit(body.roosterId);
        if (err) throw new Error(err);
      }
      if (body.batchId) {
        const err = await validateBatchForExit(body.batchId, qty);
        if (err) throw new Error(err);
      }
      if (existing.batchId && existing.batchId !== body.batchId) {
        await restoreBatchExit(existing.batchId, existing.quantity, tx);
      }

      const [upd] = await tx.update(slaughter).set({
        date: body.date,
        birdType: body.birdType,
        quantity: qty,
        weightKg: String(weightKg),
        destination,
        henId: body.henId || null,
        roosterId: body.roosterId || null,
        batchId: body.batchId || null,
        notes: body.notes || null,
      }).where(eq(slaughter.id, body.id)).returning();

      if (existing.henId && existing.henId !== body.henId) {
        await tx.update(hens).set({ status: "activa" }).where(eq(hens.id, existing.henId));
      }
      if (body.henId && body.henId !== existing.henId) {
        await tx.update(hens).set({ status: "faena" }).where(eq(hens.id, body.henId));
      }

      if (existing.roosterId && existing.roosterId !== body.roosterId) {
        await restoreRoosterExit(existing.roosterId, tx);
      }
      if (body.roosterId && body.roosterId !== existing.roosterId) {
        await applyRoosterExit(body.roosterId, "sacrificio", tx);
      }
      if (body.batchId && body.batchId !== existing.batchId) {
        await applyBatchExit(body.batchId, qty, "sacrificio", tx);
      }

      return upd;
    });
  } catch (e: any) {
    const msg = e.message || "";
    if (msg === "Gallo no encontrado") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "Lote no encontrado" || msg.startsWith("Stock insuficiente")) return NextResponse.json({ error: msg }, { status: 400 });
    throw e;
  }

  return NextResponse.json(updated);
});

// DELETE /api/produccion/sacrificio — eliminar registro
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [record] = await db.select().from(slaughter).where(eq(slaughter.id, id));
  if (!record) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.transaction(async (tx) => {
    if (record.henId) {
      // Check no subsequent exit before restoring
      const [otherSlaughter] = await tx.select({ id: slaughter.id })
        .from(slaughter)
        .where(and(eq(slaughter.henId, record.henId), sql`${slaughter.id} != ${record.id}`))
        .limit(1);
      const [otherSale] = await tx.select({ id: chickenSales.id })
        .from(chickenSales)
        .where(eq(chickenSales.henId, record.henId))
        .limit(1);
      const [hasMortality] = await tx.select({ id: mortalityRecords.id })
        .from(mortalityRecords)
        .where(eq(mortalityRecords.henId, record.henId))
        .limit(1);
      if (!otherSlaughter && !otherSale && !hasMortality) {
        await tx.update(hens).set({ status: "activa" }).where(eq(hens.id, record.henId));
      }
    }
    if (record.roosterId) {
      await restoreRoosterExit(record.roosterId, tx);
    }
    if (record.batchId) {
      await restoreBatchExit(record.batchId, record.quantity, tx);
    }

    await tx.delete(slaughter).where(eq(slaughter.id, id));
  });

  return NextResponse.json({ ok: true });
});
