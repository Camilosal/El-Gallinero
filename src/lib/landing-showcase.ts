export type ShowcaseSimulationKind =
  | "routines"
  | "quick-capture"
  | "ai-voice"
  | "ntc1240-curves"
  | "sanitary-withdrawal"
  | "offline-peps";

export interface ShowcaseTabItem {
  id: string;
  tabLabel: string;
  shortLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  routeLabel: string;
  screenshot: string;
  screenshotAlt: string;
  secondaryScreenshot?: string;
  secondaryLabel?: string;
  secondaryAlt?: string;
  highlights: string[];
  tags: string[];
  simulationKind: ShowcaseSimulationKind;
}

export interface ShowcaseGalleryItem {
  id: string;
  title: string;
  moduleTag: string;
  routeLabel: string;
  summary: string;
  image: string;
  alt: string;
}

export interface SectorStandardItem {
  code: string;
  authority: string;
  title: string;
  summary: string;
  enforcement: string;
  tags: string[];
}

export interface AiAutomationPillar {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  exampleInput: string;
  exampleOutput: string;
  highlights: string[];
}

export interface AdoptionKeyItem {
  step: string;
  title: string;
  metric: string;
  description: string;
  detail: string;
}

export interface CyclePlanShowcase {
  id:
    | "FREEMIUM_SEMILLA"
    | "CICLO_60D"
    | "SEMESTRAL_PONEDORA"
    | "MEDIANO_MENSUAL";
  badge: string;
  name: string;
  priceLabel: string;
  durationLabel: string;
  summary: string;
  highlights: string[];
  featured?: boolean;
}

