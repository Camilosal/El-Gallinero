import type { Metadata } from "next";
import { GuideIndexView } from "@/components/guide/GuideIndexView";
import { JsonLd } from "@/components/JsonLd";
import { buildJsonLd, buildPageMetadata } from "@/lib/seo";

const TITLE = "Manual y guía de uso paso a paso · IwaGranja";
const DESCRIPTION =
  "Guía ilustrada paso a paso con pantallazos reales de cada módulo, escáner QR, modo sin señal, sanidad ICA, inventarios y finanzas.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/guia",
  ogImage: "/images/guia/inicio-dashboard.webp",
  ogImageAlt: "Manual completo de uso de IwaGranja: 8 módulos reales y 2 guías complementarias",
});

export default function StandaloneGuiaPage() {
  const jsonLd = buildJsonLd({
    path: "/guia",
    title: TITLE,
    description: DESCRIPTION,
    pageType: "CollectionPage",
    ogImage: "/images/guia/inicio-dashboard.webp",
    breadcrumbs: [{ name: "Manual de uso", path: "/guia" }],
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      <GuideIndexView basePath="/guia" />
    </>
  );
}
