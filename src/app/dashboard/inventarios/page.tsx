"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";

const secciones = [
  { href: "/inventarios/huevos", label: "Inventario Huevos", icon: "📦", desc: "Stock por tipo y edad" },
  { href: "/inventarios/carne", label: "Inventario Carne", icon: "🍗", desc: "Stock de carne por lote" },
  { href: "/inventarios/gallinaza", label: "Inventario Gallinaza", icon: "🌱", desc: "Stock de abono" },
  { href: "/inventarios/balance", label: "Balance de Inventario", icon: "⚖️", desc: "Entradas y salidas" },
  { href: "/inventarios/insumos", label: "Insumos", icon: "🧰", desc: "Alimento, medicamentos, empaques" },
];

interface ResumenInventarios {
  totalHuevos: number;
  huevosPorVencer: number;
  totalAlimento: number;
  totalGallinaza: number;
  totalAves: number;
}

export default function InventariosPage() {
  const [resumen, setResumen] = useState<ResumenInventarios | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/inventarios/resumen")
      .then((r) => r.json())
      .then(setResumen)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span className="text-4xl">📦</span>
          Inventarios
        </h1>
        <p className="text-gray-600 mt-2">
          Consolidado de todos los recursos: huevos, aves, insumos y gallinaza.
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
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 mb-1">🥚 Total Huevos</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.totalHuevos}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">⚠️ Por Vencer (&gt;21 días)</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.huevosPorVencer}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">🌾 Alimento (kg)</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.totalAlimento.toFixed(1)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 mb-1">🐔 Aves Activas</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.totalAves}</p>
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
