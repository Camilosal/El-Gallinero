import type { Metadata } from "next";
import { PublicPageShell } from "@/components/LegalPage";
import { ResourceVisualCard } from "@/components/ResourceVisualCard";
import { BITACORA_ARTICLES } from "@/lib/bitacora-content";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Recursos para granjas y proyectos rurales · IwaGranja";
const DESCRIPTION =
  "Explora artículos y bitácoras, herramientas y calculadoras, y el espacio de noticias de IwaGranja, cada uno en su propia página.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/recursos",
  ogImage: "/images/guia/inicio-dashboard.webp",
  ogImageAlt: "Vista real del panel de IwaGranja en el centro de recursos",
});

const RESOURCE_GROUPS = [
  {
    href: "/bitacora",
    category: "01 · Aprender y consultar",
    title: "Artículos y bitácoras",
    summary: `${BITACORA_ARTICLES.length} artículos publicados sobre operación de granjas mixtas, con guías y documentación existentes para profundizar.`,
    image: "/images/guia/produccion-huevos.webp",
    imageAlt: "Captura real del registro de producción de huevos en IwaGranja, usada como imagen del grupo de artículos y bitácoras",
    actionLabel: "Ver artículos y guías",
  },
  {
    href: "/recursos/herramientas",
    category: "02 · Explorar y formular",
    title: "Herramientas y calculadoras",
    summary: "Una herramienta para diseñar proyectos rurales con producción animal y funciones operativas disponibles dentro de IwaGranja.",
    image: "/images/guia/plan-parvada.webp",
    imageAlt: "Captura real de la herramienta de planeación de parvada de IwaGranja",
    actionLabel: "Ver herramientas",
  },
  {
    href: "/recursos/novedades",
    category: "03 · Seguir el proyecto",
    title: "Noticias y novedades",
    summary: "Página preparada para novedades verificables. Aún no hay publicaciones en esta categoría.",
    image: "/hero-illustration.png",
    imageAlt: "Ilustración institucional de IwaGranja que identifica el espacio de noticias y novedades",
    actionLabel: "Consultar el estado",
  },
] as const;

export default function RecursosPage() {
  return (
    <PublicPageShell
      title="Recursos"
      intro="Consulta contenidos, herramientas y novedades desde páginas dedicadas. Aquí solo se muestran categorías y recursos que ya existen en el sitio."
      path="/recursos"
      description={DESCRIPTION}
      pageType="CollectionPage"
      breadcrumbs={[{ name: "Recursos", path: "/recursos" }]}
      headerAction={{ href: "/contacto", label: "Contacto" }}
    >
      <section aria-label="Categorías de recursos" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {RESOURCE_GROUPS.map((group) => (
          <ResourceVisualCard key={group.href} {...group} />
        ))}
      </section>
    </PublicPageShell>
  );
}
