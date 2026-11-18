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
      <div className="land-wrap flex items-center justify-between gap-4 py-2.5 sm:py-3">
        <Link
          href={brandHref}
          aria-label="IwaGranja — Inicio"
          className="inline-flex shrink-0 items-center"
        >
          <BrandLogo
            variant="horizontal"
            height={42}
            className="h-9 w-auto sm:h-[42px]"
          />
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          <LandingDesktopNav />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden items-center rounded-full border border-[var(--line)] bg-[var(--paper)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--forest)] sm:inline-flex"
          >
            Entrar
          </Link>
          {action && (
            <Link
              href={action.href}
              className="hidden items-center gap-1.5 rounded-full bg-[var(--forest)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--forest-deep)] sm:inline-flex"
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
