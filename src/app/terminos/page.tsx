import type { Metadata } from "next";
import { LegalDocPage } from "@/components/LegalPage";
import { getTerminos } from "@/lib/legal-content";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "Términos y condiciones de uso · IwaGranja";
const DESCRIPTION =
  "Condiciones del servicio de IwaGranja en Colombia: planes en COP con IVA, renovación voluntaria sin cobros automáticos y propiedad de datos.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/terminos",
});

export default function TerminosPage() {
  return <LegalDocPage doc={getTerminos()} path="/terminos" description={DESCRIPTION} />;
}
