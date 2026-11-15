import Link from "next/link";
import { APP_DEVELOPER } from "@/lib/branding";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

const EXPLORE_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#modulos", label: "Módulos y Normas" },
  { href: "/planes", label: "Planes" },
  { href: "/realidad-campo", label: "Realidad del campo" },
  { href: "/bitacora", label: "Bitácora" },
  { href: "/guia", label: "Guía de uso" },
  { href: "/open-source", label: "Open Source" },
  { href: "/nosotros", label: "Nosotros" },
] as const;

const HELP_LINKS = [
  { href: "/ayuda", label: "Ayuda" },
  { href: "/contacto", label: "Contacto" },
] as const;

const FOOTER_LINK_CLASS =
  "inline-block py-0.5 text-[var(--ink-soft)] hover:text-[var(--forest-deep)] underline underline-offset-4 decoration-[var(--line)] hover:decoration-current transition-colors";

/**
 * Pie único de la landing: marca y crédito, navegación y documentos legales.
 * Reemplaza la suma de footer comercial + LegalFooter en la página pública.
 */
export function LandingFooter() {
  return (
    <footer className="land-footer border-t border-[var(--line)] bg-[var(--paper)]">
      <div className="land-wrap">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          <div>
            <Link
              href="#top"
              className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight text-[var(--ink)]"
            >
              <span
                className="w-2.5 h-2.5 rounded-full bg-[var(--forest)]"
                aria-hidden="true"
              />
              El Corral
            </Link>
            <p className="mt-2 text-sm text-[var(--moss)]">
              Iwagé Granja · Gestión para granjas mixtas en Colombia.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--moss)]">
              Operado y desarrollado por{" "}
              <a
                href={APP_DEVELOPER.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--ink)] underline underline-offset-2 hover:text-[var(--forest)]"
              >
                {LEGAL.razonSocial}
              </a>
              <br />
              NIT/RUT {LEGAL.nit} · {LEGAL.ciudad} · {LEGAL.email}
            </p>
          </div>

          <nav aria-label="Explorar la plataforma">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--forest)]">
              Explorar
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-[var(--moss)]">
              {EXPLORE_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={FOOTER_LINK_CLASS}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--forest)]">
              Legal y ayuda
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-[var(--moss)]">
              {LEGAL_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={FOOTER_LINK_CLASS}>
                    {item.label}
                  </Link>
                </li>
              ))}
              {HELP_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={FOOTER_LINK_CLASS}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1 border-t border-[var(--line)] pt-3 text-xs text-[var(--moss)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {LEGAL.marca}
          </span>
          <span>Hecho en Ibagué, Tolima.</span>
        </div>
      </div>
    </footer>
  );
}
