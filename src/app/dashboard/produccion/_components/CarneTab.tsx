"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader, Button, Card, Table, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";

interface SlaughterRecord {
  id: string;
  date: string;
  birdType: string;
  quantity: number;
  weightKg: string;
  destination: string;
  henId: string | null;
  roosterId: string | null;
  batchId: string | null;
  notes: string | null;
  hen?: { id: string; code: string; weight: string; status: string } | null;
  rooster?: { id: string; code: string; status: string } | null;
  batch?: { id: string; code: string; status: string } | null;
}

interface Hen { id: string; code: string; weight: string; status: string; birthDate: string; }
interface Rooster { id: string; code: string; weight: string | null; status: string; }
interface Batch { id: string; code: string; currentQuantity: number; status: string; }

const birdTypeLabels: Record<string, string> = {
  gallina_descarte: "Gallina descarte",
  pollo: "Pollo",
  gallo: "Gallo",
};

const destinationLabels: Record<string, string> = {
  consumo_propio: "Consumo propio",
  venta: "Para venta",
  donacion: "Donación",
};

export default function CarneTab() {
  const [records, setRecords] = useState<SlaughterRecord[]>([]);
  const [hens, setHens] = useState<Hen[]>([]);
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SlaughterRecord | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    birdType: "gallina_descarte",
    quantity: "1",
    weightKg: "",
    destination: "consumo_propio",
    henId: "",
    roosterId: "",
    batchId: "",
    notes: "",
  });

  const { values: birdTypeOptions } = useCatalog("tipo_ave", ["gallina_descarte", "pollo", "gallo"]);

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/sacrificio").then((r) => r.json()),
      apiFetch("/api/produccion/gallinas").then((r) => r.json()),
      apiFetch("/api/produccion/pollos").then((r) => r.json()),
    ]).then(([data, hensData, gallosData]) => {
      setRecords(Array.isArray(data) ? data : []);
      setHens(Array.isArray(hensData) ? hensData
        .filter((h: Hen) => h.status === "activa" || h.status === "empollando" || h.status === "recomendada_sacrificio")
        .sort((a: Hen, b: Hen) => Number(b.status === "recomendada_sacrificio") - Number(a.status === "recomendada_sacrificio")) : []);
      const lotesData = Array.isArray(gallosData) ? gallosData : [];
      setRoosters(Array.isArray(gallosData?.roosters) ? gallosData.roosters.filter((r: Rooster) => r.status === "activo" || r.status === "enfermo") : []);
      setBatches(lotesData.filter((b: Batch) => b.status === "activo" || b.status === "listo_sacrificio"));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setError("");
    setForm({ date: new Date().toISOString().split("T")[0], birdType: "gallina_descarte", quantity: "1", weightKg: "", destination: "consumo_propio", henId: "", roosterId: "", batchId: "", notes: "" });
    setModalOpen(true);
  };

  const openEdit = (r: SlaughterRecord) => {
    setEditing(r);
    setError("");
    setForm({ date: r.date, birdType: r.birdType, quantity: String(r.quantity), weightKg: r.weightKg, destination: r.destination, henId: r.henId || "", roosterId: r.roosterId || "", batchId: r.batchId || "", notes: r.notes || "" });
    setModalOpen(true);
  };

  const handleHenSelect = (henId: string) => {
    if (henId) {
      const hen = hens.find((h) => h.id === henId);
      if (hen) setForm({ ...form, henId, roosterId: "", batchId: "", weightKg: hen.weight, quantity: "1" });
    } else {
      setForm({ ...form, henId: "" });
    }
  };

  const handleRoosterSelect = (roosterId: string) => {
    if (roosterId) {
      const rooster = roosters.find((r) => r.id === roosterId);
      setForm({ ...form, roosterId, henId: "", batchId: "", birdType: "gallo", weightKg: rooster?.weight || "", quantity: "1" });
    } else {
      setForm({ ...form, roosterId: "" });
    }
  };

  const handleBatchSelect = (batchId: string) => {
    if (batchId) {
      const batch = batches.find((b) => b.id === batchId);
      setForm({ ...form, batchId, henId: "", roosterId: "", birdType: "pollo", quantity: String(batch?.currentQuantity || 1) });
    } else {
      setForm({ ...form, batchId: "" });
    }
  };

  const save = async () => {
    setError("");
    const qty = Number(form.quantity);
    const weightKg = Number(form.weightKg);
    if (!form.birdType) { setError("Tipo de ave requerido"); return; }
    if (!form.henId && !form.roosterId && !form.batchId) { setError("Debe seleccionar una gallina, un gallo o un lote"); return; }
    if (!qty || qty < 1) { setError("Cantidad inválida"); return; }
    if (!weightKg || weightKg <= 0) { setError("Peso requerido"); return; }

    const payload: Record<string, unknown> = {
      date: form.date,
      birdType: form.birdType,
      quantity: qty,
      weightKg,
      destination: form.destination,
      henId: form.henId || null,
      roosterId: form.roosterId || null,
      batchId: form.batchId || null,
      notes: form.notes || null,
    };
    if (editing) payload.id = editing.id;

    const method = editing ? "PUT" : "POST";
    const res = await apiFetch("/api/produccion/sacrificio", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.error || "Error al guardar"); return; }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    await apiFetch(`/api/produccion/sacrificio?id=${id}`, { method: "DELETE" });
    load();
  };

  const totalBirds = records.reduce((s, r) => s + r.quantity, 0);
  const totalWeight = records.reduce((s, r) => s + Number(r.weightKg), 0);
  const avgWeightPerBird = totalBirds > 0 ? (totalWeight / totalBirds).toFixed(1) : "0";

  const chartMap = new Map<string, { fecha: string; kg: number; aves: number }>();
  records.forEach((r) => {
    const key = new Date(r.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
    const prev = chartMap.get(key) || { fecha: key, kg: 0, aves: 0 };
    chartMap.set(key, { fecha: key, kg: prev.kg + Number(r.weightKg), aves: prev.aves + r.quantity });
  });
  const chartData = Array.from(chartMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

  return (
    <div>
      <PageHeader
        title="🍗 Producción de Carne"
        description="Registro de sacrificio de aves. La carne producida va al inventario; las ventas se registran desde Inventario → Carne."
        help="Aquí registras el sacrificio de aves para producción de carne.\n\n• Selecciona el tipo de ave: gallina de descarte, gallo o pollo de lote.\n• La carne producida se agrega al inventario automáticamente.\n• Para vender la carne, ve a Inventario → Carne o Finanzas → Ventas (pestaña Carne).\n• El peso en canal es el peso del ave después del sacrificio y limpieza."
        actions={<Button onClick={openNew}>+ Registrar Sacrificio</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="🍗" label="Total Aves Sacrificadas" value={totalBirds} color="green" />
        <StatCard icon="⚖️" label="Peso Total (kg)" value={totalWeight.toFixed(1)} color="yellow" />
        <StatCard icon="📊" label="Prom. kg/Ave" value={`${avgWeightPerBird} kg`} color="purple" />
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <p className="text-sm text-slate-500 mb-1">📦 Inventario y Ventas</p>
          <div className="flex gap-2 mt-2">
            <Link href="/dashboard/inventarios/carne" className="text-xs text-blue-600 hover:underline">Ver inventario</Link>
            <span className="text-slate-300">|</span>
            <Link href="/dashboard/finanzas/ventas?tab=carne" className="text-xs text-blue-600 hover:underline">Registrar venta</Link>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">Producción de Carne por Fecha</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" fontSize={11} />
              <YAxis yAxisId="left" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} />
              <Tooltip />
              <Bar yAxisId="left" dataKey="kg" fill="#f97316" radius={[4, 4, 0, 0]} name="kg Carne" />
              <Bar yAxisId="right" dataKey="aves" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Aves" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : records.length === 0 ? (
          <EmptyState icon="🍗" message="No hay registros de sacrificio" />
        ) : (
          <Table headers={["Fecha", "Ave", "Tipo", "Peso (kg)", "Destino", ""]}>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(r.date + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3">
                  {r.hen ? (
                    <span className="text-sm font-medium text-blue-600">{r.hen.code}</span>
                  ) : r.rooster ? (
                    <span className="text-sm font-medium text-red-600">{r.rooster.code}</span>
                  ) : r.batch ? (
                    <span className="text-sm font-medium text-orange-600">{r.batch.code}</span>
                  ) : (
                    <span className="text-sm text-slate-400">--</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{birdTypeLabels[r.birdType] || r.birdType}</td>
                <td className="px-4 py-3">{r.weightKg} kg</td>
                <td className="px-4 py-3 text-sm">{destinationLabels[r.destination] || r.destination}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Registro" : "Registrar Sacrificio"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" help="Fecha del sacrificio." type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Select label="Tipo de ave" help="Tipo de ave que se sacrifica: gallina de descarte, gallo o pollo de engorde." value={form.birdType} onChange={(e) => setForm({ ...form, birdType: e.target.value })}>
              {birdTypeOptions.map((t) => (
                <option key={t} value={t}>{birdTypeLabels[t] || t}</option>
              ))}
            </Select>
          </div>
          <Select label="Gallina" help="Gallina específica a sacrificar. Prioriza las marcadas como 'recomendada sacrificio'." value={form.henId} onChange={(e) => handleHenSelect(e.target.value)}>
            <option value="">-- Seleccione una gallina --</option>
            {hens.map((h) => (
              <option key={h.id} value={h.id}>{h.code} -- {h.weight} kg{h.status === "recomendada_sacrificio" ? " (Recomendada sacrificio)" : ""}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Gallo" value={form.roosterId} onChange={(e) => handleRoosterSelect(e.target.value)}>
              <option value="">-- Sin gallo --</option>
              {roosters.map((r) => (
                <option key={r.id} value={r.id}>{r.code}{r.weight ? ` -- ${r.weight} kg` : ""}</option>
              ))}
            </Select>
            <Select label="Lote de pollos" value={form.batchId} onChange={(e) => handleBatchSelect(e.target.value)}>
              <option value="">-- Sin lote --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.code} ({b.currentQuantity} disponibles){b.status === "listo_sacrificio" ? " (Listo)" : ""}</option>
              ))}
            </Select>
          </div>
          {!form.henId && !form.roosterId && !form.batchId && (
            <p className="text-xs text-slate-500">Seleccione una gallina, un gallo o un lote (al menos uno).</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cantidad (aves)" help="Número de aves sacrificadas." type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <Input label="Peso en canal (kg)" help="Peso total del ave o aves después del sacrificio y limpieza." type="number" step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
          </div>
          <Select label="Destino previsto" help="Qué se hará con la carne: consumo propio, venta o donación." value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>
            <option value="consumo_propio">Consumo propio</option>
            <option value="venta">Para venta (se vende desde Inventario)</option>
            <option value="donacion">Donación</option>
          </Select>
          <Textarea label="Notas" help="Observaciones sobre el sacrificio." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={save}>{editing ? "Actualizar" : "Registrar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
