"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Bird, Brain, CalendarClock, CheckCircle2, CreditCard, MapPin, ShieldCheck, Users } from "lucide-react";
import { HeroActionLink, HeroBanner } from "@/components/HeroBanner";
import { Badge, Card } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import type { FarmSubscriptionStatus } from "@/lib/subscription";

const STATUS_BADGE: Record<FarmSubscriptionStatus["status"], { label: string; color: "green" | "blue" | "yellow" | "red" }> = {
  active: { label: "Plan activo", color: "green" },
  trial: { label: "Prueba anterior", color: "blue" },
  grace: { label: "Período de gracia", color: "yellow" },
  freemium: { label: "Gratis", color: "yellow" },
  expired: { label: "Plan vencido", color: "red" },
};

const SPECIES_LABELS: Record<string, string> = {
  pollo: "Pollos",
  gallina: "Gallinas",
  pato: "Patos",
  codorniz: "Codornices",
  conejo: "Conejos",
  cuy: "Cuyes",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(value));
}

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)} COP`;
}

export default function PlanSuscripcionPage() {
  const [subscription, setSubscription] = useState<FarmSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    void apiFetch("/api/billing/checkout")
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error("No se pudo cargar el estado actual del plan.");
        const json = await res.json();
        if (active) setSubscription(json.subscription || null);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "No se pudo cargar el plan.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const badge = subscription ? STATUS_BADGE[subscription.status] : null;
  const batchLimit = subscription?.entitlements.maxActiveBatchesPerSpecies;
  const locationLimit = subscription?.entitlements.maxActiveLocations;
  const gina = subscription?.entitlements.gina;
  const activeSpecies = Object.entries(subscription?.activeBatchesBySpecies || {}).filter(([, count]) => count > 0);

  return (
    <div className="space-y-6">
      <HeroBanner
        theme="finanzas"
        icon={<CreditCard className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />}
        title="Plan y límites de uso"
        description="Consulta qué permite el plan de tu granja y calcula el costo de Productor o Agregador."
        actions={
          <HeroActionLink href="/configuracion" tone="glass">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver a Configuración</span>
          </HeroActionLink>
        }
      />

      {loading ? (
        <Card className="p-6 text-sm text-slate-500">Cargando el plan de la granja…</Card>
      ) : loadError ? (
        <div role="alert"><Card className="p-6 text-sm text-rose-700">{loadError}</Card></div>
      ) : subscription && badge ? (
        <>
          <Card className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold text-slate-900">{subscription.farmName}</h2>
                  <Badge color={badge.color}>{badge.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Plan comercial: <span className="font-semibold text-slate-900">{subscription.planName}</span>
                  {subscription.daysRemaining !== null && subscription.status !== "freemium" ? ` · ${subscription.daysRemaining} días restantes` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {subscription.currentPeriodEnd
                    ? `Vigencia hasta ${formatDate(subscription.currentPeriodEnd)}`
                    : "Sin fecha de vencimiento configurada"}
                </p>
              </div>
              <Link
                href="/planes"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                Explorar planes y calcular costo
                <span aria-hidden="true">›</span>
              </Link>
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <QuotaCard
                icon={<Users className="h-4 w-4" aria-hidden="true" />}
                label="Usuarios registrados"
                value={`${subscription.maxUsers} ${subscription.maxUsers === 1 ? "usuario" : "usuarios"}`}
                detail="El cupo del plan se aplica al agregar personas."
              />
              <QuotaCard
                icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                label="Localizaciones activas"
                value={locationLimit === null ? "Sin tope del plan" : `${subscription.activeLocationsCount} / ${locationLimit}`}
                detail={locationLimit === null ? "El plan no limita la cantidad." : "Las localizaciones inactivas no cuentan."}
              />
              <QuotaCard
                icon={<Bird className="h-4 w-4" aria-hidden="true" />}
                label="Lotes activos por especie"
                value={batchLimit === null ? "Sin tope del plan" : `Hasta ${batchLimit} por especie`}
                detail={activeSpecies.length
                  ? activeSpecies.map(([species, count]) => `${SPECIES_LABELS[species] || species}: ${count}`).join(" · ")
                  : "No hay lotes activos registrados."}
              />
              <QuotaCard
                icon={<Brain className="h-4 w-4" aria-hidden="true" />}
                label="Gina por usuario / mes"
                value={gina ? `${gina.messagesPerMonth} consultas` : "No disponible"}
                detail={gina
                  ? `${gina.audiosPerMonth} audios (máx. ${gina.maxAudioSeconds}s) · ${gina.attachmentsPerMonth} adjuntos. Audio y adjunto consumen una consulta.`
                  : "Consulta el catálogo comercial para ver los cupos."}
              />
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">Cómo se aplican los controles</h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-700">
              El <strong>rol</strong> de cada persona determina a qué módulos puede acceder. El <strong>plan comercial</strong> establece los cupos de usuarios, localizaciones, lotes activos por especie y uso mensual de Gina. Son controles separados: cambiar el plan no cambia los roles asignados.
            </p>
            {subscription.planKey === "aggregator" && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                La app aún no dispone del padrón de beneficiarios ni de la administración multipredio. El cupo de beneficiarios y Torre de Control requieren esa implementación antes de poder aplicarse.
              </p>
            )}
            <p className="text-xs text-slate-500">
              Los cupos de Gina están definidos por la oferta. Su registro de consumo depende de que se aplique la actualización de base de datos correspondiente; hasta entonces, esta pantalla muestra los límites del plan y no un contador de consumo.
            </p>
          </Card>

          {subscription.recentPayments.length > 0 && (
            <Card className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900">Historial de pagos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Referencia</th>
                      <th className="py-2 pr-3">Método</th>
                      <th className="py-2 pr-3">Valor</th>
                      <th className="py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscription.recentPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3">{formatDate(payment.createdAt)}</td>
                        <td className="py-2 pr-3 font-mono">{payment.externalReference}</td>
                        <td className="py-2 pr-3 uppercase">{payment.method}</td>
                        <td className="py-2 pr-3 font-semibold">{formatCop(payment.amountCop)}</td>
                        <td className="py-2"><Badge color={payment.status === "approved" ? "green" : payment.status === "declined" ? "red" : "yellow"}>{payment.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card className="flex flex-wrap items-center gap-3 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <p className="min-w-0 flex-1">La página de planes permite calcular, guardar y descargar el costo según las opciones elegidas. La contratación y aceptación de condiciones todavía no se hacen desde la app.</p>
            <Link href="/planes" className="font-semibold underline underline-offset-2">Abrir calculadora de planes</Link>
          </Card>
        </>
      ) : (
        <Card className="p-6 text-sm text-slate-600">No se encontró una suscripción para esta granja.</Card>
      )}
    </div>
  );
}

function QuotaCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</p>
      <p className="mt-1 text-base font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</p>
    </div>
  );
}
