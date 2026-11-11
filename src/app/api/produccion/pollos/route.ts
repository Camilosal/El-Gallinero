import { db } from "@/db";
import { broilerBatches, chickenSales, slaughter, mortalityRecords, eggProduction, autoconsumoLogs, weightLogs } from "@/db/schema";
import { eq, desc, sql, inArray, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { batchReadiness } from "@/lib/flock";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockEggInventory, lockMeatInventory } from "@/lib/inventory-locks";
import { deleteChickenSalesAndLinkedFinance } from "@/lib/animal-sales";
import { computeEggInventory, eggInventoryBookBalance, computeMeatInventory, meatInventoryBookBalance } from "@/lib/inventory";
import { validateBreedAssociation } from "@/lib/animal-breed-validation";
import { normalizeManagedSpecies } from "@/lib/animal-breeds";

export const dynamic = "force-dynamic";

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

/** Las nuevas altas de lotes deben registrarse en Adquisiciones. */
export const POST = withApiHandler(async () => NextResponse.json({
  error: "Registra los nuevos lotes desde Adquisiciones para conservar su especie, destino y origen.",
  href: "/dashboard/produccion/adquisiciones?nuevo=lote_pollos",
}, { status: 409 }));

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const species = normalizeManagedSpecies(String(body.species || ""));
  if (!species || species === "gallina") return NextResponse.json({ error: "Especie de lote inválida" }, { status: 400 });
  const breedError = await validateBreedAssociation(db, String(body.breed || ""), species);
  if (breedError) return NextResponse.json({ error: breedError }, { status: 400 });

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
