import { db } from "@/db";
import { hens, catalogos, incubation, chickenSales, slaughter, mortalityRecords, autoconsumoLogs } from "@/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { evaluateLifecycle, isAutoManaged, type StageRange } from "@/lib/lifecycle";
import { getLifecycleRules } from "@/lib/settings";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockMeatInventory } from "@/lib/inventory-locks";
import { deleteChickenSalesAndLinkedFinance } from "@/lib/animal-sales";
import { computeMeatInventory, meatInventoryBookBalance } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/** Etapas de crecimiento activas (catálogo) */
async function getStages(): Promise<StageRange[]> {
  return db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
    .orderBy(sql`${catalogos.sortOrder}`);
}

export const GET = withApiHandler(async () => {
  const [data, stages, lifecycleRules] = await Promise.all([
    db.select().from(hens).orderBy(desc(hens.createdAt)),
    getStages(),
    getLifecycleRules(),
  ]);

  // ─── Sincronización automática del ciclo de vida ───
  // Solo aplica a estados automáticos (activa / recomendada_sacrificio).
  const toRecommend: string[] = [];
  const toActivate: string[] = [];
  const enriched = data.map((hen) => {
    const lc = evaluateLifecycle(hen, stages, lifecycleRules);
    if (isAutoManaged(hen.status) && lc.status !== hen.status) {
      if (lc.status === "recomendada_sacrificio") toRecommend.push(hen.id);
      else toActivate.push(hen.id);
      hen = { ...hen, status: lc.status as typeof hen.status };
    }
    return { ...hen, stage: lc.stage, ageWeeks: lc.ageWeeks, lifecycleReasons: lc.reasons };
  });

  // Persistir transiciones (batch por estado destino)
  if (toRecommend.length > 0) {
    await db.update(hens).set({ status: "recomendada_sacrificio", updatedAt: new Date() }).where(inArray(hens.id, toRecommend));
  }
  if (toActivate.length > 0) {
    await db.update(hens).set({ status: "activa", updatedAt: new Date() }).where(inArray(hens.id, toActivate));
  }

  return NextResponse.json(enriched);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const [stages, lifecycleRules] = await Promise.all([getStages(), getLifecycleRules()]);

  // Resolver estado automático a partir del estado inicial registrado
  let status = body.status || "activa";
  if (isAutoManaged(status)) {
    status = evaluateLifecycle({ birthDate: body.birthDate, weight: body.weight || null, status }, stages, lifecycleRules).status;
  }

  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${hens} IN EXCLUSIVE MODE`);
    const code = String(body.code || "").trim();
    if (!code) throw new Error("Código requerido");
    const [duplicate] = await tx.select({ id: hens.id }).from(hens).where(eq(hens.code, code)).limit(1);
    if (duplicate) throw new Error("Código de gallina duplicado");
    const [row] = await tx.insert(hens).values({
      code,
      breed: body.breed,
      birthDate: body.birthDate,
      status,
      weight: body.weight || null,
      notes: body.notes || null,
      isBroody: body.isBroody || false,
      clutchSize: body.clutchSize || 0,
    }).returning();
    return row;
  });

  const lc = evaluateLifecycle(created, stages, lifecycleRules);
  return NextResponse.json({ ...created, stage: lc.stage, ageWeeks: lc.ageWeeks, lifecycleReasons: lc.reasons }, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [stages, lifecycleRules] = await Promise.all([getStages(), getLifecycleRules()]);

  // Si el estado enviado es automático, resolverlo según edad/peso
  let status = body.status;
  if (status && isAutoManaged(status)) {
    status = evaluateLifecycle({ birthDate: body.birthDate, weight: body.weight || null, status }, stages, lifecycleRules).status;
  }

  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${hens} IN EXCLUSIVE MODE`);
    if (body.code !== undefined) {
      const code = String(body.code || "").trim();
      if (!code) throw new Error("Código requerido");
      const [duplicate] = await tx.select({ id: hens.id }).from(hens)
        .where(and(eq(hens.code, code), sql`${hens.id} <> ${body.id}`)).limit(1);
      if (duplicate) throw new Error("Código de gallina duplicado");
      body.code = code;
    }
    const [row] = await tx.update(hens).set({
      code: body.code,
      breed: body.breed,
      birthDate: body.birthDate,
      status,
      weight: body.weight,
      notes: body.notes,
      isBroody: body.isBroody,
      clutchSize: body.clutchSize,
      updatedAt: new Date(),
    }).where(eq(hens.id, body.id)).returning();
    return row;
  });

  if (!updated) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const lc = evaluateLifecycle(updated, stages, lifecycleRules);
  return NextResponse.json({ ...updated, stage: lc.stage, ageWeeks: lc.ageWeeks, lifecycleReasons: lc.reasons });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    const [hen] = await tx.select({ id: hens.id }).from(hens).where(eq(hens.id, id)).for("update");
    if (!hen) throw new Error("Gallina no encontrada");
    const [linkedMortality] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords)
      .where(and(eq(mortalityRecords.henId, id), sql`${mortalityRecords.healthControlId} IS NOT NULL`)).limit(1);
    if (linkedMortality) throw new Error("Registro ligado a control sanitario: elimina primero el control desde Sanidad");
    await lockMeatInventory(tx);
    const inventoryBefore = await computeMeatInventory(tx);
    await tx.delete(incubation).where(eq(incubation.henId, id));
    await deleteChickenSalesAndLinkedFinance(tx, eq(chickenSales.henId, id));
    const slaughterRows = await tx.select({ id: slaughter.id }).from(slaughter).where(eq(slaughter.henId, id));
    const slaughterIds = slaughterRows.map((record) => record.id);
    if (slaughterIds.length > 0) {
      await tx.delete(autoconsumoLogs).where(inArray(autoconsumoLogs.slaughterId, slaughterIds));
    }
    await tx.delete(slaughter).where(eq(slaughter.henId, id));
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.henId, id));
    await tx.delete(hens).where(eq(hens.id, id));
    const inventoryAfter = await computeMeatInventory(tx);
    if (meatInventoryBookBalance(inventoryAfter) < Math.min(0, meatInventoryBookBalance(inventoryBefore)) - 0.01) {
      throw new Error("No se puede eliminar la gallina porque su carne ya fue vendida o perdida");
    }
  });
  return NextResponse.json({ ok: true });
});
