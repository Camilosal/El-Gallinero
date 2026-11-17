import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PublicPageShell } from "@/components/LegalPage";
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
    </PublicPageShell>
  );
}
