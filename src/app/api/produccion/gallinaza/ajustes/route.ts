import { db } from "@/db";
import { manureAdjustments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const data = await db.select().from(manureAdjustments).orderBy(desc(manureAdjustments.date));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

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
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.delete(manureAdjustments).where(eq(manureAdjustments.id, id));
  return NextResponse.json({ ok: true });
});
