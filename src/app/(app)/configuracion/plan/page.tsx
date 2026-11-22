"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Bird, Brain, CalendarClock, CheckCircle2, CreditCard, MapPin, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { HeroActionLink, HeroBanner } from "@/components/HeroBanner";
import { Badge, Card } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import type { FarmSubscriptionStatus } from "@/lib/subscription";

interface GinaQuotaSnapshot {
  cycleStart: string;
  cycleResetsAt: string;
  limits: { messages: number; audios: number; attachments: number; maxAudioSeconds: number };
  used: { messages: number; audios: number; attachments: number };
  pending: { messages: number; audios: number; attachments: number };
  remaining: { messages: number; audios: number; attachments: number };
}

interface PaymentResultSnapshot {
  externalReference: string;
  status: string;
  amountCop: number;
  paidAt: string | null;
  createdAt: string;
}

interface BillingPaymentRow extends PaymentResultSnapshot {
  id: string;
  method: string;
  planCode: string;
}

interface BillingPaymentCursor {
  beforeAt: string;
  beforeId: string;
}

interface SubscriptionEventSnapshot {
  planCode?: string;
  status?: string;
  maxUsers?: number;
  maxActiveBatches?: number | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}

interface SubscriptionEventRow {
  id: string;
  eventType: string;
  reason: string | null;
  beforeSnapshot: SubscriptionEventSnapshot | null;
  afterSnapshot: SubscriptionEventSnapshot;
  policyVersion: string | null;
  termsVersion: string | null;
  externalReference: string | null;
  occurredAt: string;
}

interface SubscriptionEventCursor {
  beforeAt: string;
  beforeId: string;
}

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

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  declined: "No aprobado",
  error: "Error",
  voided: "Anulado",
  review: "En verificación",
};

const PLAN_LABEL: Record<string, string> = {
  FREEMIUM_SEMILLA: "Gratis",
  PRODUCTOR: "Productor",
  AGGREGATOR: "Organización",
  CICLO_60D: "Productor",
  SEMESTRAL_PONEDORA: "Productor",
  ANUAL_20: "Productor",
  MEDIANO_MENSUAL: "Productor",
};

