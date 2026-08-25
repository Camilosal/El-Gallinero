import { db } from "@/db";
import { manureProduction } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const data = await db.select().from(manureProduction).orderBy(desc(manureProduction.date));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

  if (!body.date) return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
  const kgProduced = Number(body.kgProduced);
  if (isNaN(kgProduced) || kgProduced <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });

  const [created] = await db.insert(manureProduction).values({
    date: body.date,
    kgProduced: kgProduced.toFixed(2),
    source: body.source || "estimado",
    notes: body.notes || null,
  }).returning();

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const kgProduced = Number(body.kgProduced);
  if (isNaN(kgProduced) || kgProduced <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });

  const [updated] = await db.update(manureProduction).set({
    date: body.date,
    kgProduced: kgProduced.toFixed(2),
    source: body.source || "estimado",
    notes: body.notes || null,
  }).where(eq(manureProduction.id, body.id)).returning();

  if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.delete(manureProduction).where(eq(manureProduction.id, id));
  return NextResponse.json({ ok: true });
});
