import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { createConversation, listConversations } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";

/** GET /api/asistente/conversaciones — historial de conversaciones del usuario. */
export const GET = withApiHandler(async () => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json(await listConversations(user.id));
});

/** POST /api/asistente/conversaciones — crea una conversación vacía. */
export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const body = await safeParseJson(req);
  const created = await createConversation(user.id, body?.title ? String(body.title) : undefined);
  return NextResponse.json(created, { status: 201 });
});
