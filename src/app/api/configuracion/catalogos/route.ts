import { db } from "@/db";
import { catalogos, sanitaryCalendar, feedMovements } from "@/db/schema";
import { eq, asc, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const tipo = searchParams.get("tipo");

  const conditions = [eq(catalogos.isActive, true)];
  if (category) conditions.push(eq(catalogos.category, category));
  if (tipo) conditions.push(eq(catalogos.tipo, tipo));

  const data = category || tipo
    ? await db.select().from(catalogos).where(and(...conditions)).orderBy(asc(catalogos.sortOrder), asc(catalogos.value))
    : await db.select().from(catalogos).orderBy(asc(catalogos.category), asc(catalogos.sortOrder));

  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const category = (body.category || "").toString().trim();
  const value = (body.value || "").toString().trim();
  if (!category || !value) return NextResponse.json({ error: "Categoría y valor son requeridos" }, { status: 400 });

  const created = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(catalogos).where(and(eq(catalogos.category, category), eq(catalogos.value, value)));
    if (existing) return NextResponse.json({ error: "Ese valor ya existe en el catálogo" }, { status: 409 });

    const [maxOrder] = await tx.select({ max: sql<number>`max(${catalogos.sortOrder})` }).from(catalogos).where(eq(catalogos.category, category));
    const [row] = await tx.insert(catalogos).values({
      category,
      value,
      price: body.price !== undefined && body.price !== "" ? body.price.toString() : null,
      units: body.units !== undefined && body.units !== "" ? parseInt(body.units) : null,
      tipo: body.tipo || null,
      sortOrder: (maxOrder?.max ?? -1) + 1,
    }).returning();

    return row;
  });

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const value = (body.value || "").toString().trim();
  if (!value) return NextResponse.json({ error: "El valor no puede estar vacío" }, { status: 400 });

  const [updated] = await db.update(catalogos).set({
    value,
    price: body.price !== undefined ? (body.price === "" ? null : body.price.toString()) : undefined,
    units: body.units !== undefined ? (body.units === "" ? null : parseInt(body.units) || null) : undefined,
    isActive: body.isActive !== undefined ? body.isActive : undefined,
  }).where(eq(catalogos.id, body.id)).returning();

  if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    await tx.delete(sanitaryCalendar).where(eq(sanitaryCalendar.targetStageId, id));
    await tx.delete(feedMovements).where(eq(feedMovements.stageCatalogoId, id));
    await tx.delete(catalogos).where(eq(catalogos.id, id));
  });
  return NextResponse.json({ ok: true });
});
