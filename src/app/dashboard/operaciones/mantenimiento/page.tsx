"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { useCatalog } from "@/lib/useCatalog";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";

interface Maintenance {
  id: string;
  title: string;
  description: string | null;
  scheduledDate: string;
  completedDate: string | null;
  status: string;
  cost: string | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "yellow" },
  en_progreso: { label: "En Progreso", color: "blue" },
  completado: { label: "Completado", color: "green" },
};

const taskTemplates = [
  "Limpieza y desinfección del gallinero",
  "Revisión y reparación de nidales",
  "Cambio de cama / viruta",
  "Revisión del sistema de agua",
  "Reparación de cercas y malla",
  "Poda de vegetación alrededor",
  "Revisión de techos y drenajes",
  "Mantenimiento de comederos",
  "Fumigación preventiva",
  "Pintura y protección de estructuras",
];

export default function MantenimientoPage() {
  const [tasks, setTasks] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [form, setForm] = useState({ title: "", description: "", scheduledDate: new Date().toISOString().split("T")[0], status: "pendiente", cost: "0", completedDate: "" });
  const { values: taskOptions } = useCatalog("tipo_mantenimiento", taskTemplates);

  const load = useCallback(() => {
    apiFetch("/api/operaciones/mantenimiento").then((r) => r.json()).then(setTasks).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", scheduledDate: new Date().toISOString().split("T")[0], status: "pendiente", cost: "0", completedDate: "" });
    setModalOpen(true);
  };

  const openEdit = (t: Maintenance) => {
    setEditing(t);
    setForm({ title: t.title, description: t.description || "", scheduledDate: t.scheduledDate, status: t.status, cost: t.cost || "0", completedDate: t.completedDate || "" });
    setModalOpen(true);
  };

  const save = async () => {
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing.id } : form;
    await apiFetch("/api/operaciones/mantenimiento", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    await apiFetch(`/api/operaciones/mantenimiento?id=${id}`, { method: "DELETE" });
    load();
  };

  const pending = tasks.filter((t) => t.status === "pendiente").length;
  const inProgress = tasks.filter((t) => t.status === "en_progreso").length;
  const completed = tasks.filter((t) => t.status === "completado").length;
  const totalCost = tasks.filter((t) => t.status === "completado").reduce((s, t) => s + Number(t.cost || 0), 0);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    return tasks.filter((task) =>
      matchesTextQuery(search, [
        task.title,
        task.description,
        task.scheduledDate,
        task.completedDate,
        task.status,
        statusLabels[task.status]?.label,
        task.cost,
      ]),
    );
  }, [tasks, search]);

  return (
    <div>
      <PageHeader
        title="🔧 Mantenimiento del Gallinero"
        description="Programación y seguimiento de tareas de mantenimiento e infraestructura"
        help="Gestiona las tareas de mantenimiento preventivo y correctivo del gallinero: bebederos, bebederos, iluminación, estructura, equipos, etc. Cada tarea tiene prioridad (alta/media/baja), estado (pendiente/en progreso/completada), fecha programada y costo estimado. Permite planificar mantenimiento regular para evitar fallas que afecten la producción."
        actions={<Button onClick={openNew}>+ Nueva Tarea</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="⏳" label="Pendientes" value={pending} color={pending > 0 ? "yellow" : "green"} />
        <StatCard icon="🔄" label="En Progreso" value={inProgress} color="blue" />
        <StatCard icon="✅" label="Completadas" value={completed} color="green" />
        <StatCard icon="💰" label="Costo Total Mant." value={`$${totalCost.toLocaleString()}`} color="earth" />
      </div>

      {/* Quick Templates */}
      <Card className="mb-6">
        <h3 className="font-semibold text-slate-700 mb-3">⚡ Tareas Rápidas (click para crear)</h3>
        <div className="flex flex-wrap gap-2">
          {taskOptions.map((t) => (
            <button key={t} onClick={() => { setEditing(null); setForm({ title: t, description: "", scheduledDate: new Date().toISOString().split("T")[0], status: "pendiente", cost: "0", completedDate: "" }); setModalOpen(true); }}
              className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-green-100 rounded-full text-slate-600 hover:text-green-700 transition-colors">
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por tarea, estado o descripción..."
          resultCount={filteredTasks.length}
          totalCount={tasks.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            icon="🔧"
            message={
              search.trim()
                ? "No hay tareas que coincidan con la búsqueda"
                : "No hay tareas de mantenimiento"
            }
          />
        ) : (
          <Table headers={["Tarea", "Programada", "Estado", "Completada", "Costo", "Acciones"]}>
            {filteredTasks.map((t) => (
              <tr key={t.id} className={`hover:bg-slate-50 ${t.status === "pendiente" ? "bg-yellow-50" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-medium">{t.title}</p>
                  {t.description && <p className="text-xs text-slate-400 mt-1">{t.description}</p>}
                </td>
                <td className="px-4 py-3">{new Date(t.scheduledDate + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3">
                  <Badge color={statusLabels[t.status]?.color || "gray"}>{statusLabels[t.status]?.label || t.status}</Badge>
                </td>
                <td className="px-4 py-3">{t.completedDate ? new Date(t.completedDate + "T12:00:00").toLocaleDateString("es") : "—"}</td>
                <td className="px-4 py-3">{Number(t.cost) > 0 ? `$${Number(t.cost).toLocaleString()}` : "—"}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Tarea" : "Nueva Tarea de Mantenimiento"}>
        <div className="space-y-4">
          <Input label="Título de la Tarea" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Limpieza del gallinero" required help="Nombre corto y descriptivo de la tarea" />
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalles de la tarea..." help="Detalles adicionales, materiales necesarios, instrucciones, etc." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha Programada" type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} help="Fecha en que se planea realizar la tarea" />
            <Select label="Estado" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} help="Pendiente, En Progreso o Completado">
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En Progreso</option>
              <option value="completado">Completado</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Costo ($)" type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} help="Costo estimado o real de la tarea (repuestos, servicios, etc.)" />
            {form.status === "completado" && (
              <Input label="Fecha Completada" type="date" value={form.completedDate} onChange={(e) => setForm({ ...form, completedDate: e.target.value })} help="Fecha real en que se terminó la tarea" />
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={save} disabled={!form.title}>{editing ? "Actualizar" : "Crear Tarea"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
