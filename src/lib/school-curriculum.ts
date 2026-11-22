import type { FarmPurposeKey } from "./onboarding";

/**
 * Contrato modular de la Escuela IwaGranja (Cap. XVII · Secciones 75, 76, 79 y 80).
 *
 * Distinción de producto (no negociable):
 * - `/guia` (`src/lib/guide-data.ts`): manual operativo sobre CÓMO USAR la app (pantallas y flujos del software).
 * - Escuela (`src/lib/school-curriculum.ts`): formación aplicada sobre CÓMO OPERAR una granja apoyándose en la app
 *   (manejo animal, nutrición, sanidad, economía rural, comercialización y sostenibilidad).
 *
 * Mientras el módulo dedicado de Escuela (`/escuela`) termina su construcción paralela, este contrato define
 * las 8 rutas curriculares, sus microlecciones con plantilla de 10 bloques y el conector seguro
 * `resolveSchoolLearningBridge`, que apunta a rutas reales activas sin exponer enlaces rotos.
 */

export const SCHOOL_MODULE_MOUNTED = false;
export const SCHOOL_BASE_ROUTE = "/escuela";

export type SchoolAccessLevel =
  | "L0_esencial"
  | "L1_capsula"
  | "L2_intro_gratis"
  | "L3_microleccion"
  | "L4_ruta"
  | "L5_cohorte";

export type SchoolCurriculumRouteId =
  | "manejo_bienestar"
  | "nutricion_bodega"
  | "sanidad_bioseguridad"
  | "produccion_calidad"
  | "gestion_economica"
  | "comercializacion_red"
  | "tecnologia_campo"
  | "sostenibilidad_mejora";

export type SchoolInsightFamily =
  | "huevos"
  | "alimentacion"
  | "mortalidad"
  | "venta"
  | "gasto"
  | "sanidad"
  | "reproduccion"
  | "incubacion";

export type SchoolNetworkCategory =
  | "proveedores"
  | "compradores"
  | "tecnicos"
  | "financiacion"
  | "formacion"
  | "programas";

export interface SchoolMicroLesson {
  id: string;
  routeId: SchoolCurriculumRouteId;
  title: string;
  level: SchoolAccessLevel;
  durationMinutes: number;
  purposes: readonly FarmPurposeKey[];
  species: readonly string[];
  /** Bloque 1: Pregunta de campo real que resuelve la lección. */
  block1FieldQuestion: string;
  /** Bloque 2: Beneficio operativo de aplicar la práctica. */
  block2LearningBenefit: string;
  /** Bloque 3: Explicación práctica en lenguaje sencillo de granja. */
  block3PlainExplanation: string;
  /** Bloque 4: Ejemplo concreto por especie y etapa. */
  block4SpeciesStageExample: string;
  /** Bloque 5: 2-4 comprobaciones observables en campo (no diagnósticos clínicos). */
  block5Checklist: readonly string[];
  /** Bloque 6: Práctica "Hazlo en tu granja" sin formulario paralelo. */
  block6PracticeTask: string;
  /** Bloque 7: Módulo existente de IwaGranja donde queda registrada la acción. */
  block7PracticeModuleHref: string;
  /** Bloque 8: Familia de MicroInsightCard que da seguimiento al registro. */
  block8FollowUpInsightFamily: SchoolInsightFamily;
  /** Bloque 9: Categoría de apoyo territorial futura (Mi Red). */
  block9NetworkCategory: SchoolNetworkCategory;
  /** Bloque 10: Trazabilidad editorial y puente con el manual de la app (`/guia`). */
  block10EditorialMeta: {
    version: string;
    sources: readonly string[];
    reviewedBy: string;
    lastReviewedAt: string;
    normCode?: string;
    appGuideSlug: string;
  };
}

export interface SchoolCurriculumRoute {
  id: SchoolCurriculumRouteId;
  title: string;
  objective: string;
  connectedModules: readonly string[];
  purposes: readonly FarmPurposeKey[];
  defaultLevel: SchoolAccessLevel;
  inauguralLessonId: string;
}

