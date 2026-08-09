"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const secciones = [
  { href: "/operaciones/mantenimiento", label: "Mantenimiento", icon: "🔧", desc: "Equipos e instalaciones" },
  { href: "/operaciones/gallinaza", label: "Gallinaza", icon: "🌱", desc: "Recolección y procesamiento" },
];

interface ResumenOperaciones {
  totalTareas: number;
  tareasPendientes: number;
  tareasCompletadas: number;
  costoTotal: number;
}

export default function OperacionesPage() {
  const [resumen, setResumen] = useState<ResumenOperaciones | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/operaciones/resumen")
      .then((r) => r.json())
      .then(setResumen)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span className="text-4xl">🔧</span>
          Operaciones
        </h1>
        <p className="text-gray-600 mt-2">
          Infraestructura y subproductos: mantenimiento de equipos y gestión de gallinaza.
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
            <p className="text-sm text-gray-600 mb-1">🔧 Total Tareas</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.totalTareas}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 mb-1">⏳ Pendientes</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.tareasPendientes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">✅ Completadas</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.tareasCompletadas}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">💰 Costo Total</p>
            <p className="text-3xl font-bold text-gray-900">${resumen.costoTotal.toLocaleString()}</p>
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
