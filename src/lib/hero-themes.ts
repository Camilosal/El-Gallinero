export type HeroThemeKey =
  | "inicio"
  | "aves"
  | "huevos"
  | "alimentacion"
  | "insumos"
  | "sanidad"
  | "incubacion"
  | "carne"
  | "gallinaza"
  | "ubicaciones"
  | "finanzas"
  | "analisis"
  | "escanear"
  | "guia";

export interface HeroThemeConfig {
  key: HeroThemeKey;
  eyebrow: string;
  alt: string;
  src1xWebp: string;
  src2xWebp: string;
  fallbackJpg: string;
  accentDotClass: string;
}

export const HERO_THEMES: Record<HeroThemeKey, HeroThemeConfig> = {
  inicio: {
    key: "inicio",
    eyebrow: "Operación diaria · La Granja",
    alt: "Ilustración botánica de amanecer en el gallinero entre árboles de bosque húmedo",
    src1xWebp: "/images/heroes/inicio-1x.webp",
    src2xWebp: "/images/heroes/inicio-2x.webp",
    fallbackJpg: "/images/heroes/inicio-1x.jpg",
    accentDotClass: "bg-amber-300",
  },
  aves: {
    key: "aves",
    eyebrow: "Parvada y genética · Animales",
    alt: "Ilustración en acuarela de gallinas ponedoras y pollos camperos en pradera",
    src1xWebp: "/images/heroes/aves-1x.webp",
    src2xWebp: "/images/heroes/aves-2x.webp",
    fallbackJpg: "/images/heroes/aves-1x.jpg",
    accentDotClass: "bg-emerald-300",
  },
  huevos: {
    key: "huevos",
    eyebrow: "Producción avícola · Postura",
    alt: "Ilustración en acuarela de canasta tejida con huevos criollos frescos en nidal",
    src1xWebp: "/images/heroes/huevos-1x.webp",
    src2xWebp: "/images/heroes/huevos-2x.webp",
    fallbackJpg: "/images/heroes/huevos-1x.jpg",
    accentDotClass: "bg-amber-300",
  },
  alimentacion: {
    key: "alimentacion",
    eyebrow: "Nutrición · Raciones y grano",
    alt: "Ilustración en acuarela de costales de grano dorado, maíz y espigas de trigo",
    src1xWebp: "/images/heroes/alimentacion-1x.webp",
    src2xWebp: "/images/heroes/alimentacion-2x.webp",
    fallbackJpg: "/images/heroes/alimentacion-1x.jpg",
    accentDotClass: "bg-amber-300",
  },
  insumos: {
    key: "insumos",
    eyebrow: "Almacén e inventario · Bodega",
    alt: "Ilustración botánica de estantes de bodega rural con herramientas e insumos",
    src1xWebp: "/images/heroes/insumos-1x.webp",
    src2xWebp: "/images/heroes/insumos-2x.webp",
    fallbackJpg: "/images/heroes/insumos-1x.jpg",
    accentDotClass: "bg-emerald-300",
  },
  sanidad: {
    key: "sanidad",
    eyebrow: "Bioseguridad · Sanidad aviar",
    alt: "Ilustración en acuarela de hierbas medicinales y frascos boticarios de bioseguridad",
    src1xWebp: "/images/heroes/sanidad-1x.webp",
    src2xWebp: "/images/heroes/sanidad-2x.webp",
    fallbackJpg: "/images/heroes/sanidad-1x.jpg",
    accentDotClass: "bg-teal-300",
  },
  incubacion: {
    key: "incubacion",
    eyebrow: "Nacimientos · Incubación",
    alt: "Ilustración en acuarela de huevos en nido cálido y pollitos recién nacidos",
    src1xWebp: "/images/heroes/incubacion-1x.webp",
    src2xWebp: "/images/heroes/incubacion-2x.webp",
    fallbackJpg: "/images/heroes/incubacion-1x.jpg",
    accentDotClass: "bg-amber-300",
  },
  carne: {
    key: "carne",
    eyebrow: "Cosecha y beneficio · Canal",
    alt: "Ilustración rústica en acuarela de cosecha de granja y hierbas aromáticas",
    src1xWebp: "/images/heroes/carne-1x.webp",
    src2xWebp: "/images/heroes/carne-2x.webp",
    fallbackJpg: "/images/heroes/carne-1x.jpg",
    accentDotClass: "bg-amber-300",
  },
  gallinaza: {
    key: "gallinaza",
    eyebrow: "Economía circular · Compostaje",
    alt: "Ilustración botánica de abono orgánico maduro, carretilla y brotes verdes",
    src1xWebp: "/images/heroes/gallinaza-1x.webp",
    src2xWebp: "/images/heroes/gallinaza-2x.webp",
    fallbackJpg: "/images/heroes/gallinaza-1x.jpg",
    accentDotClass: "bg-lime-300",
  },
  ubicaciones: {
    key: "ubicaciones",
    eyebrow: "Infraestructura · Galpones y áreas",
    alt: "Ilustración arquitectónica en acuarela de galpones de madera, potreros y cercas",
    src1xWebp: "/images/heroes/ubicaciones-1x.webp",
    src2xWebp: "/images/heroes/ubicaciones-2x.webp",
    fallbackJpg: "/images/heroes/ubicaciones-1x.jpg",
    accentDotClass: "bg-emerald-300",
  },
  finanzas: {
    key: "finanzas",
    eyebrow: "Tesorería · Finanzas de granja",
    alt: "Ilustración clásica en acuarela de libro contable rural, pluma y balanza de granja",
    src1xWebp: "/images/heroes/finanzas-1x.webp",
    src2xWebp: "/images/heroes/finanzas-2x.webp",
    fallbackJpg: "/images/heroes/finanzas-1x.jpg",
    accentDotClass: "bg-amber-300",
  },
  analisis: {
    key: "analisis",
    eyebrow: "Indicadores · Analítica avícola",
    alt: "Ilustración en acuarela de bitácora gráfica con curvas de postura y pluma",
    src1xWebp: "/images/heroes/analisis-1x.webp",
    src2xWebp: "/images/heroes/analisis-2x.webp",
    fallbackJpg: "/images/heroes/analisis-1x.jpg",
    accentDotClass: "bg-emerald-300",
  },
  escanear: {
    key: "escanear",
    eyebrow: "Trazabilidad · Identificación QR",
    alt: "Ilustración botánica de gallina blanca con banda de identificación numerada en la pata",
    src1xWebp: "/images/heroes/escanear-1x.webp",
    src2xWebp: "/images/heroes/escanear-2x.webp",
    fallbackJpg: "/images/heroes/escanear-1x.jpg",
    accentDotClass: "bg-amber-300",
  },
  guia: {
    key: "guia",
    eyebrow: "Conocimiento · Manual y catálogos",
    alt: "Ilustración botánica del gallinero campesino y sus aves criollas",
    src1xWebp: "/images/heroes/guia-1x.webp",
    src2xWebp: "/images/heroes/guia-2x.webp",
    fallbackJpg: "/images/heroes/guia-1x.jpg",
    accentDotClass: "bg-amber-300",
  },
};