export const SCHOOL_CURRICULUM_ROUTES: readonly SchoolCurriculumRoute[] = [
  {
    id: "manejo_bienestar",
    title: "Manejo animal y bienestar",
    objective: "Evaluar espacio, agua, ventilación y comodidad de cada alojamiento para prevenir estrés y pérdidas.",
    connectedModules: ["/animales", "/ubicaciones", "/escanear"],
    purposes: ["hogar", "aprendizaje", "reproduccion"],
    defaultLevel: "L2_intro_gratis",
    inauguralLessonId: "esc-manejo-espacio-v1",
  },
  {
    id: "nutricion_bodega",
    title: "Nutrición y bodega",
    objective: "Reducir desperdicio en comederos, conservar el concentrado/forraje y calcular cobertura real de bodega.",
    connectedModules: ["/produccion?tab=alimentacion", "/inventarios/alimentacion"],
    purposes: ["hogar", "ingresos", "sostenibilidad"],
    defaultLevel: "L2_intro_gratis",
    inauguralLessonId: "esc-nutricion-comederos-v1",
  },
  {
    id: "sanidad_bioseguridad",
    title: "Sanidad y bioseguridad",
    objective: "Reconocer señales tempranas de alerta, respetar tiempos de retiro y documentar bioseguridad sin improvisar.",
    connectedModules: ["/sanidad/bioseguridad", "/sanidad/alertas", "/produccion/mortalidad"],
    purposes: ["hogar", "ingresos", "aprendizaje", "proyecto"],
    defaultLevel: "L0_esencial",
    inauguralLessonId: "esc-sanidad-observacion-v1",
  },
  {
    id: "produccion_calidad",
    title: "Producción y calidad",
    objective: "Interpretar variación de postura NTC 1240 o ganancia de peso contra la curva calibrada de la propia finca.",
    connectedModules: ["/produccion?tab=huevos", "/produccion/peso", "/analisis/razas"],
    purposes: ["hogar", "ingresos", "reproduccion"],
    defaultLevel: "L3_microleccion",
    inauguralLessonId: "esc-produccion-lectura-v1",
  },
  {
    id: "gestion_economica",
    title: "Gestión económica",
    objective: "Distinguir flujo de caja, costo directo por lote, margen parcial y rentabilidad neta real.",
    connectedModules: ["/finanzas", "/finanzas/egresos", "/analisis/reportes"],
    purposes: ["ingresos", "aprendizaje", "proyecto"],
    defaultLevel: "L3_microleccion",
    inauguralLessonId: "esc-economia-margen-v1",
  },
  {
    id: "comercializacion_red",
    title: "Comercialización y red",
    objective: "Fijar precios con respaldo de costos reales, controlar entregas fiadas y preparar oferta comercial.",
    connectedModules: ["/finanzas/ventas", "/finanzas/cuentas", "/contactos"],
    purposes: ["ingresos", "proyecto"],
    defaultLevel: "L3_microleccion",
    inauguralLessonId: "esc-comercio-oferta-v1",
  },
  {
    id: "tecnologia_campo",
    title: "Tecnología de campo",
    objective: "Operar sin señal con PWA preparada, leer códigos QR/IwaTags en ronda de campo y verificar sincronización.",
    connectedModules: ["/escanear", "/configuracion/kit-campo", "/inicio"],
    purposes: ["aprendizaje", "proyecto"],
    defaultLevel: "L2_intro_gratis",
    inauguralLessonId: "esc-tech-offline-qr-v1",
  },
  {
    id: "sostenibilidad_mejora",
    title: "Sostenibilidad y mejora",
    objective: "Convertir gallinaza y bajas en compostaje seguro, valorar el autoconsumo y detectar oportunidades en registros.",
    connectedModules: ["/operaciones/compostaje", "/soberania", "/analisis/kpis"],
    purposes: ["hogar", "sostenibilidad"],
    defaultLevel: "L2_intro_gratis",
    inauguralLessonId: "esc-sostenibilidad-mermas-v1",
  },
] as const;

