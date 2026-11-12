"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { HeroBanner } from "@/components/HeroBanner";
import TableSearch from "@/components/TableSearch";
import { EmptyState } from "@/components/ui";
import { matchesTextQuery } from "@/lib/text";

const secciones = [
  { href: "/dashboard/configuracion/catalogos", label: "Catálogos y datos de la granja", icon: "folder", desc: "Perfil del predio, clientes, proveedores y parámetros del sistema" },
];

export default function ConfiguracionPage() {
  const [search, setSearch] = useState("");
  const visibleSecciones = secciones.filter((sec) =>
    matchesTextQuery(search, [sec.label, sec.desc]),
  );

  return (
    <div className="p-8">
      <HeroBanner
        theme="guia"
        icon={<FolderKanban className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        title="Configuración"
        description="Tablas maestras y configuración general del sistema."
      />

      <TableSearch
        value={search}
        onChange={setSearch}
        placeholder="Buscar en configuración y catálogos..."
        resultCount={visibleSecciones.length}
        totalCount={secciones.length}
        className="mb-6"
      />

      {visibleSecciones.length === 0 ? (
        <EmptyState
          icon="folder"
          message="No hay apartados de configuración que coincidan con la búsqueda"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleSecciones.map((sec) => (
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
      )}
    </div>
  );
}
