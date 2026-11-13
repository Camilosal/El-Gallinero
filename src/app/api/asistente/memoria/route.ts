import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import {
  deleteFarmMemory,
  listFarmMemories,
  recallRelevantMemories,
  saveFarmMemory,
} from "@/lib/agent/memory";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  const category = searchParams.get("categoria")?.trim() || undefined;
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 40));

  const memories = query
    ? await recallRelevantMemories(user.id, query, limit)
    : await listFarmMemories(user.id, category, limit);

  return NextResponse.json({ memories });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object" || !String(body.content || "").trim()) {
    return NextResponse.json({ error: "El contenido de la memoria es requerido" }, { status: 400 });
  }

  const saved = await saveFarmMemory({
    userId: user.id,
    category: body.category ? String(body.category) : "hecho",
    subjectKey: body.subjectKey ? String(body.subjectKey) : String(body.content).slice(0, 60),
    content: String(body.content),
    importance: body.importance != null ? Number(body.importance) : 3,
    entities: Array.isArray(body.entities) ? body.entities.map(String) : undefined,
  });

  return NextResponse.json({ memory: saved }, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "ID de memoria requerido" }, { status: 400 });

  const deleted = await deleteFarmMemory(user.id, id);
  if (!deleted) return NextResponse.json({ error: "Memoria no encontrada" }, { status: 404 });

  return NextResponse.json({ ok: true });
});
