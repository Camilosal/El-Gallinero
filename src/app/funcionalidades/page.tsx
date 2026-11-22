import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Layers3, ListChecks, ShieldCheck, Sparkles } from "lucide-react";
import { PublicPageShell } from "@/components/LegalPage";
import { AI_AUTOMATION_PILLARS, ADOPTION_HIGHLIGHTS } from "@/lib/landing-showcase";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Funcionalidades de IwaGranja · Gestión para granjas mixtas";
const DESCRIPTION =
  "Funcionalidades de IwaGranja por área: producción, sanidad, finanzas, trabajo sin señal, asistente Gina con voz y Telegram, y API/MCP para agentes de IA.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/funcionalidades",
  ogImage: "/images/guia/inicio-dashboard.webp",
  ogImageAlt: "Panel operativo de IwaGranja para granjas mixtas",
});

const MODULES = [
  {
    title: "Animales y lugares de manejo",
    summary: "Organiza el censo actual, los grupos y los espacios donde se desarrolla la producción.",
    features: ["Aves y pequeños mamíferos", "Adquisiciones y entradas", "Ubicaciones, corrales y galpones", "Incubación, reproducción y mortalidad"],
  },
  {
    title: "Producción",
    summary: "Registra los productos y eventos que siguen el ciclo productivo de cada especie.",
    features: ["Postura y clasificación de huevos", "Carne, pesajes y sacrificio", "Gallinaza y subproductos", "Producción por lote y especie"],
  },
  {
    title: "Inventarios y almacén",
    summary: "Consulta existencias, movimientos y necesidades de abastecimiento.",
    features: ["Inventario de huevos, carne y gallinaza", "Alimento e insumos", "Cobertura estimada según consumo", "Activos y mantenimiento"],
  },
  {
    title: "Sanidad, bienestar y bioseguridad",
    summary: "Organiza el calendario, los tratamientos y los controles asociados al manejo sanitario.",
    features: ["Calendarios vacunales y recordatorios", "Registro de tratamientos y mortalidad", "Alertas y tiempos de retiro", "Bitácoras de bioseguridad y bienestar"],
  },
  {
    title: "Alimentación y manejo de recursos",
    summary: "Relaciona programas de alimentación, consumos, inventarios y tareas de operación.",
    features: ["Programas por especie y etapa", "Consumo planificado y real", "Predicción de días de alimento", "Compostaje y aprovechamiento de gallinaza"],
  },
  {
    title: "Finanzas y actividad comercial",
    summary: "Registra ingresos y gastos para entender el movimiento económico de la granja.",
    features: ["Ventas, compras, egresos y cuentas", "Costos por especie y lote", "Punto de equilibrio y márgenes", "Personal, presupuestos y proyección de caja"],
  },
  {
    title: "Planeación y soberanía alimentaria",
    summary: "Programa rutinas y revisa el aporte de la producción al hogar y a los ciclos futuros.",
    features: ["Calendario maestro y tareas", "Plan de parvada y reemplazos", "Registro de autoconsumo", "Aporte económico estimado de la producción del hogar"],
  },
  {
    title: "Análisis, reportes y exportación",
    summary: "Consulta indicadores y prepara datos para revisión o uso en otros sistemas.",
    features: ["Indicadores productivos y financieros", "Curvas de referencia y análisis", "Reportes descargables", "Exportación, API de herramientas del agente y servidor MCP"],
  },
] as const;

const PLATFORM_TOOLS = [
  {
    title: "Configuración y catálogos",
    summary: "Ajusta parámetros de producción, estándares y listas que alimentan los cálculos de la granja.",
  },
  {
    title: "Usuarios, roles y granjas",
    summary: "Administra accesos y configura las unidades de trabajo disponibles para la cuenta.",
  },
  {
    title: "Escala y módulos",
    summary: "Organiza la activación gradual de capacidades según el tamaño y las necesidades operativas.",
  },
  {
    title: "Copias y conectores",
    summary: "Respaldo y exportación de datos, tokens con scopes para ERP y agentes de IA, y canal bidireccional de Telegram.",
  },
] as const;

