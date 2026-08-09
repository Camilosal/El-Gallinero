"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { apiFetch } from "@/lib/fetch";

interface BudgetItem {
  id: string;
  budgetId: string;
  category: string;
  description: string | null;
  monthlyTarget: string;
  unit: string | null;
  notes: string | null;
  actualAmount?: number;
  target?: number;
  actual?: number;
  variance?: number;
  variancePct?: number;
}

interface Budget {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  type: string;
  items: BudgetItem[];
}

const budgetTypes = ["ingreso", "egreso", "mixto"];
const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function PresupuestosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailBudget, setDetailBudget] = useState<Budget | null>(null);
  const [comparativo, setComparativo] = useState<BudgetItem[]>([]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", periodStart: "", periodEnd: "", type: budgetTypes[0] });
  const [items, setItems] = useState<{ category: string; description: string; monthlyTarget: string; unit: string }[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/finanzas/presupuestos")
      .then((r) => r.json())
      .then(setBudgets)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (b: Budget) => {
    setDetailBudget(b);
    const res = await apiFetch(`/api/finanzas/presupuestos/comparativo?budgetId=${b.id}`);
    if (res.ok) {
      const data = await res.json();
      setComparativo(data.items);
    }
  };

  const addItem = () => {
    setItems([...items, { category: "", description: "", monthlyTarget: "", unit: "" }]);
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const save = async () => {
    setError("");
    if (!form.name || !form.periodStart || !form.periodEnd) {
      return setError("Nombre y período son requeridos");
    }
    const validItems = items.filter((i) => i.category && i.monthlyTarget);
    if (validItems.length === 0) {
      return setError("Agregue al menos un item con categoría y meta");
    }

    const res = await apiFetch("/api/finanzas/presupuestos", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...form, items: validItems }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "Error al guardar");
    }
    setModalOpen(false);
    setEditingId(null);
    setForm({ name: "", periodStart: "", periodEnd: "", type: budgetTypes[0] });
    setItems([]);
    load();
  };

  const removeBudget = async (id: string) => {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    await apiFetch(`/api/finanzas/presupuestos?id=${id}`, { method: "DELETE" });
    load();
  };

  const editBudget = (b: Budget) => {
    setEditingId(b.id);
    setForm({ name: b.name, periodStart: b.periodStart, periodEnd: b.periodEnd, type: b.type });
    setItems(b.items.map((item) => ({
      category: item.category,
      description: item.description || "",
      monthlyTarget: item.monthlyTarget,
      unit: item.unit || "",
    })));
    setError("");
    setModalOpen(true);
  };

  const varianceData = comparativo.map((c) => ({
    category: c.category,
    objetivo: c.target || 0,
    real: c.actual || 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="📅 Presupuestos"
        description="Planificación y control presupuestario"
        help="Planifica y controla los ingresos y gastos del gallinero por período.\n\n• Crea presupuestos con metas mensuales por categoría (ej: $500.000/mes en venta de huevos).\n• El sistema compara automáticamente lo presupuestado vs lo real.\n• Las variaciones se muestran en porcentaje para identificar desviaciones.\n• Útil para planificar el crecimiento del negocio."
        actions={
          <Button onClick={() => { setEditingId(null); setForm({ name: "", periodStart: "", periodEnd: "", type: budgetTypes[0] }); setItems([]); setError(""); setModalOpen(true); }}>
            + Nuevo Presupuesto
          </Button>
        }
      />

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : budgets.length === 0 ? (
        <EmptyState icon="📅" message="No hay presupuestos creados" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon="📅" label="Presupuestos" value={String(budgets.length)} color="blue" />
            <StatCard icon="📊" label="Items totales" value={String(budgets.reduce((s, b) => s + b.items.length, 0))} color="green" />
            <StatCard icon="💰" label="Meta total" value={fmt(budgets.reduce((s, b) => s + b.items.reduce((is, i) => is + Number(i.monthlyTarget), 0), 0))} color="yellow" />
          </div>

          <Card>
            <h3 className="font-semibold text-slate-700 mb-3">Lista de Presupuestos</h3>
            <Table headers={["Nombre", "Tipo", "Período", "Items", "Acciones"]}>
              {budgets.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium">{b.name}</td>
                  <td className="px-4 py-3"><Badge color={b.type === "ingreso" ? "green" : b.type === "egreso" ? "red" : "blue"}>{b.type}</Badge></td>
                  <td className="px-4 py-3 text-sm">{b.periodStart} a {b.periodEnd}</td>
                  <td className="px-4 py-3 text-sm">{b.items.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openDetail(b)} className="text-blue-600 hover:underline text-xs">Ver detalle</button>
                      <button onClick={() => editBudget(b)} className="text-amber-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => removeBudget(b.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}

      {/* Detail view */}
      {detailBudget && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700">📊 Comparativo: {detailBudget.name}</h3>
            <button onClick={() => setDetailBudget(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
          </div>

          {comparativo.length === 0 ? (
            <EmptyState icon="📊" message="Sin datos de comparativo" />
          ) : (
            <>
              <Table headers={["Categoría", "Objetivo", "Real", "Varianza", "% Varianza", "Progreso"]}>
                {comparativo.map((c, i) => {
                  const progress = c.target && c.target > 0 ? Math.min(100, ((c.actual || 0) / c.target) * 100) : 0;
                  const isOverBudget = (c.variance || 0) > 0 && detailBudget.type === "egreso";
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium">{c.category}</td>
                      <td className="px-4 py-3 text-sm">{fmt(c.target || 0)}</td>
                      <td className="px-4 py-3 text-sm font-bold">{fmt(c.actual || 0)}</td>
                      <td className={`px-4 py-3 text-sm ${isOverBudget ? "text-red-600" : "text-green-600"}`}>
                        {(c.variance || 0) >= 0 ? "+" : ""}{fmt(c.variance || 0)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${(c.variancePct || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                        {(c.variancePct || 0) > 0 ? "+" : ""}{c.variancePct || 0}%
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${progress > 100 ? "bg-red-500" : progress > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{progress.toFixed(0)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </Table>

              {/* Variance chart */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-600 mb-3">Objetivo vs Real</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={varianceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" fontSize={10} angle={-20} textAnchor="end" height={60} />
                    <YAxis fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                    <Legend />
                    <Bar dataKey="objetivo" name="Objetivo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="real" name="Real" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Create modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); }} title={editingId ? "✏️ Editar Presupuesto" : "📅 Nuevo Presupuesto"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Presupuesto Q1 2025" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha inicio" type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} required />
            <Input label="Fecha fin" type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} required />
          </div>
          <Select label="Tipo" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {budgetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-semibold text-slate-700">Items del presupuesto</h4>
              <Button variant="secondary" onClick={addItem}>+ Item</Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2 items-end">
                <div className="flex-1">
                  <Input placeholder="Categoría" value={item.category} onChange={(e) => updateItem(i, "category", e.target.value)} />
                </div>
                <div className="w-32">
                  <Input placeholder="Meta mensual $" type="number" value={item.monthlyTarget} onChange={(e) => updateItem(i, "monthlyTarget", e.target.value)} />
                </div>
                <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 pb-2 px-1">&times;</button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button onClick={save}>{editingId ? "Actualizar" : "Guardar"}</Button>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditingId(null); }}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
