import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { requirePermission } from "@/lib/rbac-server";
import { getSessionUser } from "@/lib/auth";
import {
  issueExportToken,
  listExportTokens,
  revokeExportTokens,
} from "@/lib/export/auth";

export const dynamic = "force-dynamic";

/** Estado de los tokens de solo lectura de esta granja. */
export const GET = withApiHandler(async () => {
  const tokens = await listExportTokens();
  return NextResponse.json({
    tokens,
    active: tokens.length > 0,
    hint: tokens.length
      ? "Usa el token en el header X-Export-Token o Authorization: Bearer."
      : "Genera un token para que un dashboard externo descargue CSV/XLSX sin usar tu contraseña.",
  });
});

/** Genera (rota) o revoca el token de exportación. Requiere permiso de configuración. */
export const POST = withApiHandler(async (req: NextRequest) => {
  const forbidden = await requirePermission(
    "config:write",
    "Tu rol no puede administrar tokens de exportación",
  );
  if (forbidden) return forbidden;

  const body = await safeParseJson(req);
  const action = String(body?.action || "").trim();

  if (action === "generate" || action === "rotate") {
    const user = await getSessionUser();
    const issued = await issueExportToken({
      createdBy: user?.id ?? null,
      name: typeof body?.name === "string" ? body.name : "Dashboard externo",
    });
    return NextResponse.json(
      {
        ok: true,
        token: issued.token,
        tokenType: "Bearer",
        header: "X-Export-Token",
        summary: {
          id: issued.id,
          name: issued.name,
          prefix: issued.prefix,
          createdAt: issued.createdAt,
        },
        warning: "Copia este token ahora: no se volverá a mostrar.",
        usage: `curl -H "X-Export-Token: ${issued.token}" "https://gallinero.iwage.co/api/export?dataset=resumen-diario&format=csv" -o resumen.csv`,
      },
      { status: 201 },
    );
  }

  if (action === "revoke") {
    const revoked = await revokeExportTokens();
    return NextResponse.json({ ok: true, revoked });
  }

  return NextResponse.json(
    { error: "Acción inválida. Usa 'generate' o 'revoke'." },
    { status: 400 },
  );
});
