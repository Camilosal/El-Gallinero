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

export type StandardDiagramType =
  | "egg-peps"
  | "biosecurity"
  | "welfare"
  | "withdrawal"
  | "compost"
  | "finance";

export interface SectorStandardItem {
  code: string;
  authority: string;
  title: string;
  summary: string;
  enforcement: string;
  tags: string[];
  sourceLabel: string;
  sourceUrl: string;
  diagramType: StandardDiagramType;
  diagramSteps: [string, string, string];
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

export interface LandingModuleItem {
  id: "inicio" | "huevos" | "animales" | "alimento" | "sanidad" | "finanzas";
  name: string;
  summary: string;
}

/** Los 6 módulos esenciales. Cada resumen debe caber en una línea de máximo 10 palabras. */
export const LANDING_MODULES: LandingModuleItem[] = [
  {
    id: "inicio",
    name: "Inicio y tareas",
    summary: "Alertas, cifras del día y tareas que se validan solas.",
  },
  {
    id: "huevos",
    name: "Huevos e incubación",
    summary: "Clasificación NTC 1240, salida PEPS y control de nacedoras.",
  },
  {
    id: "animales",
    name: "Aves y mamíferos",
    summary: "Ponedoras, engorde, codornices, patos, conejos y cuyes.",
  },
  {
    id: "alimento",
    name: "Alimento y bodega",
    summary: "Bultos de 40 kg, días restantes e insumos.",
  },
  {
    id: "sanidad",
    name: "Sanidad y bioseguridad",
    summary: "Vacunas, accesos y bloqueo por tiempo de retiro.",
  },
  {
    id: "finanzas",
    name: "Ventas y finanzas",
    summary: "Ventas por especie, punto de equilibrio y reportes.",
  },
];

export interface ExtraLandingModuleItem {
  id: string;
  name: string;
  summary: string;
  guideHash: string;
}

/** 8 frentes operativos adicionales que completan el recorrido por los 8 módulos reales y 2 guías base de la plataforma. */
export const EXTRA_LANDING_MODULES: ExtraLandingModuleItem[] = [
  {
    id: "qr",
    name: "Escáner QR y etiquetas",
    summary: "Escaneo en campo de galpones, jaulas, lotes y equipos.",
    guideHash: "/guia/escanear-qr",
  },
  {
    id: "lugares",
    name: "Lugares de manejo",
    summary: "Galpones, jaulas, potreros, ocupación y vacío sanitario.",
    guideHash: "/guia/lugares-manejo",
  },
  {
    id: "carne",
    name: "Producción de carne",
    summary: "Peso en pie, rendimiento en canal, sacrificio y lotes.",
    guideHash: "/guia#mod-produccion",
  },
  {
    id: "subproductos",
    name: "Compostaje y gallinaza",
    summary: "Control de pilas de 8 semanas, volteos y liberación.",
    guideHash: "/guia#mod-almacen",
  },
  {
    id: "planeacion",
    name: "Planeación y calendario",
    summary: "Rutinas automáticas, Plan de Parvada y reemplazos.",
    guideHash: "/guia#mod-planeacion",
  },
  {
    id: "analisis",
    name: "Análisis y curvas",
    summary: "KPIs (HAA, EPEF, ROI) y curvas ajustadas por altitud.",
    guideHash: "/guia#mod-analisis",
  },
  {
    id: "cierre",
    name: "Cierre diario y sensores",
    summary: "Acta auditable de fin de jornada y lectura ambiental.",
    guideHash: "/guia#mod-almacen",
  },
  {
    id: "configuracion",
    name: "Configuración y escala",
    summary: "Activación progresiva, catálogos y copia de respaldo.",
    guideHash: "/guia#mod-configuracion",
  },
];

export interface CyclePlanShowcase {
  id:
  | "FREEMIUM_SEMILLA"
  | "CICLO_60D"
  | "SEMESTRAL_PONEDORA"
  | "MEDIANO_MENSUAL";
  slug: string;
  updatedAt: string;
  badge: string;
  name: string;
  priceLabel: string;
  durationLabel: string;
  summary: string;
  highlights: string[];
  featured?: boolean;
  detailSummary: string;
  idealFor: string[];
  includedFeatures: string[];
  limits: {
    lotes: string;
    usuarios: string;
    especies: string;
    almacenamiento: string;
  };
  billingNote: string;
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
    routeLabel: "app.iwage.co/inicio",
    screenshot: "/images/guia/inicio-dashboard.webp",
    screenshotAlt:
      "Pantalla principal del tablero de IwaGranja con alertas del día, preparación de granja y estado de copia offline",
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
    routeLabel: "app.iwage.co/inicio · Registro rápido",
    screenshot: "/images/guia/captura-rapida-modal.webp",
    screenshotAlt:
      "Modal de Registro Rápido con pestañas de huevos, alimento, mortalidad, gasto y venta, y botones de incremento por cubeta",
    secondaryScreenshot: "/images/guia/escanear-qr.webp",
    secondaryLabel: "Escáner QR de corral",
    secondaryAlt:
      "Pantalla de Escáner QR mostrando acciones directas para Galpón Principal: recoger huevos, dar alimento, reportar baja y ver ficha",
    highlights: [
      "Botones grandes para sumar cubetas de 30 huevos o bultos de 40 kg bajo el sol.",
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
    routeLabel: "app.iwage.co · Gina",
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
    routeLabel: "app.iwage.co/produccion",
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
    routeLabel: "app.iwage.co/sanidad/control",
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
    routeLabel: "app.iwage.co/finanzas · Modo offline",
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
    routeLabel: "/produccion/adquisiciones",
    summary: "Historial de compras, nacimientos, procedencia y valor invertido.",
    image: "/images/guia/adquisiciones-genetica.webp",
    alt: "Pantalla de Adquisiciones y entradas de animales con historial, inversión total y detalle de linaje",
  },
  {
    id: "gal-ubicacion",
    title: "Ficha por corral o galpón",
    moduleTag: "Lugares",
    routeLabel: "/ubicaciones/[id]",
    summary: "Ocupación, producción, sanidad y mantenimientos por espacio.",
    image: "/images/guia/ubicacion-ficha.webp",
    alt: "Ficha de Criadora y Enfermería Sur con KPIs de ocupación, producción por especie y traslados",
  },
  {
    id: "gal-qr",
    title: "Escáner QR de campo",
    moduleTag: "Agilidad",
    routeLabel: "/escanear",
    summary: "Escanea la placa del lugar para recoger huevos o servir alimento en segundos.",
    image: "/images/guia/escanear-qr.webp",
    alt: "Escáner QR de Granja mostrando acciones rápidas para el Galpón Principal",
  },
  {
    id: "gal-peso",
    title: "Curvas de crecimiento",
    moduleTag: "Producción",
    routeLabel: "/produccion/peso",
    summary: "Compara el peso del lote frente a la meta esperada por semana.",
    image: "/images/guia/peso-biometria.webp",
    alt: "Curva de peso ISA Brown con banda de referencia combinada e indicadores semanales",
  },
  {
    id: "gal-ventas",
    title: "Ventas de toda la finca",
    moduleTag: "Finanzas",
    routeLabel: "/finanzas/ventas",
    summary: "Registra ventas de huevos, animales, carne, gallinaza y productos.",
    image: "/images/guia/finanzas-ventas.webp",
    alt: "Módulo de Ventas con pestañas de Huevos, Aves, Carne y Gallinaza e inventario disponible por calibre",
  },
  {
    id: "gal-kpis",
    title: "Indicadores del negocio",
    moduleTag: "Análisis",
    routeLabel: "/analisis/kpis",
    summary: "Porcentaje de postura, mortalidad, costos unitarios y reportes.",
    image: "/images/guia/analisis-kpis.webp",
    alt: "Tablero de Indicadores Clave KPIs con tasa de mortalidad y tasa de postura sobre población elegible",
  },
  {
    id: "gal-parvada",
    title: "Plan de parvada",
    moduleTag: "Planeación",
    routeLabel: "/produccion/plan-parvada",
    summary: "Seguimiento de aves aptas frente a la meta y programación de reemplazos.",
    image: "/images/guia/plan-parvada.webp",
    alt: "Plan de Parvada con cumplimiento del 117.9% y recomendaciones de reposición y sacrificio",
  },
  {
    id: "gal-trazabilidad",
    title: "Trazabilidad pública QR",
    moduleTag: "Confianza",
    routeLabel: "/lote/[id]",
    summary: "Página pública compartible para respaldar origen, edad y cuidado del lote.",
    image: "/images/guia/trazabilidad-lote-publica.webp",
    alt: "Ficha pública de Trazabilidad del Lote L-001 raza Cobb 500 lista para consulta vía QR",
  },
];

export const SECTOR_STANDARDS: SectorStandardItem[] = [
  {
    code: "NTC 1240",
    authority: "Calidad de huevo de gallina (voluntaria)",
    title: "Clasificación por tamaño y salida por orden de llegada",
    summary:
      "Referencia técnica voluntaria para huevo fresco de gallina (Jumbo a C); descarta rotos antes de bodega y despacha primero los lotes antiguos.",
    enforcement: "Convierte cubetas de 30 huevos con inventario PEPS.",
    tags: ["Huevo gallina", "PEPS"],
    sourceLabel: "ICONTEC · Tienda oficial (NTC 1240)",
    sourceUrl: "https://tienda.icontec.org/",
    diagramType: "egg-peps",
    diagramSteps: ["Recolección y descarte", "Clasifica Jumbo → C (30u)", "Salida PEPS obligatoria"],
  },
  {
    code: "ICA 3650–3652 · 12486",
    authority: "Bioseguridad avícola y RSPP",
    title: "Control de accesos, desinfección y separación por especie",
    summary:
      "Respalda protocolos GAB en avicultura (Res. 3650–3652) y registro de predios cunícolas/cuyícolas (Res. 12486/2023) con separación física entre especies.",
    enforcement: "Recuerda vacíos sanitarios y separa aves de mamíferos menores.",
    tags: ["Bioseguridad", "Vacío sanitario"],
    sourceLabel: "ICA · Resoluciones Sanitarias",
    sourceUrl: "https://www.ica.gov.co/normatividad/normas-ica/resoluciones",
    diagramType: "biosecurity",
    diagramSteps: ["Ingreso + arco sanitario", "Separación aves / mamíferos", "Vacío sanitario antes de repoblar"],
  },
  {
    code: "Res. MADR 205 · ICA 16409/8452",
    authority: "Bienestar animal",
    title: "Evaluación práctica de condiciones en granjas mixtas",
    summary:
      "Verifica agua, espacio, ventilación y cuidado animal (MADR 205/2022 en conejos/cuyes e ICA 16409/8452 en producción primaria).",
    enforcement: "Identifica brechas por especie para seguimiento interno.",
    tags: ["Granjas mixtas", "Bienestar"],
    sourceLabel: "MinAgricultura · Resoluciones",
    sourceUrl: "https://www.minagricultura.gov.co/Normatividad/Paginas/Resoluciones.aspx",
    diagramType: "welfare",
    diagramSteps: ["Agua, espacio y ventilación", "Puntaje POE por especie", "Alerta preventiva de brecha"],
  },
  {
    code: "PRAMSAC · INVIMA · GSMI",
    authority: "Inocuidad alimentaria",
    title: "Bloqueo preventivo durante tiempos de retiro",
    summary:
      "Cada tratamiento veterinario cargado calcula la fecha de liberación según los días de retiro configurados e impide registrar ventas de ese lote en la app mientras el retiro siga vigente.",
    enforcement: "Evita mezclar lotes en retiro con mercancía disponible para venta.",
    tags: ["Cero residuos", "Retiros"],
    sourceLabel: "INVIMA · Inocuidad Veterinaria",
    sourceUrl: "https://www.invima.gov.co/",
    diagramType: "withdrawal",
    diagramSteps: ["Registro de tratamiento", "Bloqueo de venta por días", "Liberación automática segura"],
  },
  {
    code: "AGROSAVIA · Antecedente ICA 30292",
    authority: "Aprovechamiento orgánico",
    title: "Compostaje controlado de mortalidad y gallinaza",
    summary:
      "Guía las mezclas técnicas AGROSAVIA (3:1:1 / 7:2:2), avisa volteos y valida temperatura y maduración antes de liberar el abono.",
    enforcement: "Controla tiempos de proceso de 8 semanas hasta obtener abono estabilizado.",
    tags: ["Compostaje", "Abono"],
    sourceLabel: "AGROSAVIA · Compostaje",
    sourceUrl: "https://www.agrosavia.co/",
    diagramType: "compost",
    diagramSteps: ["Mezcla C/N controlada", "Volteo y T° (8 semanas)", "Abono estabilizado y trazable"],
  },
  {
    code: "DIAN · Crédito agro",
    authority: "Gestión financiera",
    title: "Costos claros por especie y reportes exportables",
    summary:
      "Separa gastos directos y compartidos para ver el costo real por huevo o kilo y avisa si vendes por debajo de tu punto de equilibrio.",
    enforcement: "Exporta balances en Excel y PDF listos para contador o banco.",
    tags: ["Punto de equilibrio", "Excel y PDF"],
    sourceLabel: "DIAN · Normativa Contable",
    sourceUrl: "https://www.dian.gov.co/",
    diagramType: "finance",
    diagramSteps: ["Gasto directo + prorrateo", "Costo unitario por especie", "Alerta de margen + Excel/PDF"],
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

export interface AdoptionHighlightItem {
  id: "arranque-rapido" | "escala-gradual" | "campo-sin-senal" | "utilidad-ciclos";
  step: string;
  badge: string;
  title: string;
  description: string;
}

export const ADOPTION_HIGHLIGHTS: AdoptionHighlightItem[] = [
  {
    id: "arranque-rapido",
    step: "Paso 01",
    badge: "En 3 minutos",
    title: "Arranca hoy solo con tus animales vivos",
    description:
      "Sin cargar historiales viejos: indicas cuántos animales tienes hoy y la plataforma precarga el plan sanitario y la curva de tu raza.",
  },
  {
    id: "escala-gradual",
    step: "Paso 02",
    badge: "Pequeño o mediano",
    title: "Crece al ritmo de tu unidad productiva",
    description:
      "Inicias con los 4 registros diarios esenciales y desbloqueas incubación, cuadrillas con QR o costos por especie cuando tu granja lo pida.",
  },
  {
    id: "campo-sin-senal",
    step: "Paso 03",
    badge: "Modo sin señal",
    title: "Hecha para el sol, el galpón y la vereda",
    description:
      "Botones amplios de alto contraste y copia local cifrada en el teléfono que sincroniza sola al regresar la cobertura.",
  },
  {
    id: "utilidad-ciclos",
    step: "Paso 04",
    badge: "Cuentas al día",
    title: "Utilidad diaria y pagos solo por cosecha",
    description:
      "Recibes al instante el balance del día listo para WhatsApp y renuevas por ciclo productivo sin cobros automáticos.",
  },
];

export const CYCLE_PLANS_SHOWCASE: CyclePlanShowcase[] = [
  {
    id: "FREEMIUM_SEMILLA",
    slug: "semilla",
    updatedAt: "2026-11-14",
    badge: "Gratis siempre",
    name: "Semilla (1 lote)",
    priceLabel: "$0 COP",
    durationLabel: "30 días full + 1 lote libre",
    summary:
      "Un lote activo gratis para siempre, con lectura y cierre de lote sin costo.",
    highlights: [
      "1 lote activo gratis permanente",
      "Lectura y cierre/venta de lotes siempre libres",
      "Modo sin señal cifrado en el celular",
    ],
    detailSummary:
      "Arrancas con 30 días completos para probar toda la plataforma sin tarjeta y luego conservas 1 lote activo gratis de forma permanente.",
    idealFor: [
      "Productores familiares que están ordenando su primer galpón o corral.",
      "Granjas que quieren validar el registro offline antes de escalar.",
      "Proyectos escolares, huertas o unidades productivas de autoconsumo.",
    ],
    includedFeatures: [
      "Los 6 módulos esenciales desde el Día 1 (Inicio, Huevos, Animales, Alimento, Sanidad, Ventas).",
      "Registro rápido en menos de 2 minutos con modo offline en IndexedDB.",
      "Lectura histórica, exportación de reportes y cierre o venta de lotes siempre libres.",
      "Soporte para las 6 especies (ponedoras, engorde, codornices, patos, conejos y cuyes).",
    ],
    limits: {
      lotes: "1 lote activo gratis permanente (30 días iniciales ilimitados)",
      usuarios: "1 usuario administrador",
      especies: "6 especies disponibles",
      almacenamiento: "Copia local cifrada + respaldo en la nube",
    },
    billingNote:
      "Sin tarjeta de crédito ni cobros automáticos. Si decides abrir más lotes al terminar los 30 días, eliges el plan de tu preferencia.",
  },
  {
    id: "CICLO_60D",
    slug: "ciclo-60d",
    updatedAt: "2026-11-14",
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
    detailSummary:
      "Licencia pensada para ciclos cortos de carne o cría: pagas un único valor por 60 días de cosecha, sin suscripciones que cobren mientras el galpón está en vacío sanitario.",
    idealFor: [
      "Productores de pollo de engorde (Cobb 500 / Ross 308) por tandas de 42 a 55 días.",
      "Criadero de patos, conejos o cuyes con rotación bimestral.",
      "Equipos pequeños de hasta 3 personas en campo y administración.",
    ],
    includedFeatures: [
      "Todo lo de Semilla más hasta 3 lotes activos simultáneos y 3 operarios.",
      "Curvas de crecimiento ajustadas por altitud, pesajes semanales con CV% y EPEF.",
      "Control de bultos de 40 kg con alerta de días de cobertura restantes.",
      "Bloqueo automático por tiempo de retiro farmacológico antes de sacrificio o venta.",
    ],
    limits: {
      lotes: "Hasta 3 lotes activos simultáneos",
      usuarios: "Hasta 3 usuarios / operarios",
      especies: "Todas las especies de carne y postura",
      almacenamiento: "Historial completo conservado al finalizar el ciclo",
    },
    billingNote:
      "Pago único de $45.000 COP por Nequi, Daviplata o PSE. Al terminar los 60 días no hay débito automático; tus datos siguen visibles y listos para cerrar venta.",
  },
  {
    id: "SEMESTRAL_PONEDORA",
    slug: "semestral-ponedora",
    updatedAt: "2026-11-14",
    badge: "Postura y mixtas",
    name: "Semestral 180d",
    priceLabel: "$120.000 COP",
    durationLabel: "180 días continuos",
    summary:
      "Para gallinas ponedoras, codornices o granjas mixtas familiares. Opción anual disponible por $210.000 COP.",
    highlights: [
      "Hasta 3 usuarios",
      "Clasificación NTC 1240 e inventario PEPS",
      "Plan sanitario ICA precargado desde Día 1",
    ],
    detailSummary:
      "Cobertura continua de 6 meses (180 días) diseñada para lotes de postura de ciclo largo o granjas familiares mixtas que producen todos los días.",
    idealFor: [
      "Granjas de gallina ponedora comercial o semi-pastoreo.",
      "Productores de huevo de codorniz con despachos frecuentes.",
      "Granjas mixtas que combinan postura con un lote adicional de carne o abono.",
    ],
    includedFeatures: [
      "Clasificación automática de huevo NTC 1240 (Jumbo a C) en cubetas de 30 unidades.",
      "Inventario PEPS (Primeras en Entrar, Primeras en Salir) para evitar mermas.",
      "Calendario sanitario ICA precargado según edad de la parvada y altitud.",
      "Punto de equilibrio diario por huevo/cubeta y compostaje de gallinaza (8 semanas).",
    ],
    limits: {
      lotes: "Hasta 6 lotes activos (ideal para reemplazos escalonados)",
      usuarios: "Hasta 3 usuarios",
      especies: "Postura + granjas mixtas (6 especies)",
      almacenamiento: "Exportación Excel y PDF ilimitada",
    },
    billingNote:
      "Pago único semestral de $120.000 COP (también disponible anual por $210.000 COP). Sin permanencia ni renovaciones sorpresa.",
  },
  {
    id: "MEDIANO_MENSUAL",
    slug: "mediano-mensual",
    updatedAt: "2026-11-15",
    badge: "Multi-galpón",
    name: "Escala Mediano · cobro mensual",
    priceLabel: "$149.000 COP",
    durationLabel: "30 días · hasta 15 usuarios",
    summary:
      "Para granjas comerciales con varios galpones, cuadrillas con código QR, incubación y contabilidad analítica.",
    highlights: [
      "Lotes ilimitados y hasta 15 usuarios",
      "Prorrateo anti-subsidio cruzado y DIAN",
      "Auditoría de cierres diarios y roles",
    ],
    detailSummary:
      "Plan completo para granjas medianas y multi-galpón con cuadrillas en campo, incubación simultánea, roles diferenciados y contabilidad analítica sin subsidio cruzado.",
    idealFor: [
      "Granjas comerciales con 2 o más galpones, jaulas o estaciones con código QR.",
      "Operaciones con operarios de campo, supervisor veterinario y contador.",
      "Unidades con planta de incubación, compostaje y múltiples líneas de venta.",
    ],
    includedFeatures: [
      "Los 8 módulos reales completos (incluye Incubación, Escáner QR, Análisis de curvas y Auditoría).",
      "Contabilidad analítica con prorrateo configurable de costos indirectos compartidos.",
      "Control de roles, trazabilidad pública QR por lote y cierre diario auditable anti-fraude.",
      "Reportes exportables en Excel/PDF listos para contador, DIAN y crédito agropecuario.",
    ],
    limits: {
      lotes: "Lotes activos ilimitados",
      usuarios: "Hasta 15 usuarios con roles por estación",
      especies: "Multi-especie completo sin restricciones",
      almacenamiento: "Auditoría completa y respaldos automáticos",
    },
    billingNote:
      "Pago por período de 30 días ($149.000 COP) mediante Nequi, Daviplata o PSE. Puedes pausar o cambiar de escala sin perder ningún registro histórico.",
  },
];

export function getCyclePlanBySlug(slug: string): CyclePlanShowcase | undefined {
  return CYCLE_PLANS_SHOWCASE.find((plan) => plan.slug === slug);
}

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
