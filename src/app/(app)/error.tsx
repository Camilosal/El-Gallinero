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
    <div className="max-w-2xl mx-auto my-8 rounded-2xl border border-[var(--iw-semantic-status-danger)]/45 bg-[var(--iw-semantic-bg-surface)] p-6 shadow-[var(--iw-shadow-card)] space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-bg-subtle)] text-[var(--iw-semantic-status-danger)]">
          <AlertTriangle className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h1 className="font-display text-lg font-bold text-[var(--iw-semantic-text-primary)]">
            Ocurrió una falla inesperada en {origin.originModule}
          </h1>
          <p className="text-sm text-[var(--iw-semantic-text-secondary)]">
            Puedes reintentar cargar la vista o enviar este incidente automáticamente con sus etiquetas de origen.
          </p>
          <div className="flex flex-wrap gap-1 pt-1">
            {previewTags.map((t) => (
              <span
                key={t}
                className="rounded bg-[var(--iw-semantic-bg-subtle)] border border-[var(--iw-semantic-border-default)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--iw-semantic-text-secondary)]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {sentCode ? (
        <div role="status" className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-success)]/40 bg-[var(--iw-semantic-bg-feature)] p-3 text-sm text-[var(--iw-semantic-status-success)] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Falla enviada automáticamente con radicado <strong className="font-mono">{sentCode}</strong>.
          </span>
        </div>
      ) : (
        sendError && (
          <div role="alert" className="rounded-[var(--iw-radius-control)] border border-[var(--iw-semantic-status-warning)]/40 bg-[var(--iw-color-paper)] p-3 text-xs text-[var(--iw-semantic-status-warning)]">
            {sendError}
          </div>
        )
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-action-primary)] hover:bg-[var(--iw-semantic-action-primary-hover)] text-[var(--iw-semantic-action-primary-text)] px-4 py-2 text-sm font-semibold transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reintentar</span>
        </button>
        {!sentCode && (
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleQuickAutoReport()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--iw-radius-control)] bg-[var(--iw-semantic-status-danger)] hover:brightness-90 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60 transition"
          >
            <Bug className="w-4 h-4" />
            <span>{sending ? "Enviando reporte..." : "Enviar falla etiquetada"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
