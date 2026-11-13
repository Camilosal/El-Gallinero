import { normalizeText } from "./text";
import { CREATE_ACTION_GROUPS } from "./create-actions";
import {
  getGateFlagForHref,
  isHrefEnabledByFlags,
  type FeatureFlagKey,
  type ProgressiveUnlockableFlagKey,
} from "./onboarding";

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
    keywords: ["animales", "aves", "gallinas", "gallos", "pollos", "conejos", "cuyes", "cuy", "codornices", "patos", "lotes", "registro", "inventario animal"],
    items: [
      { href: "/dashboard/produccion/adquisiciones", label: "Adquisiciones y entradas", icon: "incoming" },
      { href: "/dashboard/produccion?tab=animales", label: "Gestión de Animales", icon: "paw-print" },
      { href: "/dashboard/produccion/mortalidad", label: "Mortalidad", icon: "mortality" },
      { href: "/dashboard/ubicaciones", label: "Lugares de manejo", icon: "map-pin" },
      { href: "/dashboard/produccion?tab=incubacion", label: "Incubación", icon: "egg" },
      { href: "/dashboard/produccion?tab=reproduccion", label: "Reproducción", icon: "heart" },
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
      { href: "/dashboard/operaciones/compostaje", label: "Compostaje", icon: "sprout" },
      { href: "/dashboard/operaciones/cierre", label: "Cierre Diario y Sensores", icon: "thermometer" },
    ],
  },
  {
    id: "planeacion",
    label: "Planeación",
    icon: "calendar-days",
    indexHref: "/dashboard/planeacion",
    keywords: ["planeacion", "planificacion", "calendario", "rutina", "rutinas", "cumplimiento", "soberania", "autoconsumo", "seguridad alimentaria", "familia", "huerta", "plan parvada", "proyeccion"],
    items: [
      { href: "/dashboard/planeacion/calendario", label: "Calendario y Rutinas", icon: "calendar" },
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
      { href: "/dashboard/sanidad/bioseguridad", label: "Bioseguridad y Bienestar", icon: "shield" },
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
      { href: "/dashboard/contactos", label: "Clientes y Proveedores", icon: "handshake" },
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
      { href: "/dashboard/configuracion/modulos", label: "Módulos y Escala", icon: "sparkles" },
    ],
  },
];

