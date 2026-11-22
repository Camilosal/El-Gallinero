import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
import { ResourceVisualCard } from "@/components/ResourceVisualCard";
import {
  BITACORA_ARTICLES,
  BITACORA_CADENCE_NOTE,
  BITACORA_CTA_LABEL,
  countArticleWords,
} from "@/lib/bitacora-content";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Bitácora de campo · IwaGranja";
const DESCRIPTION =
  "Guías prácticas de avicultura y granjas mixtas: costo por huevo, tiempos de retiro, NTC 1240, operación sin señal y compostaje de gallinaza.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/bitacora",
  ogImage: "/images/guia/finanzas-balance.webp",
  ogImageAlt: "Bitácora técnica de campo de IwaGranja",
});

export default function BitacoraPage() {
  return (
    <PublicPageShell
      title="Bitácora de campo"
      intro="Guías prácticas nacidas en el gallinero piloto de Ambalá (Ibagué) para llevar costos reales, sanidad verificable e inventario sin depender de la señal."
      path="/bitacora"
      description={DESCRIPTION}
      pageType="CollectionPage"
      breadcrumbs={[
        { name: "Recursos", path: "/recursos" },
        { name: "Artículos y bitácoras", path: "/bitacora" },
      ]}
      headerAction={{ href: "/recursos", label: "Todos los recursos" }}
    >
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-emerald-950">{BITACORA_CADENCE_NOTE}</p>
        <Link
          href="/registro"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          {BITACORA_CTA_LABEL}
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {BITACORA_ARTICLES.map((article) => {
          const words = countArticleWords(article);
          return (
            <article
              key={article.slug}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:border-emerald-300"
            >
              <Link href={`/bitacora/${article.slug}`} className="block bg-slate-100">
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <Image
                    src={article.image.src}
                    alt={article.image.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              </Link>

              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-900">
                    {article.category}
                  </span>
                  <span>{article.publishedAt}</span>
                  <span>·</span>
                  <span>{article.readingMinutes} min ({words} palabras)</span>
                </div>

                <h2 className="text-lg font-bold leading-snug text-slate-900">
                  <Link href={`/bitacora/${article.slug}`} className="hover:text-emerald-800">
                    {article.title}
                  </Link>
                </h2>

                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                  {article.summary}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <Link
                    href={`/bitacora/${article.slug}`}
                    className="inline-flex min-h-[40px] items-center text-sm font-bold text-emerald-800 underline underline-offset-4 hover:text-emerald-950"
                  >
                    Leer artículo completo
                  </Link>
                  <Link
                    href="/registro"
                    className="inline-flex min-h-[40px] items-center rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                  >
                    {BITACORA_CTA_LABEL}
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section aria-labelledby="bitacora-materiales" className="mt-10">
        <div className="mb-4 border-b border-slate-200 pb-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">Material relacionado</p>
          <h2 id="bitacora-materiales" className="mt-1 text-xl font-bold text-slate-900">Guías y documentación disponibles</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">Otros materiales existentes en el sitio para conocer el uso de la aplicación, el contexto de campo y el proyecto abierto.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ResourceVisualCard
            href="/guia"
            category="Manual de uso"
            title="Guía paso a paso de IwaGranja"
            summary="Recorre los módulos con instrucciones y capturas de referencia disponibles."
            image="/images/guia/inicio-dashboard.webp"
            imageAlt="Captura real del panel de inicio incluida en el manual de uso"
            actionLabel="Abrir la guía"
          />
          <ResourceVisualCard
            href="/realidad-campo"
            category="Contexto de campo"
            title="La realidad del campo y cómo se aborda"
            summary="Consulta los problemas operativos descritos y las respuestas que se pueden explorar en la aplicación."
            image="/images/heroes/guia-1x.webp"
            imageAlt="Imagen de portada usada en las páginas de guía de IwaGranja"
            actionLabel="Leer la página"
          />
          <ResourceVisualCard
            href="/open-source"
            category="Documentación del proyecto"
            title="Código abierto y participación"
            summary="Conoce el repositorio, las formas de participar y las opciones documentadas para desplegar el proyecto."
            image="/images/guia/configuracion-modulos.webp"
            imageAlt="Captura real de la configuración de módulos de IwaGranja incluida como referencia del proyecto"
            actionLabel="Conocer el proyecto"
          />
        </div>
      </section>
    </PublicPageShell>
  );
}
