import { db } from "@/db";
import { broilerBatches, chickenSales, slaughter, mortalityRecords } from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { batchReadiness } from "@/lib/flock";

export const dynamic = "force-dynamic";

/** Autogenera el siguiente código de lote según la especie */
async function nextBatchCode(species?: string): Promise<string> {
  const prefix = species === "codorniz" ? "L-COD-"
    : species === "pato" ? "L-PAT-"
    : species === "conejo" ? "L-CON-"
    : "L-";

  const [maxRow] = await db.select({ maxCode: sql<string>`max(${broilerBatches.code})` })
    .from(broilerBatches)
    .where(sql`${broilerBatches.code} LIKE ${prefix + '%'}`);

  let max = 0;
  if (maxRow?.maxCode) {
    const regex = new RegExp(`^${prefix.replace("-", "\\-")}(\\d+)$`);
    const m = String(maxRow.maxCode).match(regex);
    if (m) max = Number(m[1]);
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const speciesFilter = searchParams.get("species");

  let query = db.select().from(broilerBatches);
  const data = speciesFilter && speciesFilter !== "all"
    ? await query.where(eq(broilerBatches.species, speciesFilter as any)).orderBy(desc(broilerBatches.createdAt))
    : await query.orderBy(desc(broilerBatches.createdAt));

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

  const species = body.species || "pollo";
  const defaultTargetWeeks = species === "codorniz" ? 5
    : species === "pato" ? 9
    : species === "conejo" ? 11
    : 7;

  const defaultTargetWeight = species === "codorniz" ? "0.15"
    : species === "pato" ? "3.2"
    : species === "conejo" ? "2.4"
    : "2.5";

  const [created] = await db.insert(broilerBatches).values({
    code: body.code || (await nextBatchCode(species)),
    species,
    purpose: body.purpose || "engorde_carne",
    systemType: body.systemType || "piso",
    breed: body.breed,
    startDate: body.startDate || new Date().toISOString().split("T")[0],
    initialQuantity: qty,
    currentQuantity: qty,
    targetWeeks: body.targetWeeks || defaultTargetWeeks,
    targetDays: body.targetDays || (body.targetWeeks ? body.targetWeeks * 7 : defaultTargetWeeks * 7),
    targetWeightKg: body.targetWeightKg || defaultTargetWeight,
    avgWeightKg: body.avgWeightKg || null,
    feedConversionTarget: body.feedConversionTarget || null,
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
    species: body.species,
    purpose: body.purpose,
    systemType: body.systemType,
    breed: body.breed,
    startDate: body.startDate,
    initialQuantity: body.initialQuantity,
    currentQuantity: body.currentQuantity,
    targetWeeks: body.targetWeeks,
    targetDays: body.targetDays,
    targetWeightKg: body.targetWeightKg,
    avgWeightKg: body.avgWeightKg,
    feedConversionTarget: body.feedConversionTarget,
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
