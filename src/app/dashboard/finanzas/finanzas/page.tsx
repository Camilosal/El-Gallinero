"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Calculator, CalendarDays, ClipboardList, Package, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import ContactField from "@/components/contacts/ContactField";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";

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
  byCategory: ByCategory[];
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
  "Compra de insumos",
  "Control sanitario",
  "Mantenimiento",
  "Mano de obra",
  "Servicios (agua/luz)",
  "Compra de gallinas",
  "Equipamiento",
  "Transporte",
  "Otro egreso",
];

const COLORS = ["#22c55e", "#eab308", "#3b82f6", "#ef4444", "#a855f7", "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#64748b"];

const defaultUnitByCategory: Record<string, string> = {
  "Compra de alimento": "kg",
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
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], type: "egreso", category: expenseCategories[0], description: "", counterparty: "", quantity: "", unitPrice: "", unit: "unidades", presentation: "", amount: "", notes: "" });
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
    setForm({ date: new Date().toISOString().split("T")[0], type: "egreso", category: expenseCategories[0], description: "", counterparty: "", quantity: "", unitPrice: "", unit: "unidades", presentation: "", amount: "", notes: "" });
    setModalOpen(true);
  };
  useActionQuery(searchParams.get("nuevo"), { "1": openNew });

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setError("");
    setForm({ date: t.date, type: t.type, category: t.category, description: t.description, counterparty: t.counterparty || "", quantity: t.quantity || "", unitPrice: t.unitPrice || "", unit: t.unit || "unidades", presentation: t.presentation || "", amount: t.amount, notes: t.notes || "" });
    setModalOpen(true);
  };

  const onTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value;
    const firstCat = t === "ingreso" ? (incomeCats[0] || incomeCategories[0]) : (expenseCats[0] || expenseCategories[0]);
    const unit = defaultUnitByCategory[firstCat];
    setForm({ ...form, type: t, category: firstCat, ...(unit ? { unit } : {}) });
  };

  const onCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    const unit = defaultUnitByCategory[category];
    setForm({ ...form, category, ...(unit ? { unit } : {}) });
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

  const expensePie = data?.byCategory.filter((c) => c.type === "egreso").map((c, i) => ({
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
          <div className="flex gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="365">Último año</option>
            </Select>
            <Button onClick={openNew}>+ Nueva Transacción</Button>
          </div>
        }
      />

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : !data || !k || !cash ? null : (
        <>
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
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v, name) => [fmt(Number(v)), name]} />
                    <Legend />
                    <Area type="monotone" dataKey="income" name="Ingresos" stroke="#22c55e" fill="url(#gInc)" />
                    <Area type="monotone" dataKey="expense" name="Egresos" stroke="#ef4444" fill="url(#gExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-slate-500" aria-hidden="true" />Flujo neto acumulado</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.cashflow.series}>
                    <defs>
                      <linearGradient id="gCum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v, name) => [fmt(Number(v)), name]} />
                    <Area type="monotone" dataKey="cumulative" name="Flujo acumulado" stroke="#3b82f6" fill="url(#gCum)" />
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
              <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" aria-hidden="true" />Desglose de Egresos</h3>
              {data.byCategory.filter((c) => c.type === "egreso").length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Sin egresos registrados</p>
              ) : (
                <div className="space-y-2">
                  {data.byCategory.filter((c) => c.type === "egreso").map((c, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-sm">{c.category}</span>
                      <span className="font-semibold text-red-700">${Number(c.total).toLocaleString()}</span>
                    </div>
                  ))}
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
                <td className="px-4 py-3 text-sm font-medium">{t.category}</td>
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
          <Select label="Categoría" value={form.category} onChange={onCategoryChange}>
            {(form.type === "ingreso" ? incomeCats : expenseCats).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
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
