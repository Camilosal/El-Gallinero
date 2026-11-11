import { db } from "@/db";
import { appSettings, sanitaryCalendar } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { SANITARY_CALENDAR_REVIEW_KEY } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const [[setting], [activeEvent]] = await Promise.all([
    db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, SANITARY_CALENDAR_REVIEW_KEY)).limit(1),
    db.select({ id: sanitaryCalendar.id }).from(sanitaryCalendar).where(eq(sanitaryCalendar.isActive, true)).limit(1),
  ]);
  const reviewedAt = setting?.value || null;

  return NextResponse.json({ reviewed: Boolean(reviewedAt && activeEvent), reviewedAt });
});

export const POST = withApiHandler(async () => {
  const [activeEvent] = await db.select({ id: sanitaryCalendar.id })
    .from(sanitaryCalendar)
    .where(eq(sanitaryCalendar.isActive, true))
    .limit(1);

  if (!activeEvent) {
    return NextResponse.json({ error: "Revisa y ajusta al menos una actividad antes de confirmar el calendario." }, { status: 400 });
  }

  const reviewedAt = new Date().toISOString();
  await db.insert(appSettings)
    .values({ key: SANITARY_CALENDAR_REVIEW_KEY, value: reviewedAt })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: reviewedAt, updatedAt: new Date() },
    });

  return NextResponse.json({ reviewed: true, reviewedAt });
});
