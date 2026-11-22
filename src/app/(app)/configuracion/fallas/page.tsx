"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";
import {
  ArrowLeft,
  Bug,
  Check,
  ClipboardCopy,
  MapPin,
  Plus,
  RefreshCw,
  Tag,
} from "lucide-react";
import { HeroActionButton, HeroActionLink, HeroBanner } from "@/components/HeroBanner";
import TableSearch from "@/components/TableSearch";
import { Badge, Button, Card, EmptyState, Select } from "@/components/ui";
import {
  BUG_CATEGORY_LABELS,
  BUG_REPORT_UPDATED_EVENT,
  BUG_SEVERITY_LABELS,
  BUG_STATUS_LABELS,
  formatBugReportPreviewText,
  openBugReportModal,
  type BugReportRecord,
  type BugReportSeverity,
  type BugReportStatus,
} from "@/lib/bug-report";
import { apiFetch } from "@/lib/fetch";

interface ReportSummary {
  total: number;
  abiertos: number;
  enRevision: number;
  resueltos: number;
  topTags: Array<{ tag: string; count: number }>;
}

const SEVERITY_BADGE_COLOR: Record<BugReportSeverity, string> = {
  baja: "gray",
  media: "yellow",
  alta: "orange",
  critica: "red",
};

const STATUS_BADGE_COLOR: Record<BugReportStatus, string> = {
  abierto: "red",
  en_revision: "yellow",
  resuelto: "green",
  descartado: "gray",
};

