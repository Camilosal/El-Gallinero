import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import LandingDesktopNav from "@/components/LandingDesktopNav";
import MobileNav from "@/components/MobileNav";

export interface PublicNavigationAction {
  href: string;
  label: string;
}

export function PublicNavigation({
  brandHref = "/",
  action = { href: "/registro", label: "Crear granja gratis" },
  sticky = true,
}: {
  brandHref?: string;
  action?: PublicNavigationAction | null;
  sticky?: boolean;
}) {
  return (
    <header className={`land-nav ${sticky ? "sticky top-0" : "land-nav-static"}`}>
      <div className="land-wrap flex items-center justify-between gap-4 py-2.5">
        <Link
          href={brandHref}
          aria-label="IwaGranja — Inicio"
          className="inline-flex shrink-0 items-center gap-2.5 rounded-[var(--iw-radius-control)] focus-visible:outline-2 focus-visible:outline-[var(--iw-color-paper)]"
        >
          <span className="inline-flex items-center rounded-[var(--iw-radius-control)] bg-[var(--iw-color-paper-light)] px-2.5 py-1 border border-white/25 shadow-xs">
            <BrandLogo
              variant="horizontal"
              height={36}
              className="h-8 w-auto sm:h-9"
            />
          </span>
          <span className="hidden lg:inline-block border-l border-white/25 pl-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--iw-color-paper)]">
            por Iwagé
          </span>
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          <LandingDesktopNav />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-[var(--iw-radius-control)] border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-[var(--iw-color-white)] transition hover:bg-white/20 sm:inline-flex"
          >
            Entrar
          </Link>
          {action && (
            <Link
              href={action.href}
              className="hidden min-h-11 items-center gap-1.5 rounded-[var(--iw-radius-control)] bg-[var(--iw-color-paper)] px-4 py-2 text-xs font-bold text-[var(--iw-color-ink-strong)] shadow-xs transition hover:bg-[var(--iw-color-white)] sm:inline-flex"
            >
              {action.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
