import type { Metadata } from "next";
import { PublicPageShell } from "@/components/LegalPage";
import { NOSOTROS_TEXT } from "@/lib/legal-content";

export const metadata: Metadata = { title: "Nosotros · El Gallinero" };

export default function NosotrosPage() {
  return (
    <PublicPageShell title="Nosotros">
      <p className="text-slate-700 leading-relaxed text-lg">{NOSOTROS_TEXT}</p>
      <p className="mt-6">
        <a
          href="https://iwage.co"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-emerald-800 underline underline-offset-2"
        >
          Conoce la historia completa en iwage.co →
        </a>
      </p>
    </PublicPageShell>
  );
}
