import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LegalFooter } from "@/components/LegalFooter";
import type { LegalDocument } from "@/lib/legal-content";
import { legalIsDraft } from "@/lib/legal";

export function PublicPageShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--cream,#faf6ec)] flex flex-col">
      <header className="border-b border-[var(--line,#e5dfcf)] bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-slate-900 min-h-[44px]">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            El Gallinero
          </Link>
          <Link href="/registro" className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800">
            Crear granja gratis
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
        {intro && <p className="mt-2 text-slate-600 leading-relaxed">{intro}</p>}
        <div className="mt-6">{children}</div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalDocPage({ doc }: { doc: LegalDocument }) {
  return (
    <PublicPageShell title={doc.title} intro={doc.intro}>
      {legalIsDraft() && (
        <div
          role="note"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <strong>Borrador pendiente de revisión legal.</strong> Los datos marcados
          como «[por confirmar]» se completan con la información real del operador
          antes del primer pago.
        </div>
      )}
      <div className="space-y-6">
        {doc.sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-2 text-slate-700 leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </PublicPageShell>
  );
}

