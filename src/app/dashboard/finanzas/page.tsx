"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpFromLine, BarChart3, CircleDollarSign, ClipboardList } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { HeroBanner } from "@/components/HeroBanner";
import TableSearch from "@/components/TableSearch";
import { EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { isHrefEnabledByFlags } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/useOnboardingState";

const secciones = [
  { href: "/dashboard/finanzas/ventas", label: "Ventas", icon: "money", desc: "5 líneas: huevos, carne, animales en pie, gallinaza y otros" },
  { href: "/dashboard/finanzas/egresos", label: "Egresos", icon: "outgoing", desc: "Gastos, compras y comprobantes con adjuntos y OCR" },
  { href: "/dashboard/finanzas/finanzas", label: "Finanzas", icon: "trend-up", desc: "Balance, flujo de caja y estado de resultados" },
  { href: "/dashboard/finanzas/presupuestos", label: "Presupuestos", icon: "banknote", desc: "Planificación financiera y cumplimiento" },
  { href: "/dashboard/finanzas/cuentas", label: "Cuentas", icon: "card", desc: "CxC, CxP, vencimientos y abonos" },
  { href: "/dashboard/contactos", label: "Clientes y Proveedores", icon: "handshake", desc: "Directorio, ubicación GPS, WhatsApp y plazos de crédito" },
];

interface ResumenFinanzas {
  ingresosMes: number;
  egresosMes: number;
  balanceMes: number;
  totalTransacciones: number;
}

export default function FinanzasPage() {
  const [resumen, setResumen] = useState<ResumenFinanzas | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { flags } = useOnboardingState();

  useEffect(() => {
    apiFetch("/api/finanzas/resumen")
      .then((r) => r.json())
      .then(setResumen)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const enabledSecciones = secciones.filter((sec) => isHrefEnabledByFlags(sec.href, flags));
  const hiddenSeccionesCount = secciones.length - enabledSecciones.length;
  const visibleSecciones = enabledSecciones.filter((sec) =>
    matchesTextQuery(search, [sec.label, sec.desc]),
  );

  return (
    <div className="p-8">
      <HeroBanner
        theme="finanzas"
        icon={<CircleDollarSign className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        title="Finanzas"
        description="Ventas en 5 líneas, egresos con adjuntos/OCR, balance, presupuestos, CxC/CxP y directorio comercial."
      />

      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Buscar en secciones financieras..."
        resultCount={visibleSecciones.length}
        totalCount={enabledSecciones.length}
        className="mb-6"
      />
      {hiddenSeccionesCount > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900">
          <span>Modo Pequeño: Presupuestos formales oculto para simplificar finanzas diarias.</span>
          <Link href="/dashboard/guia/niveles-productivos" className="font-semibold underline">
            Ver niveles →
          </Link>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6 sm:mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : resumen ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-green-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><CircleDollarSign className="w-4 h-4 text-green-600 shrink-0" aria-hidden="true" /> <span className="truncate">Ingresos Mes</span></p>
            <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">${resumen.ingresosMes.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-red-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><ArrowUpFromLine className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" /> <span className="truncate">Egresos Mes</span></p>
            <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">${resumen.egresosMes.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-blue-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" /> <span className="truncate">Balance Mes</span></p>
            <p className={`text-xl sm:text-3xl font-bold truncate ${resumen.balanceMes >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${resumen.balanceMes.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-purple-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" /> <span className="truncate">Transacciones</span></p>
            <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{resumen.totalTransacciones}</p>
          </div>
        </div>
      ) : null}

      {visibleSecciones.length === 0 ? (
        <EmptyState
          icon="money"
          message="No hay secciones financieras que coincidan con la búsqueda"
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
          {visibleSecciones.map((sec) => (
            <Link
              key={sec.href}
              href={sec.href}
              className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 hover:shadow-lg transition-shadow border border-gray-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 sm:gap-4">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <AppIcon icon={sec.icon} className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-lg font-semibold text-gray-900 leading-snug">{sec.label}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2">{sec.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
