import { NextResponse } from "next/server";
import { getAgentConfig } from "@/lib/agent/config";
import { agentStatus } from "@/lib/agent/runtime";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/** GET /api/asistente/estado — indica si el asistente está configurado. */
export const GET = withApiHandler(async () => {
  return NextResponse.json(agentStatus(getAgentConfig()));
});