export default function FuncionalidadesPage() {
  return (
    <PublicPageShell
      title="Funcionalidades de IwaGranja"
      intro="Un recorrido por las áreas que puedes gestionar en la plataforma. El acceso a algunas funciones depende del plan, la configuración y los datos disponibles en cada granja."
      path="/funcionalidades"
      description={DESCRIPTION}
      headerAction={{ href: "/planes", label: "Ver planes" }}
    >
      <div className="space-y-10">
        <nav aria-label="Secciones de funcionalidades" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["#modulos", "Áreas de gestión"],
            ["#campo", "Trabajo en campo"],
            ["/#modulos", "Módulos y normas"],
            ["/guia", "Guía de uso"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-3 py-2.5 text-center text-sm font-semibold text-[var(--iw-semantic-text-primary)] hover:border-[var(--iw-semantic-border-strong)] hover:text-[var(--iw-semantic-action-primary-hover)]">{label}</Link>
          ))}
        </nav>

        <section id="modulos" aria-labelledby="funcionalidades-modulos" className="scroll-mt-6">
          <div className="mb-5 flex items-start gap-3">
            <Layers3 className="mt-1 h-5 w-5 shrink-0 text-[var(--iw-semantic-action-primary)]" />
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--iw-semantic-action-primary)]">Áreas de gestión</p>
              <h2 id="funcionalidades-modulos" className="mt-1 text-xl font-bold text-[var(--iw-semantic-text-primary)]">La operación conectada por especie, lote y actividad</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)]">Las funciones se complementan para registrar movimientos, consultar existencias y revisar indicadores con el nivel de detalle que requiere cada unidad productiva.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {MODULES.map((module, index) => (
              <article key={module.title} className="rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--iw-semantic-bg-feature)] font-mono text-xs font-bold text-[var(--iw-semantic-text-primary)]">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[var(--iw-semantic-text-primary)]">{module.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)]">{module.summary}</p>
                  </div>
                </div>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {module.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--iw-semantic-text-primary)]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-action-primary)]" />{feature}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="campo" aria-labelledby="funcionalidades-campo" className="scroll-mt-6 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)] p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[var(--iw-semantic-action-primary)]" />
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--iw-semantic-action-primary)]">Experiencia de campo</p>
              <h2 id="funcionalidades-campo" className="mt-1 text-xl font-bold text-[var(--iw-semantic-text-primary)]">Menos pasos para registrar y revisar</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)]">La app combina captura rápida, lectura de códigos, asistencia por voz y tareas relacionadas con los registros.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {AI_AUTOMATION_PILLARS.map((item) => (
              <article key={item.title} className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--iw-semantic-action-primary)]">{item.eyebrow}</p>
                <h3 className="mt-1 text-sm font-bold text-[var(--iw-semantic-text-primary)]">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)]">{item.summary}</p>
                <div className="mt-3 rounded-lg bg-[var(--iw-semantic-bg-subtle)] p-3 text-xs leading-relaxed">
                  <p className="font-medium text-[var(--iw-semantic-text-primary)]">{item.exampleInput}</p>
                  <p className="mt-1 text-[var(--iw-semantic-text-secondary)]">→ {item.exampleOutput}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/#como-funciona" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--iw-semantic-text-primary)] underline underline-offset-4">Ver la demostración en la landing <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/realidad-campo" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--iw-semantic-text-primary)] underline underline-offset-4">Leer sobre los retos de campo <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>

        <section aria-labelledby="funcionalidades-referencias">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[var(--iw-semantic-action-primary)]" />
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--iw-semantic-action-primary)]">Normas y referencias</p>
              <h2 id="funcionalidades-referencias" className="mt-1 text-xl font-bold text-[var(--iw-semantic-text-primary)]">Información de apoyo para la operación</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--iw-semantic-text-secondary)]">La plataforma incorpora referencias y herramientas de consulta para apoyar la gestión. Su disponibilidad no sustituye la revisión de la fuente vigente ni el criterio de profesionales competentes.</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-[var(--iw-semantic-status-info)]/40 bg-[var(--iw-semantic-bg-subtle)] p-4 text-sm leading-relaxed text-[var(--iw-semantic-text-primary)]">
            <ListChecks className="mr-2 inline h-4 w-4" /> Consulta las normas y referencias disponibles desde la sección de módulos de la landing y revisa el alcance aplicable a cada especie, producto y territorio.
          </div>
        </section>

        <section aria-labelledby="funcionalidades-plataforma" className="border-t border-[var(--iw-semantic-border-default)] pt-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--iw-semantic-action-primary)]">Administración de la plataforma</p>
          <h2 id="funcionalidades-plataforma" className="mt-1 text-xl font-bold text-[var(--iw-semantic-text-primary)]">Configuración para cada granja y equipo</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM_TOOLS.map((item) => (
              <article key={item.title} className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4">
                <h3 className="text-sm font-bold text-[var(--iw-semantic-text-primary)]">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)]">{item.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="funcionalidades-adopcion" className="border-t border-[var(--iw-semantic-border-default)] pt-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--iw-semantic-action-primary)]">Adopción y escala</p>
          <h2 id="funcionalidades-adopcion" className="mt-1 text-xl font-bold text-[var(--iw-semantic-text-primary)]">El arranque puede ser gradual</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ADOPTION_HIGHLIGHTS.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--iw-semantic-action-primary)]">{item.badge}</p>
                <h3 className="mt-2 text-sm font-bold text-[var(--iw-semantic-text-primary)]">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--iw-semantic-text-secondary)]">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--iw-color-forest-dark)] p-5 text-[var(--iw-color-paper)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-white">¿Quieres revisar qué alcance se ajusta a una granja o proyecto?</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--iw-color-sage)]">Consulta los planes o conversa con el equipo sobre una posible implementación.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/planes" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--iw-radius-control)] bg-[var(--iw-color-paper)] px-4 py-2.5 text-sm font-bold text-[var(--iw-color-ink-strong)] hover:bg-[var(--iw-color-white)] transition">Ver planes <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/contacto" className="inline-flex min-h-11 items-center rounded-[var(--iw-radius-control)] border border-white/25 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition">Contacto</Link>
            </div>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
