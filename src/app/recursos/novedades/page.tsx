import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { PublicPageShell } from "@/components/LegalPage";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Noticias y novedades · IwaGranja";
const DESCRIPTION =
  "Consulta las noticias y novedades publicadas sobre IwaGranja. Esta página muestra con claridad cuando aún no hay publicaciones.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/recursos/novedades",
  ogImage: "/hero-illustration.png",
  ogImageAlt: "Ilustración institucional de IwaGranja",
});

export default function NovedadesPage() {
  return (
    <PublicPageShell
      title="Noticias y novedades"
      intro="Aquí se reúnen anuncios y actualizaciones publicados por el proyecto."
      path="/recursos/novedades"
      description={DESCRIPTION}
      pageType="CollectionPage"
      breadcrumbs={[
        { name: "Recursos", path: "/recursos" },
        { name: "Noticias y novedades", path: "/recursos/novedades" },
      ]}
    >
      <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-labelledby="novedades-vacias">
        <div className="relative min-h-56 bg-[var(--forest-deep)] sm:min-h-72">
          <Image
            src="/hero-illustration.png"
            alt="Ilustración institucional de IwaGranja para identificar el espacio de noticias"
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover opacity-90"
          />
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <Newspaper className="h-6 w-6 text-emerald-800" aria-hidden="true" />
          <h2 id="novedades-vacias" className="mt-3 text-xl font-bold text-slate-900">
            Aún no hay novedades publicadas
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Esta sección no contiene publicaciones por ahora. Cuando el proyecto publique una noticia o actualización, aparecerá aquí con su fecha y contenido.
          </p>
          <Link href="/recursos" className="mt-5 inline-flex min-h-10 w-fit items-center gap-1.5 font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-950">
            Volver a recursos<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