// ─── Sinónimos y palabras clave por módulo (búsqueda "semántica") ───
const ITEM_KEYWORDS: Record<string, string[]> = {
  "/dashboard/animales": ["animales", "aves", "gallinas", "gallos", "pollos", "conejos", "cuyes", "cuy", "codornices", "patos", "lotes", "registro", "inventario animal", "valorizacion"],
  "/dashboard/produccion": ["produccion", "productos", "huevos", "carne", "gallinaza"],
  "/dashboard/produccion?tab=huevos": ["huevo", "huevos", "postura", "recoleccion", "recolecciones", "produccion", "diaria", "rotos", "descartados", "incubables", "clasificacion", "tallas", "ntc 1240", "jumbo", "aaa", "aa", "almacenamiento", "temperatura", "humedad", "peps", "lote", "haa"],
  "/dashboard/produccion?tab=gallinas": ["gallina", "gallinas", "aves", "ponedoras", "gallinero", "lote", "codigo", "raza", "edad", "etapa", "empollando", "clueca"],
  "/dashboard/produccion?tab=pollos": ["pollo", "pollos", "gallos", "engorde", "broiler", "cria", "lote", "cantidad", "peso", "rooster"],
  "/dashboard/produccion?tab=carne": ["carne", "sacrificio", "beneficio", "faena", "canal", "despiece", "pollo", "gallina", "pato", "conejo", "cuy", "cuyes", "matanza", "kilos", "rendimiento"],
  "/dashboard/produccion?tab=gallinaza": ["gallinaza", "abono", "estiercol", "fertilizante", "compost", "venta", "ajuste", "pollinaza"],
  "/dashboard/produccion?tab=alimentacion": ["alimentacion", "alimento", "comida", "concentrado", "maiz", "racion", "dieta", "dieta combinada", "consumo", "programa", "etapas", "nutricion", "forraje", "%ms", "%pc", "materia seca", "proteina", "vitamina c", "oreo", "fcr", "comparativo", "prediccion"],
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
  "/dashboard/sanidad/alertas": ["alertas", "sanidad", "avisos", "vencidas", "proximas", "recordatorios", "carencia", "retiro", "sobrecosto", "stock"],
  "/dashboard/inventarios": ["inventarios", "stock", "existencias", "bodega", "balance", "valorizacion"],
  "/dashboard/inventarios/huevos": ["inventario", "huevos", "stock", "existencias", "tallas", "rotos"],
  "/dashboard/inventarios/carne": ["inventario", "carne", "stock", "congelador", "existencias", "kilos"],
  "/dashboard/inventarios/gallinaza": ["inventario", "gallinaza", "abono", "stock", "existencias"],
  "/dashboard/inventarios/alimentacion": ["inventario", "alimentacion", "alimento", "stock", "concentrado", "maiz", "comida", "dias", "proyeccion"],
  "/dashboard/inventarios/balance": ["balance", "inventario", "valor", "valorizacion", "patrimonio", "activos", "aves", "existencias", "total"],
  "/dashboard/inventarios/insumos": ["insumos", "inventario", "medicamentos", "vacunas", "herramientas", "limpieza", "stock", "proveedor"],
  "/dashboard/finanzas": ["finanzas", "dinero", "plata", "balance", "costos"],
  "/dashboard/finanzas/ventas": ["ventas", "vender", "ingresos", "facturacion", "clientes", "pedidos", "huevos", "carne", "animales", "aves", "cuy", "conejo", "gallinaza", "subproductos", "plata", "dinero"],
  "/dashboard/finanzas/egresos": ["egresos", "gastos", "compras", "pagos", "costos", "proveedores", "plata", "dinero", "salidas"],
  "/dashboard/finanzas/finanzas": ["balance", "finanzas", "utilidad", "resultado", "flujo", "caja", "ingresos", "egresos", "plata"],
  "/dashboard/finanzas/presupuestos": ["presupuesto", "presupuestos", "planificacion", "gastos", "metas", "dinero"],
  "/dashboard/finanzas/cuentas": ["cuentas", "bancos", "caja", "saldos", "pagos", "credito", "deudas", "dinero"],
  "/dashboard/contactos": ["clientes", "proveedores", "contactos", "compradores", "telefono", "whatsapp", "direccion", "ciudad", "credito", "directorio"],
  "/dashboard/planeacion/calendario": ["calendario", "rutina", "rutinas", "tareas", "hoy", "horizonte", "cumplimiento", "autoajustable", "vencimientos", "agenda"],
  "/dashboard/produccion?tab=animales": ["animales", "aves", "gallinas", "gallos", "pollos", "codornices", "patos", "conejos", "cuyes", "cuy", "inventario animal", "lotes"],
  "/dashboard/analisis": ["analisis", "reportes", "metricas", "estadisticas"],
  "/dashboard/analisis/kpis": ["kpis", "indicadores", "metricas", "metas", "rendimiento", "produccion", "eficiencia", "epef", "cv%", "uniformidad", "haa", "gdm", "fcr", "ventana de sacrificio", "capex", "roi"],
  "/dashboard/analisis/reportes": ["reportes", "informes", "exportar", "pdf", "excel", "xlsx", "csv", "contabilidad analitica", "prorrateo", "costos indirectos", "costos unitarios", "calibres", "capex", "roi", "rentabilidad", "estadisticas", "datos"],
  "/dashboard/analisis/razas": ["razas", "estandares", "curvas", "desempeño", "postura", "pesos", "genetica", "crecimiento", "gallina", "pollo", "ross 308", "codorniz", "pato", "conejo", "cuy", "cuyes", "epef"],
  "/dashboard/configuracion/catalogos": ["catalogos", "datos maestros", "configuracion", "etapas", "categorias", "tipos", "valores", "ajustes", "especies", "vacunas", "pesos", "gallinaza", "alimentacion", "parametros", "contactos"],
  "/dashboard/produccion?tab=reproduccion": ["reproduccion", "empadre", "palpacion", "nidal", "parto", "destete", "conejo", "conejos", "cuy", "cuyes", "consanguinidad", "madre elite", "paridad", "descarte", "camada", "gazapos", "crias"],
  "/dashboard/sanidad/bioseguridad": ["bioseguridad", "poe", "gab", "bienestar", "res 8452", "ica", "invima", "gsmi", "capacitacion", "visitantes", "desinfeccion"],
  "/dashboard/operaciones/compostaje": ["compostaje", "pila", "carbono", "3:1:1", "7:2:2", "mortalidad", "temperatura", "volteo", "abono", "sanitizacion"],
  "/dashboard/operaciones/cierre": ["cierre diario", "conciliacion", "auditoria", "reapertura", "sensores", "iot", "ith", "estres termico", "amoniaco", "nh3", "temperatura", "humedad", "bascula"],
};

