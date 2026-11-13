import type { Metadata } from "next";
import { LegalDocPage } from "@/components/LegalPage";
import { getRetracto } from "@/lib/legal-content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Retracto y reembolsos · El Gallinero" };

export default function RetractoPage() {
  return <LegalDocPage doc={getRetracto()} />;
}