export const SHOWCASE_TABS: ShowcaseTabItem[] = [
  {
    id: "rutinas",
    tabLabel: "Inicio y tareas del día",
    shortLabel: "Inicio",
    eyebrow: "Operación diaria",
    title: "Lo importante primero y tareas que se validan con hechos",
    description:
      "Al abrir la app ves las cifras clave, los avisos urgentes y la lista de tareas del día. Cada tarea se marca al guardar su registro real o confirmar el recorrido en campo.",
    routeLabel: "gallinero.iwage.co/dashboard",
    screenshot: "/images/guia/inicio-dashboard.webp",
    screenshotAlt:
      "Pantalla principal del tablero de El Gallinero con alertas del día, preparación de granja y estado de copia offline",
    highlights: [
      "Las tareas productivas se completan automáticamente al guardar huevos, alimento o pesajes.",
      "Los recorridos sin novedad piden confirmación breve en campo para evitar cierres falsos.",
      "Vista organizada en 2 columnas en el celular para leer sin esfuerzo.",
    ],
    tags: ["Ruta clara", "Verificación real", "Vista móvil"],
    simulationKind: "routines",
  },
  {
    id: "captura",
    tabLabel: "Registro rápido y QR",
    shortLabel: "Registro y QR",
    eyebrow: "En campo en pocos toques",
    title: "Escanea la entrada del galpón y anota la jornada en menos de 2 minutos",
    description:
      "Sin menús largos: lee el código QR del galpón o corral, suma cubetas de 30 huevos o bultos de 40 kg con botones grandes y recibe el resumen al instante.",
    routeLabel: "gallinero.iwage.co/dashboard · Registro rápido",
    screenshot: "/images/guia/captura-rapida-modal.webp",
    screenshotAlt:
      "Modal de Registro Rápido con pestañas de huevos, alimento, mortalidad, gasto y venta, y botones de incremento por cubeta",
    secondaryScreenshot: "/images/guia/escanear-qr.webp",
    secondaryLabel: "Escáner QR de corral",
    secondaryAlt:
      "Pantalla de Escáner QR mostrando acciones directas para Galpón Principal: recoger huevos, dar alimento, reportar baja y ver ficha",
    highlights: [
      "Botones táctiles de ≥ 48 px para cubetas de 30 huevos o bultos de 40 kg bajo luz solar.",
      "Entrega al instante el micro-reporte con Utilidad Neta Hoy (Ingreso − Alimento) para WhatsApp.",
      "Muestra cuánto alimento queda en bodega y marca la rutina del día.",
    ],
    tags: ["QR por corral", "Alto contraste", "Utilidad neta hoy"],
    simulationKind: "quick-capture",
  },
  {
    id: "agente-ia",
    tabLabel: "Gina y voz",
    shortLabel: "Gina · Voz",
    eyebrow: "Ayuda cercana en campo",
    title: "Habla o escribe a Gina; la app ordena los datos por ti",
    description:
      "Pregúntale a Gina (nuestra gallina asistente con gafas) cuántos huevos o animales tienes, qué vacunas se acercan o cómo va el mes. Si dictas un movimiento o envías foto de factura, lo estructura y te pide confirmar antes de guardar.",
    routeLabel: "gallinero.iwage.co · Gina",
    screenshot: "/images/guia/asistente-ia.webp",
    screenshotAlt:
      "Panel lateral de Gina (asistente con gafas) mostrando qué puede hacer, sugerencias rápidas, cámara y dictado por voz",
    secondaryScreenshot: "/images/guia/buscar-global-modal.webp",
    secondaryLabel: "Buscador rápido Ctrl+K",
    secondaryAlt:
      "Buscador global Ctrl+K para saltar al instante a cualquier módulo, guía o creación rápida",
    highlights: [
      "Funciona por texto, dictado en vivo o nota de audio guardada cuando no hay señal.",
      "Consulta datos de aves, conejos, cuyes, bodega, vacunas y cuentas.",
      "Nunca registra ventas o gastos sin tu confirmación expresa.",
    ],
    tags: ["Dictado por voz", "Consultas al instante", "Confirmación segura"],
    simulationKind: "ai-voice",
  },
  {
    id: "produccion",
    tabLabel: "Huevos y control de peso",
    shortLabel: "Huevos y peso",
    eyebrow: "Calidad y crecimiento",
    title: "Clasifica huevos por tamaño y compara el peso del lote con su raza",
    description:
      "Separa huevos aptos, rotos o para incubar desde la recolección, ordena las salidas del más antiguo al más nuevo y compara el crecimiento contra la curva esperada.",
    routeLabel: "gallinero.iwage.co/dashboard/produccion",
    screenshot: "/images/guia/produccion-huevos.webp",
    screenshotAlt:
      "Módulo de Producción de Huevos Multiespecie con KPIs de huevos totales, promedio diario, ahorro hogar y postura esperada",
    secondaryScreenshot: "/images/guia/peso-biometria.webp",
    secondaryLabel: "Curva de peso por raza",
    secondaryAlt:
      "Gráfica comparativa de Curva de Peso ISA Brown con banda rango mínimo-máximo y tooltip semanal",
    highlights: [
      "Curvas genéticas precargadas (Hy-Line Brown, ISA Brown, Ross 308, Pato Pekín, codorniz, conejo y cuy).",
      "Alerta de ventana óptima de cosecha/venta antes de perder conversión alimenticia (FCR).",
      "Conversión a cubetas (×30), orden PEPS automático y ficha QR trazable por lote.",
    ],
    tags: ["Calibres NTC 1240", "Ventana de cosecha", "Curvas precargadas"],
    simulationKind: "ntc1240-curves",
  },
  {
    id: "sanidad",
    tabLabel: "Sanidad y bioseguridad",
    shortLabel: "Sanidad",
    eyebrow: "Cuidado preventivo",
    title: "Vacunas al día y bloqueo automático cuando hay tratamiento activo",
    description:
      "Registra aplicaciones veterinarias y sus días de retiro para evitar vender huevos o carne antes de tiempo, junto con alertas de reemplazo y listas de bioseguridad.",
    routeLabel: "gallinero.iwage.co/dashboard/sanidad/control",
    screenshot: "/images/guia/sanidad-control.webp",
    screenshotAlt:
      "Pantalla de Control Fitosanitario con resumen de registros, vacunaciones, próximos eventos programados e historial",
    secondaryScreenshot: "/images/guia/plan-parvada.webp",
    secondaryLabel: "Plan de parvada",
    secondaryAlt:
      "Pantalla de Plan de Parvada mostrando alertas de aves fuera de ciclo, cumplimiento de postura del 117.9% y relación gallos/gallinas",
    highlights: [
      "Calcula la fecha segura de liberación e impide ventas durante el tiempo de retiro.",
      "Recuerda desinfecciones, control de visitantes y períodos de descanso por galpón.",
      "Avisa cuándo conviene renovar aves fuera de ciclo productivo.",
    ],
    tags: ["Tiempos de retiro", "Bioseguridad ICA", "Plan de reemplazos"],
    simulationKind: "sanitary-withdrawal",
  },
  {
    id: "finanzas",
    tabLabel: "Ventas, costos y sin señal",
    shortLabel: "Finanzas y offline",
    eyebrow: "Cuentas claras en campo",
    title: "Separa ingresos y gastos por especie y sigue trabajando sin internet",
    description:
      "Registra ventas de huevos, carne, animales en pie o abono, lee recibos con la cámara y sigue anotando en el galpón aunque no haya cobertura en la vereda.",
    routeLabel: "gallinero.iwage.co/dashboard/finanzas · Modo offline",
    screenshot: "/images/guia/finanzas-balance.webp",
    screenshotAlt:
      "Panel Financiero con ingresos, egresos, utilidad neta, margen y flujo de caja en el período",
    secondaryScreenshot: "/images/guia/offline-copia-modal.webp",
    secondaryLabel: "Trabajo sin conexión",
    secondaryAlt:
      "Modal de Copia completa en el dispositivo mostrando descarga para navegación offline y cola de registros pendientes",
    highlights: [
      "Muestra cuánto deja cada especie sin mezclar costos entre lotes.",
      "Copia local cifrada en el celular para huevos, alimento, vacunas, reproducción y cierres sin señal.",
      "Sincronización extendida sin duplicados al volver a la vereda y resumen listo para WhatsApp.",
    ],
    tags: ["Cuentas por especie", "Offline cifrado", "Resumen WhatsApp"],
    simulationKind: "offline-peps",
  },
];

