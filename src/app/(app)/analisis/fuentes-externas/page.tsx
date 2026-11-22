"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Globe, RefreshCw, MapPin, CloudSun, TrendingUp, ShieldAlert, Landmark, Cpu, TableProperties, KeyRound, Copy, Check } from "lucide-react";
import { Badge, Button, Card, HeroActionButton, HeroActionLink, PageHeader, Select } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { COLOMBIA_DIVIPOLA_CATALOG } from "@/lib/divipola-catalog";

interface SyncScheduleItem {
  sourceKey: string;
  label: string;
  domainLabel: string;
  periodHours: number;
  periodLabel: string;
  status: string;
  providerName: string;
  summary: string | null;
  fetchedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  coverageScope: "local" | "regional" | "nacional";
  coverageLabel: string;
}

interface SnapshotRecord {
  id: string;
  sourceKey: string;
  status: string;
  providerName: string;
  sourceUrl: string | null;
  payload: Record<string, unknown>;
  summary: string | null;
  fetchedAt: string;
  expiresAt: string | null;
  lastError: string | null;
}

interface WeatherForecastDay {
  date: string;
  maxTempC: number;
  minTempC: number;
  humidityPct: number;
  maxIth: number;
  precipitationMm: number;
}

interface WeatherPayload {
  locationLabel: string;
  coverageScope: "local" | "regional" | "nacional";
  coverageLabel: string;
  periodLabel: string;
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  currentTempC: number;
  currentHumidityPct: number;
  apparentTempC: number;
  windSpeedKmh: number;
  precipitationMm: number;
  currentIth: number;
  thermalStressLevel: string;
  feedIntakeFactor: number;
  feedIntakeNote: string;
  ntc1240StorageRisk: { outOfRange: boolean; reason: string | null };
  forecast: WeatherForecastDay[];
  recommendation: string;
}

interface MarketPricesPayload {
  schemaVersion: number;
  regionDepartment: string;
  coverageScope: "local" | "regional" | "nacional";
  coverageLabel: string;
  periodLabel: string;
  trmCopPerUsd: number;
  trmDate: string;
  sourceStatus: { sipsa: string; trm: string };
  sipsaSampleRows: Array<{
    recordId: string;
    productCode: string;
    product: string;
    city: string;
    capturedAt: string;
    averagePriceCop: number;
    unit: string | null;
  }>;
  note: string;
}

interface EpidemiologicalAlertItem {
  id: string;
  department: string;
  disease: string;
  speciesAffected: string[];
  riskLevel: "alto" | "medio" | "vigilancia";
  authority: string;
  resolutionRef: string;
  recommendation: string;
  active: boolean;
}

interface ColombianHoliday {
  date: string;
  name: string;
  localName: string;
  type: string;
}

interface IotStatusPayload {
  webhookConfigured: boolean;
  webhookEndpoint: string;
  readingsLast24h: number;
  alertsLast24h: number;
  activeDevices: string[];
  latestReadingAt: string | null;
  maxIthLast24h: number | null;
  latestTempC: number | null;
}

interface ExternalControlState {
  snapshots: SnapshotRecord[];
  syncSchedule: SyncScheduleItem[];
  activeZone: {
    country: string;
    department: string;
    city: string;
    daneCode: string;
    region: string;
    matchedDepartment: string;
    thermalFloor: string;
    altitudeMeters: number;
    nearestMarketHub: string;
    coverageScope: "local" | "regional" | "nacional";
    coverageLabel: string;
    periodLabel: string;
    weatherCoverageLabel: string;
    marketCoverageLabel: string;
    icaCoverageLabel: string;
  };
  standardsFeedVersion: string;
  epidemiologicalAlerts: EpidemiologicalAlertItem[];
  colombianHolidays: ColombianHoliday[];
  taxContext: {
    year: number;
    uvtCop: number;
    reteComprasThresholdUvt: number;
    reteAgroThresholdUvt: number;
    retentionPurchasesThresholdCop: number;
    retentionAgroThresholdCop: number;
    finagroIbrEaPct: number;
    finagroLines: Array<{ segment: string; rateNote: string; termNote: string }>;
    nextHoliday: ColombianHoliday | null;
    holidaysCount: number;
  };
  iotStatus: IotStatusPayload | null;
}

