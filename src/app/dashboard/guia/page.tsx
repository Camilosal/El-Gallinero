import Link from "next/link";
import { BookOpen, Rocket } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { guideModules, guides } from "@/lib/guide-data";

export default function GuiaIndexPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-green-700 shrink-0" aria-hidden="true" />
          Guía de Usuario
        </h1>
        <p className="text-slate-500 mt-2 text-lg">
          Aprende a usar El Gallinero paso a paso. Selecciona un módulo para ver las guías disponibles.
        </p>
      </div>

      {/* Quick start banner */}
      <div className="mb-8 p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Rocket className="w-6 h-6 text-green-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-green-800 text-lg">¿Nuevo en El Gallinero?</h2>
            <p className="text-green-700 text-sm mt-1">
              Comienza con la guía de{" "}
              <Link href="/dashboard/guia/primeros-pasos" className="font-semibold underline hover:no-underline">
                Primeros Pasos
              </Link>{" "}
              para configurar tu granja y aprender lo básico.
            </p>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {guideModules.map((mod) => {
          const modGuides = guides.filter((g) => g.module === mod.id);
          if (modGuides.length === 0) return null;

          return (
            <div
              key={mod.id}
              className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Module header */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <AppIcon icon={mod.icon} className="w-5 h-5 text-slate-700 shrink-0" />
                  {mod.label}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{mod.description}</p>
              </div>

              {/* Guide list */}
              <div className="divide-y divide-slate-100">
                {modGuides.map((guide) => (
                  <Link
                    key={guide.slug}
                    href={`/dashboard/guia/${guide.slug}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <AppIcon icon={guide.icon} className="w-4 h-4 text-slate-500 group-hover:text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 group-hover:text-green-700 transition-colors truncate">
                        {guide.title}
                      </p>
                    </div>
                    <span className="text-slate-300 group-hover:text-green-500 transition-colors text-sm">→</span>
                  </Link>
                ))}
              </div>

              {/* Module footer */}
              <div className="px-5 py-2 bg-slate-50/50 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  {modGuides.length} {modGuides.length === 1 ? "guía" : "guías"} disponibles
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="mt-8 p-5 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex flex-wrap gap-6 justify-center text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">{guides.length}</p>
            <p className="text-xs text-slate-500">Guías disponibles</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{guideModules.filter((m) => guides.some((g) => g.module === m.id)).length}</p>
            <p className="text-xs text-slate-500">Módulos cubiertos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">∞</p>
            <p className="text-xs text-slate-500">Consultas ilimitadas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
