import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { withIntegrationContext } from "@/lib/integrations/auth-guard";
import { getAgentTool } from "@/lib/agent/tools";
import { executeToolExternal } from "@/lib/agent/runtime";
import { withEphemeralSession } from "@/lib/agent/ephemeral-session";
import {
  EXTERNAL_RATE_LIMIT_PER_MINUTE,
  checkExternalRateLimit,
} from "@/lib/agent/external-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/agent/tools/{name} — ejecuta una herramienta del agente como el
 * usuario delegante dueño del token (nunca superusuario): hereda RBAC, RLS,
 * candados sanitarios y política de delegación (B3).
 *
 * - Lecturas (agent:read): 200 con el resultado.
 * - Escrituras automáticas (agent:write): 200 con resumen auditado.
 * - Escrituras sensibles: 202 con actionId pendiente; se confirman vía
 *   POST /api/asistente/acciones/{id}/confirmar con el mismo token.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const tool = getAgentTool(name);
  if (!tool) {
    return NextResponse.json({ error: `Herramienta desconocida: ${name}` }, { status: 404 });
  }
  const requiredScope = tool.kind === "read" ? ("agent:read" as const) : ("agent:write" as const);

  try {
    return await withIntegrationContext(req, [requiredScope], async (ctx) => {
      if (ctx.via === "token" && ctx.tokenId && !checkExternalRateLimit(ctx.tokenId)) {
        return NextResponse.json(
          { error: `Límite de ${EXTERNAL_RATE_LIMIT_PER_MINUTE} solicitudes por minuto excedido. Intenta en un minuto.` },
          { status: 429 },
        );
      }
      if (!ctx.userId) {
        return NextResponse.json(
          { error: "El token no tiene usuario delegante. Genera uno nuevo desde /exportar?tab=conectores." },
          { status: 403 },
        );
      }

      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, ctx.userId), eq(users.farmId, ctx.farmId)))
        .limit(1);
      if (!user) {
        return NextResponse.json(
          { error: "El usuario delegante del token ya no existe en esta granja" },
          { status: 403 },
        );
      }

      const body = await req.json().catch(() => null);
      const rawArgs =
        body && typeof body === "object" && !Array.isArray(body) && "args" in body
          ? (body as { args: unknown }).args
          : body;
      if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
        return NextResponse.json(
          { error: 'Envía un objeto JSON con los parámetros de la herramienta (campo "args" o el objeto directo).' },
          { status: 400 },
        );
      }

      const run = (cookie: string | null) =>
        executeToolExternal({
          userId: user.id,
          userName: user.name || user.username,
          toolName: tool.name,
          args: rawArgs as Record<string, unknown>,
          cookie,
          requestOrigin: req.nextUrl.origin,
          tokenId: ctx.tokenId,
        });

      const outcome =
        ctx.via === "token"
          ? await withEphemeralSession(user.id, ctx.farmId, run)
          : await run(req.headers.get("cookie"));

      if (outcome.status === "pending_confirmation") {
        return NextResponse.json(
          {
            status: outcome.status,
            actionId: outcome.actionId,
            summary: outcome.summary,
            confirmEndpoint: `/api/asistente/acciones/${outcome.actionId}/confirmar`,
            cancelEndpoint: `/api/asistente/acciones/${outcome.actionId}/cancelar`,
            instruction:
              "La acción quedó pendiente de confirmación. Confírmala con el mismo token o desde la app; no la reenvíes.",
          },
          { status: 202 },
        );
      }
      if (outcome.status === "error") {
        return NextResponse.json(
          { status: "error", error: outcome.error, summary: outcome.summary ?? null },
          { status: 400 },
        );
      }
      return NextResponse.json({
        status: outcome.status,
        actionId: outcome.actionId ?? null,
        summary: outcome.summary ?? null,
        data: outcome.status === "ok" ? outcome.data : outcome.result,
      });
    });
  } catch (error) {
    console.error("Agent tool execution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la herramienta" },
      { status: 500 },
    );
  }
}