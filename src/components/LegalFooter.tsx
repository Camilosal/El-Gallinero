import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

const FOOTER_LINK_CLASS =
  "underline underline-offset-4 decoration-slate-300 hover:decoration-slate-700 hover:text-slate-900 py-0.5 inline-flex items-center transition-colors";

/** Pie con identidad del vendedor y documentos legales. */
export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-[var(--line,#e5dfcf)] bg-white/70 py-5 text-xs text-slate-600 ${className}`}
    >
      <div className="max-w-[1080px] mx-auto px-4 sm:px-7 space-y-2">
        <p className="flex flex-wrap items-center gap-2">
          <BrandLogo
            variant="mark"
            size={22}
            decorative
            className="rounded-md border border-slate-200"
          />
          <span>
            <strong className="text-slate-900">{LEGAL.marca}</strong> · Operado por{" "}
            {LEGAL.razonSocial} · NIT/RUT {LEGAL.nit} · {LEGAL.ciudad} · {LEGAL.email}
          </span>
        </p>
        <nav aria-label="Información legal y de ayuda" className="flex flex-wrap gap-x-4 gap-y-1 font-medium">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={FOOTER_LINK_CLASS}>
              {l.label}
            </Link>
          ))}
          <Link href="/realidad-campo" className={FOOTER_LINK_CLASS}>Realidad del campo</Link>
          <Link href="/planes" className={FOOTER_LINK_CLASS}>Planes</Link>
          <Link href="/bitacora" className={FOOTER_LINK_CLASS}>Bitácora</Link>
          <Link href="/open-source" className={FOOTER_LINK_CLASS}>Open Source</Link>
          <Link href="/ayuda" className={FOOTER_LINK_CLASS}>Ayuda</Link>
          <Link href="/contacto" className={FOOTER_LINK_CLASS}>Contacto</Link>
          <Link href="/nosotros" className={FOOTER_LINK_CLASS}>Nosotros</Link>
        </nav>
      </div>
    </footer>
  );
}

