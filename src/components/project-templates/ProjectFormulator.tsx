"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  Info,
  Paperclip,
  Plus,
  Printer,
  Sprout,
  Target,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { Button, Card, Input, PageHeader, Select, Textarea } from "@/components/ui";

const STEPS = [
  "Propósito",
  "Oportunidad",
  "Contexto y población",
  "Intervención",
  "Plan y medición",
  "Revisar y exportar",
] as const;

const ORGANIZATION_TYPES = [
  "ONG / organización no gubernamental",
  "Fundación",
  "Asociación de productores",
  "Cooperativa",
  "Organización comunitaria o de base",
  "Agencia de cooperación",
  "Empresa privada · responsabilidad social",
  "Institución educativa o centro de investigación",
  "Organismo multilateral",
  "Alianza o consorcio",
  "Entidad pública",
  "Otro tipo de organización",
];

const POPULATION_GROUPS = [
  { id: "rural-smallholders", title: "Hogares rurales con pequeña producción animal", detail: "Unidades familiares de pequeña escala que crían aves, conejos, cuyes u otros animales menores." },
  { id: "women-rural", title: "Mujeres rurales y hogares liderados por mujeres", detail: "Definir criterios respetando la autoidentificación y las prioridades de cada territorio." },
  { id: "youth-rural", title: "Jóvenes rurales", detail: "Precisar rangos de edad según la convocatoria y la normativa aplicable." },
  { id: "campesino", title: "Familias campesinas y economía campesina", detail: "Ajustar a las definiciones y formas organizativas reconocidas localmente." },
  { id: "ethnic", title: "Pueblos indígenas y comunidades étnicas", detail: "Incluir pertinencia cultural, consulta y acuerdos comunitarios cuando corresponda." },
  { id: "afro", title: "Comunidades negras, afrocolombianas, raizales y palenqueras", detail: "Usar las categorías pertinentes definidas por el proyecto y el territorio." },
  { id: "victims", title: "Hogares víctimas del conflicto o en desplazamiento", detail: "Aplicar las definiciones y mecanismos de acreditación que establezca la convocatoria." },
  { id: "older-adults", title: "Personas mayores rurales", detail: "Considerar autonomía, cuidados, accesibilidad y participación." },
  { id: "disability", title: "Personas con discapacidad y sus hogares", detail: "Prever ajustes razonables y accesibilidad en las actividades." },
  { id: "food-insecure", title: "Hogares con inseguridad alimentaria o ingresos limitados", detail: "Precisar cómo se identificará la brecha y qué instrumento utilizará el proyecto." },
  { id: "associations", title: "Pequeños productores vinculados a asociaciones", detail: "Útil cuando la intervención se organiza mediante grupos o redes locales." },
];

const PRIORITY_CRITERIA = [
  { id: "food-gap", title: "Brecha de acceso o disponibilidad de alimentos", detail: "Prioriza hogares con barreras verificables para acceder a alimentos suficientes y diversos." },
  { id: "rural-location", title: "Ruralidad, dispersión o distancia a servicios", detail: "Considera costos de transporte, aislamiento y acceso a servicios de apoyo." },
  { id: "low-income", title: "Ingresos limitados o pobreza multidimensional", detail: "Definir fuente de información, umbral y forma de verificación." },
  { id: "woman-led", title: "Jefatura femenina o brechas de género", detail: "Evitar asignar responsabilidades adicionales sin reconocer tiempos y cuidados." },
  { id: "youth", title: "Participación de jóvenes", detail: "Precisar rangos de edad y mecanismos de participación pertinentes." },
  { id: "ethnic-self-id", title: "Pertenencia étnica y pertinencia cultural", detail: "Acordar el enfoque con autoridades y organizaciones del territorio." },
  { id: "conflict", title: "Afectación por conflicto o desplazamiento", detail: "Aplicar criterios oficiales y proteger la información sensible." },
  { id: "disability-access", title: "Discapacidad, dependencia o barreras de cuidado", detail: "Prever accesibilidad y ajustes razonables desde el diseño." },
  { id: "production-potential", title: "Condiciones para sostener la actividad productiva", detail: "Valorar agua, espacio, tiempo, infraestructura y acceso a asistencia técnica." },
  { id: "digital-access", title: "Acceso y apropiación de tecnologías", detail: "Identifica conectividad, disponibilidad de dispositivos y apoyos requeridos; no excluye a quien necesite alternativas." },
  { id: "existing-support", title: "Complementariedad con otros programas", detail: "Coordinar apoyos y evitar duplicidades sin excluir hogares por recibir servicios básicos." },
  { id: "community-priority", title: "Priorización acordada con la comunidad", detail: "Documentar mecanismo, actores participantes y reglas de selección." },
];

const FOOD_GAPS = [
  { id: "irregular-access", title: "Acceso irregular a alimentos de origen animal", detail: "La disponibilidad varía durante el mes o el año y depende de compras ocasionales." },
  { id: "high-food-cost", title: "Alto costo de alimentos nutritivos", detail: "El costo o la distancia limita el acceso estable a alimentos diversos." },
  { id: "low-self-consumption", title: "Bajo aporte de la producción propia al hogar", detail: "Parte de la producción no llega al autoconsumo o no se registra su destino." },
  { id: "seasonal-shortage", title: "Escasez estacional o interrupciones de producción", detail: "Clima, alimentación, sanidad u otros factores interrumpen la disponibilidad." },
  { id: "diet-diversity", title: "Baja diversidad de alimentos disponibles", detail: "La oferta de alimentos en el hogar es poco variada; debe medirse con un instrumento adecuado." },
  { id: "animal-health", title: "Pérdidas por barreras de sanidad y asistencia técnica", detail: "Dificultad para acceder oportunamente a prevención, diagnóstico o acompañamiento competente." },
  { id: "inputs", title: "Acceso limitado a insumos y recursos productivos", detail: "Restricciones de alimento, agua, infraestructura, transporte o capital de trabajo." },
  { id: "knowledge", title: "Brechas de conocimiento y prácticas de manejo", detail: "Necesidad de asistencia práctica en bienestar, bioseguridad, alimentación o registros." },
  { id: "care-time", title: "Carga de cuidado y falta de tiempo para sostener la producción", detail: "Las tareas productivas compiten con empleo, labores domésticas y responsabilidades de cuidado." },
  { id: "market-dependence", title: "Dependencia de compras o mercados poco accesibles", detail: "La distancia, los precios o la oferta local dificultan reponer alimentos e insumos." },
  { id: "weak-information", title: "Poca información para orientar decisiones del proyecto", detail: "Los equipos carecen de registros oportunos sobre producción, destino, costos o continuidad." },
  { id: "connectivity", title: "Barreras de conectividad y acceso a servicios", detail: "La señal, los dispositivos o la distancia dificultan el acompañamiento y el registro." },
];

type PurposeTemplateId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7";

const BENEFICIARY_PROFILES = [
  "Hogar que asegura parte de su alimentación",
  "Hogar que planifica la disponibilidad de alimentos",
  "Hogar que fortalece su autonomía alimentaria",
  "Hogar que vende excedentes cuando puede",
];

const ACTOR_ROLES = [
  "Integrante del hogar o unidad productiva",
  "Promotor o facilitador local",
  "Profesional de asistencia técnica",
];

const PROJECT_COMPONENTS = [
  { name: "Asistencia técnica productiva", icon: Sprout },
  { name: "Sanidad, bienestar y bioseguridad", icon: HeartPulse },
  { name: "Educación alimentaria y nutricional", icon: Utensils },
  { name: "Acceso a animales, alimento o insumos", icon: Users },
  { name: "Organización familiar o comunitaria", icon: Users },
  { name: "Gestión económica y costos de producción", icon: BarChart3 },
  { name: "Acceso a mercados y comercialización local", icon: Users },
  { name: "Planificación y coordinación productiva", icon: ClipboardList },
  { name: "Extensión rural y aprendizaje entre pares", icon: Sprout },
  { name: "Economía circular y aprovechamiento de subproductos", icon: Sprout },
  { name: "Calidad, poscosecha y logística", icon: ClipboardList },
  { name: "Gestión ambiental y uso eficiente de recursos", icon: Sprout },
];

const PROJECT_INDICATORS = [
  {
    id: "autoconsumo",
    title: "Producción destinada al autoconsumo",
    detail: "Cantidad registrada por hogar y periodo; informa disponibilidad, no consumo efectivo.",
  },
  {
    id: "seguridad",
    title: "Cambio en la situación alimentaria del hogar",
    detail: "El proyecto define el instrumento, la línea base y el periodo de comparación.",
  },
  {
    id: "diversidad",
    title: "Diversidad de alimentos consumidos",
    detail: "Requiere un método de medición adecuado y acompañamiento del equipo del proyecto.",
  },
  {
    id: "regularity",
    title: "Regularidad de disponibilidad de alimentos en el hogar",
    detail: "Medir por periodos y definir previamente qué alimentos y fuentes se incluirán.",
  },
  {
    id: "production-continuity",
    title: "Hogares que mantienen producción durante el periodo acordado",
    detail: "Definir qué significa continuidad para la especie, escala y ciclo productivo del proyecto.",
  },
  {
    id: "practice-adoption",
    title: "Adopción de prácticas productivas o sanitarias acordadas",
    detail: "Registrar las prácticas priorizadas y quién verifica su aplicación.",
  },
  {
    id: "household-decision",
    title: "Hogares que usan información para tomar decisiones productivas",
    detail: "Definir evidencia observable y método de seguimiento con los participantes.",
  },
];

const PLATFORM_INDICATORS = [
  { id: "active", title: "Hogares que realizan los registros acordados" },
  { id: "complete", title: "Completitud de los registros de producción y destino" },
  { id: "time", title: "Tiempo y esfuerzo requeridos para registrar" },
  { id: "followup", title: "Registros revisados por el equipo de acompañamiento" },
  { id: "support", title: "Solicitudes de apoyo atendidas en el periodo" },
];

const PHASE_ACTIVITY_CATALOG: Record<string, string[]> = {
  diagnosis: [
    "Caracterizar hogares, especies, escala productiva y prácticas actuales",
    "Identificar fuentes de alimentos y patrones estacionales de disponibilidad",
    "Aplicar línea base del proyecto con el instrumento acordado",
    "Revisar condiciones de agua, espacio, alimentación y alojamiento animal",
    "Identificar brechas sanitarias y necesidades de asistencia técnica",
    "Mapear organizaciones, servicios y programas existentes en el territorio",
    "Acordar participación, consentimiento y manejo de información",
    "Caracterizar fuentes de ingreso, ventas, costos y estacionalidad",
    "Identificar productos, compradores, precios y canales de comercialización",
    "Analizar costos unitarios, capacidad y viabilidad de la escala productiva",
    "Revisar registros sanitarios, eventos de enfermedad y rutas de atención",
    "Caracterizar cobertura, frecuencia y brechas de la asistencia técnica",
    "Mapear productores, organizaciones, volúmenes y demanda del mercado local",
    "Identificar flujos de insumos, residuos y posibilidades de aprovechamiento",
    "Levantar prácticas productivas actuales y necesidades de aprendizaje",
    "Identificar infraestructura y capacidad instalada por unidad productiva",
    "Revisar prácticas de manejo de agua, residuos y subproductos",
    "Identificar acuerdos colectivos, roles organizativos y necesidades de coordinación",
  ],
  readiness: [
    "Devolver hallazgos del diagnóstico y validar prioridades con los hogares",
    "Diseñar un plan productivo y alimentario por hogar o grupo",
    "Formar en bienestar animal, bioseguridad, alimentación y manejo",
    "Acordar roles, rutinas de cuidado y distribución del trabajo",
    "Preparar espacios, equipos y condiciones para recibir animales o insumos",
    "Capacitar al equipo y participantes en registros sencillos",
    "Acordar ruta de asistencia técnica y atención de alertas",
    "Elaborar un plan gradual de producción, costos y ventas por unidad productiva",
    "Acordar metas comerciales, calendario de oferta y reglas de coordinación",
    "Diseñar un calendario de visitas, demostraciones y seguimiento técnico",
    "Definir plan sanitario, medidas de bioseguridad y ruta de atención competente",
    "Capacitar en cálculo de costos, registros, precios y decisiones de reinversión",
    "Preparar acuerdos de calidad, empaque, acopio y logística de entrega",
    "Organizar prácticas de compostaje, uso de gallinaza y aprovechamiento de subproductos",
    "Acordar calendario de visitas y criterios de seguimiento de prácticas",
    "Definir metas de venta, responsables y reglas de distribución de beneficios",
    "Preparar equipos y registros para medir consumo de agua e insumos",
    "Acordar una ruta de respuesta ante eventos sanitarios y productivos",
  ],
  implementation: [
    "Realizar visitas de asistencia técnica y seguimiento productivo",
    "Implementar mejoras de alojamiento, agua, alimentación y bienestar",
    "Entregar o gestionar animales e insumos conforme al plan técnico",
    "Aplicar medidas preventivas y ruta de atención sanitaria competente",
    "Acompañar registros de producción, autoconsumo, ventas y pérdidas",
    "Desarrollar actividades de educación alimentaria acordadas",
    "Revisar periódicamente avances y ajustar los apoyos",
    "Acompañar registros de ventas, gastos e ingreso neto de la actividad",
    "Realizar seguimiento sanitario y activar la ruta de atención ante alertas",
    "Desarrollar visitas de extensión y verificar prácticas acordadas en campo",
    "Coordinar acopio, consolidación de oferta y entregas a compradores locales",
    "Implementar prácticas de aprovechamiento de residuos y uso eficiente de agua e insumos",
    "Revisar costos, precios y márgenes para ajustar el plan productivo",
    "Acompañar mejoras de calidad, poscosecha y cumplimiento de entregas",
    "Revisar con cada productor avances, barreras y ajustes de la práctica priorizada",
    "Consolidar datos autorizados de oferta, pedidos y entregas",
    "Monitorear consumo de agua e insumos en los periodos acordados",
    "Implementar mejoras de infraestructura y mantenimiento preventivo",
  ],
  followup: [
    "Revisar registros y necesidades de apoyo con cada hogar o grupo",
    "Realizar medición intermedia y comparar con la línea base",
    "Ajustar el plan productivo ante cambios, riesgos o interrupciones",
    "Sistematizar aprendizajes, costos, barreras y prácticas útiles",
    "Acordar responsables, recursos y servicios para dar continuidad",
    "Realizar medición final con el instrumento definido por el proyecto",
    "Socializar resultados y validar conclusiones con los participantes",
    "Comparar ingresos, costos y margen neto con la línea base del proyecto",
    "Revisar continuidad sanitaria, pérdidas y respuesta a eventos productivos",
    "Verificar adopción y sostenimiento de prácticas priorizadas",
    "Evaluar regularidad de ventas, acuerdos comerciales y cumplimiento de entregas",
    "Revisar volúmenes, participación y beneficios de la coordinación organizativa",
    "Medir aprovechamiento de subproductos y cambios en consumo de recursos",
    "Acordar servicios, capacidades y recursos que continúan después del proyecto",
    "Comparar cobertura y frecuencia de visitas con las necesidades identificadas",
    "Revisar costos logísticos, calidad y satisfacción de compradores y productores",
    "Acordar ajustes del plan para el siguiente ciclo productivo",
    "Verificar funcionamiento y mantenimiento de las mejoras instaladas",
    "Documentar prácticas seguras y aprendizajes para compartir con otras unidades",
  ],
  custom: [
    "Acordar actividad, participantes, responsable y evidencia esperada",
    "Realizar acompañamiento y documentar avances o barreras",
    "Revisar resultados y ajustar la actividad con los participantes",
  ],
};

