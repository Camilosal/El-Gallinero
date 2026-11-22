import type { Metadata } from "next";
import { PublicPageShell } from "@/components/LegalPage";
import { ResourceVisualCard } from "@/components/ResourceVisualCard";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Herramientas y calculadoras para proyectos rurales · IwaGranja";
const DESCRIPTION =
  "Consulta una herramienta para diseñar proyectos rurales con producción animal y recursos productivos, de autoconsumo, caja e inventario disponibles en IwaGranja.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/recursos/herramientas",
  ogImage: "/images/guia/plan-parvada.webp",
  ogImageAlt: "Captura real de la planeación de parvada de IwaGranja",
});

const TOOLS = [
  {
    href: "/recursos/herramientas/p1",
    category: "Diseño de proyectos rurales · modelos P1–P7",
    title: "Diseño de Proyectos Rurales con Producción Animal",
    summary: "Elige entre siete modelos y adapta cómo la producción animal contribuye a alimentación, medios de vida, salud productiva, extensión, mercados y sostenibilidad.",
    image: "/images/guia/soberania-alimentaria.webp",
    imageAlt: "Captura real del módulo de soberanía alimentaria, una de las herramientas relacionadas con el formulador de proyectos",
    actionLabel: "Abrir el formulador",
    badge: "Herramienta oficial",
  },
  {
    href: "/produccion/plan-parvada",
    category: "Planeación productiva · dentro de IwaGranja",
    title: "Plan de parvada",
    summary: "Compara la postura real con una curva calculada por edad, consulta huevos esperados, alimento estimado y proyección de reemplazo.",
    image: "/images/guia/plan-parvada.webp",
    imageAlt: "Captura real de la pantalla de plan de parvada con datos de postura y proyección",
    actionLabel: "Abrir en IwaGranja",
  },
  {
    href: "/produccion?tab=pollos",
    category: "Registro productivo · dentro de IwaGranja",
    title: "Lotes de engorde y cría",
    summary: "Registra y sigue lotes de pollos, codornices, patos, conejos y cuyes; incluye datos de crianza y alimento estimado.",
    image: "/images/guia/produccion-carne.webp",
    imageAlt: "Captura real del módulo de producción de carne y seguimiento de lotes",
    actionLabel: "Abrir en IwaGranja",
  },
  {
    href: "/soberania",
    category: "Autoconsumo · dentro de IwaGranja",
    title: "Registro de soberanía alimentaria",
    summary: "Registra producción destinada al hogar y consulta cantidades, especies y ahorro estimado frente a precios de referencia.",
    image: "/images/guia/soberania-alimentaria.webp",
    imageAlt: "Captura real del registro de consumo familiar y aportes de producción",
    actionLabel: "Abrir en IwaGranja",
  },
  {
    href: "/finanzas/finanzas",
    category: "Finanzas · dentro de IwaGranja",
    title: "Flujo de caja y proyección mensual",
    summary: "Consulta ingresos y egresos registrados, su evolución y una proyección mensual basada en los movimientos reales de caja.",
    image: "/images/guia/finanzas-balance.webp",
    imageAlt: "Captura real del balance financiero y proyección de caja de IwaGranja",
    actionLabel: "Abrir en IwaGranja",
  },
  {
    href: "/inventarios/alimentacion",
    category: "Inventario · dentro de IwaGranja",
    title: "Cobertura de alimento",
    summary: "Revisa el stock actual, el valor estimado y los días de cobertura calculados según el consumo reciente.",
    image: "/images/guia/inventario-alimentos.webp",
    imageAlt: "Captura real del inventario de alimentos y sus días de cobertura",
    actionLabel: "Abrir en IwaGranja",
  },
] as const;

export default function HerramientasPage() {
  return (
    <PublicPageShell
      title="Herramientas y calculadoras"
      intro="Esta página reúne herramientas para diseñar proyectos rurales con producción animal y funciones disponibles dentro de IwaGranja. Cada tarjeta indica dónde se usa."
      path="/recursos/herramientas"
      description={DESCRIPTION}
      pageType="CollectionPage"
      breadcrumbs={[
        { name: "Recursos", path: "/recursos" },
        { name: "Herramientas y calculadoras", path: "/recursos/herramientas" },
      ]}
      headerAction={{ href: "/contacto", label: "Hablar con el equipo" }}
    >
      <section aria-label="Herramientas disponibles" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((tool) => (
          <ResourceVisualCard key={tool.href} {...tool} />
        ))}
      </section>
      <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
        Las funciones dentro de IwaGranja requieren acceso a una cuenta. El formulador es una herramienta abierta para organizar una idea y preparar el diálogo con aliados; no reemplaza la formulación técnica, financiera ni la validación en territorio.
      </p>
    </PublicPageShell>
  );
}
