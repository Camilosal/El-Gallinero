import { notFound } from "next/navigation";
import { GuideArticleView } from "@/components/guide/GuideArticleView";
import { getGuide, guides } from "@/lib/guide-data";

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
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
