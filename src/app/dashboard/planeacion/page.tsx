"use client";

import { useState } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import TableSearch from "@/components/TableSearch";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { matchesTextQuery } from "@/lib/text";

const opciones = [
  {
    href: "/dashboard/planeacion/calendario",
    icon: "calendar",
    label: "Calendario Maestro y Rutinas",
    desc: "Unifica todas las fechas de producción, sanidad ICA, incubación, reproducción, cosecha de lotes, compostaje y finanzas con tu rutina diaria auto-ajustable y control de cumplidos vs. incumplidos.",
  },
  {
    href: "/dashboard/produccion/plan-parvada",
    icon: "clipboard",
    label: "Plan de Parvada",
    desc: "Diagnostica la parvada real y proyecta postura, alimento y reemplazo con la edad de cada gallina. Ideal para planificar gallinas, gallos y fechas de reemplazo.",
  },
  {
    href: "/dashboard/soberania",
    icon: "home",
    label: "Soberanía Alimentaria",
    desc: "Gestión integral de la proteína producida para el hogar y cuantificación del ahorro económico en la canasta familiar. Registra consumo de huevos y carne en casa.",
  },
];

export default function PlaneacionPage() {
  const [search, setSearch] = useState("");
  const visibleOpciones = opciones.filter((op) =>
    matchesTextQuery(search, [op.label, op.desc]),
  );

  return (
    <div>
      <PageHeader
        title="Planeación y Soberanía"
        description="Calendario maestro con rutinas auto-ajustables, proyección de parvada y soberanía alimentaria del hogar."
        help="Este grupo unifica la programación operativa y la planificación a mediano y largo plazo de tu granja:\n\n• Calendario Maestro y Rutinas: centraliza tareas diarias auto-ajustables en Inicio, eventos de sanidad, incubación, reproducción, lotes, compostaje y vencimientos financieros, con seguimiento de cumplidos vs. incumplidos.\n• Plan de Parvada: proyección de postura, alimento y reemplazo basada en la edad real de tus gallinas.\n• Soberanía Alimentaria: seguimiento de lo que produces y consumes en casa (huevos y carne multiespecie), con cálculo de ahorro económico versus mercado."
      />

      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Buscar en planeación y soberanía..."
        resultCount={visibleOpciones.length}
        totalCount={opciones.length}
        className="mb-6"
      />

      {visibleOpciones.length === 0 ? (
        <Card>
          <EmptyState
            icon="clipboard"
            message="No hay opciones de planeación que coincidan con la búsqueda"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
          {visibleOpciones.map((op) => (
            <Card key={op.href} className="hover:shadow-md transition-shadow cursor-pointer group border-2 border-transparent hover:border-green-400 p-0! overflow-hidden">
              <Link
                href={op.href}
                className="flex flex-col h-full p-3.5 sm:p-6 min-w-0"
              >
                <div className="flex items-center justify-between mb-2.5 sm:mb-4">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-700 shrink-0">
                    <AppIcon icon={op.icon} className="w-4 h-4 sm:w-6 sm:h-6" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-green-600 group-hover:text-green-700">Entrar</span>
                </div>
                <h3 className="text-sm sm:text-lg font-bold text-slate-800 mb-1 sm:mb-2 leading-snug">{op.label}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mb-3 line-clamp-2 flex-1">{op.desc}</p>
                <div className="mt-auto pt-2.5 sm:pt-4 border-t border-slate-200">
                  <span className="text-[11px] sm:text-xs font-semibold text-green-600 line-clamp-1">
                    → Abrir {op.label}
                  </span>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
        <p className="font-semibold mb-2">¿Por dónde empezar?</p>
        <p className="mb-2">
          Si quieres organizar tu rutina diaria auto-ajustable y ver todo lo programado a mediano y largo plazo, abre{" "}
          <Link href="/dashboard/planeacion/calendario" className="font-semibold text-green-700 hover:underline">
            Calendario Maestro y Rutinas
          </Link>
          .
        </p>
        <p className="mb-2">
          Si quieres organizar cuántas gallinas necesitas y cuándo reemplazarlas, comienza con{" "}
          <Link href="/dashboard/produccion/plan-parvada" className="font-semibold text-green-700 hover:underline">
            Plan de Parvada
          </Link>
          .
        </p>
        <p>
          Si quieres medir cuánto ahorras comiendo lo que produce tu granja, ve a{" "}
          <Link href="/dashboard/soberania" className="font-semibold text-green-700 hover:underline">
            Soberanía Alimentaria
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
