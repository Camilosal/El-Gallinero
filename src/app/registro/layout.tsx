import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { buildJsonLd, buildPageMetadata, buildSoftwareNode } from "@/lib/seo";

const TITLE = "Crear granja gratis en 3 minutos · IwaGranja";
const DESCRIPTION =
  "Crea tu granja con el plan Gratis de IwaGranja: 1 usuario, 1 localización y 1 lote activo por especie, sin tarjeta y con modo sin señal.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/registro",
  ogImage: "/images/guia/inicio-dashboard.webp",
  ogImageAlt: "Registro gratuito de granja en IwaGranja",
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
