import { VACCINATION_SCHEDULES } from "@/lib/vaccination-schedules";
import { db } from "@/db";
import { sanitaryCalendar } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const POST = withApiHandler(async (req: NextRequest) => {
  const { breed, startDate, targetBirds } = await safeParseJson(req);
  const schedule = VACCINATION_SCHEDULES[breed];
  if (!schedule) {
    return NextResponse.json({ error: `Raza ${breed} no encontrada` }, { status: 400 });
  }

  const start = new Date(startDate + "T12:00:00");
  const events = schedule.map((v) => {
    const eventDate = new Date(start);
    eventDate.setDate(eventDate.getDate() + v.weekNumber * 7);
    return {
      type: "vacunacion" as const,
      name: v.name,
      description: v.description,
      targetBirds: targetBirds || "todas",
      frequencyDays: v.frequencyDays,
      nextDueDate: eventDate.toISOString().split("T")[0],
      isActive: true,
    };
  });

  const inserted = await db.insert(sanitaryCalendar).values(events).returning();
  return NextResponse.json({ created: inserted.length, events: inserted });
});
