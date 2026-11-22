import {
  canPerformAction,
  isReadOnlyRole,
  type RbacPermission,
} from "@/lib/rbac";

const SALES_ENDPOINTS = [
  "/api/finanzas/finanzas/ventas",
  "/api/finanzas/finanzas/ventas-aves",
  "/api/produccion/carne/ventas",
  "/api/produccion/gallinaza/ventas",
  "/api/cuentas-cobrar",
];

function startsWithPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isSalesEndpoint(pathname: string): boolean {
  return SALES_ENDPOINTS.some((prefix) => startsWithPath(pathname, prefix));
}

function isFinancialEndpoint(pathname: string): boolean {
  return [
    "/api/finanzas",
    "/api/presupuestos",
    "/api/cuentas-pagar",
    "/api/purchase-products",
  ].some((prefix) => startsWithPath(pathname, prefix));
}

function isInventoryEndpoint(pathname: string): boolean {
  return startsWithPath(pathname, "/api/inventarios") || pathname === "/api/produccion/huevos/inventario";
}

function isAnalysisEndpoint(pathname: string): boolean {
  return startsWithPath(pathname, "/api/analisis");
}

function isReadRequest(verb: string): boolean {
  return verb === "GET" || verb === "HEAD" || verb === "OPTIONS";
}

