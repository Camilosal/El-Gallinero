"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Clock, Search, X } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { guideModules, searchGuides } from "@/lib/guide-data";

interface GuideSearchModalProps {
  open: boolean;
  onClose: () => void;
  basePath: string;
}

const MODULE_LABELS = new Map(guideModules.map((m) => [m.id, m.label]));

/**
 * Buscador rápido del manual implementado con `<dialog>` nativo (`showModal` + `closedby="any"`).
 * Filtra en tiempo real por título, módulo, etiquetas, pasos y pies de captura.
 */
export function GuideSearchModal({ open, onClose, basePath }: GuideSearchModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerDownTargetRef = useRef<EventTarget | null>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const [smartSuggestions, setSmartSuggestions] = useState<
    Array<{ id: string; title: string; summary: string; href: string; group?: string }>
  >([]);
  const [smartLoading, setSmartLoading] = useState(false);

  const results = useMemo(() => searchGuides(query).slice(0, 12), [query]);

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
          body: JSON.stringify({ scope: "guides", query: trimmed, basePath }),
          signal: controller.signal,
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as {
            suggestions?: Array<{ id: string; title: string; summary: string; href: string; group?: string }>;
          };
          setSmartSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        }
      } catch {
        // Ignorar si se cancela o no hay red
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
  }, [open, query, results.length, basePath]);

  const visibleSmartSuggestions =
    open && results.length === 0 && query.trim().length >= 4 ? smartSuggestions : [];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      queueMicrotask(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      setQuery("");
      setActiveIndex(0);
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  const navigateTo = (slug: string) => {
    dialogRef.current?.close();
    router.push(`${basePath}/${slug}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const picked = results[activeIndex] ?? results[0];
      if (picked) navigateTo(picked.slug);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, string>)}
      aria-labelledby={titleId}
      onPointerDown={(e) => {
        pointerDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        const dialog = dialogRef.current;
        if (
          dialog &&
          !("closedBy" in HTMLDialogElement.prototype) &&
          e.target === dialog &&
          pointerDownTargetRef.current === dialog
        ) {
          dialog.close();
        }
      }}
      className="mx-auto mt-[8dvh] w-[min(94dvw,680px)] max-h-[82dvh] rounded-2xl border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-surface)] p-0 text-[var(--iw-semantic-text-primary)] shadow-2xl backdrop:bg-[var(--iw-color-ink-strong)]/60 backdrop:backdrop-blur-xs open:flex open:flex-col"
    >
      <h2 id={titleId} className="sr-only">
        Buscar dentro del manual de uso
      </h2>

      <div className="flex items-center gap-3 border-b border-[var(--iw-semantic-border-default)] px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar función, módulo, botón, QR, CxC, offline..."
          aria-label="Término de búsqueda en el manual"
          className="flex-1 bg-transparent text-sm text-[var(--iw-semantic-text-primary)] outline-none placeholder:text-[var(--iw-semantic-text-secondary)]"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Cerrar buscador del manual"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)] transition-colors hover:bg-[var(--iw-semantic-bg-subtle)] hover:text-[var(--iw-semantic-text-primary)] cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="guide-scroll-pane flex-1 overflow-y-auto p-2">
        {results.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-[var(--iw-semantic-border-default)]" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
              No encontramos guías para “{query}”
            </p>
            <p className="mt-1 text-xs text-[var(--iw-semantic-text-secondary)]">
              Prueba con términos como «huevos», «qr», «offline», «voz», «peso», «activos» o «cxc».
            </p>
            {smartLoading ? (
              <p className="mt-3 text-xs text-[var(--iw-semantic-text-secondary)]">Buscando guías relacionadas...</p>
            ) : visibleSmartSuggestions.length > 0 ? (
              <div className="mt-4 max-w-md mx-auto text-left space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--iw-semantic-action-primary)] px-1">
                  Quizás buscas
                </p>
                {visibleSmartSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigateTo(s.id)}
                    className="w-full rounded-lg border border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-3 py-2 text-left hover:border-[var(--iw-semantic-border-strong)] hover:bg-[var(--iw-semantic-bg-feature)] transition-colors cursor-pointer"
                  >
                    <span className="block text-sm font-semibold text-[var(--iw-semantic-text-primary)]">{s.title}</span>
                    <span className="block text-xs text-[var(--iw-semantic-text-secondary)] line-clamp-1">{s.summary}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-1">
            {results.map((guide, index) => {
              const active = index === activeIndex;
              return (
                <li key={guide.slug}>
                  <button
                    type="button"
                    onClick={() => navigateTo(guide.slug)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-start gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      active ? "bg-[var(--iw-semantic-bg-feature)] ring-1 ring-[var(--iw-semantic-border-default)]" : "hover:bg-[var(--iw-semantic-bg-subtle)]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        active
                          ? "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-feature)] text-[var(--iw-semantic-action-primary)]"
                          : "border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-text-secondary)]"
                      }`}
                    >
                      <AppIcon icon={guide.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--iw-semantic-text-primary)]">
                          {guide.title}
                        </span>
                        <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--iw-semantic-bg-page)] px-2 py-0.5 text-[10px] font-medium text-[var(--iw-semantic-text-secondary)]">
                          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                          {guide.estimatedMinutes} min
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium text-[var(--iw-semantic-action-primary)]">
                        {MODULE_LABELS.get(guide.module) || guide.module}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-xs text-[var(--iw-semantic-text-secondary)]">
                        {guide.summary}
                      </span>
                    </span>
                    <ArrowRight
                      className={`mt-2 h-4 w-4 shrink-0 ${
                        active ? "text-[var(--iw-semantic-action-primary)]" : "text-[var(--iw-semantic-border-default)]"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--iw-semantic-border-default)] bg-[var(--iw-semantic-bg-subtle)] px-4 py-2 text-[11px] text-[var(--iw-semantic-text-secondary)]">
        <div className="flex items-center gap-3">
          <span>↑↓ navegar</span>
          <span>↵ abrir guía</span>
          <span>Esc cerrar</span>
        </div>
        <span>Mostrando {results.length} coincidencia(s)</span>
      </div>
    </dialog>
  );
}

