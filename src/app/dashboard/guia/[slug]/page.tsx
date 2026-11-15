import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideArticleView } from "@/components/guide/GuideArticleView";
import { getGuide, guides } from "@/lib/guide-data";
import { canonicalUrlFor, fitSeoDescription, fitSeoTitle } from "@/lib/seo";

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
    return {
      title: "Guía no encontrada · El Gallinero",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: fitSeoTitle(guide.title),
    description: fitSeoDescription(guide.summary),
    alternates: { canonical: canonicalUrlFor(`/guia/${slug}`) },
    robots: { index: false, follow: false },
  };
}

export default async function DashboardGuiaArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getGuide(slug)) {
    notFound();
  }
  return <GuideArticleView slug={slug} basePath="/dashboard/guia" />;
}
