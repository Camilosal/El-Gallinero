import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction, forbiddenResponse, type RbacPermission } from "@/lib/rbac";

export async function requirePermission(
  permission: RbacPermission,
  message?: string,
): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canPerformAction(user.role, permission)) {
    return forbiddenResponse(message);
  }
  return null;
}
