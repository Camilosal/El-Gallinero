import { db } from "@/db";
import { sanitaryCalendar } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await db
    .select()
    .from(sanitaryCalendar)
    .orderBy(asc(sanitaryCalendar.nextDueDate));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneWeekFromNow = new Date(today);
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

  const enriched = events.map((e) => {
    const dueDate = new Date(e.nextDueDate + "T12:00:00");
    const isOverdue = dueDate < today && e.isActive;
    const isDueSoon = !isOverdue && dueDate <= oneWeekFromNow && e.isActive;
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...e,
      isOverdue,
      isDueSoon,
      daysUntilDue,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, name, description, targetBirds, targetStageId, frequencyDays, nextDueDate, withdrawalDays } = body;

  if (!type || !name || !nextDueDate) {
    return NextResponse.json({ error: "Tipo, nombre y fecha son requeridos" }, { status: 400 });
  }

  const [created] = await db
    .insert(sanitaryCalendar)
    .values({
      type,
      name,
      description: description || null,
      targetBirds: targetBirds || "todas",
      targetStageId: targetStageId || null,
      frequencyDays: frequencyDays || null,
      nextDueDate,
      withdrawalDays: withdrawalDays || null,
      isActive: true,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(sanitaryCalendar)
    .where(eq(sanitaryCalendar.id, body.id));

  if (!existing) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const [updated] = await db
    .update(sanitaryCalendar)
    .set({
      type: body.type ?? existing.type,
      name: body.name ?? existing.name,
      description: body.description !== undefined ? body.description : existing.description,
      targetBirds: body.targetBirds ?? existing.targetBirds,
      targetStageId: body.targetStageId !== undefined ? body.targetStageId : existing.targetStageId,
      frequencyDays: body.frequencyDays !== undefined ? body.frequencyDays : existing.frequencyDays,
      nextDueDate: body.nextDueDate ?? existing.nextDueDate,
      withdrawalDays: body.withdrawalDays !== undefined ? body.withdrawalDays : existing.withdrawalDays,
      isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(sanitaryCalendar.id, body.id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.delete(sanitaryCalendar).where(eq(sanitaryCalendar.id, id));
  return NextResponse.json({ ok: true });
}
