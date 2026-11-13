import type { Metadata } from "next";
import { LegalDocPage } from "@/components/LegalPage";
import { getPrivacidad } from "@/lib/legal-content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tratamiento de datos · El Gallinero" };

export default function PrivacidadPage() {
  return <LegalDocPage doc={getPrivacidad()} />;
}
