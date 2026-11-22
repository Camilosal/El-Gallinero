import { NextResponse } from "next/server";

/**
 * Roles assigned to people in a farm. `admin` is reserved for the platform's
 * bootstrap account and is intentionally not assignable from farm settings.
 */
export type AppRole =
  | "admin"
  | "propietario"
  | "gerente"
  | "veterinario"
  | "operario"
  | "comercial"
  | "financiero"
  | "directivo";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador de plataforma",
  propietario: "Propietario",
  gerente: "Gerente",
  veterinario: "Veterinario / Zootecnista",
  operario: "Operario de Granja",
  comercial: "Comercial / Ventas",
  financiero: "Finanzas / Nómina",
  directivo: "Directivo · Solo consulta",
};

export type RbacPermission =
  | "production:write"
  | "animal:manage"
  | "animal_metrics:write"
  | "biosecurity:write"
  | "sanitary:write"
  | "sales:read"
  | "sales:write"
  | "contacts:read"
  | "contacts:write"
  | "inventory:read"
  | "finance:read"
  | "finance:write"
  | "finance_summary:read"
  | "analytics:read"
  | "export:read"
  | "closure:close"
  | "closure:reopen"
  | "users:manage"
  | "catalogs:write"
  | "settings:manage"
  | "integrations:manage"
  | "operations:manage"
  | "planning:write"
  | "assistant:manage";

export const PERMISSION_LABELS: Record<RbacPermission, string> = {
  "production:write": "Registrar producción diaria, alimento y mortalidad",
  "animal:manage": "Crear animales, lotes y ubicaciones; registrar traslados",
  "animal_metrics:write": "Registrar pesajes y mediciones zootécnicas",
  "biosecurity:write": "Registrar bioseguridad, bienestar y compostaje",
  "sanitary:write": "Aplicar tratamientos, vacunas y tiempos de retiro",
  "sales:read": "Consultar ventas, clientes y cobros",
  "sales:write": "Registrar ventas y gestionar cobros de clientes",
  "contacts:read": "Consultar clientes y proveedores",
  "contacts:write": "Crear y actualizar clientes y proveedores",
  "inventory:read": "Consultar existencias y disponibilidad",
  "finance:read": "Consultar movimientos, cuentas, costos y nómina",
  "finance:write": "Registrar egresos, compras, pagos, presupuestos y nómina",
  "finance_summary:read": "Consultar indicadores financieros agregados",
  "analytics:read": "Consultar indicadores, reportes y desempeño",
  "export:read": "Descargar reportes y exportaciones de consulta",
  "closure:close": "Cerrar y auditar la jornada diaria",
  "closure:reopen": "Reabrir un cierre auditado con motivo",
  "users:manage": "Crear usuarios y asignar roles de la granja",
  "catalogs:write": "Editar catálogos y variables maestras de costos e impuestos",
  "settings:manage": "Administrar el plan y los datos generales de la granja",
  "integrations:manage": "Configurar conectores externos y canales de integración",
  "operations:manage": "Administrar ubicaciones, activos y mantenimiento",
  "planning:write": "Crear y modificar calendarios, rutinas y planes de trabajo",
  "assistant:manage": "Administrar la política de acciones del asistente",
};

const OWNER_PERMISSIONS = new Set<RbacPermission>(Object.keys(PERMISSION_LABELS) as RbacPermission[]);

const ROLE_PERMISSIONS: Record<AppRole, Set<RbacPermission>> = {
  // Platform admin is a protected, non-assignable role.
  admin: new Set(OWNER_PERMISSIONS),
  propietario: new Set(OWNER_PERMISSIONS),
  gerente: new Set([
    "production:write",
    "animal:manage",
    "animal_metrics:write",
    "biosecurity:write",
    "sanitary:write",
    "sales:read",
    "sales:write",
    "contacts:read",
    "contacts:write",
    "inventory:read",
    "finance:read",
    "finance_summary:read",
    "analytics:read",
    "export:read",
    "closure:close",
    "users:manage",
    "integrations:manage",
    "operations:manage",
    "planning:write",
  ]),
  veterinario: new Set([
    "animal_metrics:write",
    "biosecurity:write",
    "sanitary:write",
    "inventory:read",
  ]),
  operario: new Set([
    "production:write",
    "animal_metrics:write",
    "biosecurity:write",
    "inventory:read",
  ]),
  comercial: new Set([
    "sales:read",
    "sales:write",
    "contacts:read",
    "contacts:write",
    "inventory:read",
  ]),
  financiero: new Set([
    "sales:read",
    "sales:write",
    "contacts:read",
    "contacts:write",
    "inventory:read",
    "finance:read",
    "finance:write",
    "finance_summary:read",
    "analytics:read",
    "export:read",
    "catalogs:write",
  ]),
  directivo: new Set([
    "finance_summary:read",
    "analytics:read",
  ]),
};

/**
 * Unknown or missing stored roles fail closed as an operario. Never turn an
 * unrecognized role string into the platform administrator.
 */
export function normalizeRole(role: string | null | undefined): AppRole {
  const clean = String(role || "").trim().toLowerCase();
  // Keep compatibility with the existing platform-level superadmin account.
  if (clean === "superadmin") return "admin";
  if (Object.hasOwn(ROLE_PERMISSIONS, clean)) return clean as AppRole;
  return "operario";
}

export function getPermissionsForRole(role: string | null | undefined): RbacPermission[] {
  return Array.from(ROLE_PERMISSIONS[normalizeRole(role)]);
}

export function canPerformAction(role: string | null | undefined, permission: RbacPermission): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].has(permission);
}

