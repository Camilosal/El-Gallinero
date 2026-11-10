import { db } from "@/db";
import { broilerBatches, chickenSales, slaughter, mortalityRecords, eggProduction, autoconsumoLogs, weightLogs } from "@/db/schema";
import { eq, desc, sql, inArray, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { batchReadiness } from "@/lib/flock";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockEggInventory, lockMeatInventory } from "@/lib/inventory-locks";
import { deleteChickenSalesAndLinkedFinance } from "@/lib/animal-sales";
import { computeEggInventory, eggInventoryBookBalance, computeMeatInventory, meatInventoryBookBalance } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/** Autogenera el siguiente código de lote según la especie */
async function nextBatchCode(species: string | undefined, client: any = db): Promise<string> {
  const prefix = species === "codorniz" ? "L-COD-"
    : species === "pato" ? "L-PAT-"
    : species === "conejo" ? "L-CON-"
    : "L-";

  const rows = await client.select({ code: broilerBatches.code })
    .from(broilerBatches)
    .where(sql`${broilerBatches.code} LIKE ${prefix + '%'}`);

  let max = 0;
  {
    const regex = new RegExp(`^${prefix.replace("-", "\\-")}(\\d+)$`);
    for (const row of rows) {
      const m = String(row.code).match(regex);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export const GET = withApiHandler(async (req: NextRequest) => {
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
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
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

  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${broilerBatches} IN EXCLUSIVE MODE`);
    const code = body.code ? String(body.code).trim() : await nextBatchCode(species, tx);
    const [duplicate] = await tx.select({ id: broilerBatches.id }).from(broilerBatches).where(eq(broilerBatches.code, code)).limit(1);
    if (duplicate) throw new Error("Código de lote duplicado");
    const [row] = await tx.insert(broilerBatches).values({
      code,
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
    return row;
  });

  const rd = batchReadiness(created);
  return NextResponse.json({ ...created, ageWeeks: rd.ageWeeks, readinessReasons: rd.reasons }, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${broilerBatches} IN EXCLUSIVE MODE`);
    if (body.code !== undefined) {
      const code = String(body.code || "").trim();
      if (!code) throw new Error("Código requerido");
      const [duplicate] = await tx.select({ id: broilerBatches.id }).from(broilerBatches)
        .where(and(eq(broilerBatches.code, code), sql`${broilerBatches.id} <> ${body.id}`)).limit(1);
      if (duplicate) throw new Error("Código de lote duplicado");
      body.code = code;
    }
    const [row] = await tx.update(broilerBatches).set({
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
    return row;
  });

  if (!updated) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

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
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    const [batch] = await tx.select({ id: broilerBatches.id }).from(broilerBatches).where(eq(broilerBatches.id, id)).for("update");
    if (!batch) throw new Error("Lote no encontrado");
    const [linkedMortality] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords)
      .where(and(eq(mortalityRecords.batchId, id), sql`${mortalityRecords.healthControlId} IS NOT NULL`)).limit(1);
    if (linkedMortality) throw new Error("Registro ligado a control sanitario: elimina primero el control desde Sanidad");
    await lockEggInventory(tx);
    await lockMeatInventory(tx);
    const eggInventoryBefore = await computeEggInventory(tx);
    const meatInventoryBefore = await computeMeatInventory(tx);
    await deleteChickenSalesAndLinkedFinance(tx, eq(chickenSales.batchId, id));
    await tx.delete(autoconsumoLogs).where(eq(autoconsumoLogs.batchId, id));
    await tx.delete(weightLogs).where(eq(weightLogs.batchId, id));
    await tx.delete(eggProduction).where(eq(eggProduction.batchId, id));
    await tx.delete(slaughter).where(eq(slaughter.batchId, id));
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.batchId, id));
    await tx.delete(broilerBatches).where(eq(broilerBatches.id, id));

    const eggInventoryAfter = await computeEggInventory(tx);
    if (eggInventoryBookBalance(eggInventoryAfter) < Math.min(0, eggInventoryBookBalance(eggInventoryBefore)) - 0.0001) {
      throw new Error("No se puede eliminar el lote porque tiene huevos ya vendidos o perdidos");
    }
    const meatInventoryAfter = await computeMeatInventory(tx);
    if (meatInventoryBookBalance(meatInventoryAfter) < Math.min(0, meatInventoryBookBalance(meatInventoryBefore)) - 0.01) {
      throw new Error("No se puede eliminar el lote porque tiene carne ya vendida o perdida");
    }
  });
  return NextResponse.json({ ok: true });
});
