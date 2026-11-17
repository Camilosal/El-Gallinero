"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Globe, MapPin, RefreshCw } from "lucide-react";
import { Badge, Button, Card, EmptyState, Select } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import OfficialCsvImportPanel from "./OfficialCsvImportPanel";
import OfficialIdeamCsvImportPanel from "./OfficialIdeamCsvImportPanel";
import SipsaProductMappingPanel from "./SipsaProductMappingPanel";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { COLOMBIA_DEPARTMENTS, type DivipolaMunicipality } from "@/lib/divipola-catalog";
import type { SipsaIProductMappings } from "@/lib/external-sources/sipsa-product-mapping";

interface RegionalMarketRow {
  recordId: string;
  productCode: string;
  product: string;
  city: string;
  capturedAt: string;
  averagePriceCop: number;
  unit: string | null;
}

interface MarketPricesPayload {
  regionDepartment: string;
  coverageScope: "local" | "regional" | "nacional";
  coverageLabel: string;
  periodLabel: string;
  trmCopPerUsd: number;
  trmDate: string;
  regionalPrices?: RegionalMarketRow[];
}

interface IcaVademecumItem {
  id: string;
  commercialName: string;
  activeIngredient: string;
  icaRegistration: string;
  laboratory: string;
  category: string;
  species: string[];
  route: string;
  withdrawalDaysMeat: number;
  withdrawalDaysEggs: number;
  contraindicatedInLayingHens: boolean;
  notes: string;
}

interface FednaNutritionRef {
  species: string;
  speciesLabel: string;
  stage: string;
  crudeProteinPct: string;
  metabolizableEnergyKcalKg: number;
  calciumPct: string;
  phosphorusPct: string;
  dailyIntakeG: string;
  source: string;
}

interface ColombianHoliday {
  date: string;
  name: string;
  localName: string;
  type: string;
}

interface SnapshotRecord {
  sourceKey: string;
  status: string;
  fetchedAt: string;
  expiresAt?: string | null;
  summary?: string | null;
  sourceUrl?: string | null;
  payload: Record<string, unknown>;
  lastError?: string | null;
}

interface ExternalObservationRecord {
  id: string;
  observationKey: string;
  observedAt: string;
  value: string;
  unit: string | null;
  dimensions: Record<string, unknown>;
  providerName: string;
}

interface BanrepSeriesRecord {
  flowId: string;
  label: string;
  unitLabel: string;
  status: "ok" | "fallback" | "error";
  sourceUrl: string;
  observations: Array<{
    period: string;
    value: number;
    measure: string;
    unitMeasure: string;
    frequency: string;
  }>;
  lastError: string | null;
}

interface BanrepSeriesOption {
  flowId: string;
  label: string;
  unitLabel: string;
}

interface IdeamHydroAlertRecord {
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

interface SourceScheduleRecord {
  sourceKey: string;
  isExpired: boolean;
}

interface ExternalMasterTablesState {
  snapshots: SnapshotRecord[];
  syncSchedule: SourceScheduleRecord[];
  marketHistory?: ExternalObservationRecord[];
  banrepHistory?: ExternalObservationRecord[];
  sipsaIHistory?: ExternalObservationRecord[];
  sipsaIProductMappings?: SipsaIProductMappings;
  sipsaIPurchaseProducts?: Array<{
    id: string;
    name: string;
    expenseCategory: string;
    defaultPresentation: string | null;
    defaultUnit: string;
  }>;
  daneIndexHistory?: ExternalObservationRecord[];
  daneLaborHistory?: ExternalObservationRecord[];
  banrepMacro: {
    schemaVersion: number;
    series: BanrepSeriesRecord[];
    note: string;
  };
  banrepSeriesCatalog: BanrepSeriesOption[];
  selectedBanrepFlowIds: string[];
  ideamHydroAlerts: {
    datasetId: string;
    datasetName: string;
    metadataUpdatedAt: string | null;
    alerts: IdeamHydroAlertRecord[];
    note: string;
  };
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
  };
  standardsFeedVersion: string;
  divipolaCatalog: DivipolaMunicipality[];
  icaVademecum: IcaVademecumItem[];
  nutritionTables: FednaNutritionRef[];
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
  };
}

type MasterTableKey = "divipola" | "precios" | "insumos" | "macroeconomia" | "labor" | "riesgos" | "vademecum" | "nutricion" | "calendario";

