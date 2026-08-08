import { db } from "@/db";
import { roosters, hens, chickenSales, slaughter, mortalityRecords } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ageInWeeks, isAvailableForExit } from "@/lib/lifecycle";
import { flockBalance } from "@/lib/flock";

export const dynamic = "force-dynamic";

/** Balance gallos/gallinas: gallinas en el gallinero vs gallos activos */
async function getBalance() {
  const [henRows, roosterCount] = await Promise.all([
    db.select({ status: hens.status }).from(hens),
    db.select({ count: sql<number>`count(*)::int` }).from(roosters).where(eq(roosters.status, "activo")),
  ]);
  const hensInCoop = henRows.filter((h) => isAvailableForExit(h.status)).length;
  return flockBalance(hensInCoop, roosterCount[0]?.count || 0);
}

/** Autogenera el siguiente código con prefijo dado (GA-001, GA-002...) */
async function nextCode(prefix: string): Promise<string> {
  const [maxRow] = await db.select({ maxCode: sql<string>`max(${roosters.code})` }).from(roosters);
  let max = 0;
  if (maxRow?.maxCode) {
    const m = String(maxRow.maxCode).match(/^GA-(\d+)$/);
    if (m) max = Number(m[1]);
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export async function GET() {
  const [data, balance] = await Promise.all([
    db.select().from(roosters).orderBy(desc(roosters.createdAt)),
    getBalance(),
  ]);
  const enriched = data.map((r) => ({ ...r, ageWeeks: Math.floor(ageInWeeks(r.birthDate)) }));
  return NextResponse.json({ roosters: enriched, balance });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.breed) return NextResponse.json({ error: "Raza requerida" }, { status: 400 });
  if (!body.birthDate) return NextResponse.json({ error: "Fecha de nacimiento requerida" }, { status: 400 });

  const [created] = await db.insert(roosters).values({
    code: body.code || (await nextCode("GA")),
    breed: body.breed,
    birthDate: body.birthDate,
    status: body.status || "activo",
    weight: body.weight || null,
    notes: body.notes || null,
  }).returning();

  return NextResponse.json({ ...created, ageWeeks: Math.floor(ageInWeeks(created.birthDate)) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [updated] = await db.update(roosters).set({
    code: body.code,
    breed: body.breed,
    birthDate: body.birthDate,
    status: body.status,
    weight: body.weight,
    notes: body.notes,
    updatedAt: new Date(),
  }).where(eq(roosters.id, body.id)).returning();

  return NextResponse.json({ ...updated, ageWeeks: Math.floor(ageInWeeks(updated.birthDate)) });
}

export async function DELETE(req: NextRequest) {
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
}
