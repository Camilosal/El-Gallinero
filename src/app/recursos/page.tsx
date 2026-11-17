import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CalendarDays,
  FlaskConical,
  Newspaper,
  Wrench,
} from "lucide-react";
import { PublicPageShell } from "@/components/LegalPage";
import { BITACORA_ARTICLES } from "@/lib/bitacora-content";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Recursos para granjas y proyectos rurales · IwaGranja";
const DESCRIPTION =
  "Artículos, herramientas y novedades de IwaGranja: consulta la bitácora, prueba herramientas para formular proyectos y encuentra información sobre el producto.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/recursos",
});

const EDITORIAL_RESOURCES = [
  {
    href: "/guia",
    type: "Guía de uso",
    title: "Manual y guía paso a paso",
    summary: "Recorre los módulos de IwaGranja con instrucciones y capturas de referencia.",
  },
  {
    href: "/realidad-campo",
    type: "Artículo explicativo",
    title: "La realidad del campo y cómo la atendemos",
    summary: "Problemas habituales de operación en granjas mixtas y respuestas que se pueden explorar.",
  },
  {
    href: "/open-source",
    type: "Documentación del proyecto",
    title: "Código abierto y participación",
    summary: "Conoce el modelo abierto, las formas de participar y las opciones de despliegue.",
  },
] as const;

const APP_TOOLS = [
  {
    href: "/produccion/plan-parvada",
    type: "Planeación productiva",
    title: "Plan de parvada",
    summary: "Proyecta postura, alimento y reemplazo a partir de los datos de la granja.",
    icon: CalendarDays,
  },
  {
    href: "/produccion?tab=pollos",
    type: "Calculadora en la app",
    title: "Proyección de lote de engorde",
    summary: "Explora una proyección productiva del lote con los datos registrados en IwaGranja.",
    icon: Calculator,
  },
  {
    href: "/soberania",
    type: "Módulo de autoconsumo",
    title: "Soberanía alimentaria",
    summary: "Organiza los registros de producción y consumo de alimentos del hogar.",
    icon: Wrench,
  },
  {
    href: "/finanzas/finanzas",
    type: "Proyección financiera",
    title: "Proyección mensual de caja",
    summary: "Consulta una proyección basada en los movimientos de caja registrados en la granja.",
    icon: Calculator,
  },
  {
    href: "/inventarios/alimentacion",
    type: "Proyección de inventario",
    title: "Días de cobertura de alimento",
    summary: "Estima los días restantes de alimento según el stock y el consumo reciente.",
    icon: CalendarDays,
  },
] as const;

const RESOURCE_GROUPS = [
  {
    href: "#articulos",
    title: "Artículos y bitácoras",
    detail: `${BITACORA_ARTICLES.length} artículos de campo, además de guías y documentación.`,
    icon: BookOpen,
    tone: "amber",
  },
  {
    href: "#herramientas",
    title: "Herramientas y calculadoras",
    detail: "Una plantilla interactiva pública y herramientas operativas disponibles dentro de IwaGranja.",
    icon: FlaskConical,
    tone: "emerald",
  },
  {
    href: "#novedades",
    title: "Noticias y novedades",
    detail: "Un espacio para lanzamientos, alianzas y aprendizajes publicados.",
    icon: Newspaper,
    tone: "blue",
  },
] as const;

