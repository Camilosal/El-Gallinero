import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { buildJsonLd, buildPageMetadata, buildSoftwareNode } from "@/lib/seo";

const TITLE = "Crear granja gratis en 3 minutos · El Gallinero";
const DESCRIPTION =
  "Crea tu espacio aislado de granja en El Gallinero: 30 días completos y 1 lote gratis permanente, sin tarjeta de crédito y con modo sin señal.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/registro",
  ogImage: "/images/guia/inicio-dashboard.webp",
  ogImageAlt: "Registro gratuito de granja en El Gallinero",
});

export default function RegistroLayout({ children }: { children: ReactNode }) {
  const jsonLd = buildJsonLd({
    path: "/registro",
    title: TITLE,
    description: DESCRIPTION,
    pageType: "WebPage",
    breadcrumbs: [{ name: "Crear granja gratis", path: "/registro" }],
    extraNodes: [buildSoftwareNode()],
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      {children}
    </>
  );
}
