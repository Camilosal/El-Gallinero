import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { listBriefings, markBriefingRead } from "@/lib/agent/proactive";

export const dynamic = "force-dynamic";

// C2: inbox de briefings del agente proactivo (tarjeta en /inicio y widget).
export const GET = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));
  const briefings = await listBriefings(limit);
  const unreadCount = briefings.filter((b) => !b.readAt).length;

  return NextResponse.json({ briefings, unreadCount });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await safeParseJson(req);
  const id = body && typeof body === "object" ? String(body.id || "").trim() : "";
  if (!id) return NextResponse.json({ error: "El id del briefing es requerido" }, { status: 400 });

  const briefing = await markBriefingRead(id);
  if (!briefing) return NextResponse.json({ error: "Briefing no encontrado" }, { status: 404 });

  return NextResponse.json({ briefing });
});