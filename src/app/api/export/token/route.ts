import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { requirePermission } from "@/lib/rbac-server";
import { getSessionUser } from "@/lib/auth";
import {
  ERP_PROFILES,
  INTEGRATION_SCOPES,
  issueExportToken,
  listExportTokens,
  normalizeErpProfile,
  normalizeTokenScopes,
  revokeExportTokens,
} from "@/lib/export/auth";

export const dynamic = "force-dynamic";

/** Estado de los tokens de solo lectura de esta granja. */
export const GET = withApiHandler(async () => {
  const tokens = await listExportTokens();
  return NextResponse.json({
    tokens,
    active: tokens.length > 0,
    availableScopes: INTEGRATION_SCOPES,
    availableProfiles: ERP_PROFILES,
    hint: tokens.length
      ? "Usa el token en el header X-Export-Token o Authorization: Bearer."
      : "Genera un token para que un dashboard externo o ERP (SIIGO, Alegra, Odoo, Zoho) consulte datos sin usar tu contraseña.",
  });
});

/** Genera (rota) o revoca tokens de exportación/integración. Requiere permiso de configuración. */
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
    const scopes = Array.isArray(body?.scopes)
      ? normalizeTokenScopes(body.scopes)
      : [...INTEGRATION_SCOPES];
    const profile = normalizeErpProfile(body?.profile);

    let expiresAt: Date | null = null;
    if (typeof body?.expiresInDays === "number" && Number.isFinite(body.expiresInDays) && body.expiresInDays > 0) {
      const days = Math.min(3650, Math.max(1, Math.round(body.expiresInDays)));
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else if (typeof body?.expiresAt === "string" && body.expiresAt.trim()) {
      const parsed = new Date(body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Fecha de expiración inválida" }, { status: 400 });
      }
      expiresAt = parsed;
    }

    const replacePrevious = action === "rotate" ? true : body?.replacePrevious !== false;

    const issued = await issueExportToken({
      createdBy: user?.id ?? null,
      name: typeof body?.name === "string" ? body.name : "Dashboard externo",
      scopes,
      profile,
      expiresAt,
      replacePrevious,
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
          scopes: issued.scopes,
          profile: issued.profile,
          expiresAt: issued.expiresAt,
          createdAt: issued.createdAt,
        },
        warning: "Copia este token ahora: no se volverá a mostrar.",
        usage: `curl -H "X-Export-Token: ${issued.token}" "https://gallinero.iwage.co/api/v1/integrations/transactions?profile=${issued.profile}"`,
      },
      { status: 201 },
    );
  }

  if (action === "revoke") {
    const tokenId = typeof body?.tokenId === "string" && body.tokenId.trim() ? body.tokenId.trim() : undefined;
    const revoked = await revokeExportTokens(tokenId);
    return NextResponse.json({ ok: true, revoked });
  }

  return NextResponse.json(
    { error: "Acción inválida. Usa 'generate', 'rotate' o 'revoke'." },
    { status: 400 },
  );
});