const EXACT_ROUTE_THEMES: Record<string, HeroThemeKey> = {
  "/": "inicio",
  "/login": "inicio",
  "/login/recuperar": "guia",
  "/inicio": "inicio",
  "/soberania": "alimentacion",
  "/planeacion": "aves",
  "/animales": "aves",
  "/escanear": "escanear",
  "/almacen": "insumos",
  "/inventarios": "insumos",
  "/inventarios/alimentacion": "alimentacion",
  "/inventarios/insumos": "insumos",
  "/inventarios/huevos": "huevos",
  "/inventarios/carne": "carne",
  "/inventarios/gallinaza": "gallinaza",
  "/inventarios/balance": "finanzas",
  "/produccion": "huevos",
  "/produccion/gallinas": "aves",
  "/produccion/pollos": "aves",
  "/produccion/adquisiciones": "aves",
  "/produccion/peso": "aves",
  "/produccion/plan-parvada": "aves",
  "/produccion/huevos": "huevos",
  "/produccion/incubacion": "incubacion",
  "/produccion/alimentacion": "alimentacion",
  "/produccion/sacrificio": "carne",
  "/produccion/mortalidad": "sanidad",
  "/planeacion/calendario": "aves",
  "/sanidad": "sanidad",
  "/sanidad/control": "sanidad",
  "/sanidad/calendario": "sanidad",
  "/sanidad/alertas": "sanidad",
  "/sanidad/bioseguridad": "sanidad",
  "/operaciones": "ubicaciones",
  "/operaciones/activos": "insumos",
  "/operaciones/mantenimiento": "ubicaciones",
  "/operaciones/gallinaza": "gallinaza",
  "/operaciones/compostaje": "gallinaza",
  "/operaciones/cierre": "insumos",
  "/ubicaciones": "ubicaciones",
  "/finanzas": "finanzas",
  "/finanzas/ventas": "finanzas",
  "/finanzas/egresos": "finanzas",
  "/finanzas/finanzas": "finanzas",
  "/finanzas/cuentas": "finanzas",
  "/finanzas/presupuestos": "finanzas",
  "/contactos": "finanzas",
  "/analisis": "analisis",
  "/analisis/kpis": "analisis",
  "/analisis/razas": "analisis",
  "/analisis/reportes": "analisis",
  "/configuracion": "guia",
  "/configuracion/catalogos": "guia",
  "/manual": "guia",
  "/guia": "guia",
};

