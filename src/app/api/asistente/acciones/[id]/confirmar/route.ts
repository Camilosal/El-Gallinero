import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler } from "@/lib/api-handler";
import { confirmAction } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";

/** POST /api/asistente/acciones/[id]/confirmar — ejecuta una acción pendiente. */
export const POST = withApiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
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
