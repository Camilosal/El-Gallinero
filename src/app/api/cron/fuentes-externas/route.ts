import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farms } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { withErrorHandler } from "@/lib/api-handler";
import { syncExternalSourcesDue } from "@/lib/external-sources/sync-orchestrator";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || "";
  const actual = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "La sincronización programada no está configurada" }, { status: 503 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const farmRows = await db.select({ id: farms.id }).from(farms);
  const farmIds = [...new Set([DEFAULT_FARM_ID, ...farmRows.map((row) => row.id)])];
  let checked = 0;
  let failed = 0;
  const sourceStatus = new Map<string, {
    farmsProcessed: number;
    statuses: Record<string, number>;
    providerNames: Set<string>;
    latestFetchedAt: string;
    errors: string[];
  }>();
  for (const farmId of farmIds) {
    const result = await runWithFarmContext(farmId, () => syncExternalSourcesDue());
    checked += result.checked.length;
    failed += result.failed.length;
    for (const source of result.results) {
      const aggregate = sourceStatus.get(source.sourceKey) || {
        farmsProcessed: 0,
        statuses: {},
        providerNames: new Set<string>(),
        latestFetchedAt: "",
        errors: [],
      };
      aggregate.farmsProcessed += 1;
      aggregate.statuses[source.status] = (aggregate.statuses[source.status] || 0) + 1;
      if (source.providerName) aggregate.providerNames.add(source.providerName);
      if (source.fetchedAt > aggregate.latestFetchedAt) aggregate.latestFetchedAt = source.fetchedAt;
      if (source.lastError) aggregate.errors.push(source.lastError.slice(0, 300));
      sourceStatus.set(source.sourceKey, aggregate);
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    farmsProcessed: farmIds.length,
    sourcesChecked: checked,
    sourceFailures: failed,
    sources: [...sourceStatus.entries()].map(([sourceKey, aggregate]) => ({
      sourceKey,
      farmsProcessed: aggregate.farmsProcessed,
      statuses: aggregate.statuses,
      providerNames: [...aggregate.providerNames],
      latestFetchedAt: aggregate.latestFetchedAt,
      errors: [...new Set(aggregate.errors)].slice(0, 5),
    })),
  }, { status: failed === 0 ? 200 : 207 });
});
