import { NextRequest, NextResponse } from "next/server";
import { withIntegrationContext } from "@/lib/integrations/auth-guard";
import { hasIntegrationScope } from "@/lib/export/auth";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import { TOOL_ROUTES } from "@/lib/agent/jev-routing";
import {
  effectiveRequiresConfirmation,
  getDelegationPolicy,
  isHardFloorTool,
} from "@/lib/agent/delegation";
import { EXTERNAL_RATE_LIMIT_PER_MINUTE } from "@/lib/agent/external-api";

export const dynamic = "force-dynamic";

function toolJevDomains(toolName: string): string[] {
  return Object.entries(TOOL_ROUTES)
    .filter(([, names]) => names.includes(toolName))
    .map(([domain]) => domain);
}

/**
 * GET /api/v1/agent/tools — manifiesto de herramientas del agente para
 * sistemas externos. Filtrado por los scopes del token: agent:read habilita
 * consultas y agent:write habilita escrituras. requiresConfirmation refleja
 * el piso duro (B3) + la política de delegación vigente de la granja.
 */
export async function GET(req: NextRequest) {
  try {
    return await withIntegrationContext(req, ["agent:read", "agent:write"], async (ctx) => {
      const policy = await getDelegationPolicy();
      const tools = AGENT_TOOLS.filter((tool) =>
        hasIntegrationScope(ctx.scopes, tool.kind === "read" ? "agent:read" : "agent:write"),
      ).map((tool) => ({
        name: tool.name,
        description: tool.description,
        kind: tool.kind,
        requiredScope: tool.kind === "read" ? "agent:read" : "agent:write",
        requiresConfirmation: tool.kind === "write" && effectiveRequiresConfirmation(tool.name, policy),
        hardFloor: isHardFloorTool(tool.name),
        jevDomains: toolJevDomains(tool.name),
        parameters: tool.parameters,
      }));

      return NextResponse.json(
        {
          object: "agent_tools_manifest",
          apiVersion: "v1",
          farmId: ctx.farmId,
          authVia: ctx.via,
          grantedScopes: ctx.scopes,
          tools,
          execution: {
            method: "POST",
            path: "/api/v1/agent/tools/{name}",
            body: { args: "objeto JSON con los parámetros declarados en parameters" },
            pendingConfirmationStatus: 202,
            confirmEndpoint: "/api/asistente/acciones/{actionId}/confirmar",
            cancelEndpoint: "/api/asistente/acciones/{actionId}/cancelar",
            rateLimitPerMinute: EXTERNAL_RATE_LIMIT_PER_MINUTE,
          },
          syncedAt: new Date().toISOString(),
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    });
  } catch (error) {
    console.error("Agent tools manifest error:", error);
    return NextResponse.json({ error: "No se pudo consultar el manifiesto de herramientas" }, { status: 500 });
  }
}