import { navigationGroups } from "./navigation";
import { getGuide, guideModules } from "./guide-data";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const PATH_OVERRIDES: Record<string, BreadcrumbItem[]> = {
  "/inicio": [{ label: "Inicio" }],
  "/animales": [
    { label: "Inicio", href: "/inicio" },
    { label: "Animales" },
  ],
  "/produccion": [
    { label: "Inicio", href: "/inicio" },
    { label: "Producción" },
  ],
  "/almacen": [
    { label: "Inicio", href: "/inicio" },
    { label: "Almacén" },
  ],
  "/planeacion": [
    { label: "Inicio", href: "/inicio" },
    { label: "Planeación" },
  ],
  "/sanidad": [
    { label: "Inicio", href: "/inicio" },
    { label: "Sanidad" },
  ],
  "/finanzas": [
    { label: "Inicio", href: "/inicio" },
    { label: "Finanzas" },
  ],
  "/analisis": [
    { label: "Inicio", href: "/inicio" },
    { label: "Análisis" },
  ],
  "/escanear": [
    { label: "Inicio", href: "/inicio" },
    { label: "Escanear QR" },
  ],
  "/exportar": [
    { label: "Inicio", href: "/inicio" },
    { label: "Exportar datos" },
  ],
  "/manual": [
    { label: "Inicio", href: "/inicio" },
    { label: "Guía de Usuario" },
  ],
  "/configuracion": [
    { label: "Inicio", href: "/inicio" },
    { label: "Configuración" },
  ],
  "/configuracion/catalogos": [
    { label: "Inicio", href: "/inicio" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Catálogos del sistema" },
  ],
  "/configuracion/modulos": [
    { label: "Inicio", href: "/inicio" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Escala y módulos visibles" },
  ],
  "/configuracion/fallas": [
    { label: "Inicio", href: "/inicio" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Reportes de fallas" },
  ],
  "/configuracion/granjas": [
    { label: "Inicio", href: "/inicio" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Granjas" },
  ],
  "/configuracion/usuarios": [
    { label: "Inicio", href: "/inicio" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Usuarios" },
  ],
  "/configuracion/plan": [
    { label: "Inicio", href: "/inicio" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Plan y suscripción" },
  ],
  "/configuracion/kit-campo": [
    { label: "Inicio", href: "/inicio" },
    { label: "Configuración", href: "/configuracion" },
    { label: "Kit de campo e impresión" },
  ],
  "/produccion/peso": [
    { label: "Inicio", href: "/inicio" },
    { label: "Animales", href: "/animales" },
    { label: "Control de peso y biometría" },
  ],
  "/inventarios/balance": [
    { label: "Inicio", href: "/inicio" },
    { label: "Inventarios", href: "/inventarios/balance" },
    { label: "Valorización total" },
  ],
};

const PRODUCCION_TAB_MAP: Record<string, { groupLabel: string; groupHref: string; label: string }> = {
  huevos: { groupLabel: "Producción", groupHref: "/produccion", label: "Huevos" },
  carne: { groupLabel: "Producción", groupHref: "/produccion", label: "Carne" },
  gallinaza: { groupLabel: "Producción", groupHref: "/produccion", label: "Gallinaza" },
  alimentacion: { groupLabel: "Almacén", groupHref: "/almacen", label: "Gestión de alimentación" },
  incubacion: { groupLabel: "Animales", groupHref: "/animales", label: "Incubación" },
  reproduccion: { groupLabel: "Animales", groupHref: "/animales", label: "Reproducción" },
  animales: { groupLabel: "Animales", groupHref: "/animales", label: "Gestión de Animales" },
  gallinas: { groupLabel: "Animales", groupHref: "/animales", label: "Gallinas ponedoras" },
  gallos: { groupLabel: "Animales", groupHref: "/animales", label: "Gallos reproductores" },
  pollos: { groupLabel: "Animales", groupHref: "/animales", label: "Lotes de pollos" },
  codornices: { groupLabel: "Animales", groupHref: "/animales", label: "Codornices" },
  patos: { groupLabel: "Animales", groupHref: "/animales", label: "Patos" },
  conejos: { groupLabel: "Animales", groupHref: "/animales", label: "Conejos" },
  cuyes: { groupLabel: "Animales", groupHref: "/animales", label: "Cuyes" },
  lotes: { groupLabel: "Animales", groupHref: "/animales", label: "Lotes y animales" },
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
 * Resuelve el camino de migajas (breadcrumbs) para cualquier ruta dentro de /inicio,
 * alineado con la estructura real de los 8 módulos, subtabs y páginas de configuración/guía.
 */
export function resolveDashboardBreadcrumb(
  pathname: string,
  searchQuery = "",
): BreadcrumbItem[] {
  const cleanPath = (pathname || "/inicio").split("?")[0].replace(/\/+$/, "") || "/inicio";
  const params = new URLSearchParams(searchQuery.startsWith("?") ? searchQuery.slice(1) : searchQuery);
  const tab = params.get("tab")?.trim() || "";
  const subtab = params.get("subtab")?.trim() || "";

  if (cleanPath === "/inicio") {
    return PATH_OVERRIDES["/inicio"];
  }

  // Guías individuales: Inicio / Guía de Usuario / Módulo / Guía
  if (cleanPath.startsWith("/manual/")) {
    const slug = cleanPath.slice("/manual/".length);
    const guide = getGuide(slug);
    const mod = guide ? guideModules.find((m) => m.id === guide.module) : null;
    if (guide) {
      return [
        { label: "Inicio", href: "/inicio" },
        { label: "Guía de Usuario", href: "/manual" },
        ...(mod ? [{ label: mod.label, href: "/manual" }] : []),
        { label: guide.title },
      ];
    }
  }

  // Detalle dinámico de lugar de manejo
  if (cleanPath.startsWith("/ubicaciones/")) {
    return [
      { label: "Inicio", href: "/inicio" },
      { label: "Animales", href: "/animales" },
      { label: "Lugares de manejo", href: "/ubicaciones" },
      { label: "Detalle del lugar" },
    ];
  }

  // Hoja de vida de ave / gallina
  if (cleanPath.startsWith("/produccion/gallinas/")) {
    return [
      { label: "Inicio", href: "/inicio" },
      { label: "Animales", href: "/animales" },
      { label: "Gestión de Animales", href: "/produccion?tab=animales" },
      { label: "Hoja de vida" },
    ];
  }

  // Producción con ?tab=... (distribuye Animales / Producción / Almacén correctamente)
  if (cleanPath === "/produccion" && tab) {
    const tabMeta = PRODUCCION_TAB_MAP[tab];
    if (tabMeta) {
      const items: BreadcrumbItem[] = [
        { label: "Inicio", href: "/inicio" },
        { label: tabMeta.groupLabel, href: tabMeta.groupHref },
        subtab && SUBTAB_LABELS[subtab]
          ? { label: tabMeta.label, href: `/produccion?tab=${tab}` }
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
          { label: "Inicio", href: "/inicio" },
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
  const segments = cleanPath.replace(/^\/+/, "").split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: "Inicio", href: "/inicio" }];
  let acc = "";
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