export const SHOWCASE_GALLERY: ShowcaseGalleryItem[] = [
  {
    id: "gal-adquisiciones",
    title: "Adquisiciones y origen",
    moduleTag: "Animales",
    routeLabel: "/dashboard/produccion/adquisiciones",
    summary: "Historial de compras, nacimientos, procedencia y valor invertido.",
    image: "/images/guia/adquisiciones-genetica.webp",
    alt: "Pantalla de Adquisiciones y entradas de animales con historial, inversión total y detalle de linaje",
  },
  {
    id: "gal-ubicacion",
    title: "Ficha por corral o galpón",
    moduleTag: "Lugares",
    routeLabel: "/dashboard/ubicaciones/[id]",
    summary: "Ocupación, producción, sanidad y mantenimientos por espacio.",
    image: "/images/guia/ubicacion-ficha.webp",
    alt: "Ficha de Criadora y Enfermería Sur con KPIs de ocupación, producción por especie y traslados",
  },
  {
    id: "gal-qr",
    title: "Escáner QR de campo",
    moduleTag: "Agilidad",
    routeLabel: "/dashboard/escanear",
    summary: "Escanea la placa del lugar para recoger huevos o servir alimento en segundos.",
    image: "/images/guia/escanear-qr.webp",
    alt: "Escáner QR de Granja mostrando acciones rápidas para el Galpón Principal",
  },
  {
    id: "gal-peso",
    title: "Curvas de crecimiento",
    moduleTag: "Producción",
    routeLabel: "/dashboard/produccion/peso",
    summary: "Compara el peso del lote frente a la meta esperada por semana.",
    image: "/images/guia/peso-biometria.webp",
    alt: "Curva de peso ISA Brown con banda de referencia combinada e indicadores semanales",
  },
  {
    id: "gal-ventas",
    title: "Ventas de toda la finca",
    moduleTag: "Finanzas",
    routeLabel: "/dashboard/finanzas/ventas",
    summary: "Registra ventas de huevos, animales, carne, gallinaza y productos.",
    image: "/images/guia/finanzas-ventas.webp",
    alt: "Módulo de Ventas con pestañas de Huevos, Aves, Carne y Gallinaza e inventario disponible por calibre",
  },
  {
    id: "gal-kpis",
    title: "Indicadores del negocio",
    moduleTag: "Análisis",
    routeLabel: "/dashboard/analisis/kpis",
    summary: "Porcentaje de postura, mortalidad, costos unitarios y reportes.",
    image: "/images/guia/analisis-kpis.webp",
    alt: "Tablero de Indicadores Clave KPIs con tasa de mortalidad y tasa de postura sobre población elegible",
  },
  {
    id: "gal-parvada",
    title: "Plan de parvada",
    moduleTag: "Planeación",
    routeLabel: "/dashboard/produccion/plan-parvada",
    summary: "Seguimiento de aves aptas frente a la meta y programación de reemplazos.",
    image: "/images/guia/plan-parvada.webp",
    alt: "Plan de Parvada con cumplimiento del 117.9% y recomendaciones de reposición y sacrificio",
  },
  {
    id: "gal-trazabilidad",
    title: "Trazabilidad pública QR",
    moduleTag: "Confianza",
    routeLabel: "/trazabilidad/[lote]",
    summary: "Página pública compartible para respaldar origen, edad y cuidado del lote.",
    image: "/images/guia/trazabilidad-lote-publica.webp",
    alt: "Ficha pública de Trazabilidad del Lote L-001 raza Cobb 500 lista para consulta vía QR",
  },
];

