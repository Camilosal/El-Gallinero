import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { billingPayments } from "@/db/schema";
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
    cursorCondition = sql`(${billingPayments.createdAt}, ${billingPayments.id}) < (${beforeAt}::timestamp, ${beforeId}::uuid)`;
  }

  const farmId = getCurrentFarmId();
  const query = db
    .select({
      id: billingPayments.id,
      externalReference: billingPayments.externalReference,
      method: billingPayments.method,
      amountCop: billingPayments.amountCop,
      planCode: billingPayments.planCode,
      status: billingPayments.status,
      paidAt: billingPayments.paidAt,
      createdAt: billingPayments.createdAt,
      createdAtCursor: sql<string>`${billingPayments.createdAt}::text`,
    })
    .from(billingPayments);
  const rows = await query
    .where(cursorCondition
      ? and(eq(billingPayments.farmId, farmId), cursorCondition)
      : eq(billingPayments.farmId, farmId))
    .orderBy(desc(billingPayments.createdAt), desc(billingPayments.id))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const payments = rows.slice(0, PAGE_SIZE);
  const last = payments.at(-1);
  return NextResponse.json(
    {
      payments: payments.map((payment) => ({
        id: payment.id,
        externalReference: payment.externalReference,
        method: payment.method,
        amountCop: payment.amountCop,
        planCode: payment.planCode,
        status: payment.status,
        paidAt: payment.paidAt?.toISOString() ?? null,
        createdAt: payment.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor: hasMore && last
        ? { beforeAt: last.createdAtCursor, beforeId: last.id }
        : null,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
});
