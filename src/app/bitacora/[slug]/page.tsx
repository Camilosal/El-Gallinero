import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageShell } from "@/components/LegalPage";
import {
  BITACORA_ARTICLES,
  BITACORA_CADENCE_NOTE,
  BITACORA_CTA_LABEL,
  countArticleWords,
  getBitacoraArticleBySlug,
  getRelatedBitacoraArticles,
} from "@/lib/bitacora-content";
import { NORMATIVE_CATALOG } from "@/lib/normative-catalog";
import {
  buildPageMetadata,
  canonicalUrlFor,
  ENTITY_IDS,
  fitSeoDescription,
  fitSeoTitle,
  toAbsoluteUrl,
} from "@/lib/seo";

const RELATED_GUIDE_MAP: Record<string, { href: string; label: string }> = {
  "cuanto-cuesta-producir-un-huevo": {
    href: "/guia/balance-financiero",
    label: "Guía: balance, punto de equilibrio y finanzas por especie",
  },
  "tiempos-de-retiro-medicamentos-veterinarios": {
    href: "/guia/control-sanitario",
    label: "Guía: control sanitario ICA y bloqueo por tiempos de retiro",
  },
  "clasificacion-de-huevo-ntc-1240": {
    href: "/guia/recoger-huevos",
    label: "Guía: postura diaria, calibres NTC 1240 e inventario PEPS",
  },
  "registrar-en-la-finca-sin-senal": {
    href: "/guia/modo-offline-voz",
    label: "Guía: registro rápido en galpón y modo sin señal offline-first",
  },
  "compostaje-de-gallinaza": {
    href: "/guia/compostaje",
    label: "Guía: pilas de compostaje de gallinaza y manejo térmico",
  },
};

export function generateStaticParams() {
  return BITACORA_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getBitacoraArticleBySlug(slug);
  if (!article) {
    return {
      title: "Artículo no encontrado · IwaGranja",
    };
  }
  const publishedIso = `${article.publishedAt}T09:00:00-05:00`;
  const modifiedIso = `${article.reviewedAt}T09:00:00-05:00`;
  return buildPageMetadata({
    title: fitSeoTitle(article.title),
    description: fitSeoDescription(article.summary),
    path: `/bitacora/${article.slug}`,
    ogImage: article.image.src,
    ogImageAlt: article.image.alt,
    ogType: "article",
    publishedTime: publishedIso,
    modifiedTime: modifiedIso,
  });
}

