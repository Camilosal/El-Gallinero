import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { cancelAction } from "@/lib/agent/runtime";
import { readExportTokenFromRequest } from "@/lib/export/auth";
import { withExternalAgentAuth } from "@/lib/agent/external-api";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** POST con cookie de sesión (widget web, persona desde el navegador). */
const sessionPost = withApiHandler(async (req: NextRequest, { params }: RouteContext) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const body = await safeParseJson(req).catch(() => ({}));

  try {
    const result = await cancelAction({
      userId: user.id,
      actionId: id,
      reason: body?.reason ? String(body.reason) : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cancelar la acción" },
      { status: 400 },
    );
  }
});

/**
 * POST /api/asistente/acciones/[id]/cancelar — descarta una acción pendiente.
 * Acepta sesión o token de integración con agent:write (agente externo).
 */
export async function POST(req: NextRequest, routeContext: RouteContext) {
  if (readExportTokenFromRequest(req)) {
    const { id } = await routeContext.params;
    const body = await safeParseJson(req).catch(() => ({}));
    return withExternalAgentAuth(req, async (user) => {
      try {
        const result = await cancelAction({
          userId: user.id,
          actionId: id,
          reason: body?.reason ? String(body.reason) : undefined,
        });
        return NextResponse.json({ ok: true, ...result });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "No se pudo cancelar la acción" },
          { status: 400 },
        );
      }
    });
  }
  return sessionPost(req, routeContext);
}