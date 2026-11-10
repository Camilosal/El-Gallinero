import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { meatLosses } from "@/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { computeMeatInventory } from "@/lib/inventory";
import { lockMeatInventory } from "@/lib/inventory-locks";

export const dynamic = "force-dynamic";


export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const period = Number(searchParams.get("period") || "30");
  const since = new Date();
  since.setDate(since.getDate() - period);
  const sinceStr = since.toISOString().split("T")[0];

  const allLosses = await db.select().from(meatLosses).orderBy(desc(meatLosses.date));
  const periodLosses = allLosses.filter((l) => l.date >= sinceStr);

  const totalLost = periodLosses.reduce((s, l) => s + Number(l.quantityKg), 0);
  const byReason = new Map<string, number>();
  for (const l of periodLosses) {
    byReason.set(l.reason, (byReason.get(l.reason) || 0) + Number(l.quantityKg));
  }

  return NextResponse.json({
    losses: periodLosses,
    summary: {
      totalLostKg: Math.round(totalLost * 100) / 100,
      count: periodLosses.length,
      byReason: Object.fromEntries(byReason),
    },
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  const quantityKg = Number(Number(body.quantityKg).toFixed(2));
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });
  if (typeof body.reason !== "string" || !body.reason.trim()) return NextResponse.json({ error: "Motivo requerido" }, { status: 400 });

  const [created] = await db.transaction(async (tx) => {
    await lockMeatInventory(tx);
    const inventory = await computeMeatInventory(tx);
    if (quantityKg > inventory.summary.available) {
      throw new Error(`Stock insuficiente: disponibles ${inventory.summary.available.toFixed(2)} kg`);
    }
    return tx.insert(meatLosses).values({
      date: body.date,
      quantityKg: quantityKg.toFixed(2),
      reason: body.reason.trim(),
      notes: body.notes || null,
    }).returning();
  });

  return NextResponse.json(created, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await lockMeatInventory(tx);
    const [loss] = await tx.select().from(meatLosses).where(eq(meatLosses.id, id));
    if (!loss) throw new Error("No encontrado");
    await tx.delete(meatLosses).where(eq(meatLosses.id, id));
  });
  return NextResponse.json({ ok: true });
});
