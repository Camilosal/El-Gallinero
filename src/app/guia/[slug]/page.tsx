import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideArticleView } from "@/components/guide/GuideArticleView";
import { JsonLd } from "@/components/JsonLd";
import { getGuide, guides } from "@/lib/guide-data";
import {
  buildJsonLd,
  buildPageMetadata,
  canonicalUrlFor,
  ENTITY_IDS,
  fitSeoDescription,
  fitSeoTitle,
  toAbsoluteUrl,
} from "@/lib/seo";

function getGuideOgImage(slug: string): { src: string; alt: string } {
  const guide = getGuide(slug);
  const shot = guide?.sections.find((s) => s.type === "screenshot" && s.image);
  return {
    src: shot?.image || "/images/guia/inicio-dashboard.webp",
    alt: shot?.alt || guide?.title || "Manual de uso de El Corral",
  };
}

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    return { title: "Guía no encontrada · El Corral" };
  }
  const image = getGuideOgImage(slug);
  return buildPageMetadata({
    title: fitSeoTitle(guide.title),
    description: fitSeoDescription(guide.summary),
    path: `/guia/${slug}`,
    ogImage: image.src,
    ogImageAlt: image.alt,
    ogType: "article",
  });
}

export default async function StandaloneGuiaArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    notFound();
  }

  const image = getGuideOgImage(slug);
  const path = `/guia/${slug}`;
  const canonical = canonicalUrlFor(path);
  const jsonLd = buildJsonLd({
    path,
    title: guide.title,
    description: fitSeoDescription(guide.summary),
    ogImage: image.src,
    breadcrumbs: [
      { name: "Manual de uso", path: "/guia" },
      { name: guide.title, path },
    ],
    extraNodes: [
      {
        "@type": "TechArticle",
        "@id": `${canonical}#article`,
        headline: guide.title.slice(0, 110),
        description: guide.summary,
        image: toAbsoluteUrl(image.src),
        inLanguage: "es-CO",
        author: { "@id": ENTITY_IDS.person },
        publisher: { "@id": ENTITY_IDS.organization },
        mainEntityOfPage: { "@id": `${canonical}#webpage` },
      },
    ],
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      <GuideArticleView slug={slug} basePath="/guia" />
    </>
  );
}
