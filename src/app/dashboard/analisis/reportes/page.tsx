"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Card, Input, Button, Table, EmptyState } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";

interface PLData {
  from: string;
  to: string;
  income: { categories: { category: string; total: number }[]; total: number };
  expenses: { categories: { category: string; total: number }[]; total: number };
  netProfit: number;
  transactionCount: number;
}

interface RentData {
  from: string;
  to: string;
  productLines: { line: string; revenue: number; cost: number; profit: number }[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

const LINE_LABELS: Record<string, string> = {
  huevos: "🥚 Huevos",
  carne: "🍗 Carne",
  gallinaza: "🌱 Gallinaza",
  aves: "🐔 Aves",
  otros: "📦 Otros",
};

const COLORS = ["#22c55e", "#eab308", "#3b82f6", "#ef4444", "#a855f7"];
const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function ReportesPage() {
  const [tab, setTab] = useState<"pl" | "rent">("pl");
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [plData, setPlData] = useState<PLData | null>(null);
  const [rentData, setRentData] = useState<RentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [incomeSearch, setIncomeSearch] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [lineSearch, setLineSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const promises: Promise<void>[] = [];

    if (tab === "pl") {
      promises.push(
        apiFetch(`/api/analisis/reportes/estado-resultados?from=${from}&to=${to}`)
          .then((r) => r.json())
          .then(setPlData)
      );
    } else {
      promises.push(
        apiFetch(`/api/analisis/reportes/rentabilidad?from=${from}&to=${to}`)
          .then((r) => r.json())
          .then(setRentData)
      );
    }

    Promise.all(promises).finally(() => setLoading(false));
  }, [tab, from, to]);

  useEffect(() => { load(); }, [load]);

  const rentPie = rentData?.productLines
    .filter((l) => l.revenue > 0 || l.cost > 0)
    .map((l, i) => ({
      name: LINE_LABELS[l.line] || l.line,
      value: Math.abs(l.profit),
      color: COLORS[i % COLORS.length],
    })) || [];

  const filteredIncome = useMemo(() => {
    const categories = plData?.income.categories ?? [];
    if (!incomeSearch.trim()) return categories;
    return categories.filter((category) =>
      matchesTextQuery(incomeSearch, [category.category, category.total]),
    );
  }, [plData, incomeSearch]);

  const filteredExpenses = useMemo(() => {
    const categories = plData?.expenses.categories ?? [];
    if (!expenseSearch.trim()) return categories;
    return categories.filter((category) =>
      matchesTextQuery(expenseSearch, [category.category, category.total]),
    );
  }, [plData, expenseSearch]);

  const filteredProductLines = useMemo(() => {
    const lines = rentData?.productLines ?? [];
    if (!lineSearch.trim()) return lines;
    return lines.filter((line) =>
      matchesTextQuery(lineSearch, [
        LINE_LABELS[line.line] || line.line,
        line.revenue,
        line.cost,
        line.profit,
      ]),
    );
  }, [rentData, lineSearch]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="📋 Reportes"
        description="Estado de resultados y rentabilidad por línea de producto"
        help="Genera reportes financieros del gallinero. El 'Estado de Resultados' muestra ingresos vs gastos por categoría en el período seleccionado, con utilidad neta y margen. La 'Rentabilidad por Línea' desglosa cuánto genera cada producto (huevos, carne, gallinaza, aves, pollitos) descontando sus costos directos. Los gráficos de pastel y barras facilitan la visualización."
      />

      {/* Tab selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("pl")}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${tab === "pl" ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
        >
          Estado de Resultados
        </button>
        <button
          onClick={() => setTab("rent")}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${tab === "rent" ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
        >
          Rentabilidad
        </button>
      </div>

      {/* Date range picker */}
      <Card className="!p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Input label="Desde" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="Hasta" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button onClick={load}>Consultar</Button>
        </div>
      </Card>

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : tab === "pl" && plData ? (
        <>
          {/* P&L Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="!p-4 text-center">
              <p className="text-sm text-slate-500">Ingresos</p>
              <p className="text-2xl font-bold text-green-600">{fmt(plData.income.total)}</p>
            </Card>
            <Card className="!p-4 text-center">
              <p className="text-sm text-slate-500">Egresos</p>
              <p className="text-2xl font-bold text-red-600">{fmt(plData.expenses.total)}</p>
            </Card>
            <Card className="!p-4 text-center">
              <p className="text-sm text-slate-500">Utilidad Neta</p>
              <p className={`text-2xl font-bold ${plData.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(plData.netProfit)}</p>
            </Card>
          </div>

          {/* Income categories */}
          <Card>
            <h3 className="font-semibold text-green-700 mb-3">📥 Ingresos por Categoría</h3>
            <TableSearch
              value={incomeSearch}
              onChange={setIncomeSearch}
              placeholder="Buscar categoría de ingreso..."
              resultCount={filteredIncome.length}
              totalCount={plData.income.categories.length}
              className="mb-4"
            />
            {filteredIncome.length === 0 ? (
              <EmptyState
                icon="📥"
                message={
                  incomeSearch.trim()
                    ? "No hay categorías que coincidan con la búsqueda"
                    : "Sin ingresos en el período"
                }
              />
            ) : (
              <Table headers={["Categoría", "Monto", "% del Total"]}>
                {filteredIncome.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">{c.category}</td>
                    <td className="px-4 py-3 text-sm text-green-600 font-bold">{fmt(c.total)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {plData.income.total > 0 ? ((c.total / plData.income.total) * 100).toFixed(1) : 0}%
                    </td>
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

          {/* Expense categories */}
          <Card>
            <h3 className="font-semibold text-red-700 mb-3">📤 Egresos por Categoría</h3>
            <TableSearch
              value={expenseSearch}
              onChange={setExpenseSearch}
              placeholder="Buscar categoría de egreso..."
              resultCount={filteredExpenses.length}
              totalCount={plData.expenses.categories.length}
              className="mb-4"
            />
            {filteredExpenses.length === 0 ? (
              <EmptyState
                icon="📤"
                message={
                  expenseSearch.trim()
                    ? "No hay categorías que coincidan con la búsqueda"
                    : "Sin egresos en el período"
                }
              />
            ) : (
              <Table headers={["Categoría", "Monto", "% del Total"]}>
                {filteredExpenses.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium">{c.category}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-bold">{fmt(c.total)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {plData.expenses.total > 0 ? ((c.total / plData.expenses.total) * 100).toFixed(1) : 0}%
                    </td>
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

          {/* Net profit summary */}
          <Card className={plData.netProfit >= 0 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}>
            <div className="text-center py-4">
              <p className="text-sm text-slate-600">Utilidad Neta del Período</p>
              <p className={`text-3xl font-bold ${plData.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                {fmt(plData.netProfit)}
              </p>
              <p className="text-sm text-slate-500 mt-2">{plData.transactionCount} transacciones registradas</p>
            </div>
          </Card>
        </>
      ) : tab === "rent" && rentData ? (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="!p-4 text-center">
              <p className="text-sm text-slate-500">Ingresos totales</p>
              <p className="text-2xl font-bold text-green-600">{fmt(rentData.totalRevenue)}</p>
            </Card>
            <Card className="!p-4 text-center">
              <p className="text-sm text-slate-500">Costos totales</p>
              <p className="text-2xl font-bold text-red-600">{fmt(rentData.totalCost)}</p>
            </Card>
            <Card className="!p-4 text-center">
              <p className="text-sm text-slate-500">Utilidad total</p>
              <p className={`text-2xl font-bold ${rentData.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(rentData.totalProfit)}</p>
            </Card>
          </div>

          {/* Pie chart */}
          {rentPie.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-4">Rentabilidad por Línea de Producto</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={rentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`} fontSize={11}>
                    {rentPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Table */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-3">Detalle por Línea de Producto</h3>
            <TableSearch
              value={lineSearch}
              onChange={setLineSearch}
              placeholder="Buscar línea de producto..."
              resultCount={filteredProductLines.length}
              totalCount={rentData.productLines.length}
              className="mb-4"
            />
            {filteredProductLines.length === 0 ? (
              <EmptyState
                icon="📋"
                message={
                  lineSearch.trim()
                    ? "No hay líneas que coincidan con la búsqueda"
                    : "Sin datos de rentabilidad"
                }
              />
            ) : (
            <Table headers={["Línea", "Ingresos", "Costos", "Utilidad", "Margen"]}>
              {filteredProductLines.map((l, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium">{LINE_LABELS[l.line] || l.line}</td>
                  <td className="px-4 py-3 text-sm text-green-600">{fmt(l.revenue)}</td>
                  <td className="px-4 py-3 text-sm text-red-600">{fmt(l.cost)}</td>
                  <td className={`px-4 py-3 text-sm font-bold ${l.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(l.profit)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {l.revenue > 0 ? ((l.profit / l.revenue) * 100).toFixed(1) : "0"}%
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-4 py-3 text-sm">Total</td>
                <td className="px-4 py-3 text-sm text-green-700">{fmt(rentData.totalRevenue)}</td>
                <td className="px-4 py-3 text-sm text-red-700">{fmt(rentData.totalCost)}</td>
                <td className={`px-4 py-3 text-sm ${rentData.totalProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(rentData.totalProfit)}</td>
                <td className="px-4 py-3 text-sm">
                  {rentData.totalRevenue > 0 ? ((rentData.totalProfit / rentData.totalRevenue) * 100).toFixed(1) : "0"}%
                </td>
              </tr>
            </Table>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
