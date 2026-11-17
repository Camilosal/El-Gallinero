"use client";

import { useState } from "react";
import { ArrowUpRight, Download, FileUp } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

export type OfficialCsvImportType = "sipsa_i" | "ipc" | "ipp";

interface ExternalObservationRecord {
  id: string;
  observationKey: string;
  observedAt: string;
  value: string;
  unit: string | null;
  dimensions: Record<string, unknown>;
  providerName: string;
}

interface ManualSnapshot {
  status: string;
  fetchedAt: string;
  summary?: string | null;
  lastError?: string | null;
}

interface PreviewResult {
  validRows: number;
  rejectedRows: number;
  rejectionReasons: Record<string, number>;
  periodStart: string | null;
  periodEnd: string | null;
  preview: Array<{
    period: string;
    indicator: string;
    territory: string;
    value: number;
    unit: string | null;
  }>;
}

interface OfficialCsvImportPanelProps {
  sourceType: OfficialCsvImportType;
  title: string;
  description: string;
  officialUrl: string;
  templateUrl: string;
  history: ExternalObservationRecord[];
  snapshot?: ManualSnapshot;
  onImported: () => Promise<void>;
}

function displayValue(sourceType: OfficialCsvImportType, value: string, unit: string | null): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (sourceType === "sipsa_i") return "$" + Math.round(numeric).toLocaleString("es-CO") + (unit ? " · " + unit : " COP, presentación según el archivo");
  return numeric.toLocaleString("es-CO", { maximumFractionDigits: 6 }) + (unit ? " " + unit : "");
}

function snapshotBadge(snapshot?: ManualSnapshot): { color: "green" | "yellow" | "red" | "blue"; label: string } {
  if (snapshot?.status === "ok") return { color: "green", label: "Actualización automática" };
  if (snapshot?.status === "manual") return { color: "blue", label: "Importación asistida" };
  if (snapshot?.status === "fallback") return { color: "yellow", label: "Último dato conservado" };
  if (snapshot?.status === "error") return { color: "red", label: "Pendiente de archivo válido" };
  return { color: "yellow", label: "Sin archivo importado" };
}

export default function OfficialCsvImportPanel({
  sourceType,
  title,
  description,
  officialUrl,
  templateUrl,
  history,
  snapshot,
  onImported,
}: OfficialCsvImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [group, setGroup] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const badge = snapshotBadge(snapshot);

  async function submit(action: "preview" | "import") {
    if (!file) {
      setNotice({ type: "error", text: "Seleccione primero un archivo CSV." });
      return;
    }
    setBusy(action);
    setNotice(null);
    try {
      const response = await apiFetch("/api/configuracion/fuentes-externas/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sourceType, group, fileName: file.name, csv: await file.text() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "No se pudo procesar el archivo");
      if (action === "preview") {
        setPreview(result as PreviewResult);
        setNotice({
          type: "ok",
          text: "Vista previa lista: " + result.validRows + " filas válidas y " + result.rejectedRows + " omitidas.",
        });
        return;
      }
      setPreview(null);
      setFile(null);
      setNotice({ type: "ok", text: result.summary || "Importación completada." });
      await onImported();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Error al procesar el archivo" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FileUp className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <Badge color={badge.color}>{badge.label}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-slate-600">{description}</p>
          {snapshot ? (
            <p className="mt-1 text-[11px] text-slate-500">
              Última importación: {new Date(snapshot.fetchedAt).toLocaleString("es-CO")}
              {snapshot.summary ? " · " + snapshot.summary : ""}
              {snapshot.lastError ? " · " + snapshot.lastError : ""}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <a className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline" href={officialUrl} target="_blank" rel="noreferrer">
            Fuente oficial <ArrowUpRight className="h-3 w-3" />
          </a>
          <a className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline" href={templateUrl} download>
            Plantilla CSV <Download className="h-3 w-3" />
          </a>
        </div>
      </div>

      <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
        El cron descarga y revisa el anexo oficial más reciente cuando el DANE publica un XLSX compatible. Si cambia el formato, puede usar esta carga asistida con un CSV revisado. Los datos quedan como referencia y no cambian precios ni fórmulas maestras.
      </p>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)_auto] sm:items-end">
        <label className="block text-xs font-medium text-slate-700">
          Archivo CSV UTF-8
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setPreview(null);
              setNotice(null);
            }}
          />
        </label>
        {sourceType === "sipsa_i" ? (
          <label className="block text-xs font-medium text-slate-700">
            Grupo del archivo (opcional)
            <input
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              placeholder="Insumos pecuarios, jornales..."
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
            />
          </label>
        ) : <div />}
        <Button variant="secondary" disabled={!file || busy !== null} onClick={() => void submit("preview")} className="px-3 py-2 text-xs">
          {busy === "preview" ? "Revisando..." : "Vista previa"}
        </Button>
      </div>

      {notice ? (
        <p className={`mt-3 rounded-lg p-3 text-xs ${notice.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {notice.text}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800">
              Periodo {preview.periodStart || "—"}{preview.periodEnd && preview.periodEnd !== preview.periodStart ? " a " + preview.periodEnd : ""} · {preview.validRows} filas importables · {preview.rejectedRows} omitidas
            </p>
            <Button variant="primary" disabled={busy !== null || preview.validRows === 0} onClick={() => void submit("import")} className="px-3 py-2 text-xs">
              {busy === "import" ? "Importando..." : "Confirmar importación"}
            </Button>
          </div>
          {Object.keys(preview.rejectionReasons).length > 0 ? (
            <ul className="mb-3 space-y-1 text-[11px] text-amber-800">
              {Object.entries(preview.rejectionReasons).map(([reason, count]) => <li key={reason}>{count} filas: {reason}</li>)}
            </ul>
          ) : null}
          {preview.preview.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-2 pr-3">Periodo</th><th className="py-2 pr-3">Indicador</th><th className="py-2 pr-3">Territorio</th><th className="py-2 text-right">Valor</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.preview.slice(0, 5).map((row, index) => (
                    <tr key={index}><td className="py-2 pr-3">{row.period}</td><td className="py-2 pr-3">{row.indicator}</td><td className="py-2 pr-3">{row.territory || "No informado"}</td><td className="py-2 text-right">{displayValue(sourceType, String(row.value), row.unit)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h4 className="mb-2 text-xs font-bold text-slate-800">Observaciones importadas más recientes</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-2 pr-3">Periodo</th><th className="py-2 pr-3">Indicador / presentación</th><th className="py-2 pr-3">Territorio</th><th className="py-2 pr-3 text-right">Valor</th><th className="py-2">Fuente</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.slice(0, 15).map((row) => {
                  const period = String(row.dimensions.period || row.observedAt.slice(0, 7));
                  const indicator = String(row.dimensions.article || row.dimensions.indicator || row.observationKey);
                  const detail = String(row.dimensions.characteristics || row.dimensions.measure || "");
                  const territory = String(row.dimensions.divipolaCode || row.dimensions.coverage || "No informado");
                  return (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{period}</td>
                      <td className="max-w-md py-2 pr-3"><span className="font-medium text-slate-900">{indicator}</span>{detail ? <span className="block text-[11px] text-slate-500">{detail}</span> : null}</td>
                      <td className="py-2 pr-3 text-slate-600">{territory}{row.dimensions.coverageLevel ? " · " + String(row.dimensions.coverageLevel) : ""}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-right">{displayValue(sourceType, row.value, row.unit)}</td>
                      <td className="py-2 text-slate-500">{row.providerName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
