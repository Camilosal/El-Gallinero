import type { Metadata } from "next";
import { PublicPageShell } from "@/components/LegalPage";
import InteractivePricingPage from "@/components/pricing/InteractivePricingPage";
import { buildPageMetadata, buildSoftwareNode } from "@/lib/seo";

const TITLE = "Planes de IwaGranja";
const DESCRIPTION =
  "Compara los planes Gratis, Productor, Organización y A la medida. Calcula el costo según el tamaño y la duración del servicio.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/planes",
  ogImage: "/images/guia/finanzas-presupuestos.webp",
  ogImageAlt: "Planes y suscripciones de IwaGranja",
});

export default function PlanesIndexPage() {
  return (
    <PublicPageShell
      title="Planes de IwaGranja"
      intro="Elige el plan para tu granja o proyecto y calcula su costo."
      path="/planes"
      description={DESCRIPTION}
      extraJsonLdNodes={[buildSoftwareNode()]}
    >
      <InteractivePricingPage />
    </PublicPageShell>
  );
}
