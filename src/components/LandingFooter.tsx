import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { APP_DEVELOPER } from "@/lib/branding";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

const FOOTER_GROUPS = [
  {
    title: "La app",
    links: [
      { href: "/#como-funciona", label: "Cómo funciona" },
      { href: "/#modulos", label: "Módulos y normas" },
      { href: "/funcionalidades", label: "Todas las funcionalidades" },
      { href: "/realidad-campo", label: "Realidad del campo" },
    ],
  },
  {
    title: "Planes y recursos",
    links: [
      { href: "/planes", label: "Planes" },
      { href: "/recursos", label: "Centro de recursos" },
      { href: "/recursos#articulos", label: "Artículos y bitácoras" },
      { href: "/recursos#herramientas", label: "Herramientas y calculadoras" },
      { href: "/recursos#novedades", label: "Noticias y novedades" },
    ],
  },
  {
    title: "Más · información, ayuda y legal",
    links: [
      { href: "/nosotros", label: "Quiénes somos" },
      { href: "/open-source", label: "Código abierto" },
      { href: "/contacto", label: "Contacto y acompañamiento" },
      { href: "/ayuda", label: "Ayuda y preguntas frecuentes" },
      ...LEGAL_LINKS,
    ],
  },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          <div>
            <Link
              href="#top"
              aria-label="IwaGranja — Volver arriba"
              className="inline-flex items-center gap-3 font-display text-lg font-bold tracking-tight text-[var(--ink)]"
            >
              <BrandLogo
                variant="square"
                size={76}
                className="rounded-2xl bg-white/95 p-1.5 border border-[var(--line)] shadow-xs"
              />
            </Link>
            <p className="mt-2 text-sm text-[var(--moss)]">
              Tu granja, todo bajo control · Gestión para granjas mixtas en Colombia.
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

          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--forest)]">{group.title}</h2>
              <ul className="mt-2 space-y-1 text-sm text-[var(--moss)]">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={FOOTER_LINK_CLASS}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
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
