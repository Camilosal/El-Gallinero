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
          className="inline-flex min-h-[40px] items-center text-sm font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]"
        >
          ← Volver a la bitácora
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--iw-semantic-text-secondary)]">
          <span className="rounded-full bg-[var(--iw-semantic-bg-page)] px-2.5 py-0.5 text-[var(--iw-semantic-text-primary)]">
            {article.category}
          </span>
          <span>
            Por{" "}
            <a
              href="https://camilosaldarriaga.com"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--iw-semantic-text-primary)] underline underline-offset-2"
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

      <article className="space-y-8 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-5 shadow-xs sm:p-8">
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-base leading-relaxed text-[var(--iw-semantic-text-primary)] font-medium">{article.summary}</p>
            <div className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)] p-4 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--iw-semantic-text-primary)]">
                {article.realFarmData.label}
              </p>
              <p className="text-sm leading-relaxed text-[var(--iw-semantic-text-primary)]">
                {article.realFarmData.fact}
              </p>
              <dl className="border-t border-[var(--iw-semantic-border-default)] pt-2.5 space-y-1 text-xs text-[var(--iw-semantic-text-primary)]">
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

          <figure className="lg:col-span-7 overflow-hidden rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)]">
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
            <figcaption className="border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-4 py-2.5 text-xs text-[var(--iw-semantic-text-secondary)]">
              {article.image.alt}
            </figcaption>
          </figure>
        </div>

        <div className="space-y-6">
          {article.sections.map((section) => (
            <section key={section.heading} className="space-y-2.5">
              <h2 className="text-lg font-bold text-[var(--iw-semantic-text-primary)]">{section.heading}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index} className="text-sm leading-relaxed text-[var(--iw-semantic-text-primary)] sm:text-base">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        {article.sources && article.sources.length > 0 && (
          <section aria-labelledby="fuentes-oficiales" className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-5 space-y-3">
            <h2 id="fuentes-oficiales" className="text-base font-bold text-[var(--iw-semantic-text-primary)]">
              Fuentes oficiales y técnicas
            </h2>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--iw-semantic-action-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]">
                    {source.institution}: {source.title} ↗
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          aria-labelledby="lecturas-relacionadas"
          className="rounded-xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] p-5 space-y-3"
        >
          <h2 id="lecturas-relacionadas" className="text-base font-bold text-[var(--iw-semantic-text-primary)]">
            Guías y lecturas relacionadas en IwaGranja
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href={relatedGuide.href}
                className="font-semibold text-[var(--iw-semantic-action-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]"
              >
                {relatedGuide.label} →
              </Link>
            </li>
            {otherArticles.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/bitacora/${other.slug}`}
                  className="text-[var(--iw-semantic-text-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]"
                >
                  {other.title}
                </Link>
              </li>
            ))}
            {relatedNorms.length > 0 && (
              <li className="pt-1 text-xs text-[var(--iw-semantic-text-primary)]">
                <span className="font-semibold text-[var(--iw-semantic-text-primary)]">Referencias normativas y técnicas: </span>
                {relatedNorms.map((norm, idx) => (
                  <span key={norm.id}>
                    {idx > 0 ? " · " : ""}
                    <a
                      href={norm.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]"
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
                className="text-[var(--iw-semantic-text-primary)] underline underline-offset-4 hover:text-[var(--iw-semantic-action-primary-hover)]"
              >
                Calcular el costo de los planes actuales de IwaGranja en pesos colombianos (COP)
              </Link>
            </li>
          </ul>
        </section>

        <div className="mt-8 rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-color-forest-dark)] p-6 text-[var(--iw-color-white)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-bold">¿Quieres llevar estos controles directo en tu finca?</p>
              <p className="mt-1 text-sm text-[var(--iw-color-paper)]">
                Empieza sin señal en el galpón y revisa tu costo real desde el primer día.{" "}
                {BITACORA_CADENCE_NOTE}
              </p>
            </div>
            <Link
              href="/registro"
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-xl bg-[var(--iw-color-paper)] px-5 py-3 text-sm font-extrabold text-[var(--iw-color-ink-strong)] transition hover:bg-[var(--iw-color-white)]"
            >
              {BITACORA_CTA_LABEL}
            </Link>
          </div>
        </div>
      </article>
    </PublicPageShell>
  );
}
