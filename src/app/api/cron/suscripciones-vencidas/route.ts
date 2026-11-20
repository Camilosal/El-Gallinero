import { timingSafeEqual } from "node:crypto";
import { and, asc, eq, lte, ne, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farmSubscriptions } from "@/db/schema";
import { withErrorHandler } from "@/lib/api-handler";
import { expirePaidSubscriptionForFarm } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 250;

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || "";
  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "La expiración programada de suscripciones no está configurada." }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const due = and(
    ne(farmSubscriptions.planCode, "FREEMIUM_SEMILLA"),
    eq(farmSubscriptions.status, "active"),
    lte(farmSubscriptions.currentPeriodEnd, now),
  );
  const candidates = await db
    .select({ farmId: farmSubscriptions.farmId, currentPeriodEnd: farmSubscriptions.currentPeriodEnd })
    .from(farmSubscriptions)
    .where(due)
    .orderBy(asc(farmSubscriptions.currentPeriodEnd), asc(farmSubscriptions.farmId))
    .limit(BATCH_SIZE);

  let expired = 0;
  let failures = 0;
  for (const candidate of candidates) {
    try {
      if (await expirePaidSubscriptionForFarm(candidate.farmId, now)) expired += 1;
    } catch (error) {
      failures += 1;
      console.error("[cron/suscripciones-vencidas] No se pudo registrar un vencimiento:", error);
    }
  }

  const [remaining] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(farmSubscriptions)
    .where(due);
  const remainingCount = Number(remaining?.count ?? 0);

  return NextResponse.json(
    {
      ok: failures === 0,
      scanned: candidates.length,
      expired,
      failures,
      remaining: remainingCount,
      hasMore: remainingCount > 0,
    },
    { status: failures === 0 ? 200 : 207, headers: { "Cache-Control": "no-store" } },
  );
});
