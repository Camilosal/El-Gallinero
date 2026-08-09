import { db } from "@/db";
import { eggProduction, feedMovements, sanitaryCalendar } from "@/db/schema";
import { eq, and, sql, desc, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  const [eggRows, feedRows, pendingSanitary] = await Promise.all([
    // Check if eggs collected today
    db
      .select({ id: eggProduction.id })
      .from(eggProduction)
      .where(eq(eggProduction.date, today))
      .limit(1),
    // Check if any feed movement today
    db
      .select({ id: feedMovements.id })
      .from(feedMovements)
      .where(eq(feedMovements.date, today))
      .limit(1),
    // Find most urgent sanitary event (overdue or due soon)
    db
      .select({
        id: sanitaryCalendar.id,
        name: sanitaryCalendar.name,
        type: sanitaryCalendar.type,
        nextDueDate: sanitaryCalendar.nextDueDate,
      })
      .from(sanitaryCalendar)
      .where(
        and(
          eq(sanitaryCalendar.isActive, true),
          sql`${sanitaryCalendar.nextDueDate} <= ${today}::date + interval '7 days'`
        )
      )
      .orderBy(sanitaryCalendar.nextDueDate)
      .limit(1),
  ]);

  const sanitaryEvent = pendingSanitary.length > 0 ? pendingSanitary[0] : null;

  return NextResponse.json({
    eggCollectedToday: eggRows.length > 0,
    feedMovedToday: feedRows.length > 0,
    pendingSanitary: sanitaryEvent
      ? {
          id: sanitaryEvent.id,
          name: sanitaryEvent.name,
          type: sanitaryEvent.type,
          dueDate: sanitaryEvent.nextDueDate,
          isOverdue: sanitaryEvent.nextDueDate < today,
        }
      : null,
  });
}
