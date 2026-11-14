import Link from "next/link";
import { LEGAL_LINKS } from "@/lib/legal";

/** Enlaces legales sin datos de entorno: seguro para páginas cliente (login, registro). */
export function LegalLinksBar({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Información legal"
      className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-600 ${className}`}
    >
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="underline underline-offset-4 decoration-slate-300 hover:decoration-slate-700 hover:text-slate-900 min-h-[32px] inline-flex items-center">
          {l.label}
        </Link>
      ))}
      <Link href="/contacto" className="underline underline-offset-4 decoration-slate-300 hover:decoration-slate-700 hover:text-slate-900 min-h-[32px] inline-flex items-center">Contacto</Link>
    </nav>
  );
}
