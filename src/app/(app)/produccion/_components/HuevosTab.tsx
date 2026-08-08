"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, Modal, Input, Textarea, EmptyState, StatCard, Badge } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, ReferenceLine } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";

interface EggDetail {
  size: string;
  quantity: number;
}

interface EggRecord {
  id: string;
  date: string;
  totalCollected: number;
  broken: number;
  forIncubation: number;
  notes: string | null;
  details: EggDetail[];
}

interface StageEggData {
  name: string;
  count: number;
  expectedEggsPerDay: number;
}

const SIZE_COLORS: Record<string, string> = {
  Jumbo: "#7c3aed",
  Extra: "#3b82f6",
  Grande: "#22c55e",
  Mediano: "#eab308",
  Pequeño: "#f97316",
};

const stageColors: Record<string, string> = {
  Pollito: "yellow",
  Juvenil: "blue",
  "Pre-postura": "purple",
  Postura: "green",
};

export default function HuevosPage() {
  const [records, setRecords] = useState<EggRecord[]>([]);
  const [stageData, setStageData] = useState<StageEggData[]>([]);
  const [totalExpected, setTotalExpected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EggRecord | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ date: string; sizes: Record<string, number>; broken: number; forIncubation: number; notes: string }>({
    date: new Date().toISOString().split("T")[0],
    sizes: {},
    broken: 0,
    forIncubation: 0,
    notes: "",
  });
  const [confirmOverLimit, setConfirmOverLimit] = useState(false);
  const [overLimitMsg, setOverLimitMsg] = useState("");
  const { items: sizeOptions } = useCatalog("tamano_huevo");

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/huevos").then((r) => r.json()),
      apiFetch("/api/etapas/resumen").then((r) => r.json()),
    ]).then(([eggs, resumen]) => {
      setRecords(eggs);
      setStageData(resumen.stages || []);
      setTotalExpected(resumen.totalExpectedEggsPerDay || 0);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const sizesTotal = sizeOptions.reduce((s, o) => s + (form.sizes[o.value] || 0), 0);
  const totalCollected = sizesTotal + form.broken + form.forIncubation;

  const openNew = () => {
    setEditing(null);
    setError("");
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    setForm({ date: new Date().toISOString().split("T")[0], sizes: {}, broken: 0, forIncubation: 0, notes: "" });
    setModalOpen(true);
  };

  const openEdit = (r: EggRecord) => {
    setEditing(r);
    setError("");
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    const sizes: Record<string, number> = {};
    r.details.forEach((d) => { sizes[d.size] = d.quantity; });
    setForm({ date: r.date, sizes, broken: r.broken, forIncubation: r.forIncubation, notes: r.notes || "" });
    setModalOpen(true);
  };

  const setSizeQty = (size: string, qty: number) => {
    setForm({ ...form, sizes: { ...form.sizes, [size]: qty } });
  };

  const save = async (overrideValidation = false) => {
    setError("");
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing.id } : form;
    const sizes = sizeOptions.map((o) => ({ size: o.value, quantity: form.sizes[o.value] || 0 })).filter((x) => x.quantity > 0);
    const res = await apiFetch("/api/huevos", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, sizes, totalCollected, overrideValidation }),
    });
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      setOverLimitMsg(data.error || "Producción inusualmente alta");
      setConfirmOverLimit(true);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar el registro");
      return;
    }
    setModalOpen(false);
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    load();
  };

  const confirmAndSave = () => {
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    save(true);
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    await apiFetch(`/api/huevos?id=${id}`, { method: "DELETE" });
    load();
  };

  const totalAll = records.reduce((s, r) => s + r.totalCollected, 0);
  const totalBroken = records.reduce((s, r) => s + r.broken, 0);
  const totalIncub = records.reduce((s, r) => s + r.forIncubation, 0);
  const avgDaily = records.length > 0 ? Math.round(totalAll / records.length) : 0;
  const bySizeTotals = sizeOptions.map((o) => ({
    size: o.value,
    total: records.reduce((s, r) => s + (r.details.find((d) => d.size === o.value)?.quantity || 0), 0),
  }));

  const chartData = records.slice(0, 30).reverse().map((r) => {
    const row: Record<string, number | string> = {
      fecha: new Date(r.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" }),
    };
    sizeOptions.forEach((o) => { row[o.value] = r.details.find((d) => d.size === o.value)?.quantity || 0; });
    row.Rotos = r.broken;
    row.Incubación = r.forIncubation;
    if (totalExpected > 0) row.Proyección = totalExpected;
    return row;
  });

  const sizeHeaders = sizeOptions.map((o) => o.value);

  return (
    <div>
      <PageHeader
        title="🥚 Producción de Huevos"
        description="Registro diario de recolección clasificada por tamaño según el catálogo"
        actions={<Button onClick={openNew}>+ Registrar Recolección</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon="🥚" label="Total Recolectados" value={totalAll} color="yellow" />
        <StatCard icon="📊" label="Promedio Real/día" value={avgDaily} color="blue" />
        <StatCard icon="🎯" label="Esperado/día" value={totalExpected} color="green" />
        <StatCard icon="💔" label="Rotos" value={totalBroken} color="red" />
        <StatCard icon="🐣" label="Para Incubación" value={totalIncub} color="purple" />
      </div>

      {/* Expected Production by Stage */}
      {stageData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-3">🎯 Producción Esperada por Etapa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stageData.map((stage) => (
              <div key={stage.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <Badge color={stageColors[stage.name] || "gray"}>{stage.name}</Badge>
                  <p className="text-xs text-slate-500 mt-1">{stage.count} gallina{stage.count !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-yellow-700">{stage.expectedEggsPerDay}</p>
                  <p className="text-xs text-slate-500">huevos/día</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200 flex justify-between items-center">
            <span className="text-sm font-semibold text-green-700">TOTAL ESPERADO</span>
            <span className="text-xl font-bold text-green-700">{totalExpected} huevos/día</span>
          </div>
          {avgDaily > 0 && totalExpected > 0 && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg flex justify-between items-center">
              <span className="text-sm font-semibold text-blue-700">RENDIMIENTO</span>
              <span className={`text-xl font-bold ${avgDaily >= totalExpected ? "text-green-600" : "text-orange-600"}`}>
                {Math.round((avgDaily / totalExpected) * 100)}%
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">📊 Producción por Tamaño (últimos 30 registros)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" fontSize={10} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              {sizeOptions.map((o) => (
                <Bar key={o.id} dataKey={o.value} stackId="a" fill={SIZE_COLORS[o.value] || "#94a3b8"} />
              ))}
              <Bar dataKey="Rotos" stackId="a" fill="#ef4444" />
              <Bar dataKey="Incubación" stackId="a" fill="#a855f7" />
              {totalExpected > 0 && (
                <Line type="monotone" dataKey="Proyección" stroke="#16a34a" strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="line" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : records.length === 0 ? (
          <EmptyState icon="🥚" message="No hay registros de producción" />
        ) : (
          <Table headers={["Fecha", ...sizeHeaders, "Rotos", "Incubación", "Notas", ""]}>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{new Date(r.date + "T12:00:00").toLocaleDateString("es")}</td>
                {sizeOptions.map((o) => (
                  <td key={o.id} className="px-4 py-3 text-slate-700">{r.details.find((d) => d.size === o.value)?.quantity || 0}</td>
                ))}
                <td className="px-4 py-3 text-red-600">{r.broken}</td>
                <td className="px-4 py-3 text-purple-600">{r.forIncubation}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate">{r.notes || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(r.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "✏️ Editar Recolección" : "🥚 Registrar Recolección de Huevos"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Fecha de Recolección" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            {sizeOptions.map((o) => (
              <Input
                key={o.id}
                label={`${o.value}${o.price ? ` ($${Number(o.price).toLocaleString()})` : ""}`}
                type="number"
                min="0"
                value={form.sizes[o.value] || 0}
                onChange={(e) => setSizeQty(o.value, parseInt(e.target.value) || 0)}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Rotos / Dañados" type="number" min="0" value={form.broken} onChange={(e) => setForm({ ...form, broken: parseInt(e.target.value) || 0 })} />
            <Input label="Para Incubación (seleccionados)" type="number" min="0" value={form.forIncubation} onChange={(e) => setForm({ ...form, forIncubation: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="p-3 bg-farm-50 rounded-lg">
            <p className="text-sm font-medium text-farm-700">Total a registrar: <span className="text-xl font-bold">{totalCollected}</span> huevos</p>
            {totalExpected > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Producción esperada: <strong className="text-green-700">{totalExpected}</strong> huevos/día
                {totalCollected > 0 && (
                  <span className={totalCollected > totalExpected * 1.5 ? " text-red-600 font-semibold" : ""}>
                    {" "}— {Math.round((totalCollected / totalExpected) * 100)}% de lo esperado
                  </span>
                )}
              </p>
            )}
          </div>
          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones de la recolección..." />
          {confirmOverLimit && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <p className="text-sm text-amber-800 font-semibold mb-1">⚠️ Producción inusualmente alta</p>
              <p className="text-xs text-amber-700 mb-3">{overLimitMsg}</p>
              <div className="flex gap-2">
                <button onClick={confirmAndSave} className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700">
                  Sí, es correcto — Guardar así
                </button>
                <button onClick={() => { setConfirmOverLimit(false); setOverLimitMsg(""); }} className="px-3 py-1.5 bg-white text-amber-700 text-xs rounded-lg border border-amber-300 hover:bg-amber-50">
                  Revisar cantidades
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={() => save()} disabled={totalCollected === 0 || confirmOverLimit}>{editing ? "Actualizar Registro" : "Registrar Recolección"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
