"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, lazy, useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";

const GallinasTab = lazy(() => import("./_components/GallinasTab"));
const PollosTab = lazy(() => import("./_components/PollosTab"));
const AlimentacionTab = lazy(() => import("./_components/AlimentacionTab"));
const HuevosTab = lazy(() => import("./_components/HuevosTab"));
const IncubacionTab = lazy(() => import("./_components/IncubacionTab"));
const CarneTab = lazy(() => import("./_components/CarneTab"));
const GallinazaTab = lazy(() => import("./_components/GallinazaTab"));

const tabComponents: Record<string, React.ComponentType> = {
  gallinas: GallinasTab,
  pollos: PollosTab,
  alimentacion: AlimentacionTab,
  huevos: HuevosTab,
  incubacion: IncubacionTab,
  carne: CarneTab,
  gallinaza: GallinazaTab,
};

const secciones = [
  { href: "/dashboard/produccion?tab=huevos", label: "Huevos", icon: "🥚", desc: "Recolección diaria y producción" },
  { href: "/dashboard/produccion?tab=carne", label: "Carne", icon: "🍗", desc: "Faena, despiece y rendimiento" },
  { href: "/dashboard/produccion?tab=gallinaza", label: "Gallinaza", icon: "🌱", desc: "Recolección, procesamiento y ventas" },
];

interface ResumenProduccion {
  huevosHoy: number;
  huevosSemana: number;
  totalGallinas: number;
  totalAnimals: number;
  totalBirds: number;
  species?: { species: string; label: string; count: number }[];
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
  const router = useRouter();
  const tab = searchParams.get("tab");
  const TabComponent = tab ? tabComponents[tab] : null;

  useEffect(() => {
    if (tab === "inventario") {
      router.replace("/dashboard/inventarios/balance");
    }
  }, [tab, router]);

  if (tab === "inventario") {
    return <TabFallback />;
  }

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

  const speciesHint = (resumen?.species ?? [])
    .filter((s) => s.count > 0)
    .map((s) => `${s.count} ${s.label.toLowerCase()}`)
    .join(" · ");

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span className="text-4xl">🥚</span>
          Producción
        </h1>
        <p className="text-gray-600 mt-2">
          Productos generados por la granja: huevos, carne y gallinaza. Los animales y sus registros se gestionan en el grupo Animales.
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
            <p className="text-sm text-gray-600 mb-1">🐾 Animales en Inventario</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.totalAnimals ?? resumen.totalGallinas}</p>
            <p className="text-xs text-gray-500 mt-1">{speciesHint || `${resumen.totalBirds ?? 0} aves`}</p>
            <Link href="/dashboard/animales" className="mt-1 inline-block text-xs font-semibold text-purple-700 hover:underline">
              Ver animales →
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">💀 Mortalidad Semana</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.mortalidadSemana}</p>
            <Link href="/dashboard/produccion/mortalidad" className="mt-1 inline-block text-xs font-semibold text-red-700 hover:underline">
              Ver registro →
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <strong>🐾 ¿Buscas gallinas, gallos, pollos, conejos o lotes?</strong> Su registro e inventario están en Animales.
        </p>
        <Link href="/dashboard/animales" className="font-semibold text-green-800 hover:underline">
          Ir a Animales →
        </Link>
      </div>

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
