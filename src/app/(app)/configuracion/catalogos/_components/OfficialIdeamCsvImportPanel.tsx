"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, FileUp } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface IdeamAlert {
  id: string;
  title: string;
  description: string;
  department: string;
  municipality: string;
  waterbody: string;
  publishedAt: string | null;
  observedAt?: string | null;
  statusLabel: string;
}

interface Snapshot {
  status: string;
  fetchedAt: string;
  summary?: string | null;
  lastError?: string | null;
}

interface Props {
  snapshot?: Snapshot;
  onImported: () => Promise<void>;
}

const OFFICIAL_CSV_URL = "https://bart.ideam.gov.co/ospa/DatosAbiertos/Alertas_Hidrologicas/alertas_hidrologicas.csv";

export default function OfficialIdeamCsvImportPanel({ snapshot, onImported }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ fileName: string; alertCount: number; alerts: IdeamAlert[] } | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  async function submit(action: "preview" | "import") {
    if (!file) {
      setNotice({ type: "error", text: "Descarga y selecciona primero el CSV oficial del IDEAM." });
      return;
    }
    setBusy(action);
    setNotice(null);
    try {
      const response = await apiFetch("/api/configuracion/fuentes-externas/importar-ideam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, fileName: file.name, csv: await file.text() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "No se pudo procesar el CSV IDEAM.");
      if (action === "preview") {
        setPreview(result);
        setNotice({ type: "ok", text: `Archivo válido: ${result.alertCount} alertas vigentes encontradas.` });
        return;
      }
      setPreview(null);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setNotice({ type: "ok", text: result.summary || "CSV IDEAM importado." });
      await onImported();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Error al procesar el CSV IDEAM." });
    } finally {
      setBusy(null);
    }
  }

  const snapshotLabel = snapshot?.status === "ok"
    ? "Actualización automática"
    : snapshot?.status === "manual"
      ? "CSV oficial importado"
      : snapshot?.status === "fallback"
        ? "Último dato válido conservado"
        : snapshot?.status === "error"
          ? "Sin descarga válida"
          : "Sin archivo importado";

  return (
    <Card className="mt-4 border-sky-200 bg-sky-50/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FileUp className="h-4 w-4 text-sky-700" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-900">Respaldo con CSV oficial IDEAM</h3>
            <Badge color={snapshot?.status === "ok" ? "green" : snapshot?.status === "manual" ? "blue" : "yellow"}>{snapshotLabel}</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            Si el servidor no logra descargar el archivo, bájalo desde el enlace oficial, revísalo aquí e impórtalo. El cron conservará estas alertas como último dato válido si vuelve a fallar la conexión.
          </p>
          {snapshot?.fetchedAt && (
            <p className="mt-1 text-[11px] text-slate-500">
              Última carga o consulta: {new Date(snapshot.fetchedAt).toLocaleString("es-CO")}{snapshot.summary ? ` · ${snapshot.summary}` : ""}
            </p>
          )}
        </div>
        <a className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 underline" href={OFFICIAL_CSV_URL} target="_blank" rel="noreferrer">
          Descargar CSV oficial <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs font-medium text-slate-700">
          Archivo CSV de alertas hidrológicas
          <input
            ref={fileInput}
            className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setPreview(null);
              setNotice(null);
            }}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy !== null || !file} onClick={() => void submit("preview")} className="px-3 py-2 text-xs">
            {busy === "preview" ? "Validando..." : "Validar archivo"}
          </Button>
          <Button type="button" variant="primary" disabled={busy !== null || !file || !preview} onClick={() => void submit("import")} className="px-3 py-2 text-xs">
            {busy === "import" ? "Importando..." : "Importar alertas"}
          </Button>
        </div>
      </div>

      {notice && (
        <p className={`mt-3 rounded-lg border px-3 py-2 text-xs ${notice.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          {notice.text}
        </p>
      )}

      {preview && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-800">Vista previa · {preview.fileName} · {preview.alertCount} alertas vigentes</p>
          {preview.alerts.length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-slate-600">
              {preview.alerts.map((alert) => (
                <li key={alert.id} className="border-t border-slate-100 pt-1">
                  <strong>{alert.title}</strong> · {[alert.department, alert.municipality, alert.waterbody].filter(Boolean).join(" · ") || "Cobertura no informada"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-slate-600">Archivo válido sin alertas amarillas, naranjas o rojas vigentes.</p>
          )}
        </div>
      )}
    </Card>
  );
}