const PHASE_RESOURCE_CATALOG: Record<string, string[]> = {
  diagnosis: [
    "Profesional de campo o facilitador/a local",
    "Asistencia técnica pecuaria competente",
    "Instrumento de línea base y materiales de registro",
    "Transporte y viáticos para visitas rurales",
    "Espacio comunitario para encuentros",
    "Tiempo de participación de hogares y organizaciones",
    "Instrumentos sencillos de costeo y análisis de ingresos",
    "Información de compradores, precios y mercados del territorio",
    "Asistencia técnica pecuaria y veterinaria competente",
    "Facilitación organizativa y logística de reuniones",
    "Herramientas para mapear recursos, residuos y prácticas ambientales",
    "Herramientas de caracterización de oferta y demanda local",
    "Datos de infraestructura, capacidad y uso de recursos productivos",
    "Materiales para registrar acuerdos y roles de organizaciones",
    "Acompañamiento ambiental para revisar flujos de subproductos",
    "Transporte para recorridos de diagnóstico y visitas a compradores",
  ],
  readiness: [
    "Profesional de asistencia técnica pecuaria",
    "Facilitador/a con experiencia comunitaria",
    "Material pedagógico y elementos de demostración",
    "Transporte, alimentación y logística de formación",
    "Mejoras de alojamiento, agua o bioseguridad",
    "Dispositivos, conectividad o alternativas de registro sin conexión",
    "Accesibilidad, traducción o interpretación según necesidad",
    "Materiales para formación en costos, precios y comercialización",
    "Demostraciones de prácticas sanitarias, bioseguridad y bienestar",
    "Herramientas de extensión y guías prácticas de campo",
    "Asesoría en organización, acuerdos comerciales y calidad",
    "Insumos y equipos para compostaje o aprovechamiento de subproductos",
    "Calendario de visitas y formatos de seguimiento técnico",
    "Facilitación para acuerdos de venta, roles y distribución de beneficios",
    "Instrumentos para medir agua, alimento y uso de insumos",
    "Asistencia sanitaria competente para definir rutas de respuesta",
    "Guías de mantenimiento de infraestructura y equipos",
  ],
  implementation: [
    "Asistencia técnica y visitas de seguimiento",
    "Animales e insumos definidos por el diseño técnico",
    "Alimento, agua y almacenamiento adecuado",
    "Infraestructura y equipos de manejo",
    "Insumos y servicios veterinarios por personal competente",
    "Transporte y logística de distribución",
    "Acceso a IwaGranja y acompañamiento de adopción digital",
    "Materiales de educación alimentaria",
    "Acompañamiento contable o productivo para analizar costos y márgenes",
    "Transporte, acopio y logística de entrega a mercados locales",
    "Servicios veterinarios e insumos definidos por profesional competente",
    "Promotores locales y materiales para extensión rural",
    "Equipos y materiales para clasificación, empaque o poscosecha",
    "Materiales e infraestructura para uso eficiente de agua e insumos",
    "Formatos de seguimiento de prácticas y registro de barreras",
    "Herramientas autorizadas para consolidar pedidos y entregas",
    "Asistencia para mantenimiento preventivo de infraestructura y equipos",
  ],
  followup: [
    "Equipo responsable de seguimiento y medición",
    "Instrumento de evaluación y materiales de registro",
    "Transporte y viáticos para visitas de cierre",
    "Espacio y logística para devolución de resultados",
    "Recursos para continuidad de asistencia técnica",
    "Acceso a IwaGranja y soporte acordado, si aplica",
    "Información de ventas, costos, precios y cumplimiento comercial",
    "Registros sanitarios y acompañamiento veterinario de seguimiento",
    "Herramienta de evaluación de prácticas y visitas de extensión",
    "Espacio de coordinación entre productores y compradores locales",
    "Instrumentos para revisar uso de recursos y aprovechamiento de residuos",
    "Registro de cobertura, frecuencia y acuerdos de asistencia técnica",
    "Información de costos logísticos, calidad y retroalimentación comercial",
    "Espacio de planificación del siguiente ciclo y seguimiento de acuerdos",
    "Recursos de mantenimiento de infraestructura y equipos",
    "Materiales para documentar prácticas y compartir aprendizajes",
    "Información consolidada de demanda, pedidos y cumplimiento de ventas",
    "Mediciones periódicas de agua, alimento y otros recursos priorizados",
  ],
  custom: [
    "Responsable técnico o facilitador/a",
    "Transporte y logística de campo",
    "Materiales, insumos o equipos requeridos por la actividad",
    "Tiempo de participantes y organización aliada",
  ],
};

const PROJECT_ASSUMPTIONS = [
  { id: "household-interest", title: "Los hogares consideran pertinente participar", detail: "Validar interés, tiempos disponibles y condiciones de participación antes de iniciar." },
  { id: "space-water", title: "Hay acceso suficiente a espacio, agua y condiciones de manejo", detail: "Cuando falten, el proyecto deberá prever adecuaciones o alternativas." },
  { id: "technical-support", title: "Existe asistencia técnica competente y oportuna", detail: "Confirmar disponibilidad, cobertura, frecuencia y ruta sanitaria local." },
  { id: "input-supply", title: "Los insumos necesarios estarán disponibles y serán asequibles", detail: "Revisar proveedores, transporte, estacionalidad y costos recurrentes." },
  { id: "care-distribution", title: "Las tareas de producción y cuidado pueden distribuirse de forma viable", detail: "Revisar cargas de trabajo y no asumir que el tiempo de cuidado está disponible." },
  { id: "market-food", title: "La oferta local permite complementar la producción del hogar", detail: "Validar acceso a mercados, alimentos e insumos en distintas épocas del año." },
  { id: "climate-risk", title: "Los riesgos climáticos y ambientales pueden gestionarse", detail: "Identificar amenazas, medidas de prevención y opciones de continuidad." },
  { id: "community-coordination", title: "Las organizaciones locales pueden coordinar los apoyos", detail: "Precisar acuerdos, roles y mecanismos de resolución de dificultades." },
  { id: "digital-fit", title: "Los registros digitales son viables con apoyo y alternativas", detail: "Comprobar conectividad, dispositivos, habilidades y opciones sin señal." },
  { id: "outcome-measurement", title: "El proyecto podrá medir los cambios con instrumentos adecuados", detail: "Asignar responsables, línea base, frecuencia, recursos y resguardo de datos." },
];

const CONTINUITY_ACTIONS = [
  "Acordar responsables locales para acompañar a los hogares después del cierre",
  "Definir una ruta de asistencia técnica y atención sanitaria posterior",
  "Formar promotores o referentes comunitarios para apoyar prácticas y registros",
  "Asegurar recursos para alimentación, mantenimiento e insumos recurrentes",
  "Planificar reposición gradual de animales y recuperación ante pérdidas",
  "Conectar a los hogares con servicios veterinarios, extensión rural y programas existentes",
  "Fortalecer acuerdos de compra, comercialización o intercambio local cuando aplique",
  "Mantener encuentros periódicos de seguimiento entre hogares y organización aliada",
  "Acordar cómo se conservarán, consultarán y usarán los registros productivos",
  "Definir soporte, acceso y responsables de IwaGranja si la herramienta continúa",
  "Incluir necesidades recurrentes en el presupuesto o plan operativo de la organización",
  "Establecer un mecanismo comunitario para revisar dificultades y ajustar prácticas",
  "Realizar una revisión de continuidad a los 3, 6 o 12 meses del cierre",
  "Documentar aprendizajes y compartirlos con organizaciones o redes territoriales",
];

const TIME_OPTIONS = [
  "1–2 semanas",
  "2–4 semanas",
  "1 mes",
  "1–2 meses",
  "2–3 meses",
  "3–6 meses",
  "6–12 meses",
  "Seguimiento mensual durante el proyecto",
  "Seguimiento trimestral durante el proyecto",
  "Duración definida por la convocatoria",
  "Personalizado",
];

type PlanPhase = { id: string; title: string; activities: string[]; customActivities: string[]; owner: string; timing: string; customTiming: string; resources: string[]; customResources: string[] };
type CatalogOption = { id: string; title: string; detail: string };
type OpportunityDocument = { id: string; file: File };
type PurposeTemplate = {
  id: PurposeTemplateId;
  title: string;
  objective: string;
  fit: string;
  define: string;
  measurementNote: string;
  breaches: CatalogOption[];
  selectedBreaches: string[];
  components: string[];
  indicators: CatalogOption[];
  selectedIndicators: string[];
  assumptions: CatalogOption[];
  selectedAssumptions: string[];
  phases: PlanPhase[];
  continuity: string[];
  continuityNotes: string;
  contribution: string;
};

const purposeOption = (id: string, title: string, detail: string): CatalogOption => ({ id, title, detail });
const seedPhase = (id: string, title: string, activities: string[], resources: string[], owner: string, timing: string): PlanPhase => ({
  id, title, activities, customActivities: [], owner, timing, customTiming: "", resources, customResources: [],
});

