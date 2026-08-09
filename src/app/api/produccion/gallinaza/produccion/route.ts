import { db } from "@/db";
import { manureProduction } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await db.select().from(manureProduction).orderBy(desc(manureProduction.date));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

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
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const kgProduced = Number(body.kgProduced);
  if (isNaN(kgProduced) || kgProduced <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });

  const [updated] = await db.update(manureProduction).set({
    date: body.date,
    kgProduced: kgProduced.toFixed(2),
    source: body.source || "estimado",
    notes: body.notes || null,
  }).where(eq(manureProduction.id, body.id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.delete(manureProduction).where(eq(manureProduction.id, id));
  return NextResponse.json({ ok: true });
}
