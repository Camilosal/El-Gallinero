"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { PageHeader, Card, Button, Input, Badge } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface ExportDatasetInfo {
  id: string;
  label: string;
  description: string;
  category: "operacion" | "produccion" | "sanidad" | "finanzas" | "inventario" | "infraestructura";
  granularity: string;
  usesRange: boolean;
  formats: ("csv" | "xlsx")[];
  columns: string[];
}

interface ExportCatalog {
  maxRowsPerDataset: number;
  maxRangeDays: number;
  package: { id: string; label: string; description: string; formats: string[]; datasets: string[] };
  datasets: ExportDatasetInfo[];
}

interface ExportTokenSummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const CATEGORY_LABELS: Record<ExportDatasetInfo["category"], string> = {
  operacion: "Operación diaria",
  produccion: "Producción",
  sanidad: "Sanidad",
  finanzas: "Finanzas y ventas",
  inventario: "Inventarios",
  infraestructura: "Infraestructura y sensores",
};

const CATEGORY_ORDER: ExportDatasetInfo["category"][] = [
  "operacion",
  "produccion",
  "sanidad",
  "finanzas",
  "inventario",
  "infraestructura",
];

function todayBogota(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | null): string {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] || fallback;
}

export default function ExportarDatosPage() {
  const today = useMemo(() => todayBogota(), []);
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);

  const [catalog, setCatalog] = useState<ExportCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [tokens, setTokens] = useState<ExportTokenSummary[]>([]);
  const [tokenName, setTokenName] = useState("Dashboard externo");
  const [issuedToken, setIssuedToken] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const rangeValid = Boolean(from && to && from <= to);

  const loadCatalog = useCallback(() => {
    apiFetch("/api/export")
      .then((res) => {
        if (!res.ok) {
          return res
            .json()
            .catch(() => ({}))
            .then((payload) => {
              throw new Error(payload.error || `No se pudo cargar el catálogo (${res.status})`);
            });
        }
        return res.json().then((payload) => {
          setCatalog(payload);
          setCatalogError("");
        });
      })
      .catch((err) => {
        setCatalogError(err instanceof Error ? err.message : "No se pudo cargar el catálogo");
      });
  }, []);

  const loadTokens = useCallback(() => {
    apiFetch("/api/export/token")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload) setTokens(Array.isArray(payload.tokens) ? payload.tokens : []);
      })
      .catch(() => {
        // Silencioso: el panel de token es secundario frente a las descargas.
      });
  }, []);

  useEffect(() => {
    loadCatalog();
    loadTokens();
  }, [loadCatalog, loadTokens]);

  const download = async (datasetId: string, format: "csv" | "xlsx", label: string) => {
    if (!rangeValid) {
      setError("Revisa el rango: la fecha inicial no puede ser posterior a la final.");
      return;
    }
    setBusy(`${datasetId}-${format}`);
    setError("");
    setMessage("");
    try {
      const params = new URLSearchParams({ dataset: datasetId, format, from, to });
      const res = await fetch(`/api/export?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `No se pudo generar la descarga (${res.status})`);
      }
      const blob = await res.blob();
      const filename = filenameFrom(
        res.headers.get("Content-Disposition"),
        `gallinero-${datasetId}-${from}-a-${to}.${format}`,
      );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      const truncated = res.headers.get("X-Export-Truncated") === "1";
      setMessage(
        `${label}: descarga lista (${filename}).${
          truncated ? " El archivo alcanzó el tope de filas; reduce el rango para ver todo." : ""
        }`,
      );
      loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el archivo");
    } finally {
      setBusy(null);
    }
  };

  const generateToken = async () => {
    setTokenBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/export/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", name: tokenName }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "No se pudo generar el token");
      setIssuedToken(payload.token || "");
      setCopied(false);
      loadTokens();
      setMessage("Token generado. Cópialo ahora: no se volverá a mostrar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el token");
    } finally {
      setTokenBusy(false);
    }
  };

  const revokeTokens = async () => {
    setTokenBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/export/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "No se pudo revocar el token");
      setIssuedToken("");
      loadTokens();
      setMessage("Token revocado. Las integraciones existentes dejarán de descargar datos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar el token");
    } finally {
      setTokenBusy(false);
    }
  };

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(issuedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("No se pudo copiar automáticamente. Selecciona el token y cópialo a mano.");
    }
  };

  const applyQuickRange = (days: number) => {
    setFrom(addDays(today, -(days - 1)));
    setTo(today);
  };

  const applyCurrentMonth = () => {
    setFrom(`${today.slice(0, 7)}-01`);
    setTo(today);
  };

  const applyCurrentYear = () => {
    setFrom(`${today.slice(0, 4)}-01-01`);
    setTo(today);
  };

  const grouped = useMemo(() => {
    if (!catalog) return [];
    return CATEGORY_ORDER.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      datasets: catalog.datasets.filter((dataset) => dataset.category === category),
    })).filter((group) => group.datasets.length > 0);
  }, [catalog]);

  const activeToken = tokens[0] ?? null;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Exportar datos"
        description="Descarga la operación de la granja en CSV o Excel para tu dashboard, hoja de cálculo o modelo propio. Los archivos respetan el filtro de fechas y la seguridad por granja."
        icon="incoming"
        help="Cada archivo se genera al momento con los datos reales de tu granja. No se guardan copias en el servidor."
      />

      {/* Rango de fechas */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Desde"
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
            <Input
              label="Hasta"
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 lg:pb-0.5">
            <Button variant="secondary" onClick={() => applyQuickRange(30)}>
              Últimos 30 días
            </Button>
            <Button variant="secondary" onClick={() => applyQuickRange(90)}>
              Últimos 90 días
            </Button>
            <Button variant="secondary" onClick={applyCurrentMonth}>
              Este mes
            </Button>
            <Button variant="secondary" onClick={applyCurrentYear}>
              Este año
            </Button>
          </div>
          <div className="lg:ml-auto text-xs text-slate-500 leading-relaxed">
            <p>
              Tope por archivo:{" "}
              <strong>{catalog ? catalog.maxRowsPerDataset.toLocaleString("es-CO") : "50.000"}</strong>{" "}
              filas.
            </p>
            <p>
              Ventana máxima:{" "}
              <strong>{catalog ? catalog.maxRangeDays : 731}</strong> días.
            </p>
          </div>
        </div>

        {!rangeValid && (
          <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            La fecha inicial no puede ser posterior a la fecha final.
          </p>
        )}
      </Card>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {catalogError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {catalogError}
        </div>
      )}

      {/* Paquete completo */}
      {catalog && (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-start gap-4 flex-1">
              <span className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-800">{catalog.package.label}</h2>
                <p className="text-sm text-slate-600 mt-1 max-w-2xl">{catalog.package.description}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Ideal para conciliar todo el negocio en una sola revisión. Incluye{" "}
                  {catalog.package.datasets.length} hojas.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => download(catalog.package.id, "xlsx", "Paquete operativo")}
              disabled={busy !== null || !rangeValid}
              className="inline-flex items-center gap-2 shrink-0"
            >
              {busy === `${catalog.package.id}-xlsx` ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Descargar Excel completo
            </Button>
          </div>
        </Card>
      )}

      {/* Datasets */}
      {grouped.map((group) => (
        <section key={group.category} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{group.label}</h2>
            <span className="text-xs text-slate-400">{group.datasets.length} archivos</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.datasets.map((dataset) => (
              <Card key={dataset.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 leading-snug">{dataset.label}</h3>
                  <Badge color={dataset.usesRange ? "green" : "gray"}>{dataset.granularity}</Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed flex-1">{dataset.description}</p>

                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">
                    Ver {dataset.columns.length} columnas
                  </summary>
                  <p className="mt-2 leading-relaxed">{dataset.columns.join(" · ")}</p>
                </details>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="secondary"
                    onClick={() => download(dataset.id, "csv", dataset.label)}
                    disabled={busy !== null || !rangeValid}
                    className="inline-flex items-center gap-1.5"
                  >
                    {busy === `${dataset.id}-csv` ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    CSV
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => download(dataset.id, "xlsx", dataset.label)}
                    disabled={busy !== null || !rangeValid}
                    className="inline-flex items-center gap-1.5"
                  >
                    {busy === `${dataset.id}-xlsx` ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    )}
                    Excel
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {/* Token para dashboards externos */}
      <Card className="border-slate-200">
        <div className="flex items-start gap-4">
          <span className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white shrink-0">
            <KeyRound className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-800">Acceso programático para un dashboard</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              Genera un token de <strong>solo lectura</strong> para que tu dashboard descargue CSV o Excel sin
              guardar tu contraseña. Puedes revocarlo cuando quieras; al rotarlo, el anterior deja de funcionar.
            </p>

            {activeToken ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-700">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Token activo
                  </span>
                  <span className="font-mono text-xs">{activeToken.prefix}…</span>
                  <span className="text-xs text-slate-500">Creado: {formatDate(activeToken.createdAt)}</span>
                  <span className="text-xs text-slate-500">Último uso: {formatDate(activeToken.lastUsedAt)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Aún no hay token activo. Genera uno para conectar un dashboard externo.
              </p>
            )}

            <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
              <Input
                label="Nombre de la integración"
                value={tokenName}
                maxLength={120}
                onChange={(event) => setTokenName(event.target.value)}
                className="sm:max-w-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={generateToken}
                  disabled={tokenBusy}
                  className="inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${tokenBusy ? "animate-spin" : ""}`} />
                  {activeToken ? "Rotar token" : "Generar token"}
                </Button>
                {activeToken && (
                  <Button
                    variant="danger"
                    onClick={revokeTokens}
                    disabled={tokenBusy}
                    className="inline-flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Revocar
                  </Button>
                )}
              </div>
            </div>

            {issuedToken && (
              <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5">
                <p className="text-xs font-semibold text-emerald-900">
                  Copia este token ahora. Por seguridad no se volverá a mostrar.
                </p>
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <code className="flex-1 break-all rounded-lg bg-white border border-emerald-200 px-3 py-2 font-mono text-xs text-slate-800">
                    {issuedToken}
                  </code>
                  <Button
                    variant="success"
                    onClick={copyToken}
                    className="inline-flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                Cómo consumirlo desde tu dashboard
              </summary>
              <div className="mt-3 space-y-3 text-xs text-slate-600">
                <p>
                  Envía el token en el header <code className="font-mono">X-Export-Token</code> (o como{" "}
                  <code className="font-mono">Authorization: Bearer</code>). El endpoint responde el archivo
                  directamente, sin pasos intermedios.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-slate-900 text-slate-100 p-3 font-mono leading-relaxed">
{`TOKEN="glli_exp_tu_token"

# Resumen diario en CSV
curl -H "X-Export-Token: $TOKEN" \\
  "https://gallinero.iwage.co/api/export?dataset=resumen-diario&format=csv&from=2026-01-01&to=2026-11-14" \\
  -o resumen-diario.csv

# Paquete completo en Excel
curl -H "X-Export-Token: $TOKEN" \\
  "https://gallinero.iwage.co/api/export?dataset=paquete-operativo&format=xlsx" \\
  -o gallinero.xlsx

# Catálogo de datasets y columnas
curl -H "X-Export-Token: $TOKEN" "https://gallinero.iwage.co/api/export"`}
                </pre>
                <p>
                  Para un tablero en vivo, programa una descarga cada 15–60 minutos y reemplaza la tabla en tu
                  base de datos. El archivo siempre trae el rango completo solicitado, no solo cambios.
                </p>
              </div>
            </details>
          </div>
        </div>
      </Card>

      <p className="text-xs text-slate-500 leading-relaxed">
        Consejo: para un dashboard, empieza con <strong>Resumen diario de operación</strong> (una fila por día) y
        complementa con <strong>Producción de huevos</strong>, <strong>Finanzas</strong> y{" "}
        <strong>Mortalidad</strong>. Así evitas recalcular agregados en tu lado.
      </p>
    </div>
  );
}
