import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { cancelAction } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";

/** POST /api/asistente/acciones/[id]/cancelar — descarta una acción pendiente. */
export const POST = withApiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
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
