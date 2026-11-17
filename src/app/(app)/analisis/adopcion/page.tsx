"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { HeroBanner } from "@/components/HeroBanner";
import AdoptionKpiPanel from "@/components/AdoptionKpiPanel";

export default function AdopcionPage() {
  return (
    <div>
      <HeroBanner
        theme="analisis"
        icon={<Activity className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        title="Adopción y hábitos"
        description="Qué tan rápido arrancaste, cuánto te toma registrar en el galpón y qué tan constante es tu equipo. Semáforos sencillos con la meta del Plan Maestro y un enlace directo para mejorar cada indicador."
      />

      <AdoptionKpiPanel />

      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 text-sm text-slate-700 space-y-2">
        <p className="font-semibold text-emerald-900">¿Cómo se calculan estos indicadores?</p>
        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
          <li><strong>Arranque Día 1:</strong> duración real del wizard de configuración inicial (sin transcribir cuadernos antiguos).</li>
          <li><strong>Captura en galpón:</strong> mediana de segundos entre abrir la captura rápida y guardar, incluyendo registros hechos sin conexión.</li>
          <li><strong>Adherencia semanal:</strong> días con cierre diario o actividad registrada sobre 7; la meta de ≥85% aplica desde la tercera semana.</li>
          <li><strong>Racha:</strong> días consecutivos con actividad, viva hasta hoy o ayer.</li>
          <li><strong>Integridad sanitaria:</strong> animales activos con raza registrada y plan sanitario vigente; los retiros de medicamentos bloquean ventas automáticamente.</li>
          <li><strong>Visibilidad financiera:</strong> centros de costo por especie/lugar activos para evitar que una especie subsidie a otra.</li>
        </ul>
        <p className="text-xs">
          Los datos se guardan en tu granja (no se comparten con terceros). Revisa también{" "}
          <Link href="/analisis/kpis" className="font-semibold text-emerald-800 underline">KPIs productivos</Link>{" "}
          y{" "}
          <Link href="/configuracion/fallas" className="font-semibold text-emerald-800 underline">reporta fallas</Link>{" "}
          si algo no cuadra.
        </p>
      </div>
    </div>
  );
}