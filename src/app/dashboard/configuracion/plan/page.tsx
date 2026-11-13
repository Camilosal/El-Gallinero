"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, CheckCircle2, CreditCard, ShieldCheck, Smartphone } from "lucide-react";
import { HeroBanner } from "@/components/HeroBanner";
import { Badge, Button, Card } from "@/components/ui";
import SubscriptionUpgradeModal from "@/components/SubscriptionUpgradeModal";
import { apiFetch } from "@/lib/fetch";
import type { BillingPlanDefinition, FarmSubscriptionStatus } from "@/lib/subscription";

const STATUS_BADGE: Record<FarmSubscriptionStatus["status"], { label: string; color: "green" | "blue" | "yellow" | "red" }> = {
  active: { label: "Ciclo activo", color: "green" },
  trial: { label: "Prueba Semilla 30 días", color: "blue" },
  grace: { label: "Período de gracia", color: "yellow" },
  freemium: { label: "Freemium (1 lote activo)", color: "yellow" },
  expired: { label: "Ciclo vencido (solo lectura/cierre)", color: "red" },
};

export default function PlanSuscripcionPage() {
  const [subscription, setSubscription] = useState<FarmSubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<BillingPlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const refreshBilling = useCallback(async () => {
    const res = await apiFetch("/api/billing/checkout");
    if (res.ok) {
      const json = await res.json();
      setSubscription(json.subscription || null);
      setPlans(Array.isArray(json.plans) ? json.plans : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void apiFetch("/api/billing/checkout")
      .then(async (res) => {
        if (!active) return;
        if (res.ok) {
          const json = await res.json();
          if (!active) return;
          setSubscription(json.subscription || null);
          setPlans(Array.isArray(json.plans) ? json.plans : []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const badge = subscription ? STATUS_BADGE[subscription.status] : STATUS_BADGE.trial;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/dashboard/configuracion"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Volver a Configuración</span>
        </Link>
      </div>

      <HeroBanner
        theme="finanzas"
        icon={<CreditCard className="w-3.5 h-3.5 text-amber-200" aria-hidden="true" />}
        title="Plan por Ciclo Productivo y Pagos"
        description="Renueva por cosecha o semestre mediante Nequi, Daviplata o PSE. Nunca secuestramos tu histórico ni bloqueamos el cierre del lote actual."
      />

      {loading ? (
        <Card className="p-6 text-sm text-slate-500">Cargando estado de suscripción...</Card>
      ) : subscription ? (
        <>
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900">{subscription.farmName}</h2>
                  <Badge color={badge.color}>{badge.label}</Badge>
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Plan actual: <span className="font-semibold text-slate-900">{subscription.planCode}</span>
                  {subscription.daysRemaining !== null && (
                    <>
                      {" · "}
                      <span>{subscription.daysRemaining} días restantes</span>
                    </>
                  )}
                </p>
              </div>
              <Button touchSize="field" onClick={() => setModalOpen(true)}>
                Renovar / Cambiar ciclo
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Lotes activos</p>
                <p className="text-lg font-bold text-slate-900">
                  {subscription.activeBatchesCount}
                  {subscription.maxActiveBatches !== null ? ` / ${subscription.maxActiveBatches}` : " (ilimitados)"}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Lotes cosechados</p>
                <p className="text-lg font-bold text-slate-900">{subscription.closedBatchesCount}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Límite usuarios</p>
                <p className="text-lg font-bold text-slate-900">{subscription.maxUsers}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Vigencia hasta</p>
                <p className="text-sm font-bold text-slate-900 mt-1">
                  {subscription.currentPeriodEnd ? subscription.currentPeriodEnd.slice(0, 10) : "Sin vencimiento"}
                </p>
              </div>
            </div>

            {subscription.promptPostHarvestRenewal && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-950 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>
                    ¡Felicidades por completar tu cosecha! Activa un nuevo ciclo antes de ingresar tu próximo lote.
                  </span>
                </div>
                <Button touchSize="field" variant="success" onClick={() => setModalOpen(true)}>
                  Pagar ciclo ($45.000)
                </Button>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <Card key={plan.code} className="p-5 flex flex-col justify-between gap-4 border border-slate-200">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {plan.durationDays} días
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 mt-2">
                    ${plan.amountCop.toLocaleString("es-CO")}{" "}
                    <span className="text-xs font-medium text-slate-500">COP</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{plan.tagline}</p>
                  <ul className="mt-3 space-y-1 text-xs text-slate-700">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Lotes simultáneos ilimitados y {plan.maxUsers} usuarios</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Pago con Nequi, Daviplata o PSE sin tarjeta de crédito</span>
                    </li>
                  </ul>
                </div>
                <Button touchSize="field" variant="secondary" onClick={() => setModalOpen(true)}>
                  Elegir {plan.name.split(" ")[0]}
                </Button>
              </Card>
            ))}
          </div>

          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">Historial de pagos recientes</h3>
            </div>
            {subscription.recentPayments.length === 0 ? (
              <p className="text-xs text-slate-500">Aún no hay pagos registrados en esta granja.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Referencia</th>
                      <th className="py-2 pr-3">Plan</th>
                      <th className="py-2 pr-3">Método</th>
                      <th className="py-2 pr-3">Valor</th>
                      <th className="py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscription.recentPayments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-mono">{p.externalReference}</td>
                        <td className="py-2 pr-3">{p.planCode}</td>
                        <td className="py-2 pr-3 uppercase">{p.method}</td>
                        <td className="py-2 pr-3 font-semibold">${p.amountCop.toLocaleString("es-CO")}</td>
                        <td className="py-2">
                          <Badge
                            color={
                              p.status === "approved"
                                ? "green"
                                : p.status === "declined"
                                  ? "red"
                                  : "yellow"
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}

      <SubscriptionUpgradeModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          void refreshBilling();
        }}
        plans={plans}
      />
    </div>
  );
}