const PREFIX_ROUTE_THEMES: Array<{ prefix: string; theme: HeroThemeKey }> = [
  { prefix: "/lote/", theme: "aves" },
  { prefix: "/guia/", theme: "guia" },
  { prefix: "/produccion/gallinas/", theme: "aves" },
  { prefix: "/ubicaciones/", theme: "ubicaciones" },
  { prefix: "/manual/", theme: "guia" },
  { prefix: "/finanzas/", theme: "finanzas" },
  { prefix: "/analisis/", theme: "analisis" },
  { prefix: "/sanidad/", theme: "sanidad" },
  { prefix: "/inventarios/", theme: "insumos" },
  { prefix: "/operaciones/", theme: "ubicaciones" },
  { prefix: "/configuracion/", theme: "guia" },
  { prefix: "/produccion/", theme: "huevos" },
];

const TAB_THEMES: Record<string, HeroThemeKey> = {
  gallinas: "aves",
  pollos: "aves",
  animales: "aves",
  adquisiciones: "aves",
  peso: "aves",
  "plan-parvada": "aves",
  huevos: "huevos",
  incubacion: "incubacion",
  carne: "carne",
  sacrificio: "carne",
  gallinaza: "gallinaza",
  alimentacion: "alimentacion",
  insumos: "insumos",
  balance: "finanzas",
  mortalidad: "sanidad",
  sanidad: "sanidad",
  ubicaciones: "ubicaciones",
};

const GUIDE_MODULE_THEMES: Record<string, HeroThemeKey> = {
  "primeros-pasos": "inicio",
  "escanear-qr": "escanear",
  produccion: "huevos",
  animales: "aves",
  almacen: "insumos",
  planeacion: "aves",
  finanzas: "finanzas",
  sanidad: "sanidad",
  inventarios: "insumos",
  analisis: "analisis",
  configuracion: "guia",
  ubicaciones: "ubicaciones",
};

export function resolveHeroThemeByPath(pathname?: string | null, tab?: string | null): HeroThemeKey {
  if (tab && TAB_THEMES[tab]) {
    return TAB_THEMES[tab];
  }
  if (!pathname) return "inicio";
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  if (EXACT_ROUTE_THEMES[clean]) {
    return EXACT_ROUTE_THEMES[clean];
  }
  for (const entry of PREFIX_ROUTE_THEMES) {
    if (clean.startsWith(entry.prefix)) {
      return entry.theme;
    }
  }
  return "inicio";
}

export function getGuideHeroTheme(moduleId?: string | null): HeroThemeKey {
  if (!moduleId) return "guia";
  return GUIDE_MODULE_THEMES[moduleId] ?? "guia";
}

export function getAllHeroAssetUrls(options?: { highDpi?: boolean; includeFallbackJpg?: boolean }): string[] {
  const highDpi = options?.highDpi ?? true;
  const includeFallback = options?.includeFallbackJpg ?? false;
  const urls: string[] = [];
  for (const theme of Object.values(HERO_THEMES)) {
    urls.push(theme.src1xWebp);
    if (highDpi) urls.push(theme.src2xWebp);
    if (includeFallback) urls.push(theme.fallbackJpg);
  }
  return urls;
}