export default async function BitacoraArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getBitacoraArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  const words = countArticleWords(article);
  const canonical = canonicalUrlFor(`/bitacora/${article.slug}`);
  const publishedIso = `${article.publishedAt}T09:00:00-05:00`;
  const modifiedIso = `${article.reviewedAt}T09:00:00-05:00`;
  const otherArticles = getRelatedBitacoraArticles(article, 3);
  const relatedGuide = RELATED_GUIDE_MAP[article.slug] ?? {
    href: `/guia/${article.relatedGuideSlug}`,
    label: "Explorar la guía práctica relacionada en IwaGranja",
  };
  const relatedNorms = article.relatedNormIds
    .map((normId) => NORMATIVE_CATALOG.find((item) => item.id === normId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const articleJsonLd = {
    "@type": "TechArticle",
    "@id": `${canonical}#article`,
    headline: article.title.slice(0, 110),
    description: article.summary,
    image: toAbsoluteUrl(article.image.src),
    datePublished: publishedIso,
    dateModified: modifiedIso,
    inLanguage: "es-CO",
    author: { "@id": ENTITY_IDS.person },
    publisher: { "@id": ENTITY_IDS.organization },
    mainEntityOfPage: { "@id": `${canonical}#webpage` },
    about: [
      { "@type": "Thing", name: article.category },
      ...article.topics.map((topic) => ({ "@type": "Thing", name: topic })),
    ],
  };

  return (
    <PublicPageShell
      title={article.title}
      intro={article.subtitle}
      path={`/bitacora/${article.slug}`}
      description={fitSeoDescription(article.summary)}
      breadcrumbs={[
        { name: "Bitácora", path: "/bitacora" },
        { name: article.title, path: `/bitacora/${article.slug}` },
      ]}
      extraJsonLdNodes={[articleJsonLd]}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/bitacora"
          className="inline-flex min-h-[40px] items-center text-sm font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-950"
        >
          ← Volver a la bitácora
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-900">
            {article.category}
          </span>
          <span>
            Por{" "}
            <a
              href="https://camilosaldarriaga.com"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-900 underline underline-offset-2"
            >
              Camilo Saldarriaga
            </a>
          </span>
          <span>·</span>
          <span>Publicado y revisado: {article.publishedAt}</span>
          <span>·</span>
          <span>
            {article.readingMinutes} min de lectura ({words} palabras)
          </span>
        </div>
      </div>

      <article className="space-y-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-8">
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-base leading-relaxed text-slate-700 font-medium">{article.summary}</p>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                {article.realFarmData.label}
              </p>
              <p className="text-sm leading-relaxed text-emerald-950">
                {article.realFarmData.fact}
              </p>
              <dl className="border-t border-emerald-200/80 pt-2.5 space-y-1 text-xs text-emerald-950/90">
                <div>
                  <dt className="inline font-semibold">Período y muestra: </dt>
                  <dd className="inline">
                    {article.realFarmData.observationPeriod} · {article.realFarmData.contextAndSample}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Método: </dt>
                  <dd className="inline">{article.realFarmData.unitAndMethod}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Fuente y revisión: </dt>
                  <dd className="inline">
                    {article.realFarmData.sourceRef} ({article.realFarmData.reviewedBy}, rev.{" "}
                    {article.realFarmData.reviewedAt})
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Alcance y límites: </dt>
                  <dd className="inline">{article.realFarmData.limitations}</dd>
                </div>
              </dl>
            </div>
          </div>

          <figure className="lg:col-span-7 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={article.image.src}
                alt={article.image.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 580px"
                className="object-cover"
                priority
              />
            </div>
            <figcaption className="border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
              {article.image.alt}
            </figcaption>
          </figure>
        </div>

        <div className="space-y-6">
          {article.sections.map((section) => (
            <section key={section.heading} className="space-y-2.5">
              <h2 className="text-lg font-bold text-slate-900">{section.heading}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index} className="text-sm leading-relaxed text-slate-700 sm:text-base">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <section
          aria-labelledby="lecturas-relacionadas"
          className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3"
        >
          <h2 id="lecturas-relacionadas" className="text-base font-bold text-slate-900">
            Guías y lecturas relacionadas en IwaGranja
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href={relatedGuide.href}
                className="font-semibold text-emerald-800 underline underline-offset-4 hover:text-emerald-950"
              >
                {relatedGuide.label} →
              </Link>
            </li>
            {otherArticles.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/bitacora/${other.slug}`}
                  className="text-slate-800 underline underline-offset-4 hover:text-emerald-800"
                >
                  {other.title}
                </Link>
              </li>
            ))}
            {relatedNorms.length > 0 && (
              <li className="pt-1 text-xs text-slate-700">
                <span className="font-semibold text-slate-800">Referencias normativas y técnicas: </span>
                {relatedNorms.map((norm, idx) => (
                  <span key={norm.id}>
                    {idx > 0 ? " · " : ""}
                    <a
                      href={norm.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-emerald-800"
                    >
                      {norm.code}
                    </a>
                  </span>
                ))}
              </li>
            )}
            <li>
              <Link
                href="/planes"
                className="text-slate-700 underline underline-offset-4 hover:text-emerald-800"
              >
                Comparar planes por ciclo productivo en pesos colombianos (COP)
              </Link>
            </li>
          </ul>
        </section>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-bold">¿Quieres llevar estos controles directo en tu finca?</p>
              <p className="mt-1 text-sm text-slate-300">
                Empieza sin señal en el galpón y revisa tu costo real desde el primer día.{" "}
                {BITACORA_CADENCE_NOTE}
              </p>
            </div>
            <Link
              href="/registro"
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300"
            >
              {BITACORA_CTA_LABEL}
            </Link>
          </div>
        </div>
      </article>
    </PublicPageShell>
  );
}
