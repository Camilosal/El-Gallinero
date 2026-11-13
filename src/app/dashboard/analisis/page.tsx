"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, Egg, PawPrint, Skull, Target } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { HeroBanner } from "@/components/HeroBanner";
import TableSearch from "@/components/TableSearch";
import { EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { isHrefEnabledByFlags } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/useOnboardingState";

const secciones = [
  { href: "/dashboard/analisis/kpis", label: "KPIs", icon: "target", desc: "HAA, mortalidad, FCR, CV%, EPEF, punto de equilibrio y CAPEX/ROI" },
  { href: "/dashboard/analisis/reportes", label: "Reportes", icon: "clipboard", desc: "Contabilidad analítica por especie con prorrateo, Excel y PDF" },
  { href: "/dashboard/analisis/razas", label: "Curvas y desempeño", icon: "trend-up", desc: "Postura y crecimiento multi-especie ajustados por altitud" },
  { href: "/dashboard/configuracion/catalogos", label: "Catálogos y Datos Maestros", icon: "folder", desc: "8 secciones: especies, razas, nutrición, vacunas y parámetros" },
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
  const [search, setSearch] = useState("");
  const { flags } = useOnboardingState();

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

  const enabledSecciones = secciones.filter((sec) => isHrefEnabledByFlags(sec.href, flags));
  const hiddenSeccionesCount = secciones.length - enabledSecciones.length;
  const visibleSecciones = enabledSecciones.filter((sec) =>
    matchesTextQuery(search, [sec.label, sec.desc]),
  );

  return (
    <div className="p-8">
      <HeroBanner
        theme="analisis"
        icon={<BarChart3 className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        title="Análisis"
        description="Indicadores zootécnicos y financieros (HAA, EPEF, punto de equilibrio, CAPEX/ROI), curvas por especie y contabilidad analítica exportable."
      />

      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Buscar en secciones de análisis..."
        resultCount={visibleSecciones.length}
        totalCount={enabledSecciones.length}
        className="mb-6"
      />
      {hiddenSeccionesCount > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900">
          <span>Modo Pequeño: {hiddenSeccionesCount} secciones técnicas (KPIs / Curvas) ocultas hasta pasar a Mediano o habilitar el módulo.</span>
          <Link href="/dashboard/guia/niveles-productivos" className="font-semibold underline">
            Administrar niveles →
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
            <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><Egg className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" /> <span className="truncate">Producción Mes</span></p>
            <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{resumen.produccionMes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-red-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><Skull className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" /> <span className="truncate">Mortalidad Mes</span></p>
            <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{resumen.mortalidadMes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-blue-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><Target className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" /> <span className="truncate">Productividad</span></p>
            <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{resumen.productividad}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-purple-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><PawPrint className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" /> <span className="truncate">Animales</span></p>
            <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{resumen.totalAnimals ?? resumen.totalGallinas}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 line-clamp-1">{speciesHint || `${resumen.totalBirds ?? 0} aves`}</p>
          </div>
        </div>
      ) : null}

      {visibleSecciones.length === 0 ? (
        <EmptyState
          icon="target"
          message="No hay secciones de análisis que coincidan con la búsqueda"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-6">
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
