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
  Printer,
  Sprout,
  Target,
  Users,
  Utensils,
} from "lucide-react";
import { Button, Card, Input, PageHeader, Textarea } from "@/components/ui";

const STEPS = [
  "Propósito",
  "Contexto y población",
  "Intervención",
  "Plan y medición",
  "Revisar y exportar",
] as const;

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
];

const PLATFORM_INDICATORS = [
  { id: "active", title: "Hogares que realizan los registros acordados" },
  { id: "complete", title: "Completitud de los registros de producción y destino" },
  { id: "time", title: "Tiempo y esfuerzo requeridos para registrar" },
];

type PlanPhase = { title: string; activities: string; owner: string; timing: string; resources: string };
type ProjectDraft = {
  secondaryPurposes: string[];
  territory: string;
  organization: string;
  households: string;
  population: string;
  priorityCriteria: string;
  context: string;
  profiles: string[];
  actorRoles: string[];
  components: string[];
  includeIwagrana: boolean;
  iwagranaContribution: string;
  otherTools: string;
  phases: PlanPhase[];
  projectIndicators: string[];
  platformIndicators: string[];
  continuity: string;
};

const INITIAL_DRAFT: ProjectDraft = {
  secondaryPurposes: [],
  territory: "",
  organization: "",
  households: "",
  population: "",
  priorityCriteria: "",
  context: "",
  profiles: [BENEFICIARY_PROFILES[0]],
  actorRoles: [ACTOR_ROLES[0], ACTOR_ROLES[1]],
  components: [PROJECT_COMPONENTS[0].name, PROJECT_COMPONENTS[1].name],
  includeIwagrana: true,
  iwagranaContribution:
    "Facilitar el registro de la producción y diferenciar lo destinado al hogar, las ventas y otros usos. Esta información puede ayudar al equipo a observar la disponibilidad de alimentos de origen animal; no mide por sí sola el consumo ni el estado nutricional.",
  otherTools: "",
  phases: [
    { title: "Preparación y diagnóstico", activities: "Precisar la brecha, la población, las condiciones productivas y la línea base.", owner: "", timing: "Por definir", resources: "" },
    { title: "Alistamiento y formación", activities: "Acordar apoyos productivos, sanidad, roles y rutinas de registro.", owner: "", timing: "Por definir", resources: "" },
    { title: "Acompañamiento", activities: "Desarrollar los componentes y revisar periódicamente los avances acordados.", owner: "", timing: "Por definir", resources: "" },
    { title: "Revisión y continuidad", activities: "Valorar resultados, aprendizajes, pendientes y responsables posteriores.", owner: "", timing: "Por definir", resources: "" },
  ],
  projectIndicators: ["autoconsumo"],
  platformIndicators: ["active", "complete"],
  continuity: "Definir quién dará continuidad al acompañamiento, los registros y los acuerdos productivos al terminar el proyecto.",
};

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
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
  const [notice, setNotice] = useState("");

  const progress = ((step + 1) / STEPS.length) * 100;
  const selectedSecondary = useMemo(() => draft.secondaryPurposes, [draft.secondaryPurposes]);

  const patch = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const setPhase = (index: number, key: keyof PlanPhase, value: string) => {
    setDraft((previous) => ({
      ...previous,
      phases: previous.phases.map((phase, currentIndex) =>
        currentIndex === index ? { ...phase, [key]: value } : phase,
      ),
    }));
  };

  const downloadMarkdown = () => {
    const projectIndicators = PROJECT_INDICATORS.filter((item) => draft.projectIndicators.includes(item.id));
    const platformIndicators = PLATFORM_INDICATORS.filter((item) => draft.platformIndicators.includes(item.id));
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
      `- Organización: ${draft.organization || "Por definir"}`,
      `- Hogares estimados: ${draft.households || "Por definir"}`,
      `- Población priorizada: ${draft.population || "Por definir"}`,
      `- Criterios de priorización y diferenciación: ${draft.priorityCriteria || "Por definir"}`,
      `- Perfiles de referencia: ${draft.profiles.join(", ") || "Por definir"}`,
      `- Quiénes usarían los registros: ${draft.actorRoles.join(", ") || "Por definir"}`,
      ``,
      `### Situación que se busca atender`,
      draft.context || "Por definir",
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
        `- Actividades: ${phase.activities || "Por definir"}`,
        `- Responsable: ${phase.owner || "Por definir"}`,
        `- Tiempo: ${phase.timing || "Por definir"}`,
        `- Recursos: ${phase.resources || "Por definir"}`,
      ]),
      ``,
      `## Medición propuesta · resultados del proyecto`,
      projectIndicators.length ? projectIndicators.map((item) => `- **${item.title}:** ${item.detail}`).join("\n") : `Por definir`,
      ``,
      `## Medición separada · uso de IwaGranja`,
      draft.includeIwagrana && platformIndicators.length
        ? platformIndicators.map((item) => `- ${item.title}`).join("\n")
        : `No se incluyen indicadores de uso de IwaGranja en esta versión.`,
      ``,
      `## Continuidad`,
      draft.continuity || "Por definir",
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
            <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
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
                  {SECONDARY_PURPOSES.map((purpose) => (
                    <CheckOption key={purpose} title={purpose} checked={selectedSecondary.includes(purpose)} onChange={() => patch("secondaryPurposes", toggleValue(selectedSecondary, purpose))} />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <SectionTitle
                eyebrow="02 · Contexto y población"
                title="Aterrizar la propuesta"
                detail="Describe el contexto general del proyecto. Los perfiles son referencias; no registres aquí información personal de hogares o participantes."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Territorio de referencia" value={draft.territory} onChange={(event) => patch("territory", event.target.value)} placeholder="Municipio, región o comunidad" />
                <Input label="Organización interesada" value={draft.organization} onChange={(event) => patch("organization", event.target.value)} placeholder="ONG, asociación, fundación…" />
                <Input label="Número estimado de hogares" type="number" min="0" value={draft.households} onChange={(event) => patch("households", event.target.value)} placeholder="Por definir" />
                <Input label="Población priorizada" value={draft.population} onChange={(event) => patch("population", event.target.value)} placeholder="Criterios por definir según proyecto" />
              </div>
              <div className="mt-4">
                <Input label="Criterios de priorización y diferenciación" value={draft.priorityCriteria} onChange={(event) => patch("priorityCriteria", event.target.value)} placeholder="Por ejemplo: género, edad, pertenencia cultural o acceso a TIC, según el proyecto" help="Incluye solo criterios pertinentes y define cómo se aplicarán. No registres datos personales de participantes." />
              </div>
              <div className="mt-5">
                <Textarea label="Situación o brecha que busca atender" value={draft.context} onChange={(event) => patch("context", event.target.value)} placeholder="¿Qué situación de disponibilidad de alimentos observan? ¿En qué población y territorio? ¿Qué información necesita validar el proyecto?" rows={4} />
              </div>
              <div className="mt-6">
                <h3 className="mb-1 text-sm font-bold text-slate-800">Perfiles de beneficiarios de referencia</h3>
                <p className="mb-3 text-xs text-slate-500">Se pueden elegir varios. Ajusta después cada perfil a las características del territorio.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {BENEFICIARY_PROFILES.map((profile) => (
                    <CheckOption key={profile} title={profile} checked={draft.profiles.includes(profile)} onChange={() => patch("profiles", toggleValue(draft.profiles, profile))} />
                  ))}
                </div>
              </div>
              <div className="mt-6">
                <h3 className="mb-1 text-sm font-bold text-slate-800">¿Quién podría usar los registros?</h3>
                <p className="mb-3 text-xs text-slate-500">La persona beneficiaria, quien opera la producción y quien registra pueden ser diferentes.</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ACTOR_ROLES.map((role) => (
                    <CheckOption key={role} title={role} checked={draft.actorRoles.includes(role)} onChange={() => patch("actorRoles", toggleValue(draft.actorRoles, role))} />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <SectionTitle
                eyebrow="03 · Intervención"
                title="Definir los componentes del proyecto"
                detail="La actividad animal puede ser una parte de una intervención más amplia. Selecciona apoyos que tengan sentido para la población y el territorio."
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {PROJECT_COMPONENTS.map((component) => {
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

          {step === 3 && (
            <Card>
              <SectionTitle
                eyebrow="04 · Plan y medición"
                title="Trazar los primeros pasos"
                detail="Las fases son una base para conversar con el aliado. Ajusta actividades, responsables y duración cuando se conozcan las condiciones de implementación."
              />
              <div className="space-y-3">
                {draft.phases.map((phase, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">{index + 1}</span>
                      <input aria-label={`Nombre de la fase ${index + 1}`} value={phase.title} onChange={(event) => setPhase(index, "title", event.target.value)} className="min-w-0 flex-1 border-b border-slate-200 bg-transparent py-1 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Textarea label="Actividades" value={phase.activities} onChange={(event) => setPhase(index, "activities", event.target.value)} rows={2} />
                      <Textarea label="Recursos o apoyos necesarios" value={phase.resources} onChange={(event) => setPhase(index, "resources", event.target.value)} rows={2} placeholder="Por definir" />
                      <div className="grid gap-3">
                        <Input label="Responsable" value={phase.owner} onChange={(event) => setPhase(index, "owner", event.target.value)} placeholder="Por definir" />
                        <Input label="Tiempo estimado" value={phase.timing} onChange={(event) => setPhase(index, "timing", event.target.value)} placeholder="Por definir" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

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
                    {PROJECT_INDICATORS.map((item) => (
                      <CheckOption key={item.id} title={item.title} detail={item.detail} checked={draft.projectIndicators.includes(item.id)} onChange={() => patch("projectIndicators", toggleValue(draft.projectIndicators, item.id))} />
                    ))}
                  </div>
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
                      {PLATFORM_INDICATORS.map((item) => (
                        <CheckOption key={item.id} title={item.title} checked={draft.platformIndicators.includes(item.id)} onChange={() => patch("platformIndicators", toggleValue(draft.platformIndicators, item.id))} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No se mostrarán indicadores de uso porque IwaGranja no está incluida en esta propuesta.</div>
                  )}
                </div>
              </div>
              <div className="mt-6">
                <Textarea label="Continuidad después del proyecto" value={draft.continuity} onChange={(event) => patch("continuity", event.target.value)} rows={3} help="Define capacidades, responsables, recursos y acuerdos que habría que resolver." />
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <SectionTitle eyebrow="05 · Revisión" title="Tu ficha preliminar está lista" detail="Revisa el resumen, ajusta pasos anteriores y exporta una copia para conversar con un posible aliado." />
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
                    <div><dt className="text-xs text-slate-500">Organización</dt><dd className="font-medium text-slate-800">{draft.organization || "Por definir"}</dd></div>
                    <div><dt className="text-xs text-slate-500">Hogares estimados</dt><dd className="font-medium text-slate-800">{draft.households || "Por definir"}</dd></div>
                    <div><dt className="text-xs text-slate-500">Población priorizada</dt><dd className="font-medium text-slate-800">{draft.population || "Por definir"}</dd></div>
                  </dl>
                  {draft.priorityCriteria && <p className="mt-2 text-xs leading-relaxed text-slate-600"><strong>Criterios de priorización:</strong> {draft.priorityCriteria}</p>}
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{draft.context || "La situación que busca atender el proyecto está pendiente de precisar."}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600"><strong>Perfiles:</strong> {draft.profiles.join(" · ") || "Por definir"}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600"><strong>Usuarios posibles de los registros:</strong> {draft.actorRoles.join(" · ") || "Por definir"}</p>
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
                  <div className="mt-2 space-y-3">{draft.phases.map((phase, index) => <div key={index} className="border-l-2 border-emerald-300 pl-3"><p className="text-sm font-semibold text-slate-800">{index + 1}. {phase.title}</p><p className="mt-0.5 text-sm text-slate-700">{phase.activities || "Actividades por definir"}</p><p className="mt-0.5 text-xs text-slate-500">Responsable: {phase.owner || "Por definir"} · Tiempo: {phase.timing || "Por definir"}</p>{phase.resources && <p className="mt-1 text-xs text-slate-600"><strong>Recursos:</strong> {phase.resources}</p>}</div>)}</div>
                </section>
                <section className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Resultados del proyecto</h3>
                    <ul className="mt-2 space-y-2 text-sm">{PROJECT_INDICATORS.filter((item) => draft.projectIndicators.includes(item.id)).map((item) => <li key={item.id}><strong className="text-slate-800">{item.title}</strong><span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{item.detail}</span></li>)}</ul>
                    {draft.projectIndicators.length === 0 && <p className="mt-2 text-sm text-slate-500">Indicadores por definir.</p>}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Uso de IwaGranja</h3>
                    {draft.includeIwagrana ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{PLATFORM_INDICATORS.filter((item) => draft.platformIndicators.includes(item.id)).map((item) => <li key={item.id}>{item.title}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No aplica en esta versión.</p>}
                  </div>
                </section>
                <section>
                  <h3 className="text-sm font-bold text-slate-900">Continuidad</h3>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{draft.continuity || "Pendiente de definir."}</p>
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
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Perfiles seleccionados</p><p className="mt-0.5 text-slate-700">{draft.profiles.length || "Ninguno"}</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Componentes</p><p className="mt-0.5 text-slate-700">{draft.components.length} seleccionados</p></div>
              <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">IwaGranja</p><p className="mt-0.5 text-slate-700">{draft.includeIwagrana ? "Considerada como apoyo posible" : "No incluida en esta propuesta"}</p></div>
            </div>
            <button type="button" onClick={() => setStep(4)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline">Ver ficha completa <ChevronRight className="h-3.5 w-3.5" /></button>
          </Card>
          <Card className="!p-4">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Sobre esta herramienta</h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">Ayuda a ordenar una idea de proyecto y preparar una conversación con aliados. No reemplaza el diagnóstico, la formulación técnica y financiera ni la validación con la población.</p>
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
