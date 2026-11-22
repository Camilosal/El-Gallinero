import type { Metadata } from "next";
import { LegalDocPage } from "@/components/LegalPage";
import { getRetracto } from "@/lib/legal-content";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "Retracto, cambios y reembolsos · IwaGranja";
const DESCRIPTION =
  "Cómo ejercer el derecho de retracto en los 5 días hábiles siguientes al pago por Nequi, Daviplata o PSE y enlace directo a la SIC.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/retracto",
});

export default function RetractoPage() {
  return <LegalDocPage doc={getRetracto()} path="/retracto" description={DESCRIPTION} />;
}
