import { navigationGroups } from "./navigation";
import { getGuide, guideModules } from "./guide-data";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const PATH_OVERRIDES: Record<string, BreadcrumbItem[]> = {
  "/dashboard": [{ label: "Inicio" }],
  "/dashboard/animales": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Animales" },
  ],
  "/dashboard/produccion": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Producción" },
  ],
  "/dashboard/almacen": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Almacén" },
  ],
  "/dashboard/planeacion": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Planeación" },
  ],
  "/dashboard/sanidad": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Sanidad" },
  ],
  "/dashboard/finanzas": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Finanzas" },
  ],
  "/dashboard/analisis": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Análisis" },
  ],
  "/dashboard/escanear": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Escanear QR" },
  ],
  "/dashboard/exportar": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Exportar datos" },
  ],
  "/dashboard/guia": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Guía de Usuario" },
  ],
  "/dashboard/configuracion": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Configuración" },
  ],
  "/dashboard/configuracion/catalogos": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Configuración", href: "/dashboard/configuracion" },
    { label: "Catálogos del sistema" },
  ],
  "/dashboard/configuracion/modulos": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Configuración", href: "/dashboard/configuracion" },
    { label: "Escala y módulos visibles" },
  ],
  "/dashboard/configuracion/fallas": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Configuración", href: "/dashboard/configuracion" },
    { label: "Reportes de fallas" },
  ],
  "/dashboard/configuracion/granjas": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Configuración", href: "/dashboard/configuracion" },
    { label: "Granjas" },
  ],
  "/dashboard/configuracion/usuarios": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Configuración", href: "/dashboard/configuracion" },
    { label: "Usuarios" },
  ],
  "/dashboard/configuracion/plan": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Configuración", href: "/dashboard/configuracion" },
    { label: "Plan y suscripción" },
  ],
  "/dashboard/configuracion/kit-campo": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Configuración", href: "/dashboard/configuracion" },
    { label: "Kit de campo e impresión" },
  ],
  "/dashboard/produccion/peso": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Animales", href: "/dashboard/animales" },
    { label: "Control de peso y biometría" },
  ],
  "/dashboard/inventarios/balance": [
    { label: "Inicio", href: "/dashboard" },
    { label: "Inventarios", href: "/dashboard/inventarios/balance" },
    { label: "Valorización total" },
  ],
};

const PRODUCCION_TAB_MAP: Record<string, { groupLabel: string; groupHref: string; label: string }> = {
  huevos: { groupLabel: "Producción", groupHref: "/dashboard/produccion", label: "Huevos" },
  carne: { groupLabel: "Producción", groupHref: "/dashboard/produccion", label: "Carne" },
  gallinaza: { groupLabel: "Producción", groupHref: "/dashboard/produccion", label: "Gallinaza" },
  alimentacion: { groupLabel: "Almacén", groupHref: "/dashboard/almacen", label: "Gestión de alimentación" },
  incubacion: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Incubación" },
  reproduccion: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Reproducción" },
  animales: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Gestión de Animales" },
  gallinas: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Gallinas ponedoras" },
  gallos: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Gallos reproductores" },
  pollos: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Lotes de pollos" },
  codornices: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Codornices" },
  patos: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Patos" },
  conejos: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Conejos" },
  cuyes: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Cuyes" },
  lotes: { groupLabel: "Animales", groupHref: "/dashboard/animales", label: "Lotes y animales" },
};

const SUBTAB_LABELS: Record<string, string> = {
  movimientos: "Movimientos diarios",
  etapas: "Programas y dietas",
  comparativo: "Comparativo FCR",
  prediccion: "Predicción de agotamiento",
  gallinas: "Gallinas",
  gallos: "Gallos",
  pollos: "Pollos",
  codornices: "Codornices",
  patos: "Patos",
  conejos: "Conejos",
  cuyes: "Cuyes",
  contactos: "Clientes y proveedores",
  parametros: "Datos de finca y parámetros",
  especies: "Especies y genética",
  vacunas: "Vacunas",
  pesos: "Estándares de peso",
  gallinaza: "Factores de gallinaza",
  alimentacion: "Programas de alimentación",
  fuentes: "Tablas maestras externas",
  normas: "Normas y guías",
  calendario: "Calendario mensual",
  horizonte: "Horizonte",
  cumplimiento: "Cumplimiento",
  rutina: "Rutina diaria",
  dim: "Rentabilidad por especie y lugar",
  analitica: "Costos unitarios y prorrateo",
  resumen: "Resumen",
  estado: "Estado de resultados",
  rentabilidad: "Rentabilidad",
  plan: "Plan sanitario",
};