const SUBSCRIPTION_EVENT_LABEL: Record<string, string> = {
  subscription_activated: "Suscripción activada",
  subscription_renewed: "Suscripción renovada",
  subscription_reactivated: "Suscripción reactivada",
  subscription_changed: "Suscripción actualizada",
  subscription_expired: "Suscripción vencida",
  subscription_cancelled: "Suscripción cancelada",
  payment_review_required: "Pago en revisión",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(value));
}

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)} COP`;
}

function formatPlanLabel(value: string | undefined, fallback: string): string {
  return value ? PLAN_LABEL[value] || "Plan anterior" : fallback;
}

function formatQuotaDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(year, month - 1, day, 12));
}

export default function PlanSuscripcionPage() {
  const [subscription, setSubscription] = useState<FarmSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [ginaQuota, setGinaQuota] = useState<GinaQuotaSnapshot | null>(null);
  const [ginaQuotaLoading, setGinaQuotaLoading] = useState(true);
  const [ginaQuotaError, setGinaQuotaError] = useState("");
  const [paymentResult, setPaymentResult] = useState<{
    reference: string;
    payment: PaymentResultSnapshot | null;
    loading: boolean;
    error: string;
  } | null>(null);
  const [paymentRefresh, setPaymentRefresh] = useState(0);
  const [olderPayments, setOlderPayments] = useState<BillingPaymentRow[]>([]);
  const [paymentCursor, setPaymentCursor] = useState<BillingPaymentCursor | null>(null);
  const [paymentsHasMore, setPaymentsHasMore] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [subscriptionEvents, setSubscriptionEvents] = useState<SubscriptionEventRow[]>([]);
  const [subscriptionEventCursor, setSubscriptionEventCursor] = useState<SubscriptionEventCursor | null>(null);
  const [subscriptionEventsHasMore, setSubscriptionEventsHasMore] = useState(false);
  const [subscriptionEventsLoading, setSubscriptionEventsLoading] = useState(true);
  const [subscriptionEventsError, setSubscriptionEventsError] = useState("");
  const quotaRequestRef = useRef(0);

  const loadSubscriptionEvents = useCallback(async (cursor?: SubscriptionEventCursor | null, append = false) => {
    setSubscriptionEventsLoading(true);
    setSubscriptionEventsError("");
    try {
      const params = new URLSearchParams();
      if (cursor) {
        params.set("beforeAt", cursor.beforeAt);
        params.set("beforeId", cursor.beforeId);
      }
      const query = params.size ? `?${params.toString()}` : "";
      const response = await apiFetch(`/api/billing/history${query}`);
      if (!response.ok) throw new Error("No se pudo cargar el historial del plan.");
      const data = await response.json() as {
        events?: SubscriptionEventRow[];
        hasMore?: boolean;
        nextCursor?: SubscriptionEventCursor | null;
      };
      const nextEvents = Array.isArray(data.events) ? data.events : [];
      setSubscriptionEvents((previous) => append ? [...previous, ...nextEvents] : nextEvents);
      setSubscriptionEventsHasMore(data.hasMore === true);
      setSubscriptionEventCursor(data.nextCursor || null);
    } catch (error) {
      setSubscriptionEventsError(error instanceof Error ? error.message : "No se pudo cargar el historial del plan.");
    } finally {
      setSubscriptionEventsLoading(false);
    }
  }, []);

  const loadOlderSubscriptionEvents = useCallback(() => {
    if (!subscriptionEventCursor || subscriptionEventsLoading) return;
    void loadSubscriptionEvents(subscriptionEventCursor, true);
  }, [loadSubscriptionEvents, subscriptionEventCursor, subscriptionEventsLoading]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSubscriptionEvents(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSubscriptionEvents]);

  const loadGinaQuota = useCallback(async () => {
    const requestId = ++quotaRequestRef.current;
    setGinaQuotaLoading(true);
    setGinaQuotaError("");
    try {
      const res = await apiFetch("/api/asistente/cuota");
      if (!res.ok) throw new Error("No se pudo actualizar el consumo de Gina.");
      const json = await res.json();
      if (!json.quota) throw new Error("No recibimos el consumo actual de Gina.");
      if (requestId === quotaRequestRef.current) setGinaQuota(json.quota as GinaQuotaSnapshot);
    } catch (error) {
      if (requestId === quotaRequestRef.current) {
        setGinaQuotaError(error instanceof Error ? error.message : "No se pudo actualizar el consumo de Gina.");
      }
    } finally {
      if (requestId === quotaRequestRef.current) setGinaQuotaLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const quotaTimer = window.setTimeout(() => {
      if (active) void loadGinaQuota();
    }, 0);
    void apiFetch("/api/billing/checkout")
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error("No se pudo cargar el estado actual del plan.");
        const json = await res.json();
        if (active) {
          const nextSubscription = json.subscription || null;
          setSubscription(nextSubscription);
          const initialPayments = nextSubscription?.recentPayments || [];
          const lastPayment = initialPayments.at(-1);
          setPaymentCursor(lastPayment ? { beforeAt: lastPayment.createdAtCursor, beforeId: lastPayment.id } : null);
          setPaymentsHasMore(initialPayments.length === 10);
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "No se pudo cargar el plan.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(quotaTimer);
      quotaRequestRef.current += 1;
    };
  }, [loadGinaQuota]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference")?.trim() || "";
    if (params.get("payment") !== "return" || !reference) return;

    const controller = new AbortController();
    let active = true;
    let timer: number | null = null;

    const refreshPayment = async (attempt: number) => {
      try {
        const response = await fetch("/api/billing/checkout?reference=" + encodeURIComponent(reference), {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!active) return;
        if (response.status === 401) {
          setPaymentResult({ reference, payment: null, loading: false, error: "Inicia sesión para consultar el estado de este pago." });
          return;
        }
        if (!response.ok) {
          const message = response.status === 404
            ? "No encontramos este pago en la granja actual. Verifica que ingresaste con la cuenta correcta."
            : "No pudimos consultar el estado del pago ahora.";
          setPaymentResult({ reference, payment: null, loading: false, error: message });
          return;
        }
        const data = await response.json() as { payment?: PaymentResultSnapshot };
        const payment = data.payment;
        if (!payment) {
          setPaymentResult({ reference, payment: null, loading: false, error: "No recibimos el estado del pago." });
          return;
        }
        setPaymentResult({ reference, payment, loading: payment.status === "pending" && attempt < 8, error: "" });
        if (payment.status === "approved") {
          const subscriptionResponse = await fetch("/api/billing/checkout", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
          if (subscriptionResponse.ok && active) {
            const subscriptionData = await subscriptionResponse.json() as { subscription?: FarmSubscriptionStatus };
            if (subscriptionData.subscription) setSubscription(subscriptionData.subscription);
          }
          if (active) void loadSubscriptionEvents();
          return;
        }
        if (payment.status === "pending" && attempt < 8) {
          timer = window.setTimeout(() => void refreshPayment(attempt + 1), 2500);
        }
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setPaymentResult({ reference, payment: null, loading: false, error: "No se pudo consultar el pago. Puedes intentarlo de nuevo." });
      }
    };

    void refreshPayment(0);
    return () => {
      active = false;
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [loadSubscriptionEvents, paymentRefresh]);

  const loadOlderPayments = useCallback(async () => {
    if (!paymentCursor || paymentsLoading) return;
    setPaymentsLoading(true);
    setPaymentsError("");
    try {
      const params = new URLSearchParams({ beforeAt: paymentCursor.beforeAt, beforeId: paymentCursor.beforeId });
      const response = await apiFetch(`/api/billing/payments?${params.toString()}`);
      if (!response.ok) throw new Error("No se pudo cargar el historial de pagos.");
      const data = await response.json() as {
        payments?: BillingPaymentRow[];
        hasMore?: boolean;
        nextCursor?: BillingPaymentCursor | null;
      };
      const nextPayments = Array.isArray(data.payments) ? data.payments : [];
      setOlderPayments((previous) => [...previous, ...nextPayments]);
      setPaymentsHasMore(data.hasMore === true);
      setPaymentCursor(data.nextCursor || null);
    } catch (error) {
      setPaymentsError(error instanceof Error ? error.message : "No se pudo cargar el historial de pagos.");
    } finally {
      setPaymentsLoading(false);
    }
  }, [paymentCursor, paymentsLoading]);

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
        description="Consulta los límites y pagos de tu granja. Para iniciar o renovar Productor, continúa desde Planes."
        actions={
          <HeroActionLink href="/configuracion" tone="glass">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver a Configuración</span>
          </HeroActionLink>
        }
      />

      {paymentResult && (
        <Card className="border-emerald-200 bg-emerald-50/60 p-5 sm:p-6" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-lg bg-white p-2 text-emerald-700">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold text-slate-900">
                  {paymentResult.loading
                    ? "Estamos confirmando tu pago"
                    : paymentResult.payment?.status === "approved"
                      ? "Pago confirmado"
                      : paymentResult.payment?.status === "declined"
                        ? "El pago no fue aprobado"
                        : paymentResult.payment?.status === "review"
                          ? "Estamos verificando el resultado"
                        : paymentResult.payment?.status === "error" || paymentResult.payment?.status === "voided"
                          ? "El intento de pago terminó"
                          : paymentResult.error
                            ? "No pudimos confirmar el pago todavía"
                            : "Pago pendiente de confirmación"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {paymentResult.error || (paymentResult.payment
                    ? paymentResult.payment.status === "review"
                      ? `Referencia ${paymentResult.reference} · El resultado requiere una verificación adicional. Tu plan no cambiará hasta confirmar el pago.`
                      : `Referencia ${paymentResult.reference} · ${formatCop(paymentResult.payment.amountCop)}`
                    : "Wompi está procesando la respuesta. La activación se confirma cuando recibimos y verificamos el resultado." )}
                </p>
                {paymentResult.payment?.paidAt && (
                  <p className="mt-1 text-xs text-slate-600">Confirmado el {formatDate(paymentResult.payment.paidAt)}.</p>
                )}
              </div>
            </div>
            {paymentResult.payment?.status === "pending" && !paymentResult.loading && (
              <button
                type="button"
                onClick={() => setPaymentRefresh((value) => value + 1)}
                className="min-h-10 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                Consultar de nuevo
              </button>
            )}
          </div>
        </Card>
      )}

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
                  {subscription.farmCode && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-emerald-900">
                      Código: {subscription.farmCode}
                    </span>
                  )}
                  <Badge color={badge.color}>{badge.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {subscription.status === "expired" ? (
                    <>Venció tu plan <span className="font-semibold text-slate-900">{formatPlanLabel(subscription.planCode, subscription.planName)}</span>; ahora tienes acceso al plan Gratis.</>
                  ) : (
                    <>Plan comercial: <span className="font-semibold text-slate-900">{subscription.planName}</span></>
                  )}
                  {subscription.daysRemaining !== null && subscription.status !== "freemium" && subscription.status !== "expired" ? ` · ${subscription.daysRemaining} días restantes` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {subscription.currentPeriodEnd
                    ? `${subscription.status === "expired" ? "Venció el" : "Vigencia hasta"} ${formatDate(subscription.currentPeriodEnd)}`
                    : "Sin fecha de vencimiento configurada"}
                </p>
              </div>
              <Link
                href="/planes"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                Ver planes y continuar
                <span aria-hidden="true">›</span>
              </Link>
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              <QuotaCard
                icon={<Users className="h-4 w-4" aria-hidden="true" />}
                label="Cupo de usuarios"
                value={`Hasta ${subscription.maxUsers} ${subscription.maxUsers === 1 ? "persona" : "personas"}`}
                detail="La app valida este límite cuando agregas a alguien al equipo."
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
            </div>
          </Card>

          <Card className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-lg bg-violet-50 p-2 text-violet-700">
                  <Brain className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tu consumo de Gina este mes</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Cupo individual de tu usuario. El mes se cuenta en hora de Colombia
                    {ginaQuota ? ` y se renueva el ${formatQuotaDate(ginaQuota.cycleResetsAt)}.` : "."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadGinaQuota()}
                disabled={ginaQuotaLoading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                aria-label="Actualizar el consumo de Gina"
              >
                <RefreshCw className={`h-4 w-4 ${ginaQuotaLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                Actualizar
              </button>
            </div>

            {ginaQuotaError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900" role="status">
                {ginaQuotaError}{ginaQuota ? " Mostramos el último dato disponible." : ""}
              </div>
            )}

            {ginaQuota ? (
              <div className="grid gap-3 md:grid-cols-3" aria-live="polite">
                <GinaUsageMetric
                  label="Consultas"
                  used={ginaQuota.used.messages}
                  pending={ginaQuota.pending.messages}
                  remaining={ginaQuota.remaining.messages}
                  limit={ginaQuota.limits.messages}
                />
                <GinaUsageMetric
                  label="Audios"
                  used={ginaQuota.used.audios}
                  pending={ginaQuota.pending.audios}
                  remaining={ginaQuota.remaining.audios}
                  limit={ginaQuota.limits.audios}
                />
                <GinaUsageMetric
                  label="Adjuntos"
                  used={ginaQuota.used.attachments}
                  pending={ginaQuota.pending.attachments}
                  remaining={ginaQuota.remaining.attachments}
                  limit={ginaQuota.limits.attachments}
                />
              </div>
            ) : ginaQuotaLoading ? (
              <div className="grid gap-3 md:grid-cols-3" aria-label="Cargando consumo de Gina">
                {[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-600" role="status">
                No pudimos cargar tu consumo ahora. Puedes volver a intentarlo con el botón Actualizar.
              </div>
            )}

            <p className="text-xs leading-relaxed text-slate-500">
              Tus consultas de texto y notas de voz en la app y Telegram se cuentan aquí. Cada audio o imagen procesada también ocupa una consulta; las notas de voz pueden durar hasta {ginaQuota?.limits.maxAudioSeconds ?? gina?.maxAudioSeconds ?? 90} segundos. Los cupos no se comparten con otras personas.
            </p>
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
          </Card>

          <>
            <Card className="space-y-4 p-5">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900">Historial de tu suscripción</h3>
              </div>
              {subscriptionEventsError && (
                <p role="alert" className="text-sm text-rose-700">{subscriptionEventsError}</p>
              )}
              {subscriptionEventsLoading && subscriptionEvents.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-600" role="status">Cargando los cambios del plan…</p>
              ) : subscriptionEvents.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  Aún no hay cambios de plan registrados para esta granja.
                </p>
              ) : (
                <ol className="space-y-3">
                  {subscriptionEvents.map((event) => {
                    const before = event.beforeSnapshot;
                    const after = event.afterSnapshot;
                    const paymentNeedsReview = event.eventType === "payment_review_required";
                    const previousPlan = before?.planCode ? formatPlanLabel(before.planCode, subscription.planName) : null;
                    const nextPlan = formatPlanLabel(after.planCode, subscription.planName);
                    const previousUsers = typeof before?.maxUsers === "number" ? before.maxUsers : null;
                    const nextUsers = typeof after.maxUsers === "number" ? after.maxUsers : null;
                    const periodEnd = after.currentPeriodEnd ? formatDate(after.currentPeriodEnd) : null;
                    return (
                      <li key={event.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {SUBSCRIPTION_EVENT_LABEL[event.eventType] || "Movimiento de suscripción"}
                          </p>
                          <time className="text-xs text-slate-500" dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">
                          {paymentNeedsReview
                            ? "El plan actual se mantiene hasta confirmar el resultado de este pago."
                            : <>
                                {previousPlan ? `${previousPlan} → ` : ""}{nextPlan}
                                {previousUsers !== null && nextUsers !== null && previousUsers !== nextUsers
                                  ? ` · ${previousUsers} → ${nextUsers} usuarios`
                                  : nextUsers !== null ? ` · ${nextUsers} ${nextUsers === 1 ? "usuario" : "usuarios"}` : ""}
                                {periodEnd ? ` · Vigente hasta ${periodEnd}` : ""}
                              </>}
                        </p>
                        {event.reason && <p className="mt-1 text-xs leading-relaxed text-slate-500">{event.reason}</p>}
                        {event.externalReference && (
                          <p className="mt-2 text-xs text-slate-500">Referencia de pago: <span className="font-mono">{event.externalReference}</span></p>
                        )}
                        {(event.policyVersion || event.termsVersion) && (
                          <p className="mt-2 text-xs text-slate-500">
                            Condiciones aceptadas: {[event.policyVersion, event.termsVersion].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {subscriptionEventsHasMore && (
                <button
                  type="button"
                  onClick={loadOlderSubscriptionEvents}
                  disabled={subscriptionEventsLoading}
                  className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  {subscriptionEventsLoading ? "Cargando cambios…" : "Ver cambios anteriores"}
                </button>
              )}
            </Card>

            <Card className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <h3 className="text-sm font-bold text-slate-900">Historial de pagos</h3>
              </div>
              {subscription.recentPayments.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  Aún no hay pagos registrados para esta granja.
                </p>
              ) : <div className="overflow-x-auto">
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
                    {[...subscription.recentPayments, ...olderPayments].map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3">{formatDate(payment.createdAt)}</td>
                        <td className="py-2 pr-3 font-mono">{payment.externalReference}</td>
                        <td className="py-2 pr-3 uppercase">{payment.method}</td>
                        <td className="py-2 pr-3 font-semibold">{formatCop(payment.amountCop)}</td>
                          <td className="py-2"><Badge color={payment.status === "approved" ? "green" : payment.status === "declined" || payment.status === "error" ? "red" : "yellow"}>{PAYMENT_STATUS_LABEL[payment.status] || "En revisión"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
              {paymentsError && <p role="alert" className="text-sm text-rose-700">{paymentsError}</p>}
              {paymentsHasMore && (
                <button
                  type="button"
                  onClick={() => void loadOlderPayments()}
                  disabled={paymentsLoading}
                  className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  {paymentsLoading ? "Cargando pagos…" : "Cargar pagos anteriores"}
                </button>
              )}
            </Card>
          </>

          <Card className="flex flex-wrap items-center gap-3 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <p className="min-w-0 flex-1">Puedes revisar los beneficios y condiciones en Planes. La contratación o renovación de Productor se inicia desde allí; si el checkout está habilitado, Wompi confirma el pago antes de activar el plan. No hay renovación automática.</p>
            <Link href="/planes" className="font-semibold underline underline-offset-2">Ver planes y suscripción</Link>
          </Card>
        </>
      ) : (
        <Card className="p-6 text-sm text-slate-600">No se encontró una suscripción para esta granja.</Card>
      )}
    </div>
  );
}

function GinaUsageMetric({
  label,
  used,
  pending,
  remaining,
  limit,
}: {
  label: string;
  used: number;
  pending: number;
  remaining: number;
  limit: number;
}) {
  const total = Math.max(0, used + pending);
  const safeLimit = Math.max(0, limit);
  const progressMax = Math.max(1, safeLimit);
  const progressValue = Math.min(total, safeLimit);
  const percentage = safeLimit > 0 ? Math.min(100, Math.round((progressValue / safeLimit) * 100)) : 0;
  const unit = label === "Consultas" ? "consultas" : label.toLowerCase();

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label={`${label}: ${used} usadas de ${safeLimit}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800">{label}</h4>
        <p className="text-sm font-bold tabular-nums text-slate-900">{used} / {safeLimit}</p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={`${label} usadas`}
        aria-valuemin={0}
        aria-valuemax={progressMax}
        aria-valuenow={progressValue}
        aria-valuetext={`${used} usadas de ${safeLimit}${pending ? `, ${pending} en proceso` : ""}`}
      >
        <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-slate-600">
        <span>{remaining} disponibles</span>
        {pending > 0 && <span>{pending} en proceso</span>}
      </div>
      <p className="sr-only">Límite mensual: {safeLimit} {unit}.</p>
    </section>
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
