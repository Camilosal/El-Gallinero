"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Calculator, CalendarDays, ClipboardList, Package, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { PageHeader, HeroActionButton, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import ContactField from "@/components/contacts/ContactField";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";
import StandardExpensePicker from "@/components/finance/StandardExpensePicker";
import {
  NON_FEED_STANDARD_EXPENSE_FAMILIES,
  TREATMENT_LABELS,
  findStandardExpenseFamily,
  type ExpenseTreatmentType,
} from "@/lib/finance/standard-expense-catalog";

interface Transaction {
  id: string;
  date: string;
  type: string;
  category: string;
  description: string;
  amount: string;
  counterparty: string | null;
  quantity: string | null;
  unitPrice: string | null;
  unit: string | null;
  presentation: string | null;
  notes: string | null;
  sourceType: string | null;
  sourceId: string | null;
  expenseCatalogId?: string | null;
  expenseFamily?: string | null;
  expenseConcept?: string | null;
  expenseTreatment?: string | null;
  expenseDriver?: string | null;
}

interface ByFamily {
  family: string;
  treatment: string;
  total: number;
  count: number;
}

interface ByCategory {
  type: string;
  category: string;
  total: string;
}

interface SeriesPoint {
  label: string;
  date: string;
  income: number;
  expense: number;
  profit: number;
  cumulative: number;
}

interface Kpis {
  totalIncome: number;
  totalExpense: number;
  profit: number;
  margin: number;
  expenseRatio: number;
  activeDays: number;
  avgDailyIncome: number;
  avgDailyExpense: number;
  avgDailyNet: number;
  projectedMonthly: number;
  bestDay: { date: string; profit: number } | null;
  worstDay: { date: string; profit: number } | null;
}

interface FinanceData {
  transactions: Transaction[];
  summary: { income: string; expenses: string; profit: string };
  operatingContext?: {
    operatingIncomeCop: number;
    accruedOperatingExpenseCop: number;
    operatingNetProfitCop: number;
    cashNetFlowCop: number;
    periodDepreciationCop: number;
    capexCashOutflowCop: number;
    warehouseFeedAssetCop: number;
    netEquipmentBookValueCop: number;
    biologicalPortfolioValueCop: number;
    totalProductiveWealthCop: number;
    lifecycleMode: string;
    lifecycleLabel: string;
  };
  byCategory: ByCategory[];
  byFamily?: ByFamily[];
  series: SeriesPoint[];
  kpis: Kpis;
  cashflow: { series: SeriesPoint[]; kpis: Kpis };
}

const incomeCategories = [
  "Venta de huevos",
  "Venta de aves",
  "Venta de carne",
  "Venta de pollitos",
  "Venta de abono/gallinaza",
  "Otro ingreso",
];

const expenseCategories = [
  "Compra de alimento",
  "Mano de obra",
  ...NON_FEED_STANDARD_EXPENSE_FAMILIES.map((f) => f.name),
];

const COLORS = [
  "var(--iw-color-forest)",
  "var(--iw-color-ochre)",
  "var(--iw-color-info)",
  "var(--iw-color-danger)",
  "var(--iw-color-terracotta)",
  "var(--iw-color-success)",
  "var(--iw-color-warning)",
  "var(--iw-color-muted)",
  "var(--iw-color-outline-soft)",
  "var(--iw-color-graphite)",
];

const defaultUnitByCategory: Record<string, string> = {
  "Compra de alimento": "kg",
  "01 Sanidad preventiva": "unidades",
  "02 Diagnóstico y tratamientos": "unidades",
  "03 Bioseguridad": "unidades",
  "04 Cama y limpieza": "unidades",
  "05 Personal / nómina": "otro",
  "07 Equipos e infraestructura": "unidades",
  "08 Clasificación y empaque": "unidades",
  "15 Transporte y logística": "unidades",
  "22 Activos / inversión": "unidades",
  "23 Activo biológico": "unidades",
  "Compra de insumos": "unidades",
  "Control sanitario": "unidades",
  "Mantenimiento": "unidades",
  "Mano de obra": "otro",
  "Compra de gallinas": "unidades",
  "Equipamiento": "unidades",
  "Venta de huevos": "docenas",
  "Venta de aves": "aves",
  "Venta de carne": "kg",
  "Venta de pollitos": "unidades",
  "Venta de abono/gallinaza": "kg",
};

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const dateFmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });

