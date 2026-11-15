"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  KeyRound,
  PlugZap,
  RefreshCw,
  Save,
  ShieldCheck,
  Terminal,
  Trash2,
} from "lucide-react";
import { PageHeader, Card, Button, Input, Badge, Select } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import type { ErpAccountMapping } from "@/lib/integrations/profiles";

type ErpProfile = "generic" | "siigo" | "alegra" | "odoo" | "zoho";
type IntegrationScope = "read:finance" | "read:inventory" | "read:contacts" | "read:production";

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
  scopes?: IntegrationScope[];
  profile?: ErpProfile;
  expiresAt?: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ProfileMeta {
  id: ErpProfile;
  name: string;
  subtitle: string;
  description: string;
  authHeaderHint: string;
}

const SCOPE_LABELS: Record<IntegrationScope, string> = {
  "read:finance": "Finanzas y facturación",
  "read:inventory": "Inventarios y kardex",
  "read:contacts": "Terceros (clientes/proveedores)",
  "read:production": "Centros de costo y producción",
};

const SPECIES_LABELS: Record<string, string> = {
  gallina: "Gallinas ponedoras",
  gallo: "Gallos reproductores",
  pollo: "Pollos de engorde",
  codorniz: "Codornices",
  pato: "Patos",
  conejo: "Conejos",
  cuy: "Cuyes",
  general: "Operación general",
};

const TEST_ENDPOINTS = [
  { id: "manifest", label: "Manifiesto / Esquema ERP", buildPath: (p: ErpProfile) => `/api/v1/integrations/manifest?profile=${p}` },
  { id: "transactions", label: "Transacciones financieras", buildPath: (p: ErpProfile) => `/api/v1/integrations/transactions?profile=${p}&limit=5` },
  { id: "inventory", label: "Inventario alimentos e insumos", buildPath: (p: ErpProfile) => `/api/v1/integrations/inventory?profile=${p}&limit=5` },
  { id: "movements", label: "Movimientos de inventario", buildPath: (p: ErpProfile) => `/api/v1/integrations/inventory/movements?profile=${p}&limit=5` },
  { id: "contacts", label: "Terceros (clientes y proveedores)", buildPath: (p: ErpProfile) => `/api/v1/integrations/contacts?profile=${p}&limit=5` },
  { id: "cost-centers", label: "Centros de costo y galpones", buildPath: (p: ErpProfile) => `/api/v1/integrations/cost-centers?profile=${p}` },
  { id: "export-json", label: "Dataset resumen diario (JSON)", buildPath: () => "/api/export?dataset=resumen-diario&format=json&limit=5" },
];

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