export default function ConfiguracionFallasPage() {
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<BugReportRecord[]>([]);

  useActionQuery(searchParams.get("nuevo"), {
    "1": () => openBugReportModal({ triggerSource: "pagina" }),
    falla: () => openBugReportModal({ triggerSource: "pagina" }),
  });
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [severityFilter, setSeverityFilter] = useState("todas");
  const [tagFilter, setTagFilter] = useState("");
  const [userRole, setUserRole] = useState<string>("OPERADOR");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== "todos") qs.set("status", statusFilter);
      if (severityFilter !== "todas") qs.set("severity", severityFilter);
      if (tagFilter.trim()) qs.set("tag", tagFilter.trim());
      if (search.trim()) qs.set("q", search.trim());

      const res = await apiFetch(`/api/soporte/fallas?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as {
          reports?: BugReportRecord[];
          summary?: ReportSummary;
        };
        setReports(Array.isArray(json.reports) ? json.reports : []);
        setSummary(json.summary ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [search, severityFilter, statusFilter, tagFilter]);

  useEffect(() => {
    void Promise.resolve().then(() => loadReports());
  }, [loadReports]);

  useEffect(() => {
    void apiFetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u?.role) setUserRole(String(u.role));
      })
      .catch(() => undefined);

    const onUpdated = () => {
      void loadReports();
    };
    window.addEventListener(BUG_REPORT_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(BUG_REPORT_UPDATED_EVENT, onUpdated);
  }, [loadReports]);

  const canManageStatus = userRole === "ADMIN" || userRole === "SUPERADMIN";

  const handleStatusChange = async (reportCode: string, status: BugReportStatus) => {
    setUpdatingCode(reportCode);
    try {
      const res = await apiFetch("/api/soporte/fallas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportCode, status }),
      });
      if (res.ok) {
        await loadReports();
      }
    } finally {
      setUpdatingCode(null);
    }
  };

  const handleCopy = async (rep: BugReportRecord) => {
    try {
      await navigator.clipboard.writeText(formatBugReportPreviewText(rep));
      setCopiedId(rep.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="space-y-6">
      <HeroBanner
        theme="guia"
        icon={<Bug className="w-3.5 h-3.5 text-rose-200" aria-hidden="true" />}
        eyebrow="Soporte y Diagnóstico Etiquetado"
        title="Reportes de fallas e incidencias"
        description="Cada falla enviada queda etiquetada automáticamente con la pantalla, módulo, usuario, red y diagnóstico técnico para saber exactamente de dónde proviene."
        actions={
          <>
            <HeroActionLink href="/configuracion" tone="glass">
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Configuración</span>
            </HeroActionLink>
            <HeroActionButton
              tone="glass"
              onClick={() => void loadReports()}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </HeroActionButton>
            <HeroActionButton
              tone="solid"
              onClick={() => openBugReportModal({ triggerSource: "pagina" })}
            >
              <Plus className="w-4 h-4" />
              <span>Presentar falla</span>
            </HeroActionButton>
          </>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-slate-500">Total reportes</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{summary.total}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-rose-500">
            <p className="text-xs text-slate-500">Abiertos</p>
            <p className="text-2xl font-bold text-rose-700 mt-1 tabular-nums">{summary.abiertos}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-amber-500">
            <p className="text-xs text-slate-500">En revisión</p>
            <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{summary.enRevision}</p>
          </Card>
          <Card className="p-4 border-l-4 border-l-emerald-500">
            <p className="text-xs text-slate-500">Resueltos</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{summary.resueltos}</p>
          </Card>
        </div>
      )}

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <TableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar por radicado FAIL-, ruta, módulo, tag o descripción..."
              resultCount={reports.length}
              totalCount={summary?.total ?? reports.length}
            />
          </div>
          <Select
            label="Estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            {Object.entries(BUG_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Severidad"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="todas">Todas las severidades</option>
            {Object.entries(BUG_SEVERITY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {summary && summary.topTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 mr-1">
              <Tag className="w-3.5 h-3.5" aria-hidden="true" /> Filtrar por tag:
            </span>
            {tagFilter && (
              <button
                type="button"
                onClick={() => setTagFilter("")}
                className="rounded-full bg-slate-900 text-white px-2.5 py-0.5 text-[11px] font-semibold"
              >
                Limpiar ({tagFilter}) ×
              </button>
            )}
            {summary.topTags.map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tag === tagFilter ? "" : tag)}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
                  tag === tagFilter
                    ? "bg-green-800 border-green-900 text-white font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tag} ({count})
              </button>
            ))}
          </div>
        )}
      </Card>

      {loading && reports.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">Cargando reportes de fallas...</Card>
      ) : reports.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon="alert"
            message="No hay reportes de fallas que coincidan con los filtros actuales."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((rep) => (
            <Card key={rep.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {rep.reportCode}
                    </span>
                    <Badge color={SEVERITY_BADGE_COLOR[rep.severity]}>
                      {BUG_SEVERITY_LABELS[rep.severity]}
                    </Badge>
                    <Badge color={STATUS_BADGE_COLOR[rep.status]}>
                      {BUG_STATUS_LABELS[rep.status]}
                    </Badge>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {BUG_CATEGORY_LABELS[rep.category]}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">{rep.title}</h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopy(rep)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {copiedId === rep.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <ClipboardCopy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === rep.id ? "Copiado" : "Copiar reporte"}</span>
                  </button>

                  {canManageStatus && (
                    <select
                      aria-label={`Cambiar estado de ${rep.reportCode}`}
                      value={rep.status}
                      disabled={updatingCode === rep.reportCode}
                      onChange={(e) =>
                        void handleStatusChange(rep.reportCode, e.target.value as BugReportStatus)
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      {Object.entries(BUG_STATUS_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          Estado: {label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
                  {rep.originModule}
                </span>
                <span className="font-mono text-[11px]">{rep.originFullUrl}</span>
                <span>
                  Por: <strong>{rep.reporterName}</strong> ({rep.reporterUsername} · {rep.reporterRole})
                </span>
                <span>{new Date(rep.createdAt).toLocaleString("es-CO")}</span>
              </div>

              <p className="text-sm text-slate-800 whitespace-pre-wrap">{rep.description}</p>

              {(rep.stepsToReproduce || rep.expectedBehavior) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/70 rounded-lg p-3 border border-slate-200">
                  {rep.stepsToReproduce && (
                    <div>
                      <p className="font-semibold text-slate-700 mb-0.5">Pasos reportados</p>
                      <p className="text-slate-600 whitespace-pre-wrap">{rep.stepsToReproduce}</p>
                    </div>
                  )}
                  {rep.expectedBehavior && (
                    <div>
                      <p className="font-semibold text-slate-700 mb-0.5">Comportamiento esperado</p>
                      <p className="text-slate-600 whitespace-pre-wrap">{rep.expectedBehavior}</p>
                    </div>
                  )}
                </div>
              )}

              {rep.capturedErrors.length > 0 && (
                <details className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-amber-950">
                    Diagnóstico técnico capturado ({rep.capturedErrors.length} eventos)
                  </summary>
                  <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-800">
                    {rep.capturedErrors.map((err, i) => (
                      <li key={i}>
                        [{err.kind}] {err.occurredAt} — {err.message}
                        {err.source ? ` (${err.source})` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                {rep.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTagFilter(tag)}
                    className="rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-700 transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
