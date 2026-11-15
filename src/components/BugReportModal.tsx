"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bug,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Eye,
  History,
  MapPin,
  RefreshCw,
  Send,
  Tag,
  WifiOff,
  X,
} from "lucide-react";
import {
  BUG_CATEGORY_LABELS,
  BUG_REPORT_UPDATED_EVENT,
  BUG_SEVERITY_LABELS,
  BUG_STATUS_LABELS,
  OPEN_BUG_REPORT_EVENT,
  buildBugTags,
  detectBugEnvironment,
  enqueueOfflineBugReport,
  formatBugReportPreviewText,
  getOfflineBugReports,
  getRecentCapturedErrors,
  installClientErrorCapture,
  removeOfflineBugReport,
  resolveBugOriginInfo,
  type BugCapturedError,
  type BugReportCategory,
  type BugReportRecord,
  type BugReportSeverity,
  type BugTriggerSource,
  type OpenBugReportDetail,
  type QueuedOfflineBugReport,
} from "@/lib/bug-report";
import { apiFetch } from "@/lib/fetch";
import type { BugTriageGuidance } from "@/lib/agent/jev-capabilities";
import { Badge, Button, Input, Select, Textarea } from "@/components/ui";

interface UserContextLite {
  name?: string;
  username?: string;
  role?: string;
}

const SEVERITY_BADGE_COLOR: Record<BugReportSeverity, string> = {
  baja: "gray",
  media: "yellow",
  alta: "orange",
  critica: "red",
};

const STATUS_BADGE_COLOR: Record<string, string> = {
  abierto: "red",
  en_revision: "yellow",
  resuelto: "green",
  descartado: "gray",
};