export const SECTOR_STANDARDS: SectorStandardItem[] = [
  {
    code: "NTC 1240",
    authority: "Calidad de huevo",
    title: "Clasificación por tamaño y salida por orden de llegada",
    summary:
      "Clasifica de Jumbo a C, descarta rotos antes de entrar a bodega y vende primero los lotes más antiguos.",
    enforcement: "Convierte automáticamente cubetas de 30 huevos con inventario PEPS.",
    tags: ["Jumbo a C", "PEPS"],
  },
  {
    code: "ICA 3650–3652 · 12486",
    authority: "Bioseguridad avícola",
    title: "Control de accesos, desinfección y separación por especie",
    summary:
      "Organiza registros de visitantes, limpieza periódica, vacío sanitario entre lotes y temperatura de vacunas.",
    enforcement: "Recuerda descansos sanitarios y separa aves de mamíferos menores.",
    tags: ["Bioseguridad", "Vacío sanitario"],
  },
  {
    code: "Res. MADR 205 · ICA 8452",
    authority: "Bienestar animal",
    title: "Evaluación práctica de condiciones en granjas mixtas",
    summary:
      "Verifica agua, espacio, ventilación y cuidado animal por especie con alertas claras cuando algún punto baja del nivel esperado.",
    enforcement: "Identifica brechas por especie antes de que afecten la certificación.",
    tags: ["Granjas mixtas", "Bienestar"],
  },
  {
    code: "PRAMSAC · INVIMA · GSMI",
    authority: "Inocuidad alimentaria",
    title: "Bloqueo preventivo durante tiempos de retiro",
    summary:
      "Cada tratamiento veterinario calcula la fecha de liberación e impide vender huevos o carne mientras el medicamento esté activo.",
    enforcement: "Evita mezclar lotes en retiro con mercancía disponible para venta.",
    tags: ["Cero residuos", "Retiros"],
  },
  {
    code: "ICA 30292 · AGROSAVIA",
    authority: "Aprovechamiento orgánico",
    title: "Compostaje controlado de mortalidad y gallinaza",
    summary:
      "Guía las mezclas, avisa cuándo voltear la pila y valida temperatura y maduración antes de liberar el abono.",
    enforcement: "Controla tiempos de proceso de 8 semanas hasta obtener abono listo.",
    tags: ["Compostaje", "Abono"],
  },
  {
    code: "DIAN · Crédito agro",
    authority: "Gestión financiera",
    title: "Costos claros por especie y reportes exportables",
    summary:
      "Separa gastos directos y compartidos para ver el costo real por huevo o kilo y avisa si vendes por debajo de tu punto de equilibrio.",
    enforcement: "Exporta balances en Excel y PDF listos para contador o banco.",
    tags: ["Punto de equilibrio", "Excel y PDF"],
  },
];

export const AI_AUTOMATION_PILLARS: AiAutomationPillar[] = [
  {
    id: "ai-assistant",
    eyebrow: "Voz y texto",
    title: "Dicta lo que pasó en el corral",
    summary:
      "Habla en lenguaje cotidiano; el asistente registra huevos o alimento y te pide confirmar antes de tocar dinero.",
    exampleInput: "«Galpón 1: 140 huevos y 1 bulto de postura»",
    exampleOutput: "Actualiza postura y descuenta 40 kg de bodega.",
    highlights: [
      "Dictado en vivo o nota de audio sin internet.",
      "Confirmación obligatoria en ventas y pagos.",
    ],
  },
  {
    id: "ocr-qr-automation",
    eyebrow: "QR y lectura de recibos",
    title: "Cero digitar dos veces",
    summary:
      "Escanea el galpón o toma foto a una factura de compra para precargar datos y actualizar saldos automáticamente.",
    exampleInput: "Escaneo del galpón o foto de recibo",
    exampleOutput: "Precarga lote, sugiere valores y actualiza inventarios.",
    highlights: [
      "Placas QR imprimibles por galpón o lote.",
      "Calcula días de alimento restantes automáticamente.",
    ],
  },
  {
    id: "micro-insights-routines",
    eyebrow: "Rutina verificada",
    title: "Confirmación inmediata al guardar",
    summary:
      "Cada movimiento devuelve el resumen útil del lote y marca como cumplida la tarea correspondiente del día.",
    exampleInput: "Guardas postura o pesaje del día",
    exampleOutput: "Marca la tarea hecha y compara contra tu meta.",
    highlights: [
      "Las tareas se marcan solo con registros o evidencia real.",
      "Muestra utilidad práctica en cada toque.",
    ],
  },
];