/** A manager may assign only roles whose permissions they already hold. */
export function canDelegateRole(actorRole: string | null | undefined, targetRole: string | null | undefined): boolean {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);
  if (actor === "admin" || actor === "propietario") return target !== "admin";
  const actorPermissions = ROLE_PERMISSIONS[actor];
  return Array.from(ROLE_PERMISSIONS[target]).every((permission) => actorPermissions.has(permission));
}

export function isReadOnlyRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "directivo";
}

/** Route visibility for the app shell. API checks remain the authority. */
export function canAccessAppRoute(role: string | null | undefined, href: string): boolean {
  const normalized = normalizeRole(role);
  if (normalized === "admin" || normalized === "propietario") return true;

  const path = href.split("?")[0].replace(/\/$/, "") || "/";
  const params = new URLSearchParams(href.split("?")[1] || "");

  if (path === "/inicio" || path === "/manual" || path.startsWith("/manual/")) return true;
  if (normalized === "directivo") {
    if (["/analisis/fuentes-externas", "/analisis/razas", "/analisis/kpis"].includes(path)) return false;
    return path === "/analisis" || path.startsWith("/analisis/");
  }

  if (path === "/escanear") return ["operario", "veterinario", "gerente"].includes(normalized);

  if (path.startsWith("/configuracion/usuarios")) return canPerformAction(normalized, "users:manage");
  if (path.startsWith("/configuracion/catalogos")) return canPerformAction(normalized, "catalogs:write");
  if (path.startsWith("/configuracion/kit-campo")) return canPerformAction(normalized, "operations:manage");
  if (path.startsWith("/configuracion/fallas")) return canPerformAction(normalized, "operations:manage");
  if (path.startsWith("/configuracion/")) {
    return canPerformAction(normalized, "settings:manage") || canPerformAction(normalized, "integrations:manage");
  }
  if (path === "/configuracion") return canPerformAction(normalized, "users:manage");
  if (path === "/analisis/fuentes-externas") return canPerformAction(normalized, "integrations:manage");

  if (path === "/finanzas/ventas") return canPerformAction(normalized, "sales:read");
  if (path === "/finanzas/cuentas") {
    return canPerformAction(normalized, "finance:read") || canPerformAction(normalized, "sales:read");
  }
  if (["/finanzas/egresos", "/finanzas/personal", "/finanzas/presupuestos"].includes(path)) {
    return canPerformAction(normalized, "finance:write");
  }
  if (path === "/contactos") return canPerformAction(normalized, "contacts:read");
  if (path === "/finanzas" || path === "/finanzas/finanzas" || path.startsWith("/finanzas/")) {
    return canPerformAction(normalized, "finance:read");
  }
  if (path.startsWith("/analisis")) return canPerformAction(normalized, "analytics:read");
  if (path.startsWith("/exportar")) return canPerformAction(normalized, "export:read");

  if (path === "/sanidad" || path.startsWith("/sanidad/")) {
    if (path.includes("bioseguridad")) return canPerformAction(normalized, "biosecurity:write");
    return canPerformAction(normalized, "sanitary:write");
  }
  if (path === "/operaciones/cierre") return canPerformAction(normalized, "closure:close");
  if (path.startsWith("/operaciones/compostaje")) return canPerformAction(normalized, "biosecurity:write");
  if (path.startsWith("/operaciones/")) return canPerformAction(normalized, "operations:manage");
  if (path === "/ubicaciones" || path.startsWith("/ubicaciones/")) {
    return canPerformAction(normalized, "operations:manage") || canPerformAction(normalized, "animal_metrics:write");
  }
  if (path === "/planeacion" || path.startsWith("/planeacion/")) {
    return canPerformAction(normalized, "planning:write");
  }
  if (path === "/soberania") return canPerformAction(normalized, "planning:write");

  if (path === "/inventarios/balance") return canPerformAction(normalized, "finance:read");
  if (path.startsWith("/inventarios/")) return canPerformAction(normalized, "inventory:read");
  if (path === "/inventarios") return canPerformAction(normalized, "inventory:read");
  if (path === "/almacen") return canPerformAction(normalized, "inventory:read");

  if (path.startsWith("/produccion/adquisiciones") || path.startsWith("/produccion/plan-parvada")) {
    return canPerformAction(normalized, "animal:manage") || canPerformAction(normalized, "planning:write");
  }
  if (path.startsWith("/produccion/peso")) return canPerformAction(normalized, "animal_metrics:write");
  if (path.startsWith("/produccion/mortalidad")) return canPerformAction(normalized, "production:write");
  if (path === "/produccion" && ["animales", "gallinas", "gallos", "pollos"].includes(params.get("tab") || "")) {
    return canPerformAction(normalized, "animal:manage") || canPerformAction(normalized, "animal_metrics:write");
  }
  if (path === "/produccion" && ["incubacion", "reproduccion"].includes(params.get("tab") || "")) {
    return canPerformAction(normalized, "animal:manage") || canPerformAction(normalized, "production:write");
  }
  if (path.startsWith("/produccion/gallinas/")) return canPerformAction(normalized, "animal:manage");
  if (path === "/produccion" || path.startsWith("/produccion/")) {
    return canPerformAction(normalized, "production:write");
  }
  if (path === "/animales") return canPerformAction(normalized, "animal:manage") || canPerformAction(normalized, "animal_metrics:write");

  return true;
}

export function forbiddenResponse(message = "Tu rol no tiene permiso para ejecutar esta acción") {
  return NextResponse.json({ error: message }, { status: 403 });
}
