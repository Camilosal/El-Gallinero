"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";

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
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], type: "egreso", category: expenseCategories[0], description: "", counterparty: "", quantity: "", unitPrice: "", unit: "unidades", presentation: "", amount: "", notes: "" });
  const { values: incomeCats } = useCatalog("categoria_ingreso", incomeCategories);
  const { values: expenseCats } = useCatalog("categoria_egreso", expenseCategories);
  const { values: unitOptions } = useCatalog("unidad_medida", ["unidades", "kg", "lb", "litros", "docenas", "otro"]);
  const { values: buyerOptions } = useCatalog("comprador");
  const { values: supplierOptions } = useCatalog("proveedor");

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
  const marginPct = k ? pct(k.margin) : "—";
  const ratioPct = k ? pct(k.expenseRatio) : "—";

  return (
    <div>
      <PageHeader
        title="📈 Panel Financiero"
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
      ) : !data || !k ? null : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard icon="📥" label="Ingresos" value={fmt(k.totalIncome)} color="green" />
            <StatCard icon="📤" label="Egresos" value={fmt(k.totalExpense)} color="red" />
            <StatCard icon={positive ? "📈" : "📉"} label="Utilidad Neta" value={fmt(k.profit)} color={positive ? "blue" : "red"} />
            <StatCard icon="📅" label="Ingreso Prom. Diario" value={fmt(k.avgDailyIncome)} color="yellow" />
            <StatCard icon="💸" label="Egreso Prom. Diario" value={fmt(k.avgDailyExpense)} color="purple" />
            <StatCard icon="💧" label="Flujo Neto Diario" value={fmt(k.avgDailyNet)} color={k.avgDailyNet >= 0 ? "earth" : "red"} />
          </div>

          {/* Insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="!p-4 flex flex-col justify-between">
              <p className="text-sm text-slate-500">🥇 Mejor día</p>
              {k.bestDay ? (
                <>
                  <p className="text-lg font-bold text-green-600">{dateFmt(k.bestDay.date)}</p>
                  <p className="text-sm text-green-700">+{fmt(k.bestDay.profit)}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400 py-2">Sin datos</p>
              )}
            </Card>
            <Card className="!p-4 flex flex-col justify-between">
              <p className="text-sm text-slate-500">🥉 Peor día</p>
              {k.worstDay ? (
                <>
                  <p className="text-lg font-bold text-red-600">{dateFmt(k.worstDay.date)}</p>
                  <p className="text-sm text-red-700">{fmt(k.worstDay.profit)}</p>
                </>
              ) : (
                <p className="text-sm text-slate-400 py-2">Sin datos</p>
              )}
            </Card>
            <Card className="!p-4 flex flex-col justify-between">
              <p className="text-sm text-slate-500">🎯 Margen de utilidad</p>
              <p className={`text-2xl font-bold ${positive ? "text-green-600" : "text-red-600"}`}>{marginPct}</p>
              <p className="text-sm text-slate-500">Cada $1 ingresa → {ratioPct} se gastan</p>
            </Card>
            <Card className="!p-4 flex flex-col justify-between">
              <p className="text-sm text-slate-500">📆 Proyección mensual</p>
              <p className={`text-2xl font-bold ${k.projectedMonthly >= 0 ? "text-blue-600" : "text-red-600"}`}>{fmt(k.projectedMonthly)}</p>
              <p className="text-sm text-slate-500">{k.activeDays} días con movimiento</p>
            </Card>
          </div>

          {/* Behavior over time */}
          {data.series.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <h3 className="font-semibold text-slate-700 mb-4">📈 Comportamiento a través del tiempo</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.series}>
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
                <h3 className="font-semibold text-slate-700 mb-4">📊 Utilidad Acumulada</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.series}>
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
                    <Area type="monotone" dataKey="cumulative" name="Utilidad acumulada" stroke="#3b82f6" fill="url(#gCum)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {/* Pie charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">📊 Distribución de Egresos</h3>
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
              <h3 className="font-semibold text-slate-700 mb-4">📊 Distribución de Ingresos</h3>
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
              <h3 className="font-semibold text-green-700 mb-3">📥 Desglose de Ingresos</h3>
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
              <h3 className="font-semibold text-red-700 mb-3">📤 Desglose de Egresos</h3>
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
        <h3 className="font-semibold text-slate-700 mb-4">📋 Historial de Transacciones</h3>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : !data || data.transactions.length === 0 ? (
          <EmptyState icon="📈" message="No hay transacciones en este período" />
        ) : (
          <Table headers={["Fecha", "Tipo", "Categoría", "Descripción", "Contraparte", "Detalle", "Monto", ""]}>
            {data.transactions.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(t.date + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3">
                  <Badge color={t.type === "ingreso" ? "green" : "red"}>
                    {t.type === "ingreso" ? "📥 Ingreso" : "📤 Egreso"}
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
                    <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(t.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "✏️ Editar Transacción" : "💰 Nueva Transacción"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="Tipo" value={form.type} onChange={onTypeChange}>
            <option value="ingreso">📥 Ingreso</option>
            <option value="egreso">📤 Egreso</option>
          </Select>
          <Select label="Categoría" value={form.category} onChange={onCategoryChange}>
            {(form.type === "ingreso" ? incomeCats : expenseCats).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalle de la transacción..." required />
          {form.type === "ingreso" ? (
            <Input label="Cliente / A quién se le vendió" value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} placeholder="Nombre del comprador" list="catalog-finanzas-compradores" />
          ) : (
            <Input label="Proveedor / Dónde se compró" value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} placeholder="Nombre del proveedor o tienda" list="catalog-finanzas-proveedores" />
          )}
          <datalist id="catalog-finanzas-compradores">
            {buyerOptions.map((b) => <option key={b} value={b} />)}
          </datalist>
          <datalist id="catalog-finanzas-proveedores">
            {supplierOptions.map((s) => <option key={s} value={s} />)}
          </datalist>
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
              <p>🧮 Total calculado: <strong className="text-xl">${Number(computedTotal).toLocaleString()}</strong> ({form.quantity} × ${Number(form.unitPrice).toLocaleString()})</p>
              {measuredTotal !== null && <p className="mt-1">📦 Total medido: <strong>{measuredTotal} {form.unit}</strong> ({form.quantity} × {form.presentation} {form.unit})</p>}
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
