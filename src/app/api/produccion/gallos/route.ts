import { db } from "@/db";
import { roosters, chickenSales, slaughter, mortalityRecords, autoconsumoLogs } from "@/db/schema";
import { desc, eq, sql, inArray, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ageInWeeks } from "@/lib/lifecycle";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockMeatInventory } from "@/lib/inventory-locks";
import { deleteChickenSalesAndLinkedFinance } from "@/lib/animal-sales";
import { computeMeatInventory, meatInventoryBookBalance } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/** Autogenera el siguiente código de gallo: GA-001, GA-002, ... */
async function nextRoosterCode(client: any = db): Promise<string> {
  const rows = await client
    .select({ code: roosters.code })
    .from(roosters)
    .where(sql`${roosters.code} LIKE 'GA-%'`);

  let max = 0;
  for (const row of rows) {
    const match = String(row.code).match(/^GA-(\d+)$/);
    if (match) max = Number(match[1]);
  }
  return `GA-${String(max + 1).padStart(3, "0")}`;
}

function serialize(row: typeof roosters.$inferSelect) {
  return {
    ...row,
    ageWeeks: Math.floor(ageInWeeks(row.birthDate)),
    weight: row.weight != null ? Number(row.weight) : null,
  };
}

/**
 * GET /api/produccion/gallos
 * Lista de gallos reproductores con edad calculada. Se usa en la UI y en el
 * asistente para identificar el animal antes de registrar una venta o muerte.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const soloActivos = searchParams.get("active") === "true";

  const base = db.select().from(roosters);
  const rows = status
    ? await base
        .where(eq(roosters.status, status as (typeof roosters.status.enumValues)[number]))
        .orderBy(desc(roosters.createdAt))
    : soloActivos
      ? await base.where(eq(roosters.status, "activo")).orderBy(desc(roosters.createdAt))
      : await base.orderBy(desc(roosters.createdAt));

  return NextResponse.json(rows.map(serialize));
});

/** POST /api/produccion/gallos — crea un gallo reproductor. */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.breed) return NextResponse.json({ error: "Raza requerida" }, { status: 400 });
  if (!body.birthDate) return NextResponse.json({ error: "Fecha de nacimiento requerida" }, { status: 400 });

  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${roosters} IN EXCLUSIVE MODE`);
    const code = body.code ? String(body.code).trim() : await nextRoosterCode(tx);
    const [duplicate] = await tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.code, code)).limit(1);
    if (duplicate) throw new Error("Código de gallo duplicado");
    const [row] = await tx.insert(roosters).values({
      code,
      breed: String(body.breed).trim(),
      birthDate: body.birthDate,
      status: body.status || "activo",
      weight: body.weight ? String(body.weight) : null,
      notes: body.notes || null,
      acquisitionId: body.acquisitionId || null,
      acquisitionCost: body.acquisitionCost ? String(body.acquisitionCost) : null,
    }).returning();
    return row;
  });

  return NextResponse.json(serialize(created), { status: 201 });
});

/** PUT /api/produccion/gallos — actualiza un gallo existente. */
export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${roosters} IN EXCLUSIVE MODE`);
    if (body.code !== undefined) {
      const code = String(body.code || "").trim();
      if (!code) throw new Error("Código requerido");
      const [duplicate] = await tx.select({ id: roosters.id }).from(roosters)
        .where(and(eq(roosters.code, code), sql`${roosters.id} <> ${body.id}`)).limit(1);
      if (duplicate) throw new Error("Código de gallo duplicado");
      body.code = code;
    }
    const [row] = await tx.update(roosters).set({
      code: body.code,
      breed: body.breed,
      birthDate: body.birthDate,
      status: body.status,
      weight: body.weight,
      notes: body.notes,
      updatedAt: new Date(),
    }).where(eq(roosters.id, body.id)).returning();
    return row;
  });

  if (!updated) return NextResponse.json({ error: "Gallo no encontrado" }, { status: 404 });
  return NextResponse.json(serialize(updated));
});

/** DELETE /api/produccion/gallos?id=... — elimina el gallo y sus registros asociados. */
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [rooster] = await tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.id, id)).for("update");
    if (!rooster) throw new Error("Gallo no encontrado");
    const [linkedMortality] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords)
      .where(and(eq(mortalityRecords.roosterId, id), sql`${mortalityRecords.healthControlId} IS NOT NULL`)).limit(1);
    if (linkedMortality) throw new Error("Registro ligado a control sanitario: elimina primero el control desde Sanidad");
    await lockMeatInventory(tx);
    const inventoryBefore = await computeMeatInventory(tx);
    await deleteChickenSalesAndLinkedFinance(tx, eq(chickenSales.roosterId, id));
    const slaughterRows = await tx.select({ id: slaughter.id }).from(slaughter).where(eq(slaughter.roosterId, id));
    const slaughterIds = slaughterRows.map((record) => record.id);
    if (slaughterIds.length > 0) {
      await tx.delete(autoconsumoLogs).where(inArray(autoconsumoLogs.slaughterId, slaughterIds));
    }
    await tx.delete(slaughter).where(eq(slaughter.roosterId, id));
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.roosterId, id));
    await tx.delete(roosters).where(eq(roosters.id, id));
    const inventoryAfter = await computeMeatInventory(tx);
    if (meatInventoryBookBalance(inventoryAfter) < Math.min(0, meatInventoryBookBalance(inventoryBefore)) - 0.01) {
      throw new Error("No se puede eliminar el gallo porque su carne ya fue vendida o perdida");
    }
  });

  return NextResponse.json({ ok: true });
});