const PURPOSE_TEMPLATES: Record<PurposeTemplateId, PurposeTemplate> = {
  P1: {
    id: "P1",
    title: "Seguridad y autonomía alimentaria",
    objective: "Mejorar la disponibilidad de alimentos y el aporte del autoconsumo en los hogares.",
    fit: "Cuando el proyecto busca fortalecer alimentos disponibles para el hogar y contempla acciones para sostener la producción.",
    define: "Qué brecha alimentaria se abordará, cómo se observará y qué asistencia necesita cada población.",
    measurementNote: "La producción para el hogar aporta información sobre disponibilidad; no equivale por sí sola a consumo o nutrición.",
    breaches: FOOD_GAPS,
    selectedBreaches: ["irregular-access", "seasonal-shortage"],
    components: ["Asistencia técnica productiva", "Sanidad, bienestar y bioseguridad", "Educación alimentaria y nutricional"],
    indicators: PROJECT_INDICATORS,
    selectedIndicators: ["autoconsumo", "regularity"],
    assumptions: PROJECT_ASSUMPTIONS,
    selectedAssumptions: ["household-interest", "technical-support", "outcome-measurement"],
    phases: [
      seedPhase("diagnosis", "Preparación y diagnóstico", [PHASE_ACTIVITY_CATALOG.diagnosis[0], PHASE_ACTIVITY_CATALOG.diagnosis[2]], [PHASE_RESOURCE_CATALOG.diagnosis[0], PHASE_RESOURCE_CATALOG.diagnosis[2], PHASE_RESOURCE_CATALOG.diagnosis[3]], "Equipo formulador y facilitador/a local", "2–4 semanas"),
      seedPhase("readiness", "Alistamiento y formación", [PHASE_ACTIVITY_CATALOG.readiness[1], PHASE_ACTIVITY_CATALOG.readiness[5]], [PHASE_RESOURCE_CATALOG.readiness[0], PHASE_RESOURCE_CATALOG.readiness[2], PHASE_RESOURCE_CATALOG.readiness[5]], "Equipo técnico y organización aliada", "1–2 meses"),
      seedPhase("implementation", "Acompañamiento e implementación", [PHASE_ACTIVITY_CATALOG.implementation[0], PHASE_ACTIVITY_CATALOG.implementation[4]], [PHASE_RESOURCE_CATALOG.implementation[0], PHASE_RESOURCE_CATALOG.implementation[1], PHASE_RESOURCE_CATALOG.implementation[6]], "Equipo de asistencia técnica", "3–6 meses"),
      seedPhase("followup", "Medición y continuidad", [PHASE_ACTIVITY_CATALOG.followup[1], PHASE_ACTIVITY_CATALOG.followup[4]], [PHASE_RESOURCE_CATALOG.followup[0], PHASE_RESOURCE_CATALOG.followup[1], PHASE_RESOURCE_CATALOG.followup[4]], "Equipo del proyecto y organización local", "1–2 meses"),
    ],
    continuity: [CONTINUITY_ACTIONS[0], CONTINUITY_ACTIONS[1], CONTINUITY_ACTIONS[3], CONTINUITY_ACTIONS[12]],
    continuityNotes: "Definir compromisos, responsables y presupuesto de continuidad con cada organización aliada antes del cierre.",
    contribution: "Facilitar el registro de la producción y diferenciar lo destinado al hogar, las ventas y otros usos. Esta información puede ayudar al equipo a observar la disponibilidad de alimentos de origen animal; no mide por sí sola el consumo ni el estado nutricional.",
  },
  P2: {
    id: "P2",
    title: "Diversificación de medios de vida",
    objective: "Fortalecer ingresos complementarios mediante actividades productivas diversas, viables y compatibles con las rutinas del hogar.",
    fit: "Cuando los hogares combinan varias fuentes de ingreso y la producción animal puede aportar excedentes sin convertirse en una carga inviable.",
    define: "Qué ingresos complementarios espera fortalecer el proyecto, qué costos recurrentes implica la actividad y qué tiempo de cuidado requiere.",
    measurementNote: "Las ventas brutas no equivalen al ingreso neto. El proyecto debe definir cómo tratar costos, autoconsumo y trabajo familiar.",
    breaches: [
      purposeOption("income-concentration", "Dependencia de una sola fuente de ingreso", "La economía del hogar tiene pocas alternativas ante cambios de empleo, precios o clima."),
      purposeOption("seasonal-income", "Ingresos estacionales o irregulares", "Los ingresos varían durante el año y dificultan cubrir gastos recurrentes."),
      purposeOption("limited-savings", "Poca capacidad para afrontar gastos inesperados", "La falta de reservas o diversificación aumenta la vulnerabilidad del hogar."),
      purposeOption("unmeasured-costs", "Costos productivos poco visibles", "No se registran con claridad gastos, autoconsumo, pérdidas o trabajo familiar."),
      purposeOption("market-access-p2", "Acceso limitado a compradores y mercados", "La escala, distancia o información disponible limita vender excedentes."),
      purposeOption("care-time-p2", "Tiempo de cuidado incompatible con otras responsabilidades", "La carga de trabajo puede reducir la viabilidad de la actividad complementaria."),
    ],
    selectedBreaches: ["income-concentration", "seasonal-income", "unmeasured-costs"],
    components: ["Asistencia técnica productiva", "Gestión económica y costos de producción", "Acceso a mercados y comercialización local"],
    indicators: [
      purposeOption("p2-income-net", "Aporte neto de la actividad al ingreso del hogar", "Definir periodicidad, costos incluidos y tratamiento del trabajo familiar."),
      purposeOption("p2-income-mix", "Hogares con más de una fuente de ingreso activa", "El proyecto define fuentes relevantes y verifica cambios respecto de la línea base."),
      purposeOption("p2-sales", "Ventas y excedentes comercializados por periodo", "Separar ventas de producción destinada al autoconsumo y otros usos."),
      purposeOption("p2-continuity", "Hogares que mantienen la actividad productiva acordada", "Acordar qué significa continuidad para cada especie y escala."),
    ],
    selectedIndicators: ["p2-income-net", "p2-income-mix"],
    assumptions: [
      purposeOption("p2-viability", "La actividad se ajusta al tiempo y capacidades disponibles", "Validar distribución del cuidado y no asumir trabajo familiar gratuito."),
      purposeOption("p2-inputs", "Los costos recurrentes son asequibles para los hogares", "Revisar alimentación, reposición, sanidad, transporte y estacionalidad."),
      purposeOption("p2-market", "Existen canales locales para vender excedentes", "Verificar demanda, precios y costos de acceso antes de fijar metas."),
      purposeOption("p2-measurement", "El proyecto distingue ingreso bruto, costos y aporte neto", "Definir método, frecuencia y responsable de los registros."),
    ],
    selectedAssumptions: ["p2-viability", "p2-inputs", "p2-measurement"],
    phases: [
      seedPhase("diagnosis", "Caracterización de ingresos y capacidades", [PHASE_ACTIVITY_CATALOG.diagnosis[6], PHASE_ACTIVITY_CATALOG.diagnosis[7]], [PHASE_RESOURCE_CATALOG.diagnosis[0], PHASE_RESOURCE_CATALOG.diagnosis[6]], "Equipo de proyecto y facilitador/a local", "2–4 semanas"),
      seedPhase("readiness", "Alistamiento de la actividad complementaria", [PHASE_ACTIVITY_CATALOG.readiness[8], PHASE_ACTIVITY_CATALOG.readiness[9]], [PHASE_RESOURCE_CATALOG.readiness[8], PHASE_RESOURCE_CATALOG.readiness[9]], "Equipo técnico y hogares participantes", "1–2 meses"),
      seedPhase("implementation", "Acompañamiento y diversificación", [PHASE_ACTIVITY_CATALOG.implementation[7], PHASE_ACTIVITY_CATALOG.implementation[6]], [PHASE_RESOURCE_CATALOG.implementation[7], PHASE_RESOURCE_CATALOG.implementation[8]], "Asistencia técnica y promotor/a local", "3–6 meses"),
      seedPhase("followup", "Revisión del aporte y continuidad", [PHASE_ACTIVITY_CATALOG.followup[7], PHASE_ACTIVITY_CATALOG.followup[8]], [PHASE_RESOURCE_CATALOG.followup[9], PHASE_RESOURCE_CATALOG.followup[10]], "Equipo de seguimiento del proyecto", "1–2 meses"),
    ],
    continuity: [CONTINUITY_ACTIONS[3], CONTINUITY_ACTIONS[5], CONTINUITY_ACTIONS[6], CONTINUITY_ACTIONS[10]],
    continuityNotes: "Acordar cómo se cubrirán alimentación, sanidad, reposición y comercialización después del apoyo inicial.",
    contribution: "IwaGranja puede organizar registros de producción, autoconsumo, ventas y gastos para apoyar la lectura del aporte económico. El ingreso neto requiere definir y registrar los costos que el proyecto reconocerá.",
  },
  P3: {
    id: "P3",
    title: "Consolidación productiva e ingreso neto",
    objective: "Fortalecer la viabilidad de unidades productivas con ventas más regulares, costos visibles y decisiones de gestión planificadas.",
    fit: "Cuando los productores ya sostienen una actividad y necesitan mejorar su gestión, productividad, costos o acceso comercial.",
    define: "La escala, el ciclo productivo, el costo completo, las metas realistas de venta y la capacidad de reinversión de cada unidad.",
    measurementNote: "Definir unidad de costeo y periodo comparable; separar margen de caja, utilidad neta y remuneración del trabajo propio.",
    breaches: [
      purposeOption("p3-costing", "Costos unitarios incompletos o desactualizados", "Los costos por lote, animal o unidad de producto no incluyen todos los componentes acordados."),
      purposeOption("p3-cashflow", "Dificultad para anticipar necesidades de caja", "Los ciclos de producción y venta generan periodos sin liquidez suficiente."),
      purposeOption("p3-sales-regularity", "Ventas poco regulares o sin planificación", "La producción no siempre coincide con demanda, calendario o capacidad de entrega."),
      purposeOption("p3-losses", "Pérdidas productivas que reducen el margen", "Mortalidad, desperdicio, baja productividad o problemas de calidad afectan resultados."),
      purposeOption("p3-decision-data", "Falta de información para decidir escala e inversión", "La unidad productiva no cuenta con datos consistentes de producción y finanzas."),
    ],
    selectedBreaches: ["p3-costing", "p3-cashflow", "p3-decision-data"],
    components: ["Asistencia técnica productiva", "Gestión económica y costos de producción", "Acceso a mercados y comercialización local", "Planificación y coordinación productiva"],
    indicators: [
      purposeOption("p3-net-margin", "Margen neto por unidad productiva o ciclo", "Acordar los costos incluidos, tratamiento de trabajo propio y periodo de cálculo."),
      purposeOption("p3-productivity", "Productividad física por animal, lote o periodo", "Elegir una unidad comparable según especie y sistema productivo."),
      purposeOption("p3-regular-sales", "Cumplimiento de ventas y entregas planificadas", "Definir cantidad, calidad, frecuencia y evidencia de entrega."),
      purposeOption("p3-record-use", "Unidades que usan registros para ajustar decisiones", "Establecer evidencia de decisiones basadas en datos productivos y financieros."),
    ],
    selectedIndicators: ["p3-net-margin", "p3-regular-sales"],
    assumptions: [
      purposeOption("p3-data", "La unidad productiva puede mantener registros suficientes", "Validar tiempo, acceso y acompañamiento para registrar información útil."),
      purposeOption("p3-demand", "La demanda permite sostener el nivel de ventas previsto", "Contrastar metas comerciales con compradores y estacionalidad."),
      purposeOption("p3-investment", "Hay capacidad para asumir costos recurrentes e inversión gradual", "Analizar flujo de caja y alternativas de financiamiento o ahorro."),
      purposeOption("p3-technical", "Se dispone de asistencia técnica para la escala propuesta", "Revisar experiencia, frecuencia, cobertura y servicios complementarios."),
    ],
    selectedAssumptions: ["p3-data", "p3-demand", "p3-investment"],
    phases: [
      seedPhase("diagnosis", "Diagnóstico técnico y financiero", [PHASE_ACTIVITY_CATALOG.diagnosis[8], PHASE_ACTIVITY_CATALOG.diagnosis[9]], [PHASE_RESOURCE_CATALOG.diagnosis[7], PHASE_RESOURCE_CATALOG.diagnosis[8]], "Equipo técnico y responsable productivo", "1–2 meses"),
      seedPhase("readiness", "Planificación productiva y comercial", [PHASE_ACTIVITY_CATALOG.readiness[7], PHASE_ACTIVITY_CATALOG.readiness[11]], [PHASE_RESOURCE_CATALOG.readiness[7], PHASE_RESOURCE_CATALOG.readiness[10]], "Asistencia técnica y gestión comercial", "1–2 meses"),
      seedPhase("implementation", "Mejoras y seguimiento de la operación", [PHASE_ACTIVITY_CATALOG.implementation[7], PHASE_ACTIVITY_CATALOG.implementation[12]], [PHASE_RESOURCE_CATALOG.implementation[8], PHASE_RESOURCE_CATALOG.implementation[9]], "Equipo de asistencia técnica", "3–6 meses"),
      seedPhase("followup", "Análisis de resultados y decisiones", [PHASE_ACTIVITY_CATALOG.followup[7], PHASE_ACTIVITY_CATALOG.followup[10]], [PHASE_RESOURCE_CATALOG.followup[6], PHASE_RESOURCE_CATALOG.followup[1]], "Productor/a y equipo de acompañamiento", "1–2 meses"),
    ],
    continuity: [CONTINUITY_ACTIONS[3], CONTINUITY_ACTIONS[5], CONTINUITY_ACTIONS[6], CONTINUITY_ACTIONS[10]],
    continuityNotes: "Planificar los costos operativos, la reinversión y el acceso a asistencia técnica o mercados para el siguiente ciclo.",
    contribution: "IwaGranja puede articular registros operativos, producción, gastos y ventas para facilitar el análisis por especie o lote. Los criterios de costeo e ingreso neto deben acordarse con el proyecto.",
  },
  P4: {
    id: "P4",
    title: "Sanidad y continuidad productiva",
    objective: "Reducir interrupciones y pérdidas mediante prácticas preventivas, seguimiento sanitario y acceso oportuno a asistencia competente.",
    fit: "Cuando enfermedades, mortalidad, brechas de bioseguridad o acceso tardío a servicios amenazan la continuidad de la producción.",
    define: "Las especies y riesgos priorizados, la ruta de atención sanitaria competente, la frecuencia de seguimiento y las responsabilidades.",
    measurementNote: "La app facilita registros y alertas; el diagnóstico, tratamiento y decisiones sanitarias corresponden a personal competente.",
    breaches: [
      purposeOption("p4-delayed-care", "Atención sanitaria tardía o difícil de conseguir", "La distancia, costo o disponibilidad limita la consulta oportuna."),
      purposeOption("p4-biosecurity", "Prácticas de bioseguridad insuficientes", "Faltan medidas adecuadas a especie, escala y riesgos locales."),
      purposeOption("p4-mortality", "Mortalidad, enfermedad o pérdidas recurrentes", "Los eventos afectan bienestar animal, disponibilidad de productos y continuidad."),
      purposeOption("p4-records", "Registros sanitarios incompletos", "No se conserva información suficiente sobre eventos, medidas y seguimiento."),
      purposeOption("p4-continuity", "Interrupciones productivas sin plan de recuperación", "Hogares y equipos no cuentan con medidas de contingencia o reposición."),
    ],
    selectedBreaches: ["p4-delayed-care", "p4-biosecurity", "p4-records"],
    components: ["Sanidad, bienestar y bioseguridad", "Asistencia técnica productiva", "Planificación y coordinación productiva"],
    indicators: [
      purposeOption("p4-practices", "Unidades que aplican prácticas sanitarias priorizadas", "Definir lista de prácticas, método de verificación y responsable técnico."),
      purposeOption("p4-response", "Tiempo de activación de la ruta ante alertas sanitarias", "Acordar qué evento activa la ruta y quién responde."),
      purposeOption("p4-loss", "Frecuencia de pérdidas sanitarias por periodo", "Definir especie, denominador y forma de registrar eventos."),
      purposeOption("p4-continuity", "Unidades que mantienen o recuperan continuidad productiva", "Definir condiciones de continuidad y periodo de observación."),
    ],
    selectedIndicators: ["p4-practices", "p4-response"],
    assumptions: [
      purposeOption("p4-professional", "Existe personal sanitario competente disponible", "Confirmar cobertura, tiempos de respuesta y servicios de referencia."),
      purposeOption("p4-supplies", "Los insumos preventivos y equipos estarán disponibles", "Revisar abastecimiento, uso apropiado y costos recurrentes."),
      purposeOption("p4-reporting", "Los participantes pueden reportar eventos oportunamente", "Prever canal, conectividad, apoyo local y confidencialidad."),
      purposeOption("p4-animal-welfare", "Las medidas son adecuadas para las especies y sistemas atendidos", "Revisar el plan con personal competente y normativa aplicable."),
    ],
    selectedAssumptions: ["p4-professional", "p4-supplies", "p4-animal-welfare"],
    phases: [
      seedPhase("diagnosis", "Caracterización sanitaria y de riesgos", [PHASE_ACTIVITY_CATALOG.diagnosis[10], PHASE_ACTIVITY_CATALOG.diagnosis[11]], [PHASE_RESOURCE_CATALOG.diagnosis[9], PHASE_RESOURCE_CATALOG.diagnosis[10]], "Profesional sanitario y facilitador/a local", "2–4 semanas"),
      seedPhase("readiness", "Plan sanitario y preparación", [PHASE_ACTIVITY_CATALOG.readiness[10], PHASE_ACTIVITY_CATALOG.readiness[17]], [PHASE_RESOURCE_CATALOG.readiness[8], PHASE_RESOURCE_CATALOG.readiness[15]], "Profesional competente y organización aliada", "1–2 meses"),
      seedPhase("implementation", "Prevención y seguimiento en campo", [PHASE_ACTIVITY_CATALOG.implementation[8], PHASE_ACTIVITY_CATALOG.implementation[0]], [PHASE_RESOURCE_CATALOG.implementation[10], PHASE_RESOURCE_CATALOG.implementation[11]], "Equipo sanitario y promotor/a local", "3–6 meses"),
      seedPhase("followup", "Revisión de eventos y continuidad", [PHASE_ACTIVITY_CATALOG.followup[11], PHASE_ACTIVITY_CATALOG.followup[12]], [PHASE_RESOURCE_CATALOG.followup[11], PHASE_RESOURCE_CATALOG.followup[12]], "Equipo sanitario y coordinación del proyecto", "Seguimiento trimestral durante el proyecto"),
    ],
    continuity: [CONTINUITY_ACTIONS[1], CONTINUITY_ACTIONS[2], CONTINUITY_ACTIONS[5], CONTINUITY_ACTIONS[12]],
    continuityNotes: "Dejar acordados contactos, recursos, tiempos de respuesta y ruta sanitaria competente para después del cierre.",
    contribution: "IwaGranja puede facilitar registros de eventos, mortalidad, tratamientos reportados y tareas de seguimiento. La app no reemplaza el criterio ni la atención de personal sanitario competente.",
  },
  P5: {
    id: "P5",
    title: "Extensión y adopción de prácticas",
    objective: "Fortalecer la asistencia a productores y el uso sostenido de prácticas productivas mediante acompañamiento pertinente y seguimiento.",
    fit: "Cuando el proyecto busca ampliar cobertura, mejorar la continuidad de la extensión y acompañar la adopción de prácticas acordadas.",
    define: "Qué prácticas se priorizan, quién acompaña, con qué frecuencia y cómo se verificará su adopción en contexto.",
    measurementNote: "La asistencia recibida no demuestra por sí sola adopción ni impacto; medir cambios observables y condiciones de aplicación.",
    breaches: [
      purposeOption("p5-coverage", "Cobertura insuficiente de asistencia técnica", "Los equipos no logran acompañar con frecuencia o alcance a la población objetivo."),
      purposeOption("p5-followup", "Recomendaciones sin seguimiento práctico", "Los productores reciben orientaciones, pero tienen pocas oportunidades de probarlas y revisarlas."),
      purposeOption("p5-fit", "Prácticas poco adaptadas a capacidades y contexto", "Las recomendaciones pueden no encajar con recursos, cultura, escala o rutinas locales."),
      purposeOption("p5-feedback", "Poca información de retorno desde los productores", "El equipo conoce tarde las dificultades o los ajustes que requieren las recomendaciones."),
      purposeOption("p5-extension-data", "Seguimiento de extensión disperso o difícil de sistematizar", "Los registros de visitas, acuerdos y necesidades no quedan integrados."),
    ],
    selectedBreaches: ["p5-coverage", "p5-followup", "p5-feedback"],
    components: ["Extensión rural y aprendizaje entre pares", "Asistencia técnica productiva", "Sanidad, bienestar y bioseguridad"],
    indicators: [
      purposeOption("p5-visits", "Visitas de extensión realizadas según plan", "Definir cobertura, frecuencia y evidencia mínima de la visita."),
      purposeOption("p5-adoption", "Productores que adoptan prácticas priorizadas", "Validar aplicación y adecuación, no solo conocimiento declarado."),
      purposeOption("p5-issues", "Necesidades reportadas que reciben seguimiento", "Medir tiempos de respuesta y cierre de acuerdos."),
      purposeOption("p5-capacity", "Promotores o técnicos que sostienen el acompañamiento", "Definir funciones, capacidades y continuidad de los referentes."),
    ],
    selectedIndicators: ["p5-visits", "p5-adoption"],
    assumptions: [
      purposeOption("p5-advisors", "El equipo dispone de tiempo para acompañar y revisar registros", "Dimensionar carga de trabajo, traslados y número de productores."),
      purposeOption("p5-trust", "Los productores consideran útiles las prácticas propuestas", "Validar pertinencia con los usuarios y adaptar la metodología."),
      purposeOption("p5-local", "Hay referentes locales que pueden apoyar la extensión", "Acordar formación, reconocimiento, responsabilidades y límites."),
      purposeOption("p5-adoption-resources", "Los participantes cuentan con recursos para poner en práctica recomendaciones", "Identificar insumos, infraestructura y servicios requeridos."),
    ],
    selectedAssumptions: ["p5-advisors", "p5-trust", "p5-adoption-resources"],
    phases: [
      seedPhase("diagnosis", "Diagnóstico de cobertura y necesidades", [PHASE_ACTIVITY_CATALOG.diagnosis[11], PHASE_ACTIVITY_CATALOG.diagnosis[14]], [PHASE_RESOURCE_CATALOG.diagnosis[0], PHASE_RESOURCE_CATALOG.diagnosis[11]], "Coordinación de extensión y actores locales", "2–4 semanas"),
      seedPhase("readiness", "Diseño de la ruta de extensión", [PHASE_ACTIVITY_CATALOG.readiness[9], PHASE_ACTIVITY_CATALOG.readiness[14]], [PHASE_RESOURCE_CATALOG.readiness[9], PHASE_RESOURCE_CATALOG.readiness[12]], "Equipo técnico y promotores locales", "1–2 meses"),
      seedPhase("implementation", "Acompañamiento y práctica en campo", [PHASE_ACTIVITY_CATALOG.implementation[9], PHASE_ACTIVITY_CATALOG.implementation[14]], [PHASE_RESOURCE_CATALOG.implementation[11], PHASE_RESOURCE_CATALOG.implementation[14]], "Profesionales de extensión y facilitadores", "3–6 meses"),
      seedPhase("followup", "Verificación de adopción y aprendizajes", [PHASE_ACTIVITY_CATALOG.followup[9], PHASE_ACTIVITY_CATALOG.followup[14]], [PHASE_RESOURCE_CATALOG.followup[8], PHASE_RESOURCE_CATALOG.followup[11]], "Equipo de extensión y organización aliada", "Seguimiento trimestral durante el proyecto"),
    ],
    continuity: [CONTINUITY_ACTIONS[2], CONTINUITY_ACTIONS[7], CONTINUITY_ACTIONS[9], CONTINUITY_ACTIONS[13]],
    continuityNotes: "Acordar cómo se sostendrán la formación de referentes, las visitas y la actualización de prácticas.",
    contribution: "IwaGranja puede apoyar registros oportunos y revisiones compartidas de tareas, producción y recomendaciones. El equipo de extensión define el acompañamiento y valida la pertinencia de las prácticas.",
  },
  P6: {
    id: "P6",
    title: "Organización productiva y mercados locales",
    objective: "Mejorar la coordinación entre productores, la planificación de la oferta y la participación sostenible en mercados locales.",
    fit: "Cuando productores vinculados o cercanos necesitan coordinar volúmenes, calidad, calendario, logística o acuerdos de comercialización.",
    define: "La capacidad real de oferta, reglas de participación, demanda, costos logísticos y gobernanza de los acuerdos.",
    measurementNote: "Los datos agregados requieren autorización, reglas de acceso claras y protección de información comercial y personal.",
    breaches: [
      purposeOption("p6-fragmented", "Oferta productiva dispersa y difícil de coordinar", "Los volúmenes individuales no alcanzan o no coinciden con los requerimientos de compra."),
      purposeOption("p6-planning", "Falta de planificación de entregas y calendario", "La organización conoce tarde la disponibilidad de cada productor."),
      purposeOption("p6-quality", "Variación de calidad, empaque o cumplimiento", "La oferta puede no cumplir condiciones consistentes para compradores locales."),
      purposeOption("p6-logistics", "Costos logísticos o de acopio elevados", "Distancia, transporte y almacenamiento reducen la viabilidad comercial."),
      purposeOption("p6-governance", "Reglas de coordinación y distribución poco claras", "Se requieren acuerdos transparentes para responsabilidades, beneficios y decisiones."),
    ],
    selectedBreaches: ["p6-fragmented", "p6-planning", "p6-governance"],
    components: ["Organización familiar o comunitaria", "Acceso a mercados y comercialización local", "Planificación y coordinación productiva", "Calidad, poscosecha y logística"],
    indicators: [
      purposeOption("p6-coordination", "Productores que participan en acuerdos de coordinación", "Definir participación activa y mecanismos de decisión."),
      purposeOption("p6-delivery", "Entregas que cumplen calendario y condiciones acordadas", "Registrar cantidad, calidad, oportunidad y cumplimiento."),
      purposeOption("p6-sales", "Volumen o valor comercializado de manera organizada", "Acordar periodo, método de agregación y autorización."),
      purposeOption("p6-market", "Acuerdos comerciales locales activos al cierre", "Medir vigencia, condiciones y capacidad organizativa para sostenerlos."),
    ],
    selectedIndicators: ["p6-coordination", "p6-delivery"],
    assumptions: [
      purposeOption("p6-commitment", "Los productores desean participar en acuerdos colectivos", "Validar condiciones, reglas y beneficios esperados."),
      purposeOption("p6-demand", "Los compradores locales mantienen demanda suficiente", "Contrastar calidad, precio, cantidad y estacionalidad."),
      purposeOption("p6-governance", "La organización puede administrar reglas y datos compartidos", "Acordar gobernanza, autorizaciones y manejo de desacuerdos."),
      purposeOption("p6-logistics", "La logística no elimina el beneficio esperado", "Calcular transporte, acopio, empaque y tiempos."),
    ],
    selectedAssumptions: ["p6-commitment", "p6-demand", "p6-governance"],
    phases: [
      seedPhase("diagnosis", "Mapeo de oferta, actores y demanda", [PHASE_ACTIVITY_CATALOG.diagnosis[12], PHASE_ACTIVITY_CATALOG.diagnosis[17]], [PHASE_RESOURCE_CATALOG.diagnosis[12], PHASE_RESOURCE_CATALOG.diagnosis[13]], "Organización de productores y facilitación comercial", "1–2 meses"),
      seedPhase("readiness", "Acuerdos de calidad y coordinación", [PHASE_ACTIVITY_CATALOG.readiness[14], PHASE_ACTIVITY_CATALOG.readiness[15]], [PHASE_RESOURCE_CATALOG.readiness[14], PHASE_RESOURCE_CATALOG.readiness[15]], "Organización aliada y productores participantes", "1–2 meses"),
      seedPhase("implementation", "Consolidación de oferta y entregas", [PHASE_ACTIVITY_CATALOG.implementation[12], PHASE_ACTIVITY_CATALOG.implementation[15]], [PHASE_RESOURCE_CATALOG.implementation[9], PHASE_RESOURCE_CATALOG.implementation[14]], "Comité o responsable comercial local", "3–6 meses"),
      seedPhase("followup", "Revisión de acuerdos y resultados comerciales", [PHASE_ACTIVITY_CATALOG.followup[15], PHASE_ACTIVITY_CATALOG.followup[16]], [PHASE_RESOURCE_CATALOG.followup[14], PHASE_RESOURCE_CATALOG.followup[15]], "Organización de productores y equipo del proyecto", "1–2 meses"),
    ],
    continuity: [CONTINUITY_ACTIONS[5], CONTINUITY_ACTIONS[6], CONTINUITY_ACTIONS[7], CONTINUITY_ACTIONS[13]],
    continuityNotes: "Formalizar responsables, reglas de coordinación, costos operativos y revisión de acuerdos comerciales.",
    contribution: "IwaGranja puede organizar registros por unidad productiva y, con autorización y configuración adecuada, apoyar la revisión de información agregada para planificar oferta y seguimiento.",
  },
  P7: {
    id: "P7",
    title: "Producción circular y uso eficiente de recursos",
    objective: "Fortalecer prácticas que aprovechan subproductos y usan de manera eficiente recursos como agua, alimento, energía y materiales.",
    fit: "Cuando el proyecto acompaña cambios concretos en manejo de residuos, aprovechamiento de subproductos o eficiencia de recursos productivos.",
    define: "Qué flujos de recursos se priorizan, su situación inicial, riesgos sanitarios y ambientales, y quién verifica las prácticas.",
    measurementNote: "Registrar una práctica o insumo no demuestra por sí solo reducción de impacto; definir una línea base y una forma de medición válida.",
    breaches: [
      purposeOption("p7-waste", "Subproductos y residuos sin aprovechamiento seguro", "Materiales orgánicos o subproductos pueden perderse o manejarse sin una ruta definida."),
      purposeOption("p7-water", "Uso de agua poco eficiente o vulnerable", "La disponibilidad, almacenamiento o consumo de agua requiere mejoras."),
      purposeOption("p7-inputs", "Dependencia alta de insumos externos", "La producción depende de insumos costosos o de suministro irregular."),
      purposeOption("p7-energy", "Consumo de energía o materiales sin seguimiento", "No se identifican oportunidades prácticas de ahorro o reutilización."),
      purposeOption("p7-risk", "Riesgos sanitarios o ambientales en el manejo de residuos", "El aprovechamiento necesita orientación técnica, protección y controles adecuados."),
    ],
    selectedBreaches: ["p7-waste", "p7-water", "p7-risk"],
    components: ["Economía circular y aprovechamiento de subproductos", "Gestión ambiental y uso eficiente de recursos", "Sanidad, bienestar y bioseguridad", "Asistencia técnica productiva"],
    indicators: [
      purposeOption("p7-practices", "Unidades que adoptan prácticas de aprovechamiento acordadas", "Precisar práctica, frecuencia y criterios técnicos de verificación."),
      purposeOption("p7-water", "Uso de agua por unidad de producción o periodo", "Acordar fuente, unidad de medida y comparabilidad."),
      purposeOption("p7-inputs", "Uso de insumos por lote, ciclo o volumen producido", "Definir los insumos y el denominador que permiten comparar cambios."),
      purposeOption("p7-waste", "Subproductos manejados mediante una ruta segura definida", "Validar condiciones sanitarias y ambientales con asistencia competente."),
    ],
    selectedIndicators: ["p7-practices", "p7-waste"],
    assumptions: [
      purposeOption("p7-safe", "Las prácticas de aprovechamiento son seguras para animales y personas", "Revisar manejo sanitario, almacenamiento y normas aplicables."),
      purposeOption("p7-resources", "Los recursos para implementar mejoras están disponibles", "Identificar equipos, insumos, infraestructura y mantenimiento."),
      purposeOption("p7-measurement", "El proyecto puede medir los flujos de recursos priorizados", "Definir línea base, unidades, frecuencia y responsables."),
      purposeOption("p7-acceptance", "Los hogares consideran viables las prácticas propuestas", "Validar esfuerzo, tiempos, beneficios y adecuación al contexto."),
    ],
    selectedAssumptions: ["p7-safe", "p7-resources", "p7-acceptance"],
    phases: [
      seedPhase("diagnosis", "Diagnóstico de flujos y prácticas", [PHASE_ACTIVITY_CATALOG.diagnosis[13], PHASE_ACTIVITY_CATALOG.diagnosis[16]], [PHASE_RESOURCE_CATALOG.diagnosis[14], PHASE_RESOURCE_CATALOG.diagnosis[15]], "Equipo ambiental y asistencia técnica", "2–4 semanas"),
      seedPhase("readiness", "Diseño de soluciones y preparación", [PHASE_ACTIVITY_CATALOG.readiness[13], PHASE_ACTIVITY_CATALOG.readiness[16]], [PHASE_RESOURCE_CATALOG.readiness[11], PHASE_RESOURCE_CATALOG.readiness[14]], "Equipo técnico y hogares participantes", "1–2 meses"),
      seedPhase("implementation", "Implementación de prácticas circulares", [PHASE_ACTIVITY_CATALOG.implementation[16], PHASE_ACTIVITY_CATALOG.implementation[17]], [PHASE_RESOURCE_CATALOG.implementation[15], PHASE_RESOURCE_CATALOG.implementation[16]], "Facilitador/a local y asistencia técnica", "3–6 meses"),
      seedPhase("followup", "Medición de uso de recursos y continuidad", [PHASE_ACTIVITY_CATALOG.followup[17], PHASE_ACTIVITY_CATALOG.followup[18]], [PHASE_RESOURCE_CATALOG.followup[16], PHASE_RESOURCE_CATALOG.followup[17]], "Equipo ambiental y organización local", "1–2 meses"),
    ],
    continuity: [CONTINUITY_ACTIONS[3], CONTINUITY_ACTIONS[9], CONTINUITY_ACTIONS[11], CONTINUITY_ACTIONS[12]],
    continuityNotes: "Definir mantenimiento de infraestructura, responsables, prácticas seguras y mediciones sencillas que continúan tras el proyecto.",
    contribution: "IwaGranja puede apoyar registros de producción, insumos, mantenimiento y gallinaza cuando sean pertinentes. La selección de variables y la evaluación ambiental deben definirse con el proyecto y su asistencia técnica.",
  },
};
type ProjectDraft = {
  primaryPurpose: PurposeTemplateId;
  purposeTitle: string;
  purposeObjective: string;
  secondaryPurposes: string[];
  territory: string;
  organization: string;
  organizationType: string;
  households: string;
  populationGroups: string[];
  populationNotes: string;
  priorityCriteria: string[];
  priorityNotes: string;
  selectedBreaches: string[];
  context: string;
  profiles: string[];
  actorRoles: string[];
  components: string[];
  includeIwagrana: boolean;
  iwagranaContribution: string;
  otherTools: string;
  phases: PlanPhase[];
  projectIndicators: string[];
  projectAssumptions: string[];
  platformIndicators: string[];
  continuityActions: string[];
  customContinuityActions: string[];
  continuityNotes: string;
  opportunityTitle: string;
  opportunitySource: string;
  opportunityUrl: string;
  opportunityDeadline: string;
};

