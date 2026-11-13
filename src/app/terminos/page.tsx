import type { Metadata } from "next";
import { LegalDocPage } from "@/components/LegalPage";
import { getTerminos } from "@/lib/legal-content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Términos y condiciones · El Gallinero" };

export default function TerminosPage() {
  return <LegalDocPage doc={getTerminos()} />;
}
