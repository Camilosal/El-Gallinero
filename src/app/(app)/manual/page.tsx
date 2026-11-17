import type { Metadata } from "next";
import { GuideIndexView } from "@/components/guide/GuideIndexView";
import { canonicalUrlFor } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Manual y guía de uso · Panel IwaGranja",
  description:
    "Guía ilustrada paso a paso dentro del panel operativo de IwaGranja.",
  alternates: { canonical: canonicalUrlFor("/guia") },
  robots: { index: false, follow: false },
};

export default function DashboardGuiaIndexPage() {
  return <GuideIndexView basePath="/manual" />;
}
