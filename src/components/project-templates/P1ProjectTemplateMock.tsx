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

const SECONDARY_PURPOSES = [
  "Diversificación de medios de vida",
  "Consolidación productiva e ingreso neto",
  "Sanidad y continuidad productiva",
  "Extensión y adopción de prácticas",
  "Organización productiva y mercados locales",
  "Producción circular y uso eficiente de recursos",
];

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
  ],
  readiness: [
    "Devolver hallazgos del diagnóstico y validar prioridades con los hogares",
    "Diseñar un plan productivo y alimentario por hogar o grupo",
    "Formar en bienestar animal, bioseguridad, alimentación y manejo",
    "Acordar roles, rutinas de cuidado y distribución del trabajo",
    "Preparar espacios, equipos y condiciones para recibir animales o insumos",
    "Capacitar al equipo y participantes en registros sencillos",
    "Acordar ruta de asistencia técnica y atención de alertas",
  ],
  implementation: [
    "Realizar visitas de asistencia técnica y seguimiento productivo",
    "Implementar mejoras de alojamiento, agua, alimentación y bienestar",
    "Entregar o gestionar animales e insumos conforme al plan técnico",
    "Aplicar medidas preventivas y ruta de atención sanitaria competente",
    "Acompañar registros de producción, autoconsumo, ventas y pérdidas",
    "Desarrollar actividades de educación alimentaria acordadas",
    "Revisar periódicamente avances y ajustar los apoyos",
  ],
  followup: [
    "Revisar registros y necesidades de apoyo con cada hogar o grupo",
    "Realizar medición intermedia y comparar con la línea base",
    "Ajustar el plan productivo ante cambios, riesgos o interrupciones",
    "Sistematizar aprendizajes, costos, barreras y prácticas útiles",
    "Acordar responsables, recursos y servicios para dar continuidad",
    "Realizar medición final con el instrumento definido por el proyecto",
    "Socializar resultados y validar conclusiones con los participantes",
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
  ],
  readiness: [
    "Profesional de asistencia técnica pecuaria",
    "Facilitador/a con experiencia comunitaria",
    "Material pedagógico y elementos de demostración",
    "Transporte, alimentación y logística de formación",
    "Mejoras de alojamiento, agua o bioseguridad",
    "Dispositivos, conectividad o alternativas de registro sin conexión",
    "Accesibilidad, traducción o interpretación según necesidad",
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
  ],
  followup: [
    "Equipo responsable de seguimiento y medición",
    "Instrumento de evaluación y materiales de registro",
    "Transporte y viáticos para visitas de cierre",
    "Espacio y logística para devolución de resultados",
    "Recursos para continuidad de asistencia técnica",
    "Acceso a IwaGranja y soporte acordado, si aplica",
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
type ProjectDraft = {
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
  secondaryPurposes: [],
  territory: "",
  organization: "",
  organizationType: "",
  households: "",
  populationGroups: ["rural-smallholders"],
  populationNotes: "",
  priorityCriteria: ["food-gap", "rural-location"],
  priorityNotes: "",
  selectedBreaches: ["irregular-access", "seasonal-shortage"],
  context: "",
  profiles: [BENEFICIARY_PROFILES[0]],
  actorRoles: [ACTOR_ROLES[0], ACTOR_ROLES[1]],
  components: [PROJECT_COMPONENTS[0].name, PROJECT_COMPONENTS[1].name],
  includeIwagrana: true,
  iwagranaContribution:
    "Facilitar el registro de la producción y diferenciar lo destinado al hogar, las ventas y otros usos. Esta información puede ayudar al equipo a observar la disponibilidad de alimentos de origen animal; no mide por sí sola el consumo ni el estado nutricional.",
  otherTools: "",
  phases: [
    { id: "diagnosis", title: "Preparación y diagnóstico", activities: [PHASE_ACTIVITY_CATALOG.diagnosis[0], PHASE_ACTIVITY_CATALOG.diagnosis[2]], customActivities: [], owner: "Equipo formulador y facilitador/a local", timing: "2–4 semanas", customTiming: "", resources: [PHASE_RESOURCE_CATALOG.diagnosis[0], PHASE_RESOURCE_CATALOG.diagnosis[2], PHASE_RESOURCE_CATALOG.diagnosis[3]], customResources: [] },
    { id: "readiness", title: "Alistamiento y formación", activities: [PHASE_ACTIVITY_CATALOG.readiness[1], PHASE_ACTIVITY_CATALOG.readiness[5]], customActivities: [], owner: "Equipo técnico y organización aliada", timing: "1–2 meses", customTiming: "", resources: [PHASE_RESOURCE_CATALOG.readiness[0], PHASE_RESOURCE_CATALOG.readiness[2], PHASE_RESOURCE_CATALOG.readiness[5]], customResources: [] },
    { id: "implementation", title: "Acompañamiento e implementación", activities: [PHASE_ACTIVITY_CATALOG.implementation[0], PHASE_ACTIVITY_CATALOG.implementation[4]], customActivities: [], owner: "Equipo de asistencia técnica", timing: "3–6 meses", customTiming: "", resources: [PHASE_RESOURCE_CATALOG.implementation[0], PHASE_RESOURCE_CATALOG.implementation[1], PHASE_RESOURCE_CATALOG.implementation[6]], customResources: [] },
    { id: "followup", title: "Medición y continuidad", activities: [PHASE_ACTIVITY_CATALOG.followup[1], PHASE_ACTIVITY_CATALOG.followup[4]], customActivities: [], owner: "Equipo del proyecto y organización local", timing: "1–2 meses", customTiming: "", resources: [PHASE_RESOURCE_CATALOG.followup[0], PHASE_RESOURCE_CATALOG.followup[1], PHASE_RESOURCE_CATALOG.followup[4]], customResources: [] },
  ],
  projectIndicators: ["autoconsumo", "regularity"],
  projectAssumptions: ["household-interest", "technical-support", "outcome-measurement"],
  platformIndicators: ["active", "complete"],
  continuityActions: [CONTINUITY_ACTIONS[0], CONTINUITY_ACTIONS[1], CONTINUITY_ACTIONS[3], CONTINUITY_ACTIONS[12]],
  customContinuityActions: [],
  continuityNotes: "Definir compromisos, responsables y presupuesto de continuidad con cada organización aliada antes del cierre.",
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
      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
        checked ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white"}`}>
        {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        {detail && <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{detail}</span>}
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

export function P1ProjectTemplateMock({ surface = "app" }: { surface?: "app" | "public" }) {
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
  const selectedSecondary = useMemo(() => draft.secondaryPurposes, [draft.secondaryPurposes]);
  const organizationTypeOptions = [...ORGANIZATION_TYPES, ...customOrganizationTypes];
  const secondaryPurposeOptions = [...SECONDARY_PURPOSES, ...customSecondaryPurposes];
  const beneficiaryProfileOptions = [...BENEFICIARY_PROFILES, ...customProfiles];
  const actorRoleOptions = [...ACTOR_ROLES, ...customActorRoles];
  const projectComponentOptions = [...PROJECT_COMPONENTS, ...customComponents];
  const populationGroupOptions = [...POPULATION_GROUPS, ...customPopulationGroups];
  const priorityCriteriaOptions = [...PRIORITY_CRITERIA, ...customPriorityCriteria];
  const foodGapOptions = [...FOOD_GAPS, ...customBreaches];
  const projectIndicatorOptions = [...PROJECT_INDICATORS, ...customProjectIndicators];
  const platformIndicatorOptions = [...PLATFORM_INDICATORS, ...customPlatformIndicators];
  const projectAssumptionOptions = [...PROJECT_ASSUMPTIONS, ...customAssumptions];
  const timingOptions = [...TIME_OPTIONS, ...customTimings];

  const patch = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
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

  const downloadMarkdown = () => {
    const projectIndicators = projectIndicatorOptions.filter((item) => draft.projectIndicators.includes(item.id));
    const projectAssumptions = projectAssumptionOptions.filter((item) => draft.projectAssumptions.includes(item.id));
    const platformIndicators = platformIndicatorOptions.filter((item) => draft.platformIndicators.includes(item.id));
    const populationGroups = populationGroupOptions.filter((item) => draft.populationGroups.includes(item.id));
    const priorityCriteria = priorityCriteriaOptions.filter((item) => draft.priorityCriteria.includes(item.id));
    const selectedBreaches = foodGapOptions.filter((item) => draft.selectedBreaches.includes(item.id));
    const content = [
      `# Ficha preliminar P1 · Seguridad y autonomía alimentaria`,
      ``,
      `> Borrador personalizable para conversar con un aliado. Requiere validación en el territorio.`,
      ``,
      `## Propósito principal`,
      `Mejorar la disponibilidad de alimentos y el aporte del autoconsumo en los hogares.`,
      ``,
      `## Propósitos secundarios`,
      selectedSecondary.length ? selectedSecondary.map((item) => `- ${item}`).join("\n") : `- No definidos`,
      ``,
      `## Contexto y población`,
      `- Territorio: ${draft.territory || "Por definir"}`,
      `- Organización interesada: ${draft.organization || "Por definir"}`,
      `- Tipo de organización: ${draft.organizationType || "Por definir"}`,
      `- Hogares estimados: ${draft.households || "Por definir"}`,
      `- Grupos poblacionales priorizados: ${populationGroups.map((item) => item.title).join(", ") || "Por definir"}`,
      `- Notas sobre población: ${draft.populationNotes || "Sin notas adicionales"}`,
      `- Criterios de priorización y diferenciación: ${priorityCriteria.map((item) => item.title).join("; ") || "Por definir"}`,
      `- Notas sobre criterios: ${draft.priorityNotes || "Sin notas adicionales"}`,
      `- Perfiles de referencia: ${draft.profiles.join(", ") || "Por definir"}`,
      `- Quiénes usarían los registros: ${draft.actorRoles.join(", ") || "Por definir"}`,
      ``,
      `### Situación que se busca atender`,
      selectedBreaches.length ? selectedBreaches.map((item) => `- ${item.title}: ${item.detail}`).join("\n") : "- Situaciones por definir",
      draft.context ? `\nNotas territoriales: ${draft.context}` : "",
      ``,
      `## Oportunidad o convocatoria`,
      `- Nombre: ${draft.opportunityTitle || "Por definir"}`,
      `- Fondo u organización fuente: ${draft.opportunitySource || "Por definir"}`,
      `- Enlace: ${draft.opportunityUrl || "Por definir"}`,
      `- Fecha límite: ${draft.opportunityDeadline || "Por definir"}`,
      `- Documentos relacionados: ${opportunityDocuments.map(({ file }) => file.name).join(", ") || "Ninguno adjunto"}`,
      ``,
      `## Componentes de la intervención`,
      draft.components.length ? draft.components.map((item) => `- ${item}`).join("\n") : `- Por definir`,
      ``,
      `## Aporte posible de IwaGranja`,
      draft.includeIwagrana ? draft.iwagranaContribution : `IwaGranja no se incluye en esta versión de la propuesta.`,
      ``,
      `### Otras herramientas o apoyos`,
      draft.otherTools || "Por definir",
      ``,
      `## Plan preliminar`,
      ...draft.phases.flatMap((phase, index) => [
        `### ${index + 1}. ${phase.title || "Fase por nombrar"}`,
        `- Actividades: ${phase.activities.length ? phase.activities.map((item) => `\n  - ${item}`).join("") : "Por definir"}`,
        `- Responsable: ${phase.owner || "Por definir"}`,
      `- Tiempo: ${phase.timing === "Personalizado" ? (phase.customTiming || "Por definir") : (phase.timing || "Por definir")}`,
        `- Recursos: ${phase.resources.length ? phase.resources.map((item) => `\n  - ${item}`).join("") : "Por definir"}`,
      ]),
      ``,
      `## Medición propuesta · resultados del proyecto`,
      projectIndicators.length ? projectIndicators.map((item) => `- **${item.title}:** ${item.detail}`).join("\n") : `Por definir`,
      ``,
      `## Supuestos por validar`,
      projectAssumptions.length ? projectAssumptions.map((item) => `- **${item.title}:** ${item.detail}`).join("\n") : `No seleccionados`,
      ``,
      `## Medición separada · uso de IwaGranja`,
      draft.includeIwagrana && platformIndicators.length
        ? platformIndicators.map((item) => `- ${item.title}`).join("\n")
        : `No se incluyen indicadores de uso de IwaGranja en esta versión.`,
      ``,
      `## Continuidad`,
      draft.continuityActions.length ? draft.continuityActions.map((item) => `- ${item}`).join("\n") : "- Acciones por definir",
      draft.continuityNotes || "Notas pendientes de definir.",
      ``,
      `---`,
      `Plantilla base P1 · versión de prototipo. La ficha no constituye por sí sola una propuesta técnica, financiera ni una medición de resultados.`,
    ].join("\n");
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ficha-p1-seguridad-autonomia-alimentaria.md";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Descargaste una copia en formato Markdown.");
  };

  const handlePrint = () => {
    setNotice("En el diálogo de impresión puedes elegir «Guardar como PDF».");
    window.setTimeout(() => window.print(), 100);
  };

  return (
    <div className="space-y-6">
      {surface === "app" && (
        <PageHeader
          title="Ficha P1 · Seguridad y autonomía alimentaria"
          eyebrow="Plantilla para formular proyectos"
          description="Parte del cambio que buscas para el proyecto. Adapta la ficha al territorio y considera las herramientas que pueden apoyar la intervención."
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
        <span>Plantillas de proyecto</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-slate-700">P1</span>
        <span className="ml-auto rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono">BORRADOR · V0.1</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-4">
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
                detail="Esta ficha tiene un propósito principal definido. Puedes sumar otros resultados si forman parte de la propuesta, sin perder el foco central."
              />
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-950">
                La plantilla ya trae una base P1 de población, brechas, plan, indicadores, supuestos y continuidad. Revisa cada sugerencia frente al territorio y la oportunidad; puedes quitarla, editarla o agregar opciones propias.
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-sm"><Target className="h-5 w-5" /></span>
                  <div>
                    <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-800">Propósito principal · P1</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">Seguridad y autonomía alimentaria</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">Mejorar la disponibilidad de alimentos y el aporte del autoconsumo en los hogares.</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Puede encajar</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">Cuando el proyecto busca fortalecer alimentos disponibles para el hogar y contempla acciones para sostener la producción.</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Requiere definir</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">Qué brecha alimentaria se abordará, cómo se observará y qué asistencia necesita cada población.</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Cuidado al medir</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">Producción para el hogar aporta información sobre disponibilidad; no equivale por sí sola a consumo o nutrición.</p>
                </div>
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
                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Prototipo: los archivos quedan vinculados solo durante esta sesión del navegador; todavía no se guardan en una cuenta ni se cargan a un servidor. La descarga de la ficha incluye sus nombres y los datos de la oportunidad.</p>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <SectionTitle
                eyebrow="03 · Contexto y población"
                title="Aterrizar la propuesta"
                detail="La ficha parte con una población y criterios sugeridos para P1. Confirma o ajusta cada selección con la convocatoria y el diagnóstico territorial; no registres aquí datos personales."
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
                <p className="mb-3 text-xs text-slate-500">Selecciona uno o varios grupos. La ficha propone hogares rurales con pequeña producción animal como punto de partida P1.</p>
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
                <p className="mb-3 text-xs text-slate-500">Selección inicial sugerida para P1. Combina las opciones pertinentes y complétalas con evidencia del territorio.</p>
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
                detail="Las fases son una base para conversar con el aliado. Ajusta actividades, responsables y duración cuando se conozcan las condiciones de implementación."
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
                      <div className="grid gap-5 lg:grid-cols-2">
                        <CatalogItemPicker label="Actividades de esta fase · agrega una por una" catalog={activityCatalog} items={phase.activities} customOptions={phase.customActivities} onCustomOptionsChange={(items) => setPhase(index, "customActivities", items)} onChange={(items) => setPhase(index, "activities", items)} emptyLabel="Aún no hay actividades seleccionadas." />
                        <CatalogItemPicker label="Recursos o apoyos necesarios · agrega uno por uno" catalog={resourceCatalog} items={phase.resources} customOptions={phase.customResources} onCustomOptionsChange={(items) => setPhase(index, "customResources", items)} onChange={(items) => setPhase(index, "resources", items)} emptyLabel="Aún no hay recursos seleccionados." />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Input label="Responsable" value={phase.owner} onChange={(event) => setPhase(index, "owner", event.target.value)} placeholder="Por definir" />
                        <div>
                          <Select label="Tiempo estimado" value={phase.timing} onChange={(event) => setPhase(index, "timing", event.target.value)}>
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
                <SectionTitle eyebrow="06 · Revisión" title="Tu ficha preliminar está lista" detail="Revisa el resumen, ajusta pasos anteriores y exporta una copia para conversar con un posible aliado." />
                <div className="flex flex-wrap gap-2 print:hidden">
                  <Button type="button" variant="secondary" onClick={downloadMarkdown} className="inline-flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" /> Descargar .md</Button>
                  <Button type="button" onClick={handlePrint} className="inline-flex items-center gap-2"><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
                </div>
              </div>
              <article id="p1-print-preview" className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                <header className="border-b border-slate-200 pb-4">
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-800">Plantilla inicial · P1</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">Seguridad y autonomía alimentaria</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">Mejorar la disponibilidad de alimentos y el aporte del autoconsumo en los hogares.</p>
                  {draft.secondaryPurposes.length > 0 && <p className="mt-2 text-xs text-slate-600"><strong>Propósitos secundarios:</strong> {draft.secondaryPurposes.join(" · ")}</p>}
                </header>
                <section>
                  <h3 className="text-sm font-bold text-slate-900">Contexto y población de referencia</h3>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-slate-500">Territorio</dt><dd className="font-medium text-slate-800">{draft.territory || "Por definir"}</dd></div>
                    <div><dt className="text-xs text-slate-500">Organización interesada</dt><dd className="font-medium text-slate-800">{draft.organization || "Por definir"}{draft.organizationType ? ` · ${draft.organizationType}` : ""}</dd></div>
                    <div><dt className="text-xs text-slate-500">Hogares estimados</dt><dd className="font-medium text-slate-800">{draft.households || "Por definir"}</dd></div>
                    <div><dt className="text-xs text-slate-500">Grupos poblacionales</dt><dd className="font-medium text-slate-800">{populationGroupOptions.filter((item) => draft.populationGroups.includes(item.id)).map((item) => item.title).join(" · ") || "Por definir"}</dd></div>
                  </dl>
                  {draft.populationNotes && <p className="mt-2 text-xs leading-relaxed text-slate-600"><strong>Precisiones de población:</strong> {draft.populationNotes}</p>}
                  <p className="mt-2 text-xs leading-relaxed text-slate-600"><strong>Criterios de priorización:</strong> {priorityCriteriaOptions.filter((item) => draft.priorityCriteria.includes(item.id)).map((item) => item.title).join(" · ") || "Por definir"}</p>
                  {draft.priorityNotes && <p className="mt-1 text-xs leading-relaxed text-slate-600"><strong>Aplicación de criterios:</strong> {draft.priorityNotes}</p>}
                  <h4 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-700">Situaciones y brechas seleccionadas</h4>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">{foodGapOptions.filter((item) => draft.selectedBreaches.includes(item.id)).map((item) => <li key={item.id}>{item.title}</li>)}</ul>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{draft.context || "Evidencia y notas territoriales pendientes de precisar."}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600"><strong>Perfiles:</strong> {draft.profiles.join(" · ") || "Por definir"}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600"><strong>Usuarios posibles de los registros:</strong> {draft.actorRoles.join(" · ") || "Por definir"}</p>
                </section>
                <section className="rounded-lg border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Oportunidad relacionada</h3>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-slate-500">Convocatoria o fondo</dt><dd className="font-medium text-slate-800">{draft.opportunityTitle || "Por definir"}</dd></div>
                    <div><dt className="text-xs text-slate-500">Fuente</dt><dd className="font-medium text-slate-800">{draft.opportunitySource || "Por definir"}</dd></div>
                    <div><dt className="text-xs text-slate-500">Fecha límite</dt><dd className="font-medium text-slate-800">{draft.opportunityDeadline || "Por definir"}</dd></div>
                    <div><dt className="text-xs text-slate-500">Enlace</dt><dd className="break-all font-medium text-slate-800">{draft.opportunityUrl || "Por definir"}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs font-semibold text-slate-700">Documentos relacionados</p>
                  {opportunityDocuments.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">{opportunityDocuments.map(({ id, file }) => <li key={id}>{file.name}</li>)}</ul> : <p className="mt-1 text-sm text-slate-500">No se adjuntaron documentos en esta sesión.</p>}
                </section>
                <section>
                  <h3 className="text-sm font-bold text-slate-900">Componentes de la intervención</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{draft.components.map((component) => <li key={component}>{component}</li>)}</ul>
                  {draft.otherTools && <p className="mt-2 whitespace-pre-line text-sm text-slate-700"><strong>Otros apoyos:</strong> {draft.otherTools}</p>}
                </section>
                <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Aporte posible de IwaGranja</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{draft.includeIwagrana ? draft.iwagranaContribution : "No se contempla IwaGranja en esta versión de la propuesta."}</p>
                </section>
                <section>
                  <h3 className="text-sm font-bold text-slate-900">Plan preliminar</h3>
                  <div className="mt-2 space-y-4">{draft.phases.map((phase, index) => <div key={phase.id} className="border-l-2 border-emerald-300 pl-3"><p className="text-sm font-semibold text-slate-800">{index + 1}. {phase.title}</p><p className="mt-1 text-xs font-semibold text-slate-600">Actividades</p>{phase.activities.length ? <ul className="mt-0.5 list-disc space-y-1 pl-5 text-sm text-slate-700">{phase.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul> : <p className="text-sm text-slate-500">Por definir</p>}<p className="mt-1 text-xs text-slate-500">Responsable: {phase.owner || "Por definir"} · Tiempo: {phase.timing === "Personalizado" ? (phase.customTiming || "Duración por definir") : phase.timing}</p><p className="mt-1 text-xs font-semibold text-slate-600">Recursos y apoyos</p>{phase.resources.length ? <ul className="mt-0.5 list-disc space-y-1 pl-5 text-sm text-slate-700">{phase.resources.map((resource) => <li key={resource}>{resource}</li>)}</ul> : <p className="text-sm text-slate-500">Por definir</p>}</div>)}</div>
                </section>
                <section className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Resultados del proyecto</h3>
                    <ul className="mt-2 space-y-2 text-sm">{projectIndicatorOptions.filter((item) => draft.projectIndicators.includes(item.id)).map((item) => <li key={item.id}><strong className="text-slate-800">{item.title}</strong><span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{item.detail}</span></li>)}</ul>
                    {draft.projectIndicators.length === 0 && <p className="mt-2 text-sm text-slate-500">Indicadores por definir.</p>}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Uso de IwaGranja</h3>
                    {draft.includeIwagrana ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{platformIndicatorOptions.filter((item) => draft.platformIndicators.includes(item.id)).map((item) => <li key={item.id}>{item.title}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No aplica en esta versión.</p>}
                  </div>
                </section>
                <section>
                  <h3 className="text-sm font-bold text-slate-900">Continuidad</h3>
                  {draft.continuityActions.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{draft.continuityActions.map((action) => <li key={action}>{action}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Acciones por definir.</p>}
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{draft.continuityNotes || "Acuerdos, responsables y recursos pendientes de definir."}</p>
                </section>
                <section>
                  <h3 className="text-sm font-bold text-slate-900">Supuestos por validar</h3>
                  {projectAssumptionOptions.filter((item) => draft.projectAssumptions.includes(item.id)).length ? <ul className="mt-2 space-y-2 text-sm">{projectAssumptionOptions.filter((item) => draft.projectAssumptions.includes(item.id)).map((item) => <li key={item.id}><strong className="text-slate-800">{item.title}</strong><span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{item.detail}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Supuestos por definir.</p>}
                </section>
                <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">Borrador para discusión y adaptación. La disponibilidad de alimentos, el consumo y la situación nutricional son dimensiones distintas. El proyecto debe definir cómo medirá sus resultados y validar esta propuesta en el territorio.</p>
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

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start print:hidden">
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-800" />
              <h2 className="text-sm font-bold text-slate-900">Resumen de la ficha</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Propósito principal</p><p className="mt-0.5 font-semibold text-slate-800">Seguridad y autonomía alimentaria</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Territorio</p><p className="mt-0.5 text-slate-700">{draft.territory || "Aún por definir"}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Grupos priorizados</p><p className="mt-0.5 text-slate-700">{draft.populationGroups.length || "Ninguno seleccionado"}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Brechas seleccionadas</p><p className="mt-0.5 text-slate-700">{draft.selectedBreaches.length || "Ninguna seleccionada"}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Fases y continuidad</p><p className="mt-0.5 text-slate-700">{draft.phases.length} fases · {draft.continuityActions.length} acciones</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Componentes</p><p className="mt-0.5 text-slate-700">{draft.components.length} seleccionados</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">IwaGranja</p><p className="mt-0.5 text-slate-700">{draft.includeIwagrana ? "Considerada como apoyo posible" : "No incluida en esta propuesta"}</p></div>
            </div>
            <button type="button" onClick={() => setStep(5)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline">Ver ficha completa <ChevronRight className="h-3.5 w-3.5" /></button>
          </Card>
          <Card className="!p-4">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Sobre esta herramienta</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Ayuda a ordenar una idea de proyecto y preparar una conversación con aliados. En este prototipo, el borrador y las opciones propias viven solo durante la sesión: descarga la ficha para conservarla. Los archivos se relacionan por nombre y aún no se guardan en una cuenta ni se suben a un servidor.</p>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #p1-print-preview, #p1-print-preview * { visibility: visible !important; }
          #p1-print-preview { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0; padding: 0; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>
    </div>
  );
}
