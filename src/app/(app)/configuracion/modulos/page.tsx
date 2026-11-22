"use client";

import { ArrowLeft } from "lucide-react";
import { HeroActionLink, PageHeader } from "@/components/ui";
import FeatureFlagsPanel from "@/components/FeatureFlagsPanel";
import DelegationPolicyPanel from "@/components/DelegationPolicyPanel";
import PushNotificationsPanel from "@/components/PushNotificationsPanel";
import TelegramChannelPanel from "@/components/TelegramChannelPanel";

export default function ConfiguracionModulosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        theme="analisis"
        icon="sparkles"
        title="Onboarding Progresivo, Escala y Módulos"
        description="Adapta la app entre Pequeño Productor y Mediano Tecnificado sobre la misma base de código, sin migraciones ni pérdida de historial."
        help="Los 4 módulos esenciales están siempre activos. Los 5 módulos avanzados se desbloquean automáticamente al crecer tu granja o de forma manual cuando los necesites."
        actions={
          <HeroActionLink href="/configuracion" tone="glass">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Configuración</span>
          </HeroActionLink>
        }
      />
      <FeatureFlagsPanel />
      <DelegationPolicyPanel />
      <PushNotificationsPanel />
      <TelegramChannelPanel />
    </div>
  );
}

