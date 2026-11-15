"use client";

import { BookOpen, Globe, GraduationCap, Settings } from "lucide-react";
import { HeroActionLink, HeroBanner } from "@/components/HeroBanner";
import NormasGuiasTab from "@/app/(app)/configuracion/catalogos/_components/NormasGuiasTab";

export default function AnalisisNormasPage() {
  return (
    <div className="space-y-6">
      <HeroBanner
        theme="analisis"
        icon={<BookOpen className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        eyebrow="Análisis y Cumplimiento · Referencias aplicables"
        title="Normas, Estándares y Guías Aplicables"
        description="Consulta resoluciones ICA, NTC 1240, guías de bienestar animal y protocolos propios de tu granja con sus adjuntos PDF o fotográficos y apoyo de Gina."
        actions={
          <>
            <HeroActionLink href="/analisis/fuentes-externas" tone="glass">
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clima y mercado</span>
            </HeroActionLink>
            <HeroActionLink href="/manual" tone="glass">
              <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Manual de uso</span>
            </HeroActionLink>
            <HeroActionLink href="/configuracion/catalogos?tab=normas" tone="solid">
              <Settings className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Abrir en Catálogos</span>
            </HeroActionLink>
          </>
        }
      />

      <NormasGuiasTab />
    </div>
  );
}
