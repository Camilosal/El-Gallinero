import { db } from "@/db";
import { healthControl, transactions, hens } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await db.select().from(healthControl).orderBy(desc(healthControl.date));
  return NextResponse.json(data);
}

async function markAffectedAsSick(type: string, affectedHens: string | null) {
  const affected = (affectedHens || "").trim();
  if (type === "tratamiento" && affected && affected.toLowerCase() !== "todas") {
    const codes = affected.split(",").map((c: string) => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      const match = await db.select({ id: hens.id }).from(hens).where(inArray(hens.code, codes));
      const ids = match.map((m) => m.id);
      if (ids.length > 0) {
        await db.update(hens).set({ status: "enferma", updatedAt: new Date() }).where(inArray(hens.id, ids));
      }
    }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [created] = await db.insert(healthControl).values({
    date: body.date,
    type: body.type,
    description: body.description,
    affectedHens: body.affectedHens || null,
    product: body.product || null,
    cost: body.cost || "0",
    nextScheduled: body.nextScheduled || null,
    notes: body.notes || null,
  }).returning();

  // Register expense if cost > 0
  if (Number(body.cost) > 0) {
    await db.insert(transactions).values({
      date: body.date,
      type: "egreso",
      category: "Control sanitario",
      description: `${body.type}: ${body.description}`,
      amount: body.cost,
      sourceType: "sanidad",
      sourceId: created.id,
    });
  }

  await markAffectedAsSick(body.type, body.affectedHens);

  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const [updated] = await db.update(healthControl).set({
    date: body.date,
    type: body.type,
    description: body.description,
    affectedHens: body.affectedHens || null,
    product: body.product || null,
    cost: body.cost || "0",
    nextScheduled: body.nextScheduled || null,
    notes: body.notes || null,
  }).where(eq(healthControl.id, body.id)).returning();

  // Sync linked expense transaction
  await db.delete(transactions).where(and(eq(transactions.sourceType, "sanidad"), eq(transactions.sourceId, body.id)));
  if (Number(body.cost) > 0) {
    await db.insert(transactions).values({
      date: body.date,
      type: "egreso",
      category: "Control sanitario",
      description: `${body.type}: ${body.description}`,
      amount: body.cost,
      sourceType: "sanidad",
      sourceId: body.id,
    });
  }

  await markAffectedAsSick(body.type, body.affectedHens);

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.delete(healthControl).where(eq(healthControl.id, id));
  await db.delete(transactions).where(and(eq(transactions.sourceType, "sanidad"), eq(transactions.sourceId, id)));
  return NextResponse.json({ ok: true });
}
