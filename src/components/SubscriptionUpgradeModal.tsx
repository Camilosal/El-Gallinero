"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import type { BillingPaymentMethod, BillingPlanDefinition } from "@/lib/subscription";

const METHOD_LABELS: { id: BillingPaymentMethod; label: string; hint: string }[] = [
  { id: "nequi", label: "Nequi", hint: "Pago instantáneo desde tu app Nequi" },
  { id: "daviplata", label: "Daviplata", hint: "Débito directo sin tarjeta" },
  { id: "pse", label: "PSE Bancos", hint: "Bancolombia, Banco Agrario, Davivienda, etc." },
];

export default function SubscriptionUpgradeModal({
  open,
  onClose,
  plans,
  reason,
  onCheckoutCreated,
}: {
  open: boolean;
  onClose: () => void;
  plans: BillingPlanDefinition[];
  reason?: string;
  onCheckoutCreated?: (checkoutUrl: string) => void;
}) {
  const [selectedPlan, setSelectedPlan] = useState<string>(plans[0]?.code || "CICLO_60D");
  const [method, setMethod] = useState<BillingPaymentMethod>("nequi");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutInfo, setCheckoutInfo] = useState<{
    externalReference: string;
    checkoutUrl: string;
    amountCop: number;
    sandbox: boolean;
  } | null>(null);

  const handleCheckout = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: selectedPlan, method }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo generar el enlace de pago.");
        return;
      }
      if (json.checkout) {
        setCheckoutInfo({
          externalReference: json.checkout.externalReference,
          checkoutUrl: json.checkout.checkoutUrl,
          amountCop: json.checkout.amountCop,
          sandbox: Boolean(json.checkout.sandbox),
        });
        onCheckoutCreated?.(json.checkout.checkoutUrl);
      }
    } catch {
      setError("Error de conexión al iniciar el pago.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Renovar ciclo productivo · Iwagé Granja">
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-950">
          <div className="flex items-start gap-2.5">
            <Sparkles className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold">Tus datos y lotes actuales nunca se bloquean</p>
              <p className="text-xs text-emerald-900 mt-0.5 leading-relaxed">
                {reason ||
                  "Paga solo por el ciclo que estás produciendo. Sin tarjetas internacionales ni permanencias."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            1. Elige tu ciclo productivo
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {plans.map((p) => {
              const active = selectedPlan === p.code;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setSelectedPlan(p.code)}
                  className={`min-h-[48px] text-left rounded-xl border p-3 transition-colors ${
                    active
                      ? "border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600"
                      : "border-slate-300 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{p.name}</span>
                    {active && <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />}
                  </div>
                  <p className="text-lg font-extrabold text-emerald-800 mt-1">
                    ${p.amountCop.toLocaleString("es-CO")} COP
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{p.tagline}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            2. Método de pago colombiano (Wompi)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {METHOD_LABELS.map((m) => {
              const active = method === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`min-h-[48px] rounded-xl border px-3 py-2 text-center transition-colors ${
                    active
                      ? "border-emerald-600 bg-emerald-600 text-white font-semibold"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 text-sm">
                    {m.id === "pse" ? (
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Smartphone className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{m.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {checkoutInfo ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <span>Referencia lista: {checkoutInfo.externalReference}</span>
            </div>
            <p className="text-xs text-slate-600">
              Valor: <strong>${checkoutInfo.amountCop.toLocaleString("es-CO")} COP</strong>{" "}
              {checkoutInfo.sandbox ? "(Modo Sandbox Wompi)" : ""}
            </p>
            <a
              href={checkoutInfo.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Continuar pago en Wompi ({METHOD_LABELS.find((m) => m.id === method)?.label}) →
            </a>
          </div>
        ) : (
          <Button
            type="button"
            touchSize="field"
            onClick={() => void handleCheckout()}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Generando pago seguro..." : "Generar pago con Nequi / Daviplata / PSE"}
          </Button>
        )}
      </div>
    </Modal>
  );
}