const FIXED_ENTRIES: SearchEntry[] = [
  { href: "/dashboard", label: "Inicio", icon: "bar-chart", group: "General", groupIcon: "home", keywords: ["inicio", "panel", "dashboard", "resumen", "home", "principal"] },
  { href: "/dashboard/escanear", label: "Escanear", icon: "qrcode", group: "General", groupIcon: "home", keywords: ["escanear", "qr", "codigo", "animal", "lote", "ubicacion", "equipo", "identificar", "camara"] },
  { href: "/dashboard/configuracion", label: "Configuración del Gallinero", icon: "settings", group: "Análisis", groupIcon: "bar-chart", keywords: ["configuracion", "ajustes", "catalogos", "parametros", "granja", "contactos"] },
  { href: "/dashboard/configuracion/modulos", label: "Módulos Progresivos, Escala y Onboarding", icon: "sparkles", group: "Análisis", groupIcon: "bar-chart", keywords: ["onboarding", "escala", "pequeno", "mediano", "feature flags", "modulos", "desbloquear", "dia 1", "wizard", "auto trigger"] },
  { href: "/dashboard/operaciones/activos", label: "Activos y equipos", icon: "equipment", group: "Almacén", groupIcon: "warehouse", keywords: ["activo", "activos", "equipos", "herramientas", "infraestructura", "garantia", "numero de serie"] },

  // Subvistas de especies y lotes
  { href: "/dashboard/produccion/peso", label: "Control de peso y biometría", icon: "scale", group: "Animales", groupIcon: "paw-print", keywords: ["peso", "pesaje", "biometria", "curva", "uniformidad", "cv%", "ganancia diaria", "crecimiento", "muestreo"] },
  { href: "/dashboard/produccion?tab=animales&subtab=gallinas", label: "Animales: Gallinas ponedoras", icon: "hen", group: "Animales", groupIcon: "paw-print", keywords: ["gallina", "gallinas", "ponedora", "huevo", "postura", "fichas", "qr"] },
  { href: "/dashboard/produccion?tab=animales&subtab=gallos", label: "Animales: Gallos reproductores", icon: "rooster", group: "Animales", groupIcon: "paw-print", keywords: ["gallo", "gallos", "reproductor", "macho", "relacion gallina gallo"] },
  { href: "/dashboard/produccion?tab=animales&subtab=pollos", label: "Animales: Lotes de pollos", icon: "chick", group: "Animales", groupIcon: "paw-print", keywords: ["pollo", "pollos", "broiler", "ross 308", "engorde", "lote"] },
  { href: "/dashboard/produccion?tab=animales&subtab=codornices", label: "Animales: Lotes de codornices", icon: "egg", group: "Animales", groupIcon: "paw-print", keywords: ["codorniz", "codornices", "postura", "huevos codorniz", "lote"] },
  { href: "/dashboard/produccion?tab=animales&subtab=patos", label: "Animales: Lotes de patos", icon: "feather", group: "Animales", groupIcon: "paw-print", keywords: ["pato", "patos", "lote", "carne", "postura"] },
  { href: "/dashboard/produccion?tab=animales&subtab=conejos", label: "Animales: Lotes de conejos", icon: "rabbit", group: "Animales", groupIcon: "paw-print", keywords: ["conejo", "conejos", "f1", "cunicola", "gazapos", "engorde"] },
  { href: "/dashboard/produccion?tab=animales&subtab=cuyes", label: "Animales: Lotes de cuyes", icon: "paw-print", group: "Animales", groupIcon: "paw-print", keywords: ["cuy", "cuyes", "cobayo", "cuyicola", "mejorado", "lote"] },

  // Subvistas de alimentación, análisis, calendario y catálogos
  { href: "/dashboard/produccion?tab=alimentacion&subtab=etapas", label: "Alimentación: Programas y dietas por etapa", icon: "notebook", group: "Almacén", groupIcon: "warehouse", keywords: ["dieta combinada", "etapas", "programa", "forraje", "concentrado", "%ms", "%pc", "vitamina c"] },
  { href: "/dashboard/produccion?tab=alimentacion&subtab=comparativo", label: "Alimentación: Comparativo FCR y nutrientes", icon: "bar-chart", group: "Almacén", groupIcon: "warehouse", keywords: ["comparativo", "fcr", "conversion alimenticia", "costo kg ganado", "real vs programado"] },
  { href: "/dashboard/produccion?tab=alimentacion&subtab=prediccion", label: "Alimentación: Predicción de agotamiento", icon: "trend-up", group: "Almacén", groupIcon: "warehouse", keywords: ["prediccion", "dias restantes", "quiebre stock", "compra sugerida", "forraje"] },
  { href: "/dashboard/analisis/reportes?tab=dim", label: "Reportes: Rentabilidad por especie y lugar", icon: "bar-chart", group: "Análisis", groupIcon: "bar-chart", keywords: ["especie", "lugar", "margen", "utilidad", "rentabilidad", "segmentacion"] },
  { href: "/dashboard/analisis/reportes?tab=analitica", label: "Reportes: Contabilidad analítica, unitarios y prorrateo", icon: "calculator", group: "Análisis", groupIcon: "bar-chart", keywords: ["contabilidad analitica", "prorrateo", "costos indirectos", "costo por huevo", "calibres", "capex", "roi"] },
  { href: "/dashboard/planeacion/calendario?tab=calendario", label: "Planeación: Calendario mensual", icon: "calendar-days", group: "Planeación", groupIcon: "calendar-days", keywords: ["calendario", "mes", "fecha", "programacion", "eventos"] },
  { href: "/dashboard/planeacion/calendario?tab=horizonte", label: "Planeación: Horizonte a mediano y largo plazo", icon: "clock", group: "Planeación", groupIcon: "calendar-days", keywords: ["horizonte", "7 dias", "30 dias", "90 dias", "vencimientos", "proyeccion"] },
  { href: "/dashboard/planeacion/calendario?tab=cumplimiento", label: "Planeación: Cumplidos vs incumplidos", icon: "check-circle", group: "Planeación", groupIcon: "calendar-days", keywords: ["cumplimiento", "atrasadas", "incumplidas", "vencidas", "auditoria rutina"] },
  { href: "/dashboard/planeacion/calendario?tab=rutina", label: "Planeación: Configurar rutina auto-ajustable", icon: "settings", group: "Planeación", groupIcon: "calendar-days", keywords: ["rutina", "autoajustable", "tareas diarias", "turnos", "frecuencia"] },
  { href: "/dashboard/configuracion/catalogos?tab=contactos", label: "Catálogo: Clientes y Proveedores", icon: "handshake", group: "Análisis", groupIcon: "bar-chart", keywords: ["contactos", "clientes", "proveedores", "directorio"] },
  { href: "/dashboard/configuracion/catalogos?tab=parametros", label: "Catálogo: Datos de la granja y parámetros", icon: "settings", group: "Análisis", groupIcon: "bar-chart", keywords: ["parametros", "finca", "responsables", "postura", "peso venta", "incubacion"] },
  { href: "/dashboard/configuracion/catalogos?tab=especies", label: "Catálogo: Especies y genética base", icon: "chart", group: "Análisis", groupIcon: "bar-chart", keywords: ["especies", "ciclo semanas", "rendimiento canal", "fcr", "precio mercado"] },
  { href: "/dashboard/configuracion/catalogos?tab=vacunas", label: "Catálogo: Esquema de vacunas", icon: "vaccine", group: "Análisis", groupIcon: "bar-chart", keywords: ["vacunas", "biologicos", "esquema", "frecuencia"] },
  { href: "/dashboard/configuracion/catalogos?tab=pesos", label: "Catálogo: Estándares de peso por edad", icon: "dna", group: "Análisis", groupIcon: "bar-chart", keywords: ["estandares peso", "curvas", "raza", "semanas"] },
  { href: "/dashboard/configuracion/catalogos?tab=gallinaza", label: "Catálogo: Factores de gallinaza", icon: "sprout", group: "Análisis", groupIcon: "bar-chart", keywords: ["gallinaza", "factores", "generacion kg"] },
  { href: "/dashboard/configuracion/catalogos?tab=alimentacion", label: "Catálogo: Programas de alimentación", icon: "wheat", group: "Análisis", groupIcon: "bar-chart", keywords: ["programas alimento", "dietas", "consumo gramo"] },

  // Guía completa (43 guías de src/lib/guide-data.ts)
  { href: "/dashboard/guia", label: "Guía de Usuario", icon: "book-open", group: "General", groupIcon: "home", keywords: ["guia", "ayuda", "manual", "tutorial", "documentacion", "como"] },
  { href: "/dashboard/guia/primeros-pasos", label: "Guía: primeros pasos e interfaz", icon: "book-open", group: "Guía", groupIcon: "book-open", keywords: ["primeros pasos", "interfaz", "buscador", "ctrl+k", "inicio"] },
  { href: "/dashboard/guia/modo-offline-voz", label: "Guía: modo offline y voz", icon: "battery", group: "Guía", groupIcon: "book-open", keywords: ["offline", "sin conexion", "copia", "voz", "dictado", "audio", "celular"] },
  { href: "/dashboard/guia/asistente-operativo", label: "Guía: asistente IA y registro por voz", icon: "bot", group: "Guía", groupIcon: "book-open", keywords: ["asistente", "ia", "chatbot", "voz", "confirmacion"] },
  { href: "/dashboard/guia/escanear-qr", label: "Guía: escáner QR y etiquetas", icon: "qrcode", group: "Guía", groupIcon: "book-open", keywords: ["qr", "escanear", "camara", "etiqueta", "imprimir", "codigo"] },
  { href: "/dashboard/guia/gestionar-gallinas", label: "Guía: gestión integral de animales", icon: "paw-print", group: "Guía", groupIcon: "book-open", keywords: ["gallinas", "animales", "multiespecie", "fichas", "ciclo"] },
  { href: "/dashboard/guia/trazabilidad-genetica", label: "Guía: trazabilidad genética", icon: "dna", group: "Guía", groupIcon: "book-open", keywords: ["genetica", "genetico", "linaje", "genealogia", "pedigri", "madre", "padre", "progenitores", "origen genetico", "procedencia"] },
  { href: "/dashboard/guia/control-peso", label: "Guía: control de peso y biometría", icon: "scale", group: "Guía", groupIcon: "book-open", keywords: ["peso", "biometria", "curva", "muestreo", "estandar"] },
  { href: "/dashboard/guia/reproduccion-cunicola", label: "Guía: reproducción conejos y cuyes", icon: "rabbit", group: "Guía", groupIcon: "book-open", keywords: ["reproduccion", "conejo", "cuy", "empadre", "palpacion", "nidal", "parto", "destete", "consanguinidad"] },
  { href: "/dashboard/guia/incubacion", label: "Guía: incubación y nacimientos", icon: "egg", group: "Guía", groupIcon: "book-open", keywords: ["incubacion", "eclosion", "fertil", "pollitos"] },
  { href: "/dashboard/guia/lugares-manejo", label: "Guía: lugares de manejo", icon: "map-pin", group: "Guía", groupIcon: "book-open", keywords: ["lugar", "lugares", "corral", "jaula", "galpon", "potrero", "jardin", "patio", "gps", "coordenadas", "capacidad", "desempeno por lugar"] },
  { href: "/dashboard/guia/recoger-huevos", label: "Guía: recolección de huevos multiespecie", icon: "egg", group: "Guía", groupIcon: "book-open", keywords: ["recoleccion", "huevos", "postura", "ntc 1240", "tallas"] },
  { href: "/dashboard/guia/produccion-carne", label: "Guía: producción de carne y canal", icon: "meat", group: "Guía", groupIcon: "book-open", keywords: ["carne", "canal", "rendimiento", "despiece"] },
  { href: "/dashboard/guia/sacrificio-aves", label: "Guía: sacrificio y beneficio controlado", icon: "slaughter", group: "Guía", groupIcon: "book-open", keywords: ["sacrificio", "faena", "beneficio"] },
  { href: "/dashboard/guia/gallinaza-produccion", label: "Guía: producción de gallinaza", icon: "sprout", group: "Guía", groupIcon: "book-open", keywords: ["gallinaza", "abono", "estiercol", "recoleccion"] },
  { href: "/dashboard/guia/gestion-gallinaza", label: "Guía: factores y ajustes de gallinaza", icon: "sprout", group: "Guía", groupIcon: "book-open", keywords: ["gallinaza", "ajustes", "factores"] },
  { href: "/dashboard/guia/balance-inventarios", label: "Guía: balance patrimonial de inventarios", icon: "scale", group: "Guía", groupIcon: "book-open", keywords: ["balance", "patrimonio", "valorizacion", "inventarios"] },
  { href: "/dashboard/guia/inventario-huevos", label: "Guía: inventario de huevos FIFO", icon: "egg", group: "Guía", groupIcon: "book-open", keywords: ["inventario", "huevos", "fifo", "peps", "envejecimiento"] },
  { href: "/dashboard/guia/inventario-carne", label: "Guía: inventario de carne FIFO", icon: "meat", group: "Guía", groupIcon: "book-open", keywords: ["inventario", "carne", "fifo", "congelador"] },
  { href: "/dashboard/guia/alimentar-aves", label: "Guía: alimentación, raciones y programas", icon: "feed", group: "Guía", groupIcon: "book-open", keywords: ["alimentacion", "raciones", "programas", "dieta"] },
  { href: "/dashboard/guia/inventario-alimentos", label: "Guía: inventario de alimentos y proyección", icon: "feed", group: "Guía", groupIcon: "book-open", keywords: ["inventario alimentos", "proyeccion", "dias restantes"] },
  { href: "/dashboard/guia/inventario-insumos", label: "Guía: insumos, vacunas y empaques", icon: "package-open", group: "Guía", groupIcon: "book-open", keywords: ["insumos", "bodega", "empaques", "stock"] },
  { href: "/dashboard/guia/infraestructura-equipos", label: "Guía: infraestructura y equipos", icon: "wrench", group: "Guía", groupIcon: "book-open", keywords: ["activos", "infraestructura", "equipo", "mantenimiento", "reparacion", "instalaciones"] },
  { href: "/dashboard/guia/mantenimiento", label: "Guía: mantenimiento preventivo y correctivo", icon: "wrench", group: "Guía", groupIcon: "book-open", keywords: ["mantenimiento", "preventivo", "correctivo", "ordenes"] },
  { href: "/dashboard/guia/compostaje", label: "Guía: compostaje térmico", icon: "sprout", group: "Guía", groupIcon: "book-open", keywords: ["compostaje", "pila", "temperatura", "volteo", "3:1:1", "7:2:2", "mortalidad"] },
  { href: "/dashboard/guia/cierre-sensores", label: "Guía: cierre diario y sensores IoT", icon: "clipboard", group: "Guía", groupIcon: "book-open", keywords: ["cierre diario", "antifraude", "sensores", "iot", "ith", "nh3", "bascula"] },
  { href: "/dashboard/guia/calendario-rutinas", label: "Guía: calendario maestro y rutinas", icon: "calendar-days", group: "Guía", groupIcon: "book-open", keywords: ["calendario maestro", "rutinas", "autoajustable", "cumplimiento", "horizonte"] },
  { href: "/dashboard/guia/plan-parvada", label: "Guía: plan de parvada y proyecciones", icon: "clipboard", group: "Guía", groupIcon: "book-open", keywords: ["plan parvada", "proyecciones", "reemplazos"] },
  { href: "/dashboard/guia/soberania-alimentaria", label: "Guía: soberanía alimentaria", icon: "sprout", group: "Guía", groupIcon: "book-open", keywords: ["soberania", "autoconsumo", "hogar", "ahorro"] },
  { href: "/dashboard/guia/plan-sanitario", label: "Guía: plan sanitario integral", icon: "health", group: "Guía", groupIcon: "book-open", keywords: ["plan sanitario", "sanidad", "pestañas"] },
  { href: "/dashboard/guia/control-sanitario", label: "Guía: control sanitario, tratamientos y carencia", icon: "pill", group: "Guía", groupIcon: "book-open", keywords: ["control sanitario", "tratamientos", "carencia", "retiro"] },
  { href: "/dashboard/guia/calendario-vacunacion", label: "Guía: calendario de vacunación", icon: "calendar", group: "Guía", groupIcon: "book-open", keywords: ["vacunacion", "refuerzos", "recurrencia"] },
  { href: "/dashboard/guia/alertas-mortalidad", label: "Guía: alertas, mortalidad y pérdidas", icon: "alert", group: "Guía", groupIcon: "book-open", keywords: ["alertas", "mortalidad", "bajas", "perdidas"] },
  { href: "/dashboard/guia/bioseguridad-bienestar", label: "Guía: bioseguridad y bienestar ICA", icon: "shield", group: "Guía", groupIcon: "book-open", keywords: ["bioseguridad", "poe", "gab", "ica", "res 8452", "visitantes", "desinfeccion", "retiro"] },
  { href: "/dashboard/guia/registrar-venta", label: "Guía: ventas multicanal", icon: "money", group: "Guía", groupIcon: "book-open", keywords: ["ventas", "multicanal", "huevos", "carne", "gallinaza"] },
  { href: "/dashboard/guia/registrar-egreso", label: "Guía: egresos y compras detalladas", icon: "outgoing", group: "Guía", groupIcon: "book-open", keywords: ["egresos", "compras", "gastos", "proveedores"] },
  { href: "/dashboard/guia/catalogo-productos", label: "Guía: catálogo de productos de compra", icon: "tag", group: "Guía", groupIcon: "book-open", keywords: ["catalogo productos", "plantillas compra"] },
  { href: "/dashboard/guia/cuentas-cobrar-pagar", label: "Guía: cuentas cobrar y pagar", icon: "receipt", group: "Guía", groupIcon: "book-open", keywords: ["cxc", "cxp", "cuentas", "credito", "fiado", "abono", "deuda"] },
  { href: "/dashboard/guia/clientes-proveedores", label: "Guía: clientes, proveedores y OCR", icon: "handshake", group: "Guía", groupIcon: "book-open", keywords: ["clientes", "proveedores", "contactos", "ocr", "adjuntos", "credito"] },
  { href: "/dashboard/guia/balance-financiero", label: "Guía: balance financiero y flujo", icon: "trend-up", group: "Guía", groupIcon: "book-open", keywords: ["balance financiero", "flujo", "utilidad", "rentabilidad"] },
  { href: "/dashboard/guia/presupuestos", label: "Guía: presupuestos y variación", icon: "banknote", group: "Guía", groupIcon: "book-open", keywords: ["presupuestos", "metas", "variacion"] },
  { href: "/dashboard/guia/kpis-reportes", label: "Guía: KPIs y reportes P&L", icon: "target", group: "Guía", groupIcon: "book-open", keywords: ["kpis", "reportes", "p&l", "costos unitarios", "exportar"] },
  { href: "/dashboard/guia/estandares-raza", label: "Guía: curvas y desempeño por raza", icon: "chart", group: "Guía", groupIcon: "book-open", keywords: ["curvas", "estandares", "raza", "banda genetica"] },
  { href: "/dashboard/guia/catalogos-sistema", label: "Guía: catálogos y configuración maestra", icon: "folder", group: "Guía", groupIcon: "book-open", keywords: ["catalogos", "configuracion maestra", "datos de granja"] },
];

