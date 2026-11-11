import { loadVaccinationSchedule } from "@/lib/vaccination-db";
import { db } from "@/db";
import { appSettings, sanitaryCalendar } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { SANITARY_CALENDAR_REVIEW_KEY } from "@/lib/onboarding";

export const POST = withApiHandler(async (req: NextRequest) => {
  const { breed, startDate, targetBirds } = await safeParseJson(req);
  const schedule = await loadVaccinationSchedule(breed);
  if (schedule.length === 0) {
    return NextResponse.json({ error: `No hay plan de vacunación para la raza ${breed}` }, { status: 400 });
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
  await db.delete(appSettings).where(eq(appSettings.key, SANITARY_CALENDAR_REVIEW_KEY));
  return NextResponse.json({ created: inserted.length, events: inserted });
});
