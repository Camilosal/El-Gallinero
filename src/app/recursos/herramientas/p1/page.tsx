import type { Metadata } from "next";
import { PublicPageShell } from "@/components/LegalPage";
import { ProjectFormulator } from "@/components/project-templates/ProjectFormulator";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Diseño de Proyectos Rurales con Producción Animal · IwaGranja";
const DESCRIPTION =
  "Adapta siete modelos de proyecto para integrar producción animal de pequeña escala en objetivos de alimentación, medios de vida, capacidades productivas, mercados y sostenibilidad rural.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/recursos/herramientas/p1",
});

export default function P1PublicTemplatePage() {
  return (
    <PublicPageShell
      title="Diseño de Proyectos Rurales con Producción Animal"
      intro="Elige el propósito principal de la intervención, parte de un modelo preconfigurado y adapta la ficha al territorio para conversar con un posible aliado."
      path="/recursos/herramientas/p1"
      description={DESCRIPTION}
      headerAction={{ href: "/recursos", label: "Todos los recursos" }}
    >
      <ProjectFormulator surface="public" />
    </PublicPageShell>
  );
}
