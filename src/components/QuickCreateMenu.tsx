"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Egg, HeartPulse, Mic, Plus, Receipt, Search, ShoppingBag, Wheat, X, Zap } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { matchesTextQuery } from "@/lib/text";
import { CREATE_ACTION_GROUPS } from "@/lib/create-actions";
import { openQuickCapture, type QuickCaptureMode } from "@/lib/quick-capture-events";
import { OPEN_ASSISTANT_VOICE_EVENT } from "@/lib/offline/voiceNotes";

interface ExpressAction {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  mode?: QuickCaptureMode;
  voice?: boolean;
  icon: typeof Egg;
  badgeClass: string;
}

const EXPRESS_ACTIONS: ExpressAction[] = [
  {
    id: "express-huevos",
    label: "Recoger huevos",
    description: "Por cubetas o sueltos · sin cambiar de vista",
    keywords: ["huevo", "postura", "cubeta", "recoger", "hoy"],
    mode: "huevos",
    icon: Egg,
    badgeClass: "bg-yellow-100 text-yellow-700",
  },
  {
    id: "express-alimento",
    label: "Entregar alimento",
    description: "Descuento rápido de bultos o kg en galpón",
    keywords: ["alimento", "concentrado", "comida", "racion", "kg"],
    mode: "alimentacion",
    icon: Wheat,
    badgeClass: "bg-amber-100 text-amber-700",
  },
  {
    id: "express-mortalidad",
    label: "Reportar baja",
    description: "Registro de mortalidad en 3 toques",
    keywords: ["mortalidad", "baja", "muerte", "murio", "ave"],
    mode: "mortalidad",
    icon: HeartPulse,
    badgeClass: "bg-red-100 text-red-700",
  },
  {
    id: "express-gasto",
    label: "Anotar gasto",
    description: "Compra o pago rápido desde la finca",
    keywords: ["gasto", "egreso", "pago", "compra", "factura"],
    mode: "gasto",
    icon: Receipt,
    badgeClass: "bg-slate-200 text-slate-700",
  },
  {
    id: "express-venta",
    label: "Vender huevos",
    description: "Venta rápida al contado desde inventario",
    keywords: ["venta", "vender", "cliente", "huevos", "cubeta"],
    mode: "venta",
    icon: ShoppingBag,
    badgeClass: "bg-green-100 text-green-700",
  },
  {
    id: "express-voz",
    label: "Dictar por voz",
    description: "Dictado en vivo o nota de audio offline",
    keywords: ["voz", "audio", "microfono", "hablar", "asistente"],
    voice: true,
    icon: Mic,
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
];

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

  const visibleExpress = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return EXPRESS_ACTIONS;
    return EXPRESS_ACTIONS.filter((item) =>
      matchesTextQuery(trimmedQuery, [item.label, item.description, ...item.keywords]),
    );
  }, [query]);

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

  const triggerExpress = (action: ExpressAction) => {
    close();
    if (action.voice) {
      window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_VOICE_EVENT));
      return;
    }
    if (action.mode) {
      openQuickCapture({ mode: action.mode });
    }
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
                <p className="mt-1 text-sm text-slate-500">Usa el registro exprés en 10 segundos o abre el formulario completo del módulo.</p>
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
                  placeholder="Buscar: gallina, venta, vacuna, alimento, voz…"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-6">
                {visibleExpress.length > 0 && (
                  <section aria-label="Registro exprés sin salir">
                    <div className="mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-700" aria-hidden="true" />
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-green-800">
                        Registro exprés (en esta pantalla · offline)
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleExpress.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => triggerExpress(action)}
                            className="group flex items-center gap-3 rounded-xl border border-green-200 bg-green-50/40 p-3 text-left transition hover:border-green-400 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                          >
                            <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${action.badgeClass}`}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-800">{action.label}</span>
                              <span className="mt-0.5 block text-xs leading-snug text-slate-500">{action.description}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {visibleGroups.length > 0 ? (
                  visibleGroups.map((group) => (
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
                  ))
                ) : visibleExpress.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                      <Search className="w-6 h-6" />
                    </div>
                    <p className="mt-3 font-medium text-slate-700">No encontramos esa opción</p>
                    <p className="mt-1 text-sm text-slate-500">Prueba con otro nombre o busca por módulo.</p>
                    <button type="button" onClick={() => setQuery("")} className="mt-4 text-sm font-semibold text-green-700 hover:text-green-900">Ver todas las opciones</button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">
              Los botones verdes guardan al instante en esta pantalla; los demás abren el formulario completo del módulo.
            </div>
          </section>
        </div>
      )}
    </>
  );
}
