import Link from "next/link";
import { LEGAL, LEGAL_LINKS, SIC_LABEL, SIC_URL } from "@/lib/legal";

/** Pie con identidad del vendedor, documentos legales y enlace a la SIC. */
export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-[var(--line,#e5dfcf)] bg-white/70 py-6 text-xs text-slate-600 ${className}`}
    >
      <div className="max-w-5xl mx-auto px-4 space-y-3">
        <p>
          <strong className="text-slate-900">{LEGAL.marca}</strong> · Operado por{" "}
          {LEGAL.razonSocial} · NIT/RUT {LEGAL.nit} · {LEGAL.ciudad} · {LEGAL.email}
        </p>
        <nav aria-label="Información legal y de ayuda" className="flex flex-wrap gap-x-5 gap-y-1 font-medium">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="underline underline-offset-2 hover:text-slate-900 min-h-[32px] inline-flex items-center">
              {l.label}
            </Link>
          ))}
          <Link href="/ayuda" className="hover:text-slate-900 min-h-[32px] inline-flex items-center">Ayuda</Link>
          <Link href="/contacto" className="hover:text-slate-900 min-h-[32px] inline-flex items-center">Contacto</Link>
          <Link href="/nosotros" className="hover:text-slate-900 min-h-[32px] inline-flex items-center">Nosotros</Link>
          <a href={SIC_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-slate-900 min-h-[32px] inline-flex items-center">
            {SIC_LABEL}
          </a>
        </nav>
      </div>
    </footer>
  );
}

