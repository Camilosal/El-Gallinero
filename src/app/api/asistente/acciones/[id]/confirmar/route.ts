import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { confirmAction } from "@/lib/agent/runtime";
import { readExportTokenFromRequest } from "@/lib/export/auth";
import { withExternalAgentAuth } from "@/lib/agent/external-api";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** POST con cookie de sesión (widget web, persona desde el navegador). */
const sessionPost = withApiHandler(async (req: NextRequest, { params }: RouteContext) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;

  try {
    const result = await confirmAction({
      userId: user.id,
      userName: user.name || user.username,
      actionId: id,
      cookie: req.headers.get("cookie"),
      requestOrigin: req.nextUrl.origin,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la acción" },
      { status: 400 },
    );
  }
});

/**
 * POST /api/asistente/acciones/[id]/confirmar — ejecuta una acción pendiente.
 * Acepta sesión (humano en la app) o token de integración con agent:write
 * (agente externo vía API v1 / MCP). Con token, la ejecución corre como el
 * usuario delegante dueño del token: mismos RBAC, RLS y candados.
 */
export async function POST(req: NextRequest, routeContext: RouteContext) {
  if (readExportTokenFromRequest(req)) {
    const { id } = await routeContext.params;
    return withExternalAgentAuth(req, async (user, cookie) => {
      try {
        const result = await confirmAction({
          userId: user.id,
          userName: user.name || user.username,
          actionId: id,
          cookie,
          requestOrigin: new URL(req.url).origin,
          origin: "external_agent",
        });
        return NextResponse.json({ ok: true, ...result });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "No se pudo ejecutar la acción" },
          { status: 400 },
        );
      }
    });
  }
  return sessionPost(req, routeContext);
}