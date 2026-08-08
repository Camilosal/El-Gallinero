"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";

interface HealthRecord {
  id: string;
  date: string;
  type: string;
  description: string;
  affectedHens: string | null;
  product: string | null;
  cost: string | null;
  nextScheduled: string | null;
  notes: string | null;
}

const eventTypes = [
  { value: "vacunacion", label: "💉 Vacunación" },
  { value: "desparasitacion", label: "🪱 Desparasitación" },
  { value: "tratamiento", label: "💊 Tratamiento" },
  { value: "inspeccion", label: "🔍 Inspección" },
  { value: "fumigacion", label: "🧪 Fumigación" },
  { value: "vitaminas", label: "💧 Vitaminas/Suplementos" },
  { value: "otro", label: "📋 Otro" },
];

const typeColors: Record<string, string> = {
  vacunacion: "blue",
  desparasitacion: "purple",
  tratamiento: "red",
  inspeccion: "green",
  fumigacion: "orange",
  vitaminas: "yellow",
  otro: "gray",
};

export default function SanidadPage() {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HealthRecord | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "inspeccion",
    description: "",
    affectedHens: "todas",
    product: "",
    cost: "0",
    nextScheduled: "",
    notes: "",
  });
  const { values: typeOptions } = useCatalog("tipo_sanidad", eventTypes.map((t) => t.value));

  const load = useCallback(() => {
    apiFetch("/api/sanidad").then((r) => r.json()).then(setRecords).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setError("");
    setForm({ date: new Date().toISOString().split("T")[0], type: "inspeccion", description: "", affectedHens: "todas", product: "", cost: "0", nextScheduled: "", notes: "" });
    setModalOpen(true);
  };

  const openEdit = (r: HealthRecord) => {
    setEditing(r);
    setError("");
    setForm({
      date: r.date,
      type: r.type,
      description: r.description,
      affectedHens: r.affectedHens || "",
      product: r.product || "",
      cost: r.cost || "0",
      nextScheduled: r.nextScheduled || "",
      notes: r.notes || "",
    });
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing.id } : form;
    const res = await apiFetch("/api/sanidad", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar el registro");
      return;
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    await apiFetch(`/api/sanidad?id=${id}`, { method: "DELETE" });
    load();
  };

  const totalCost = records.reduce((s, r) => s + Number(r.cost || 0), 0);
  const upcoming = records.filter((r) => r.nextScheduled && new Date(r.nextScheduled + "T12:00:00") >= new Date()).sort((a, b) => new Date(a.nextScheduled!).getTime() - new Date(b.nextScheduled!).getTime());

  return (
    <div>
      <PageHeader
        title="💊 Control Fitosanitario"
        description="Vacunaciones, desparasitaciones, tratamientos, inspecciones y fumigaciones"
        actions={<Button onClick={openNew}>+ Nuevo Registro</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="📋" label="Total Registros" value={records.length} color="blue" />
        <StatCard icon="💉" label="Vacunaciones" value={records.filter((r) => r.type === "vacunacion").length} color="purple" />
        <StatCard icon="📅" label="Próximos Eventos" value={upcoming.length} color={upcoming.length > 0 ? "yellow" : "green"} />
        <StatCard icon="💰" label="Costo Total" value={`$${totalCost.toLocaleString()}`} color="red" />
      </div>

      {/* Upcoming Events */}
      {upcoming.length > 0 && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <h3 className="font-semibold text-yellow-700 mb-2">📅 Próximos Eventos Sanitarios Programados</h3>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map((r) => (
              <div key={r.id} className="flex justify-between items-center p-2 bg-white rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge color={typeColors[r.type] || "gray"}>{eventTypes.find((t) => t.value === r.type)?.label || r.type}</Badge>
                  <span className="text-sm">{r.description}</span>
                </div>
                <span className="text-sm font-medium text-yellow-700">{new Date(r.nextScheduled! + "T12:00:00").toLocaleDateString("es")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : records.length === 0 ? (
          <EmptyState icon="💊" message="No hay registros sanitarios" />
        ) : (
          <Table headers={["Fecha", "Tipo", "Descripción", "Gallinas", "Producto", "Costo", "Próximo", ""]}>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(r.date + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3"><Badge color={typeColors[r.type] || "gray"}>{eventTypes.find((t) => t.value === r.type)?.label || r.type}</Badge></td>
                <td className="px-4 py-3 text-sm max-w-[200px]">{r.description}</td>
                <td className="px-4 py-3 text-sm">{r.affectedHens || "—"}</td>
                <td className="px-4 py-3 text-sm">{r.product || "—"}</td>
                <td className="px-4 py-3">{Number(r.cost) > 0 ? `$${Number(r.cost).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-sm">{r.nextScheduled ? new Date(r.nextScheduled + "T12:00:00").toLocaleDateString("es") : "—"}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "✏️ Editar Registro Sanitario" : "💊 Nuevo Registro Sanitario"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Select label="Tipo de Evento" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {typeOptions.map((v) => <option key={v} value={v}>{eventTypes.find((t) => t.value === v)?.label || v}</option>)}
            </Select>
          </div>
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalle del evento sanitario..." required />
          <Input label="Gallinas Afectadas" value={form.affectedHens} onChange={(e) => setForm({ ...form, affectedHens: e.target.value })} placeholder="'todas' o códigos: G-001, G-002" />
          <Input label="Producto Utilizado" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Ej: Newcastle B1, Ivermectina..." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Costo ($)" type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            <Input label="Próxima Aplicación" type="date" value={form.nextScheduled} onChange={(e) => setForm({ ...form, nextScheduled: e.target.value })} />
          </div>
          <Textarea label="Notas adicionales" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={save} disabled={!form.description}>{editing ? "Actualizar Registro" : "Registrar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
