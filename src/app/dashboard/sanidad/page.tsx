"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";

const secciones = [
  { href: "/sanidad/control", label: "Control Sanitario", icon: "💊", desc: "Tratamientos y aplicaciones" },
  { href: "/sanidad/calendario", label: "Calendario Sanitario", icon: "📅", desc: "Vacunas y recordatorios" },
  { href: "/sanidad/alertas", label: "Alertas de Fase", icon: "🔔", desc: "Alertas sanitarias por lote" },
];

interface ResumenSanidad {
  totalEventos: number;
  eventosMes: number;
  proximosEventos: number;
  costoTotal: number;
}

export default function SanidadPage() {
  const [resumen, setResumen] = useState<ResumenSanidad | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/sanidad/resumen")
      .then((r) => r.json())
      .then(setResumen)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span className="text-4xl">💊</span>
          Sanidad
        </h1>
        <p className="text-gray-600 mt-2">
          Control sanitario de la parvada: tratamientos, vacunas y calendarios.
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
            <p className="text-sm text-gray-600 mb-1">📋 Total Eventos</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.totalEventos}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 mb-1">📅 Eventos Mes</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.eventosMes}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 mb-1">⏰ Próximos Eventos</p>
            <p className="text-3xl font-bold text-gray-900">{resumen.proximosEventos}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 mb-1">💰 Costo Total</p>
            <p className="text-3xl font-bold text-gray-900">${resumen.costoTotal.toLocaleString()}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