export const SCHOOL_MICROLESSONS: readonly SchoolMicroLesson[] = [
  {
    id: "esc-manejo-espacio-v1",
    routeId: "manejo_bienestar",
    title: "Cómo revisar el espacio y bienestar donde viven mis animales",
    level: "L2_intro_gratis",
    durationMinutes: 4,
    purposes: ["hogar", "aprendizaje", "reproduccion"],
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    block1FieldQuestion: "¿Están cómodos mis animales con el espacio, agua y aire que tienen hoy?",
    block2LearningBenefit: "Detectar hacinamiento o bebederos mal regulados previene picaje, caídas de postura y enfermedades.",
    block3PlainExplanation:
      "Un animal con agua fresca a la altura correcta y suficiente espacio por metro cuadrado aprovecha mejor el alimento y enferma mucho menos.",
    block4SpeciesStageExample:
      "En gallinas ponedoras en piso verifica densidad recomendada y altura de bebederos al nivel del dorso; en cuyes o conejos revisa cama seca, ventilación sin corrientes directas y acceso constante a agua.",
    block5Checklist: [
      "Agua limpia y bebederos al alcance de todos los animales sin charcos en la cama.",
      "Sin olor fuerte a amoníaco ni animales amontonados en una esquina por frío o calor.",
      "Espacio suficiente para comer al mismo tiempo sin peleas ni picaje.",
    ],
    block6PracticeTask: "Haz una ronda por el galpón o corral principal, verifica altura de agua/cama y actualiza capacidad o estado.",
    block7PracticeModuleHref: "/ubicaciones",
    block8FollowUpInsightFamily: "reproduccion",
    block9NetworkCategory: "tecnicos",
    block10EditorialMeta: {
      version: "1.0.0",
      sources: ["Manual Maestro Flujo Onbarding v2.3 §80", "Guías de bienestar ICA por especie"],
      reviewedBy: "Pendiente validación zootécnica final",
      lastReviewedAt: "2026-11-22",
      normCode: "Res. ICA 3651 / Bienestar Animal",
      appGuideSlug: "lugares-manejo",
    },
  },
  {
    id: "esc-nutricion-comederos-v1",
    routeId: "nutricion_bodega",
    title: "Cómo identificar desperdicio en comederos y cuidar la bodega",
    level: "L2_intro_gratis",
    durationMinutes: 5,
    purposes: ["hogar", "ingresos", "sostenibilidad"],
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    block1FieldQuestion: "¿El alimento está llegando realmente al animal o se pierde en la cama y la bodega?",
    block2LearningBenefit: "Bajar desperdicio en tolvas y planificar pedidos antes de quedar sin stock evita sobrecostos y cambios bruscos de dieta.",
    block3PlainExplanation:
      "Gran parte del costo diario está en la comida. Llenar comederos por encima de un tercio o apoyarlos sobre tarimas húmedas dispara pérdidas silenciosas.",
    block4SpeciesStageExample:
      "En aves de postura y engorde regula la tolva al nivel del dorso del ave; en conejos y cuyes orea el forraje verde antes de servir y balancea con concentrado sobre estiba limpia.",
    block5Checklist: [
      "Comederos regulados a la altura del dorso y llenos máximo hasta 1/3–1/2 de su plato.",
      "Bultos en bodega sobre estibas separados de pared y suelo, rotando primero lo más antiguo (PEPS).",
      "Sin presencia visible de roedores ni alimento regado en la cama alrededor de tolvas.",
    ],
    block6PracticeTask: "Pesa o mide una ración real hoy y registra la salida en bodega para verificar cuántos días de cobertura quedan.",
    block7PracticeModuleHref: "/inventarios/alimentacion",
    block8FollowUpInsightFamily: "alimentacion",
    block9NetworkCategory: "proveedores",
    block10EditorialMeta: {
      version: "1.0.0",
      sources: ["Manual Maestro Flujo Onbarding v2.3 §80", "Protocolo de manejo de bodega agropecuaria"],
      reviewedBy: "Pendiente validación nutricional",
      lastReviewedAt: "2026-11-22",
      appGuideSlug: "alimentar-aves",
    },
  },
  {
    id: "esc-sanidad-observacion-v1",
    routeId: "sanidad_bioseguridad",
    title: "Qué observar ante cambios y cómo documentar bioseguridad",
    level: "L0_esencial",
    durationMinutes: 4,
    purposes: ["hogar", "ingresos", "aprendizaje", "proyecto"],
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    block1FieldQuestion: "¿Qué señales tempranas debo anotar y cuándo detener venta/consumo por tiempo de retiro?",
    block2LearningBenefit: "Anotar causas observables y tiempos de carencia protege la salud de tu familia, compradores y evita sanciones.",
    block3PlainExplanation:
      "Observar cambios en consumo de agua, respiración o heces permite actuar temprano. Todo medicamento o antiparasitario exige respetar sus días de retiro antes de consumir o vender huevo o carne.",
    block4SpeciesStageExample:
      "Si aplicas un tratamiento con 7 días de retiro a un galpón de gallinas o lote de engorde, marca la fecha de liberación en Sanidad y separa o descarta productos durante la ventana activa.",
    block5Checklist: [
      "Pediluvio o desinfección en entrada limpia y registro de ingreso de personas ajenas al corral.",
      "Revisión visual de plumaje/pelaje, secreciones, diarreas y consumo anormal de agua.",
      "Fecha límite de retiro sanitario verificada antes de despachar huevos, leche o carne.",
    ],
    block6PracticeTask: "Verifica las alertas activas y completa la lista de chequeo sanitaria del módulo vigente (sin sustituir concepto veterinario).",
    block7PracticeModuleHref: "/sanidad/bioseguridad",
    block8FollowUpInsightFamily: "sanidad",
    block9NetworkCategory: "tecnicos",
    block10EditorialMeta: {
      version: "1.0.0",
      sources: ["Manual Maestro Flujo Onbarding v2.3 §80", "Resoluciones ICA 3650–3652"],
      reviewedBy: "Pendiente validación veterinaria",
      lastReviewedAt: "2026-11-22",
      normCode: "ICA 3650 / Retiros",
      appGuideSlug: "bioseguridad-bienestar",
    },
  },
  {
    id: "esc-produccion-lectura-v1",
    routeId: "produccion_calidad",
    title: "Cómo leer un resultado de postura o crecimiento sin sesgos",
    level: "L3_microleccion",
    durationMinutes: 5,
    purposes: ["hogar", "ingresos", "reproduccion"],
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    block1FieldQuestion: "¿Mi lote está rindiendo según su edad, su clima y el destino real de lo que produce?",
    block2LearningBenefit: "Separar huevos/kilos rotos, reservados al hogar y disponibles para venta evita decisiones equivocadas por conteo incompleto.",
    block3PlainExplanation:
      "Un descenso en la recolección puede deberse a menor número real de aves tras bajas no descontadas, calor extremo (ITH) o rotura dentro del nidal. Compara siempre contra aves activas reales y tu curva calibrada.",
    block4SpeciesStageExample:
      "En ponedoras clasifica por peso según NTC 1240 y registra cuánto va al hogar vs. venta; en pollo o cuy pesa una muestra semanal en la misma hora del día para vigilar uniformidad (CV%).",
    block5Checklist: [
      "Aves o ejemplares activos al día antes de calcular porcentaje de postura o consumo por animal.",
      "Separación clara entre merma (rotos/descarte), destino al hogar y saldo comercializable.",
      "Comparación frente a la curva autocalibrada de tu propia finca en Análisis → Curvas.",
    ],
    block6PracticeTask: "Registra hoy una recolección o muestra de peso y compara el resultado contra la curva autocalibrada en Análisis.",
    block7PracticeModuleHref: "/analisis/razas",
    block8FollowUpInsightFamily: "huevos",
    block9NetworkCategory: "compradores",
    block10EditorialMeta: {
      version: "1.0.0",
      sources: ["Manual Maestro Flujo Onbarding v2.3 §80", "Norma Técnica NTC 1240"],
      reviewedBy: "Pendiente validación zootécnica final",
      lastReviewedAt: "2026-11-22",
      normCode: "NTC 1240",
      appGuideSlug: "recoger-huevos",
    },
  },
  {
    id: "esc-economia-margen-v1",
    routeId: "gestion_economica",
    title: "Ingreso, costo directo y margen: qué sabemos y qué falta",
    level: "L3_microleccion",
    durationMinutes: 6,
    purposes: ["ingresos", "aprendizaje", "proyecto"],
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    block1FieldQuestion: "¿El dinero que entró hoy por ventas es ganancia neta o solo recuperación de caja?",
    block2LearningBenefit: "Separar inversión de equipos, compra de inventario en bodega y costo consumido evita gastar capital de trabajo pensando que es utilidad.",
    block3PlainExplanation:
      "Comprar bultos de concentrado o comederos reduce la plata en efectivo hoy, pero su costo entra al resultado solo cuando se consume o amortiza. Tampoco confundas ingreso bruto ni ahorro estimado con ganancia neta.",
    block4SpeciesStageExample:
      "Si vendes 3 cubetas hoy y solo descontaste el concentrado del día, obtienes un margen parcial estimado; para conocer utilidad real debes sumar sanidad, empaque, mano de obra y servicios del lote.",
    block5Checklist: [
      "Egresos clasificados por especie/lote (directos) o marcados para reparto (indirectos).",
      "Compras de bultos ingresadas a bodega y no cargadas completas como pérdida instantánea.",
      "Revisión de qué costos faltan cuando la tarjeta muestre 'margen parcial estimado'.",
    ],
    block6PracticeTask: "Anota un egreso menor o gasto directo del día asignándole especie/lote y revisa el reporte analítico.",
    block7PracticeModuleHref: "/finanzas/egresos",
    block8FollowUpInsightFamily: "gasto",
    block9NetworkCategory: "financiacion",
    block10EditorialMeta: {
      version: "1.0.0",
      sources: ["Manual Maestro Flujo Onbarding v2.3 §65 y §80"],
      reviewedBy: "Pendiente validación financiero-contable",
      lastReviewedAt: "2026-11-22",
      normCode: "Costeo Analítico Agro",
      appGuideSlug: "balance-financiero",
    },
  },
  {
    id: "esc-comercio-oferta-v1",
    routeId: "comercializacion_red",
    title: "Cómo preparar una oferta clara y revisar canales antes de vender",
    level: "L3_microleccion",
    durationMinutes: 5,
    purposes: ["ingresos", "proyecto"],
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    block1FieldQuestion: "¿Con qué precio mínimo cubro mis costos y cómo controlo ventas fiadas o por calibre?",
    block2LearningBenefit: "Vender sobre costo real conocido y registrar fecha límite de cobro protege el capital de trabajo de la granja.",
    block3PlainExplanation:
      "Mezclar huevos grandes en cubeta genérica o entregar a crédito sin fecha límite es una de las fugas más frecuentes de margen. Define unidad, calibre/peso, condición de pago y compara tu precio con SIPSA.",
    block4SpeciesStageExample:
      "Antes de pactar entrega de huevos o aves en pie, revisa el inventario disponible real y la referencia de plaza local en Fuentes Externas; si fías, registra fecha de vencimiento en Cuentas por Cobrar.",
    block5Checklist: [
      "Cantidad disponible confirmada en inventario (sin incluir huevos rotos ni reservados al hogar).",
      "Precio unitario contrastado contra costo estimado y referencia SIPSA de la región.",
      "Si es crédito, comprador vinculado con fecha límite en Cuentas por Cobrar.",
    ],
    block6PracticeTask: "Registra una venta real (contado o crédito) con comprador y verifica el resumen del módulo de ventas.",
    block7PracticeModuleHref: "/finanzas/ventas",
    block8FollowUpInsightFamily: "venta",
    block9NetworkCategory: "compradores",
    block10EditorialMeta: {
      version: "1.0.0",
      sources: ["Manual Maestro Flujo Onbarding v2.3 §80 y §82.3"],
      reviewedBy: "Pendiente validación comercial",
      lastReviewedAt: "2026-11-22",
      appGuideSlug: "registrar-venta",
    },
  },
  {
    id: "esc-tech-offline-qr-v1",
    routeId: "tecnologia_campo",
    title: "Trabajar sin señal, usar placas QR/IwaTags y revisar pendientes",
    level: "L2_intro_gratis",
    durationMinutes: 3,
    purposes: ["aprendizaje", "proyecto"],
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    block1FieldQuestion: "¿Cómo aseguro que mis registros en campo sin internet queden guardados y no se pierdan?",
    block2LearningBenefit: "Preparar la copia offline antes de salir al galpón y distinguir 'guardado local' de 'sincronizado' evita pérdidas y duplicados.",
    block3PlainExplanation:
      "Un dato anotado en modo avión se guarda en el teléfono, no todavía en el servidor. Mantén la sesión activa, verifica el botón de copia offline en la barra superior y escanea placas QR dentro de la app.",
    block4SpeciesStageExample:
      "En zonas sin cobertura en la tarde, abre la PWA instalada, escanea la placa de la puerta del galpón con Escáner QR para preseleccionar ubicación/lote y sincroniza al volver a señal.",
    block5Checklist: [
      "Copia offline descargada mientras tenías señal antes de entrar al galpón.",
      "Indicador de pendientes revisado al regresar a cobertura hasta confirmar envío.",
      "No cerrar sesión ni borrar caché del navegador mientras existan registros pendientes.",
    ],
    block6PracticeTask: "Abre el Escáner QR de campo o revisa el estado de sincronización en la barra superior.",
    block7PracticeModuleHref: "/escanear",
    block8FollowUpInsightFamily: "incubacion",
    block9NetworkCategory: "formacion",
    block10EditorialMeta: {
      version: "1.0.0",
      sources: ["Manual Maestro Flujo Onbarding v2.3 Cap. XII y XVIII"],
      reviewedBy: "Equipo Ingeniería & Campo Iwagé",
      lastReviewedAt: "2026-11-22",
      appGuideSlug: "modo-offline-voz",
    },
  },
  {
    id: "esc-sostenibilidad-mermas-v1",
    routeId: "sostenibilidad_mejora",
    title: "Aprovechar gallinaza, compostaje y consumo familiar con registros",
    level: "L2_intro_gratis",
    durationMinutes: 4,
    purposes: ["hogar", "sostenibilidad"],
    species: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    block1FieldQuestion: "¿Qué valor dejan los residuos estabilizados y los productos destinados al hogar?",
    block2LearningBenefit: "Compostar adecuadamente corta olores/moscas y documentar el destino al hogar hace visible cuánto aporta el predio.",
    block3PlainExplanation:
      "La gallinaza fresca quema cultivos y dispersa patógenos, pero estabilizada térmicamente a 55–65 °C se convierte en abono aprovechable o vendible. Igual ocurre al registrar por separado lo que consume la familia.",
    block4SpeciesStageExample:
      "Si destinas 12 huevos al hogar y compostas mortalidad o cama en pila 7:2:2, regístralo en Soberanía y Compostaje sin sumarlo como venta de efectivo.",
    block5Checklist: [
      "Pila de compostaje aireada y volteada según banda térmica (55–65 °C).",
      "Mortalidades retiradas en la primera ronda hacia compostera cerrada, nunca a cielo abierto.",
      "Registro separado del autoconsumo familiar en Soberanía sin mezclarlo con ventas.",
    ],
    block6PracticeTask: "Registra un lote/evento de compostaje o el destino de autoconsumo real de hoy en Soberanía.",
    block7PracticeModuleHref: "/operaciones/compostaje",
    block8FollowUpInsightFamily: "mortalidad",
    block9NetworkCategory: "programas",
    block10EditorialMeta: {
      version: "1.0.0",
      sources: ["Manual Maestro Flujo Onbarding v2.3 §80 y §112", "Protocolo POE compostaje térmico"],
      reviewedBy: "Pendiente validación ambiental/zootécnica",
      lastReviewedAt: "2026-11-22",
      appGuideSlug: "compostaje",
    },
  },
] as const;

