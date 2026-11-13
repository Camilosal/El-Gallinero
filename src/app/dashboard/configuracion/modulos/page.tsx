"use client";

import { PageHeader } from "@/components/ui";
import FeatureFlagsPanel from "@/components/FeatureFlagsPanel";

export default function ConfiguracionModulosPage() {
  return (
    <div>
      <PageHeader
        theme="analisis"
        icon="sparkles"
        title="Onboarding Progresivo, Escala y Módulos"
        description="Adapta la app entre Pequeño Productor y Mediano Tecnificado sobre la misma base de código, sin migraciones ni pérdida de historial."
        help="Los 4 módulos esenciales están siempre activos. Los 5 módulos avanzados se desbloquean automáticamente al crecer tu granja o de forma manual cuando los necesites."
      />
      <FeatureFlagsPanel />
    </div>
  );
}

