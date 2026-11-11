import { db } from "@/db";
import { eggProduction, feedMovements, sanitaryCalendar, maintenance, farmLocations, farmAssets } from "@/db/schema";
import { eq, and, sql, inArray, asc, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const [eggRows, feedRows, pendingSanitary, maintenanceDue, maintenanceDueCount, assetsNeedAttention] = await Promise.all([
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
    db.select({
      id: maintenance.id,
      title: maintenance.title,
      scheduledDate: maintenance.scheduledDate,
      locationName: farmLocations.name,
      assetName: farmAssets.name,
    })
      .from(maintenance)
      .leftJoin(farmLocations, eq(maintenance.locationId, farmLocations.id))
      .leftJoin(farmAssets, eq(maintenance.assetId, farmAssets.id))
      .where(and(
        ne(maintenance.status, "completado"),
        sql`${maintenance.scheduledDate} <= ${today}::date + interval '7 days'`,
      ))
      .orderBy(asc(maintenance.scheduledDate))
      .limit(5),
    db.select({ total: sql<number>`count(*)::int` }).from(maintenance).where(and(
      ne(maintenance.status, "completado"),
      sql`${maintenance.scheduledDate} <= ${today}::date + interval '7 days'`,
    )),
    db.select({ total: sql<number>`count(*)::int` }).from(farmAssets)
      .where(inArray(farmAssets.status, ["requiere_mantenimiento", "fuera_servicio"])),
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
    maintenanceDue: maintenanceDue.map((task) => ({
      ...task,
      isOverdue: task.scheduledDate < today,
    })),
    maintenanceDueCount: maintenanceDueCount[0]?.total || 0,
    assetsNeedAttention: assetsNeedAttention[0]?.total || 0,
  });
});