const FAMILY_TO_ROUTE: Record<SchoolInsightFamily, SchoolCurriculumRouteId> = {
  huevos: "produccion_calidad",
  alimentacion: "nutricion_bodega",
  mortalidad: "sanidad_bioseguridad",
  sanidad: "sanidad_bioseguridad",
  venta: "comercializacion_red",
  gasto: "gestion_economica",
  reproduccion: "manejo_bienestar",
  incubacion: "tecnologia_campo",
};

const PURPOSE_TO_ROUTE: Record<FarmPurposeKey, SchoolCurriculumRouteId> = {
  hogar: "sostenibilidad_mejora",
  ingresos: "gestion_economica",
  aprendizaje: "manejo_bienestar",
  reproduccion: "manejo_bienestar",
  sostenibilidad: "nutricion_bodega",
  proyecto: "tecnologia_campo",
};

export interface SchoolLearningBridgeResult {
  route: SchoolCurriculumRoute;
  lesson: SchoolMicroLesson;
  isSchoolModuleMounted: boolean;
  /** URL segura hoy: apunta a `/escuela/...` solo cuando SCHOOL_MODULE_MOUNTED === true; de lo contrario cae en `/analisis/normas` o `/guia/[slug]`. */
  targetHref: string;
  fallbackAppGuideHref: string;
  normHref: string;
  practiceHref: string;
  reasonCode: "evento_operativo" | "objetivo_declarado" | "especie_etapa";
}