export default function FinanzasPage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "egreso",
    category: "01 Sanidad preventiva",
    expenseCatalogId: "",
    expenseFamily: "01 Sanidad preventiva",
    expenseConcept: "",
    expenseTreatment: "VARIABLE",
    expenseDriver: "UNIDAD_MENSUAL",
    description: "",
    counterparty: "",
    quantity: "",
    unitPrice: "",
    unit: "unidades",
    presentation: "",
    amount: "",
    notes: "",
  });
  const { values: incomeCats } = useCatalog("categoria_ingreso", incomeCategories);
  const { values: expenseCats } = useCatalog("categoria_egreso", expenseCategories);
  const { values: unitOptions } = useCatalog("unidad_medida", ["unidades", "kg", "lb", "litros", "docenas", "otro"]);

  const load = useCallback(() => {
    apiFetch(`/api/finanzas/finanzas?period=${period}`).then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // Total auto-calculado desde cantidad × valor unitario
  const computedTotal =
    Number(form.quantity) > 0 && Number(form.unitPrice) > 0
      ? (Number(form.quantity) * Number(form.unitPrice)).toFixed(2)
      : "";

  // Cantidad total medida (para cruzar con inventarios): cantidad × presentación
  const measuredTotal =
    Number(form.quantity) > 0 && Number(form.presentation) > 0
      ? Number(form.quantity) * Number(form.presentation)
      : null;

  const openNew = () => {
    setEditing(null);
    setError("");
    setForm({
      date: new Date().toISOString().split("T")[0],
      type: "egreso",
      category: "01 Sanidad preventiva",
      expenseCatalogId: "",
      expenseFamily: "01 Sanidad preventiva",
      expenseConcept: "",
      expenseTreatment: "VARIABLE",
      expenseDriver: "UNIDAD_MENSUAL",
      description: "",
      counterparty: "",
      quantity: "",
      unitPrice: "",
      unit: "unidades",
      presentation: "",
      amount: "",
      notes: "",
    });
    setModalOpen(true);
  };
  useActionQuery(searchParams.get("nuevo"), { "1": openNew });

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setError("");
    setForm({
      date: t.date,
      type: t.type,
      category: t.category,
      expenseCatalogId: t.expenseCatalogId || "",
      expenseFamily: t.expenseFamily || "",
      expenseConcept: t.expenseConcept || "",
      expenseTreatment: t.expenseTreatment || "",
      expenseDriver: t.expenseDriver || "",
      description: t.description,
      counterparty: t.counterparty || "",
      quantity: t.quantity || "",
      unitPrice: t.unitPrice || "",
      unit: t.unit || "unidades",
      presentation: t.presentation || "",
      amount: t.amount,
      notes: t.notes || "",
    });
    setModalOpen(true);
  };

  const onTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value;
    if (t === "ingreso") {
      const firstCat = incomeCats[0] || incomeCategories[0];
      const unit = defaultUnitByCategory[firstCat];
      setForm({
        ...form,
        type: t,
        category: firstCat,
        expenseCatalogId: "",
        expenseFamily: "",
        expenseConcept: "",
        expenseTreatment: "",
        expenseDriver: "",
        ...(unit ? { unit } : {}),
      });
    } else {
      setForm({
        ...form,
        type: t,
        category: "01 Sanidad preventiva",
        expenseCatalogId: "",
        expenseFamily: "01 Sanidad preventiva",
        expenseConcept: "",
        expenseTreatment: "VARIABLE",
        expenseDriver: "UNIDAD_MENSUAL",
        unit: "unidades",
      });
    }
  };

  const onCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    const fam = findStandardExpenseFamily(category);
    const unit = defaultUnitByCategory[category] || (fam?.isPurchaseWorkflow ? "unidades" : undefined);
    setForm({
      ...form,
      category,
      ...(form.type === "egreso" && fam ? { expenseFamily: fam.name } : {}),
      ...(unit ? { unit } : {}),
    });
  };

  const save = async () => {
    setError("");
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing.id } : form;
    // Si hay cantidad y valor unitario, el total se calcula; si no, se usa el monto manual.
    // Al editar, si cantidad/valor unitario no cambiaron se conserva el monto original:
    // hay registros vinculados (ventas de huevos/aves) donde qty×precio ≠ monto guardado.
    let amount = computedTotal || body.amount;
    if (editing && form.quantity === (editing.quantity || "") && form.unitPrice === (editing.unitPrice || "")) {
      amount = editing.amount;
    }
    const res = await apiFetch("/api/finanzas/finanzas", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, amount }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar la transacción");
      return;
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    await apiFetch(`/api/finanzas/finanzas?id=${id}`, { method: "DELETE" });
    load();
  };

  const expensePie =
    data?.byFamily && data.byFamily.length > 0
      ? data.byFamily.map((f, i) => ({
          name: f.family,
          value: Number(f.total),
          color: COLORS[i % COLORS.length],
        }))
      : data?.byCategory.filter((c) => c.type === "egreso").map((c, i) => ({
          name: c.category,
          value: Number(c.total),
          color: COLORS[i % COLORS.length],
        })) || [];

  const incomePie = data?.byCategory.filter((c) => c.type === "ingreso").map((c, i) => ({
    name: c.category,
    value: Number(c.total),
    color: COLORS[i % COLORS.length],
  })) || [];

  const k = data?.kpis;
  const positive = (k?.profit ?? 0) >= 0;

  const filteredTransactions = useMemo(() => {
    const transactions = data?.transactions ?? [];
    if (!search.trim()) return transactions;
    return transactions.filter((transaction) =>
      matchesTextQuery(search, [
        transaction.date,
        dateFmt(transaction.date),
        transaction.type === "ingreso" ? "ingreso" : "egreso",
        transaction.category,
        transaction.expenseFamily,
        transaction.expenseCatalogId,
        transaction.expenseConcept,
        transaction.description,
        transaction.counterparty,
        transaction.quantity,
        transaction.unitPrice,
        transaction.unit,
        transaction.presentation,
        transaction.amount,
        transaction.notes,
      ]),
    );
  }, [data, search]);
  const marginPct = k ? pct(k.margin) : "—";
  const ratioPct = k ? pct(k.expenseRatio) : "—";
  const cash = data?.cashflow?.kpis;

  return (
    <div>
      <PageHeader
        title="Panel Financiero"
        description="Comportamiento de ingresos y egresos a través del tiempo y KPIs del negocio"
        help="Vista completa de las finanzas del gallinero.\n\n• KPIs: ingresos, egresos, ganancia, margen de rentabilidad.\n• Gráficos: evolución de ingresos vs egresos, distribución por categoría.\n• Puedes filtrar por período (7, 14, 30, 60, 90 días).\n• Los datos se generan automáticamente desde las ventas y egresos registrados.\n• Incluye proyección mensual basada en el rendimiento actual."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="365">Último año</option>
            </Select>
            <HeroActionButton tone="solid" onClick={openNew}>+ Nueva Transacción</HeroActionButton>
          </div>
        }
      />

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : !data || !k || !cash ? null : (
        <>
          {data.operatingContext && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="border-emerald-200 bg-emerald-50/60 !p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Ganancia Real de Operación</p>
                <p className={`text-2xl font-bold mt-1 ${data.operatingContext.operatingNetProfitCop >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                  {fmt(data.operatingContext.operatingNetProfitCop)}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Sin contar compra de equipos ({fmt(data.operatingContext.capexCashOutflowCop)}) ni bultos en bodega · Desgaste equipos {fmt(data.operatingContext.periodDepreciationCop)}
                </p>
              </Card>
              <Card className="border-sky-200 bg-sky-50/60 !p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Patrimonio en Granja ({data.operatingContext.lifecycleLabel})</p>
                <p className="text-2xl font-bold text-sky-900 mt-1">
                  {fmt(data.operatingContext.totalProductiveWealthCop)}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Valor de animales {fmt(data.operatingContext.biologicalPortfolioValueCop)} · Bodega {fmt(data.operatingContext.warehouseFeedAssetCop)} · Equipos {fmt(data.operatingContext.netEquipmentBookValueCop)}
                </p>
              </Card>
              <Card className="border-slate-200 !p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dinero en Caja del Período</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {fmt(data.operatingContext.cashNetFlowCop)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Efectivo que entró menos efectivo que salió en estas fechas
                </p>
              </Card>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 mb-6">
            <StatCard icon="incoming" label="Ingresos" value={fmt(k.totalIncome)} color="green" />
            <StatCard icon="outgoing" label="Egresos" value={fmt(k.totalExpense)} color="red" />
            <StatCard icon={positive ? "trend-up" : "trend-down"} label="Utilidad Neta" value={fmt(k.profit)} color={positive ? "blue" : "red"} />
            <StatCard icon="calendar" label="Ingreso Prom. Diario (caja)" value={fmt(cash.avgDailyIncome)} color="yellow" />
            <StatCard icon="expense" label="Egreso Prom. Diario (caja)" value={fmt(cash.avgDailyExpense)} color="purple" />
            <StatCard icon="droplets" label="Flujo Neto Diario" value={fmt(cash.avgDailyNet)} color={cash.avgDailyNet >= 0 ? "earth" : "red"} />
          </div>

          {/* Insights */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
            <Card className="!p-4 flex flex-col justify-between">
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-500" aria-hidden="true" />Mejor día</p>
              {cash.bestDay ? (
                <>
                  <p className="text-lg font-bold text-green-600">{dateFmt(cash.bestDay.date)}</p>
                  <p className="text-sm text-green-700">+{fmt(cash.bestDay.profit)}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400 py-2">Sin datos</p>
              )}
            </Card>
            <Card className="!p-4 flex flex-col justify-between">
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-red-500" aria-hidden="true" />Peor día</p>
              {cash.worstDay ? (
                <>
                  <p className="text-lg font-bold text-red-600">{dateFmt(cash.worstDay.date)}</p>
                  <p className="text-sm text-red-700">{fmt(cash.worstDay.profit)}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400 py-2">Sin datos</p>
              )}
            </Card>
            <Card className="!p-4 flex flex-col justify-between">
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><Target className="w-4 h-4 text-emerald-600" aria-hidden="true" />Margen de utilidad</p>
              <p className={`text-2xl font-bold ${positive ? "text-green-600" : "text-red-600"}`}>{marginPct}</p>
              <p className="text-sm text-slate-500">Cada $1 ingresa → {ratioPct} se gastan</p>
            </Card>
            <Card className="!p-4 flex flex-col justify-between">
              <p className="text-sm text-slate-500 flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-blue-600" aria-hidden="true" />Proyección mensual</p>
              <p className={`text-2xl font-bold ${cash.projectedMonthly >= 0 ? "text-blue-600" : "text-red-600"}`}>{fmt(cash.projectedMonthly)}</p>
              <p className="text-sm text-slate-500">Proyección basada en movimientos de caja reales</p>
            </Card>
          </div>

          {/* Cash behavior over time */}
          {data.cashflow.series.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" aria-hidden="true" />Flujo de caja en el período</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.cashflow.series}>
                    <defs>
                      <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--iw-color-success)" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="var(--iw-color-success)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--iw-color-danger)" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="var(--iw-color-danger)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--iw-color-border)" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v, name) => [fmt(Number(v)), name]} />
                    <Legend />
                    <Area type="monotone" dataKey="income" name="Ingresos" stroke="var(--iw-color-success)" fill="url(#gInc)" />
                    <Area type="monotone" dataKey="expense" name="Egresos" stroke="var(--iw-color-danger)" fill="url(#gExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <h3 className="font-semibold text-[var(--iw-semantic-text-primary)] mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[var(--iw-semantic-text-secondary)]" aria-hidden="true" />Flujo neto acumulado</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.cashflow.series}>
                    <defs>
                      <linearGradient id="gCum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--iw-color-info)" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="var(--iw-color-info)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--iw-color-border)" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v, name) => [fmt(Number(v)), name]} />
                    <Area type="monotone" dataKey="cumulative" name="Flujo acumulado" stroke="var(--iw-color-info)" fill="url(#gCum)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
          {/* Pie charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-slate-500" aria-hidden="true" />Distribución de Egresos</h3>
              {expensePie.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={expensePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={true} fontSize={10}>
                      {expensePie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center py-8 text-slate-400">Sin egresos en este período</p>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-slate-500" aria-hidden="true" />Distribución de Ingresos</h3>
              {incomePie.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={incomePie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={true} fontSize={10}>
                      {incomePie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center py-8 text-slate-400">Sin ingresos en este período</p>
              )}
            </Card>
          </div>

          {/* Category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2"><ArrowDownLeft className="w-4 h-4" aria-hidden="true" />Desglose de Ingresos</h3>
              {data.byCategory.filter((c) => c.type === "ingreso").length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Sin ingresos registrados</p>
              ) : (
                <div className="space-y-2">
                  {data.byCategory.filter((c) => c.type === "ingreso").map((c, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm">{c.category}</span>
                      <span className="font-semibold text-green-700">${Number(c.total).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <h3 className="font-semibold text-[var(--iw-semantic-status-danger)] mb-3 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" aria-hidden="true" />Desglose de Egresos por Familia / Centro</h3>
              {expensePie.length === 0 ? (
                <p className="text-sm text-[var(--iw-semantic-text-secondary)] py-4 text-center">Sin egresos registrados</p>
              ) : (
                <div className="space-y-2">
                  {(data.byFamily && data.byFamily.length > 0
                    ? data.byFamily.map((f, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-[var(--iw-semantic-bg-subtle)] rounded border border-[var(--iw-semantic-border-default)]">
                          <span className="text-sm text-[var(--iw-semantic-text-primary)]">
                            {f.family}{" "}
                            <span className="text-xs text-[var(--iw-semantic-text-secondary)]">
                              ({TREATMENT_LABELS[f.treatment as ExpenseTreatmentType] || f.treatment})
                            </span>
                          </span>
                          <span className="font-semibold text-[var(--iw-semantic-status-danger)]">${Number(f.total).toLocaleString()}</span>
                        </div>
                      ))
                    : data.byCategory.filter((c) => c.type === "egreso").map((c, i) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-[var(--iw-semantic-bg-subtle)] rounded">
                          <span className="text-sm">{c.category}</span>
                          <span className="font-semibold text-[var(--iw-semantic-status-danger)]">${Number(c.total).toLocaleString()}</span>
                        </div>
                      )))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Transactions Table */}
      <Card>
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-slate-500" aria-hidden="true" />Historial de Transacciones</h3>
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por fecha, categoría, descripción o contraparte..."
          resultCount={filteredTransactions.length}
          totalCount={data?.transactions.length ?? 0}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon="trend-up"
            message={
              search.trim()
                ? "No hay transacciones que coincidan con la búsqueda"
                : "No hay transacciones en este período"
            }
          />
        ) : (
          <Table headers={["Fecha", "Tipo", "Categoría", "Descripción", "Contraparte", "Detalle", "Monto", ""]}>
            {filteredTransactions.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(t.date + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3">
                  <Badge color={t.type === "ingreso" ? "green" : "red"}>
                    <span className="inline-flex items-center gap-1">
                      {t.type === "ingreso" ? (
                        <><ArrowDownLeft className="w-3.5 h-3.5" aria-hidden="true" /> Ingreso</>
                      ) : (
                        <><ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" /> Egreso</>
                      )}
                    </span>
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  <div>{t.expenseFamily || t.category}</div>
                  {t.expenseCatalogId && (
                    <div className="text-[11px] text-[var(--iw-semantic-text-secondary)]">
                      <span className="font-mono">{t.expenseCatalogId}</span> · {t.expenseConcept || t.category}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm max-w-[200px] truncate">{t.description}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{t.counterparty || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {t.quantity && t.unitPrice ? (
                    <span>
                      {t.quantity} × ${Number(t.unitPrice).toLocaleString()}
                      {t.quantity && t.presentation && t.unit ? (
                        <span className="block text-xs text-slate-400">{Number(t.quantity) * Number(t.presentation)} {t.unit}</span>
                      ) : null}
                    </span>
                  ) : "—"}
                </td>
                <td className={`px-4 py-3 font-bold ${t.type === "ingreso" ? "text-green-600" : "text-red-600"}`}>
                  {t.type === "ingreso" ? "+" : "-"}${Number(t.amount).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {(t.sourceType || t.sourceId) && !(t.sourceType === "alimento" && t.sourceId) ? (
                      <span className="text-xs text-slate-400" title="Edítala o elimínala desde el módulo que la creó">
                        Gestionar en módulo
                      </span>
                    ) : (
                      <>
                        <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline text-xs">Editar</button>
                        {t.sourceType === "alimento" && t.sourceId ? (
                          <span className="text-xs text-slate-400" title="Elimina el movimiento desde Alimentación para actualizar el stock">
                            Eliminar en Alimentación
                          </span>
                        ) : (
                          <button onClick={() => remove(t.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Transacción" : "Nueva Transacción"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="Tipo" value={form.type} onChange={onTypeChange}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </Select>
          {form.type === "ingreso" ? (
            <Select label="Categoría" value={form.category} onChange={onCategoryChange}>
              {incomeCats.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          ) : (
            <StandardExpensePicker
              compact
              includeFeedCategory={false}
              value={{
                category: form.category,
                expenseCatalogId: form.expenseCatalogId,
                expenseFamily: form.expenseFamily,
                expenseConcept: form.expenseConcept,
                expenseTreatment: form.expenseTreatment,
                expenseDriver: form.expenseDriver,
              }}
              extraCategories={expenseCats}
              onChange={(next, meta) =>
                setForm((f) => ({
                  ...f,
                  category: next.category,
                  expenseCatalogId: next.expenseCatalogId,
                  expenseFamily: next.expenseFamily,
                  expenseConcept: next.expenseConcept,
                  expenseTreatment: next.expenseTreatment,
                  expenseDriver: next.expenseDriver,
                  description: f.description || next.expenseConcept || "",
                  unit: meta.recommendedUnit || f.unit,
                }))
              }
            />
          )}
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalle de la transacción..." required />
          <ContactField
            role={form.type === "ingreso" ? "cliente" : "proveedor"}
            label={form.type === "ingreso" ? "Cliente / A quién se le vendió" : "Proveedor / Dónde se compró"}
            value={form.counterparty}
            onChange={(name) => setForm({ ...form, counterparty: name })}
            placeholder={form.type === "ingreso" ? "Nombre del comprador" : "Nombre del proveedor o tienda"}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cantidad" type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Ej: 5" />
            <Select label="Unidad de Medida" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {unitOptions.map((u) => <option key={u} value={u}>{u === "unidades" ? "Unidades" : u === "kg" ? "Kilogramos (kg)" : u === "lb" ? "Libras (lb)" : u === "litros" ? "Litros" : u === "docenas" ? "Docenas" : u}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Presentación por unidad" type="number" step="0.01" min="0" value={form.presentation} onChange={(e) => setForm({ ...form, presentation: e.target.value })} placeholder="Ej: 2 (cada unidad = 2 kg)" />
            <Input label="Valor Unitario ($)" type="number" step="0.01" min="0" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} placeholder="Ej: 4500" />
          </div>
          {computedTotal ? (
            <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
              <p className="flex items-center gap-1.5"><Calculator className="w-4 h-4 shrink-0" aria-hidden="true" /> <span>Total calculado: <strong className="text-xl">${Number(computedTotal).toLocaleString()}</strong> ({form.quantity} × ${Number(form.unitPrice).toLocaleString()})</span></p>
              {measuredTotal !== null && <p className="mt-1 flex items-center gap-1.5"><Package className="w-4 h-4 shrink-0" aria-hidden="true" /> <span>Total medido: <strong>{measuredTotal} {form.unit}</strong> ({form.quantity} × {form.presentation} {form.unit})</span></p>}
            </div>
          ) : (
            <Input label="Monto Total ($)" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Usado cuando no hay cantidad/valor unitario" />
          )}
          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={save} disabled={!form.description || (!computedTotal && !form.amount)}>{editing ? "Actualizar" : "Registrar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
