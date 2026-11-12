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

  const results = useMemo(() => searchGuides(query).slice(0, 12), [query]);

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
      className="mx-auto mt-[8dvh] w-[min(94dvw,680px)] max-h-[82dvh] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs open:flex open:flex-col"
    >
      <h2 id={titleId} className="sr-only">
        Buscar dentro del manual de uso
      </h2>

      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
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
          className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Cerrar buscador del manual"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="guide-scroll-pane flex-1 overflow-y-auto p-2">
        {results.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              No encontramos guías para “{query}”
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Prueba con términos como «huevos», «qr», «offline», «voz», «peso», «activos» o «cxc».
            </p>
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
                      active ? "bg-green-50 ring-1 ring-green-200" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        active
                          ? "border-green-200 bg-green-100 text-green-800"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      <AppIcon icon={guide.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {guide.title}
                        </span>
                        <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                          {guide.estimatedMinutes} min
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] font-medium text-green-700">
                        {MODULE_LABELS.get(guide.module) || guide.module}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500">
                        {guide.summary}
                      </span>
                    </span>
                    <ArrowRight
                      className={`mt-2 h-4 w-4 shrink-0 ${
                        active ? "text-green-700" : "text-slate-300"
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
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

