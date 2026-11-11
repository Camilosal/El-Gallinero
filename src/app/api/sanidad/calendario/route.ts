import { db } from "@/db";
import { appSettings, sanitaryCalendar } from "@/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { SANITARY_CALENDAR_REVIEW_KEY } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

// GET: List all sanitary calendar events with overdue/due-soon flags
export const GET = withApiHandler(async () => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const sevenDaysStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const events = await db
    .select({
      id: sanitaryCalendar.id,
      type: sanitaryCalendar.type,
      name: sanitaryCalendar.name,
      description: sanitaryCalendar.description,
      targetBirds: sanitaryCalendar.targetBirds,
      targetStageId: sanitaryCalendar.targetStageId,
      frequencyDays: sanitaryCalendar.frequencyDays,
      nextDueDate: sanitaryCalendar.nextDueDate,
      withdrawalDays: sanitaryCalendar.withdrawalDays,
      isActive: sanitaryCalendar.isActive,
      lastHealthControlId: sanitaryCalendar.lastHealthControlId,
    })
    .from(sanitaryCalendar)
    .where(eq(sanitaryCalendar.isActive, true))
    .orderBy(asc(sanitaryCalendar.nextDueDate));

  const enriched = events.map((e) => {
    const dueDate = new Date(e.nextDueDate + "T12:00:00");
    const diffMs = dueDate.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isOverdue = e.nextDueDate < todayStr;
    const isDueSoon = !isOverdue && e.nextDueDate <= sevenDaysStr;

    return {
      ...e,
      isOverdue,
      isDueSoon,
      daysUntilDue,
    };
  });

  return NextResponse.json(enriched);
});

// POST: Create a new sanitary calendar event
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

  if (!body.name || !body.nextDueDate) {
    return NextResponse.json({ error: "Nombre y fecha son requeridos" }, { status: 400 });
  }

  const [created] = await db
    .insert(sanitaryCalendar)
    .values({
      type: body.type || "otro",
      name: body.name,
      description: body.description || null,
      targetBirds: body.targetBirds || "todas",
      targetStageId: body.targetStageId || null,
      frequencyDays: body.frequencyDays ? Number(body.frequencyDays) : null,
      nextDueDate: body.nextDueDate,
      withdrawalDays: body.withdrawalDays ? Number(body.withdrawalDays) : null,
      isActive: true,
    })
    .returning();

  await db.delete(appSettings).where(eq(appSettings.key, SANITARY_CALENDAR_REVIEW_KEY));

  return NextResponse.json(created, { status: 201 });
});

// PUT: Update an existing sanitary calendar event
export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.type !== undefined) updates.type = body.type;
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.targetBirds !== undefined) updates.targetBirds = body.targetBirds;
  if (body.targetStageId !== undefined) updates.targetStageId = body.targetStageId || null;
  if (body.frequencyDays !== undefined) updates.frequencyDays = body.frequencyDays ? Number(body.frequencyDays) : null;
  if (body.nextDueDate !== undefined) updates.nextDueDate = body.nextDueDate;
  if (body.withdrawalDays !== undefined) updates.withdrawalDays = body.withdrawalDays ? Number(body.withdrawalDays) : null;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.lastHealthControlId !== undefined) updates.lastHealthControlId = body.lastHealthControlId;

  const [updated] = await db
    .update(sanitaryCalendar)
    .set(updates)
    .where(eq(sanitaryCalendar.id, body.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const changedDefinition = ["type", "name", "description", "targetBirds", "targetStageId", "frequencyDays", "withdrawalDays", "isActive"]
    .some((key) => body[key] !== undefined);
  if (changedDefinition) {
    await db.delete(appSettings).where(eq(appSettings.key, SANITARY_CALENDAR_REVIEW_KEY));
  }

  return NextResponse.json(updated);
});

// DELETE: Deactivate (soft-delete) a sanitary calendar event
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  await db
    .update(sanitaryCalendar)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(sanitaryCalendar.id, id));

  await db.delete(appSettings).where(eq(appSettings.key, SANITARY_CALENDAR_REVIEW_KEY));

  return NextResponse.json({ ok: true });
});