export default function BugReportModal() {
  const pathname = usePathname() || "/dashboard";
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"crear" | "historial">("crear");
  const [triggerSource, setTriggerSource] = useState<BugTriggerSource>("topbar");
  const [category, setCategory] = useState<BugReportCategory>("ui");
  const [severity, setSeverity] = useState<BugReportSeverity>("media");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [extraTagsText, setExtraTagsText] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [capturedErrors, setCapturedErrors] = useState<BugCapturedError[]>([]);
  const [userInfo, setUserInfo] = useState<UserContextLite | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{
    mode: "sent" | "queued";
    reportCode?: string;
    tags: string[];
    originModule: string;
    guidance?: BugTriageGuidance | null;
  } | null>(null);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReports, setHistoryReports] = useState<BugReportRecord[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<QueuedOfflineBugReport[]>([]);

  const loadHistory = useCallback(async () => {
    setOfflineQueue(getOfflineBugReports());
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setHistoryLoading(true);
    try {
      const res = await apiFetch("/api/soporte/fallas");
      if (res.ok) {
        const json = (await res.json()) as { reports?: BugReportRecord[] };
        setHistoryReports(Array.isArray(json.reports) ? json.reports : []);
      }
    } catch {
      // Ignore offline/network error when loading history
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const flushQueue = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const queued = getOfflineBugReports();
    if (queued.length === 0) return;

    let sentAny = false;
    for (const item of queued) {
      try {
        const res = await apiFetch("/api/soporte/fallas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          removeOfflineBugReport(item.localId);
          sentAny = true;
        }
      } catch {
        break;
      }
    }
    setOfflineQueue(getOfflineBugReports());
    if (sentAny) {
      window.dispatchEvent(new CustomEvent(BUG_REPORT_UPDATED_EVENT));
      void loadHistory();
    }
  }, [loadHistory]);

  useEffect(() => {
    const cleanupErrors = installClientErrorCapture();
    void Promise.resolve().then(() => {
      setOfflineQueue(getOfflineBugReports());
      void flushQueue();
    });

    const onOnline = () => {
      void flushQueue();
    };
    const onOpen = (evt: Event) => {
      const detail = (evt as CustomEvent<OpenBugReportDetail>).detail || {};
      setTriggerSource(detail.triggerSource || "topbar");
      setCategory(detail.initialCategory || "ui");
      setSeverity(detail.initialSeverity || "media");
      setTitle(detail.initialTitle || "");
      setDescription(detail.initialDescription || "");
      setStepsToReproduce("");
      setExpectedBehavior("");
      setExtraTagsText("");
      setIncludeDiagnostics(true);
      setShowPreview(false);
      setErrorMsg(null);
      setSubmittedResult(null);
      setActiveTab("crear");

      const recent = getRecentCapturedErrors();
      const merged = detail.capturedError ? [...recent, detail.capturedError] : recent;
      setCapturedErrors(merged);
      setOfflineQueue(getOfflineBugReports());
      setOpen(true);

      void apiFetch("/api/auth/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((u) => {
          if (u && typeof u === "object") {
            setUserInfo(u as UserContextLite);
          }
        })
        .catch(() => undefined);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener(OPEN_BUG_REPORT_EVENT, onOpen);
    return () => {
      cleanupErrors();
      window.removeEventListener("online", onOnline);
      window.removeEventListener(OPEN_BUG_REPORT_EVENT, onOpen);
    };
  }, [flushQueue]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const environment = useMemo(
    () => (open ? detectBugEnvironment() : { online: true, deviceType: "escritorio" as const }),
    [open],
  );

  const origin = useMemo(
    () => resolveBugOriginInfo(pathname, queryString, triggerSource),
    [pathname, queryString, triggerSource],
  );

  const customTags = useMemo(
    () =>
      extraTagsText
        .split(",")
        .map((s) => s.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter((s) => s.length >= 2)
        .slice(0, 5),
    [extraTagsText],
  );

  const tags = useMemo(
    () =>
      Array.from(
        new Set([
          ...buildBugTags({
            originPath: origin.originPath,
            originModule: origin.originModule,
            originGroup: origin.originGroup,
            triggerSource: origin.triggerSource,
            category,
            severity,
            online: environment.online,
            deviceType: environment.deviceType,
            reporterRole: userInfo?.role,
          }),
          ...customTags,
        ]),
      ),
    [category, customTags, environment.deviceType, environment.online, origin, severity, userInfo?.role],
  );

  const previewText = useMemo(
    () =>
      formatBugReportPreviewText({
        title: title.trim(),
        category,
        severity,
        description: description.trim(),
        stepsToReproduce: stepsToReproduce.trim(),
        expectedBehavior: expectedBehavior.trim(),
        originFullUrl: origin.originFullUrl,
        originModule: origin.originModule,
        originGroup: origin.originGroup,
        triggerSource: origin.triggerSource,
        tags,
        reporterUsername: userInfo?.username,
        reporterRole: userInfo?.role,
        environment,
        capturedErrors: includeDiagnostics ? capturedErrors : [],
      }),
    [
      capturedErrors,
      category,
      description,
      environment,
      expectedBehavior,
      includeDiagnostics,
      origin,
      severity,
      stepsToReproduce,
      tags,
      title,
      userInfo,
    ],
  );

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (cleanTitle.length < 4) {
      setErrorMsg("Escribe un título breve de la falla (mínimo 4 caracteres).");
      return;
    }
    if (cleanDescription.length < 10) {
      setErrorMsg("Describe qué ocurrió con al menos 10 caracteres.");
      return;
    }

    const payload = {
      title: cleanTitle,
      description: cleanDescription,
      stepsToReproduce: stepsToReproduce.trim(),
      expectedBehavior: expectedBehavior.trim(),
      category,
      severity,
      originPath: origin.originPath,
      originQuery: origin.originQuery,
      triggerSource: origin.triggerSource,
      customTags,
      environment,
      capturedErrors: includeDiagnostics ? capturedErrors : [],
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const localId = `offline-bug-${Date.now()}`;
      const next = enqueueOfflineBugReport({
        localId,
        queuedAt: new Date().toISOString(),
        payload,
        title: cleanTitle,
        originModule: origin.originModule,
        tags,
      });
      setOfflineQueue(next);
      setSubmittedResult({
        mode: "queued",
        tags,
        originModule: origin.originModule,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/soporte/fallas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report?: BugReportRecord;
        guidance?: BugTriageGuidance | null;
      };
      if (!res.ok) {
        throw new Error(json?.error || "No se pudo enviar el reporte.");
      }

      setSubmittedResult({
        mode: "sent",
        reportCode: json.report?.reportCode,
        tags: json.report?.tags || tags,
        originModule: json.report?.originModule || origin.originModule,
        guidance: json.guidance ?? null,
      });
      window.dispatchEvent(new CustomEvent(BUG_REPORT_UPDATED_EVENT));
      void loadHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de red enviando reporte.";
      // Fallback a cola offline ante falla de red
      if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network") || msg.toLowerCase().includes("conexi")) {
        const next = enqueueOfflineBugReport({
          localId: `offline-bug-${Date.now()}`,
          queuedAt: new Date().toISOString(),
          payload,
          title: cleanTitle,
          originModule: origin.originModule,
          tags,
        });
        setOfflineQueue(next);
        setSubmittedResult({
          mode: "queued",
          tags,
          originModule: origin.originModule,
        });
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/55 p-3 sm:p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bug-report-modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200">
              <Bug className="w-4.5 h-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="bug-report-modal-title" className="text-base sm:text-lg font-bold truncate">
                Presentar reporte de falla
              </h2>
              <p className="text-xs text-slate-300 truncate">
                Se etiqueta automáticamente con la pantalla y módulo de origen
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar ventana de reporte"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between gap-2 px-5 pt-3 border-b border-slate-200 bg-slate-50">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("crear")}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                activeTab === "crear"
                  ? "border-green-700 text-green-900 bg-white"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Nuevo reporte
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("historial");
                void loadHistory();
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                activeTab === "historial"
                  ? "border-green-700 text-green-900 bg-white"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Enviados</span>
              {(historyReports.length > 0 || offlineQueue.length > 0) && (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 tabular-nums">
                  {historyReports.length + offlineQueue.length}
                </span>
              )}
            </button>
          </div>
          <Link
            href="/dashboard/configuracion/fallas"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-green-800 hover:underline pb-2"
          >
            Ver panel completo →
          </Link>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "crear" ? (
            submittedResult ? (
              <div className="space-y-4 py-2">
                <div
                  className={`rounded-xl border p-4 ${
                    submittedResult.mode === "sent"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : "border-amber-300 bg-amber-50 text-amber-950"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {submittedResult.mode === "sent" ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <WifiOff className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1.5 min-w-0">
                      <h3 className="text-base font-bold">
                        {submittedResult.mode === "sent"
                          ? `Reporte enviado y radicado: ${submittedResult.reportCode}`
                          : "Reporte guardado en cola local (sin conexión)"}
                      </h3>
                      <p className="text-xs sm:text-sm">
                        {submittedResult.mode === "sent"
                          ? `Llegó etiquetado desde "${submittedResult.originModule}" al registro interno y canal de soporte.`
                          : `Apenas tu dispositivo recupere señal se enviará automáticamente con sus etiquetas de origen ("${submittedResult.originModule}").`}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {submittedResult.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-md bg-white/90 border border-slate-300 px-2 py-0.5 font-mono text-[11px] text-slate-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {submittedResult.guidance ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sky-950 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-sky-800">
                      Orientación automática mientras revisamos tu caso
                    </p>
                    <p className="text-sm font-bold">{submittedResult.guidance.title}</p>
                    <p className="text-xs text-sky-900 leading-relaxed">
                      {submittedResult.guidance.message}
                    </p>
                    <Link
                      href={submittedResult.guidance.guideHref}
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 underline underline-offset-2 hover:text-sky-950"
                    >
                      {submittedResult.guidance.guideLabel} →
                    </Link>
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-between gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSubmittedResult(null);
                      setTitle("");
                      setDescription("");
                      setStepsToReproduce("");
                      setExpectedBehavior("");
                    }}
                  >
                    Reportar otra falla
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setActiveTab("historial");
                        void loadHistory();
                      }}
                    >
                      Ver enviados
                    </Button>
                    <Button type="button" variant="primary" onClick={() => setOpen(false)}>
                      Listo
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Auto-captured origin & tags summary */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                      <MapPin className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
                      Origen detectado: {origin.originModule}
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {origin.originFullUrl}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 mr-1">
                      <Tag className="w-3 h-3" aria-hidden="true" /> Tags:
                    </span>
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md bg-white border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs sm:text-sm text-red-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-700" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Tipo de falla"
                    help="Elige si es un problema visual, de guardado, un cálculo o una duda en pantalla."
                    value={category}
                    onChange={(e) => setCategory(e.target.value as BugReportCategory)}
                  >
                    {Object.entries(BUG_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Impacto en operación"
                    help="Qué tanto te impide trabajar hoy: baja (estético), media (molesto), alta o crítica (bloquea)."
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as BugReportSeverity)}
                  >
                    {Object.entries(BUG_SEVERITY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>

                <Input
                  label="Título corto de la falla *"
                  help="Resume en una frase qué falló (ej. «No deja guardar huevos cuando cambio de galpón»)."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Al guardar postura NTC 1240 no actualiza el saldo de cubetas"
                  maxLength={160}
                  required
                />

                <Textarea
                  label="¿Qué ocurrió exactamente? *"
                  help="Cuenta con tus palabras qué botón tocaste y qué mensaje o error viste en pantalla."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Cuéntanos qué botón presionaste, qué mensaje apareció o qué dato salió distinto..."
                  rows={3}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Textarea
                    label="Pasos para reproducir (opcional)"
                    help="Anota en orden 1, 2, 3 qué hiciste antes de ver el problema."
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    placeholder="1. Entré a... 2. Elegí..."
                    rows={2}
                  />
                  <Textarea
                    label="¿Qué esperabas ver? (opcional)"
                    help="Explica qué debió pasar normalmente según tu trabajo diario."
                    value={expectedBehavior}
                    onChange={(e) => setExpectedBehavior(e.target.value)}
                    placeholder="Esperaba que guardara el lote o mostrara..."
                    rows={2}
                  />
                </div>

                <Input
                  label="Etiquetas adicionales opcionales (separadas por coma)"
                  help="Palabras cortas separadas por coma para ubicar rápido tu reporte (la ruta y módulo ya se agregan solos)."
                  value={extraTagsText}
                  onChange={(e) => setExtraTagsText(e.target.value)}
                  placeholder="ej. lote-p2, android, bulto-40kg"
                />

                <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDiagnostics}
                    onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-green-700 focus:ring-green-600"
                  />
                  <span>
                    Incluir contexto técnico de navegador ({environment.deviceType},{" "}
                    {environment.online ? "online" : "offline"}, {environment.viewport}) y{" "}
                    <strong>{capturedErrors.length}</strong> errores recientes capturados en sesión.
                  </span>
                </label>

                {showPreview && (
                  <div className="rounded-xl border border-slate-300 bg-slate-950 p-3.5 text-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                        Vista previa exacta del reporte etiquetado
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyPreview()}
                        className="inline-flex items-center gap-1 rounded bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] text-white"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <ClipboardCopy className="w-3 h-3" />}
                        <span>{copied ? "Copiado" : "Copiar"}</span>
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-200 max-h-48 overflow-y-auto">
                      {previewText}
                    </pre>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPreview((p) => !p)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{showPreview ? "Ocultar vista previa" : "Previsualizar reporte"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyPreview()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copiado" : "Copiar texto"}</span>
                    </button>
                  </div>

                  <Button type="submit" variant="primary" disabled={submitting} className="inline-flex items-center gap-2">
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>{submitting ? "Enviando..." : environment.online ? "Enviar reporte de falla" : "Guardar en cola offline"}</span>
                  </Button>
                </div>
              </form>
            )
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-600">
                  Historial reciente de fallas presentadas en esta granja (etiquetadas por módulo y ruta).
                </p>
                <button
                  type="button"
                  onClick={() => void loadHistory()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                  <span>Actualizar</span>
                </button>
              </div>

              {offlineQueue.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950">
                      Pendientes en cola local ({offlineQueue.length})
                    </span>
                    {environment.online && (
                      <button
                        type="button"
                        onClick={() => void flushQueue()}
                        className="text-xs font-semibold text-amber-900 underline"
                      >
                        Reintentar envío ahora
                      </button>
                    )}
                  </div>
                  {offlineQueue.map((q) => (
                    <div key={q.localId} className="rounded-lg bg-white border border-amber-200 p-2.5 text-xs">
                      <p className="font-semibold text-slate-900">{q.title}</p>
                      <p className="text-slate-600 mt-0.5">Origen: {q.originModule}</p>
                    </div>
                  ))}
                </div>
              )}

              {historyLoading && historyReports.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Cargando reportes...</p>
              ) : historyReports.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
                  Aún no hay fallas radicadas en el historial de esta granja.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {historyReports.slice(0, 12).map((rep) => (
                    <div key={rep.id} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-800">{rep.reportCode}</span>
                          <Badge color={SEVERITY_BADGE_COLOR[rep.severity]}>
                            {BUG_SEVERITY_LABELS[rep.severity]}
                          </Badge>
                          <Badge color={STATUS_BADGE_COLOR[rep.status] || "gray"}>
                            {BUG_STATUS_LABELS[rep.status]}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {new Date(rep.createdAt).toLocaleString("es-CO")}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{rep.title}</p>
                      <p className="text-xs text-slate-600 line-clamp-2">{rep.description}</p>
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {rep.tags.slice(0, 6).map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
