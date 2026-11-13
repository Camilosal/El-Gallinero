import { NextResponse } from "next/server";

export type AppRole = "admin" | "propietario" | "gerente" | "veterinario" | "operario";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Propietario / Admin",
  propietario: "Propietario",
  gerente: "Gerente",
  veterinario: "Veterinario / Zootecnista",
  operario: "Operario de Granja",
};

export type RbacPermission =
  | "finance:write"
  | "sanitary:write"
  | "closure:close"
  | "closure:reopen"
  | "config:write"
  | "production:write"
  | "biosecurity:write";

export const PERMISSION_LABELS: Record<RbacPermission, string> = {
  "production:write": "Registrar postura, alimentación, peso e incubación",
  "biosecurity:write": "Escanear QR y registrar bioseguridad / compostaje",
  "sanitary:write": "Aplicar tratamientos, vacunas y tiempos de retiro",
  "closure:close": "Ejecutar cierre diario auditable de caja y galpón",
  "closure:reopen": "Reabrir cierre diario auditado",
  "finance:write": "Registrar ventas, compras, pagos y prorrateo analítico",
  "config:write": "Gestionar usuarios, ubicaciones, catálogos y plan",
};

const ROLE_PERMISSIONS: Record<AppRole, Set<RbacPermission>> = {
  admin: new Set(["finance:write", "sanitary:write", "closure:close", "closure:reopen", "config:write", "production:write", "biosecurity:write"]),
  propietario: new Set(["finance:write", "sanitary:write", "closure:close", "closure:reopen", "config:write", "production:write", "biosecurity:write"]),
  gerente: new Set(["finance:write", "sanitary:write", "closure:close", "config:write", "production:write", "biosecurity:write"]),
  veterinario: new Set(["sanitary:write", "production:write", "biosecurity:write"]),
  operario: new Set(["production:write", "biosecurity:write"]),
};

export function getPermissionsForRole(role: string | null | undefined): RbacPermission[] {
  const normalized = normalizeRole(role);
  return Array.from(ROLE_PERMISSIONS[normalized]);
}

export function normalizeRole(role: string | null | undefined): AppRole {
  const clean = String(role || "admin").trim().toLowerCase();
  if (clean === "propietario" || clean === "gerente" || clean === "veterinario" || clean === "operario") {
    return clean;
  }
  return "admin";
}

export function canPerformAction(role: string | null | undefined, permission: RbacPermission): boolean {
  const normalized = normalizeRole(role);
  return ROLE_PERMISSIONS[normalized].has(permission);
}

export function forbiddenResponse(message = "Tu rol no tiene permiso para ejecutar esta acción") {
  return NextResponse.json({ error: message }, { status: 403 });
}
