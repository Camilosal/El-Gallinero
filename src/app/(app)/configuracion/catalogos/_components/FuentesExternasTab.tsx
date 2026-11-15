"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Globe, MapPin, RefreshCw } from "lucide-react";
import { Badge, Button, Card, EmptyState, Select } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { COLOMBIA_DEPARTMENTS, type DivipolaMunicipality } from "@/lib/divipola-catalog";

interface RegionalMarketRow {
  plaza: string;
  departments: string[];
  region: string;
  eggAaCopUnit: number;
  eggACopUnit: number;
  polloPieKgCop: number;
  polloCanalKgCop: number;
  gallinaDescarteUnitCop: number;
  conejoCanalKgCop: number;
  quailEggCopUnit: number;
  concentrado40KgBagCop: number;
  maizAmarilloKgCop: number;
  tortaSoyaKgCop: number;
  periodLabel: string;
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
  payload: Record<string, unknown>;
}

interface ExternalMasterTablesState {
  snapshots: SnapshotRecord[];
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
    retentionPurchases27UvtCop: number;
    retentionAgro92UvtCop: number;
    finagroIbrEaPct: number;
    finagroLines: Array<{ segment: string; rateNote: string; termNote: string }>;
  };
}

type MasterTableKey = "divipola" | "precios" | "vademecum" | "nutricion" | "calendario";

const TABLE_TABS: Array<{ key: MasterTableKey; label: string }> = [
  { key: "divipola", label: "Municipios DIVIPOLA" },
  { key: "precios", label: "Precios Mayoristas SIPSA y TRM" },
  { key: "vademecum", label: "Vademécum ICA y Retiros" },
  { key: "nutricion", label: "Nutrición FEDNA/NRC y Genética" },
  { key: "calendario", label: "Festivos Colombia y DIAN/Finagro" },
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
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/configuracion/fuentes-externas");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Error al cargar tablas maestras externas");
      setState(json as ExternalMasterTablesState);
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
        setState(json as ExternalMasterTablesState);
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
      matchesTextQuery(search, [r.plaza, r.region, ...r.departments]),
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
          Cargando tablas maestras sincronizadas (DIVIPOLA, SIPSA, ICA, FEDNA y calendario oficial)...
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
              Consulte aquí los catálogos oficiales sincronizados que respaldan sus decisiones de campo: municipios
              DIVIPOLA y pisos térmicos, precios mayoristas por plaza regional y promedio nacional, vademécum ICA con
              días de retiro, estándares nutricionales FEDNA/NRC y festivos legales de Colombia. Para ver el monitoreo
              climático en tiempo real, pronóstico ITH y alertas activas, abra la Hoja de Control en Análisis.
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
                  "Tablas maestras externas actualizadas para la ubicación de la granja.",
                )
              }
              className="text-xs px-3 py-2"
            >
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw
                  className={`w-3.5 h-3.5 ${busyAction === "sync_all" ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {busyAction === "sync_all" ? "Actualizando..." : "Actualizar tablas"}
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

      {/* Tabla 2: Precios SIPSA por plaza regional y promedio nacional */}
      {activeTable === "precios" && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex-1">
              <TableSearch
                value={search}
                onChange={setSearch}
                placeholder="Buscar plaza mayorista, departamento o región..."
                resultCount={filteredRegionalPrices.length}
                totalCount={marketPayload?.regionalPrices?.length || 0}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge color="blue">
                TRM: {formatCop(marketPayload?.trmCopPerUsd)} ({marketPayload?.trmDate || "vigente"})
              </Badge>
              <Button
                variant="secondary"
                disabled={busyAction !== null}
                onClick={() =>
                  runAction(
                    "apply_prices",
                    { action: "apply_market_prices", overwriteCustom: false },
                    "Precios de referencia de la zona activa aplicados al catálogo de especies.",
                  )
                }
                className="text-xs px-3 py-2"
              >
                {busyAction === "apply_prices" ? "Aplicando..." : "Aplicar precios al catálogo de especies"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            Referencia seleccionada para la granja: <strong>{marketPayload?.coverageLabel || state.activeZone.coverageLabel}</strong>.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Plaza / Cobertura</th>
                  <th className="py-2 pr-3 font-semibold">Región</th>
                  <th className="py-2 pr-3 font-semibold text-right">Huevo AA</th>
                  <th className="py-2 pr-3 font-semibold text-right">Huevo A</th>
                  <th className="py-2 pr-3 font-semibold text-right">Pollo pie / kg</th>
                  <th className="py-2 pr-3 font-semibold text-right">Pollo canal / kg</th>
                  <th className="py-2 pr-3 font-semibold text-right">Bulto conc. 40 kg</th>
                  <th className="py-2 font-semibold text-right">Maíz / kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRegionalPrices.map((row) => {
                  const matchesFarmDept = row.departments.some(
                    (d) => d.toLowerCase() === state.activeZone.matchedDepartment.toLowerCase(),
                  );
                  return (
                    <tr
                      key={row.plaza}
                      className={
                        matchesFarmDept
                          ? "bg-emerald-50/70 font-medium"
                          : row.region === "Nacional"
                            ? "bg-blue-50/60 font-semibold"
                            : undefined
                      }
                    >
                      <td className="py-2 pr-3 text-slate-900">
                        {row.plaza}
                        {matchesFarmDept && (
                          <span className="ml-1.5 text-[10px] text-emerald-700 font-bold">(Zona granja)</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{row.region}</td>
                      <td className="py-2 pr-3 text-right">{formatCop(row.eggAaCopUnit)}</td>
                      <td className="py-2 pr-3 text-right">{formatCop(row.eggACopUnit)}</td>
                      <td className="py-2 pr-3 text-right">{formatCop(row.polloPieKgCop)}</td>
                      <td className="py-2 pr-3 text-right">{formatCop(row.polloCanalKgCop)}</td>
                      <td className="py-2 pr-3 text-right">{formatCop(row.concentrado40KgBagCop)}</td>
                      <td className="py-2 text-right">{formatCop(row.maizAmarilloKgCop)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tabla 3: Vademécum ICA */}
      {activeTable === "vademecum" && (
        <Card>
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
              Parámetros tributarios DIAN ({state.taxContext.year}) y líneas Finagro
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-xs">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-slate-500">UVT vigente Colombia</p>
                <p className="text-lg font-bold text-slate-900">{formatCop(state.taxContext.uvtCop)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-slate-500">Base retención agropecuaria (92 UVT)</p>
                <p className="text-lg font-bold text-slate-900">
                  {formatCop(state.taxContext.retentionAgro92UvtCop)}
                </p>
                <p className="text-[11px] text-slate-500">
                  Compras grales (27 UVT): {formatCop(state.taxContext.retentionPurchases27UvtCop)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-slate-500">Referencia IBR Finagro</p>
                <p className="text-lg font-bold text-slate-900">{state.taxContext.finagroIbrEaPct}% E.A.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Segmento Finagro</th>
                    <th className="py-2 pr-3 font-semibold">Tasa orientativa</th>
                    <th className="py-2 font-semibold">Plazos habituales</th>
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
