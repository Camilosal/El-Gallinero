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
  { href: "/analisis/kpis", label: "KPIs e indicadores", icon: "target", desc: "Postura, bajas, alimento por kilo ganado, qué tan parejo va el lote, punto de equilibrio y retorno de equipos" },
  { href: "/analisis/reportes", label: "Reportes", icon: "clipboard", desc: "Ganancias por especie repartiendo gastos compartidos, dinero en caja vs. patrimonio, Excel y PDF" },
  { href: "/analisis/razas", label: "Curvas y desempeño", icon: "trend-up", desc: "Postura y crecimiento por especie ajustados según altura y temperatura de la finca" },
  { href: "/analisis/fuentes-externas", label: "Clima, mercado y entorno", icon: "globe", desc: "Pronóstico de calor y humedad en galpón, precios de mercado, alertas sanitarias, festivos y sensores" },
  { href: "/analisis/normas", label: "Normas, estándares y guías aplicables", icon: "book-open", desc: "Resoluciones sanitarias, tamaños de huevo, bienestar animal y guías con PDFs y ayuda de Gina" },
  { href: "/exportar", label: "Exportación y Conectores ERP", icon: "download", desc: "Descarga CSV/Excel multi-hoja, API JSON incremental, tokens y mapeo PUC para SIIGO, Alegra, Odoo y Zoho" },
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
    <div>
      <HeroBanner
        theme="analisis"
        icon={<BarChart3 className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        title="Análisis"
        description="Indicadores sencillos de producción y finanzas, curvas ajustadas a tu clima, normas aplicables y reportes por especie listos para Excel o PDF."
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
          <Link href="/configuracion/modulos" className="font-semibold underline">
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
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-green-500 flex flex-col justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><Egg className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" /> <span className="truncate">Producción Mes</span></p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{resumen.produccionMes}</p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 line-clamp-1">Huevos recolectados (30 días)</p>
            </div>
            <Link href="/produccion/huevos" className="mt-2 inline-flex text-xs font-semibold text-green-700 hover:underline">
              Ver registros de huevos →
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-red-500 flex flex-col justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><Skull className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" /> <span className="truncate">Mortalidad Mes</span></p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{resumen.mortalidadMes}</p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 line-clamp-1">Bajas acumuladas en 30 días</p>
            </div>
            <Link href="/produccion/mortalidad" className="mt-2 inline-flex text-xs font-semibold text-rose-700 hover:underline">
              Auditar causas y sanidad →
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-blue-500 flex flex-col justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><Target className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" /> <span className="truncate">Productividad</span></p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{resumen.productividad}</p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 line-clamp-1">Huevos por gallina en 30 días</p>
            </div>
            <Link href="/analisis/kpis" className="mt-2 inline-flex text-xs font-semibold text-blue-700 hover:underline">
              Comparar vs. meta de raza →
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3.5 sm:p-6 min-w-0 border-l-4 border-purple-500 flex flex-col justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1 flex items-center gap-1.5"><PawPrint className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" /> <span className="truncate">Animales</span></p>
              <p className="text-xl sm:text-3xl font-bold text-gray-900 truncate">{resumen.totalAnimals ?? resumen.totalGallinas}</p>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 line-clamp-1">{speciesHint || `${resumen.totalBirds ?? 0} aves`}</p>
            </div>
            <Link href="/animales" className="mt-2 inline-flex text-xs font-semibold text-purple-700 hover:underline">
              Ver inventario por lote →
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-green-50 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Centro de control conectado a tu granja
          </p>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Tablero de KPIs con metas por especie, comparación de períodos y vista personalizable
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Filtra por galpón, especie o lote y elige entre enfoque de Postura, Engorde, Gerencial o tu propia selección de indicadores.
          </p>
        </div>
        <Link
          href="/analisis/kpis"
          className="inline-flex items-center justify-center shrink-0 rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 text-sm font-semibold shadow-xs transition-colors"
        >
          Abrir tablero de KPIs personalizable →
        </Link>
      </div>

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
