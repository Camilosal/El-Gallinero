"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Home,
  Menu,
  Search,
  X,
} from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { GuideSearchModal } from "@/components/guide/GuideSearchModal";
import { guideModules, guides } from "@/lib/guide-data";

interface GuideShellProps {
  children: ReactNode;
  basePath: "/guia" | "/dashboard/guia";
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
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
            isHome
              ? "bg-green-700 text-white shadow-xs"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">Vista general del manual</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isHome ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {guides.length}
          </span>
        </Link>
      </div>

      <div className="space-y-1.5">
        <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Módulos ({guideModules.length})
        </p>

        {GUIDES_BY_MODULE.map((mod) => {
          const expanded = expandedSet.has(mod.id);
          const containsActive = activeGuide?.module === mod.id;
          return (
            <div key={mod.id} className="rounded-xl border border-transparent">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleModule(mod.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                  containsActive
                    ? "bg-green-50/90 text-green-900"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                    containsActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <AppIcon icon={mod.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 truncate">{mod.label}</span>
                <span className="text-[10px] font-medium text-slate-400">{mod.items.length}</span>
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                )}
              </button>

              {expanded && (
                <ul className="mt-1 ml-4 space-y-0.5 border-l border-slate-200 pl-2.5">
                  {mod.items.map((item) => {
                    const current = activeSlug === item.slug;
                    return (
                      <li key={item.slug}>
                        <Link
                          href={`${basePath}/${item.slug}`}
                          aria-current={current ? "page" : undefined}
                          onClick={onNavigate}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                            current
                              ? "bg-green-700 font-semibold text-white shadow-2xs"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          <AppIcon
                            icon={item.icon}
                            className={`h-3.5 w-3.5 shrink-0 ${current ? "text-green-100" : "text-slate-400"}`}
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
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      {/* Cabecera fija moderna del manual */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-expanded={drawerOpen}
              aria-label={drawerOpen ? "Cerrar índice de guías" : "Abrir índice de guías"}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 lg:hidden cursor-pointer"
            >
              {drawerOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <Link href={basePath} className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-800 text-amber-200 shadow-xs">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-slate-900 sm:text-base">
                    Manual de Uso · El Gallinero
                  </span>
                  <span className="hidden sm:inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-800">
                    {guides.length} guías
                  </span>
                </span>
                <span className="hidden sm:block truncate text-[11px] text-slate-500">
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
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-white sm:w-64 sm:justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="hidden sm:inline truncate">Buscar función o guía...</span>
                <span className="sm:hidden">Buscar</span>
              </span>
              <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:inline">
                Ctrl K
              </kbd>
            </button>

            {!isStandalone && (
              <a
                href={standaloneTarget}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-green-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-green-800"
              >
                <span className="hidden md:inline">Abrir en hoja aparte</span>
                <span className="md:hidden">Hoja aparte</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </a>
            )}

            <Link
              href="/dashboard"
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                isStandalone
                  ? "bg-green-800 text-white shadow-xs hover:bg-green-900"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
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
          <div className="guide-scroll-pane max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-200 bg-white px-4 py-4 shadow-lg lg:hidden">
            {renderNavTree(() => setDrawerOpen(false))}
          </div>
        )}
      </header>

      {/* Cuerpo principal: Sidebar fijo en desktop + contenido */}
      <div className="mx-auto flex max-w-[1440px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200/80 bg-white/75 lg:block">
          <div className="guide-scroll-pane sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto px-3 py-5">
            {renderNavTree()}
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>

      <GuideSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} basePath={basePath} />
    </div>
  );
}

