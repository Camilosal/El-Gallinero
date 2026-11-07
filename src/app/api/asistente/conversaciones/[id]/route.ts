import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { deleteConversation, getConversation } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;

  try {
    return NextResponse.json(await getConversation(user.id, id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Conversación no encontrada" },
      { status: 404 },
    );
  }
});

export const DELETE = withApiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;

  try {
    await deleteConversation(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Conversación no encontrada" },
      { status: 404 },
    );
  }
});
