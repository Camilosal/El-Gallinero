"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpFromLine, BarChart3, CircleDollarSign, ClipboardList } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { apiFetch } from "@/lib/fetch";

const secciones = [
  { href: "/dashboard/finanzas/ventas", label: "Ventas", icon: "money", desc: "Facturación" },
  { href: "/dashboard/finanzas/egresos", label: "Egresos", icon: "outgoing", desc: "Gastos" },
  { href: "/dashboard/finanzas/finanzas", label: "Finanzas", icon: "trend-up", desc: "Balance y P&L" },
  { href: "/dashboard/finanzas/presupuestos", label: "Presupuestos", icon: "banknote", desc: "Planificación financiera" },
  { href: "/dashboard/finanzas/cuentas", label: "Cuentas", icon: "card", desc: "CxC y CxP" },
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

  useEffect(() => {
    apiFetch("/api/finanzas/resumen")
      .then((r) => r.json())
      .then(setResumen)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <CircleDollarSign className="w-8 h-8 text-green-700 shrink-0" aria-hidden="true" />
          Finanzas
        </h1>
        <p className="text-gray-600 mt-2">
          Gestión financiera: ventas, egresos, balance, presupuestos y cuentas por cobrar/pagar.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : resumen ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1.5"><CircleDollarSign className="w-4 h-4 text-green-600" aria-hidden="true" /> Ingresos Mes</p>
            <p className="text-3xl font-bold text-gray-900">${resumen.ingresosMes.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1.5"><ArrowUpFromLine className="w-4 h-4 text-red-600" aria-hidden="true" /> Egresos Mes</p>
            <p className="text-3xl font-bold text-gray-900">${resumen.egresosMes.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-blue-600" aria-hidden="true" /> Balance Mes</p>
            <p className={`text-3xl font-bold ${resumen.balanceMes >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${resumen.balanceMes.toLocaleString()}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-purple-600" aria-hidden="true" /> Transacciones</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.totalTransacciones}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {secciones.map((sec) => (
          <Link
            key={sec.href}
            href={sec.href}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <AppIcon icon={sec.icon} className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{sec.label}</h3>
                <p className="text-sm text-gray-600 mt-1">{sec.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
