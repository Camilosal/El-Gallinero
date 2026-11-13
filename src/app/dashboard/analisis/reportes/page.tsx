"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, AlertTriangle, Download, FileSpreadsheet, FileText, Printer, MessageCircle, Scale, Plus, Trash2 } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { PageHeader, Card, Input, Button, Table, EmptyState, Select, Modal, Badge } from "@/components/ui";
import { ANIMAL_SPECIES, SPECIES_LABELS } from "@/lib/species";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useActionQuery } from "@/lib/useActionQuery";
import FeatureGateBanner from "@/components/FeatureGateBanner";
import { useOnboardingState } from "@/lib/useOnboardingState";

interface PLData {
  from: string;
  to: string;
  income: { categories: { category: string; total: number }[]; total: number };
  expenses: { categories: { category: string; total: number }[]; total: number };
  netProfit: number;
  transactionCount: number;
}

interface DimLine { key: string; label: string; revenue: number; cost: number; profit: number; marginPct: number | null }

interface FeedCostData {
  rows: { species: string; locationId: string | null; locationName: string; kg: number; cost: number; programCost: number; animalDays: number; costPerAnimalDay: number | null }[];
  bySpecies: { key: string; kg: number; cost: number }[];
  byLocation: { key: string; kg: number; cost: number }[];
  totalKg: number;
  totalCost: number;
}

interface RentData {
  from: string;
  to: string;
  bySpecies?: DimLine[];
  byLocation?: DimLine[];
  productLines: { line: string; revenue: number; cost: number; profit: number }[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

interface AnalyticalRow {
  key: string;
  label: string;
  directRevenue: number;
  directCost: number;
  proratedCost: number;
  totalCost: number;
  accruedFeedCost: number;
  netProfit: number;
  marginPct: number | null;
}

interface CaliberMargin {
  caliber: string;
  ntcLabel: string;
  quantitySold: number;
  revenue: number;
  avgUnitPrice: number;
  unitCost: number;
  unitMargin: number;
  grossMargin: number;
  marginPct: number | null;
}

interface AnalyticalData {
  from: string;
  to: string;
  includeProrated: boolean;
  totals: {
    directRevenue: number;
    directCost: number;
    proratedCost: number;
    totalCost: number;
    netProfit: number;
    unallocatedSharedCost: number;
  };
  bySpecies: AnalyticalRow[];
  byLocation: AnalyticalRow[];
  unitEconomics: {
    eggs: {
      totalEggsCollected: number;
      netSaleableEggs: number;
      soldEggs: number;
      poolCost: number;
      realCostPerEgg: number;
      realCostPerTray30: number;
      avgSalePricePerEgg: number;
      breakevenPricePerEgg: number;
      marginPerTray30: number | null;
      breakevenAlert: boolean;
    };
    caliberMargins: CaliberMargin[];
    meat: {
      totalLiveKg: number;
      totalCarcassKg: number;
      soldMeatKg: number;
      poolCost: number;
      realCostPerLiveKg: number;
      realCostPerCarcassKg: number;
      avgSalePricePerKg: number;
      breakevenPricePerCarcassKg: number;
      breakevenAlert: boolean;
    };
  };
  capexRoi: {
    totalAssetCapex: number;
    activeAssetsCount: number;
    monthlyProjectedProfit: number;
    annualizedProfit: number;
    roiPercent: number | null;
    paybackMonths: number | null;
  };
  proratedRulesCount: number;
}

interface ProrrateoData {
  allocations: Array<{
    id: string;
    date: string;
    title: string;
    expenseCategory: string | null;
    totalAmount: string;
    basis: string;
    allocations: Array<{ species?: string | null; locationId?: string | null; label?: string; percentage: number; amount: number }>;
  }>;
  unallocatedTransactions: Array<{
    id: string;
    date: string;
    category: string;
    description: string;
    amount: string;
    alreadyAllocated: boolean;
  }>;
  suggestedWeights: Record<string, Array<{ species: string | null; locationId: string | null; label: string; weight: number }>>;
}

const LINE_LABELS: Record<string, string> = {
  huevos: "Huevos",
  carne: "Carne",
  gallinaza: "Gallinaza",
  aves: "Aves",
  alimento: "Alimento",
  sanidad: "Sanidad",
  otros: "Otros",
};

const LINE_ICONS: Record<string, string> = {
  huevos: "egg",
  carne: "drumstick",
  gallinaza: "sprout",
  aves: "hen",
  otros: "package",
};

const COLORS = ["#22c55e", "#eab308", "#3b82f6", "#ef4444", "#a855f7"];
const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
const UNASSIGNED_KEYS = new Set(["sin_asignar", "sin_especie"]);
const speciesName = (key: string) =>
  UNASSIGNED_KEYS.has(key) ? "Sin asignar" : (SPECIES_LABELS as Record<string, { singular: string }>)[key]?.singular ?? key;

export default function ReportesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <ReportesPageInner />
    </Suspense>
  );
}

