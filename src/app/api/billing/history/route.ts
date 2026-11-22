import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farmSubscriptionEvents } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;

export const GET = withApiHandler(async (request: NextRequest) => {
  const beforeAt = request.nextUrl.searchParams.get("beforeAt");
  const beforeId = request.nextUrl.searchParams.get("beforeId");
  if (Boolean(beforeAt) !== Boolean(beforeId)) {
    return NextResponse.json({ error: "El cursor del historial no es válido." }, { status: 400 });
  }

  let cursorCondition: SQL | undefined;
  if (beforeAt && beforeId) {
    const timestamp = new Date(`${beforeAt.replace(" ", "T")}Z`);
    const datePart = beforeAt.slice(0, 10);
    const calendarDate = new Date(`${datePart}T12:00:00Z`);
    if (
      !TIMESTAMP_PATTERN.test(beforeAt) ||
      !Number.isFinite(timestamp.getTime()) ||
      !Number.isFinite(calendarDate.getTime()) ||
      calendarDate.toISOString().slice(0, 10) !== datePart ||
      !UUID_PATTERN.test(beforeId)
    ) {
      return NextResponse.json({ error: "El cursor del historial no es válido." }, { status: 400 });
    }
    cursorCondition = sql`(${farmSubscriptionEvents.occurredAt}, ${farmSubscriptionEvents.id}) < (${beforeAt}::timestamp, ${beforeId}::uuid)`;
  }

  const farmId = getCurrentFarmId();
  const query = db
    .select({
      id: farmSubscriptionEvents.id,
      eventType: farmSubscriptionEvents.eventType,
      actorType: farmSubscriptionEvents.actorType,
      reason: farmSubscriptionEvents.reason,
      beforeSnapshot: farmSubscriptionEvents.beforeSnapshot,
      afterSnapshot: farmSubscriptionEvents.afterSnapshot,
      policyVersion: farmSubscriptionEvents.policyVersion,
      termsVersion: farmSubscriptionEvents.termsVersion,
      externalReference: farmSubscriptionEvents.externalReference,
      resultStatus: farmSubscriptionEvents.resultStatus,
      occurredAt: farmSubscriptionEvents.occurredAt,
      occurredAtCursor: sql<string>`${farmSubscriptionEvents.occurredAt}::text`,
    })
    .from(farmSubscriptionEvents);
  const rows = await query
    .where(cursorCondition
      ? and(eq(farmSubscriptionEvents.farmId, farmId), cursorCondition)
      : eq(farmSubscriptionEvents.farmId, farmId))
    .orderBy(desc(farmSubscriptionEvents.occurredAt), desc(farmSubscriptionEvents.id))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const events = rows.slice(0, PAGE_SIZE);
  const last = events.at(-1);
  return NextResponse.json(
    {
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        actorType: event.actorType,
        reason: event.reason,
        beforeSnapshot: event.beforeSnapshot,
        afterSnapshot: event.afterSnapshot,
        policyVersion: event.policyVersion,
        termsVersion: event.termsVersion,
        externalReference: event.externalReference,
        resultStatus: event.resultStatus,
        occurredAt: event.occurredAt.toISOString(),
      })),
      hasMore,
      nextCursor: hasMore && last
        ? { beforeAt: last.occurredAtCursor, beforeId: last.id }
        : null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
});
