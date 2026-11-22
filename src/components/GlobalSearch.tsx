"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { searchNavigation, type SearchEntry } from "@/lib/navigation";
import { FEATURE_FLAG_CATALOG } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/useOnboardingState";
import { canAccessAppRoute } from "@/lib/rbac";
import { useAppRole } from "@/lib/useAppRole";

interface GlobalSearchProps {
  collapsed?: boolean;
  variant?: "sidebar" | "topbar";
  className?: string;
}

export default function GlobalSearch({
  collapsed = false,
  variant = "sidebar",
  className = "",
}: GlobalSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { flags } = useOnboardingState();
  const role = useAppRole();

  const [smartSuggestions, setSmartSuggestions] = useState<
    Array<{ id: string; title: string; summary: string; href: string; group?: string }>
  >([]);
  const [smartLoading, setSmartLoading] = useState(false);

  const results = useMemo(() => searchNavigation(query, 12, flags, role), [query, flags, role]);

  useEffect(() => {
    const trimmed = query.trim();
    if (
      !open ||
      results.length > 0 ||
      trimmed.length < 4 ||
      (typeof navigator !== "undefined" && !navigator.onLine)
    ) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSmartLoading(true);
      try {
        const res = await fetch("/api/busqueda/sugerir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "navigation", query: trimmed, flags }),
          signal: controller.signal,
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as {
            suggestions?: Array<{ id: string; title: string; summary: string; href: string; group?: string }>;
          };
          setSmartSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        }
      } catch {
        // Ignorar si se cancela o no hay conexión
      } finally {
        if (!cancelled) setSmartLoading(false);
      }
    }, 380);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
      setSmartLoading(false);
    };
  }, [open, query, results.length, flags]);

  const visibleSmartSuggestions =
    open && results.length === 0 && query.trim().length >= 4
      ? smartSuggestions.filter((suggestion) => canAccessAppRoute(role, suggestion.href))
      : [];
  const openSearch = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  // Atajo global Ctrl/Cmd+K y cierre con Escape
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  // Reiniciar estado y enfocar al abrir
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 30);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timeout);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const navigate = (href: string) => {
    setOpen(false);
    if (href === "/manual" || href.startsWith("/manual/")) {
      const standaloneHref = href.replace(/^\/manual/, "/guia");
      window.open(standaloneHref, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) navigate(selected.href);
    }
  };

  return (
    <>
      {variant === "topbar" ? (
        <button
          type="button"
          onClick={openSearch}
          className={`flex h-10 min-h-[40px] items-center gap-2 rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-border-input)] bg-[var(--iw-semantic-bg-surface)] px-2.5 sm:px-3 py-0 text-left text-xs sm:text-sm text-[var(--iw-semantic-text-secondary)] shadow-xs transition-colors hover:border-[var(--iw-semantic-border-strong)] hover:bg-[var(--iw-semantic-bg-subtle)] hover:text-[var(--iw-semantic-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iw-semantic-focus-ring)] ${className}`}
          aria-label="Buscar en el sistema"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Search className="w-4 h-4 text-[var(--iw-semantic-text-secondary)] shrink-0" />
          <span className="truncate flex-1">
            <span className="sm:hidden">Buscar...</span>
            <span className="hidden sm:inline">Buscar módulo o acción...</span>
          </span>
          <kbd className="hidden md:inline-flex rounded border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--iw-semantic-text-secondary)]">
            Ctrl K
          </kbd>
        </button>
      ) : collapsed ? (
        <button
          type="button"
          onClick={openSearch}
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-green-800 text-green-100 transition-colors hover:bg-green-700"
          title="Buscar (Ctrl+K)"
          aria-label="Buscar en el sistema"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Search className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={openSearch}
          className={`flex w-full items-center gap-2 rounded-lg border border-green-700 bg-green-800/70 px-3 py-2 text-left text-sm text-green-200 transition-colors hover:border-green-600 hover:bg-green-800 ${className}`}
          aria-label="Buscar en el sistema"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Search className="w-4 h-4 text-green-300 shrink-0" />
          <span className="flex-1 truncate">Buscar módulo o acción...</span>
          <kbd className="rounded border border-green-600 bg-green-900 px-1.5 py-0.5 text-[10px] font-semibold text-green-300">
            Ctrl K
          </kbd>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[8vh] sm:pt-[12vh]"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Buscador global"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-4">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Busca en palabras sencillas: huevo, equipo, ganancia real, norma, falla, clima..."
                className="flex-1 bg-transparent py-4 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                aria-label="Término de búsqueda"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                Esc
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto py-2">
              {results.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Sin resultados para “{query}”
                  </p>
                  {smartLoading ? (
                    <p className="mt-2 text-xs text-slate-500">Buscando coincidencias relacionadas...</p>
                  ) : visibleSmartSuggestions.length > 0 ? (
                    <div className="mt-4 max-w-md mx-auto text-left space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-green-700 px-1">
                        Quizás buscas
                      </p>
                      {visibleSmartSuggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => navigate(s.href)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-left hover:border-green-400 hover:bg-green-50/60 transition-colors"
                        >
                          <span className="block text-sm font-semibold text-slate-900">{s.title}</span>
                          {s.group ? (
                            <span className="block text-xs text-slate-500">{s.group}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Prueba con “huevos”, “cuyes”, “rutinas”, “sensores”, “prorrateo” o “vacunas”.
                  </p>
                </div>
              ) : (
                <>
                  {!query.trim() && (
                    <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Accesos rápidos
                    </p>
                  )}
                  {results.map((entry, index) => (
                    <SearchResultRow
                      key={`${entry.href}-${entry.label}`}
                      entry={entry}
                      active={index === activeIndex}
                      onHover={() => setActiveIndex(index)}
                      onSelect={() => navigate(entry.href)}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
              <span>↑↓ navegar</span>
              <span>↵ abrir</span>
              <span>Esc cerrar</span>
              <span className="ml-auto hidden sm:inline">Búsqueda por nombre y sinónimos</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchResultRow({
  entry,
  active,
  onHover,
  onSelect,
}: {
  entry: SearchEntry;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? "bg-green-50" : "hover:bg-slate-50"
        }`}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <AppIcon icon={entry.icon} className="w-4 h-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 truncate text-sm font-medium text-slate-800">
          <span className="truncate">{entry.label}</span>
          {entry.lockedByFlag && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 shrink-0">
              Por desbloquear
            </span>
          )}
        </span>
        {entry.lockedByFlag && (
          <span className="block truncate text-[11px] text-amber-700">
            {FEATURE_FLAG_CATALOG.find((flag) => flag.key === entry.lockedByFlag)?.autoTriggerDescription ??
              "Se desbloquea al crecer la operación de la granja."}
          </span>
        )}
        <span className="flex items-center gap-1.5 truncate text-xs text-slate-500">
          <AppIcon icon={entry.groupIcon} className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{entry.group}</span>
        </span>
      </span>
      <span className={`text-xs ${active ? "text-green-700" : "text-slate-300"}`}>
        {entry.href.startsWith("/manual") ? "↗" : "↵"}
      </span>
    </button>
  );
}