function ReportesPageInner() {
  const searchParams = useSearchParams();
  const { isFlagEnabled } = useOnboardingState();
  const prorrateoEnabled = isFlagEnabled("centros_costo_prorrateo");
  const formalReportsEnabled = isFlagEnabled("reportes_dian_roi_credito");
  const requestedTab = searchParams.get("tab");
  const validRequestedTab =
    requestedTab === "pl" || requestedTab === "rent" || requestedTab === "dim" || requestedTab === "analitica"
      ? requestedTab
      : null;
  const [tab, setTab] = useState<"pl" | "rent" | "dim" | "analitica">(validRequestedTab ?? "pl");
  const [lastSyncedTab, setLastSyncedTab] = useState<string | null>(validRequestedTab);
  if (validRequestedTab && validRequestedTab !== lastSyncedTab) {
    setLastSyncedTab(validRequestedTab);
    setTab(validRequestedTab);
  }
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [plData, setPlData] = useState<PLData | null>(null);
  const [rentData, setRentData] = useState<RentData | null>(null);
  const [analitica, setAnalitica] = useState<AnalyticalData | null>(null);
  const [prorrateo, setProrrateo] = useState<ProrrateoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [incomeSearch, setIncomeSearch] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [lineSearch, setLineSearch] = useState("");
  const [species, setSpecies] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [feedCost, setFeedCost] = useState<FeedCostData | null>(null);
  const [includeProrated, setIncludeProrated] = useState(true);

  const [prModalOpen, setPrModalOpen] = useState(false);
  const [prForm, setPrForm] = useState({
    date: new Date().toISOString().split("T")[0],
    title: "",
    sourceTransactionId: "",
    expenseCategory: "Energía / Servicios",
    totalAmount: "",
    basis: "head_count",
    notes: "",
  });
  const [prError, setPrError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const promises: Promise<void>[] = [];
    const dimQs = `from=${from}&to=${to}${species ? `&species=${species}` : ""}${locationId ? `&locationId=${locationId}` : ""}`;

    if (tab === "pl") {
      promises.push(
        apiFetch(`/api/analisis/reportes/estado-resultados?${dimQs}`)
          .then((r) => r.json())
          .then(setPlData),
      );
    } else if (tab === "rent" || tab === "dim") {
      promises.push(
        apiFetch(`/api/analisis/reportes/rentabilidad?${dimQs}`)
          .then((r) => r.json())
          .then(setRentData),
      );
      if (tab === "dim") {
        promises.push(
          apiFetch(`/api/analisis/reportes/costos-alimento?${dimQs}`)
            .then((r) => r.json())
            .then(setFeedCost),
        );
      }
    } else if (tab === "analitica") {
      promises.push(
        apiFetch(`/api/analisis/contabilidad-analitica?${dimQs}&includeProrated=${includeProrated}`)
          .then((r) => r.json())
          .then(setAnalitica),
        apiFetch(`/api/finanzas/prorrateo?from=${from}&to=${to}`)
          .then((r) => r.json())
          .then(setProrrateo),
      );
    }
    Promise.all(promises).finally(() => setLoading(false));
  }, [tab, from, to, species, locationId, includeProrated]);

  useEffect(() => {
    apiFetch("/api/ubicaciones?active=true")
      .then((r) => r.json())
      .then((rows) => { if (Array.isArray(rows)) setLocations(rows); })
      .catch(() => {});
  }, []);

  const openProrrateoModal = useCallback(() => {
    setTab("analitica");
    setPrError("");
    setPrModalOpen(true);
  }, []);

  useActionQuery(searchParams.get("nuevo"), {
    "1": openProrrateoModal,
    prorrateo: openProrrateoModal,
  });

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const exportFile = (format: "csv" | "xlsx") => {
    const dimQs = `from=${from}&to=${to}${species ? `&species=${species}` : ""}${locationId ? `&locationId=${locationId}` : ""}&includeProrated=${includeProrated}&format=${format}`;
    window.open(`/api/analisis/contabilidad-analitica?${dimQs}`, "_blank");
  };

  const shareWhatsApp = () => {
    const netText = analitica
      ? `Ingresos: ${fmt(analitica.totals.directRevenue)} | Costos: ${fmt(analitica.totals.totalCost)} | Utilidad: ${fmt(analitica.totals.netProfit)} | Costo/huevo: ${fmt(analitica.unitEconomics.eggs.realCostPerEgg)} (cubeta: ${fmt(analitica.unitEconomics.eggs.realCostPerTray30)})`
      : plData
        ? `Ingresos: ${fmt(plData.income.total)} | Egresos: ${fmt(plData.expenses.total)} | Utilidad Neta: ${fmt(plData.netProfit)}`
        : "Resumen financiero de la granja";
    const msg = encodeURIComponent(`Reporte Financiero (${from} a ${to}):
${netText}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  const saveProrrateo = async () => {
    setPrError("");
    const res = await apiFetch("/api/finanzas/prorrateo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...prForm,
        sourceTransactionId: prForm.sourceTransactionId || null,
        totalAmount: Number(prForm.totalAmount),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setPrError(d.error || "No se pudo guardar el prorrateo");
      return;
    }
    setPrModalOpen(false);
    setPrForm({ date: to, title: "", sourceTransactionId: "", expenseCategory: "Energía / Servicios", totalAmount: "", basis: "head_count", notes: "" });
    load();
  };

  const deleteProrrateo = async (id: string) => {
    const res = await apiFetch(`/api/finanzas/prorrateo?id=${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const rentPie = rentData?.productLines.filter((p) => p.revenue > 0).map((p, i) => ({
    name: LINE_LABELS[p.line] || p.line,
    value: p.revenue,
    color: COLORS[i % COLORS.length],
  })) || [];

  const filteredIncome = useMemo(() => {
    if (!plData) return [];
    return plData.income.categories.filter((c) => matchesTextQuery(incomeSearch, [c.category]));
  }, [plData, incomeSearch]);

  const filteredExpenses = useMemo(() => {
    if (!plData) return [];
    return plData.expenses.categories.filter((c) => matchesTextQuery(expenseSearch, [c.category]));
  }, [plData, expenseSearch]);

  const filteredProductLines = useMemo(() => {
    if (!rentData) return [];
    return rentData.productLines.filter((l) =>
      matchesTextQuery(lineSearch, [l.line, LINE_LABELS[l.line] || l.line]),
    );
  }, [rentData, lineSearch]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes y Contabilidad Analítica"
        description="Estado de resultados, prorrateo por especie/lugar, márgenes NTC 1240, ROI y exportación"
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button className="px-3 py-1.5 text-xs" variant="secondary" onClick={() => exportFile("csv")}>
              <Download className="w-4 h-4 mr-1 inline" /> CSV
            </Button>
            {formalReportsEnabled && (
              <Button className="px-3 py-1.5 text-xs" variant="secondary" onClick={() => exportFile("xlsx")}>
                <FileSpreadsheet className="w-4 h-4 mr-1 inline" /> Excel (.xlsx)
              </Button>
            )}
            <Button className="px-3 py-1.5 text-xs" variant="secondary" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1 inline" /> PDF / Imprimir
            </Button>
            <Button
              className="px-3 py-1.5 text-xs"
              variant="secondary"
              onClick={() => window.open("/api/operaciones/entregables-ruta2?tipo=acta-entrega&format=pdf", "_blank")}
            >
              <FileText className="w-4 h-4 mr-1 inline" /> Acta Semana 4 / Punto de Equilibrio (PDF)
            </Button>
            <Button className="px-3 py-1.5 text-xs" variant="secondary" onClick={shareWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-1 inline" /> WhatsApp
            </Button>
          </div>
        }
      />

      {tab === "pl" && (
        <FeatureGateBanner
          flagKey="reportes_dian_roi_credito"
          mode="banner"
          customHint="Tu Estado de Resultados, exportación CSV, impresión PDF y resumen WhatsApp están activos. La exportación Excel formal, presupuestos y análisis CAPEX/ROI se activan bajo demanda o en Modo Mediano."
        />
      )}

      {/* Tabs and date filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant={tab === "pl" ? "primary" : "secondary"} className="px-3 py-1.5 text-xs" onClick={() => setTab("pl")}>Estado de Resultados</Button>
            <Button variant={tab === "rent" ? "primary" : "secondary"} className="px-3 py-1.5 text-xs" onClick={() => setTab("rent")}>Por Producto</Button>
            <Button variant={tab === "dim" ? "primary" : "secondary"} className="px-3 py-1.5 text-xs" onClick={() => setTab("dim")}>Por Especie y Lugar</Button>
            <Button variant={tab === "analitica" ? "primary" : "secondary"} className="px-3 py-1.5 text-xs" onClick={() => setTab("analitica")}>Analítica, Unitarios y ROI{!prorrateoEnabled ? " · Avanzado" : ""}</Button>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select label="Especie" value={species} onChange={(e) => setSpecies(e.target.value)}>
              <option value="">Todas las especies</option>
              {ANIMAL_SPECIES.map((sp) => (
                <option key={sp} value={sp}>{SPECIES_LABELS[sp]?.plural ?? sp}</option>
              ))}
            </Select>
            <Select label="Lugar" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Todos los lugares</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Generando reporte...</p></Card>
      ) : tab === "pl" && plData ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <Card className="!p-3 sm:!p-4 min-w-0 text-center">
              <p className="text-xs sm:text-sm text-slate-500">Total Ingresos</p>
              <p className="text-lg sm:text-2xl font-bold text-green-600 truncate">{fmt(plData.income.total)}</p>
            </Card>
            <Card className="!p-3 sm:!p-4 min-w-0 text-center">
              <p className="text-xs sm:text-sm text-slate-500">Total Egresos</p>
              <p className="text-lg sm:text-2xl font-bold text-red-600 truncate">{fmt(plData.expenses.total)}</p>
            </Card>
            <Card className="!p-3 sm:!p-4 min-w-0 text-center col-span-2 sm:col-span-1">
              <p className="text-xs sm:text-sm text-slate-500">Utilidad Neta</p>
              <p className={`text-lg sm:text-2xl font-bold truncate ${plData.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(plData.netProfit)}</p>
            </Card>
          </div>

          <Card>
            <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
              Ingresos por Categoría
            </h3>
            <TableSearch value={incomeSearch} onChange={setIncomeSearch} placeholder="Buscar categoría de ingreso..." resultCount={filteredIncome.length} totalCount={plData.income.categories.length} className="mb-4" />
            {filteredIncome.length === 0 ? (
              <EmptyState icon="incoming" message={incomeSearch.trim() ? "Sin coincidencias" : "Sin ingresos en el período"} />
            ) : (
              <Table headers={["Categoría", "Monto", "% del Total"]}>
                {filteredIncome.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">{c.category}</td>
                    <td className="px-4 py-3 text-sm text-green-600 font-bold">{fmt(c.total)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{plData.income.total > 0 ? ((c.total / plData.income.total) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
                <tr className="bg-green-50 font-bold">
                  <td className="px-4 py-3 text-sm">Total Ingresos</td>
                  <td className="px-4 py-3 text-sm text-green-700">{fmt(plData.income.total)}</td>
                  <td className="px-4 py-3 text-sm">100%</td>
                </tr>
              </Table>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              Egresos por Categoría
            </h3>
            <TableSearch value={expenseSearch} onChange={setExpenseSearch} placeholder="Buscar categoría de egreso..." resultCount={filteredExpenses.length} totalCount={plData.expenses.categories.length} className="mb-4" />
            {filteredExpenses.length === 0 ? (
              <EmptyState icon="outgoing" message={expenseSearch.trim() ? "Sin coincidencias" : "Sin egresos en el período"} />
            ) : (
              <Table headers={["Categoría", "Monto", "% del Total"]}>
                {filteredExpenses.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">{c.category}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-bold">{fmt(c.total)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{plData.expenses.total > 0 ? ((c.total / plData.expenses.total) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
                <tr className="bg-red-50 font-bold">
                  <td className="px-4 py-3 text-sm">Total Egresos</td>
                  <td className="px-4 py-3 text-sm text-red-700">{fmt(plData.expenses.total)}</td>
                  <td className="px-4 py-3 text-sm">100%</td>
                </tr>
              </Table>
            )}
          </Card>

          <Card className={plData.netProfit >= 0 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}>
            <div className="text-center py-4">
              <p className="text-sm text-slate-600">Utilidad Neta del Período</p>
              <p className={`text-3xl font-bold ${plData.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(plData.netProfit)}</p>
              <p className="text-sm text-slate-500 mt-2">{plData.transactionCount} transacciones registradas</p>
            </div>
          </Card>
        </>
      ) : tab === "rent" && rentData ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <Card className="!p-3 sm:!p-4 min-w-0 text-center"><p className="text-xs sm:text-sm text-slate-500">Ingresos totales</p><p className="text-lg sm:text-2xl font-bold text-green-600 truncate">{fmt(rentData.totalRevenue)}</p></Card>
            <Card className="!p-3 sm:!p-4 min-w-0 text-center"><p className="text-xs sm:text-sm text-slate-500">Costos totales</p><p className="text-lg sm:text-2xl font-bold text-red-600 truncate">{fmt(rentData.totalCost)}</p></Card>
            <Card className="!p-3 sm:!p-4 min-w-0 text-center col-span-2 sm:col-span-1"><p className="text-xs sm:text-sm text-slate-500">Utilidad total</p><p className={`text-lg sm:text-2xl font-bold truncate ${rentData.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(rentData.totalProfit)}</p></Card>
          </div>
          {rentPie.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Rentabilidad por Línea de Producto</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={rentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} fontSize={11}>
                    {rentPie.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-3">Detalle por Línea de Producto</h3>
            <TableSearch value={lineSearch} onChange={setLineSearch} placeholder="Buscar línea de producto..." resultCount={filteredProductLines.length} totalCount={rentData.productLines.length} className="mb-4" />
            {filteredProductLines.length === 0 ? (
              <EmptyState icon="clipboard" message="Sin datos de rentabilidad" />
            ) : (
              <Table headers={["Línea", "Ingresos", "Costos", "Utilidad", "Margen"]}>
                {filteredProductLines.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium"><span className="inline-flex items-center gap-2"><AppIcon icon={LINE_ICONS[l.line] || "package"} className="w-4 h-4 text-slate-600" />{LINE_LABELS[l.line] || l.line}</span></td>
                    <td className="px-4 py-3 text-sm text-green-600">{fmt(l.revenue)}</td>
                    <td className="px-4 py-3 text-sm text-red-600">{fmt(l.cost)}</td>
                    <td className={`px-4 py-3 text-sm font-bold ${l.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(l.profit)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{l.revenue > 0 ? ((l.profit / l.revenue) * 100).toFixed(1) : "0"}%</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      ) : tab === "dim" && rentData && feedCost ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <Card className="!p-3 sm:!p-4 min-w-0 text-center"><p className="text-xs sm:text-sm text-slate-500">Ingresos</p><p className="text-lg sm:text-2xl font-bold text-green-600 truncate">{fmt(rentData.totalRevenue)}</p></Card>
            <Card className="!p-3 sm:!p-4 min-w-0 text-center"><p className="text-xs sm:text-sm text-slate-500">Egresos registrados</p><p className="text-lg sm:text-2xl font-bold text-red-600 truncate">{fmt(rentData.totalCost)}</p></Card>
            <Card className="!p-3 sm:!p-4 min-w-0 text-center col-span-2 sm:col-span-1"><p className="text-xs sm:text-sm text-slate-500">Alimento consumido</p><p className="text-lg sm:text-2xl font-bold text-amber-600 truncate">{fmt(feedCost.totalCost)}</p><p className="text-xs text-slate-400">{feedCost.totalKg.toLocaleString()} kg</p></Card>
          </div>
          {[
            { title: "Resultado por especie", rows: rentData.bySpecies ?? [], name: (l: DimLine) => speciesName(l.key) },
            { title: "Resultado por lugar", rows: rentData.byLocation ?? [], name: (l: DimLine) => l.label },
          ].map((section) => (
            <Card key={section.title}>
              <h3 className="font-semibold text-slate-700 mb-3">{section.title}</h3>
              {section.rows.length === 0 ? <EmptyState icon="clipboard" message="Sin transacciones en el período" /> : (
                <Table headers={["Nombre", "Ingresos", "Egresos", "Utilidad", "Margen"]}>
                  {section.rows.map((l) => (
                    <tr key={l.key} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium capitalize">{section.name(l)}</td>
                      <td className="px-4 py-3 text-sm text-green-600">{fmt(l.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-red-600">{fmt(l.cost)}</td>
                      <td className={`px-4 py-3 text-sm font-bold ${l.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(l.profit)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{l.marginPct === null ? "—" : `${l.marginPct}%`}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          ))}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-3">Costo de alimento por especie y lugar</h3>
            {feedCost.rows.length === 0 ? <EmptyState icon="clipboard" message="Sin consumo de alimento en el período" /> : (
              <Table headers={["Especie", "Lugar", "Alimento (kg)", "Costo", "Costo por animal al día"]}>
                {feedCost.rows.map((r) => (
                  <tr key={`${r.species}-${r.locationId ?? "none"}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium capitalize">{speciesName(r.species)}</td>
                    <td className="px-4 py-3 text-sm">{r.locationName}</td>
                    <td className="px-4 py-3 text-sm">{r.kg.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-red-600">{fmt(r.cost)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{r.costPerAnimalDay === null ? "—" : `$${r.costPerAnimalDay.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      ) : tab === "analitica" ? (
        <FeatureGateBanner flagKey="centros_costo_prorrateo" mode="gate">
          {analitica ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
              <input type="checkbox" checked={includeProrated} onChange={(e) => setIncludeProrated(e.target.checked)} className="rounded border-slate-300" />
              Incluir costos indirectos prorrateados ({analitica.proratedRulesCount} reglas)
            </label>
            <Button className="px-3 py-1.5 text-xs" onClick={() => setPrModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1 inline" /> Nuevo prorrateo de costo
            </Button>
          </div>

          {/* Real Unit Cost + Breakeven Alerts + CAPEX ROI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={analitica.unitEconomics.eggs.breakevenAlert ? "border-red-300 bg-red-50/40" : ""}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500">Costo Real / Huevo</p>
                  <p className="text-2xl font-bold text-slate-800">{fmt(analitica.unitEconomics.eggs.realCostPerEgg)}</p>
                  <p className="text-sm text-slate-600">Cubeta (30 u): <b>{fmt(analitica.unitEconomics.eggs.realCostPerTray30)}</b></p>
                </div>
                {analitica.unitEconomics.eggs.breakevenAlert && <Badge color="red">Bajo punto equilibrio</Badge>}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Precio prom. venta: {fmt(analitica.unitEconomics.eggs.avgSalePricePerEgg)} /u • Recogidos netos: {analitica.unitEconomics.eggs.netSaleableEggs.toLocaleString()}
              </p>
            </Card>

            <Card className={analitica.unitEconomics.meat.breakevenAlert ? "border-red-300 bg-red-50/40" : ""}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500">Costo Real / kg Carne</p>
                  <p className="text-2xl font-bold text-slate-800">{fmt(analitica.unitEconomics.meat.realCostPerCarcassKg)} /canal</p>
                  <p className="text-sm text-slate-600">Peso vivo: <b>{fmt(analitica.unitEconomics.meat.realCostPerLiveKg)} /kg</b></p>
                </div>
                {analitica.unitEconomics.meat.breakevenAlert && <Badge color="red">Bajo punto equilibrio</Badge>}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Precio prom. venta: {fmt(analitica.unitEconomics.meat.avgSalePricePerKg)} /kg • Faena: {analitica.unitEconomics.meat.totalCarcassKg} kg
              </p>
            </Card>

            {formalReportsEnabled ? (
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500">CAPEX & Retorno (ROI)</p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {analitica.capexRoi.roiPercent !== null ? `${analitica.capexRoi.roiPercent}% anual` : "Sin CAPEX"}
                  </p>
                  <p className="text-sm text-slate-600">
                    Payback: <b>{analitica.capexRoi.paybackMonths !== null ? `${analitica.capexRoi.paybackMonths} meses` : "N/D"}</b>
                  </p>
                </div>
                <Scale className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Activos ({analitica.capexRoi.activeAssetsCount}): {fmt(analitica.capexRoi.totalAssetCapex)}
              </p>
            </Card>
            ) : (
            <Card className="border-dashed border-amber-300 bg-amber-50/40">
              <p className="text-xs uppercase font-semibold text-amber-800">CAPEX & Retorno (ROI)</p>
              <p className="text-xs text-amber-900/80 mt-2">
                Activa “Reportes Formales DIAN, Crédito Banco Agrario y ROI CapEx” (o Modo Mediano) para calcular retorno sobre activos.
              </p>
            </Card>
            )}
          </div>

          {analitica.totals.unallocatedSharedCost > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Hay <b>{fmt(analitica.totals.unallocatedSharedCost)}</b> en egresos sin especie ni lugar asignado y sin prorratear. Usa “Nuevo prorrateo de costo” para repartirlos.
              </span>
            </div>
          )}

          {/* Profitability by Species chart & table */}
          {analitica.bySpecies.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Rentabilidad Analítica por Especie (Directo + Prorrateado)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analitica.bySpecies}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmt(Number(v))} /><Legend />
                  <Bar dataKey="directRevenue" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalCost" name="Costos Totales" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {[
            { title: "Detalle Analítico por Especie", rows: analitica.bySpecies },
            { title: "Detalle Analítico por Lugar / Galpón", rows: analitica.byLocation },
          ].map((sec) => (
            <Card key={sec.title}>
              <h3 className="font-semibold text-slate-700 mb-3">{sec.title}</h3>
              {sec.rows.length === 0 ? <EmptyState icon="clipboard" message="Sin movimientos en el período" /> : (
                <Table headers={["Nombre", "Ingresos", "Costo Directo", "Prorrateado", "Costo Total", "Alim. Devengado", "Utilidad", "Margen %"]}>
                  {sec.rows.map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm font-medium capitalize">{r.label}</td>
                      <td className="px-3 py-2 text-sm text-green-600">{fmt(r.directRevenue)}</td>
                      <td className="px-3 py-2 text-sm text-red-600">{fmt(r.directCost)}</td>
                      <td className="px-3 py-2 text-sm text-amber-600">{fmt(r.proratedCost)}</td>
                      <td className="px-3 py-2 text-sm font-semibold">{fmt(r.totalCost)}</td>
                      <td className="px-3 py-2 text-sm text-slate-500">{fmt(r.accruedFeedCost)}</td>
                      <td className={`px-3 py-2 text-sm font-bold ${r.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(r.netProfit)}</td>
                      <td className="px-3 py-2 text-sm text-slate-500">{r.marginPct === null ? "—" : `${r.marginPct}%`}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          ))}

          {/* NTC 1240 Caliber Margins */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-3">Margen por Calibre NTC 1240 (Huevos)</h3>
            {analitica.unitEconomics.caliberMargins.length === 0 ? (
              <EmptyState icon="egg" message="Sin ventas de huevo registradas en el período" />
            ) : (
              <Table headers={["Calibre", "NTC 1240", "Vendidos", "Ingreso", "Precio Prom./u", "Costo Real/u", "Margen/u", "Margen Total", "%"]}>
                {analitica.unitEconomics.caliberMargins.map((c) => (
                  <tr key={c.caliber} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-sm font-bold">{c.caliber}</td>
                    <td className="px-3 py-2 text-sm text-slate-500">{c.ntcLabel}</td>
                    <td className="px-3 py-2 text-sm">{c.quantitySold.toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-green-600">{fmt(c.revenue)}</td>
                    <td className="px-3 py-2 text-sm">{fmt(c.avgUnitPrice)}</td>
                    <td className="px-3 py-2 text-sm text-slate-500">{fmt(c.unitCost)}</td>
                    <td className={`px-3 py-2 text-sm font-semibold ${c.unitMargin >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(c.unitMargin)}</td>
                    <td className={`px-3 py-2 text-sm font-bold ${c.grossMargin >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(c.grossMargin)}</td>
                    <td className="px-3 py-2 text-sm">{c.marginPct === null ? "—" : `${c.marginPct}%`}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          {/* Prorrateo Rules History */}
          {prorrateo && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-3">Reglas de Prorrateo Aplicadas</h3>
              {prorrateo.allocations.length === 0 ? (
                <EmptyState icon="scale" message="Aún no hay costos compartidos prorrateados en este rango" />
              ) : (
                <Table headers={["Fecha", "Concepto", "Criterio", "Total", "Distribución", "Acción"]}>
                  {prorrateo.allocations.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm">{a.date}</td>
                      <td className="px-3 py-2 text-sm font-medium">{a.title}</td>
                      <td className="px-3 py-2 text-sm text-slate-500">{a.basis}</td>
                      <td className="px-3 py-2 text-sm font-bold">{fmt(Number(a.totalAmount))}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {a.allocations.map((it) => `${it.label || it.species || "Lugar"}: ${it.percentage}% (${fmt(it.amount)})`).join(" · ")}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <button onClick={() => deleteProrrateo(a.id)} className="text-red-600 hover:text-red-800" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          )}
          </>
          ) : null}
        </FeatureGateBanner>
      ) : null}

      <Modal open={prModalOpen} onClose={() => setPrModalOpen(false)} title="Prorratear Costo Compartido">
        <div className="space-y-4">
          {prError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{prError}</p>}
          {prorrateo && prorrateo.unallocatedTransactions.filter((t) => !t.alreadyAllocated).length > 0 && (
            <Select
              label="Vincular egreso sin asignar (opcional)"
              value={prForm.sourceTransactionId}
              onChange={(e) => {
                const txId = e.target.value;
                const found = prorrateo.unallocatedTransactions.find((t) => t.id === txId);
                setPrForm((prev) => ({
                  ...prev,
                  sourceTransactionId: txId,
                  title: found ? found.description || found.category : prev.title,
                  totalAmount: found ? found.amount : prev.totalAmount,
                  expenseCategory: found ? found.category : prev.expenseCategory,
                  date: found ? found.date : prev.date,
                }));
              }}
            >
              <option value="">-- Monto manual / sin vincular --</option>
              {prorrateo.unallocatedTransactions.filter((t) => !t.alreadyAllocated).map((t) => (
                <option key={t.id} value={t.id}>{t.date} · {t.category} ({fmt(Number(t.amount))})</option>
              ))}
            </Select>
          )}
          <Input label="Fecha" type="date" value={prForm.date} onChange={(e) => setPrForm({ ...prForm, date: e.target.value })} />
          <Input label="Concepto / Título" value={prForm.title} onChange={(e) => setPrForm({ ...prForm, title: e.target.value })} placeholder="Ej. Energía eléctrica galpones" />
          <Input label="Monto Total (COP)" type="number" value={prForm.totalAmount} onChange={(e) => setPrForm({ ...prForm, totalAmount: e.target.value })} />
          <Select label="Criterio de reparto automático" value={prForm.basis} onChange={(e) => setPrForm({ ...prForm, basis: e.target.value })}>
            <option value="head_count">Número de animales vivos por especie</option>
            <option value="biomass">Biomasa viva estimada (kg)</option>
            <option value="feed_kg">Consumo de alimento en el período (kg)</option>
            <option value="area_m2">Área física de instalaciones (m²)</option>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPrModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveProrrateo}>Aplicar Prorrateo</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