export function resolveSchoolLearningBridge(params: {
  insightFamily?: SchoolInsightFamily | string | null;
  purpose?: FarmPurposeKey | null;
  species?: string | null;
  routeId?: SchoolCurriculumRouteId | null;
}): SchoolLearningBridgeResult {
  let resolvedRouteId: SchoolCurriculumRouteId = "manejo_bienestar";
  let reasonCode: SchoolLearningBridgeResult["reasonCode"] = "evento_operativo";

  if (params.routeId && SCHOOL_CURRICULUM_ROUTES.some((r) => r.id === params.routeId)) {
    resolvedRouteId = params.routeId;
  } else if (params.insightFamily && params.insightFamily in FAMILY_TO_ROUTE) {
    resolvedRouteId = FAMILY_TO_ROUTE[params.insightFamily as SchoolInsightFamily];
    reasonCode = "evento_operativo";
  } else if (params.purpose && params.purpose in PURPOSE_TO_ROUTE) {
    resolvedRouteId = PURPOSE_TO_ROUTE[params.purpose];
    reasonCode = "objetivo_declarado";
  }

  // En perfiles únicamente de autoconsumo ("hogar") tras postura, priorizar lectura/sostenibilidad si aplica
  if (
    params.purpose === "hogar" &&
    params.insightFamily === "mortalidad"
  ) {
    resolvedRouteId = "sanidad_bioseguridad";
  }

  const route =
    SCHOOL_CURRICULUM_ROUTES.find((r) => r.id === resolvedRouteId) ??
    SCHOOL_CURRICULUM_ROUTES[0];

  const lesson =
    SCHOOL_MICROLESSONS.find((l) => l.id === route.inauguralLessonId) ??
    SCHOOL_MICROLESSONS[0];

  const fallbackAppGuideHref = `/guia/${lesson.block10EditorialMeta.appGuideSlug}`;
  const normHref = "/analisis/normas";
  const practiceHref = lesson.block7PracticeModuleHref;

  const targetHref = SCHOOL_MODULE_MOUNTED
    ? `${SCHOOL_BASE_ROUTE}/${route.id}/${lesson.id}`
    : lesson.block10EditorialMeta.normCode
      ? normHref
      : fallbackAppGuideHref;

  return {
    route,
    lesson,
    isSchoolModuleMounted: SCHOOL_MODULE_MOUNTED,
    targetHref,
    fallbackAppGuideHref,
    normHref,
    practiceHref,
    reasonCode,
  };
}
