import { normalizeText } from "./text";
import { CREATE_ACTION_GROUPS } from "./create-actions";

export interface MenuItem {
  href: string;
  label: string;
  icon: string;
  keywords?: string[];
}

export interface MenuGroup {
  id: string;
  label: string;
  icon: string;
  indexHref: string;
  items: MenuItem[];
  keywords?: string[];
}

// ─── Unified groups: single mode, no simple/advanced separation ───
// Animales = registro e inventario de seres vivos.
// Producción = productos generados (huevos, carne, gallinaza).
// Inventarios = valorización de todas las existencias.
// Almacén = alimentos, insumos y mantenimiento.
export const navigationGroups: MenuGroup[] = [
  {
    id: "animales",
    label: "Animales",
    icon: "paw-print",
    indexHref: "/dashboard/animales",
    keywords: ["animales", "aves", "gallinas", "gallos", "pollos", "conejos", "codornices", "patos", "lotes", "registro", "inventario animal"],
    items: [
      { href: "/dashboard/produccion/adquisiciones", label: "Adquisiciones y entradas", icon: "incoming" },
      { href: "/dashboard/produccion?tab=animales", label: "Gestión de Animales", icon: "paw-print" },
      { href: "/dashboard/produccion/mortalidad", label: "Mortalidad", icon: "mortality" },
      { href: "/dashboard/ubicaciones", label: "Lugares de manejo", icon: "map-pin" },
      { href: "/dashboard/produccion?tab=incubacion", label: "Incubación", icon: "egg" },
    ],
  },
  {
    id: "produccion",
    label: "Producción",
    icon: "egg",
    indexHref: "/dashboard/produccion",
    keywords: ["produccion", "productos", "granja", "huevos", "carne", "gallinaza"],
    items: [
      { href: "/dashboard/produccion?tab=huevos", label: "Huevos", icon: "egg" },
      { href: "/dashboard/produccion?tab=carne", label: "Carne", icon: "meat" },
      { href: "/dashboard/produccion?tab=gallinaza", label: "Gallinaza", icon: "sprout" },
    ],
  },
  {
    id: "inventarios",
    label: "Inventarios",
    icon: "package",
    indexHref: "/dashboard/inventarios/balance",
    keywords: ["inventarios", "stock", "existencias", "bodega", "valorizacion", "valor", "balance", "patrimonio"],
    items: [
      { href: "/dashboard/inventarios/balance", label: "Valorización total", icon: "scale" },
      { href: "/dashboard/inventarios/huevos", label: "Huevos", icon: "egg" },
      { href: "/dashboard/inventarios/carne", label: "Carne", icon: "meat" },
      { href: "/dashboard/inventarios/gallinaza", label: "Gallinaza", icon: "sprout" },
    ],
  },
  {
    id: "almacen",
    label: "Almacén",
    icon: "warehouse",
    indexHref: "/dashboard/almacen",
    keywords: ["almacen", "insumos", "materiales", "alimentos", "mantenimiento", "bodega", "compras"],
    items: [
      { href: "/dashboard/produccion?tab=alimentacion", label: "Gestión de alimentación", icon: "feed" },
      { href: "/dashboard/inventarios/alimentacion", label: "Inventario de alimentos", icon: "bar-chart" },
      { href: "/dashboard/inventarios/insumos", label: "Insumos", icon: "package-open" },
      { href: "/dashboard/operaciones/activos", label: "Activos y equipos", icon: "equipment" },
      { href: "/dashboard/operaciones/mantenimiento", label: "Mantenimiento", icon: "wrench" },
    ],
  },
  {
    id: "planeacion",
    label: "Planeación",
    icon: "calendar-days",
    indexHref: "/dashboard/planeacion",
    keywords: ["planeacion", "planificacion", "soberania", "autoconsumo", "seguridad alimentaria", "familia", "huerta", "plan parvada", "proyeccion"],
    items: [
      { href: "/dashboard/produccion/plan-parvada", label: "Plan de Parvada", icon: "clipboard" },
      { href: "/dashboard/soberania", label: "Soberanía Alimentaria", icon: "home" },
    ],
  },
  {
    id: "sanidad",
    label: "Sanidad",
    icon: "pill",
    indexHref: "/dashboard/sanidad",
    keywords: ["sanidad", "salud", "enfermedad"],
    items: [
      { href: "/dashboard/sanidad/control", label: "Control", icon: "health" },
      { href: "/dashboard/sanidad/calendario", label: "Calendario", icon: "calendar" },
      { href: "/dashboard/sanidad/alertas", label: "Alertas", icon: "bell" },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: "money",
    indexHref: "/dashboard/finanzas",
    keywords: ["finanzas", "dinero", "plata", "costos"],
    items: [
      { href: "/dashboard/finanzas/ventas", label: "Ventas", icon: "money" },
      { href: "/dashboard/finanzas/egresos", label: "Egresos", icon: "outgoing" },
      { href: "/dashboard/finanzas/finanzas", label: "Balance", icon: "trend-up" },
      { href: "/dashboard/finanzas/presupuestos", label: "Presupuestos", icon: "banknote" },
      { href: "/dashboard/finanzas/cuentas", label: "Cuentas", icon: "card" },
    ],
  },
  {
    id: "analisis",
    label: "Análisis",
    icon: "bar-chart",
    indexHref: "/dashboard/analisis",
    keywords: ["analisis", "reportes", "metricas", "estadisticas"],
    items: [
      { href: "/dashboard/analisis/kpis", label: "KPIs", icon: "target" },
      { href: "/dashboard/analisis/reportes", label: "Reportes", icon: "clipboard" },
      { href: "/dashboard/analisis/razas", label: "Curvas y desempeño", icon: "trend-up" },
      { href: "/dashboard/configuracion/catalogos", label: "Catálogos y Datos Maestros", icon: "folder" },
    ],
  },
];

// ─── Sinónimos y palabras clave por módulo (búsqueda "semántica") ───
const ITEM_KEYWORDS: Record<string, string[]> = {
  "/dashboard/animales": ["animales", "aves", "gallinas", "gallos", "pollos", "conejos", "codornices", "patos", "lotes", "registro", "inventario animal", "valorizacion"],
  "/dashboard/produccion": ["produccion", "productos", "huevos", "carne", "gallinaza"],
  "/dashboard/produccion?tab=huevos": ["huevo", "huevos", "postura", "recoleccion", "recolecciones", "produccion", "diaria", "rotos", "incubables", "clasificacion", "tallas"],
  "/dashboard/produccion?tab=gallinas": ["gallina", "gallinas", "aves", "ponedoras", "gallinero", "lote", "codigo", "raza", "edad", "etapa", "empollando", "clueca"],
  "/dashboard/produccion?tab=pollos": ["pollo", "pollos", "gallos", "engorde", "broiler", "cria", "lote", "cantidad", "peso", "rooster"],
  "/dashboard/produccion?tab=carne": ["carne", "sacrificio", "faena", "canal", "despiece", "pollo", "gallina", "matanza", "kilos"],
  "/dashboard/produccion?tab=gallinaza": ["gallinaza", "abono", "estiercol", "fertilizante", "compost", "venta", "ajuste", "pollinaza"],
  "/dashboard/produccion?tab=alimentacion": ["alimentacion", "alimento", "comida", "concentrado", "maiz", "racion", "dieta", "consumo", "programa", "nutricion", "forraje"],
  "/dashboard/produccion?tab=incubacion": ["incubacion", "incubar", "huevos", "fertil", "nacimiento", "pollitos", "eclosion", "empollando"],
  "/dashboard/produccion/adquisiciones": ["adquisicion", "adquisiciones", "compra", "compras", "donacion", "ingreso", "aves", "proveedor", "inversion", "genetica", "genetico", "linaje", "genealogia", "pedigri", "origen genetico", "criador", "granja de origen", "generacion", "progenitores", "madre", "padre", "lote de origen", "lugar de destino"],
  "/dashboard/produccion/mortalidad": ["mortalidad", "muerte", "muertes", "bajas", "fallecidas", "causa", "perdidas", "aves"],
  "/dashboard/ubicaciones": ["ubicaciones", "lugares", "alojamiento", "sitio", "espacio", "corrales", "jaulas", "galpones", "potreros", "jardin", "patio", "georreferencia", "coordenadas", "gps", "mapa", "traslados", "capacidad", "estado operativo", "bioseguridad", "especificaciones sanitarias", "sanidad por lugar", "desempeño por lugar", "produccion por lugar", "mantenimiento del lugar", "adecuaciones"],
  "/dashboard/produccion/plan-parvada": ["plan", "parvada", "lotes", "planeacion", "proyeccion", "futuro", "aves", "produccion", "planificacion"],
  "/dashboard/planeacion": ["planeacion", "planificacion", "soberania", "autoconsumo", "seguridad alimentaria", "familia", "huerta", "plan parvada", "proyeccion"],
  "/dashboard/almacen": ["almacen", "insumos", "materiales", "alimentos", "mantenimiento", "bodega", "compras", "inventario"],
  "/dashboard/operaciones/activos": ["activos", "activo fijo", "equipos", "herramientas", "infraestructura", "maquina", "bebedero", "comedero", "incubadora", "motobomba", "bomba de agua", "numero de serie", "garantia"],
  "/dashboard/operaciones/mantenimiento": ["mantenimiento", "reparacion", "reparaciones", "tareas", "herramientas", "equipos", "infraestructura", "activo fijo", "activos", "maquina", "bebedero", "comedero", "incubadora", "motobomba", "cerca", "techo", "mantenimiento preventivo", "mantenimiento correctivo", "adecuacion", "recurrente", "periodico", "vencido"],
  "/dashboard/soberania": ["soberania", "autoconsumo", "seguridad alimentaria", "familia", "huerta", "consumo", "planificacion"],
  "/dashboard/sanidad": ["sanidad", "salud", "enfermedad", "prevencion"],
  "/dashboard/sanidad/control": ["sanidad", "salud", "vacuna", "vacunacion", "medicina", "medicamento", "tratamiento", "enfermedad", "control", "desparasitacion"],
  "/dashboard/sanidad/calendario": ["calendario", "sanidad", "vacunas", "fechas", "eventos", "programacion", "recordatorio"],
  "/dashboard/sanidad/alertas": ["alertas", "sanidad", "avisos", "vencidas", "proximas", "recordatorios"],
  "/dashboard/inventarios": ["inventarios", "stock", "existencias", "bodega", "balance", "valorizacion"],
  "/dashboard/inventarios/huevos": ["inventario", "huevos", "stock", "existencias", "tallas", "rotos"],
  "/dashboard/inventarios/carne": ["inventario", "carne", "stock", "congelador", "existencias", "kilos"],
  "/dashboard/inventarios/gallinaza": ["inventario", "gallinaza", "abono", "stock", "existencias"],
  "/dashboard/inventarios/alimentacion": ["inventario", "alimentacion", "alimento", "stock", "concentrado", "maiz", "comida", "dias", "proyeccion"],
  "/dashboard/inventarios/balance": ["balance", "inventario", "valor", "valorizacion", "patrimonio", "activos", "aves", "existencias", "total"],
  "/dashboard/inventarios/insumos": ["insumos", "inventario", "medicamentos", "vacunas", "herramientas", "limpieza", "stock", "proveedor"],
  "/dashboard/finanzas": ["finanzas", "dinero", "plata", "balance", "costos"],
  "/dashboard/finanzas/ventas": ["ventas", "vender", "ingresos", "facturacion", "clientes", "pedidos", "huevos", "carne", "aves", "plata", "dinero"],
  "/dashboard/finanzas/egresos": ["egresos", "gastos", "compras", "pagos", "costos", "proveedores", "plata", "dinero", "salidas"],
  "/dashboard/finanzas/finanzas": ["balance", "finanzas", "utilidad", "resultado", "flujo", "caja", "ingresos", "egresos", "plata"],
  "/dashboard/finanzas/presupuestos": ["presupuesto", "presupuestos", "planificacion", "gastos", "metas", "dinero"],
  "/dashboard/finanzas/cuentas": ["cuentas", "bancos", "caja", "saldos", "pagos", "credito", "deudas", "dinero"],
  "/dashboard/analisis": ["analisis", "reportes", "metricas", "estadisticas"],
  "/dashboard/analisis/kpis": ["kpis", "indicadores", "metricas", "metas", "rendimiento", "produccion", "eficiencia"],
  "/dashboard/analisis/reportes": ["reportes", "informes", "exportar", "pdf", "excel", "estadisticas", "datos"],
  "/dashboard/analisis/razas": ["razas", "estandares", "curvas", "desempeño", "postura", "pesos", "genetica", "crecimiento", "gallina", "pollo", "codorniz", "pato", "conejo"],
  "/dashboard/configuracion/catalogos": ["catalogos", "datos maestros", "configuracion", "etapas", "categorias", "tipos", "valores", "ajustes"],
};

const FIXED_ENTRIES: SearchEntry[] = [
  { href: "/dashboard", label: "Inicio", icon: "bar-chart", group: "General", groupIcon: "home", keywords: ["inicio", "panel", "dashboard", "resumen", "home", "principal"] },
  { href: "/dashboard/escanear", label: "Escanear Ave", icon: "qrcode", group: "General", groupIcon: "home", keywords: ["escanear", "qr", "codigo", "ave", "lote", "identificar", "camara"] },
  { href: "/dashboard/guia", label: "Guía de Usuario", icon: "book-open", group: "General", groupIcon: "home", keywords: ["guia", "ayuda", "manual", "tutorial", "documentacion", "como"] },
  { href: "/dashboard/guia/trazabilidad-genetica", label: "Guía: trazabilidad genética", icon: "dna", group: "Guía", groupIcon: "book-open", keywords: ["genetica", "genetico", "linaje", "genealogia", "pedigri", "madre", "padre", "progenitores", "origen genetico", "procedencia"] },
  { href: "/dashboard/guia/lugares-manejo", label: "Guía: lugares de manejo", icon: "map-pin", group: "Guía", groupIcon: "book-open", keywords: ["lugar", "lugares", "corral", "jaula", "galpon", "potrero", "jardin", "patio", "gps", "coordenadas", "capacidad", "desempeno por lugar"] },
  { href: "/dashboard/guia/infraestructura-equipos", label: "Guía: infraestructura y equipos", icon: "wrench", group: "Guía", groupIcon: "book-open", keywords: ["activos", "infraestructura", "equipo", "mantenimiento", "reparacion", "instalaciones"] },
  { href: "/dashboard/operaciones/activos", label: "Activos y equipos", icon: "equipment", group: "Almacén", groupIcon: "warehouse", keywords: ["activo", "activos", "equipos", "herramientas", "infraestructura", "garantia", "numero de serie"] },
];

export interface SearchEntry {
  href: string;
  label: string;
  icon: string;
  group: string;
  groupIcon: string;
  keywords: string[];
}

function buildSearchEntries(): SearchEntry[] {
  const entries: SearchEntry[] = [];

  for (const group of navigationGroups) {
    const itemHrefs = new Set(group.items.map((item) => item.href));
    if (!itemHrefs.has(group.indexHref)) {
      entries.push({
        href: group.indexHref,
        label: group.label,
        icon: group.icon,
        group: group.label,
        groupIcon: group.icon,
        keywords: group.keywords ?? [],
      });
    }
    for (const item of group.items) {
      entries.push({
        href: item.href,
        label: item.label,
        icon: item.icon,
        group: group.label,
        groupIcon: group.icon,
        keywords: item.keywords ?? ITEM_KEYWORDS[item.href] ?? [],
      });
    }
  }

  entries.push(...FIXED_ENTRIES);

  for (const group of CREATE_ACTION_GROUPS) {
    for (const action of group.actions) {
      entries.push({
        href: action.href,
        label: action.label,
        icon: action.icon,
        group: `Crear · ${group.label}`,
        groupIcon: "plus",
        keywords: [action.description, group.label, ...(action.keywords ?? [])],
      });
    }
  }

  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.href}|${entry.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const searchEntries: SearchEntry[] = buildSearchEntries();

// ─── Coincidencia difusa ───
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    previous = current;
  }
  return previous[b.length];
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (needle.length < 3) return false;
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/** Puntúa una palabra contra un token (0 = no coincide). */
function wordScore(token: string, word: string): number {
  if (!word) return 0;
  if (word === token) return 100;
  if (word.startsWith(token)) return 82;
  if (word.includes(token)) return 64;

  const distance = levenshtein(token, word);
  if (token.length >= 4 && distance <= 1) return 46;
  if (token.length >= 6 && distance <= 2) return 32;
  if (isSubsequence(token, word)) return 16;
  return 0;
}

function bestScore(token: string, words: string[]): number {
  let best = 0;
  for (const word of words) {
    const score = wordScore(token, word);
    if (score > best) best = score;
  }
  return best;
}

function scoreEntry(entry: SearchEntry, tokens: string[], fullQuery: string): number {
  const labelWords = normalizeText(entry.label).split(" ").filter(Boolean);
  const keywordWords = entry.keywords.flatMap((keyword) =>
    normalizeText(keyword).split(" ").filter(Boolean),
  );
  const groupWords = normalizeText(entry.group).split(" ").filter(Boolean);

  let total = 0;
  for (const token of tokens) {
    const labelScore = bestScore(token, labelWords);
    const keywordScore = bestScore(token, keywordWords);
    const groupScore = bestScore(token, groupWords);

    const score = Math.max(
      labelScore,
      keywordScore > 0 ? keywordScore * 0.9 : 0,
      groupScore > 0 ? groupScore * 0.6 : 0,
    );

    if (score <= 0) return 0;
    total += score;
  }

  const normalizedLabel = labelWords.join(" ");
  if (normalizedLabel.includes(fullQuery)) total += 24;
  if (normalizedLabel === fullQuery) total += 40;

  return total;
}

const DEFAULT_HREFS = [
  "/dashboard",
  "/dashboard/animales",
  "/dashboard/produccion?tab=huevos",
  "/dashboard/produccion?tab=alimentacion",
  "/dashboard/inventarios/balance",
  "/dashboard/almacen",
  "/dashboard/planeacion",
  "/dashboard/finanzas/ventas",
  "/dashboard/sanidad/control",
];

/**
 * Busca módulos por nombre, grupo, sinónimos y errores de escritura.
 * Devuelve como máximo 12 resultados ordenados por relevancia.
 */
export function searchNavigation(query: string, limit = 12): SearchEntry[] {
  const normalized = normalizeText(query);

  if (!normalized) {
    return DEFAULT_HREFS.map((href) =>
      searchEntries.find((entry) => entry.href === href),
    ).filter((entry): entry is SearchEntry => Boolean(entry));
  }

  const tokens = normalized.split(" ").filter(Boolean);

  return searchEntries
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens, normalized) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.label.localeCompare(b.entry.label, "es");
    })
    .slice(0, limit)
    .map(({ entry }) => entry);
}
