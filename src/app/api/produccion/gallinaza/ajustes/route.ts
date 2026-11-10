import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { manureAdjustments } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { isTodayOrEarlierManureDate } from "@/lib/manure";
import { createManureAdjustment, deleteManureAdjustment } from "@/lib/manure-operations";

export const dynamic = "force-dynamic";


export const GET = withApiHandler(async () => {
  const data = await db.select().from(manureAdjustments).orderBy(desc(manureAdjustments.date));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!isDateOnly(body.date) || !isTodayOrEarlierManureDate(body.date)) return NextResponse.json({ error: "Fecha inválida o futura" }, { status: 400 });
  const deltaKg = Number(Number(body.deltaKg).toFixed(2));
  if (!Number.isFinite(deltaKg) || deltaKg === 0) return NextResponse.json({ error: "El ajuste debe ser distinto de cero y tener al menos 0.01 kg" }, { status: 400 });
  if (typeof body.reason !== "string" || !body.reason.trim()) return NextResponse.json({ error: "Motivo requerido" }, { status: 400 });

  const created = await db.transaction((tx) => createManureAdjustment(tx, {
    date: body.date,
    deltaKg,
    reason: body.reason,
  }));

  return NextResponse.json(created, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const deleted = await db.transaction((tx) => deleteManureAdjustment(tx, id));
  if (!deleted) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
