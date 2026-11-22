"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { HeroActionButton, HeroActionLink, HeroBanner } from "@/components/HeroBanner";
import type { ReconciliationFinding } from "@/lib/billing-reconciliation";

interface ReconciliationReport {
  scope: "iwagranja_local";
  generatedAt: string;
  completeScan: boolean;
  sources: {
    payments: { scanned: number; total: number };
    subscriptionEvents: { scanned: number; total: number };
    comparedSystems: string[];
  };
  limitations: string[];
  summary: Record<string, number>;
  findings: ReconciliationFinding[];
}

const FINDING_LABELS: Record<ReconciliationFinding["code"], string> = {
  payment_requires_review: "Pago pendiente de revisión",
  approved_without_transaction_id: "Pago aprobado sin ID de transacción",
  duplicate_wompi_transaction_id: "ID de transacción repetido",
  approved_without_lifecycle_event: "Pago aprobado sin activación registrada",
  duplicate_lifecycle_events: "Más de una activación para el pago",
  lifecycle_event_without_payment: "Activación sin pago asociado",
  lifecycle_event_payment_not_approved: "Activación vinculada a pago no aprobado",
  lifecycle_event_farm_mismatch: "El pago y el evento pertenecen a granjas distintas",
  lifecycle_event_reference_mismatch: "La referencia no coincide",
};

function formatCop(amountCop: number | null): string {
  if (amountCop === null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amountCop);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export default function BillingReconciliationPage() {
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
      const response = await fetch("/api/superadmin/billing/reconciliation", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        const requestError = new Error(
          response.status === 401 || response.status === 403
            ? "Esta consulta está disponible únicamente para Super-Administración."
            : payload.error || "No se pudo cargar el reporte de pagos.",
        ) as Error & { status?: number };
        requestError.status = response.status;
        throw requestError;
      }
      return payload as ReconciliationReport;
  }, []);

  const loadReport = useCallback(async (refresh = false) => {
    setError(null);
    setLoading(!refresh);
    setRefreshing(refresh);
    try {
      setReport(await fetchReport());
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "No se pudo conectar para cargar el reporte. Intenta de nuevo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchReport]);

  useEffect(() => {
    let active = true;
    void fetchReport()
      .then((nextReport) => {
        if (active) setReport(nextReport);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error
            ? caught.message
            : "No se pudo conectar para cargar el reporte. Intenta de nuevo.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchReport]);

  const summaryEntries = Object.entries(report?.summary ?? {});

  return (
    <div className="space-y-6">
      <HeroBanner
        theme="guia"
        icon={<ShieldCheck className="h-4 w-4 text-amber-200" aria-hidden="true" />}
        title="Revisión de pagos"
        description="Identifica pagos y activaciones que necesitan verificación antes de cerrar la conciliación."
        actions={
          <>
            <HeroActionLink href="/configuracion/granjas" tone="glass">
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a granjas</span>
            </HeroActionLink>
            <HeroActionButton tone="glass" onClick={() => void loadReport(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </HeroActionButton>
          </>
        }
      />

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" aria-label="Alcance del reporte">
        <p className="font-semibold">Alcance de esta revisión</p>
        <p className="mt-1">
          Compara los pagos registrados en IwaGranja con su bitácora de suscripción. Aún no consulta
          Reservas ni Wompi; esta vista no reemplaza la conciliación entre esos sistemas.
        </p>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-slate-600">Cargando revisión de pagos…</p>}

      {report && (
        <>
          <section className="grid gap-3 sm:grid-cols-2" aria-label="Registros revisados">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pagos Wompi revisados</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {report.sources.payments.scanned.toLocaleString("es-CO")}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  de {report.sources.payments.total.toLocaleString("es-CO")}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos revisados</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {report.sources.subscriptionEvents.scanned.toLocaleString("es-CO")}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  de {report.sources.subscriptionEvents.total.toLocaleString("es-CO")}
                </span>
              </p>
            </div>
          </section>

          {!report.completeScan && (
            <div role="status" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
              Se alcanzó el límite de lectura. Los hallazgos de enlaces entre pagos y eventos no se concluyen sobre el conjunto incompleto.
            </div>
          )}

          <section className="space-y-3" aria-labelledby="findings-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="findings-title" className="text-lg font-bold text-slate-900">Casos por revisar</h2>
              <span className="text-xs text-slate-600">Actualizado {formatDate(report.generatedAt)}</span>
            </div>

            {report.findings.length === 0 && report.completeScan ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p>No se detectaron inconsistencias locales en los registros revisados.</p>
              </div>
            ) : report.findings.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                No hay hallazgos concluyentes en el fragmento leído. El escaneo fue parcial.
              </div>
            ) : (
              <div className="space-y-3">
                {report.findings.map((finding, index) => (
                  <article key={`${finding.code}-${finding.paymentId ?? finding.eventId}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                        <div>
                          <h3 className="font-semibold text-slate-900">{FINDING_LABELS[finding.code]}</h3>
                          <p className="mt-1 text-sm text-slate-700">{finding.summary}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${finding.severity === "review" ? "bg-orange-100 text-orange-900" : "bg-amber-100 text-amber-900"}`}>
                        {finding.severity === "review" ? "Revisión manual" : "Verificar"}
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-xs text-slate-500">Granja</dt><dd className="font-medium text-slate-800">{finding.farmName}</dd></div>
                      <div><dt className="text-xs text-slate-500">FarmID</dt><dd className="break-all font-mono text-xs text-slate-700">{finding.farmId}</dd></div>
                      <div><dt className="text-xs text-slate-500">Referencia</dt><dd className="break-all font-mono text-xs text-slate-700">{finding.externalReference || "Sin referencia"}</dd></div>
                      <div><dt className="text-xs text-slate-500">ID Wompi</dt><dd className="break-all font-mono text-xs text-slate-700">{finding.providerTxId || "Sin ID"}</dd></div>
                      <div><dt className="text-xs text-slate-500">Plan / importe</dt><dd className="font-medium text-slate-800">{finding.planCode || "—"} · {formatCop(finding.amountCop)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Estado de pago</dt><dd className="font-medium text-slate-800">{finding.paymentStatus || "Sin pago asociado"}</dd></div>
                      <div><dt className="text-xs text-slate-500">Registro</dt><dd className="break-all font-mono text-xs text-slate-700">{finding.paymentId || finding.eventId || "Sin identificador"}</dd></div>
                      <div><dt className="text-xs text-slate-500">Fecha del caso</dt><dd className="font-medium text-slate-800">{formatDate(finding.observedAt)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Evento</dt><dd className="font-medium text-slate-800">{finding.eventType || "—"}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>
          {summaryEntries.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Resumen por tipo">
              <h2 className="font-semibold text-slate-900">Resumen</h2>
              <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {summaryEntries.map(([code, count]) => (
                  <li key={code} className="flex justify-between gap-3 text-slate-700">
                    <span>{FINDING_LABELS[code as ReconciliationFinding["code"]] ?? code}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <span>Los casos se muestran para revisión. Esta pantalla no modifica pagos ni suscripciones.</span>
            <Link href="/configuracion/granjas" className="font-semibold text-emerald-800 underline">Administrar granjas</Link>
          </div>
        </>
      )}
    </div>
  );
}
