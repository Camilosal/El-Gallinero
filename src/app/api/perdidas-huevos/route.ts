import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { eggLosses } from "@/db/schema";
import { eq, desc, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { computeEggInventory } from "@/lib/inventory";
import { lockEggInventory } from "@/lib/inventory-locks";

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
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  const { date, quantity, size, reason, notes } = body;

  const qty = Number(quantity);
  if (!isDateOnly(date) || !Number.isSafeInteger(qty) || qty < 1 || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "Fecha, cantidad y razón son requeridos" }, { status: 400 });
  }

  const [created] = await db.transaction(async (tx) => {
    await lockEggInventory(tx);
    const inventory = await computeEggInventory(tx);
    const available = size
      ? inventory.summary.sizes.find((entry) => entry.size === size)?.available || 0
      : inventory.summary.available;
    if (qty > available) {
      throw new Error(`Stock insuficiente: disponibles ${available} huevos`);
    }

    return tx.insert(eggLosses).values({
      date,
      quantity: qty,
      size: size || null,
      reason: reason.trim(),
      notes: notes || null,
    }).returning();
  });

  return NextResponse.json(created, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await lockEggInventory(tx);
    const [loss] = await tx.select().from(eggLosses).where(eq(eggLosses.id, id));
    if (!loss) throw new Error("No encontrado");
    await tx.delete(eggLosses).where(eq(eggLosses.id, id));
  });
  return NextResponse.json({ ok: true });
});
