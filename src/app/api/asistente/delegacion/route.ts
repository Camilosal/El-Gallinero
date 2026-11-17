import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { forbiddenResponse, normalizeRole } from "@/lib/rbac";
import { requirePermission } from "@/lib/rbac-server";
import {
  HARD_FLOOR_TOOL_NAMES,
  delegationToolViews,
  getDelegationPolicy,
  resetDelegationPolicy,
  saveDelegationPolicy,
} from "@/lib/agent/delegation";

export const dynamic = "force-dynamic";

// B3: solo propietario/administrador puede cambiar la política de delegación.
// El gerente tiene config:write para otros ajustes, pero no para delegar escrituras.
function canEditDelegation(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role || "");
  return normalized === "admin" || normalized === "propietario";
}

export const GET = withApiHandler(async () => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;

  const user = await getSessionUser();
  const policy = await getDelegationPolicy();
  return NextResponse.json({
    policy,
    tools: delegationToolViews(policy),
    hardFloor: HARD_FLOOR_TOOL_NAMES,
    canEdit: canEditDelegation(user?.role),
  });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canEditDelegation(user.role)) {
    return forbiddenResponse("Solo el propietario o administrador puede cambiar la política de delegación del asistente");
  }

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido: envía { policy } o { reset: true }" }, { status: 400 });
  }

  const policy =
    body.reset === true
      ? await resetDelegationPolicy(user.id)
      : await saveDelegationPolicy(body.policy, user.id);

  return NextResponse.json({
    policy,
    tools: delegationToolViews(policy),
    hardFloor: HARD_FLOOR_TOOL_NAMES,
    canEdit: true,
  });
});