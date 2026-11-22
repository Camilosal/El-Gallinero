import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

const FOOTER_LINK_CLASS =
  "underline underline-offset-4 decoration-[var(--iw-semantic-border-default)] hover:decoration-current hover:text-[var(--iw-semantic-action-primary)] py-0.5 inline-flex items-center transition-colors";

/** Pie con identidad del vendedor y documentos legales. */
export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] py-6 text-xs text-[var(--iw-semantic-text-secondary)] ${className}`}
    >
      <div className="max-w-[var(--iw-size-container,1160px)] mx-auto px-4 sm:px-7 space-y-2.5">
        <p className="flex flex-wrap items-center gap-2">
          <BrandLogo
            variant="square"
            size={32}
            decorative
            className="rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] p-0.5 border border-[var(--iw-semantic-border-default)]"
          />
          <span>
            <strong className="text-[var(--iw-semantic-text-primary)]">{LEGAL.marca}</strong> · Operado por{" "}
            {LEGAL.razonSocial} · NIT/RUT {LEGAL.nit} · {LEGAL.ciudad} · {LEGAL.email}
          </span>
        </p>
        <nav aria-label="Información legal y de ayuda" className="flex flex-wrap gap-x-4 gap-y-1 font-medium">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={FOOTER_LINK_CLASS}>
              {l.label}
            </Link>
          ))}
          <Link href="/funcionalidades" className={FOOTER_LINK_CLASS}>Funcionalidades</Link>
          <Link href="/realidad-campo" className={FOOTER_LINK_CLASS}>Realidad del campo</Link>
          <Link href="/planes" className={FOOTER_LINK_CLASS}>Planes</Link>
          <Link href="/recursos" className={FOOTER_LINK_CLASS}>Recursos</Link>
          <Link href="/bitacora" className={FOOTER_LINK_CLASS}>Artículos y bitácoras</Link>
          <Link href="/recursos/herramientas" className={FOOTER_LINK_CLASS}>Herramientas y calculadoras</Link>
          <Link href="/recursos/novedades" className={FOOTER_LINK_CLASS}>Noticias y novedades</Link>
          <Link href="/guia" className={FOOTER_LINK_CLASS}>Guía de uso</Link>
          <Link href="/open-source" className={FOOTER_LINK_CLASS}>Open Source</Link>
          <Link href="/ayuda" className={FOOTER_LINK_CLASS}>Ayuda</Link>
          <Link href="/contacto" className={FOOTER_LINK_CLASS}>Contacto</Link>
          <Link href="/nosotros" className={FOOTER_LINK_CLASS}>Nosotros</Link>
        </nav>
      </div>
    </footer>
  );
}
