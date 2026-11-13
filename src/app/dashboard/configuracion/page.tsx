"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { HeroBanner } from "@/components/HeroBanner";
import TableSearch from "@/components/TableSearch";
import { EmptyState } from "@/components/ui";
import { DeveloperCredit } from "@/components/DeveloperCredit";
import { matchesTextQuery } from "@/lib/text";

const secciones = [
  { href: "/dashboard?wizard=1", label: "Asistente inicial (Día 1 · 3 pasos)", icon: "sparkles", desc: "Lanza el asistente guiado para cargar datos de la finca, lugares, animales actuales y alimento o plantilla CSV" },
  { href: "/dashboard/configuracion/kit-campo", label: "Kit de Campo y Entrega Llave en Mano", icon: "qrcode", desc: "Cronograma vivo de 4 semanas, plancha QR plastificable en lote, mapa ICA y Acta Semana 4 PDF" },
  { href: "/dashboard/configuracion/usuarios", label: "Usuarios y Roles de la Granja", icon: "users", desc: "Crea accesos para operario de galpón, veterinario o gerente sin usar consola técnica" },
  { href: "/dashboard/configuracion/granjas", label: "Panel Super-Admin de Granjas (Tenants)", icon: "shield", desc: "Administra fincas registradas, planes, vencimientos, cupos de usuarios, altas Llave en Mano y soporte multi-granja" },
  { href: "/dashboard/configuracion/plan", label: "Plan por Ciclo y Pagos (Nequi / PSE)", icon: "credit-card", desc: "Renueva por cosecha de 60 días o plan semestral/anual mediante Nequi, Daviplata o PSE" },
  { href: "/dashboard/configuracion/modulos", label: "Onboarding Progresivo, Escala y Módulos", icon: "sparkles", desc: "Perfil Pequeño vs Mediano, auto-triggers de crecimiento, Feature Flags y Asistente Día 1 sin historial" },
  { href: "/dashboard/configuracion/catalogos", label: "Catálogos y datos de la granja", icon: "folder", desc: "8 pestañas maestras: listas, contactos, parámetros, 6 especies, vacunas, pesos, gallinaza y tabla nutricional" },
  { href: "/dashboard/contactos", label: "Clientes y Proveedores", icon: "handshake", desc: "Directorio comercial con teléfonos, WhatsApp, ubicación GPS y plazos de crédito" },
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

      <DeveloperCredit variant="card" className="mt-8" />
    </div>
  );
}
