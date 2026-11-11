"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { matchesTextQuery } from "@/lib/text";

interface CreateAction {
  label: string;
  description: string;
  icon: string;
  href: string;
  keywords?: string[];
}

interface CreateActionGroup {
  label: string;
  actions: CreateAction[];
}

const CREATE_ACTION_GROUPS: CreateActionGroup[] = [
  {
    label: "Animales",
    actions: [
      { label: "Ingresar gallinas", description: "Registra si fueron compradas, donadas o nacieron en la granja", icon: "🐔", href: "/dashboard/produccion/adquisiciones?nuevo=gallina", keywords: ["ave", "ponedora", "origen"] },
      { label: "Ingresar gallos reproductores", description: "Registra el origen antes de gestionar cada ficha", icon: "🐓", href: "/dashboard/produccion/adquisiciones?nuevo=gallo", keywords: ["ave", "macho", "origen"] },
      { label: "Ingresar un lote de animales", description: "Elige especie y destino: carne, postura o pie de cría", icon: "🐣", href: "/dashboard/produccion/adquisiciones?nuevo=lote_pollos", keywords: ["pollo", "pollitos", "codorniz", "pato", "conejo", "lote"] },
      { label: "Registrar cría propia", description: "Da de alta nacimientos que no se registraron desde Incubación", icon: "🐣", href: "/dashboard/produccion/adquisiciones?origen=cria_propia", keywords: ["nacimiento", "eclosion", "pollitos"] },
      { label: "Registrar adquisición de aves", description: "Compra, donación u otro ingreso de animales", icon: "📥", href: "/dashboard/produccion/adquisiciones", keywords: ["compra", "donacion", "ingreso", "proveedor"] },
      { label: "Registrar mortalidad", description: "Registra muerte o baja de animales", icon: "🕊️", href: "/dashboard/produccion/mortalidad", keywords: ["muerte", "baja", "perdida"] },
      { label: "Crear lugar de manejo", description: "Registra corral, jaula, galpón, potrero, jardín o patio", icon: "📍", href: "/dashboard/ubicaciones", keywords: ["ubicacion", "corral", "galpon", "georreferencia"] },
      { label: "Registrar traslado de animal", description: "Cambia de lugar y conserva el historial del traslado", icon: "↔️", href: "/dashboard/ubicaciones", keywords: ["mover", "traslado", "cambio de corral"] },
      { label: "Registrar peso de un ave", description: "Guarda una medición de peso", icon: "⚖️", href: "/dashboard/produccion/peso", keywords: ["pesaje", "medicion"] },
      { label: "Iniciar incubación", description: "Registra huevos puestos a incubar", icon: "🐣", href: "/dashboard/produccion?tab=incubacion", keywords: ["incubar", "eclosion", "nacimiento"] },
      { label: "Registrar eclosión", description: "Completa una incubación y registra los pollitos nacidos", icon: "🐥", href: "/dashboard/produccion?tab=incubacion", keywords: ["nacimiento", "nacieron", "pollitos"] },
      { label: "Crear plan de parvada", description: "Proyecta reemplazos y producción", icon: "📋", href: "/dashboard/produccion/plan-parvada", keywords: ["planificacion", "proyeccion"] },
    ],
  },
  {
    label: "Producción y ventas",
    actions: [
      { label: "Registrar recolección de huevos", description: "Captura producción, clasificación y autoconsumo", icon: "🥚", href: "/dashboard/produccion?tab=huevos", keywords: ["recoger", "postura", "produccion diaria"] },
      { label: "Registrar pérdida de huevos", description: "Registra huevos rotos o descartados", icon: "🥚", href: "/dashboard/produccion/mortalidad", keywords: ["rotos", "descarte", "merma"] },
      { label: "Registrar faena", description: "Registra el sacrificio y rendimiento de animales", icon: "🍗", href: "/dashboard/produccion?tab=carne", keywords: ["sacrificio", "beneficio", "canal"] },
      { label: "Registrar venta de huevos", description: "Venta por talla y presentación", icon: "💰", href: "/dashboard/finanzas/ventas?tab=huevos", keywords: ["huevo", "cliente"] },
      { label: "Registrar venta de aves", description: "Venta de gallinas, gallos o pollos", icon: "🐓", href: "/dashboard/finanzas/ventas?tab=aves", keywords: ["pollo", "gallina", "gallo"] },
      { label: "Registrar venta de carne", description: "Venta por peso o presentación", icon: "🍗", href: "/dashboard/finanzas/ventas?tab=carne", keywords: ["kilogramos", "kg"] },
      { label: "Registrar venta de gallinaza", description: "Salida y cobro de abono o gallinaza", icon: "🌱", href: "/dashboard/produccion?tab=gallinaza", keywords: ["abono", "estiercol", "fertilizante"] },
      { label: "Ajustar inventario de gallinaza", description: "Corrige existencias o registra un ajuste", icon: "⚖️", href: "/dashboard/produccion?tab=gallinaza", keywords: ["abono", "inventario", "correccion"] },
    ],
  },
  {
    label: "Almacén y operaciones",
    actions: [
      { label: "Registrar movimiento de alimento", description: "Captura una entrada o consumo de alimento", icon: "🌾", href: "/dashboard/produccion?tab=alimentacion&subtab=movimientos", keywords: ["comida", "concentrado", "consumo", "entrada", "salida"] },
      { label: "Crear alimento", description: "Agrega un alimento al inventario", icon: "🌽", href: "/dashboard/produccion?tab=alimentacion&subtab=inventario", keywords: ["comida", "concentrado", "existencias"] },
      { label: "Crear plan de alimentación", description: "Define un programa para una especie o etapa", icon: "🗒️", href: "/dashboard/produccion?tab=alimentacion&subtab=etapas", keywords: ["dieta", "racion", "programa"] },
      { label: "Crear insumo", description: "Agrega medicamentos, vacunas, herramientas o materiales", icon: "🧰", href: "/dashboard/inventarios/insumos", keywords: ["inventario", "existencias", "stock"] },
      { label: "Registrar movimiento de insumo", description: "Captura una entrada, consumo o ajuste", icon: "📦", href: "/dashboard/inventarios/insumos", keywords: ["entrada", "salida", "ajuste", "consumo"] },
      { label: "Registrar equipo o activo", description: "Crea una ficha con su lugar, estado y garantía", icon: "🏗️", href: "/dashboard/operaciones/activos", keywords: ["activo", "maquina", "herramienta", "bomba", "incubadora"] },
      { label: "Crear tarea de mantenimiento", description: "Programa o registra una reparación", icon: "🔧", href: "/dashboard/operaciones/mantenimiento", keywords: ["reparacion", "equipo", "infraestructura"] },
      { label: "Crear producto", description: "Agrega un producto que puedas asociar a una compra", icon: "🏷️", href: "/dashboard/finanzas/egresos", keywords: ["compra", "articulo", "insumo"] },
      { label: "Crear proveedor", description: "Agrega un proveedor desde el formulario de egreso", icon: "🚚", href: "/dashboard/finanzas/egresos", keywords: ["compra", "suministrador"] },
    ],
  },
  {
    label: "Sanidad y hogar",
    actions: [
      { label: "Registrar tratamiento o control sanitario", description: "Vacunación, medicamento o revisión aplicada", icon: "💊", href: "/dashboard/sanidad/control", keywords: ["vacuna", "medicina", "enfermedad", "desparasitacion"] },
      { label: "Programar evento sanitario", description: "Crea una vacuna, revisión o recordatorio futuro", icon: "📅", href: "/dashboard/sanidad/calendario", keywords: ["calendario", "recordatorio", "vacunacion"] },
      { label: "Registrar consumo del hogar", description: "Captura autoconsumo y ahorro familiar", icon: "🏡", href: "/dashboard/soberania", keywords: ["autoconsumo", "familia", "ahorro"] },
    ],
  },
  {
    label: "Finanzas",
    actions: [
      { label: "Registrar egreso o compra", description: "Guarda gastos, costos y compras", icon: "📤", href: "/dashboard/finanzas/egresos", keywords: ["gasto", "pago", "compra"] },
      { label: "Registrar transacción financiera", description: "Registra un ingreso u otro movimiento y elige su tipo", icon: "📥", href: "/dashboard/finanzas/finanzas", keywords: ["ingreso", "dinero", "abono", "cobro"] },
      { label: "Crear presupuesto", description: "Define un período y sus partidas", icon: "💵", href: "/dashboard/finanzas/presupuestos", keywords: ["plan", "meta", "gasto"] },
      { label: "Registrar pago o abono", description: "Aplica un pago a una cuenta pendiente", icon: "💳", href: "/dashboard/finanzas/cuentas", keywords: ["cuenta", "deuda", "cobrar", "pagar"] },
    ],
  },
  {
    label: "Catálogos y configuración",
    actions: [
      { label: "Agregar especie, raza o dato de catálogo", description: "Mantén listas y opciones usadas en los formularios", icon: "🗂️", href: "/dashboard/configuracion/catalogos", keywords: ["especie", "raza", "vacuna", "categorias", "etapas"] },
      { label: "Agregar estándar de peso", description: "Actualiza referencias por especie y edad", icon: "🧬", href: "/dashboard/configuracion/catalogos", keywords: ["raza", "crecimiento", "genetica"] },
    ],
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
        className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
      >
        <span aria-hidden="true" className="text-lg leading-none">＋</span>
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
                <p className="mt-1 text-sm text-slate-500">Elige un registro para abrir la sección donde se captura.</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar menú de creación"
                className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
              >
                ×
              </button>
            </div>

            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <label htmlFor="quick-create-search" className="sr-only">Buscar qué crear</label>
              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">⌕</span>
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
                            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl transition group-hover:bg-white">{action.icon}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-800">{action.label}</span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{action.description}</span>
                            </span>
                            <span aria-hidden="true" className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-green-700">→</span>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <span aria-hidden="true" className="text-3xl">🔎</span>
                  <p className="mt-3 font-medium text-slate-700">No encontramos esa opción</p>
                  <p className="mt-1 text-sm text-slate-500">Prueba con otro nombre o busca por módulo.</p>
                  <button type="button" onClick={() => setQuery("")} className="mt-4 text-sm font-semibold text-green-700 hover:text-green-900">Ver todas las opciones</button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500 sm:px-6">
              Selecciona una opción; el botón de registro está disponible en la sección indicada.
            </div>
          </section>
        </div>
      )}
    </>
  );
}