export const ADOPTION_KEYS: AdoptionKeyItem[] = [
  {
    step: "01",
    title: "Arranque Día 1 con plan sanitario precargado",
    metric: "3 min · Sin deuda",
    description:
      "Crea tu granja, anota solo los animales vivos de hoy y recibe la curva y vacunas ICA según su edad actual.",
    detail:
      "Sin transcribir cuadernos viejos: ingresas tu lote actual y el sistema ajusta el calendario sanitario ICA y la curva genética desde la semana en que estás.",
  },
  {
    step: "02",
    title: "Crece a tu ritmo (Pequeño o Mediano)",
    metric: "Escala gradual",
    description:
      "Empieza con los 4 botones esenciales y activa módulos avanzados cuando tu operación lo pida.",
    detail:
      "Desde una finca familiar de 1 lote hasta operación multi-galpón con cuadrillas QR, incubación y contabilidad analítica sin cambiar de app.",
  },
  {
    step: "03",
    title: "Hecha para el sol, las manos ocupadas y la vereda",
    metric: "≥ 48 px · Offline",
    description:
      "Botones amplios de alto contraste, lectura QR y bóveda offline cifrada que sincroniza sola al volver la señal.",
    detail:
      "Registra postura, alimento, bajas, pesajes, sanidad y cierre diario en el celular incluso sin señal de internet en el galpón.",
  },
  {
    step: "04",
    title: "Utilidad neta al instante y pagos por ciclo",
    metric: "Sin ataduras",
    description:
      "Al guardar huevos o alimento ves tu utilidad neta del día para WhatsApp, y renuevas por cosecha con Nequi, Daviplata o PSE.",
    detail:
      "Prueba gratis 30 días sin tarjeta y mantén 1 lote activo siempre libre. Si vence un ciclo, nunca bloqueamos tus datos ni la venta de tu lote en curso.",
  },
];

export const CYCLE_PLANS_SHOWCASE: CyclePlanShowcase[] = [
  {
    id: "FREEMIUM_SEMILLA",
    badge: "Gratis siempre",
    name: "Semilla (1 lote)",
    priceLabel: "$0 COP",
    durationLabel: "30 días full + 1 lote libre",
    summary:
      "Empieza en 3 minutos sin tarjeta. Al terminar la prueba, sigues operando 1 lote activo gratis y nunca bloqueamos tus datos.",
    highlights: [
      "1 lote activo gratis permanente",
      "Lectura y cierre/venta de lotes siempre libres",
      "Modo sin señal cifrado en el celular",
    ],
  },
  {
    id: "CICLO_60D",
    badge: "Por cosecha",
    name: "Ciclo Engorde 60d",
    priceLabel: "$45.000 COP",
    durationLabel: "60 días por ciclo",
    summary:
      "Pensado para lotes de pollo de engorde, pato Pekín, conejo o cuy. Pagas solo cuando tienes lote en producción, sin mensualidades fijas.",
    highlights: [
      "Hasta 3 lotes y 3 operarios",
      "Curva biológica y ventana óptima de venta",
      "Pago único con Nequi, Daviplata o PSE",
    ],
    featured: true,
  },
  {
    id: "SEMESTRAL_PONEDORA",
    badge: "Postura y mixtas",
    name: "Semestral 180d",
    priceLabel: "$120.000 COP",
    durationLabel: "180 días continuos",
    summary:
      "Para gallinas ponedoras, codornices o granjas mixtas familiares. Opción anual disponible por $210.000 COP.",
    highlights: [
      "Hasta 4 lotes activos y 4 usuarios",
      "Clasificación NTC 1240 e inventario PEPS",
      "Plan sanitario ICA precargado desde Día 1",
    ],
  },
  {
    id: "MEDIANO_MENSUAL",
    badge: "Multi-galpón",
    name: "Escala Mediano",
    priceLabel: "$149.000 COP",
    durationLabel: "30 días · hasta 15 usuarios",
    summary:
      "Para granjas comerciales con varios galpones, cuadrillas con código QR, incubación y contabilidad analítica.",
    highlights: [
      "Lotes ilimitados y hasta 15 usuarios",
      "Prorrateo anti-subsidio cruzado y DIAN",
      "Auditoría de cierres diarios y roles",
    ],
  },
];

export function getAllLandingShowcaseAssetUrls(): string[] {
  const urls = new Set<string>();
  for (const tab of SHOWCASE_TABS) {
    urls.add(tab.screenshot);
    if (tab.secondaryScreenshot) {
      urls.add(tab.secondaryScreenshot);
    }
  }
  for (const item of SHOWCASE_GALLERY) {
    urls.add(item.image);
  }
  return Array.from(urls);
}
