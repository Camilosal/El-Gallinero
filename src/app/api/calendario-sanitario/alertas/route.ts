import { db } from "@/db";
import { sanitaryCalendar, healthControl } from "@/db/schema";
import { eq, sql, and, lte, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  // Overdue: nextDueDate < today and active
  const overdue = await db.select({
    id: sanitaryCalendar.id,
    type: sanitaryCalendar.type,
    name: sanitaryCalendar.name,
    nextDueDate: sanitaryCalendar.nextDueDate,
  }).from(sanitaryCalendar)
    .where(and(
      eq(sanitaryCalendar.isActive, true),
      lte(sanitaryCalendar.nextDueDate, today),
    ));

  // Upcoming: nextDueDate between today and +7 days
  const upcoming = await db.select({
    id: sanitaryCalendar.id,
    type: sanitaryCalendar.type,
    name: sanitaryCalendar.name,
    nextDueDate: sanitaryCalendar.nextDueDate,
  }).from(sanitaryCalendar)
    .where(and(
      eq(sanitaryCalendar.isActive, true),
      gte(sanitaryCalendar.nextDueDate, today),
      lte(sanitaryCalendar.nextDueDate, nextWeekStr),
    ));

  // Withdrawal active: health controls where date + withdrawalDays > today
  // We need to join sanitaryCalendar to get withdrawalDays
  const withdrawalActive = await db.select({
    id: healthControl.id,
    type: healthControl.type,
    description: healthControl.description,
    date: healthControl.date,
    calendarName: sanitaryCalendar.name,
    withdrawalDays: sanitaryCalendar.withdrawalDays,
  }).from(healthControl)
    .innerJoin(sanitaryCalendar, eq(healthControl.type, sanitaryCalendar.type))
    .where(and(
      eq(sanitaryCalendar.isActive, true),
      sql`${healthControl.date}::date + (${sanitaryCalendar.withdrawalDays} || ' days')::interval > CURRENT_DATE`,
    ));

  return NextResponse.json({
    overdue: { count: overdue.length, items: overdue },
    upcoming: { count: upcoming.length, items: upcoming },
    withdrawalActive: { count: withdrawalActive.length, items: withdrawalActive },
  });
}
