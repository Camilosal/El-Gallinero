import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";

const secciones = [
  { href: "/dashboard/configuracion/catalogos", label: "Catálogos y datos de la granja", icon: "folder", desc: "Perfil del predio, clientes, proveedores y parámetros del sistema" },
];

export default function ConfiguracionPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <FolderKanban className="w-8 h-8 text-green-700 shrink-0" aria-hidden="true" />
          Configuración
        </h1>
        <p className="text-gray-600 mt-2">
          Tablas maestras y configuración general del sistema.
        </p>
      </div>

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
