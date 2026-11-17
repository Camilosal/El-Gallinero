import type { Metadata } from "next";
import { PublicPageShell } from "@/components/LegalPage";
import { P1ProjectTemplateMock } from "@/components/project-templates/P1ProjectTemplateMock";
import { buildPageMetadata } from "@/lib/seo";

const TITLE = "Plantilla P1: seguridad y autonomía alimentaria · IwaGranja";
const DESCRIPTION =
  "Personaliza una ficha inicial para formular proyectos de seguridad y autonomía alimentaria. Organiza población, componentes, plan de implementación y medición.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/recursos/herramientas/p1",
});

export default function P1PublicTemplatePage() {
  return (
    <PublicPageShell
      title="Plantilla P1 · Seguridad y autonomía alimentaria"
      intro="Parte del cambio que busca el proyecto, ajusta la ficha al territorio y prepara un plan preliminar para conversar con un posible aliado."
      path="/recursos/herramientas/p1"
      description={DESCRIPTION}
      headerAction={{ href: "/recursos", label: "Todos los recursos" }}
    >
      <P1ProjectTemplateMock surface="public" />
    </PublicPageShell>
  );
}
