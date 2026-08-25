import { db } from "@/db";
import { eggLosses } from "@/db/schema";
import { eq, desc, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const period = Number(searchParams.get("period")) || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const losses = await db.select().from(eggLosses).orderBy(desc(eggLosses.createdAt));

  const [summary] = await db
    .select({ total: sql<number>`coalesce(sum(${eggLosses.quantity}), 0)::int`, count: sql<number>`count(*)::int` })
    .from(eggLosses)
    .where(gte(eggLosses.date, cutoffStr));

  const byReason = await db
    .select({ reason: eggLosses.reason, total: sql<number>`sum(${eggLosses.quantity})::int` })
    .from(eggLosses)
    .where(gte(eggLosses.date, cutoffStr))
    .groupBy(eggLosses.reason);

  return NextResponse.json({ losses, totalLost: summary?.total || 0, lossCount: summary?.count || 0, byReason, periodDays: period });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { date, quantity, size, reason, notes } = body;

  const qty = Number(quantity);
  if (!date || !quantity || isNaN(qty) || qty < 1 || !reason) {
    return NextResponse.json({ error: "Fecha, cantidad y razón son requeridos" }, { status: 400 });
  }

  const [created] = await db.insert(eggLosses).values({
    date,
    quantity: qty,
    size: size || null,
    reason,
    notes: notes || null,
  }).returning();

  return NextResponse.json(created, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.delete(eggLosses).where(eq(eggLosses.id, id));
  return NextResponse.json({ ok: true });
});