function formatCop(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Pendiente";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

function CoverageBadge({ scope }: { scope?: string }) {
  if (scope === "local") return <Badge color="green">Zona local exacta</Badge>;
  if (scope === "regional") return <Badge color="yellow">Promedio regional</Badge>;
  return <Badge color="blue">Promedio nacional (último periodo)</Badge>;
}

function StatusBadge({ status, expired }: { status: string; expired?: boolean }) {
  if (expired) return <Badge color="yellow">Pendiente de renovación</Badge>;
  if (status === "ok") return <Badge color="green">Actualizado en línea</Badge>;
  if (status === "fallback") return <Badge color="blue">Referencia local</Badge>;
  return <Badge color="red">Requiere revisión</Badge>;
}

export default function FuentesExternasControlPage() {
  const [state, setState] = useState<ExternalControlState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [selectedDane, setSelectedDane] = useState("25286");
  const [iotTokenInfo, setIotTokenInfo] = useState<{
    farmCode: string;
    configured: boolean;
    tokenPrefix: string | null;
    rawToken?: string | null;
  } | null>(null);
  const [rotatingIotToken, setRotatingIotToken] = useState(false);
  const [copiedIotSnippet, setCopiedIotSnippet] = useState(false);

  const loadState = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/configuracion/fuentes-externas${forceRefresh ? "?refresh=1" : ""}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error al cargar monitoreo externo");
      setState(json);
      if (json?.activeZone?.daneCode && json.activeZone.daneCode !== "00000") {
        setSelectedDane(json.activeZone.daneCode);
      }
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "No fue posible consultar las fuentes externas",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadState(false));
    apiFetch("/api/operaciones/sensores/token")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.farmCode) {
          setIotTokenInfo({
            farmCode: String(json.farmCode),
            configured: Boolean(json.configured),
            tokenPrefix: typeof json.tokenPrefix === "string" ? json.tokenPrefix : null,
            rawToken: null,
          });
        }
      })
      .catch(() => undefined);
  }, [loadState]);

  const handleRotateIotToken = useCallback(async () => {
    setRotatingIotToken(true);
    setNotice(null);
    try {
      const res = await apiFetch("/api/operaciones/sensores/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "No se pudo emitir el token IoT de la granja");
      }
      setIotTokenInfo({
        farmCode: String(json.farmCode),
        configured: Boolean(json.configured),
        tokenPrefix: typeof json.tokenPrefix === "string" ? json.tokenPrefix : null,
        rawToken: typeof json.rawToken === "string" ? json.rawToken : null,
      });
      setNotice({
        type: "ok",
        text: "Nuevo token IoT emitido para esta granja. Guárdalo ahora; no se mostrará completo otra vez.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Error emitiendo credencial IoT",
      });
    } finally {
      setRotatingIotToken(false);
    }
  }, []);

  const handleCopyIotConfig = useCallback(async () => {
    if (!iotTokenInfo) return;
    const tokenPlaceholder = iotTokenInfo.rawToken || `${iotTokenInfo.tokenPrefix || "iwg_iot_"}...`;
    const snippet = [
      `Endpoint: POST /api/operaciones/sensores`,
      `Header x-farm-code: ${iotTokenInfo.farmCode}`,
      `Header x-sensor-token: ${tokenPlaceholder}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedIotSnippet(true);
      setTimeout(() => setCopiedIotSnippet(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  }, [iotTokenInfo]);

  const runAction = useCallback(
    async (actionKey: string, payload: Record<string, unknown>, successText: string) => {
      setBusyAction(actionKey);
      setNotice(null);
      try {
        const res = await apiFetch("/api/configuracion/fuentes-externas", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "No se pudo completar la operación");
        setState(json);
        if (json?.activeZone?.daneCode && json.activeZone.daneCode !== "00000") {
          setSelectedDane(json.activeZone.daneCode);
        }
        setNotice({ type: "ok", text: successText });
      } catch (err) {
        setNotice({
          type: "error",
          text: err instanceof Error ? err.message : "Error ejecutando acción",
        });
      } finally {
        setBusyAction(null);
      }
    },
    [],
  );

  const snapshotsByKey = useMemo(() => {
    const map = new Map<string, SnapshotRecord>();
    for (const s of state?.snapshots || []) map.set(s.sourceKey, s);
    return map;
  }, [state]);

  const weather = snapshotsByKey.get("open_meteo")?.payload as WeatherPayload | undefined;
  const market = snapshotsByKey.get("dane_sipsa_trm")?.payload as MarketPricesPayload | undefined;
  const icaSourceLive = snapshotsByKey.get("ica_vademecum_alerts")?.status === "ok";
  const upcomingHolidays = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (state?.colombianHolidays || []).filter((h) => h.date >= today).slice(0, 5);
  }, [state]);

  return (
    <div className="space-y-6">
      <PageHeader
        theme="analisis"
        icon={<Globe className="w-4 h-4 text-emerald-200" />}
        title="Clima, Mercado y Entorno Operativo"
        description="Consulte el clima, observaciones de precios oficiales por ciudad y referencias locales. Cada valor se conserva con su fuente y fecha; los datos sin equivalencia comprobada no se convierten en precios maestros ni costos operativos."
        help={[
          "• Clima e ITH en galpón: alerta si la temperatura y humedad pueden causar estrés calórico o riesgo de frío, ajustando la predicción de alimento y condiciones de bodega NTC 1240.",
          "• SIPSA y TRM: muestra los datos publicados por el servicio del DANE y la TRM de la Superintendencia Financiera; no extrapola precios ni modifica catálogos automáticamente.",
          "• Sanidad, calendario y sensores: las referencias ICA y tributarias locales aún requieren validación directa de su entidad; las lecturas de galpón sí provienen de sensores o del puente climático.",
        ].join("\n")}
        actions={
          <>
            <HeroActionLink href="/configuracion/catalogos?tab=fuentes" tone="glass">
              <TableProperties className="w-3.5 h-3.5" />
              <span>Ver tablas maestras en Catálogos</span>
            </HeroActionLink>
            <HeroActionButton
              tone="solid"
              disabled={busyAction !== null}
              onClick={() =>
                runAction(
                  "sync_all",
                  { action: "sync_all" },
                  "Fuentes climáticas, de mercado, sanidad y entorno actualizadas para su zona.",
                )
              }
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busyAction === "sync_all" ? "animate-spin" : ""}`} />
              <span>{busyAction === "sync_all" ? "Sincronizando..." : "Sincronizar todas las fuentes"}</span>
            </HeroActionButton>
          </>
        }
      />

      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading && !state ? (
        <Card>
          <p className="py-10 text-center text-sm text-slate-500">
            Cargando monitoreo climático, precios de referencia y vigilancia externa de la granja...
          </p>
        </Card>
      ) : state ? (
        <>
          {/* Zona activa de la granja + cascada de resolución */}
          <Card className="border-l-4 border-l-emerald-600">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <h2 className="text-base font-bold text-slate-900">
                    Ubicación operativa de la granja: {state.activeZone.city}, {state.activeZone.department}
                  </h2>
                  <CoverageBadge scope={state.activeZone.coverageScope} />
                </div>
                <p className="text-xs text-slate-600">
                  {state.activeZone.coverageLabel} · Piso térmico{" "}
                  <strong>{state.activeZone.thermalFloor}</strong> ({state.activeZone.altitudeMeters} msnm) · Plaza
                  mayorista de referencia: <strong>{state.activeZone.nearestMarketHub}</strong>. Si no existe registro
                  municipal directo, el sistema aplica automáticamente el promedio regional o el promedio nacional del
                  último periodo disponible.
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-2 shrink-0">
                <div className="min-w-[260px]">
                  <Select
                    label="Cambiar municipio oficial (DIVIPOLA)"
                    value={selectedDane}
                    onChange={(e) => setSelectedDane(e.target.value)}
                  >
                    {COLOMBIA_DIVIPOLA_CATALOG.map((m) => (
                      <option key={m.daneCode} value={m.daneCode}>
                        {m.municipality} — {m.department} ({m.altitudeMeters} m)
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  disabled={busyAction !== null}
                  onClick={() =>
                    runAction(
                      "apply_divipola",
                      { action: "apply_divipola", codeOrCity: selectedDane },
                      "Ubicación actualizada y datos climáticos, comerciales y sanitarios recargados para la zona.",
                    )
                  }
                >
                  {busyAction === "apply_divipola" ? "Aplicando..." : "Aplicar ubicación"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Programación automática por periodos */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Frecuencia de actualización automática por fuente
                </h3>
                <p className="text-xs text-slate-500">
                  Cada fuente se actualiza automáticamente al vencerse su periodo o al cambiar la ubicación de la granja.
                </p>
              </div>
              <Link
                href="/configuracion/catalogos?tab=parametros"
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Ajustar ubicación o intervalos en Parámetros →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Fuente operativa</th>
                    <th className="py-2 pr-3 font-semibold">Frecuencia automática</th>
                    <th className="py-2 pr-3 font-semibold">Cobertura aplicada</th>
                    <th className="py-2 pr-3 font-semibold">Última actualización</th>
                    <th className="py-2 pr-3 font-semibold">Estado</th>
                    <th className="py-2 text-right font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.syncSchedule.map((item) => (
                    <tr key={item.sourceKey}>
                      <td className="py-2 pr-3">
                        <p className="font-semibold text-slate-800">{item.label}</p>
                        {item.providerName && <p className="text-[11px] text-slate-500">{item.providerName}</p>}
                        {item.summary && <p className="text-[11px] text-slate-500 line-clamp-1">{item.summary}</p>}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap font-medium text-slate-700">{item.periodLabel}</td>
                      <td className="py-2 pr-3">
                        <CoverageBadge scope={item.coverageScope} />
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                        {formatDateTime(item.fetchedAt)}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <StatusBadge status={item.status} expired={item.isExpired} />
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() =>
                            runAction(
                              `sync_${item.sourceKey}`,
                              { action: "sync_source", sourceKey: item.sourceKey },
                              `Actualizado: ${item.label}.`,
                            )
                          }
                          className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          {busyAction === `sync_${item.sourceKey}` ? "Sincronizando..." : "Actualizar ahora"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Clima en galpón e ITH + Pronóstico */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <CloudSun className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Clima en galpón, Índice de Estrés Térmico (ITH) y Pronóstico 7 días
                  </h3>
                  <p className="text-xs text-slate-500">
                    {weather?.coverageLabel || state.activeZone.weatherCoverageLabel}
                  </p>
                </div>
              </div>
              <CoverageBadge scope={weather?.coverageScope || state.activeZone.coverageScope} />
            </div>

            {weather ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Temperatura actual</p>
                    <p className="text-xl font-bold text-slate-900">{weather.currentTempC} °C</p>
                    <p className="text-[11px] text-slate-500">Sensación {weather.apparentTempC} °C</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Humedad relativa</p>
                    <p className="text-xl font-bold text-slate-900">{weather.currentHumidityPct}%</p>
                    <p className="text-[11px] text-slate-500">Viento {weather.windSpeedKmh} km/h</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Índice ITH</p>
                    <p className="text-xl font-bold text-slate-900">{weather.currentIth}</p>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {weather.thermalStressLevel.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Ajuste de consumo esperado</p>
                    <p className="text-xl font-bold text-slate-900">
                      {Math.round(weather.feedIntakeFactor * 100)}%
                    </p>
                    <p className="text-[11px] text-slate-500">Bodega NTC 1240: {weather.ntc1240StorageRisk?.outOfRange ? "Vigilar" : "Normal"}</p>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50/70 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-950">
                  <strong>Recomendación en campo:</strong> {weather.recommendation} {weather.feedIntakeNote}.
                  {weather.ntc1240StorageRisk?.outOfRange && weather.ntc1240StorageRisk.reason
                    ? ` Alerta bodega de huevo: ${weather.ntc1240StorageRisk.reason}.`
                    : ""}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {(weather.forecast || []).slice(0, 7).map((day) => (
                    <div
                      key={day.date}
                      className={`rounded-lg border p-2.5 text-xs ${
                        day.maxIth >= 75
                          ? "border-red-200 bg-red-50/70"
                          : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <p className="font-semibold text-slate-800">{day.date.slice(5)}</p>
                      <p className="text-slate-700 mt-1">
                        {day.minTempC}° / <strong>{day.maxTempC}°C</strong>
                      </p>
                      <p className="text-[11px] text-slate-500">ITH máx {day.maxIth}</p>
                      <p className="text-[11px] text-slate-500">Lluvia {day.precipitationMm} mm</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sin lecturas climáticas cargadas aún.</p>
            )}
          </Card>

          {/* Precios mayoristas de la zona vs granja */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Precios mayoristas de referencia e insumos para la zona
                  </h3>
                  <p className="text-xs text-slate-500">
                    {market?.coverageLabel || state.activeZone.marketCoverageLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CoverageBadge scope={market?.coverageScope || state.activeZone.coverageScope} />
                <Badge color={market?.sourceStatus?.sipsa === "ok" ? "green" : "yellow"}>
                  DANE SIPSA: {market?.sourceStatus?.sipsa === "ok" ? "actualizado" : "referencia pendiente"}
                </Badge>
              </div>
            </div>

            {market ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">TRM certificada por SFC</p>
                    <p className="text-lg font-bold text-slate-900">{market.trmCopPerUsd > 0 ? formatCop(market.trmCopPerUsd) : "—"}</p>
                    <p className="text-[11px] text-slate-500">Fecha: {market.trmDate || "sin dato vigente"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Observaciones SIPSA disponibles</p>
                    <p className="text-lg font-bold text-slate-900">{market.sipsaSampleRows.length}</p>
                    <p className="text-[11px] text-slate-500">
                      {market.sipsaSampleRows.some((row) => row.unit)
                        ? "El anexo diario DANE informa valores en COP/kg"
                        : "La unidad no se informa en el servicio web"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Cobertura</p>
                    <p className="text-sm font-semibold text-slate-900">{market.coverageLabel}</p>
                    <p className="text-[11px] text-slate-500">Actualización SIPSA: {market.periodLabel}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600">{market.note}</p>
                {market.sipsaSampleRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-500">
                          <th className="py-2 pr-3">Producto</th>
                          <th className="py-2 pr-3">Ciudad</th>
                          <th className="py-2 pr-3">Fecha</th>
                          <th className="py-2 pr-3 text-right">Valor informado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {market.sipsaSampleRows.slice(0, 12).map((row) => (
                          <tr key={row.recordId}>
                            <td className="py-2 pr-3 font-medium text-slate-900">{row.product}</td>
                            <td className="py-2 pr-3 text-slate-600">{row.city}</td>
                            <td className="py-2 pr-3 text-slate-600">{row.capturedAt.slice(0, 10)}</td>
                            <td className="py-2 pr-3 text-right">
                              {formatCop(row.averagePriceCop)} <span className="text-slate-500">{row.unit || "(unidad no informada)"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">El servicio oficial no devolvió observaciones SIPSA utilizables.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sin datos de precios cargados.</p>
            )}
          </Card>

          {/* Grid inferior: Sanidad ICA + Calendario/DIAN/Finagro + IoT */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vigilancia epidemiológica ICA */}
            <Card>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Vigilancia epidemiológica regional ICA
                  </h3>
                </div>
                <Badge color={icaSourceLive ? "green" : "yellow"}>
                  {state.epidemiologicalAlerts.length} {icaSourceLive ? "verificadas" : "referencias locales"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mb-3">{state.activeZone.icaCoverageLabel}</p>
              {!icaSourceLive && (
                <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2 mb-3">
                  Catálogo local sin conexión automática a ICA. Confirme cualquier alerta vigente en el
                  {" "}<a className="underline font-semibold" href="https://www.ica.gov.co/areas/pecuaria/servicios/epidemiologia-veterinaria" target="_blank" rel="noreferrer">boletín epidemiológico oficial</a>.
                </p>
              )}
              <div className="space-y-2.5">
                {state.epidemiologicalAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-slate-200 p-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{alert.disease}</span>
                      <Badge
                        color={
                          alert.riskLevel === "alto"
                            ? "red"
                            : alert.riskLevel === "medio"
                              ? "yellow"
                              : "blue"
                        }
                      >
                        {alert.department} · {alert.riskLevel}
                      </Badge>
                    </div>
                    <p className="text-slate-600">{alert.recommendation}</p>
                    <p className="text-[11px] text-slate-400">
                      {alert.authority} · {alert.resolutionRef}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Calendario festivos, DIAN / Finagro + Puente IoT */}
            <div className="space-y-6">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Landmark className="w-5 h-5 text-blue-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    Festivos de referencia y parámetros fiscales/financieros ({state.taxContext.year})
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <p className="text-slate-500">UVT configurada / Tope agro ({state.taxContext.reteAgroThresholdUvt} UVT)</p>
                    <p className="font-bold text-slate-900">
                      {formatCop(state.taxContext.uvtCop)} · {formatCop(state.taxContext.retentionAgroThresholdCop)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2.5">
                    <p className="text-slate-500">Tasa guardada en Datos Maestros</p>
                    <p className="font-bold text-slate-900">{state.taxContext.finagroIbrEaPct}% E.A.</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  La UVT, los topes y la tasa se leen de Datos Maestros; esta pantalla aún no los actualiza directamente desde DIAN o Finagro. Los festivos se contrastan con un proveedor no oficial y la regla legal local.
                </p>
                <p className="text-xs font-semibold text-slate-700 mb-1.5">Próximos festivos oficiales en Colombia</p>
                <div className="flex flex-wrap gap-1.5">
                  {upcomingHolidays.map((h) => (
                    <Badge key={h.date} color="gray">
                      {h.date}: {h.localName}
                    </Badge>
                  ))}
                </div>
              </Card>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-700" />
                    <h3 className="text-base font-bold text-slate-900">Puente de sensores y telemetría</h3>
                  </div>
                  <Badge color={state.iotStatus?.webhookConfigured ? "green" : "blue"}>
                    {state.iotStatus?.readingsLast24h ?? 0} lecturas (24 h)
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  Endpoint receptor <code className="bg-slate-100 px-1 rounded">{state.iotStatus?.webhookEndpoint || "/api/operaciones/sensores"}</code> ·
                  Alertas últimas 24 h: <strong>{state.iotStatus?.alertsLast24h ?? 0}</strong> · ITH máx registrado:{" "}
                  <strong>{state.iotStatus?.maxIthLast24h ?? "—"}</strong>.
                </p>

                {iotTokenInfo && (
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <KeyRound className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                          <span>Código granja (`x-farm-code`):</span>
                        </span>
                        <code className="rounded bg-white border border-slate-200 px-2 py-0.5 font-mono font-bold tracking-wider text-slate-900">
                          {iotTokenInfo.farmCode}
                        </code>
                        <Badge color={iotTokenInfo.configured ? "green" : "yellow"}>
                          {iotTokenInfo.configured
                            ? `Token activo (${iotTokenInfo.tokenPrefix}…)`
                            : "Sin token propio"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                          disabled={rotatingIotToken}
                          onClick={() => void handleRotateIotToken()}
                        >
                          {rotatingIotToken
                            ? "Generando…"
                            : iotTokenInfo.configured
                              ? "Rotar token IoT"
                              : "Generar token IoT"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2.5 py-1 text-xs inline-flex items-center gap-1"
                          onClick={() => void handleCopyIotConfig()}
                        >
                          {copiedIotSnippet ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                          <span>{copiedIotSnippet ? "Copiado" : "Copiar cabecera"}</span>
                        </Button>
                      </div>
                    </div>
                    {iotTokenInfo.rawToken && (
                      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-emerald-950">
                        <p className="font-semibold mb-1">
                          Token secreto recién emitido (cópialo ahora, solo se muestra esta vez):
                        </p>
                        <code className="block break-all rounded bg-white px-2 py-1 font-mono text-[11px] border border-emerald-200">
                          x-farm-code: {iotTokenInfo.farmCode} · x-sensor-token: {iotTokenInfo.rawToken}
                        </code>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  className="px-3 py-1.5 text-xs"
                  variant="secondary"
                  disabled={busyAction !== null}
                  onClick={() =>
                    runAction(
                      "bridge_weather",
                      { action: "bridge_weather_to_sensors" },
                      "Lectura climática zonal registrada como telemetría ambiental del galpón.",
                    )
                  }
                >
                  {busyAction === "bridge_weather" ? "Registrando..." : "Registrar lectura climática en sensores"}
                </Button>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
