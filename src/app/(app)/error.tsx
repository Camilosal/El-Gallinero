"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Bug, CheckCircle2, RefreshCw } from "lucide-react";
import { buildBugTags, detectBugEnvironment, resolveBugOriginInfo } from "@/lib/bug-report";
import { apiFetch } from "@/lib/fetch";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() || "/inicio";
  const [sending, setSending] = useState(false);
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const origin = resolveBugOriginInfo(pathname, "", "error_boundary");
  const env = detectBugEnvironment();
  const previewTags = buildBugTags({
    originPath: origin.originPath,
    originModule: origin.originModule,
    originGroup: origin.originGroup,
    triggerSource: "error_boundary",
    category: "ui",
    severity: "critica",
    online: env.online,
    deviceType: env.deviceType,
  });

  const handleQuickAutoReport = async () => {
    setSending(true);
    setSendError(null);
    try {
      const res = await apiFetch("/api/soporte/fallas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Error de pantalla en ${origin.originModule}`,
          description: `Falla automática capturada en ${origin.originFullUrl}: ${error.message || "Error inesperado"}${error.digest ? ` (digest: ${error.digest})` : ""}`,
          category: "ui",
          severity: "critica",
          originPath: origin.originPath,
          originQuery: origin.originQuery,
          triggerSource: "error_boundary",
          environment: env,
          capturedErrors: [
            {
              kind: "runtime",
              message: error.message || "Error inesperado en vista del panel",
              source: error.digest ? `digest:${error.digest}` : origin.originPath,
              occurredAt: new Date().toISOString(),
            },
          ],
        }),
      });
      const json = (await res.json()) as { error?: string; report?: { reportCode?: string } };
      if (!res.ok) throw new Error(json.error || "No se pudo enviar");
      setSentCode(json.report?.reportCode || "ENVIADO");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "No se pudo enviar en este momento");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-8 rounded-2xl border border-rose-300 bg-white p-6 shadow-md space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-800">
          <AlertTriangle className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h1 className="text-lg font-bold text-slate-900">
            Ocurrió una falla inesperada en {origin.originModule}
          </h1>
          <p className="text-sm text-slate-600">
            Puedes reintentar cargar la vista o enviar este incidente automáticamente con sus etiquetas de origen.
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            {previewTags.map((t) => (
              <span
                key={t}
                className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {sentCode ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            Falla enviada automáticamente con radicado <strong className="font-mono">{sentCode}</strong>.
          </span>
        </div>
      ) : (
        sendError && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
            {sendError}
          </div>
        )
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reintentar</span>
        </button>
        {!sentCode && (
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleQuickAutoReport()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <Bug className="w-4 h-4" />
            <span>{sending ? "Enviando reporte..." : "Enviar falla etiquetada"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
