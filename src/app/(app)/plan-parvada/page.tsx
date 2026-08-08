"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Textarea, EmptyState, StatCard } from "@/components/ui";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";
import { apiFetch } from "@/lib/fetch";

interface Milestone {
  id: string;
  planId: string;
  weekNumber: number;
  expectedHens: number | null;
  expectedEggsPerWeek: number | null;
  expectedFeedKgPerWeek: string | null;
  actualHens: number | null;
  actualEggsPerWeek: number | null;
}

interface FlockPlan {
  id: string;
  name: string;
  startDate: string;
  targetHenCount: number;
  targetRoosterCount: number | null;
  replacementDate: string | null;
  currentPhase: string | null;
  status: string;
  notes: string | null;
  milestones: Milestone[];
}

export default function PlanParvadaPage() {
  const [plans, setPlans] = useState<FlockPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", startDate: new Date().toISOString().split("T")[0], targetHenCount: "", targetRoosterCount: "", replacementDate: "", notes: "" });
  const [selectedPlan, setSelectedPlan] = useState<FlockPlan | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/plan-parvada")
      .then((r) => r.json())
      .then((data: FlockPlan[]) => {
        setPlans(data);
        if (data.length > 0 && !selectedPlan) {
          setSelectedPlan(data[0]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const activePlans = plans.filter((p) => p.status === "activo");

  const save = async () => {
    setError("");
    if (!form.name || !form.startDate || !form.targetHenCount) {
      return setError("Nombre, fecha y cantidad de gallinas son requeridos");
    }

    const res = await apiFetch("/api/plan-parvada", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        targetHenCount: Number(form.targetHenCount),
        targetRoosterCount: form.targetRoosterCount ? Number(form.targetRoosterCount) : null,
        replacementDate: form.replacementDate || null,
      }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "Error al crear el plan");
    }

    setModalOpen(false);
    setForm({ name: "", startDate: new Date().toISOString().split("T")[0], targetHenCount: "", targetRoosterCount: "", replacementDate: "", notes: "" });
    load();
  };

  const removePlan = async (id: string) => {
    if (!confirm("¿Eliminar este plan y todos sus hitos?")) return;
    await apiFetch(`/api/plan-parvada?id=${id}`, { method: "DELETE" });
    setSelectedPlan(null);
    load();
  };

  // Build chart data from milestones
  const chartData = selectedPlan?.milestones.map((m) => ({
    week: `S${m.weekNumber}`,
    esperado: m.expectedEggsPerWeek,
    real: m.actualEggsPerWeek,
  })) || [];

  // Current week calculation
  const currentWeek = selectedPlan
    ? Math.max(1, Math.ceil((Date.now() - new Date(selectedPlan.startDate + "T12:00:00").getTime()) / (7 * 24 * 60 * 60 * 1000)))
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="🐣 Plan de Parvada"
        description="Planificación y seguimiento del ciclo productivo"
        actions={
          <Button onClick={() => { setForm({ name: "", startDate: new Date().toISOString().split("T")[0], targetHenCount: "", targetRoosterCount: "", replacementDate: "", notes: "" }); setError(""); setModalOpen(true); }}>
            + Nuevo Plan
          </Button>
        }
      />

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : plans.length === 0 ? (
        <EmptyState icon="🐣" message="No hay planes de parvada creados" />
      ) : (
        <>
          {/* Plan selector */}
          {plans.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {plans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlan(p)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${selectedPlan?.id === p.id ? "bg-green-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {selectedPlan && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="🐣" label="Plan" value={selectedPlan.name} color="green" />
                <StatCard icon="🐔" label="Gallinas objetivo" value={String(selectedPlan.targetHenCount)} color="yellow" />
                <StatCard icon="📅" label="Semana actual" value={`S${currentWeek}`} color="blue" />
                <StatCard icon="📊" label="Estado" value={selectedPlan.status} color="purple" />
              </div>

              {/* Production curve chart */}
              {chartData.length > 0 && (
                <Card>
                  <h3 className="font-semibold text-slate-700 mb-4">📈 Curva de Producción (Esperado vs Real)</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gExpected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" fontSize={9} interval={Math.floor(chartData.length / 20)} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="esperado" name="Esperado" stroke="#3b82f6" fill="url(#gExpected)" />
                      <Area type="monotone" dataKey="real" name="Real" stroke="#22c55e" fill="url(#gActual)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Milestone table */}
              <Card>
                <h3 className="font-semibold text-slate-700 mb-3">Hitos del Plan</h3>
                <Table headers={["Semana", "Gallinas Esp.", "Huevos/Sem Esp.", "Alimento Esp. (kg)", "Gallinas Real", "Huevos/Sem Real", "Cumplimiento"]}>
                  {selectedPlan.milestones.map((m) => {
                    const expected = m.expectedEggsPerWeek || 0;
                    const actual = m.actualEggsPerWeek || 0;
                    const pct = expected > 0 ? (actual / expected) * 100 : 0;
                    const isCurrentWeek = m.weekNumber === currentWeek;
                    return (
                      <tr key={m.id} className={`hover:bg-slate-50 ${isCurrentWeek ? "bg-blue-50 border-l-4 border-blue-400" : ""}`}>
                        <td className="px-4 py-3 text-sm font-medium">
                          S{m.weekNumber}
                          {isCurrentWeek && <Badge color="blue">Actual</Badge>}
                        </td>
                        <td className="px-4 py-3 text-sm">{m.expectedHens ?? "—"}</td>
                        <td className="px-4 py-3 text-sm">{m.expectedEggsPerWeek ?? "—"}</td>
                        <td className="px-4 py-3 text-sm">{m.expectedFeedKgPerWeek ?? "—"}</td>
                        <td className="px-4 py-3 text-sm">{m.actualHens ?? "—"}</td>
                        <td className="px-4 py-3 text-sm">{m.actualEggsPerWeek ?? "—"}</td>
                        <td className="px-4 py-3 text-sm">
                          {actual > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${pct >= 90 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                              <span className="text-xs">{pct.toFixed(0)}%</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Table>
              </Card>

              {/* Delete plan */}
              <div className="flex justify-end">
                <Button variant="danger" onClick={() => removePlan(selectedPlan.id)}>Eliminar Plan</Button>
              </div>
            </>
          )}
        </>
      )}

      {/* Create modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="🐣 Nuevo Plan de Parvada">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Nombre del plan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Parvada 2025-A" required />
          <Input label="Fecha de inicio" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
          <Input label="Cantidad de gallinas" type="number" min="1" value={form.targetHenCount} onChange={(e) => setForm({ ...form, targetHenCount: e.target.value })} required />
          <Input label="Cantidad de gallos" type="number" min="0" value={form.targetRoosterCount} onChange={(e) => setForm({ ...form, targetRoosterCount: e.target.value })} placeholder="Opcional" />
          <Input label="Fecha de reemplazo" type="date" value={form.replacementDate} onChange={(e) => setForm({ ...form, replacementDate: e.target.value })} placeholder="Opcional" />
          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones del plan..." />
          <p className="text-xs text-slate-500">Se generarán automáticamente 80 hitos semanales con curvas de producción esperada.</p>
          <div className="flex gap-3">
            <Button onClick={save}>Crear Plan</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
