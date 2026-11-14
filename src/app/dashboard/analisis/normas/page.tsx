"use client";

import Link from "next/link";
import { BookOpen, Globe, GraduationCap, Settings } from "lucide-react";
import { HeroBanner } from "@/components/HeroBanner";
import NormasGuiasTab from "@/app/dashboard/configuracion/catalogos/_components/NormasGuiasTab";

export default function AnalisisNormasPage() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <HeroBanner
        theme="analisis"
        icon={<BookOpen className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        eyebrow="Análisis y Cumplimiento · Referencias aplicables"
        title="Normas, Estándares y Guías Aplicables"
        description="Consulta resoluciones ICA, NTC 1240, guías de bienestar animal y protocolos propios de tu granja con sus adjuntos PDF o fotográficos y apoyo de Gina."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/analisis/fuentes-externas"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors"
            >
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clima y mercado</span>
            </Link>
            <Link
              href="/dashboard/guia"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors"
            >
              <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Manual de uso</span>
            </Link>
            <Link
              href="/dashboard/configuracion/catalogos?tab=normas"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors"
            >
              <Settings className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Abrir en Catálogos</span>
            </Link>
          </div>
        }
      />

      <NormasGuiasTab />
    </div>
  );
}
