import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { processWompiWebhookEvent } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async (req: NextRequest) => {
  const payload = await safeParseJson(req);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Payload webhook inválido" }, { status: 400 });
  }

  const headerChecksum = req.headers.get("x-event-checksum");
  const result = await processWompiWebhookEvent(payload as Record<string, unknown>, headerChecksum);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 200 });
});

