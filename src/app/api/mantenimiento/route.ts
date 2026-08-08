import { db } from "@/db";
import { maintenance, transactions } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await db.select().from(maintenance).orderBy(desc(maintenance.scheduledDate));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [created] = await db.insert(maintenance).values({
    title: body.title,
    description: body.description || null,
    scheduledDate: body.scheduledDate,
    status: body.status || "pendiente",
    cost: body.cost || "0",
  }).returning();
  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx.update(maintenance).set({
      title: body.title,
      description: body.description,
      scheduledDate: body.scheduledDate,
      completedDate: body.completedDate || null,
      status: body.status,
      cost: body.cost,
    }).where(eq(maintenance.id, body.id)).returning();

    // Remove any previous auto-generated expense for this task (avoid duplicates)
    await tx.delete(transactions).where(and(eq(transactions.sourceType, "mantenimiento"), eq(transactions.sourceId, body.id)));

    // Register cost as expense only when completing with cost > 0
    if (body.status === "completado" && Number(body.cost) > 0) {
      await tx.insert(transactions).values({
        date: body.completedDate || body.scheduledDate,
        type: "egreso",
        category: "Mantenimiento",
        description: `Mantenimiento: ${body.title}`,
        amount: body.cost,
        sourceType: "mantenimiento",
        sourceId: body.id,
      });
    }

    return updated;
  });

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    await tx.delete(maintenance).where(eq(maintenance.id, id));
    await tx.delete(transactions).where(and(eq(transactions.sourceType, "mantenimiento"), eq(transactions.sourceId, id)));
  });
  return NextResponse.json({ ok: true });
}