function formatSegmentFallback(segment: string): string {
  const clean = decodeURIComponent(segment).replace(/[-_]+/g, " ").trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Resuelve el camino de migajas (breadcrumbs) para cualquier ruta dentro de /dashboard,
 * alineado con la estructura real de los 8 módulos, subtabs y páginas de configuración/guía.
 */
export function resolveDashboardBreadcrumb(
  pathname: string,
  searchQuery = "",
): BreadcrumbItem[] {
  const cleanPath = (pathname || "/dashboard").split("?")[0].replace(/\/+$/, "") || "/dashboard";
  const params = new URLSearchParams(searchQuery.startsWith("?") ? searchQuery.slice(1) : searchQuery);
  const tab = params.get("tab")?.trim() || "";
  const subtab = params.get("subtab")?.trim() || "";

  if (cleanPath === "/dashboard") {
    return PATH_OVERRIDES["/dashboard"];
  }

  // Guías individuales: Inicio / Guía de Usuario / Módulo / Guía
  if (cleanPath.startsWith("/dashboard/guia/")) {
    const slug = cleanPath.slice("/dashboard/guia/".length);
    const guide = getGuide(slug);
    const mod = guide ? guideModules.find((m) => m.id === guide.module) : null;
    if (guide) {
      return [
        { label: "Inicio", href: "/dashboard" },
        { label: "Guía de Usuario", href: "/dashboard/guia" },
        ...(mod ? [{ label: mod.label, href: "/dashboard/guia" }] : []),
        { label: guide.title },
      ];
    }
  }

  // Detalle dinámico de lugar de manejo
  if (cleanPath.startsWith("/dashboard/ubicaciones/")) {
    return [
      { label: "Inicio", href: "/dashboard" },
      { label: "Animales", href: "/dashboard/animales" },
      { label: "Lugares de manejo", href: "/dashboard/ubicaciones" },
      { label: "Detalle del lugar" },
    ];
  }

  // Hoja de vida de ave / gallina
  if (cleanPath.startsWith("/dashboard/produccion/gallinas/")) {
    return [
      { label: "Inicio", href: "/dashboard" },
      { label: "Animales", href: "/dashboard/animales" },
      { label: "Gestión de Animales", href: "/dashboard/produccion?tab=animales" },
      { label: "Hoja de vida" },
    ];
  }

  // Producción con ?tab=... (distribuye Animales / Producción / Almacén correctamente)
  if (cleanPath === "/dashboard/produccion" && tab) {
    const tabMeta = PRODUCCION_TAB_MAP[tab];
    if (tabMeta) {
      const items: BreadcrumbItem[] = [
        { label: "Inicio", href: "/dashboard" },
        { label: tabMeta.groupLabel, href: tabMeta.groupHref },
        subtab && SUBTAB_LABELS[subtab]
          ? { label: tabMeta.label, href: `/dashboard/produccion?tab=${tab}` }
          : { label: tabMeta.label },
      ];
      if (subtab && SUBTAB_LABELS[subtab]) {
        items.push({ label: SUBTAB_LABELS[subtab] });
      }
      return items;
    }
  }

  // Overrides exactos
  if (PATH_OVERRIDES[cleanPath]) {
    const base = PATH_OVERRIDES[cleanPath].map((item) => ({ ...item }));
    if (tab && SUBTAB_LABELS[tab]) {
      const last = base[base.length - 1];
      base[base.length - 1] = { label: last.label, href: cleanPath };
      base.push({ label: SUBTAB_LABELS[tab] });
    }
    return base;
  }

  // Buscar coincidencia exacta dentro de navigationGroups (por path + tab, o por path)
  const fullTarget = tab ? `${cleanPath}?tab=${tab}` : cleanPath;
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.href === fullTarget || item.href === cleanPath) {
        const items: BreadcrumbItem[] = [
          { label: "Inicio", href: "/dashboard" },
          { label: group.label, href: group.indexHref },
        ];
        const tabLabel = tab ? SUBTAB_LABELS[tab] : undefined;
        if (tab && tabLabel && item.href === cleanPath) {
          items.push({ label: item.label, href: cleanPath });
          items.push({ label: tabLabel });
        } else {
          items.push({ label: item.label });
        }
        return items;
      }
    }
  }

  // Fallback estructurado por segmentos
  const segments = cleanPath.replace(/^\/dashboard\/?/, "").split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: "Inicio", href: "/dashboard" }];
  let acc = "/dashboard";
  segments.forEach((seg, idx) => {
    acc += `/${seg}`;
    const isLast = idx === segments.length - 1 && !(tab && SUBTAB_LABELS[tab]);
    const label = formatSegmentFallback(seg);
    items.push(isLast ? { label } : { label, href: acc });
  });
  if (tab && SUBTAB_LABELS[tab]) {
    items.push({ label: SUBTAB_LABELS[tab] });
  }
  return items;
}