const INITIAL_DRAFT: ProjectDraft = {
  primaryPurpose: "P1",
  purposeTitle: PURPOSE_TEMPLATES.P1.title,
  purposeObjective: PURPOSE_TEMPLATES.P1.objective,
  secondaryPurposes: [],
  territory: "",
  organization: "",
  organizationType: "",
  households: "",
  populationGroups: ["rural-smallholders"],
  populationNotes: "",
  priorityCriteria: ["food-gap", "rural-location"],
  priorityNotes: "",
  selectedBreaches: PURPOSE_TEMPLATES.P1.selectedBreaches,
  context: "",
  profiles: [BENEFICIARY_PROFILES[0]],
  actorRoles: [ACTOR_ROLES[0], ACTOR_ROLES[1]],
  components: PURPOSE_TEMPLATES.P1.components,
  includeIwagrana: true,
  iwagranaContribution: PURPOSE_TEMPLATES.P1.contribution,
  otherTools: "",
  phases: PURPOSE_TEMPLATES.P1.phases,
  projectIndicators: PURPOSE_TEMPLATES.P1.selectedIndicators,
  projectAssumptions: PURPOSE_TEMPLATES.P1.selectedAssumptions,
  platformIndicators: ["active", "complete"],
  continuityActions: PURPOSE_TEMPLATES.P1.continuity,
  customContinuityActions: [],
  continuityNotes: PURPOSE_TEMPLATES.P1.continuityNotes,
  opportunityTitle: "",
  opportunitySource: "",
  opportunityUrl: "",
  opportunityDeadline: "",
};

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function catalogOptionId(catalog: string, title: string) {
  const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const hash = Array.from(title.toLowerCase()).reduce((value, character) => Math.imul(value ^ character.codePointAt(0)!, 16777619), 2166136261);
  return `${catalog}-${slug || "opcion"}-${(hash >>> 0).toString(36)}`;
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

function CheckOption({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={`flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-colors sm:p-3 ${
        checked ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"}`}>
        {checked && <Check className="h-3 w-3" aria-hidden="true" />}
      </span>
      <span>
        <span className="block text-[13px] font-semibold leading-snug text-slate-800">{title}</span>
        {detail && <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">{detail}</span>}
      </span>
    </button>
  );
}

function CatalogItemPicker({
  label,
  catalog,
  items,
  customOptions,
  onCustomOptionsChange,
  onChange,
  emptyLabel,
}: {
  label: string;
  catalog: string[];
  items: string[];
  customOptions: string[];
  onCustomOptionsChange: (items: string[]) => void;
  onChange: (items: string[]) => void;
  emptyLabel: string;
}) {
  const [selected, setSelected] = useState("");
  const [customItem, setCustomItem] = useState("");

  const addItem = (value: string, isCustom = false) => {
    const normalized = value.trim();
    if (!normalized || items.includes(normalized)) return;
    if (isCustom && !catalog.includes(normalized) && !customOptions.includes(normalized)) {
      onCustomOptionsChange([...customOptions, normalized]);
    }
    onChange([...items, normalized]);
    setSelected("");
    setCustomItem("");
  };
  const availableOptions = [...catalog, ...customOptions.filter((item) => !catalog.includes(item))];

  return (
    <div>
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Select aria-label={label} value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Elegir una opción del catálogo</option>
          {availableOptions.filter((item) => !items.includes(item)).map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Button type="button" variant="secondary" disabled={!selected} onClick={() => addItem(selected)} className="inline-flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input value={customItem} onChange={(event) => setCustomItem(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addItem(customItem, true); } }} aria-label={`Agregar elemento personalizado a ${label}`} placeholder="Agregar otra opción propia" className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
        <Button type="button" variant="secondary" disabled={!customItem.trim()} onClick={() => addItem(customItem, true)} className="inline-flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" /> Agregar propia
        </Button>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-slate-800">
            <span>{item}</span>
            <button type="button" onClick={() => onChange(items.filter((current) => current !== item))} aria-label={`Quitar: ${item}`} className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-white hover:text-red-700"><X className="h-4 w-4" /></button>
          </li>
        ))}
        {items.length === 0 && <li className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">{emptyLabel}</li>}
      </ul>
    </div>
  );
}

function CustomOptionAdder({
  label,
  placeholder = "Escribe una opción propia",
  onAdd,
}: {
  label: string;
  placeholder?: string;
  onAdd: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const normalized = value.trim();
    if (!normalized) return;
    onAdd(normalized);
    setValue("");
  };

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
      <input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} aria-label={label} placeholder={placeholder} className="min-h-10 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
      <Button type="button" variant="secondary" disabled={!value.trim()} onClick={add} className="inline-flex items-center justify-center gap-1.5">
        <Plus className="h-4 w-4" /> Agregar opción propia
      </Button>
    </div>
  );
}

