import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { requirePermission } from "@/lib/rbac-server";
import { getSessionUser } from "@/lib/auth";
import {
  DEFAULT_ERP_MAPPING,
  ERP_PROFILE_METADATA,
  loadErpMapping,
  saveErpMapping,
} from "@/lib/integrations/profiles";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const mapping = await loadErpMapping();
  return NextResponse.json({
    mapping,
    defaults: DEFAULT_ERP_MAPPING,
    profiles: Object.values(ERP_PROFILE_METADATA),
  });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const forbidden = await requirePermission(
    "config:write",
    "Tu rol no puede modificar la configuración de conectores ERP",
  );
  if (forbidden) return forbidden;

  const user = await getSessionUser();
  const body = await safeParseJson(req);
  const mapping = await saveErpMapping(body?.mapping ?? body, user?.id ?? null);

  return NextResponse.json({
    ok: true,
    mapping,
  });
});
