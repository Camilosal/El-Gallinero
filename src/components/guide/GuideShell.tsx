"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Home,
  Menu,
  Search,
  X,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { BrandLogo } from "@/components/BrandLogo";
import { GuideSearchModal } from "@/components/guide/GuideSearchModal";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { LegalLinksBar } from "@/components/LegalLinksBar";
import { PublicNavigation } from "@/components/PublicNavigation";
import { guideModules, guides } from "@/lib/guide-data";

interface GuideShellProps {
  children: ReactNode;
  basePath: "/guia" | "/manual";
  isStandalone: boolean;
}

const GUIDES_BY_MODULE = guideModules.map((mod) => ({
  ...mod,
  items: guides.filter((g) => g.module === mod.id),
}));

export function GuideShell({ children, basePath, isStandalone }: GuideShellProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpenAt, setDrawerOpenAt] = useState<string | null>(null);

  const normalized = pathname.replace(/\/+$/, "");
  const activeSlug = normalized.startsWith(`${basePath}/`)
    ? normalized.slice(basePath.length + 1).split("/")[0] || ""
    : "";
  const activeGuide = activeSlug ? guides.find((g) => g.slug === activeSlug) : undefined;
  const activeModuleId = activeGuide?.module ?? guideModules[0].id;

  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => new Set([activeModuleId]));
  const drawerOpen = drawerOpenAt === pathname;
  const setDrawerOpen = (open: boolean) => setDrawerOpenAt(open ? pathname : null);

  useEffect(() => {
    if (!activeGuide) return;
    queueMicrotask(() => {
      setExpandedSet((prev) => {
        if (prev.has(activeGuide.module)) return prev;
        const next = new Set(prev);
        next.add(activeGuide.module);
        return next;
      });
    });
  }, [activeGuide]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      } else if (!inField && event.key === "/") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleModule = (modId: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  };

  const standaloneTarget = activeSlug ? `/guia/${activeSlug}` : "/guia";
  const isHome = !activeSlug;

  const renderNavTree = (onNavigate?: () => void) => (
    <nav aria-label="Índice del manual de uso" className="space-y-4">
      <div className="space-y-1">
        <Link
          href={basePath}
          aria-current={isHome ? "page" : undefined}
          onClick={onNavigate}
          className={`flex min-h-[42px] items-center gap-2.5 rounded-[var(--iw-radius-control)] px-3 py-2 text-sm font-semibold transition-colors ${
            isHome
              ? "bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)] shadow-xs"
              : "text-[var(--iw-semantic-text-primary)] hover:bg-[var(--iw-semantic-bg-subtle)]"
          }`}
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">Vista general del manual</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
              isHome
                ? "bg-white/20 text-white"
                : "bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)]"
            }`}
          >
            {guides.length}
          </span>
        </Link>
      </div>

      <div className="space-y-1.5">
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--iw-semantic-text-secondary)]">
          8 módulos + {guideModules.filter((m) => m.kind === "complementario").length} complementarios
        </p>

        {GUIDES_BY_MODULE.map((mod) => {
          const expanded = expandedSet.has(mod.id);
          const containsActive = activeGuide?.module === mod.id;
          return (
            <div key={mod.id} className="rounded-[var(--iw-radius-control)] border border-transparent">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleModule(mod.id)}
                className={`flex min-h-[40px] w-full items-center gap-2 rounded-[var(--iw-radius-control)] px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                  containsActive
                    ? "bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)]"
                    : "text-[var(--iw-semantic-text-primary)] hover:bg-[var(--iw-semantic-bg-subtle)]"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                    containsActive
                      ? "bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)]"
                      : "bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)]"
                  }`}
                >
                  <AppIcon icon={mod.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 truncate">{mod.label}</span>
                <span className="text-[10px] font-medium text-[var(--iw-semantic-text-secondary)] tabular-nums">{mod.items.length}</span>
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
                )}
              </button>

              {expanded && (
                <ul className="mt-1 ml-4 space-y-0.5 border-l border-[var(--iw-semantic-border-default)] pl-2.5">
                  {mod.items.map((item) => {
                    const current = activeSlug === item.slug;
                    return (
                      <li key={item.slug}>
                        <Link
                          href={`${basePath}/${item.slug}`}
                          aria-current={current ? "page" : undefined}
                          onClick={onNavigate}
                          className={`flex items-center gap-2 rounded-[var(--iw-radius-control)] px-2.5 py-2 text-xs transition-colors ${
                            current
                              ? "bg-[var(--iw-semantic-action-primary)] font-semibold text-[var(--iw-semantic-action-primary-text)] shadow-2xs"
                              : "text-[var(--iw-semantic-text-secondary)] hover:bg-[var(--iw-semantic-bg-subtle)] hover:text-[var(--iw-semantic-text-primary)]"
                          }`}
                        >
                          <AppIcon
                            icon={item.icon}
                            className={`h-3.5 w-3.5 shrink-0 ${current ? "text-[var(--iw-color-paper)]" : "text-[var(--iw-semantic-text-secondary)]"}`}
                          />
                          <span className="line-clamp-1">{item.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {isStandalone && <PublicNavigation />}
      <div className="min-h-[100dvh] bg-[var(--iw-semantic-bg-page)] text-[var(--iw-semantic-text-primary)]">
      {/* Barra contextual del manual con contraste diferenciado del contenido */}
      <header
        className={`sticky z-30 border-b border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)]/95 backdrop-blur-md shadow-xs ${
          isStandalone ? "top-[60px] sm:top-[64px]" : "top-0"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? "Cerrar índice de guías" : "Abrir índice de guías"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] transition-colors hover:bg-[var(--iw-semantic-bg-subtle)] lg:hidden cursor-pointer"
            >
              {drawerOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <Link href={basePath} className="flex min-w-0 items-center gap-3">
              {!isStandalone && (
                <BrandLogo
                  variant="horizontal"
                  height={38}
                  className="h-8 sm:h-[38px] w-auto rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-surface)] px-1.5 py-0.5 border border-[var(--iw-semantic-border-default)]"
                />
              )}
              <span className={`min-w-0 ${!isStandalone ? "border-l border-[var(--iw-semantic-border-default)] pl-3" : ""}`}>
                <span className="flex items-center gap-2">
                  <span className="font-display truncate text-sm font-bold text-[var(--iw-semantic-text-primary)] sm:text-base">
                    Manual de Uso
                  </span>
                  <span className="hidden sm:inline-flex items-center rounded-full border border-[var(--iw-semantic-border-strong)]/25 bg-[var(--iw-semantic-bg-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--iw-semantic-action-primary)] tabular-nums">
                    {guides.length} guías
                  </span>
                </span>
                <span className="hidden sm:block truncate text-[11px] text-[var(--iw-semantic-text-secondary)]">
                  Documentación operativa con capturas reales y recorridos paso a paso
                </span>
              </span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar en el manual de uso"
              aria-keyshortcuts="Control+K Meta+K /"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--iw-semantic-text-secondary)] transition-colors hover:border-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-bg-surface)] sm:w-64 sm:justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="h-3.5 w-3.5 shrink-0 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
                <span className="hidden sm:inline truncate">Buscar función o guía...</span>
                <span className="sm:hidden">Buscar</span>
              </span>
              <kbd className="hidden rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--iw-semantic-text-secondary)] sm:inline">
                Ctrl K
              </kbd>
            </button>

            {!isStandalone && (
              <a
                href={standaloneTarget}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-action-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--iw-semantic-action-primary-text)] shadow-xs transition-colors hover:bg-[var(--iw-semantic-action-primary-hover)]"
              >
                <span className="hidden md:inline">Abrir en hoja aparte</span>
                <span className="md:hidden">Hoja aparte</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
            )}

            <Link
              href="/inicio"
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--iw-radius-control)] px-3 py-1.5 text-xs font-semibold transition-colors ${
                isStandalone
                  ? "bg-[var(--iw-semantic-action-primary)] text-[var(--iw-semantic-action-primary-text)] shadow-xs hover:bg-[var(--iw-semantic-action-primary-hover)]"
                  : "border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] text-[var(--iw-semantic-text-primary)] hover:bg-[var(--iw-semantic-bg-subtle)]"
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Volver al sistema</span>
              <span className="sm:hidden">Sistema</span>
            </Link>
          </div>
        </div>

        {/* Drawer colapsable móvil con el mismo árbol de navegación */}
        {drawerOpen && (
          <div className="guide-scroll-pane max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] px-4 py-4 shadow-[var(--iw-shadow-popover)] lg:hidden">
            {renderNavTree(() => setDrawerOpen(false))}
          </div>
        )}
      </header>

      {/* Cuerpo principal: Sidebar fijo en desktop + contenido */}
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="hidden w-72 shrink-0 border-r border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] lg:block">
          <div className="guide-scroll-pane sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto px-3 py-5">
            {renderNavTree()}
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
          <footer className="mt-10 border-t border-[var(--iw-semantic-border-default)] pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DeveloperCredit variant="inline" showAppName />
            <LegalLinksBar className="justify-start sm:justify-end" />
          </footer>
        </main>
      </div>

      <GuideSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} basePath={basePath} />
      </div>
    </>
  );
}

