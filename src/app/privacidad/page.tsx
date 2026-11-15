import type { Metadata } from "next";
import { LegalDocPage } from "@/components/LegalPage";
import { getPrivacidad } from "@/lib/legal-content";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const TITLE = "Tratamiento de datos (Ley 1581) · El Corral";
const DESCRIPTION =
  "Política de tratamiento de datos personales conforme a la Ley 1581 y Decreto 090 en Colombia: derechos del titular, seguridad y analítica.";

export const metadata: Metadata = buildPageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/privacidad",
});

export default function PrivacidadPage() {
  return <LegalDocPage doc={getPrivacidad()} path="/privacidad" description={DESCRIPTION} />;
}
