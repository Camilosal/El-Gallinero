import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac-server";
import { getSettingsForApi, updateSettings } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/** GET /api/configuracion/parametros — parámetros globales con su valor efectivo. */
export const GET = withApiHandler(async () => {
  return NextResponse.json(await getSettingsForApi());
});

/** PUT /api/configuracion/parametros — actualiza uno o varios parámetros. */
export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  const updates = Array.isArray(body.updates)
    ? body.updates
    : body.key
      ? [{ key: body.key, value: body.value }]
      : [];

  if (updates.length === 0) {
    return NextResponse.json({ error: "Envíe al menos un parámetro" }, { status: 400 });
  }

  try {
    const user = await getSessionUser();
    await updateSettings(updates, user?.id ?? null);
    return NextResponse.json(await getSettingsForApi());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar parámetros";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
