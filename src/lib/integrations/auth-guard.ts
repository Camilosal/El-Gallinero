import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { runWithFarmContext } from "@/db/tenant-context";
import {
  ERP_PROFILES,
  hasIntegrationScope,
  normalizeErpProfile,
  readExportTokenFromRequest,
  resolveExportToken,
  type ErpProfile,
  type IntegrationScope,
} from "@/lib/export/auth";
import { loadErpMapping, type ErpAccountMapping } from "@/lib/integrations/profiles";

export interface IntegrationRequestContext {
  farmId: string;
  via: "session" | "token";
  tokenId: string | null;
  profile: ErpProfile;
  mapping: ErpAccountMapping;
}

export interface IntegrationPagination {
  limit: number;
  offset: number;
  updatedSince: string | null;
  updatedSinceDate: string | null;
  from: string | null;
  to: string | null;
}

export function parseIntegrationPagination(searchParams: URLSearchParams):
  | { ok: true; value: IntegrationPagination }
  | { ok: false; error: string } {
  const limitRaw = Number(searchParams.get("limit") || "100");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(1000, Math.floor(limitRaw)) : 100;

  const cursorRaw = searchParams.get("cursor");
  let offset = 0;
  if (cursorRaw !== null && cursorRaw.trim() !== "") {
    const parsed = Number(cursorRaw);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      return { ok: false, error: "Parámetro cursor inválido. Debe ser un entero >= 0." };
    }
    offset = parsed;
  }

  const updatedSinceRaw = (searchParams.get("updated_since") || "").trim();
  let updatedSinceDate: string | null = null;
  if (updatedSinceRaw) {
    const parsed = new Date(updatedSinceRaw);
    if (Number.isNaN(parsed.getTime())) {
      return {
        ok: false,
        error: "Parámetro updated_since inválido. Usa fecha YYYY-MM-DD o timestamp ISO-8601.",
      };
    }
    updatedSinceDate = updatedSinceRaw.slice(0, 10);
  }

  const from = (searchParams.get("from") || "").trim() || null;
  const to = (searchParams.get("to") || "").trim() || null;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (from && !dateRegex.test(from)) {
    return { ok: false, error: "Parámetro from inválido. Usa YYYY-MM-DD." };
  }
  if (to && !dateRegex.test(to)) {
    return { ok: false, error: "Parámetro to inválido. Usa YYYY-MM-DD." };
  }
  if (from && to && from > to) {
    return { ok: false, error: "La fecha 'from' no puede ser posterior a 'to'." };
  }

  return {
    ok: true,
    value: {
      limit,
      offset,
      updatedSince: updatedSinceRaw || null,
      updatedSinceDate,
      from,
      to,
    },
  };
}

export async function withIntegrationContext(
  req: NextRequest,
  requiredScopes: IntegrationScope[],
  handler: (ctx: IntegrationRequestContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const rawToken = readExportTokenFromRequest(req);
  let farmId: string;
  let via: "session" | "token";
  let tokenId: string | null = null;
  let tokenProfile: ErpProfile | null = null;

  if (rawToken) {
    const resolved = await resolveExportToken(rawToken);
    if (!resolved) {
      return NextResponse.json(
        { error: "Token de integración inválido, expirado o revocado" },
        { status: 401 },
      );
    }

    if (requiredScopes.length > 0) {
      const hasAny = requiredScopes.some((scope) => hasIntegrationScope(resolved.scopes, scope));
      if (!hasAny) {
        return NextResponse.json(
          {
            error: "Token sin alcance suficiente para este endpoint",
            requiredScopes,
            grantedScopes: resolved.scopes,
          },
          { status: 403 },
        );
      }
    }

    farmId = resolved.farmId;
    via = "token";
    tokenId = resolved.tokenId;
    tokenProfile = resolved.profile;
  } else {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "No autenticado. Envía X-Export-Token, Authorization: Bearer o inicia sesión." },
        { status: 401 },
      );
    }
    farmId = user.farmId;
    via = "session";
  }

  const { searchParams } = new URL(req.url);
  const queryProfileRaw = searchParams.get("profile");
  if (
    queryProfileRaw !== null &&
    queryProfileRaw.trim() !== "" &&
    !(ERP_PROFILES as readonly string[]).includes(queryProfileRaw.trim().toLowerCase())
  ) {
    return NextResponse.json(
      { error: `Perfil ERP no válido. Valores permitidos: ${ERP_PROFILES.join(", ")}` },
      { status: 400 },
    );
  }

  return runWithFarmContext(farmId, async () => {
    const mapping = await loadErpMapping();
    const profile: ErpProfile =
      queryProfileRaw && queryProfileRaw.trim()
        ? normalizeErpProfile(queryProfileRaw)
        : tokenProfile && tokenProfile !== "generic"
          ? tokenProfile
          : mapping.defaultProfile;

    return handler({
      farmId,
      via,
      tokenId,
      profile,
      mapping,
    });
  });
}
