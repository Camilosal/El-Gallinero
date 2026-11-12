"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Plus, Search, X } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { matchesTextQuery } from "@/lib/text";
import { CREATE_ACTION_GROUPS } from "@/lib/create-actions";

export default function QuickCreateMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) triggerRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuery("");
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleDialogKeys);
    return () => window.removeEventListener("keydown", handleDialogKeys);
  }, [open]);

  const visibleGroups = useMemo(() => {
    const trimmedQuery = query.trim();
    return CREATE_ACTION_GROUPS.map((group) => ({
      ...group,
      actions: group.actions.filter((action) =>
        matchesTextQuery(trimmedQuery, [group.label, action.label, action.description, ...(action.keywords ?? [])]),
      ),
    })).filter((group) => group.actions.length > 0);
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-green-700 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-colors hover:bg-green-800 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
      >
        <Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
        <span>Crear</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-create-title"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 id="quick-create-title" className="text-xl font-bold text-slate-800">¿Qué quieres crear?</h2>
                <p className="mt-1 text-sm text-slate-500">Busca y abre el registro que necesitas. Los datos de contexto se completan en el formulario.</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar menú de creación"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <label htmlFor="quick-create-search" className="sr-only">Buscar qué crear</label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="quick-create-search"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar: gallina, venta, vacuna, alimento…"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              {visibleGroups.length > 0 ? (
                <div className="space-y-6">
                  {visibleGroups.map((group) => (
                    <section key={group.label} aria-label={group.label}>
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{group.label}</h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {group.actions.map((action) => (
                          <Link
                            key={`${action.label}-${action.href}`}
                            href={action.href}
                            onClick={close}
                            className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-green-300 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                          >
                            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-white group-hover:text-green-700">
                              <AppIcon icon={action.icon} className="w-5 h-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-800">{action.label}</span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{action.description}</span>
                            </span>
                            <ArrowRight aria-hidden="true" className="w-4 h-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-green-700" />
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="mt-3 font-medium text-slate-700">No encontramos esa opción</p>
                  <p className="mt-1 text-sm text-slate-500">Prueba con otro nombre o busca por módulo.</p>
                  <button type="button" onClick={() => setQuery("")} className="mt-4 text-sm font-semibold text-green-700 hover:text-green-900">Ver todas las opciones</button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">
              Abre el formulario; si requiere elegir un animal, una cuenta o un lugar, te lleva al paso de selección.
            </div>
          </section>
        </div>
      )}
    </>
  );
}
