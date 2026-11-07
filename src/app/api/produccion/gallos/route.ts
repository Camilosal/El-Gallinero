import { db } from "@/db";
import { roosters, chickenSales, slaughter, mortalityRecords } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ageInWeeks } from "@/lib/lifecycle";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/** Autogenera el siguiente código de gallo: GA-001, GA-002, ... */
async function nextRoosterCode(): Promise<string> {
  const [row] = await db
    .select({ maxCode: sql<string>`max(${roosters.code})` })
    .from(roosters)
    .where(sql`${roosters.code} LIKE 'GA-%'`);

  let max = 0;
  if (row?.maxCode) {
    const match = String(row.maxCode).match(/^GA-(\d+)$/);
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

  const [created] = await db
    .insert(roosters)
    .values({
      code: body.code ? String(body.code).trim() : await nextRoosterCode(),
      breed: String(body.breed).trim(),
      birthDate: body.birthDate,
      status: body.status || "activo",
      weight: body.weight ? String(body.weight) : null,
      notes: body.notes || null,
      acquisitionId: body.acquisitionId || null,
      acquisitionCost: body.acquisitionCost ? String(body.acquisitionCost) : null,
    })
    .returning();

  return NextResponse.json(serialize(created), { status: 201 });
});

/** PUT /api/produccion/gallos — actualiza un gallo existente. */
export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [updated] = await db
    .update(roosters)
    .set({
      code: body.code,
      breed: body.breed,
      birthDate: body.birthDate,
      status: body.status,
      weight: body.weight,
      notes: body.notes,
      updatedAt: new Date(),
    })
    .where(eq(roosters.id, body.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Gallo no encontrado" }, { status: 404 });
  return NextResponse.json(serialize(updated));
});

/** DELETE /api/produccion/gallos?id=... — elimina el gallo y sus registros asociados. */
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(chickenSales).where(eq(chickenSales.roosterId, id));
    await tx.delete(slaughter).where(eq(slaughter.roosterId, id));
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.roosterId, id));
    await tx.delete(roosters).where(eq(roosters.id, id));
  });

  return NextResponse.json({ ok: true });
});
