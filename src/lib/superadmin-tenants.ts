import { DEFAULT_FARM_ID } from "@/db/tenant-context";
import { normalizeRole } from "@/lib/rbac";
import { PLAN_CATALOG } from "@/lib/subscription";

export const SUPERADMIN_PLAN_OPTIONS = [
  {
    code: "FREEMIUM_SEMILLA",
    name: "Gratis (1 lote activo por especie)",
    durationDays: 30,
    amountCop: 0,
    maxUsers: 1,
    maxActiveBatches: 1 as number | null,
  },
  ...Object.values(PLAN_CATALOG).map((plan) => ({
    code: plan.code,
    name: plan.name,
    durationDays: plan.durationDays,
    amountCop: plan.amountCop,
    maxUsers: plan.maxUsers,
    maxActiveBatches: null as number | null,
  })),
];

export function canManagePlatformTenants(
  user:
    | {
        role?: string | null;
        farmId?: string | null;
        homeFarmId?: string | null;
        username?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  // Solo la granja base puede alojar Super-Admins; un admin local no obtiene acceso global.
  const effectiveHomeFarmId = user.homeFarmId || user.farmId;
  if (effectiveHomeFarmId !== DEFAULT_FARM_ID) return false;
  const rawRole = String(user.role || "").trim().toLowerCase();
  if (rawRole === "admin" || rawRole === "superadmin") return true;
  if (String(user.username || "").trim().toLowerCase() === "admin") return true;
  return normalizeRole(user.role) === "propietario";
}
