import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { verifyRenewalFarmId, type RenewalPlanSegment } from "@/lib/pricing/renewal-farm";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async (req: NextRequest) => {
  const payload = await safeParseJson(req);
  const input = typeof payload === "object" && payload !== null
    ? payload as { farmId?: unknown; segment?: unknown }
    : {};
  const segment: RenewalPlanSegment = input.segment === "aggregator" ? "aggregator" : "producer";
  const farm = await verifyRenewalFarmId(input.farmId, segment);

  return NextResponse.json(
    { farm },
    { headers: { "Cache-Control": "no-store" } },
  );
});