/** Permission checked for an API request before its handler runs. */
export function getApiPermission(
  pathname: string,
  method: string,
  body?: unknown,
): RbacPermission | RbacPermission[] | null {
  const verb = method.toUpperCase();

  if (isReadRequest(verb)) {
    // Financial summaries are available to management and executives, while
    // raw ledgers, accounts, payroll, and supplier prices stay finance-only.
    if (pathname === "/api/finanzas/resumen") return "finance_summary:read";
    if (pathname === "/api/especies/params") return "inventory:read";
    if (pathname === "/api/onboarding") return "inventory:read";
    if (isSalesEndpoint(pathname) || pathname === "/api/pagos") return "sales:read";
    if (pathname === "/api/contactos") return "contacts:read";

    if (pathname === "/api/analisis/kpis/config") return "analytics:read";
    if (pathname === "/api/analisis/pesos") return "animal_metrics:write";
    if (isAnalysisEndpoint(pathname)) return "analytics:read";

    if (pathname === "/api/export/token") return "settings:manage";
    if (pathname === "/api/export") return "export:read";
    if (pathname === "/api/asistente/delegacion") return "assistant:manage";
    if (pathname === "/api/billing/payments") return "settings:manage";
    if (pathname === "/api/billing/history") return "settings:manage";
    if (pathname === "/api/superadmin/billing/reconciliation") return "settings:manage";
    if (pathname === "/api/configuracion/usuarios") return "users:manage";

    if (startsWithPath(pathname, "/api/configuracion/fuentes-externas") || pathname === "/api/configuracion/integraciones") {
      return "integrations:manage";
    }
    if (startsWithPath(pathname, "/api/configuracion/estandares-peso")) return ["animal_metrics:write", "catalogs:write"];
    if (startsWithPath(pathname, "/api/configuracion/vacunas")) return ["sanitary:write", "catalogs:write"];
    if (pathname === "/api/configuracion/programas-alimentacion" || pathname === "/api/configuracion/factores-gallinaza") {
      return ["production:write", "catalogs:write"];
    }
    if (pathname === "/api/configuracion/catalogos") return "catalogs:write";
    if (pathname === "/api/configuracion/parametros" || startsWithPath(pathname, "/api/configuracion/plan") || pathname === "/api/configuracion/modulos") {
      return "settings:manage";
    }

    if (pathname === "/api/sync/bootstrap") return "inventory:read";
    if (startsWithPath(pathname, "/api/inventarios/insumos")) return "inventory:read";
    if (isInventoryEndpoint(pathname)) return "inventory:read";

    if (pathname === "/api/ubicaciones/sin-asignar") return "animal:manage";
    if (startsWithPath(pathname, "/api/ubicaciones")) return "animal_metrics:write";
    if (startsWithPath(pathname, "/api/produccion/peso")) return "animal_metrics:write";
    if (startsWithPath(pathname, "/api/produccion/adquisiciones")) return "animal:manage";
    if (startsWithPath(pathname, "/api/produccion/gallinas") || startsWithPath(pathname, "/api/produccion/gallos") || startsWithPath(pathname, "/api/produccion/pollos")) {
      return "animal_metrics:write";
    }
    if (startsWithPath(pathname, "/api/produccion/plan-parvada")) return "planning:write";
    if (pathname === "/api/produccion/alimentacion/catalogo-estandar") return "inventory:read";
    if (startsWithPath(pathname, "/api/produccion/etapas")) return "production:write";
    if (startsWithPath(pathname, "/api/produccion/incubacion") || startsWithPath(pathname, "/api/produccion/reproduccion")) {
      return "production:write";
    }
    if (startsWithPath(pathname, "/api/produccion")) return "production:write";
    if (startsWithPath(pathname, "/api/perdidas-huevos")) return "production:write";

    if (pathname === "/api/sanidad/bioseguridad" || startsWithPath(pathname, "/api/operaciones/compostaje")) return "biosecurity:write";
    if (
      startsWithPath(pathname, "/api/sanidad") ||
      startsWithPath(pathname, "/api/calendario-sanitario") ||
      pathname === "/api/dashboard/setup/sanitary-review"
    ) return "sanitary:write";

    if (pathname === "/api/operaciones/cierre-diario") return "closure:close";
    if (
      startsWithPath(pathname, "/api/operaciones/activos") ||
      startsWithPath(pathname, "/api/operaciones/mantenimiento") ||
      startsWithPath(pathname, "/api/operaciones/kit-campo") ||
      pathname === "/api/operaciones/sensores"
    ) return "operations:manage";
    if (pathname === "/api/operaciones/entregables-ruta2") return null; // Vet has an explicit exception in the handler.
    if (startsWithPath(pathname, "/api/operaciones/gallinaza")) return "production:write";
    if (startsWithPath(pathname, "/api/operaciones")) return "operations:manage";

    if (startsWithPath(pathname, "/api/planeacion/calendario") || startsWithPath(pathname, "/api/soberania")) return "planning:write";
    if (pathname === "/api/dashboard/setup/feeding-review") return "production:write";
    if (pathname === "/api/soporte/fallas") return "operations:manage";

    if (pathname === "/api/finanzas/catalogo-egresos") return ["inventory:read", "finance:read", "catalogs:write"];
    if (isFinancialEndpoint(pathname)) return "finance:read";
    return null;
  }

  // Sales are separate from the general ledger, payroll, and supplier payments.
  if (isSalesEndpoint(pathname)) return "sales:write";
  if (pathname === "/api/contactos") return "contacts:write";
  if (pathname === "/api/pagos") {
    const paymentType = body && typeof body === "object" && "type" in body
      ? String((body as { type?: unknown }).type)
      : "";
    return paymentType === "cobro" && verb !== "DELETE" ? "sales:write" : "finance:write";
  }
  if (pathname === "/api/produccion/alimentacion/movimientos") {
    const isPurchase = body && typeof body === "object" && "isEntry" in body && (body as { isEntry?: unknown }).isEntry === true;
    return verb === "POST" && !isPurchase ? "production:write" : "finance:write";
  }
  if (pathname === "/api/produccion/alimentacion") return "finance:write";
  if (pathname === "/api/produccion/alimentacion/alinear-catalogo") return ["catalogs:write", "finance:write"];
  if (pathname === "/api/perdidas-huevos") return "production:write";
  if (pathname === "/api/onboarding" || pathname === "/api/onboarding/sugerir") return "settings:manage";
  if (startsWithPath(pathname, "/api/inventarios/insumos")) return "finance:write";
  if (pathname === "/api/finanzas/alinear-egresos") return ["catalogs:write", "finance:write"];
  if (isFinancialEndpoint(pathname)) return "finance:write";

  if (pathname === "/api/configuracion/usuarios") return "users:manage";
  if (
    pathname === "/api/configuracion/catalogos" ||
    startsWithPath(pathname, "/api/configuracion/estandares-peso") ||
    startsWithPath(pathname, "/api/configuracion/factores-gallinaza") ||
    startsWithPath(pathname, "/api/configuracion/vacunas") ||
    startsWithPath(pathname, "/api/configuracion/programas-alimentacion") ||
    pathname === "/api/configuracion/parametros"
  ) return "catalogs:write";
  if (startsWithPath(pathname, "/api/configuracion/fuentes-externas") || pathname === "/api/configuracion/integraciones") {
    return "integrations:manage";
  }
  if (pathname === "/api/configuracion" || pathname === "/api/configuracion/plan" || pathname === "/api/configuracion/modulos") {
    return "settings:manage";
  }
  if (pathname === "/api/export/token") return "settings:manage";
  if (pathname === "/api/export") return "export:read";
  if (pathname === "/api/asistente/delegacion") return "assistant:manage";
  if (pathname === "/api/billing/checkout" || pathname === "/api/billing/renewal/verify") return "settings:manage";

  if (pathname === "/api/sanidad/bioseguridad") return verb === "DELETE" ? "sanitary:write" : "biosecurity:write";
  if (startsWithPath(pathname, "/api/sanidad") || startsWithPath(pathname, "/api/calendario-sanitario")) return "sanitary:write";

  if (pathname === "/api/produccion/peso/seed" || pathname === "/api/produccion/etapas/seed-defaults") return "catalogs:write";
  if (startsWithPath(pathname, "/api/ubicaciones/sin-asignar")) return "animal:manage";
  if (startsWithPath(pathname, "/api/ubicaciones")) return "animal:manage";
  if (
    startsWithPath(pathname, "/api/produccion/adquisiciones") ||
    startsWithPath(pathname, "/api/produccion/gallinas") ||
    startsWithPath(pathname, "/api/produccion/gallos") ||
    startsWithPath(pathname, "/api/produccion/pollos") ||
    startsWithPath(pathname, "/api/produccion/incubacion") ||
    startsWithPath(pathname, "/api/produccion/reproduccion")
  ) return "animal:manage";
  if (startsWithPath(pathname, "/api/produccion/peso") || pathname === "/api/analisis/pesos") return "animal_metrics:write";
  if (startsWithPath(pathname, "/api/produccion/plan-parvada")) return "planning:write";
  if (startsWithPath(pathname, "/api/produccion/etapas")) return "catalogs:write";
  if (startsWithPath(pathname, "/api/operaciones/activos") || startsWithPath(pathname, "/api/operaciones/mantenimiento") || startsWithPath(pathname, "/api/operaciones/kit-campo")) return "operations:manage";
  if (pathname === "/api/operaciones/compostaje") return verb === "DELETE" ? "sanitary:write" : "biosecurity:write";
  if (startsWithPath(pathname, "/api/operaciones/gallinaza") || startsWithPath(pathname, "/api/produccion/gallinaza/ajustes")) return "production:write";
  if (startsWithPath(pathname, "/api/planeacion/calendario") || startsWithPath(pathname, "/api/soberania")) return "planning:write";
  if (pathname === "/api/operaciones/cierre-diario") return "closure:close";
  if (pathname === "/api/dashboard/setup/feeding-review") return "production:write";
  if (pathname === "/api/dashboard/setup/sanitary-review") return "sanitary:write";
  if (pathname === "/api/telegram/vincular") return "integrations:manage";
  if (pathname === "/api/analisis/kpis/config") return "analytics:read";
  if (pathname === "/api/finanzas/prorrateo") return "finance:write";
  if (pathname === "/api/adjuntos") return "production:write";
  if (pathname === "/api/soporte/fallas" && verb !== "POST") return "operations:manage";
  if (startsWithPath(pathname, "/api/produccion")) return "production:write";

  return null;
}

export function hasApiPermission(
  role: string | null | undefined,
  permission: RbacPermission | RbacPermission[] | null,
): boolean {
  if (!permission) return true;
  const allowedPermissions = Array.isArray(permission) ? permission : [permission];
  return allowedPermissions.some((candidate) => canPerformAction(role, candidate));
}

/**
 * Directivos get dashboard metrics and aggregate analysis only. These explicit
 * routes exclude raw records, configuration endpoints, and operational data.
 */
export function canReadApi(role: string | null | undefined, pathname: string): boolean {
  if (!isReadOnlyRole(role)) return true;
  if (pathname === "/api/dashboard") return true;
  if (pathname === "/api/finanzas/resumen") return canPerformAction(role, "finance_summary:read");
  if (
    pathname === "/api/analisis/kpis-adopcion" ||
    pathname === "/api/analisis/curvas" ||
    pathname === "/api/analisis/resumen" ||
    startsWithPath(pathname, "/api/analisis/reportes")
  ) return canPerformAction(role, "analytics:read");
  return false;
}
