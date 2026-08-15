"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, lazy, useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";

const GallinasTab = lazy(() => import("./_components/GallinasTab"));
const PollosTab = lazy(() => import("./_components/PollosTab"));
const AlimentacionTab = lazy(() => import("./_components/AlimentacionTab"));
const HuevosTab = lazy(() => import("./_components/HuevosTab"));
const IncubacionTab = lazy(() => import("./_components/IncubacionTab"));
const CarneTab = lazy(() => import("./_components/CarneTab"));
const GallinazaTab = lazy(() => import("./_components/GallinazaTab"));
const InventarioTab = lazy(() => import("./_components/InventarioTab"));

const tabComponents: Record<string, React.ComponentType> = {
  gallinas: GallinasTab,
  pollos: PollosTab,
  alimentacion: AlimentacionTab,
  huevos: HuevosTab,
  incubacion: IncubacionTab,
  carne: CarneTab,
  gallinaza: GallinazaTab,
  inventario: InventarioTab,
};

const secciones = [
  { href: "/produccion/gallinas", label: "Gallinas", icon: "🐔", desc: "Parvada activa y lotes" },
  { href: "/produccion/pollos", label: "Pollos y Gallos", icon: "🐓", desc: "Levante y engorde" },
  { href: "/produccion/adquisiciones", label: "Adquisiciones", icon: "📥", desc: "Entrada de aves" },
  { href: "/produccion/alimentacion", label: "Alimentación", icon: "🌾", desc: "Consumo y programas" },
  { href: "/produccion/huevos", label: "Producción Huevos", icon: "🥚", desc: "Recolección diario" },
  { href: "/produccion/incubacion", label: "Incubación", icon: "🐣", desc: "Nacimientos y fertilidad" },
  { href: "/produccion/sacrificio", label: "Carne", icon: "🍗", desc: "Procesamiento" },
  { href: "/produccion?tab=gallinaza", label: "Gallinaza", icon: "🌱", desc: "Producción y ventas" },
  { href: "/produccion?tab=inventario", label: "Inventario", icon: "📦", desc: "Stock consolidado" },
  { href: "/produccion/mortalidad", label: "Mortalidad", icon: "💀", desc: "Bajas por lote" },
  { href: "/produccion/plan-parvada", label: "Plan Parvada", icon: "🏠", desc: "Proyecciones" },
];

interface ResumenProduccion {
  huevosHoy: number;
  huevosSemana: number;
  totalGallinas: number;
  mortalidadSemana: number;
  consumoAlimentoSemanal: number;
}

function TabFallback() {
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProduccionPage() {
  return (
    <Suspense fallback={<TabFallback />}>
      <ProduccionContent />
    </Suspense>
  );
}

function ProduccionContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const TabComponent = tab ? tabComponents[tab] : null;

  if (TabComponent) {
    return (
      <Suspense fallback={<TabFallback />}>
        <TabComponent />
      </Suspense>
    );
  }

  return <CategoryView />;
}

function CategoryView() {
  const [resumen, setResumen] = useState<ResumenProduccion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/produccion/resumen")
      .then((r) => r.json())
      .then(setResumen)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span className="text-4xl">🐔</span>
          Producción
        </h1>
        <p className="text-gray-600 mt-2">
          Gestión de procesos productivos: parvada, alimentación, producción de huevos, incubación y sacrificio.
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
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 mb-1">🥚 Huevos Hoy</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.huevosHoy}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">🥚 Huevos Semana</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.huevosSemana}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1">🐔 Gallinas Activas</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.totalGallinas}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">💀 Mortalidad Semana</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.mortalidadSemana}</p>
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
              <span className="text-4xl">{sec.icon}</span>
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
