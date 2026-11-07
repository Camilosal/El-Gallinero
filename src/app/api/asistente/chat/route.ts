import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getAgentConfig } from "@/lib/agent/config";
import { AgentNotConfiguredError, runAgentTurn } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";

/** POST /api/asistente/chat — un turno de conversación con el asistente. */
export const POST = withApiHandler(async (req: NextRequest) => {
  if (!getAgentConfig()) {
    return NextResponse.json(
      {
        error: "El asistente no está configurado. Agrega ASSISTANT_AI_API_KEY en el servidor.",
        configured: false,
      },
      { status: 503 },
    );
  }

  const body = await safeParseJson(req);
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const result = await runAgentTurn({
      userId: user.id,
      userName: user.name || user.username,
      conversationId: body.conversationId ? String(body.conversationId) : null,
      message: String(body.message || ""),
      cookie: req.headers.get("cookie"),
      requestOrigin: req.nextUrl.origin,
    });
    return NextResponse.json({ configured: true, ...result });
  } catch (error) {
    if (error instanceof AgentNotConfiguredError) {
      return NextResponse.json({ error: error.message, configured: false }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error del asistente" },
      { status: 400 },
    );
  }
});