function formatDate(value: string | null | undefined): string {
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
  const searchParams = useSearchParams();
  const today = useMemo(() => todayBogota(), []);
  const [activeTab, setActiveTab] = useState<"descargas" | "conectores">(
    () => (searchParams.get("tab") === "conectores" ? "conectores" : "descargas"),
  );
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);

  const [catalog, setCatalog] = useState<ExportCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [tokens, setTokens] = useState<ExportTokenSummary[]>([]);
  const [tokenName, setTokenName] = useState("Conector ERP");
  const [tokenProfile, setTokenProfile] = useState<ErpProfile>("siigo");
  const [tokenScopes, setTokenScopes] = useState<IntegrationScope[]>([
    "read:finance",
    "read:inventory",
    "read:contacts",
    "read:production",
  ]);
  const [tokenExpiryDays, setTokenExpiryDays] = useState<string>("365");
  const [issuedToken, setIssuedToken] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Estado de conectores ERP y mapeo PUC
  const [profilesMeta, setProfilesMeta] = useState<ProfileMeta[]>([]);
  const [mapping, setMapping] = useState<ErpAccountMapping | null>(null);
  const [savingMapping, setSavingMapping] = useState(false);
  const [testEndpointId, setTestEndpointId] = useState<string>("transactions");
  const [testLoading, setTestLoading] = useState(false);
  const [testPreview, setTestPreview] = useState<string>("");

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

  const loadIntegrationMapping = useCallback(() => {
    apiFetch("/api/configuracion/integraciones")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!payload) return;
        if (payload.mapping) {
          setMapping(payload.mapping);
          setTokenProfile(payload.mapping.defaultProfile || "generic");
        }
        if (Array.isArray(payload.profiles)) {
          setProfilesMeta(payload.profiles);
        }
      })
      .catch(() => {
        // Silencioso si no hay permisos de lectura
      });
  }, []);

  useEffect(() => {
    loadCatalog();
    loadTokens();
    loadIntegrationMapping();
  }, [loadCatalog, loadTokens, loadIntegrationMapping]);

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

  const generateToken = async (replacePrevious = true, customProfile?: ErpProfile, customScopes?: IntegrationScope[]) => {
    setTokenBusy(true);
    setError("");
    setMessage("");
    try {
      const expiresInDays = Number(tokenExpiryDays);
      const res = await apiFetch("/api/export/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: replacePrevious ? "rotate" : "generate",
          replacePrevious,
          name: tokenName,
          profile: customProfile ?? tokenProfile,
          scopes: customScopes ?? tokenScopes,
          ...(Number.isFinite(expiresInDays) && expiresInDays > 0 ? { expiresInDays } : {}),
        }),
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

  const revokeTokens = async (tokenId?: string) => {
    setTokenBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/export/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", ...(tokenId ? { tokenId } : {}) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "No se pudo revocar el token");
      if (!tokenId) setIssuedToken("");
      loadTokens();
      setMessage(tokenId ? "Token revocado." : "Tokens revocados. Las integraciones existentes dejarán de consultar datos.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar el token");
    } finally {
      setTokenBusy(false);
    }
  };

  const saveMapping = async () => {
    if (!mapping) return;
    setSavingMapping(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/configuracion/integraciones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "No se pudo guardar el mapeo ERP");
      if (payload.mapping) setMapping(payload.mapping);
      setMessage("Configuración contable y perfil ERP guardados correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el mapeo ERP");
    } finally {
      setSavingMapping(false);
    }
  };

  const runLiveEndpointTest = async () => {
    const endpoint = TEST_ENDPOINTS.find((item) => item.id === testEndpointId) ?? TEST_ENDPOINTS[0];
    const selectedProfile = mapping?.defaultProfile ?? tokenProfile;
    const path = endpoint.buildPath(selectedProfile);
    setTestLoading(true);
    setError("");
    try {
      const res = await apiFetch(path);
      const payload = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      setTestPreview(JSON.stringify(payload, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar el endpoint de prueba");
    } finally {
      setTestLoading(false);
    }
  };

  const toggleScope = (scope: IntegrationScope) => {
    setTokenScopes((prev) => {
      if (prev.includes(scope)) {
        return prev.length > 1 ? prev.filter((item) => item !== scope) : prev;
      }
      return [...prev, scope];
    });
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
  const activeProfile = mapping?.defaultProfile ?? tokenProfile;
  const selectedEndpoint = TEST_ENDPOINTS.find((item) => item.id === testEndpointId) ?? TEST_ENDPOINTS[0];
  const sampleEndpointPath = selectedEndpoint.buildPath(activeProfile);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Exportar datos y conectores ERP"
        description="Descarga la operación en CSV/Excel o conecta tu contabilidad y ERP (SIIGO, Alegra, Odoo, Zoho o API JSON propia) mediante tokens seguros de solo lectura."
        icon="incoming"
        help="Cada archivo y endpoint se genera en vivo desde los datos reales de tu granja respetando el aislamiento por tenant."
      />

      {/* Selector de pestaña */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("descargas")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "descargas"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Descargas CSV / Excel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("conectores")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "conectores"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <PlugZap className="w-4 h-4" />
          Conectores ERP y API JSON
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {(error || catalogError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || catalogError}
        </div>
      )}

      {activeTab === "descargas" && (
        <>
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

          {/* Paquete completo */}
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge color="green">Recomendado</Badge>
                  <span className="text-xs font-medium text-slate-500">
                    {catalog ? catalog.package.datasets.length : 17} hojas incluidas
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-800">
                  {catalog?.package.label || "Paquete operativo completo (Excel .xlsx)"}
                </h2>
                <p className="text-sm text-slate-600 max-w-2xl">
                  {catalog?.package.description ||
                    "Un solo archivo Excel con el resumen diario y cada tabla operativa en su propia hoja, listo para Power BI, Looker Studio o análisis en Excel."}
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => download("paquete-operativo", "xlsx", "Paquete operativo completo")}
                disabled={busy !== null || !rangeValid}
                className="inline-flex items-center gap-2 shrink-0"
              >
                <Download className="w-4 h-4" />
                {busy === "paquete-operativo-xlsx" ? "Generando Excel..." : "Descargar paquete (.xlsx)"}
              </Button>
            </div>
          </Card>

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
                  Genera un token de <strong>solo lectura</strong> para que tu dashboard descargue CSV, Excel o JSON sin
                  guardar tu contraseña. Si necesitas alcances granulares para SIIGO, Alegra, Odoo o Zoho, abre la pestaña{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("conectores")}
                    className="font-semibold text-emerald-700 underline"
                  >
                    Conectores ERP y API JSON
                  </button>
                  .
                </p>

                {activeToken ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-700">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Token activo ({tokens.length})
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
                      onClick={() => generateToken(true, "generic", ["read:finance", "read:inventory", "read:contacts", "read:production"])}
                      disabled={tokenBusy}
                      className="inline-flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${tokenBusy ? "animate-spin" : ""}`} />
                      {activeToken ? "Rotar token" : "Generar token"}
                    </Button>
                    {activeToken && (
                      <Button
                        variant="danger"
                        onClick={() => revokeTokens()}
                        disabled={tokenBusy}
                        className="inline-flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Revocar todos
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
                      directamente o registros JSON incrementales.
                    </p>
                    <pre className="overflow-x-auto rounded-lg bg-slate-900 text-slate-100 p-3 font-mono leading-relaxed">
{`TOKEN="glli_exp_tu_token"

# Resumen diario en CSV
curl -H "X-Export-Token: $TOKEN" \\
  "https://gallinero.iwage.co/api/export?dataset=resumen-diario&format=csv&from=2026-01-01&to=2026-11-14" \\
  -o resumen-diario.csv

# Dataset incremental en JSON con cursor
curl -H "X-Export-Token: $TOKEN" \\
  "https://gallinero.iwage.co/api/export?dataset=finanzas&format=json&updated_since=2026-11-01&limit=200"

# Paquete completo en Excel
curl -H "X-Export-Token: $TOKEN" \\
  "https://gallinero.iwage.co/api/export?dataset=paquete-operativo&format=xlsx" \\
  -o gallinero.xlsx`}
                    </pre>
                  </div>
                </details>
              </div>
            </div>
          </Card>
        </>
      )}

      {activeTab === "conectores" && (
        <div className="space-y-6">
          {/* Selector de perfil ERP */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">1. Selecciona el perfil de tu ERP o contabilidad</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Los endpoints de <code className="font-mono">/api/v1/integrations/*</code> adaptan automáticamente nombres de campos, tipos de documento y cuentas contables al software seleccionado.
                </p>
              </div>
              <Badge color="blue">Solo lectura · Multi-tenant</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              {profilesMeta.map((profile) => {
                const selected = activeProfile === profile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      setTokenProfile(profile.id);
                      if (mapping) {
                        setMapping({ ...mapping, defaultProfile: profile.id });
                      }
                    }}
                    className={`text-left rounded-xl border p-3.5 transition-all ${
                      selected
                        ? "border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-800">{profile.name}</span>
                      {selected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                    <p className="text-[11px] font-medium text-emerald-700 mt-1">{profile.subtitle}</p>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{profile.description}</p>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Mapeo contable y centros de costo */}
          {mapping && (
            <Card>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">2. Mapeo contable (PUC), impuestos y centros de costo</h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Define las cuentas contables e identificadores que recibirán SIIGO, Alegra, Odoo o Zoho al jalar transacciones e inventario.
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={saveMapping}
                  disabled={savingMapping}
                  className="inline-flex items-center gap-2 shrink-0"
                >
                  <Save className="w-4 h-4" />
                  {savingMapping ? "Guardando..." : "Guardar mapeo ERP"}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label="Moneda"
                  value={mapping.currency}
                  maxLength={8}
                  onChange={(e) => setMapping({ ...mapping, currency: e.target.value })}
                />
                <Input
                  label="Código comprobante SIIGO"
                  value={mapping.siigoDocumentCode}
                  maxLength={16}
                  onChange={(e) => setMapping({ ...mapping, siigoDocumentCode: e.target.value })}
                />
                <Input
                  label="Cuenta ingresos (PUC)"
                  value={mapping.incomeAccountCode}
                  maxLength={30}
                  onChange={(e) => setMapping({ ...mapping, incomeAccountCode: e.target.value })}
                />
                <Input
                  label="Cuenta gastos / costos (PUC)"
                  value={mapping.expenseAccountCode}
                  maxLength={30}
                  onChange={(e) => setMapping({ ...mapping, expenseAccountCode: e.target.value })}
                />
                <Input
                  label="Cuenta inventario (PUC)"
                  value={mapping.inventoryAccountCode}
                  maxLength={30}
                  onChange={(e) => setMapping({ ...mapping, inventoryAccountCode: e.target.value })}
                />
                <Input
                  label="Cuenta caja / bancos (PUC)"
                  value={mapping.cashOrBankAccountCode}
                  maxLength={30}
                  onChange={(e) => setMapping({ ...mapping, cashOrBankAccountCode: e.target.value })}
                />
                <Input
                  label="Cuenta clientes CxC (PUC)"
                  value={mapping.receivableAccountCode}
                  maxLength={30}
                  onChange={(e) => setMapping({ ...mapping, receivableAccountCode: e.target.value })}
                />
                <Input
                  label="Cuenta proveedores CxP (PUC)"
                  value={mapping.payableAccountCode}
                  maxLength={30}
                  onChange={(e) => setMapping({ ...mapping, payableAccountCode: e.target.value })}
                />
                <Input
                  label="Código impuesto / exención"
                  value={mapping.exemptTaxCode}
                  maxLength={40}
                  onChange={(e) => setMapping({ ...mapping, exemptTaxCode: e.target.value })}
                />
                <Input
                  label="Tarifa IVA (%)"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={String(mapping.taxRatePct)}
                  onChange={(e) => setMapping({ ...mapping, taxRatePct: Number(e.target.value) || 0 })}
                />
              </div>

              <div className="mt-5 pt-4 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                  Centros de costo por especie
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.keys(SPECIES_LABELS).map((sp) => (
                    <Input
                      key={sp}
                      label={SPECIES_LABELS[sp]}
                      value={mapping.costCentersBySpecies[sp] ?? ""}
                      maxLength={40}
                      onChange={(e) =>
                        setMapping({
                          ...mapping,
                          costCentersBySpecies: {
                            ...mapping.costCentersBySpecies,
                            [sp]: e.target.value,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Tokens con alcances y expiración */}
          <Card>
            <h2 className="text-base font-bold text-slate-800">3. Credenciales (Tokens con permisos granulares)</h2>
            <p className="text-xs text-slate-600 mt-1">
              Crea un token específico para cada sistema externo (por ejemplo uno para tu contador en SIIGO y otro para un flujo en n8n) limitando exactamente qué recursos puede leer.
            </p>

            {tokens.length > 0 && (
              <div className="mt-4 space-y-2">
                {tokens.map((tok) => (
                  <div
                    key={tok.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">{tok.name}</span>
                        <code className="font-mono text-slate-600">{tok.prefix}…</code>
                        <Badge color="blue">{tok.profile || "generic"}</Badge>
                        {tok.expiresAt && (
                          <span className="text-slate-500">Vence: {formatDate(tok.expiresAt)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(tok.scopes || []).map((sc) => (
                          <span key={sc} className="rounded bg-white border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                            {sc}
                          </span>
                        ))}
                        <span className="text-slate-500 ml-1">Último uso: {formatDate(tok.lastUsedAt)}</span>
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      onClick={() => revokeTokens(tok.id)}
                      disabled={tokenBusy}
                      className="inline-flex items-center gap-1.5 self-start sm:self-center shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Revocar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Input
                label="Nombre del conector"
                value={tokenName}
                maxLength={120}
                onChange={(e) => setTokenName(e.target.value)}
              />
              <Select
                label="Perfil ERP del token"
                value={tokenProfile}
                onChange={(e) => setTokenProfile(e.target.value as ErpProfile)}
              >
                <option value="siigo">SIIGO Nube</option>
                <option value="alegra">Alegra</option>
                <option value="odoo">Odoo Accounting</option>
                <option value="zoho">Zoho Books / Inventory</option>
                <option value="generic">API JSON Genérica</option>
              </Select>
              <Select
                label="Expiración"
                value={tokenExpiryDays}
                onChange={(e) => setTokenExpiryDays(e.target.value)}
              >
                <option value="30">30 días</option>
                <option value="90">90 días</option>
                <option value="365">1 año (recomendado)</option>
                <option value="0">Sin expiración</option>
              </Select>
            </div>

            <div className="mt-3">
              <p className="text-xs font-medium text-slate-700 mb-2">Alcances permitidos (scopes)</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SCOPE_LABELS) as IntegrationScope[]).map((scope) => {
                  const checked = tokenScopes.includes(scope);
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleScope(scope)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        checked
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${checked ? "opacity-100" : "opacity-25"}`} />
                      <span>{SCOPE_LABELS[scope]}</span>
                      <code className="text-[10px] text-slate-500">({scope})</code>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => generateToken(false)}
                disabled={tokenBusy}
                className="inline-flex items-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                Crear token adicional
              </Button>
              {tokens.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => generateToken(true)}
                  disabled={tokenBusy}
                  className="inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${tokenBusy ? "animate-spin" : ""}`} />
                  Reemplazar todos y rotar
                </Button>
              )}
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
          </Card>

          {/* Probador en vivo + ejemplos curl */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-700" />
                  4. Probar respuesta JSON y copiar consulta cURL
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Verifica exactamente cómo entrega los campos tu perfil activo (<code className="font-mono">{activeProfile}</code>) usando tu sesión actual.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Select
                  label="Endpoint"
                  value={testEndpointId}
                  onChange={(e) => setTestEndpointId(e.target.value)}
                >
                  {TEST_ENDPOINTS.map((ep) => (
                    <option key={ep.id} value={ep.id}>{ep.label}</option>
                  ))}
                </Select>
                <Button
                  variant="primary"
                  onClick={runLiveEndpointTest}
                  disabled={testLoading}
                  className="inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${testLoading ? "animate-spin" : ""}`} />
                  {testLoading ? "Consultando..." : "Probar endpoint"}
                </Button>
              </div>
            </div>

            <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-xs leading-relaxed">
{`curl -H "Authorization: Bearer glli_exp_tu_token" \\
  "https://gallinero.iwage.co${sampleEndpointPath}"`}
            </pre>

            {testPreview && (
              <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
                {testPreview}
              </pre>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
