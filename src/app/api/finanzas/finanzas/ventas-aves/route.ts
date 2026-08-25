import { db } from "@/db";
import { chickenSales, transactions, hens, roosters, broilerBatches, slaughter, mortalityRecords } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import {
  validateRoosterForExit, validateBatchForExit,
  applyRoosterExit, restoreRoosterExit, applyBatchExit, restoreBatchExit,
} from "@/lib/birdExit";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

// GET /api/finanzas/finanzas/ventas-aves
export const GET = withApiHandler(async () => {
  const data = await db.select().from(chickenSales).orderBy(desc(chickenSales.date)).limit(100);

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

// POST /api/finanzas/finanzas/ventas-aves
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

  const qty = Number(body.quantity);
  if (!body.birdType) return NextResponse.json({ error: "Tipo de ave requerido" }, { status: 400 });
  if (!qty || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const pricePerUnit = Number(body.pricePerUnit);
  if (!pricePerUnit || pricePerUnit <= 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });

  if (!body.henId && !body.roosterId && !body.batchId) {
    return NextResponse.json({ error: "Debe seleccionar una gallina, un gallo o un lote" }, { status: 400 });
  }

  if (body.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para venta (estado: ${hen.status})` }, { status: 400 });
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

  const priceMode = body.priceMode || "por_ave";
  const weightKg = body.weightKg ? Number(body.weightKg) : null;
  const totalAmount = priceMode === "por_kg" && weightKg
    ? (pricePerUnit * weightKg).toFixed(2)
    : (pricePerUnit * qty).toFixed(2);

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(chickenSales).values({
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

    if (body.henId) {
      await tx.update(hens).set({ status: "vendida" }).where(eq(hens.id, body.henId));
    }

    const birdLabel = body.birdType.replace(/_/g, " ");
    const weightDesc = weightKg ? ` (${weightKg} kg)` : "";
    await tx.insert(transactions).values({
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
      sourceId: inserted.id,
    });

    if (body.roosterId) {
      await applyRoosterExit(body.roosterId, "venta", tx);
    }
    if (body.batchId) {
      await applyBatchExit(body.batchId, qty, "venta", tx);
    }

    return inserted;
  });

  return NextResponse.json(created, { status: 201 });
});

// PUT /api/finanzas/finanzas/ventas-aves
export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

  const qty = Number(body.quantity);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (!qty || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const pricePerUnit = Number(body.pricePerUnit);
  if (!pricePerUnit || pricePerUnit <= 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });

  if (!body.henId && !body.roosterId && !body.batchId) {
    return NextResponse.json({ error: "Debe seleccionar una gallina, un gallo o un lote" }, { status: 400 });
  }

  const [existing] = await db.select().from(chickenSales).where(eq(chickenSales.id, body.id));
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (body.henId && body.henId !== existing.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para venta (estado: ${hen.status})` }, { status: 400 });
    }
  }

  const priceMode = body.priceMode || "por_ave";
  const weightKg = body.weightKg ? Number(body.weightKg) : null;
  const totalAmount = priceMode === "por_kg" && weightKg
    ? (pricePerUnit * weightKg).toFixed(2)
    : (pricePerUnit * qty).toFixed(2);

  try {
    await db.transaction(async (tx) => {
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

      await tx.update(chickenSales).set({
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
      }).where(eq(chickenSales.id, body.id));

      if (existing.henId && existing.henId !== body.henId) {
        await tx.update(hens).set({ status: "activa" }).where(eq(hens.id, existing.henId));
      }
      if (body.henId && body.henId !== existing.henId) {
        await tx.update(hens).set({ status: "vendida" }).where(eq(hens.id, body.henId));
      }

      const [existingTx] = await tx.select().from(transactions)
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
        await tx.update(transactions).set(values).where(eq(transactions.id, existingTx.id));
      } else {
        await tx.insert(transactions).values({ ...values, type: "ingreso", category: "Venta de aves", sourceType: "venta_ave", sourceId: body.id });
      }

      if (existing.roosterId && existing.roosterId !== body.roosterId) {
        await restoreRoosterExit(existing.roosterId, tx);
      }
      if (body.roosterId && body.roosterId !== existing.roosterId) {
        await applyRoosterExit(body.roosterId, "venta", tx);
      }
      if (body.batchId && body.batchId !== existing.batchId) {
        await applyBatchExit(body.batchId, qty, "venta", tx);
      }
    });
  } catch (e: any) {
    const msg = e.message || "";
    if (msg === "Gallo no encontrado") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "Lote no encontrado" || msg.startsWith("Stock insuficiente")) return NextResponse.json({ error: msg }, { status: 400 });
    throw e;
  }

  const [updated] = await db.select().from(chickenSales).where(eq(chickenSales.id, body.id));
  return NextResponse.json(updated);
});

// DELETE /api/finanzas/finanzas/ventas-aves
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [record] = await db.select().from(chickenSales).where(eq(chickenSales.id, id));
  if (!record) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.transaction(async (tx) => {
    if (record.henId) {
      // Check no subsequent exit before restoring
      const [otherSlaughter] = await tx.select({ id: slaughter.id })
        .from(slaughter)
        .where(eq(slaughter.henId, record.henId))
        .limit(1);
      const [otherSale] = await tx.select({ id: chickenSales.id })
        .from(chickenSales)
        .where(and(eq(chickenSales.henId, record.henId), sql`${chickenSales.id} != ${record.id}`))
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

    await tx.delete(transactions).where(and(eq(transactions.sourceType, "venta_ave"), eq(transactions.sourceId, id)));
    await tx.delete(chickenSales).where(eq(chickenSales.id, id));
  });

  return NextResponse.json({ ok: true });
});