export interface SearchEntry {
  href: string;
  label: string;
  icon: string;
  group: string;
  groupIcon: string;
  keywords: string[];
  lockedByFlag?: ProgressiveUnlockableFlagKey;
}

export function filterNavigationGroups(
  flags?: Partial<Record<FeatureFlagKey, boolean>> | null,
): MenuGroup[] {
  if (!flags) return navigationGroups;
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isHrefEnabledByFlags(item.href, flags)),
    }))
    .filter((group) => group.items.length > 0 || isHrefEnabledByFlags(group.indexHref, flags));
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
  "/dashboard/produccion?tab=reproduccion",
  "/dashboard/produccion?tab=alimentacion",
  "/dashboard/planeacion/calendario",
  "/dashboard/inventarios/balance",
  "/dashboard/operaciones/cierre",
  "/dashboard/sanidad/bioseguridad",
  "/dashboard/finanzas/ventas",
  "/dashboard/analisis/reportes?tab=analitica",
];

/**
 * Busca módulos por nombre, grupo, sinónimos y errores de escritura.
 * Devuelve como máximo 12 resultados ordenados por relevancia.
 * Si se proveen `flags`, omite rutas deshabilitadas de los accesos por defecto
 * y marca con `lockedByFlag` aquellas coincidencias explícitas aún por desbloquear.
 */
export function searchNavigation(
  query: string,
  limit = 12,
  flags?: Partial<Record<FeatureFlagKey, boolean>> | null,
): SearchEntry[] {
  const normalized = normalizeText(query);

  if (!normalized) {
    return DEFAULT_HREFS
      .filter((href) => isHrefEnabledByFlags(href, flags))
      .map((href) => searchEntries.find((entry) => entry.href === href))
      .filter((entry): entry is SearchEntry => Boolean(entry));
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
    .map(({ entry }) => {
      if (!flags || isHrefEnabledByFlags(entry.href, flags)) return entry;
      const lockedByFlag = getGateFlagForHref(entry.href) ?? undefined;
      return lockedByFlag ? { ...entry, lockedByFlag } : entry;
    });
}
