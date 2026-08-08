import { db } from "@/db";
import { broilerBatches, chickenSales, slaughter, mortalityRecords } from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { batchReadiness } from "@/lib/flock";

export const dynamic = "force-dynamic";

/** Autogenera el siguiente código de lote (L-001, L-002...) */
async function nextBatchCode(): Promise<string> {
  const [maxRow] = await db.select({ maxCode: sql<string>`max(${broilerBatches.code})` }).from(broilerBatches);
  let max = 0;
  if (maxRow?.maxCode) {
    const m = String(maxRow.maxCode).match(/^L-(\d+)$/);
    if (m) max = Number(m[1]);
  }
  return `L-${String(max + 1).padStart(3, "0")}`;
}

export async function GET() {
  const data = await db.select().from(broilerBatches).orderBy(desc(broilerBatches.createdAt));

  // ─── Sincronización automática: lotes activos que ya cumplen el objetivo ───
  const toMarkReady: string[] = [];
  const enriched = data.map((batch) => {
    const rd = batchReadiness(batch);
    if (batch.status === "activo" && rd.ready) {
      toMarkReady.push(batch.id);
      batch = { ...batch, status: "listo_sacrificio" as typeof batch.status };
    }
    return { ...batch, ageWeeks: rd.ageWeeks, readinessReasons: batch.status === "listo_sacrificio" ? rd.reasons : [] };
  });

  if (toMarkReady.length > 0) {
    await db.update(broilerBatches).set({ status: "listo_sacrificio", updatedAt: new Date() }).where(inArray(broilerBatches.id, toMarkReady));
  }

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const qty = Number(body.initialQuantity);
  if (!body.breed) return NextResponse.json({ error: "Raza requerida" }, { status: 400 });
  if (!qty || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const [created] = await db.insert(broilerBatches).values({
    code: body.code || (await nextBatchCode()),
    breed: body.breed,
    startDate: body.startDate || new Date().toISOString().split("T")[0],
    initialQuantity: qty,
    currentQuantity: qty,
    targetWeeks: body.targetWeeks || 7,
    targetWeightKg: body.targetWeightKg || "2.5",
    avgWeightKg: body.avgWeightKg || null,
    notes: body.notes || null,
  }).returning();

  const rd = batchReadiness(created);
  return NextResponse.json({ ...created, ageWeeks: rd.ageWeeks, readinessReasons: rd.reasons }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [updated] = await db.update(broilerBatches).set({
    code: body.code,
    breed: body.breed,
    startDate: body.startDate,
    initialQuantity: body.initialQuantity,
    currentQuantity: body.currentQuantity,
    targetWeeks: body.targetWeeks,
    targetWeightKg: body.targetWeightKg,
    avgWeightKg: body.avgWeightKg,
    status: body.status,
    notes: body.notes,
    updatedAt: new Date(),
  }).where(eq(broilerBatches.id, body.id)).returning();

  // Reevaluar: si estaba listo pero los nuevos datos ya no cumplen, vuelve a activo
  let status = updated.status;
  const rd = batchReadiness(updated);
  if (updated.status === "listo_sacrificio" && !rd.ready) {
    status = "activo";
    await db.update(broilerBatches).set({ status: "activo", updatedAt: new Date() }).where(eq(broilerBatches.id, updated.id));
  } else if (updated.status === "activo" && rd.ready) {
    status = "listo_sacrificio";
    await db.update(broilerBatches).set({ status: "listo_sacrificio", updatedAt: new Date() }).where(eq(broilerBatches.id, updated.id));
  }

  return NextResponse.json({ ...updated, status, ageWeeks: rd.ageWeeks, readinessReasons: rd.reasons });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    await tx.delete(chickenSales).where(eq(chickenSales.batchId, id));
    await tx.delete(slaughter).where(eq(slaughter.batchId, id));
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.batchId, id));
    await tx.delete(broilerBatches).where(eq(broilerBatches.id, id));
  });
  return NextResponse.json({ ok: true });
}