const TABLE_TABS: Array<{ key: MasterTableKey; label: string }> = [
  { key: "divipola", label: "Municipios DIVIPOLA" },
  { key: "precios", label: "Precios SIPSA-P y TRM SFC" },
  { key: "insumos", label: "Costos de insumos SIPSA-I" },
  { key: "macroeconomia", label: "Macroeconomía y tasas" },
  { key: "labor", label: "Mercado laboral GEIH" },
  { key: "riesgos", label: "Alertas IDEAM" },
  { key: "vademecum", label: "Vademécum ICA y Retiros" },
  { key: "nutricion", label: "Nutrición FEDNA/NRC y Genética" },
  { key: "calendario", label: "Festivos y parámetros fiscales/financieros" },
];

function formatCop(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

export default function FuentesExternasTab() {
  const [state, setState] = useState<ExternalMasterTablesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [activeTable, setActiveTable] = useState<MasterTableKey>("divipola");
  const [draftBanrepFlowIds, setDraftBanrepFlowIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/configuracion/fuentes-externas");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error al cargar tablas maestras externas");
      const nextState = json as ExternalMasterTablesState;
      setState(nextState);
      setDraftBanrepFlowIds(nextState.selectedBanrepFlowIds || []);
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Error cargando tablas externas",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (typeof window !== "undefined") {
        const tableParam = new URLSearchParams(window.location.search).get("table");
        if (
          tableParam === "divipola" ||
          tableParam === "precios" ||
          tableParam === "insumos" ||
          tableParam === "macroeconomia" ||
          tableParam === "riesgos" ||
          tableParam === "vademecum" ||
          tableParam === "nutricion" ||
          tableParam === "calendario"
        ) {
          setActiveTable(tableParam);
        }
      }
      return loadState();
    });
  }, [loadState]);

  const runAction = useCallback(
    async (actionKey: string, payload: Record<string, unknown>, successText: string) => {
      setBusyAction(actionKey);
      setNotice(null);
      try {
        const res = await apiFetch("/api/configuracion/fuentes-externas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Error ejecutando actualización");
        const nextState = json as ExternalMasterTablesState;
        setState(nextState);
        setDraftBanrepFlowIds(nextState.selectedBanrepFlowIds || []);
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

  const marketPayload = useMemo(() => {
    const snap = state?.snapshots.find((s) => s.sourceKey === "dane_sipsa_trm");
    return snap?.payload as MarketPricesPayload | undefined;
  }, [state]);
  const ideamSnapshot = state?.snapshots.find((s) => s.sourceKey === "ideam_hydro_alerts");
  const ideamSchedule = state?.syncSchedule.find((s) => s.sourceKey === "ideam_hydro_alerts");
  const sipsaIImportSnapshot = state?.snapshots.find((s) => s.sourceKey === "dane_sipsa_i");
  const ipcImportSnapshot = state?.snapshots.find((s) =>
    s.sourceKey === "dane_price_indices" && String(s.payload.sourceType) === "ipc",
  );
  const ippImportSnapshot = state?.snapshots.find((s) =>
    s.sourceKey === "dane_price_indices" && String(s.payload.sourceType) === "ipp",
  );
  const geihSnapshot = state?.snapshots.find((s) => s.sourceKey === "dane_labor_geih");
  const geihSchedule = state?.syncSchedule.find((s) => s.sourceKey === "dane_labor_geih");

  const filteredMunicipalities = useMemo(() => {
    const list = state?.divipolaCatalog || [];
    return list.filter((m) => {
      if (deptFilter && m.department !== deptFilter) return false;
      return matchesTextQuery(search, [
        m.daneCode,
        m.municipality,
        m.department,
        m.region,
        m.thermalFloor,
        m.nearestMarketHub,
      ]);
    });
  }, [state, search, deptFilter]);

  const filteredRegionalPrices = useMemo(() => {
    const rows = marketPayload?.regionalPrices || [];
    return rows.filter((r) =>
      matchesTextQuery(search, [r.product, r.city, r.productCode, r.capturedAt]),
    );
  }, [marketPayload, search]);

  const filteredVademecum = useMemo(() => {
    const list = state?.icaVademecum || [];
    return list.filter((v) =>
      matchesTextQuery(search, [
        v.commercialName,
        v.activeIngredient,
        v.icaRegistration,
        v.laboratory,
        v.category,
        ...v.species,
      ]),
    );
  }, [state, search]);

  const filteredNutrition = useMemo(() => {
    const list = state?.nutritionTables || [];
    return list.filter((n) =>
      matchesTextQuery(search, [n.speciesLabel, n.stage, n.source]),
    );
  }, [state, search]);

  const filteredHolidays = useMemo(() => {
    const list = state?.colombianHolidays || [];
    return list.filter((h) => matchesTextQuery(search, [h.date, h.localName, h.name, h.type]));
  }, [state, search]);

  if (loading && !state) {
    return (
      <Card>
        <p className="py-10 text-center text-sm text-slate-500">
          Cargando referencias territoriales, de mercado, macroeconomía y riesgo climático...
        </p>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card>
        <EmptyState
          icon="globe"
          message={notice?.text || "No se pudieron cargar las tablas maestras externas en este momento."}
        />
        <div className="mt-4 flex justify-center">
          <Button onClick={loadState} variant="primary">
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen operativo y enlace directo a la Hoja de Control */}
      <Card className="border-l-4 border-l-emerald-600">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-700" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                Tablas maestras externas sincronizadas para la operación
              </h2>
              <Badge
                color={
                  state.activeZone.coverageScope === "local"
                    ? "green"
                    : state.activeZone.coverageScope === "regional"
                      ? "yellow"
                      : "blue"
                }
              >
                {state.activeZone.coverageLabel}
              </Badge>
            </div>
            <p className="text-xs text-slate-600 max-w-3xl">
              Consulte datos territoriales, observaciones externas y referencias locales. Los precios SIPSA se muestran
              con el producto, ciudad y fecha publicados, sin conversiones automáticas. Las alertas hidrológicas IDEAM
              y las series macroeconómicas del Banco se consultan desde sus fuentes oficiales, pero no cambian
              automáticamente los maestros. Las referencias ICA, nutricionales y varios parámetros fiscales siguen
              requiriendo revisión directa de sus entidades responsables. Para ver la frescura de las fuentes, abra la
              Hoja de Control en Análisis.
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-600 pt-1">
              <span>
                <strong>Ubicación activa:</strong>{" "}
                {state.activeZone.city || "Sin municipio"},{" "}
                {state.activeZone.department || "Cundinamarca"} (DANE{" "}
                {state.activeZone.daneCode || "25286"} · {state.activeZone.altitudeMeters} msnm ·{" "}
                {state.activeZone.thermalFloor})
              </span>
              <span>
                <strong>Central de abastos ref.:</strong> {state.activeZone.nearestMarketHub}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/analisis/fuentes-externas"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
            >
              <span>Abrir Hoja de Control en Análisis</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
            <Button
              disabled={busyAction !== null}
              onClick={() =>
                runAction(
                  "sync_all",
                  { action: "sync_all" },
                "Fuentes externas conectadas consultadas para la ubicación de la granja.",
                )
              }
              className="text-xs px-3 py-2"
            >
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw
                  className={`w-3.5 h-3.5 ${busyAction === "sync_all" ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {busyAction === "sync_all" ? "Actualizando..." : "Actualizar fuentes conectadas"}
              </span>
            </Button>
          </div>
        </div>
      </Card>

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

      {/* Selector de tabla maestra */}
      <div className="flex flex-wrap gap-2">
        {TABLE_TABS.map((t) => {
          const active = activeTable === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setActiveTable(t.key);
                setSearch("");
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                active
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tabla 1: DIVIPOLA */}
      {activeTable === "divipola" && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
            <div className="flex-1">
              <TableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar municipio, código DANE, departamento, piso térmico o central..."
                resultCount={filteredMunicipalities.length}
                totalCount={state.divipolaCatalog.length}
              />
            </div>
            <div className="w-full sm:w-64">
              <Select
                label="Filtrar por departamento"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="">Todos los departamentos</option>
                {COLOMBIA_DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Código DANE</th>
                  <th className="py-2 pr-3 font-semibold">Municipio</th>
                  <th className="py-2 pr-3 font-semibold">Departamento / Región</th>
                  <th className="py-2 pr-3 font-semibold">Altitud y Piso</th>
                  <th className="py-2 pr-3 font-semibold">Clima ref.</th>
                  <th className="py-2 pr-3 font-semibold">Central SIPSA</th>
                  <th className="py-2 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMunicipalities.map((m) => {
                  const isCurrent = m.daneCode === state.activeZone.daneCode;
                  return (
                    <tr key={m.daneCode} className={isCurrent ? "bg-emerald-50/60" : undefined}>
                      <td className="py-2 pr-3 font-mono text-slate-700">{m.daneCode}</td>
                      <td className="py-2 pr-3 font-semibold text-slate-900">
                        <span className="inline-flex items-center gap-1.5">
                          {isCurrent && <MapPin className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />}
                          {m.municipality}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {m.department} · <span className="text-slate-500">{m.region}</span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {m.altitudeMeters} m · <Badge color="gray">{m.thermalFloor}</Badge>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                        {m.avgTempC} °C · {m.avgHumidityPct}% HR
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{m.nearestMarketHub}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        {isCurrent ? (
                          <Badge color="green">Ubicación actual</Badge>
                        ) : (
                          <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() =>
                              runAction(
                                `div_${m.daneCode}`,
                                { action: "apply_divipola", codeOrCity: m.daneCode },
                                `Granja ubicada en ${m.municipality}, ${m.department} y datos zonales actualizados.`,
                              )
                            }
                            className="font-semibold text-emerald-700 hover:underline cursor-pointer disabled:opacity-50"
                          >
                            {busyAction === `div_${m.daneCode}` ? "Aplicando..." : "Usar en mi granja"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tabla 2: Observaciones originales de precios DANE SIPSA */}
      {activeTable === "precios" && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex-1">
              <TableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar producto o ciudad SIPSA..."
                resultCount={filteredRegionalPrices.length}
                totalCount={marketPayload?.regionalPrices?.length || 0}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge color={marketPayload?.trmCopPerUsd ? "blue" : "yellow"}>
                TRM SFC: {formatCop(marketPayload?.trmCopPerUsd)} ({marketPayload?.trmDate || "sin dato"})
              </Badge>
            </div>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Observaciones oficiales sin conversión de unidad o aplicación automática al catálogo. {marketPayload?.coverageLabel || state.activeZone.coverageLabel}.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Producto SIPSA</th>
                  <th className="py-2 pr-3 font-semibold">Ciudad</th>
                  <th className="py-2 pr-3 font-semibold">Fecha de captura</th>
                  <th className="py-2 pr-3 font-semibold text-right">Precio informado</th>
                  <th className="py-2 pr-3 font-semibold">Unidad</th>
                  <th className="py-2 font-semibold">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRegionalPrices.map((row) => {
                  const matchesFarmCity = row.city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === state.activeZone.city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                  return (
                    <tr
                      key={row.recordId}
                      className={matchesFarmCity ? "bg-emerald-50/70 font-medium" : undefined}
                    >
                      <td className="py-2 pr-3 text-slate-900">
                        {row.product}
                        {matchesFarmCity && (
                          <span className="ml-1.5 text-[10px] text-emerald-700 font-bold">(Ciudad granja)</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{row.city}</td>
                      <td className="py-2 pr-3 text-slate-600">{row.capturedAt.slice(0, 10)}</td>
                      <td className="py-2 pr-3 text-right">{formatCop(row.averagePriceCop)}</td>
                      <td className="py-2 pr-3 text-slate-500">{row.unit || "No informada por el servicio"}</td>
                      <td className="py-2 text-slate-500">{row.recordId}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {state.marketHistory && state.marketHistory.length > 0 && (
            <div className="mt-5 border-t border-slate-200 pt-4">
              <h4 className="text-xs font-bold text-slate-800 mb-2">Historial conservado de consultas SIPSA y TRM</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-3">Indicador / producto</th>
                      <th className="py-2 pr-3">Ciudad / fecha</th>
                      <th className="py-2 pr-3 text-right">Valor registrado</th>
                      <th className="py-2">Fuente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.marketHistory.slice(0, 20).map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-3 font-medium text-slate-900">
                          {String(row.dimensions.indicator || row.dimensions.product || row.observationKey)}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {String(row.dimensions.city || "Colombia")} · {row.observedAt.slice(0, 10)}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {formatCop(Number(row.value))}{row.unit ? ` ${row.unit}` : " (unidad SIPSA no informada)"}
                        </td>
                        <td className="py-2 text-slate-500">{row.providerName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {activeTable === "macroeconomia" && (
        <Card>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Series económicas oficiales</h3>
              <p className="mt-1 max-w-3xl text-xs text-slate-600">
                {state.banrepMacro.note} Las series conservan periodo, indicador y unidad que informa el Banco.
              </p>
            </div>
            <a
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline"
              href="https://suameca.banrep.gov.co/estadisticas-economicas/"
              target="_blank"
              rel="noreferrer"
            >
              Catálogo del Banco de la República <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-800">Series incluidas en la consulta</p>
                <p className="text-[11px] text-slate-600">La selección es por granja y solo habilita indicadores permitidos por la app.</p>
              </div>
              <Button
                variant="secondary"
                disabled={busyAction !== null || draftBanrepFlowIds.length === 0}
                onClick={() =>
                  runAction(
                    "save_banrep_series",
                    { action: "set_banrep_series", flowIds: draftBanrepFlowIds },
                    "Se guardó la selección y se consultaron las series económicas.",
                  )
                }
                className="px-3 py-2 text-xs"
              >
                {busyAction === "save_banrep_series" ? "Guardando..." : "Guardar y actualizar"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {state.banrepSeriesCatalog.map((option) => (
                <label key={option.flowId} className="flex items-start gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={draftBanrepFlowIds.includes(option.flowId)}
                    onChange={(event) =>
                      setDraftBanrepFlowIds((current) =>
                        event.target.checked
                          ? [...new Set([...current, option.flowId])]
                          : current.filter((flowId) => flowId !== option.flowId),
                      )
                    }
                    className="mt-0.5 accent-emerald-700"
                  />
                  <span>{option.label}<span className="ml-1 text-slate-500">({option.flowId})</span></span>
                </label>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Indicador</th>
                  <th className="py-2 pr-3 font-semibold">Periodo</th>
                  <th className="py-2 pr-3 text-right font-semibold">Valor</th>
                  <th className="py-2 pr-3 font-semibold">Unidad reportada</th>
                  <th className="py-2 pr-3 font-semibold">Estado</th>
                  <th className="py-2 font-semibold">Fuente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.banrepMacro.series.flatMap((series) =>
                  [...series.observations].reverse().slice(0, 10).map((observation) => (
                    <tr key={series.flowId + "-" + observation.period + "-" + observation.measure + "-" + observation.unitMeasure}>
                      <td className="py-2 pr-3 font-medium text-slate-900">{series.label}</td>
                      <td className="py-2 pr-3 text-slate-700">{observation.period}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                        {observation.value.toLocaleString("es-CO", { maximumFractionDigits: 4 })}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {observation.unitMeasure || series.unitLabel}
                        {observation.measure ? " · " + observation.measure : ""}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge color={series.status === "ok" ? "green" : series.status === "fallback" ? "yellow" : "red"}>
                          {series.status === "ok" ? "Actualizada" : series.status === "fallback" ? "Último dato guardado" : "Sin dato válido"}
                        </Badge>
                      </td>
                      <td className="py-2 text-slate-500">
                        <a className="underline" href={series.sourceUrl} target="_blank" rel="noreferrer">Banco de la República</a>
                        {series.lastError ? <p className="mt-1 text-[10px] text-amber-700">{series.lastError}</p> : null}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          {state.banrepMacro.series.every((series) => series.observations.length === 0) && (
            <p className="py-6 text-center text-xs text-slate-500">Aún no hay series SDMX válidas guardadas.</p>
          )}
          <div className="mt-5 space-y-4 border-t border-slate-200 pt-4">
            <OfficialCsvImportPanel
              sourceType="ipc"
              title="Índice de Precios al Consumidor (IPC)"
              description="El cron consulta y procesa el anexo XLSX oficial de DANE. Se conservan por separado periodo, indicador, variación, cobertura y unidad; una descarga que cambie de estructura queda en revisión. La serie es solo informativa y no ajusta los Datos Maestros. La carga CSV sigue disponible como respaldo."
              officialUrl="https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc/ipc-informacion-tecnica"
              templateUrl="/templates/dane-index-import-template.csv"
              history={(state.daneIndexHistory || []).filter((row) => String(row.dimensions.sourceType) === "IPC")}
              snapshot={ipcImportSnapshot}
              onImported={loadState}
            />
            <OfficialCsvImportPanel
              sourceType="ipp"
              title="Índice de Precios del Productor (IPP)"
              description="El cron consulta el anexo XLSX oficial de DANE y guarda las series históricas publicadas, marcando los valores provisionales cuando el archivo los identifica. Las correcciones posteriores actualizan la misma observación. No ajusta los Datos Maestros. La carga CSV sigue disponible como respaldo."
              officialUrl="https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-del-productor-ipp"
              templateUrl="/templates/dane-index-import-template.csv"
              history={(state.daneIndexHistory || []).filter((row) => String(row.dimensions.sourceType) === "IPP")}
              snapshot={ippImportSnapshot}
              onImported={loadState}
            />
          </div>
        </Card>
      )}

      {activeTable === "insumos" && (
        <>
          <OfficialCsvImportPanel
            sourceType="sipsa_i"
            title="Precios de insumos y factores SIPSA-I"
            description="El cron revisa el anexo XLSX mensual de precios por municipio publicado por el DANE y guarda precios, producto, presentación, CPC y variación. La vista conserva el departamento de la granja; la carga CSV queda como respaldo si cambia el formato oficial."
            officialUrl="https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-insumos-1/componente-insumos-historicos"
            templateUrl="/templates/sipsa-i-import-template.csv"
            history={state.sipsaIHistory || []}
            snapshot={sipsaIImportSnapshot}
            onImported={loadState}
          />
          <SipsaProductMappingPanel
            history={state.sipsaIHistory || []}
            purchaseProducts={state.sipsaIPurchaseProducts || []}
            mappings={state.sipsaIProductMappings || {}}
            busy={busyAction === "save_sipsa_i_mappings"}
            onSave={(mappings) => void runAction(
              "save_sipsa_i_mappings",
              { action: "save_sipsa_i_mappings", mappings },
              "Equivalencias SIPSA-I guardadas para esta granja.",
            )}
          />
        </>
      )}

      {activeTable === "labor" && (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Indicadores del mercado laboral · GEIH</h3>
                <Badge color={geihSnapshot?.status === "ok" && !geihSchedule?.isExpired ? "green" : geihSnapshot?.status === "error" ? "red" : "yellow"}>
                  {geihSnapshot?.status === "ok"
                    ? geihSchedule?.isExpired ? "Consulta vencida" : "Actualizada"
                    : geihSnapshot?.status === "fallback" ? "Último dato conservado" : "Sin anexo válido"}
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-xs text-slate-600">
                La sincronización descarga el anexo XLSX oficial del DANE y conserva las tasas nacionales de participación, ocupación, desocupación y subocupación desde el marco GEIH 2018. Es contexto laboral agregado; no reemplaza el salario mínimo, auxilio de transporte ni otros parámetros legales de nómina.
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Última consulta: {geihSnapshot?.fetchedAt ? new Date(geihSnapshot.fetchedAt).toLocaleString("es-CO") : "sin registro"}
                {geihSnapshot?.summary ? " · " + geihSnapshot.summary : ""}
                {geihSnapshot?.lastError ? " · " + geihSnapshot.lastError : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <a
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline"
                href={geihSnapshot?.sourceUrl || "https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo/geih-historicos"}
                target="_blank"
                rel="noreferrer"
              >
                Anexos oficiales GEIH <ArrowUpRight className="h-3 w-3" />
              </a>
              <Button
                variant="secondary"
                disabled={busyAction !== null}
                onClick={() => runAction(
                  "sync_geih",
                  { action: "sync_source", sourceKey: "dane_labor_geih" },
                  "Se descargó y revisó el anexo laboral GEIH más reciente disponible.",
                )}
                className="px-3 py-2 text-xs"
              >
                {busyAction === "sync_geih" ? "Consultando..." : "Actualizar GEIH"}
              </Button>
            </div>
          </div>
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            El DANE publica series nacionales y territoriales con cambios metodológicos entre periodos. Esta vista conserva los indicadores nacionales del marco 2018 desde 2021 y no calcula salarios ni obligaciones laborales.
          </p>
          {(state.daneLaborHistory || []).length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">Aún no hay observaciones laborales GEIH descargadas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Periodo</th>
                    <th className="py-2 pr-3 font-semibold">Indicador</th>
                    <th className="py-2 pr-3 text-right font-semibold">Valor</th>
                    <th className="py-2 font-semibold">Cobertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...(state.daneLaborHistory || [])]
                    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
                    .slice(0, 80)
                    .map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{String(row.dimensions.period || row.observedAt.slice(0, 7))}</td>
                        <td className="py-2 pr-3 font-medium text-slate-900">{String(row.dimensions.indicator || "Indicador GEIH")}</td>
                        <td className="py-2 pr-3 text-right font-semibold text-slate-900">{Number(row.value).toLocaleString("es-CO", { maximumFractionDigits: 2 })} {row.unit || ""}</td>
                        <td className="py-2 text-slate-600">{String(row.dimensions.geography || "Total nacional")}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTable === "riesgos" && (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Alertas hidrológicas oficiales</h3>
                <Badge
                  color={
                    ideamSnapshot?.status === "ok" &&
                    !ideamSchedule?.isExpired
                      ? "green"
                      : ideamSnapshot?.status === "error"
                        ? "red"
                        : "yellow"
                  }
                >
                  {ideamSnapshot?.status === "ok"
                    ? ideamSchedule?.isExpired
                      ? "Consulta vencida"
                      : "Consulta válida"
                    : ideamSnapshot?.status === "manual"
                      ? "CSV oficial importado"
                    : ideamSnapshot?.status === "fallback"
                      ? "Último dato conservado"
                      : "Sin consulta válida"}
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-xs text-slate-600">{state.ideamHydroAlerts.note}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Última consulta: {ideamSnapshot?.fetchedAt ? new Date(ideamSnapshot.fetchedAt).toLocaleString("es-CO") : "sin registro"}
                {ideamSnapshot?.summary ? " · " + ideamSnapshot.summary : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <a
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline"
                href={ideamSnapshot?.sourceUrl || "https://bart.ideam.gov.co/ospa/DatosAbiertos/Alertas_Hidrologicas/alertas_hidrologicas.csv"}
                target="_blank"
                rel="noreferrer"
              >
                Conjunto oficial IDEAM <ArrowUpRight className="h-3 w-3" />
              </a>
              <Button
                variant="secondary"
                disabled={busyAction !== null}
                onClick={() =>
                  runAction(
                    "sync_ideam",
                    { action: "sync_source", sourceKey: "ideam_hydro_alerts" },
                    "Se consultó nuevamente la fuente de alertas hidrológicas IDEAM.",
                  )
                }
                className="text-xs px-3 py-2"
              >
                {busyAction === "sync_ideam" ? "Consultando..." : "Actualizar alertas"}
              </Button>
            </div>
          </div>
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
            Se registra la hora de descarga junto con la cobertura territorial que publica el CSV. Confirme el boletín vigente del IDEAM antes de tomar decisiones de emergencia.
          </p>
          {state.ideamHydroAlerts.alerts.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              {ideamSnapshot?.status === "ok" || ideamSnapshot?.status === "manual"
                ? "La capa consultada no reporta alertas vigentes amarillas, naranjas o rojas."
                : "La consulta aún no devolvió alertas IDEAM con un esquema válido."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Emisión / consulta</th>
                    <th className="py-2 pr-3 font-semibold">Cobertura hidrográfica</th>
                    <th className="py-2 pr-3 font-semibold">Alerta e información</th>
                    <th className="py-2 font-semibold">Estado reportado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.ideamHydroAlerts.alerts.map((alert) => (
                    <tr key={alert.id}>
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-600">
                        {alert.publishedAt
                          ? "Publicado " + new Date(alert.publishedAt).toLocaleString("es-CO")
                          : alert.observedAt
                            ? "Consultado " + new Date(alert.observedAt).toLocaleString("es-CO")
                            : "Sin fecha de emisión"}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {[alert.municipality, alert.department, alert.waterbody].filter(Boolean).join(" · ") || "Cobertura territorial no informada"}
                      </td>
                      <td className="max-w-2xl py-2 pr-3">
                        <p className="font-semibold text-slate-900">{alert.title}</p>
                        {alert.description && alert.description !== alert.title ? (
                          <p className="mt-1 whitespace-pre-wrap text-slate-600">{alert.description}</p>
                        ) : null}
                      </td>
                      <td className="py-2 text-slate-600">{alert.statusLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTable === "riesgos" && (
        <OfficialIdeamCsvImportPanel snapshot={ideamSnapshot} onImported={loadState} />
      )}

      {/* Tabla 3: Vademécum ICA */}
      {activeTable === "vademecum" && (
        <Card>
          <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3 mb-4">
            Referencias locales sin verificación automática de registros o tiempos de retiro. Antes de administrar un producto,
            confirme registro, especie y retiro en el <a className="underline font-semibold" href="https://www.ica.gov.co/areas/pecuaria/servicios/regulacion-y-control-de-medicamentos-veterinarios/listados-vigentes" target="_blank" rel="noreferrer">listado oficial ICA</a> y con el profesional responsable.
          </p>
          <div className="mb-4">
            <TableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar medicamento, principio activo, registro ICA, laboratorio o especie..."
              resultCount={filteredVademecum.length}
              totalCount={state.icaVademecum.length}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Producto comercial</th>
                  <th className="py-2 pr-3 font-semibold">Principio activo</th>
                  <th className="py-2 pr-3 font-semibold">Registro ICA</th>
                  <th className="py-2 pr-3 font-semibold">Especies</th>
                  <th className="py-2 pr-3 font-semibold text-right">Retiro carne</th>
                  <th className="py-2 pr-3 font-semibold text-right">Retiro huevo</th>
                  <th className="py-2 font-semibold">Uso en ponedoras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVademecum.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-slate-900">{item.commercialName}</p>
                      <p className="text-[11px] text-slate-500">
                        {item.laboratory} · {item.route.replace(/_/g, " ")}
                      </p>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{item.activeIngredient}</td>
                    <td className="py-2 pr-3 font-mono text-slate-700">{item.icaRegistration}</td>
                    <td className="py-2 pr-3 text-slate-600">{item.species.join(", ")}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{item.withdrawalDaysMeat} d</td>
                    <td className="py-2 pr-3 text-right font-semibold">{item.withdrawalDaysEggs} d</td>
                    <td className="py-2">
                      {item.contraindicatedInLayingHens ? (
                        <Badge color="red">Restringido en postura</Badge>
                      ) : (
                        <Badge color="green">Apto según protocolo</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tabla 4: Estándares Nutricionales FEDNA/NRC y Genética */}
      {activeTable === "nutricion" && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex-1">
              <TableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar especie, etapa productiva o fuente técnica..."
                resultCount={filteredNutrition.length}
                totalCount={state.nutritionTables.length}
              />
            </div>
            <Button
              variant="secondary"
              disabled={busyAction !== null}
              onClick={() =>
                runAction(
                  "apply_standards",
                  { action: "apply_standards_feed" },
                  "Curvas de peso y esquemas vacunales base completados desde el catálogo técnico.",
                )
              }
              className="text-xs px-3 py-2 shrink-0"
            >
              {busyAction === "apply_standards"
                ? "Aplicando..."
                : `Completar curvas y vacunas faltantes (${state.standardsFeedVersion})`}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Especie</th>
                  <th className="py-2 pr-3 font-semibold">Etapa</th>
                  <th className="py-2 pr-3 font-semibold">Proteína cruda</th>
                  <th className="py-2 pr-3 font-semibold">Energía met.</th>
                  <th className="py-2 pr-3 font-semibold">Ca / P</th>
                  <th className="py-2 pr-3 font-semibold">Consumo ref.</th>
                  <th className="py-2 font-semibold">Fuente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNutrition.map((row) => (
                  <tr key={`${row.species}-${row.stage}`}>
                    <td className="py-2 pr-3 font-semibold text-slate-900">{row.speciesLabel}</td>
                    <td className="py-2 pr-3 text-slate-700">{row.stage}</td>
                    <td className="py-2 pr-3 font-semibold text-emerald-800">{row.crudeProteinPct}</td>
                    <td className="py-2 pr-3">{row.metabolizableEnergyKcalKg} kcal/kg</td>
                    <td className="py-2 pr-3">
                      {row.calciumPct} / {row.phosphorusPct}
                    </td>
                    <td className="py-2 pr-3">{row.dailyIntakeG}</td>
                    <td className="py-2 text-slate-600">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tabla 5: Festivos y Parámetros Tributarios/Financieros */}
      {activeTable === "calendario" && (
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Parámetros tributarios y financieros locales ({state.taxContext.year})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-xs">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-slate-500">UVT vigente Colombia</p>
                <p className="text-lg font-bold text-slate-900">{formatCop(state.taxContext.uvtCop)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-slate-500">Base retención agropecuaria ({state.taxContext.reteAgroThresholdUvt} UVT)</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCop(state.taxContext.retentionAgroThresholdCop)}
                </p>
                <p className="text-[11px] text-slate-500">
                  Compras generales ({state.taxContext.reteComprasThresholdUvt} UVT): {formatCop(state.taxContext.retentionPurchasesThresholdCop)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-slate-500">Tasa de referencia guardada en Datos Maestros</p>
                <p className="text-lg font-bold text-slate-900">{state.taxContext.finagroIbrEaPct}% E.A.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Segmento Finagro</th>
                    <th className="py-2 pr-3 font-semibold">Tasa publicada</th>
                    <th className="py-2 font-semibold">Plazo publicado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.taxContext.finagroLines.map((line) => (
                    <tr key={line.segment}>
                      <td className="py-2 pr-3 font-semibold text-slate-900">{line.segment}</td>
                      <td className="py-2 pr-3 text-slate-700">{line.rateNote}</td>
                      <td className="py-2 text-slate-600">{line.termNote}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {state.taxContext.finagroLines.length === 0 && (
                <p className="py-3 text-xs text-slate-500">
                  No hay líneas vigentes cargadas desde Finagro. La tasa mostrada arriba es un parámetro local y no se presenta como cotización oficial.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-3">
              <TableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar festivo oficial por fecha, nombre o ley..."
                resultCount={filteredHolidays.length}
                totalCount={state.colombianHolidays.length}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Fecha</th>
                    <th className="py-2 pr-3 font-semibold">Festivo oficial (Colombia)</th>
                    <th className="py-2 font-semibold">Tipo (Ley 51 de 1983)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHolidays.map((h) => (
                    <tr key={h.date}>
                      <td className="py-2 pr-3 font-mono text-slate-800">{h.date}</td>
                      <td className="py-2 pr-3 font-semibold text-slate-900">{h.localName}</td>
                      <td className="py-2 capitalize text-slate-600">{h.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