function SectionTitle({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="mb-5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">{detail}</p>
    </div>
  );
}

export function ProjectFormulator({ surface = "app" }: { surface?: "app" | "public" }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProjectDraft>(INITIAL_DRAFT);
  const [opportunityDocuments, setOpportunityDocuments] = useState<OpportunityDocument[]>([]);
  const [customOrganizationTypes, setCustomOrganizationTypes] = useState<string[]>([]);
  const [customPopulationGroups, setCustomPopulationGroups] = useState<CatalogOption[]>([]);
  const [customPriorityCriteria, setCustomPriorityCriteria] = useState<CatalogOption[]>([]);
  const [customBreaches, setCustomBreaches] = useState<CatalogOption[]>([]);
  const [customSecondaryPurposes, setCustomSecondaryPurposes] = useState<string[]>([]);
  const [customProfiles, setCustomProfiles] = useState<string[]>([]);
  const [customActorRoles, setCustomActorRoles] = useState<string[]>([]);
  const [customComponents, setCustomComponents] = useState<Array<{ name: string; icon: typeof Users }>>([]);
  const [customProjectIndicators, setCustomProjectIndicators] = useState<CatalogOption[]>([]);
  const [customPlatformIndicators, setCustomPlatformIndicators] = useState<Array<{ id: string; title: string }>>([]);
  const [customAssumptions, setCustomAssumptions] = useState<CatalogOption[]>([]);
  const [customTimings, setCustomTimings] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  const progress = ((step + 1) / STEPS.length) * 100;
  const activeTemplate = PURPOSE_TEMPLATES[draft.primaryPurpose];
  const purposeTitle = draft.purposeTitle.trim() || activeTemplate.title;
  const purposeTemplates = Object.values(PURPOSE_TEMPLATES);
  const selectedSecondary = useMemo(() => draft.secondaryPurposes, [draft.secondaryPurposes]);
  const organizationTypeOptions = [...ORGANIZATION_TYPES, ...customOrganizationTypes];
  const secondaryPurposeOptions = [...purposeTemplates.filter((template) => template.id !== draft.primaryPurpose).map((template) => template.title), ...customSecondaryPurposes];
  const beneficiaryProfileOptions = [...BENEFICIARY_PROFILES, ...customProfiles];
  const actorRoleOptions = [...ACTOR_ROLES, ...customActorRoles];
  const projectComponentOptions = [...PROJECT_COMPONENTS, ...customComponents];
  const populationGroupOptions = [...POPULATION_GROUPS, ...customPopulationGroups];
  const priorityCriteriaOptions = [...PRIORITY_CRITERIA, ...customPriorityCriteria];
  const foodGapOptions = [...activeTemplate.breaches, ...customBreaches];
  const projectIndicatorOptions = [...activeTemplate.indicators, ...customProjectIndicators];
  const platformIndicatorOptions = [...PLATFORM_INDICATORS, ...customPlatformIndicators];
  const projectAssumptionOptions = [...activeTemplate.assumptions, ...customAssumptions];
  const timingOptions = [...TIME_OPTIONS, ...customTimings];

  const patch = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const selectPurposeTemplate = (purpose: PurposeTemplateId) => {
    if (purpose === draft.primaryPurpose) return;
    const template = PURPOSE_TEMPLATES[purpose];
    setDraft((previous) => ({
      ...previous,
      primaryPurpose: purpose,
      purposeTitle: template.title,
      purposeObjective: template.objective,
      secondaryPurposes: previous.secondaryPurposes.filter((item) => item !== template.title),
      selectedBreaches: [...template.selectedBreaches],
      components: [...template.components],
      iwagranaContribution: template.contribution,
      phases: template.phases.map((phase) => ({ ...phase, activities: [...phase.activities], resources: [...phase.resources] })),
      projectIndicators: [...template.selectedIndicators],
      projectAssumptions: [...template.selectedAssumptions],
      continuityActions: [...template.continuity],
      continuityNotes: template.continuityNotes,
    }));
    setStep(0);
    setNotice(`Modelo ${purpose} cargado. Se conservaron los datos comunes de organización, población, territorio y convocatoria.`);
  };

  const createCustomOption = (catalog: string, title: string): CatalogOption => ({
    id: catalogOptionId(catalog, title),
    title,
    detail: "Opción propia agregada para adaptar la ficha al proyecto y al territorio.",
  });

  const setPhase = <K extends keyof PlanPhase>(index: number, key: K, value: PlanPhase[K]) => {
    setDraft((previous) => ({
      ...previous,
      phases: previous.phases.map((phase, currentIndex) =>
        currentIndex === index ? { ...phase, [key]: value } : phase,
      ),
    }));
  };

  const addPhase = () => {
    setDraft((previous) => ({
      ...previous,
      phases: [...previous.phases, {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: "Nueva fase",
        activities: [],
        customActivities: [],
        owner: "",
        timing: "Duración definida por la convocatoria",
        customTiming: "",
        resources: [],
        customResources: [],
      }],
    }));
  };

  const addOpportunityDocuments = (files: FileList | null) => {
    if (!files?.length) return;
    const additions = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
    }));
    setOpportunityDocuments((previous) => [...previous, ...additions]);
  };

  const downloadProjectSheet = () => {
    const projectIndicators = projectIndicatorOptions.filter((item) => draft.projectIndicators.includes(item.id));
    const projectAssumptions = projectAssumptionOptions.filter((item) => draft.projectAssumptions.includes(item.id));
    const platformIndicators = platformIndicatorOptions.filter((item) => draft.platformIndicators.includes(item.id));
    const populationGroups = populationGroupOptions.filter((item) => draft.populationGroups.includes(item.id));
    const priorityCriteria = priorityCriteriaOptions.filter((item) => draft.priorityCriteria.includes(item.id));
    const selectedBreaches = foodGapOptions.filter((item) => draft.selectedBreaches.includes(item.id));
    const esc = escapeHtml;
    const list = (items: string[], empty = "Por definir") => items.length
      ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`
      : `<p class="empty">${esc(empty)}</p>`;
    const detailedList = (items: CatalogOption[], empty = "Por definir") => items.length
      ? `<ul>${items.map((item) => `<li><strong>${esc(item.title)}</strong><span>${esc(item.detail)}</span></li>`).join("")}</ul>`
      : `<p class="empty">${esc(empty)}</p>`;
    const phaseSections = draft.phases.map((phase, index) => {
      const duration = phase.timing === "Personalizado" ? (phase.customTiming || "Por definir") : (phase.timing || "Por definir");
      return `<article class="phase"><div class="phase-title"><span class="number">${index + 1}</span><h3>${esc(phase.title || "Fase por nombrar")}</h3></div><div class="phase-row"><h4>Actividades</h4>${list(phase.activities)}</div><div class="phase-row"><h4>Recursos o apoyos clave</h4>${list(phase.resources)}</div><div class="phase-row"><h4>Responsable</h4><p>${esc(phase.owner || "Por definir")}</p></div><div class="phase-row"><h4>Tiempo estimado</h4><p>${esc(duration)}</p></div></article>`;
    }).join("");
    const purposeSlug = purposeTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Diseño de Proyectos Rurales con Producción Animal · ${esc(draft.primaryPurpose)} · ${esc(purposeTitle)}</title>
<style>
  :root{--ink:#17271f;--muted:#5a6b61;--green:#176443;--pale:#edf6ef;--line:#dce7df;--paper:#fff;--gold:#cf9e43}
  *{box-sizing:border-box}body{margin:0;background:#edf2ee;color:var(--ink);font:14px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  .sheet{max-width:900px;margin:32px auto;padding:0 22px 40px}.cover{position:relative;overflow:hidden;padding:38px 42px;border-radius:20px;background:linear-gradient(128deg,#103f2e,#1d7050 64%,#81a956);color:white;box-shadow:0 16px 35px #153b2b24}
  .cover:after{content:"";position:absolute;width:250px;height:250px;border:1px solid #ffffff35;border-radius:50%;right:-65px;top:-115px;box-shadow:0 0 0 28px #ffffff0b,0 0 0 58px #ffffff0b}
  .brand{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#d7eddb}.code{display:inline-flex;margin-top:23px;padding:5px 10px;border:1px solid #ffffff70;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.06em}
  h1{position:relative;margin:12px 0 8px;max-width:680px;font-size:32px;line-height:1.12;letter-spacing:-.03em}.cover p{position:relative;max-width:680px;margin:0;color:#f0f8f1;font-size:15px}.meta{position:relative;display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:24px;color:#e4f0e7;font-size:12px}
  .notice{margin:16px 0 22px;padding:12px 15px;border:1px solid #ead9af;border-radius:12px;background:#fff9eb;color:#604b20;font-size:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.section{margin-top:16px;padding:20px 22px;border:1px solid var(--line);border-radius:16px;background:var(--paper);box-shadow:0 4px 14px #1f3d2810;break-inside:avoid}.section.full{grid-column:1/-1}.section-heading{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}.marker{display:flex;align-items:center;justify-content:center;flex:0 0 30px;height:30px;border-radius:9px;background:var(--pale);color:var(--green);font-size:12px;font-weight:800}.section h2{margin:0;color:#1c4f38;font-size:16px;line-height:1.25}.kicker{margin:0 0 4px;color:#718177;font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
  .facts{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fact{padding:10px 12px;border-radius:10px;background:#f6f8f6}.fact label{display:block;color:#77847b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.fact p{margin:2px 0 0;font-weight:600}.section p{margin:6px 0}.section ul{margin:7px 0 0;padding-left:19px}.section li{margin:5px 0}.section li span{display:block;color:var(--muted);font-size:12px}.empty{color:#6b7a70;font-style:italic}
  .callout{padding:14px 16px;border-left:4px solid var(--gold);border-radius:4px 12px 12px 4px;background:#fff8e9}.callout strong{display:block;margin-bottom:4px;color:#5d4a24}.phase{margin-top:12px;padding:16px;border:1px solid var(--line);border-radius:14px;background:#fbfdfb;break-inside:avoid}.phase-title{display:flex;align-items:center;gap:10px;padding-bottom:11px;border-bottom:1px solid var(--line)}.phase-title h3{flex:1;margin:0;font-size:15px}.number{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--green);color:white;font-size:12px;font-weight:800}.duration{padding:4px 8px;border-radius:999px;background:#eef3ee;color:#4d6555;font-size:10px;font-weight:700}.phase-row{padding:11px 2px 0}.phase-row h4{margin:0 0 3px;color:#346048;font-size:11px;letter-spacing:.08em;text-transform:uppercase}.phase-row p,.phase-row ul{margin:0;font-size:13px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}.footer{margin-top:20px;padding:15px 2px;border-top:1px solid var(--line);color:#607066;font-size:11px}.footer strong{color:#2b4c39}
  @media(max-width:650px){.sheet{margin:12px auto;padding:0 12px 24px}.cover{padding:28px 23px}.cover h1{font-size:27px}.grid,.facts,.two-col{grid-template-columns:1fr}.section.full{grid-column:auto}.section{padding:16px}.phase-title{flex-wrap:wrap}.duration{margin-left:38px}}
  @media print{body{background:white;font-size:11pt}.sheet{max-width:none;margin:0;padding:0}.cover{border-radius:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}.section{box-shadow:none;padding:14px 16px}.notice,.section,.phase{print-color-adjust:exact;-webkit-print-color-adjust:exact}@page{size:A4;margin:15mm}}
</style></head><body><main class="sheet">
<header class="cover"><div class="brand">Diseño de Proyectos Rurales con Producción Animal · IwaGranja</div><span class="code">MODELO ${esc(draft.primaryPurpose)} · FICHA PERSONALIZABLE</span><h1>${esc(purposeTitle)}</h1><p>${esc(draft.purposeObjective)}</p><div class="meta"><span>Preparada: ${esc(new Date().toLocaleDateString("es-CO"))}</span><span>${esc(draft.organization || "Organización por definir")}</span><span>${esc(draft.territory || "Territorio por definir")}</span></div></header>
<div class="notice"><strong>Ficha inicial de formulación.</strong> Requiere validación con la población y adaptación a la oportunidad, el territorio, el diseño técnico y el presupuesto. Los resultados del proyecto se presentan por separado de los datos de uso de IwaGranja.</div>
<div class="grid">
<section class="section full"><div class="section-heading"><span class="marker">01</span><div><p class="kicker">Propósito principal · ${esc(draft.primaryPurpose)}</p><h2>${esc(purposeTitle)}</h2></div></div><p>${esc(draft.purposeObjective)}</p><div class="two-col"><div class="callout"><strong>Puede encajar</strong>${esc(activeTemplate.fit)}</div><div class="callout"><strong>Requiere definir</strong>${esc(activeTemplate.define)}</div></div>${selectedSecondary.length ? `<p><strong>Propósitos secundarios:</strong> ${selectedSecondary.map(esc).join(" · ")}</p>` : ""}</section>
<section class="section full"><div class="section-heading"><span class="marker">02</span><div><p class="kicker">Población y territorio</p><h2>Contexto y priorización</h2></div></div><div class="facts"><div class="fact"><label>Territorio</label><p>${esc(draft.territory || "Por definir")}</p></div><div class="fact"><label>Organización interesada</label><p>${esc(draft.organization || "Por definir")}${draft.organizationType ? ` · ${esc(draft.organizationType)}` : ""}</p></div><div class="fact"><label>Hogares estimados</label><p>${esc(draft.households || "Por definir")}</p></div><div class="fact"><label>Grupos priorizados</label><p>${esc(populationGroups.map((item) => item.title).join(" · ") || "Por definir")}</p></div></div>${draft.populationNotes ? `<p><strong>Precisiones:</strong> ${esc(draft.populationNotes)}</p>` : ""}<p><strong>Criterios de priorización:</strong> ${esc(priorityCriteria.map((item) => item.title).join(" · ") || "Por definir")}</p>${draft.priorityNotes ? `<p><strong>Aplicación de criterios:</strong> ${esc(draft.priorityNotes)}</p>` : ""}<p><strong>Perfiles de referencia:</strong> ${esc(draft.profiles.join(" · ") || "Por definir")}</p><p><strong>Posibles usuarios de registros:</strong> ${esc(draft.actorRoles.join(" · ") || "Por definir")}</p></section>
<section class="section"><div class="section-heading"><span class="marker">03</span><div><p class="kicker">Situación priorizada</p><h2>Brechas que se busca atender</h2></div></div>${detailedList(selectedBreaches.map((item) => ({ ...item, detail: item.detail }))) }${draft.context ? `<p><strong>Evidencia y notas territoriales:</strong><br>${esc(draft.context).replace(/\n/g, "<br>")}</p>` : ""}</section>
<section class="section"><div class="section-heading"><span class="marker">04</span><div><p class="kicker">Convocatoria</p><h2>Oportunidad relacionada</h2></div></div><div class="facts"><div class="fact"><label>Fondo o convocatoria</label><p>${esc(draft.opportunityTitle || "Por definir")}</p></div><div class="fact"><label>Organización fuente</label><p>${esc(draft.opportunitySource || "Por definir")}</p></div><div class="fact"><label>Fecha límite</label><p>${esc(draft.opportunityDeadline || "Por definir")}</p></div><div class="fact"><label>Enlace</label><p>${esc(draft.opportunityUrl || "Por definir")}</p></div></div><p><strong>Documentos relacionados</strong></p>${list(opportunityDocuments.map(({ file }) => file.name), "No se adjuntaron documentos en esta sesión. La ficha registra sus nombres; no incorpora el contenido de los archivos.")}</section>
<section class="section"><div class="section-heading"><span class="marker">05</span><div><p class="kicker">Intervención</p><h2>Componentes y apoyos</h2></div></div>${list(draft.components)}${draft.otherTools ? `<p><strong>Otros apoyos:</strong><br>${esc(draft.otherTools).replace(/\n/g, "<br>")}</p>` : ""}</section>
<section class="section"><div class="section-heading"><span class="marker">06</span><div><p class="kicker">Herramienta digital posible</p><h2>Aporte de IwaGranja</h2></div></div><p>${esc(draft.includeIwagrana ? draft.iwagranaContribution : "IwaGranja no se contempla en esta versión de la propuesta.")}</p></section>
<section class="section full"><div class="section-heading"><span class="marker">07</span><div><p class="kicker">Plan de implementación · base para adaptar</p><h2>Actividades, recursos y responsables</h2></div></div>${phaseSections || `<p class="empty">Fases por definir.</p>`}</section>
<section class="section"><div class="section-heading"><span class="marker">08</span><div><p class="kicker">Resultados del proyecto</p><h2>Indicadores sugeridos</h2></div></div><p class="empty">El proyecto define línea base, meta, instrumento, método y periodicidad.</p>${detailedList(projectIndicators)}</section>
<section class="section"><div class="section-heading"><span class="marker">09</span><div><p class="kicker">Supuestos</p><h2>Condiciones por validar</h2></div></div>${detailedList(projectAssumptions, "No se seleccionaron supuestos.")}</section>
<section class="section"><div class="section-heading"><span class="marker">10</span><div><p class="kicker">Medición separada</p><h2>Uso de IwaGranja</h2></div></div>${draft.includeIwagrana ? list(platformIndicators.map((item) => item.title), "Indicadores de uso por definir.") : `<p class="empty">No se incluyen indicadores de uso porque la herramienta no está considerada en esta propuesta.</p>`}</section>
<section class="section"><div class="section-heading"><span class="marker">11</span><div><p class="kicker">Después del proyecto</p><h2>Continuidad</h2></div></div>${list(draft.continuityActions, "Acciones por definir.")}<p>${esc(draft.continuityNotes || "Acuerdos, responsables y recursos pendientes de definir.")}</p></section>
</div><footer class="footer"><strong>Diseño de Proyectos Rurales con Producción Animal · IwaGranja</strong> · Herramienta abierta y personalizable para ordenar una idea de proyecto y preparar el diálogo con aliados. Este documento no constituye por sí solo una propuesta técnica, financiera ni una evaluación de resultados. ${esc(activeTemplate.measurementNote)}</footer>
</main></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `iwagranja-diseno-proyectos-rurales-produccion-animal-${draft.primaryPurpose.toLowerCase()}-${purposeSlug}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Descargaste la ficha HTML con formato; puedes abrirla o imprimirla como PDF.");
  };

  const handlePrint = () => {
    setNotice("En el diálogo de impresión puedes elegir «Guardar como PDF».");
    window.setTimeout(() => window.print(), 100);
  };

  return (
    <div className="space-y-6">
      {surface === "app" && (
        <PageHeader
          title="Diseño de Proyectos Rurales con Producción Animal"
          eyebrow="Herramienta IwaGranja · Modelos según propósito"
          description="Adapta uno de siete modelos que integran la producción animal de pequeña escala en proyectos de alimentación, medios de vida, capacidades productivas y desarrollo local."
          icon="book-open"
          actions={
            <Link href="/planeacion" className="inline-flex items-center gap-2 rounded-lg border border-white/50 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-white">
              <ArrowLeft className="h-4 w-4" /> Volver a Planeación
            </Link>
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href={surface === "public" ? "/recursos" : "/planeacion"} className="hover:text-emerald-800 hover:underline">{surface === "public" ? "Recursos" : "Planeación"}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>Diseño de proyectos rurales</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-slate-700">{draft.primaryPurpose} · {purposeTitle}</span>
        <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-emerald-900">HERRAMIENTA OFICIAL</span>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-2 print:hidden">
        <Card className="!p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Ficha en curso</h2>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
                  <li><strong className="text-slate-800">Propósito:</strong> {draft.primaryPurpose} · {purposeTitle}</li>
                  <li><strong className="text-slate-800">Territorio:</strong> {draft.territory || "Por definir"}</li>
                  <li><strong className="text-slate-800">Población:</strong> {draft.populationGroups.length} grupos · {draft.households || "hogares por estimar"}</li>
                  <li><strong className="text-slate-800">Plan:</strong> {draft.phases.length} fases · {draft.components.length} componentes</li>
                </ul>
              </div>
            </div>
            <button type="button" onClick={() => setStep(5)} className="shrink-0 text-xs font-semibold text-emerald-800 hover:underline">Ver ficha <ChevronRight className="inline h-3.5 w-3.5" /></button>
          </div>
        </Card>
        <Card className="!p-4">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sobre esta herramienta</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Prellena propósito, brechas, actividades, recursos, indicadores, supuestos y continuidad. Puedes modificar cada opción. Los datos del formulario y los documentos relacionados permanecen en esta sesión; descarga la ficha para conservar una copia.</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="order-last min-w-0 space-y-4 xl:order-first">
          <Card className="!p-4 sm:!p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Construye tu ficha</p>
                <p className="mt-0.5 text-xs text-slate-500">Paso {step + 1} de {STEPS.length} · {STEPS[step]}</p>
              </div>
              <span className="text-xs font-semibold tabular-nums text-emerald-800">{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la ficha">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-2">
              {STEPS.map((title, index) => (
                <button
                  type="button"
                  key={title}
                  onClick={() => setStep(index)}
                  className={`rounded-lg px-1.5 py-2 text-[10px] font-semibold leading-tight sm:px-2.5 sm:text-xs ${step === index ? "bg-emerald-700 text-white" : index < step ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                  aria-current={step === index ? "step" : undefined}
                >
                  <span className="mr-1 hidden sm:inline">{index + 1}.</span>{title}
                </button>
              ))}
            </div>
          </Card>

          {step === 0 && (
            <Card>
              <SectionTitle
                eyebrow="01 · Propósito"
                title="Partir del cambio que buscas"
                detail="Elige un modelo en la barra lateral, personaliza el nombre y el cambio principal, y adapta el resto de la ficha. Los demás propósitos pueden acompañar la propuesta como secundarios."
              />
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-950">
                El modelo {draft.primaryPurpose} precarga brechas, componentes, actividades, recursos, indicadores, supuestos y continuidad. Revisa cada sugerencia frente al territorio y la oportunidad; puedes cambiarla o agregar opciones propias.
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-sm"><Target className="h-5 w-5" /></span>
                  <div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-800">Propósito principal · {draft.primaryPurpose}</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">{purposeTitle}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{draft.purposeObjective}</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Puede encajar</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{activeTemplate.fit}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Requiere definir</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{activeTemplate.define}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Cuidado al medir</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{activeTemplate.measurementNote}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Input label="Nombre del propósito principal · editable" value={draft.purposeTitle} onChange={(event) => patch("purposeTitle", event.target.value)} placeholder={activeTemplate.title} help={`El contenido precargado conserva el modelo ${draft.primaryPurpose}; puedes adaptar este nombre al proyecto.`} />
                <Textarea label="Cambio que busca el proyecto · editable" value={draft.purposeObjective} onChange={(event) => patch("purposeObjective", event.target.value)} rows={3} help="Ajusta el propósito al resultado central que persigue esta intervención." />
              </div>
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-bold text-slate-800">¿Qué otros propósitos acompañan al principal?</h3>
                <p className="mb-3 text-xs text-slate-500">Opcional. Selecciona solo los que el proyecto realmente persigue.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {secondaryPurposeOptions.map((purpose) => (
                    <CheckOption key={purpose} title={purpose} checked={selectedSecondary.includes(purpose)} onChange={() => patch("secondaryPurposes", toggleValue(selectedSecondary, purpose))} />
                  ))}
                </div>
                <CustomOptionAdder label="Agregar otro propósito secundario" onAdd={(value) => {
                  if (secondaryPurposeOptions.includes(value)) return;
                  setCustomSecondaryPurposes((previous) => [...previous, value]);
                  patch("secondaryPurposes", [...selectedSecondary, value]);
                }} />
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <SectionTitle
                eyebrow="02 · Oportunidad"
                title="Relacionar la ficha con una convocatoria o fondo"
                detail="Registra la fuente para orientar la adaptación. Puedes adjuntar términos de referencia, formularios, presupuestos o documentos de la oportunidad."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Nombre de la convocatoria o fondo" value={draft.opportunityTitle} onChange={(event) => patch("opportunityTitle", event.target.value)} placeholder="Ej. Convocatoria de seguridad alimentaria 2026" />
                <Input label="Organización o fuente de la oportunidad" value={draft.opportunitySource} onChange={(event) => patch("opportunitySource", event.target.value)} placeholder="Agencia, fundación, empresa, fondo…" />
                <Input label="Enlace de consulta" type="url" value={draft.opportunityUrl} onChange={(event) => patch("opportunityUrl", event.target.value)} placeholder="https://…" />
                <Input label="Fecha límite de postulación" type="date" value={draft.opportunityDeadline} onChange={(event) => patch("opportunityDeadline", event.target.value)} />
              </div>
              <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-sm"><Paperclip className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900">Documentos de referencia</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">Adjunta las bases, términos de referencia, anexos, formatos o lineamientos del financiador. Se relacionarán con la ficha para tenerlos presentes al personalizarla.</p>
                    <label htmlFor="p1-opportunity-files" className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                      <Plus className="h-4 w-4" /> Adjuntar documentos
                    </label>
                    <input id="p1-opportunity-files" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt" className="sr-only" onChange={(event) => { addOpportunityDocuments(event.target.files); event.target.value = ""; }} />
                  </div>
                </div>
                {opportunityDocuments.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {opportunityDocuments.map(({ id, file }) => (
                      <li key={id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-medium text-slate-800">{file.name}<span className="ml-2 text-xs font-normal text-slate-500">{Math.max(1, Math.round(file.size / 1024))} KB</span></span>
                        <button type="button" onClick={() => setOpportunityDocuments((previous) => previous.filter((item) => item.id !== id))} aria-label={`Quitar documento ${file.name}`} className="shrink-0 rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"><X className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Los documentos solo se relacionan por nombre en esta sesión; no se suben ni se incorporan a la descarga. La ficha descargada incluye los nombres y los datos registrados de la oportunidad.</p>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <SectionTitle
                eyebrow="03 · Contexto y población"
                title="Aterrizar la propuesta"
                detail={`La ficha parte con una población de referencia y catálogos sugeridos para ${draft.primaryPurpose}. Confirma o ajusta las selecciones con la convocatoria y el diagnóstico territorial; no registres aquí datos personales.`}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Territorio de referencia" value={draft.territory} onChange={(event) => patch("territory", event.target.value)} placeholder="Municipio, región o comunidad" />
                <Input label="Organización interesada · nombre" value={draft.organization} onChange={(event) => patch("organization", event.target.value)} placeholder="Nombre de la organización aliada" />
                <Input label="Número estimado de hogares" type="number" min="0" value={draft.households} onChange={(event) => patch("households", event.target.value)} placeholder="Por definir" />
                <Select label="Tipo de organización interesada" value={draft.organizationType} onChange={(event) => patch("organizationType", event.target.value)}>
                  <option value="">Selecciona un tipo</option>
                  {organizationTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
              </div>
              <CustomOptionAdder label="Agregar otro tipo de organización" placeholder="Escribe otro tipo de organización" onAdd={(value) => {
                if (organizationTypeOptions.includes(value)) return;
                setCustomOrganizationTypes((previous) => [...previous, value]);
                patch("organizationType", value);
              }} />
              <div className="mt-6">
                <h3 className="mb-1 text-sm font-bold text-slate-800">Población priorizada</h3>
                <p className="mb-3 text-xs text-slate-500">Selecciona uno o varios grupos y adáptalos a la población que prioriza el proyecto.</p>
                <div className="grid gap-2 lg:grid-cols-2">
                  {populationGroupOptions.map((group) => (
                    <CheckOption key={group.id} title={group.title} detail={group.detail} checked={draft.populationGroups.includes(group.id)} onChange={() => patch("populationGroups", toggleValue(draft.populationGroups, group.id))} />
                  ))}
                </div>
                <CustomOptionAdder label="Agregar otro grupo poblacional" placeholder="Escribe otro grupo poblacional" onAdd={(value) => {
                  if (populationGroupOptions.some((item) => item.title.toLowerCase() === value.toLowerCase())) return;
                  const option = createCustomOption("population", value);
                  setCustomPopulationGroups((previous) => [...previous, option]);
                  patch("populationGroups", [...draft.populationGroups, option.id]);
                }} />
                <div className="mt-3"><Textarea label="Precisiones sobre la población y el territorio" value={draft.populationNotes} onChange={(event) => patch("populationNotes", event.target.value)} placeholder="Rangos de edad, veredas, pertenencia o condiciones específicas que defina esta convocatoria…" rows={2} /></div>
              </div>
              <div className="mt-6">
                <h3 className="mb-1 text-sm font-bold text-slate-800">Criterios de priorización y diferenciación</h3>
                <p className="mb-3 text-xs text-slate-500">Elige solo los criterios que la organización pueda justificar y aplicar de forma transparente. Revisa la pertinencia y el riesgo de exclusión.</p>
                <div className="grid gap-2 lg:grid-cols-2">
                  {priorityCriteriaOptions.map((criterion) => (
                    <CheckOption key={criterion.id} title={criterion.title} detail={criterion.detail} checked={draft.priorityCriteria.includes(criterion.id)} onChange={() => patch("priorityCriteria", toggleValue(draft.priorityCriteria, criterion.id))} />
                  ))}
                </div>
                <CustomOptionAdder label="Agregar otro criterio de priorización" placeholder="Escribe otro criterio" onAdd={(value) => {
                  if (priorityCriteriaOptions.some((item) => item.title.toLowerCase() === value.toLowerCase())) return;
                  const option = createCustomOption("priority", value);
                  setCustomPriorityCriteria((previous) => [...previous, option]);
                  patch("priorityCriteria", [...draft.priorityCriteria, option.id]);
                }} />
                <div className="mt-3"><Textarea label="Cómo se aplicarán estos criterios" value={draft.priorityNotes} onChange={(event) => patch("priorityNotes", event.target.value)} placeholder="Fuentes de verificación, reglas de selección, ponderación o mecanismo comunitario…" rows={2} /></div>
              </div>
              <div className="mt-6">
                <h3 className="mb-1 text-sm font-bold text-slate-800">Situaciones o brechas que busca atender</h3>
                <p className="mb-3 text-xs text-slate-500">Selección inicial sugerida para {draft.primaryPurpose}. Combina las opciones pertinentes y complétalas con evidencia del territorio.</p>
                <div className="grid gap-2 lg:grid-cols-2">
                  {foodGapOptions.map((gap) => (
                    <CheckOption key={gap.id} title={gap.title} detail={gap.detail} checked={draft.selectedBreaches.includes(gap.id)} onChange={() => patch("selectedBreaches", toggleValue(draft.selectedBreaches, gap.id))} />
                  ))}
                </div>
                <CustomOptionAdder label="Agregar otra situación o brecha" placeholder="Escribe otra situación o brecha" onAdd={(value) => {
                  if (foodGapOptions.some((item) => item.title.toLowerCase() === value.toLowerCase())) return;
                  const option = createCustomOption("gap", value);
                  setCustomBreaches((previous) => [...previous, option]);
                  patch("selectedBreaches", [...draft.selectedBreaches, option.id]);
                }} />
                <div className="mt-3"><Textarea label="Evidencia o notas territoriales" value={draft.context} onChange={(event) => patch("context", event.target.value)} placeholder="¿Qué información respalda estas brechas? ¿Qué falta validar con los hogares o fuentes locales?" rows={3} /></div>
              </div>
              <div className="mt-6">
                <h3 className="mb-1 text-sm font-bold text-slate-800">Perfiles de beneficiarios de referencia</h3>
                <p className="mb-3 text-xs text-slate-500">Se pueden elegir varios. Ajusta después cada perfil a las características del territorio.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {beneficiaryProfileOptions.map((profile) => (
                    <CheckOption key={profile} title={profile} checked={draft.profiles.includes(profile)} onChange={() => patch("profiles", toggleValue(draft.profiles, profile))} />
                  ))}
                </div>
                <CustomOptionAdder label="Agregar otro perfil de beneficiario" onAdd={(value) => {
                  if (beneficiaryProfileOptions.some((item) => item.toLowerCase() === value.toLowerCase())) return;
                  setCustomProfiles((previous) => [...previous, value]);
                  patch("profiles", [...draft.profiles, value]);
                }} />
              </div>
              <div className="mt-6">
                <h3 className="mb-1 text-sm font-bold text-slate-800">¿Quién podría usar los registros?</h3>
                <p className="mb-3 text-xs text-slate-500">La persona beneficiaria, quien opera la producción y quien registra pueden ser diferentes.</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {actorRoleOptions.map((role) => (
                    <CheckOption key={role} title={role} checked={draft.actorRoles.includes(role)} onChange={() => patch("actorRoles", toggleValue(draft.actorRoles, role))} />
                  ))}
                </div>
                <CustomOptionAdder label="Agregar otro perfil de usuario o actor" onAdd={(value) => {
                  if (actorRoleOptions.some((item) => item.toLowerCase() === value.toLowerCase())) return;
                  setCustomActorRoles((previous) => [...previous, value]);
                  patch("actorRoles", [...draft.actorRoles, value]);
                }} />
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <SectionTitle
                eyebrow="04 · Intervención"
                title="Definir los componentes del proyecto"
                detail="La actividad animal puede ser una parte de una intervención más amplia. Selecciona apoyos que tengan sentido para la población y el territorio."
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {projectComponentOptions.map((component) => {
                  const Icon = component.icon;
                  return (
                    <button key={component.name} type="button" onClick={() => patch("components", toggleValue(draft.components, component.name))} aria-pressed={draft.components.includes(component.name)} className={`flex items-center gap-3 rounded-xl border p-3.5 text-left ${draft.components.includes(component.name) ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
                      <Icon className="h-4 w-4 shrink-0 text-emerald-800" />
                      <span className="flex-1 text-sm font-semibold text-slate-800">{component.name}</span>
                      {draft.components.includes(component.name) && <Check className="h-4 w-4 text-emerald-700" />}
                    </button>
                  );
                })}
              </div>
              <CustomOptionAdder label="Agregar otro componente de intervención" onAdd={(value) => {
                if (projectComponentOptions.some((item) => item.name.toLowerCase() === value.toLowerCase())) return;
                setCustomComponents((previous) => [...previous, { name: value, icon: Users }]);
                patch("components", [...draft.components, value]);
              }} />

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-2xl">
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500">Herramienta digital posible</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">IwaGranja, como apoyo dentro de la intervención</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">Su inclusión depende del encaje con las actividades, las capacidades de los usuarios y el acompañamiento disponible.</p>
                  </div>
                  <button type="button" aria-pressed={draft.includeIwagrana} onClick={() => patch("includeIwagrana", !draft.includeIwagrana)} className={`rounded-lg px-3 py-2 text-xs font-bold ${draft.includeIwagrana ? "bg-emerald-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
                    {draft.includeIwagrana ? "Considerarla en esta ficha · Sí" : "Considerarla en esta ficha · No"}
                  </button>
                </div>
                {draft.includeIwagrana && (
                  <div className="mt-4">
                    <Textarea label="Aporte posible en esta propuesta" value={draft.iwagranaContribution} onChange={(event) => patch("iwagranaContribution", event.target.value)} rows={4} help="Personaliza este texto según los componentes y capacidades que realmente se incluirían." />
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-950">
                      <Info className="mr-1 inline h-3.5 w-3.5" /> La app puede organizar registros de producción y destino. Los resultados alimentarios dependen del conjunto de la intervención y de su medición.
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <Textarea label="Otras herramientas o apoyos que integrarían el proyecto" value={draft.otherTools} onChange={(event) => patch("otherTools", event.target.value)} placeholder="Asistencia técnica, formación, acceso a insumos, instrumentos de medición u otros recursos…" rows={3} />
                </div>
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <SectionTitle
                eyebrow="05 · Plan y medición"
                title="Trazar los primeros pasos"
                detail="Cada fase presenta primero las actividades, después los recursos clave y luego el responsable y el tiempo. Ajusta el orden y el contenido a las condiciones de implementación."
              />
              <div className="space-y-3">
                {draft.phases.map((phase, index) => {
                  const activityCatalog = PHASE_ACTIVITY_CATALOG[phase.id] ?? PHASE_ACTIVITY_CATALOG.custom;
                  const resourceCatalog = PHASE_RESOURCE_CATALOG[phase.id] ?? PHASE_RESOURCE_CATALOG.custom;
                  return (
                    <div key={phase.id} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">{index + 1}</span>
                        <input aria-label={`Nombre de la fase ${index + 1}`} value={phase.title} onChange={(event) => setPhase(index, "title", event.target.value)} className="min-w-0 flex-1 border-b border-slate-200 bg-transparent py-1 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none" />
                        {index >= 4 && <button type="button" onClick={() => setDraft((previous) => ({ ...previous, phases: previous.phases.filter((_, currentIndex) => currentIndex !== index) }))} className="shrink-0 text-xs font-semibold text-red-700 hover:underline">Eliminar fase</button>}
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                          <CatalogItemPicker label="1. Actividades de esta fase · agrega una por una" catalog={activityCatalog} items={phase.activities} customOptions={phase.customActivities} onCustomOptionsChange={(items) => setPhase(index, "customActivities", items)} onChange={(items) => setPhase(index, "activities", items)} emptyLabel="Aún no hay actividades seleccionadas." />
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                          <CatalogItemPicker label="2. Recursos o apoyos clave · agrega uno por uno" catalog={resourceCatalog} items={phase.resources} customOptions={phase.customResources} onCustomOptionsChange={(items) => setPhase(index, "customResources", items)} onChange={(items) => setPhase(index, "resources", items)} emptyLabel="Aún no hay recursos seleccionados." />
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                          <Input label="3. Responsable" value={phase.owner} onChange={(event) => setPhase(index, "owner", event.target.value)} placeholder="Persona, equipo u organización responsable" />
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                          <Select label="4. Tiempo estimado" value={phase.timing} onChange={(event) => setPhase(index, "timing", event.target.value)}>
                            {timingOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                          </Select>
                          {phase.timing === "Personalizado" && <Input label="Especifica la duración" value={phase.customTiming} onChange={(event) => setPhase(index, "customTiming", event.target.value)} placeholder="Ej. 5 semanas" className="mt-2" />}
                          <CustomOptionAdder label="Agregar otra duración al catálogo" placeholder="Ej. 5 semanas" onAdd={(value) => {
                            if (timingOptions.some((item) => item.toLowerCase() === value.toLowerCase())) return;
                            setCustomTimings((previous) => [...previous, value]);
                            setPhase(index, "timing", value);
                          }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button type="button" variant="secondary" onClick={addPhase} className="mt-3 inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Agregar fase al plan</Button>

              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-3 flex items-start gap-2">
                    <BarChart3 className="mt-0.5 h-4 w-4 text-emerald-800" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Resultados del proyecto</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">El proyecto define instrumento, línea base, metas y método.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {projectIndicatorOptions.map((item) => (
                      <CheckOption key={item.id} title={item.title} detail={item.detail} checked={draft.projectIndicators.includes(item.id)} onChange={() => patch("projectIndicators", toggleValue(draft.projectIndicators, item.id))} />
                    ))}
                  </div>
                  <CustomOptionAdder label="Agregar otro indicador de resultado del proyecto" placeholder="Escribe el indicador" onAdd={(value) => {
                    if (projectIndicatorOptions.some((item) => item.title.toLowerCase() === value.toLowerCase())) return;
                    const option = createCustomOption("project-indicator", value);
                    setCustomProjectIndicators((previous) => [...previous, option]);
                    patch("projectIndicators", [...draft.projectIndicators, option.id]);
                  }} />
                </div>
                <div>
                  <div className="mb-3 flex items-start gap-2">
                    <ClipboardList className="mt-0.5 h-4 w-4 text-blue-800" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Uso de IwaGranja</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Indicadores aparte; se incluyen si la herramienta se integra al proyecto.</p>
                    </div>
                  </div>
                  {draft.includeIwagrana ? (
                    <div className="space-y-2">
                      {platformIndicatorOptions.map((item) => (
                        <CheckOption key={item.id} title={item.title} checked={draft.platformIndicators.includes(item.id)} onChange={() => patch("platformIndicators", toggleValue(draft.platformIndicators, item.id))} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No se mostrarán indicadores de uso porque IwaGranja no está incluida en esta propuesta.</div>
                  )}
                  {draft.includeIwagrana && <CustomOptionAdder label="Agregar otro indicador de uso de IwaGranja" placeholder="Escribe el indicador de uso" onAdd={(value) => {
                    if (platformIndicatorOptions.some((item) => item.title.toLowerCase() === value.toLowerCase())) return;
                    const option = { id: catalogOptionId("platform-indicator", value), title: value };
                    setCustomPlatformIndicators((previous) => [...previous, option]);
                    patch("platformIndicators", [...draft.platformIndicators, option.id]);
                  }} />}
                </div>
              </div>
              <div className="mt-7">
                <SectionTitle eyebrow="Supuestos" title="¿Qué condiciones deben cumplirse?" detail="Los supuestos son condiciones externas o capacidades necesarias, no resultados garantizados. Selecciona los que el proyecto debe validar y monitorear." />
                <div className="grid gap-2 lg:grid-cols-2">
                  {projectAssumptionOptions.map((item) => (
                    <CheckOption key={item.id} title={item.title} detail={item.detail} checked={draft.projectAssumptions.includes(item.id)} onChange={() => patch("projectAssumptions", toggleValue(draft.projectAssumptions, item.id))} />
                  ))}
                </div>
                <CustomOptionAdder label="Agregar otro supuesto que deba validarse" placeholder="Escribe una condición o supuesto" onAdd={(value) => {
                  if (projectAssumptionOptions.some((item) => item.title.toLowerCase() === value.toLowerCase())) return;
                  const option = createCustomOption("assumption", value);
                  setCustomAssumptions((previous) => [...previous, option]);
                  patch("projectAssumptions", [...draft.projectAssumptions, option.id]);
                }} />
              </div>
              <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5">
                <SectionTitle eyebrow="Continuidad después del proyecto" title="Preparar qué seguirá funcionando" detail="Selecciona acciones concretas para sostener capacidades y resultados cuando termine el financiamiento. Ajusta responsables y recursos antes de cerrar la propuesta." />
                <CatalogItemPicker label="Acciones de continuidad · agrega una por una" catalog={CONTINUITY_ACTIONS} items={draft.continuityActions} customOptions={draft.customContinuityActions} onCustomOptionsChange={(items) => patch("customContinuityActions", items)} onChange={(items) => patch("continuityActions", items)} emptyLabel="Aún no hay acciones seleccionadas." />
                <div className="mt-4">
                  <Textarea label="Acuerdos, responsables y recursos de continuidad" value={draft.continuityNotes} onChange={(event) => patch("continuityNotes", event.target.value)} rows={3} placeholder="¿Quién se compromete, con qué recursos y desde cuándo?" help="Aterriza las acciones elegidas con compromisos verificables de la organización y los participantes." />
                </div>
              </div>
            </Card>
          )}

          {step === 5 && (
            <Card>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <SectionTitle eyebrow="06 · Revisión" title="Ficha lista para adaptar y compartir" detail="Revisa el modelo, personaliza lo necesario y descarga una copia cuidada para conversar con un posible aliado." />
                <div className="flex flex-wrap gap-2 print:hidden">
                  <Button type="button" variant="secondary" onClick={downloadProjectSheet} className="inline-flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" /> Descargar ficha HTML</Button>
                  <Button type="button" onClick={handlePrint} className="inline-flex items-center gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
                </div>
              </div>
              <article id="iwagrana-project-sheet-preview" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                <header className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-lime-800 px-5 py-6 text-white sm:px-7 sm:py-8">
                  <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full border border-white/15 shadow-[0_0_0_26px_rgba(255,255,255,0.04),0_0_0_54px_rgba(255,255,255,0.03)]" />
                  <p className="relative font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">Diseño de Proyectos Rurales con Producción Animal · Modelo {draft.primaryPurpose}</p>
                  <h2 className="relative mt-2 max-w-3xl text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">{purposeTitle}</h2>
                  <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-emerald-50">{activeTemplate.objective}</p>
                  <div className="relative mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-white/90">
                    <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">{draft.organization || "Organización por definir"}</span>
                    <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">{draft.territory || "Territorio por definir"}</span>
                    <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">Ficha personalizable</span>
                  </div>
                  {draft.secondaryPurposes.length > 0 && <p className="relative mt-3 text-xs text-emerald-50"><strong>Propósitos secundarios:</strong> {draft.secondaryPurposes.join(" · ")}</p>}
                </header>

                <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-5">
                  <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm sm:col-span-2">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-100 text-xs font-extrabold text-emerald-900">01</span><h3 className="text-sm font-bold text-slate-900">Contexto y población</h3></div>
                    <dl className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Organización interesada</dt><dd className="mt-0.5 text-sm font-semibold text-slate-800">{draft.organization || "Por definir"}{draft.organizationType ? ` · ${draft.organizationType}` : ""}</dd></div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Territorio · hogares</dt><dd className="mt-0.5 text-sm font-semibold text-slate-800">{draft.territory || "Por definir"} · {draft.households || "hogares por estimar"}</dd></div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Grupos poblacionales</dt><dd className="mt-0.5 text-sm text-slate-800">{populationGroupOptions.filter((item) => draft.populationGroups.includes(item.id)).map((item) => item.title).join(" · ") || "Por definir"}</dd></div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Criterios de priorización</dt><dd className="mt-0.5 text-sm text-slate-800">{priorityCriteriaOptions.filter((item) => draft.priorityCriteria.includes(item.id)).map((item) => item.title).join(" · ") || "Por definir"}</dd></div>
                    </dl>
                    {draft.populationNotes && <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-600"><strong>Precisiones:</strong> {draft.populationNotes}</p>}
                    {draft.priorityNotes && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600"><strong>Aplicación de criterios:</strong> {draft.priorityNotes}</p>}
                    <p className="mt-2 text-xs leading-relaxed text-slate-600"><strong>Perfiles:</strong> {draft.profiles.join(" · ") || "Por definir"} <span className="px-1 text-slate-300">|</span> <strong>Posibles usuarios de registros:</strong> {draft.actorRoles.join(" · ") || "Por definir"}</p>
                  </section>

                  <section className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-xs font-extrabold text-amber-900">02</span><h3 className="text-sm font-bold text-slate-900">Situaciones y brechas</h3></div>
                    {foodGapOptions.filter((item) => draft.selectedBreaches.includes(item.id)).length ? <ul className="space-y-2">{foodGapOptions.filter((item) => draft.selectedBreaches.includes(item.id)).map((item) => <li key={item.id} className="rounded-lg bg-amber-50/70 px-3 py-2"><p className="text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{item.detail}</p></li>)}</ul> : <p className="text-sm text-slate-500">Brechas por definir.</p>}
                    <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-slate-600">{draft.context || "Evidencia y notas territoriales pendientes de precisar."}</p>
                  </section>

                  <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-100 text-xs font-extrabold text-blue-900">03</span><h3 className="text-sm font-bold text-slate-900">Convocatoria relacionada</h3></div>
                    <dl className="space-y-2 text-xs">
                      <div><dt className="font-semibold text-slate-500">Nombre · fuente</dt><dd className="text-slate-800">{draft.opportunityTitle || "Por definir"} · {draft.opportunitySource || "Fuente por definir"}</dd></div>
                      <div><dt className="font-semibold text-slate-500">Fecha límite · enlace</dt><dd className="break-all text-slate-800">{draft.opportunityDeadline || "Por definir"} · {draft.opportunityUrl || "Enlace por definir"}</dd></div>
                    </dl>
                    <p className="mt-3 text-[11px] font-semibold text-slate-700">Documentos relacionados</p>
                    {opportunityDocuments.length ? <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">{opportunityDocuments.map(({ id, file }) => <li key={id}>{file.name}</li>)}</ul> : <p className="mt-1 text-xs text-slate-500">Ninguno adjunto en esta sesión.</p>}
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-800">04</span><h3 className="text-sm font-bold text-slate-900">Componentes de intervención</h3></div>
                    {draft.components.length ? <ul className="space-y-1.5 text-xs text-slate-700">{draft.components.map((component) => <li key={component} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />{component}</li>)}</ul> : <p className="text-sm text-slate-500">Por definir.</p>}
                    {draft.otherTools && <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700"><strong>Otros apoyos:</strong> {draft.otherTools}</p>}
                  </section>

                  <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-700 text-xs font-extrabold text-white">05</span><h3 className="text-sm font-bold text-slate-900">Aporte posible de IwaGranja</h3></div>
                    <p className="text-xs leading-relaxed text-slate-700">{draft.includeIwagrana ? draft.iwagranaContribution : "IwaGranja no se contempla en esta versión de la propuesta."}</p>
                  </section>

                  <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm sm:col-span-2">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-100 text-xs font-extrabold text-emerald-900">06</span><div><h3 className="text-sm font-bold text-slate-900">Plan de implementación</h3><p className="text-[11px] text-slate-500">En cada fase: actividades → recursos clave → responsable → tiempo.</p></div></div>
                    <div className="space-y-3">{draft.phases.map((phase, index) => <div key={phase.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                      <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-800 text-xs font-bold text-white">{index + 1}</span><h4 className="text-sm font-bold text-slate-900">{phase.title || "Fase por nombrar"}</h4></div>
                      <div className="space-y-2.5">
                        <div className="rounded-lg border-l-2 border-emerald-500 bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Actividades</p>{phase.activities.length ? <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">{phase.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul> : <p className="mt-1 text-xs text-slate-500">Por definir</p>}</div>
                        <div className="rounded-lg border-l-2 border-blue-400 bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-800">Recursos o apoyos clave</p>{phase.resources.length ? <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">{phase.resources.map((resource) => <li key={resource}>{resource}</li>)}</ul> : <p className="mt-1 text-xs text-slate-500">Por definir</p>}</div>
                        <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Responsable</p><p className="mt-0.5 text-xs font-medium text-slate-800">{phase.owner || "Por definir"}</p></div>
                        <div className="rounded-lg bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tiempo estimado</p><p className="mt-0.5 text-xs font-medium text-slate-800">{phase.timing === "Personalizado" ? (phase.customTiming || "Por definir") : (phase.timing || "Por definir")}</p></div>
                      </div>
                    </div>)}</div>
                  </section>

                  <section className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-100 text-xs font-extrabold text-teal-900">07</span><h3 className="text-sm font-bold text-slate-900">Resultados del proyecto</h3></div>
                    <p className="mb-2 text-[11px] leading-relaxed text-slate-500">El proyecto define línea base, metas, método e instrumento.</p>
                    {projectIndicatorOptions.filter((item) => draft.projectIndicators.includes(item.id)).length ? <ul className="space-y-2">{projectIndicatorOptions.filter((item) => draft.projectIndicators.includes(item.id)).map((item) => <li key={item.id}><p className="text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{item.detail}</p></li>)}</ul> : <p className="text-sm text-slate-500">Indicadores por definir.</p>}
                  </section>
                  <section className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-100 text-xs font-extrabold text-indigo-900">08</span><h3 className="text-sm font-bold text-slate-900">Uso de IwaGranja</h3></div>
                    <p className="mb-2 text-[11px] leading-relaxed text-slate-500">Datos de uso de la herramienta, separados de los resultados del proyecto.</p>
                    {draft.includeIwagrana ? <ul className="space-y-1.5 text-xs text-slate-700">{platformIndicatorOptions.filter((item) => draft.platformIndicators.includes(item.id)).map((item) => <li key={item.id} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />{item.title}</li>)}</ul> : <p className="text-sm text-slate-500">No se incluyen indicadores de uso.</p>}
                  </section>

                  <section className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-100 text-xs font-extrabold text-amber-900">09</span><h3 className="text-sm font-bold text-slate-900">Supuestos por validar</h3></div>
                    {projectAssumptionOptions.filter((item) => draft.projectAssumptions.includes(item.id)).length ? <ul className="space-y-2">{projectAssumptionOptions.filter((item) => draft.projectAssumptions.includes(item.id)).map((item) => <li key={item.id}><p className="text-xs font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{item.detail}</p></li>)}</ul> : <p className="text-sm text-slate-500">Supuestos por definir.</p>}
                  </section>
                  <section className="rounded-xl border border-lime-100 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-lime-100 text-xs font-extrabold text-lime-900">10</span><h3 className="text-sm font-bold text-slate-900">Continuidad</h3></div>
                    {draft.continuityActions.length ? <ul className="space-y-1.5 text-xs text-slate-700">{draft.continuityActions.map((action) => <li key={action} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-700" />{action}</li>)}</ul> : <p className="text-sm text-slate-500">Acciones por definir.</p>}
                    <p className="mt-3 whitespace-pre-line rounded-lg bg-lime-50 p-2.5 text-xs leading-relaxed text-slate-700">{draft.continuityNotes || "Acuerdos, responsables y recursos pendientes de definir."}</p>
                  </section>
                </div>
                <footer className="border-t border-slate-200 bg-white px-5 py-4 text-[11px] leading-relaxed text-slate-500 sm:px-7"><strong className="text-slate-700">Diseño de Proyectos Rurales con Producción Animal · IwaGranja.</strong> Ficha inicial, editable y sujeta a validación territorial. No constituye por sí sola una propuesta técnica, financiera ni una medición de resultados. {activeTemplate.measurementNote}</footer>
              </article>
              <div className="mt-5 rounded-2xl bg-emerald-50 p-4 sm:p-5 print:hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">¿Quieres desarrollar la propuesta con acompañamiento?</h3>
                    <p className="mt-1 text-sm text-slate-700">Podemos conversar sobre la formulación y una posible implementación con tu organización.</p>
                  </div>
                  <Link href="/contacto" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Conversar sobre esta idea <ArrowRight className="h-4 w-4" /></Link>
                </div>
              </div>
              {notice && <p role="status" className="mt-3 text-xs text-emerald-800 print:hidden">{notice}</p>}
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <Button type="button" variant="secondary" disabled={step === 0} onClick={() => { setStep((current) => Math.max(0, current - 1)); setNotice(""); }} className="inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Anterior</Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => { setStep((current) => Math.min(STEPS.length - 1, current + 1)); setNotice(""); }} className="inline-flex items-center gap-2">Continuar <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setStep(0)} className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Editar desde el inicio</Button>
            )}
          </div>
        </section>

        <aside className="order-first space-y-3 xl:sticky xl:top-4 xl:order-last xl:self-start print:hidden">
          <Card className="!p-3 sm:!p-4">
            <div className="mb-3 flex items-start gap-2">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" />
              <div><h2 className="text-sm font-bold text-slate-900">Modelos por propósito</h2><p className="mt-0.5 text-[11px] leading-snug text-slate-500">Elige el cambio principal. Se cargará una base distinta para brechas, plan, medición y continuidad.</p></div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
              {purposeTemplates.map((template) => {
                const selected = template.id === draft.primaryPurpose;
                return (
                  <button key={template.id} type="button" aria-pressed={selected} onClick={() => selectPurposeTemplate(template.id)} className={`group w-full rounded-lg border px-2.5 py-2 text-left transition-all ${selected ? "border-emerald-600 bg-emerald-50 shadow-sm ring-1 ring-emerald-100" : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50"}`}>
                    <span className="flex items-center gap-2"><span className={`grid h-6 w-7 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold ${selected ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-900"}`}>{template.id}</span><span className="text-[11px] font-semibold leading-tight text-slate-800">{template.title}</span>{selected && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-700" />}</span>
                    <span className="mt-1 block pl-9 text-[10px] leading-snug text-slate-500 line-clamp-2">{template.objective}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] leading-relaxed text-slate-500">Al cambiar, el formulario conserva organización, población, territorio y convocatoria; reemplaza las selecciones del modelo y su plan inicial.</p>
          </Card>
          {notice && step !== 5 && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-900">{notice}</p>}
        </aside>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #iwagrana-project-sheet-preview, #iwagrana-project-sheet-preview * { visibility: visible !important; }
          #iwagrana-project-sheet-preview { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0; padding: 0; box-shadow: none; }
          #iwagrana-project-sheet-preview section { break-inside: avoid; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>
    </div>
  );
}
