"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, Egg, PawPrint, Skull, Target } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { apiFetch } from "@/lib/fetch";

const secciones = [
  { href: "/dashboard/analisis/kpis", label: "KPIs", icon: "target", desc: "Productividad, mortalidad, conversión" },
  { href: "/dashboard/analisis/reportes", label: "Reportes", icon: "clipboard", desc: "Reportes exportables" },
];

interface ResumenAnalisis {
  produccionMes: number;
  mortalidadMes: number;
  consumoAlimentoMes: number;
  totalGallinas: number;
  totalAnimals: number;
  totalBirds: number;
  species?: { species: string; label: string; count: number }[];
  productividad: string;
}

export default function AnalisisPage() {
  const [resumen, setResumen] = useState<ResumenAnalisis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/analisis/resumen")
      .then((r) => r.json())
      .then(setResumen)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const speciesHint = (resumen?.species ?? [])
    .filter((s) => s.count > 0)
    .map((s) => `${s.count} ${s.label.toLowerCase()}`)
    .join(" · ");

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-green-700 shrink-0" aria-hidden="true" />
          Análisis
        </h1>
        <p className="text-gray-600 mt-2">
          Indicadores clave y reportes: KPIs de productividad, mortalidad, conversión alimenticia y más.
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
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1.5"><Egg className="w-4 h-4 text-amber-500" aria-hidden="true" /> Producción Mes</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.produccionMes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1.5"><Skull className="w-4 h-4 text-red-600" aria-hidden="true" /> Mortalidad Mes</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.mortalidadMes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1.5"><Target className="w-4 h-4 text-blue-600" aria-hidden="true" /> Productividad</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.productividad}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1.5"><PawPrint className="w-4 h-4 text-purple-600" aria-hidden="true" /> Animales en Inventario</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.totalAnimals ?? resumen.totalGallinas}</p>
            <p className="text-xs text-gray-500 mt-1">{speciesHint || `${resumen.totalBirds ?? 0} aves`}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
