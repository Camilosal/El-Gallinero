import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideArticleView } from "@/components/guide/GuideArticleView";
import { getGuide, guides } from "@/lib/guide-data";

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
    return { title: "Guía no encontrada · Manual El Gallinero" };
  }
  return {
    title: `${guide.title} · Manual El Gallinero`,
    description: guide.summary,
  };
}

export default async function StandaloneGuiaArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getGuide(slug)) {
    notFound();
  }
  return <GuideArticleView slug={slug} basePath="/guia" />;
}

