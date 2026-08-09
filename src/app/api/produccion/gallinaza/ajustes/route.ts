import { db } from "@/db";
import { manureAdjustments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await db.select().from(manureAdjustments).orderBy(desc(manureAdjustments.date));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.date) return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
  const deltaKg = Number(body.deltaKg);
  if (isNaN(deltaKg) || deltaKg === 0) return NextResponse.json({ error: "Ajuste en kg (≠ 0) requerido" }, { status: 400 });
  if (!body.reason) return NextResponse.json({ error: "Motivo requerido" }, { status: 400 });

  const [created] = await db.insert(manureAdjustments).values({
    date: body.date,
    deltaKg: deltaKg.toFixed(2),
    reason: body.reason,
  }).returning();

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.delete(manureAdjustments).where(eq(manureAdjustments.id, id));
  return NextResponse.json({ ok: true });
}