export default function RecursosPage() {
  return (
    <PublicPageShell
      title="Recursos"
      intro="Consulta contenidos para aprender, herramientas para explorar y novedades del proyecto. Cada recurso indica su propósito y dónde se utiliza."
      path="/recursos"
      description={DESCRIPTION}
      pageType="CollectionPage"
      headerAction={{ href: "/contacto", label: "Contacto" }}
    >
      <div className="space-y-10">
        <nav aria-label="Grupos de recursos" className="grid gap-3 md:grid-cols-3">
          {RESOURCE_GROUPS.map((group) => {
            const Icon = group.icon;
            const tone = group.tone === "amber"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : group.tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-blue-200 bg-blue-50 text-blue-900";
            return (
              <Link key={group.href} href={group.href} className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${tone}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <h2 className="mt-3 font-bold">{group.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed opacity-85">{group.detail}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold">Explorar <ArrowRight className="h-3.5 w-3.5" /></span>
              </Link>
            );
          })}
        </nav>

        <section id="articulos" aria-labelledby="recursos-articulos" className="scroll-mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800">01 · Aprender y consultar</p>
              <h2 id="recursos-articulos" className="mt-1 text-xl font-bold text-slate-900">Artículos y bitácoras</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Bitácora de campo, guías y documentación para consultar los temas con más detalle.</p>
            </div>
            <Link href="/bitacora" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 underline underline-offset-4">Ver bitácora <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {BITACORA_ARTICLES.map((article) => (
              <article key={article.slug} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-950">Bitácora</span>
                  <span>{article.category}</span>
                  <span>· {article.readingMinutes} min</span>
                </div>
                <h3 className="mt-2 text-base font-bold leading-snug text-slate-900">
                  <Link href={`/bitacora/${article.slug}`} className="hover:text-emerald-800">{article.title}</Link>
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{article.summary}</p>
                <Link href={`/bitacora/${article.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">Leer artículo <ArrowRight className="h-3.5 w-3.5" /></Link>
              </article>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {EDITORIAL_RESOURCES.map((resource) => (
              <article key={resource.href} className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{resource.type}</span>
                <h3 className="mt-1.5 text-sm font-bold text-slate-900"><Link href={resource.href} className="hover:text-emerald-800">{resource.title}</Link></h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{resource.summary}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="herramientas" aria-labelledby="recursos-herramientas" className="scroll-mt-6">
          <div className="border-b border-slate-200 pb-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">02 · Explorar y formular</p>
            <h2 id="recursos-herramientas" className="mt-1 text-xl font-bold text-slate-900">Herramientas y calculadoras</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Plantillas interactivas y herramientas de planeación. Las herramientas operativas se abren dentro de IwaGranja.</p>
          </div>
          <article className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xs">
            <div className="grid md:grid-cols-[1fr_auto]">
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-emerald-950">Plantilla de formulación</span>
                  <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-950">Prototipo</span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-slate-900">P1 · Seguridad y autonomía alimentaria</h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Personaliza una ficha inicial con propósito principal, población, componentes, plan preliminar e indicadores sugeridos. IwaGranja se presenta como una herramienta posible dentro de la intervención.</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">La herramienta organiza una idea para conversar con un aliado; no reemplaza el diagnóstico, la formulación técnica y financiera ni la validación en territorio.</p>
              </div>
              <div className="flex items-center border-t border-emerald-100 bg-emerald-50/70 p-5 md:border-l md:border-t-0">
                <Link href="/recursos/herramientas/p1" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-900">Abrir la plantilla <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </article>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {APP_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <article key={tool.href} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{tool.type}</span>
                    <Icon className="h-4 w-4 text-emerald-800" aria-hidden="true" />
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-900">{tool.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{tool.summary}</p>
                  <p className="mt-2 text-[11px] text-slate-500">Disponible dentro de la app · requiere acceso</p>
                  <Link href={tool.href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline underline-offset-2">Abrir en IwaGranja <ArrowRight className="h-3.5 w-3.5" /></Link>
                </article>
              );
            })}
          </div>
        </section>

        <section id="novedades" aria-labelledby="recursos-novedades" className="scroll-mt-6">
          <div className="border-b border-slate-200 pb-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">03 · Seguir el proyecto</p>
            <h2 id="recursos-novedades" className="mt-1 text-xl font-bold text-slate-900">Noticias y novedades</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Publicaremos aquí actualizaciones del producto, alianzas y aprendizajes que queramos compartir.</p>
          </div>
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Newspaper className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
              <div>
                <h3 className="font-bold text-slate-800">Aún no hay novedades publicadas</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Esta sección queda preparada para anuncios y noticias. La Bitácora, las guías y las herramientas se mantienen en sus propios grupos.</p>
                <Link href="/contacto" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline underline-offset-4">Contactar al equipo <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
