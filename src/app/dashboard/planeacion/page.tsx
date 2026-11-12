"use client";

import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { PageHeader, Card } from "@/components/ui";

const opciones = [
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
  return (
    <div>
      <PageHeader
        title="Planeación y Soberanía"
        description="Planificación de la parvada y soberanía alimentaria del hogar."
        help="Este grupo agrupa la planificación a futuro de tu granja y el autoconsumo familiar.\n\n• Plan de Parvada: proyección de postura, alimento y reemplazo basada en la edad real de tus gallinas.\n• Soberanía Alimentaria: seguimiento de lo que produces y consumes en casa, con cálculo del ahorro económico versus el mercado."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {opciones.map((op) => (
          <Card key={op.href} className="hover:shadow-md transition-shadow cursor-pointer group border-2 border-transparent hover:border-green-400">
            <Link
              href={op.href}
              className="block p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-700">
                  <AppIcon icon={op.icon} className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-green-400 group-hover:text-green-300">Entrar</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">{op.label}</h3>
              <p className="text-sm text-slate-600 mb-4">{op.desc}</p>
              <div className="mt-auto pt-4 border-t border-slate-200">
                <span className="text-xs font-semibold text-green-600">
                  → Abrir {op.label}
                </span>
              </div>
            </Link>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
        <p className="font-semibold mb-2">¿Por dónde empezar?</p>
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
