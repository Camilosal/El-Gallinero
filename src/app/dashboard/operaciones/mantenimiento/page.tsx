"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Building2, Zap } from "lucide-react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { useCatalog } from "@/lib/useCatalog";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useFarmLocations } from "@/lib/useFarmLocations";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";

interface Maintenance {
  id: string;
  title: string;
  description: string | null;
  scheduledDate: string;
  completedDate: string | null;
  status: string;
  cost: string | null;
  locationId: string | null;
  locationName: string | null;
  assetId: string | null;
  assetCode: string | null;
  assetName: string | null;
  recurrenceIntervalDays: number | null;
}

interface FarmAssetOption {
  id: string;
  code: string;
  name: string;
  locationId: string | null;
  status: string;
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
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Maintenance[]>([]);
  const [assets, setAssets] = useState<FarmAssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", scheduledDate: new Date().toISOString().split("T")[0], status: "pendiente", cost: "0", completedDate: "", locationId: "", assetId: "", recurrenceIntervalDays: "" });
  const { locations } = useFarmLocations();
  const { values: taskOptions } = useCatalog("tipo_mantenimiento", taskTemplates);

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/operaciones/mantenimiento").then((r) => r.json()),
      apiFetch("/api/operaciones/activos?active=true").then((r) => r.json()),
    ]).then(([taskRows, assetRows]) => {
      setTasks(Array.isArray(taskRows) ? taskRows : []);
      setAssets(Array.isArray(assetRows) ? assetRows : []);
    }).catch(() => setError("No se pudieron cargar las tareas y equipos"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setError("");
    setForm({ title: "", description: "", scheduledDate: new Date().toISOString().split("T")[0], status: "pendiente", cost: "0", completedDate: "", locationId: "", assetId: "", recurrenceIntervalDays: "" });
    setModalOpen(true);
  };
  useActionQuery(searchParams.get("nuevo"), { "1": openNew });

  const openEdit = (t: Maintenance) => {
    setEditing(t);
    setError("");
    setForm({ title: t.title, description: t.description || "", scheduledDate: t.scheduledDate, status: t.status, cost: t.cost || "0", completedDate: t.completedDate || "", locationId: t.locationId || "", assetId: t.assetId || "", recurrenceIntervalDays: t.recurrenceIntervalDays ? String(t.recurrenceIntervalDays) : "" });
    setModalOpen(true);
  };

  const save = async () => {
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing.id } : form;
    const res = await apiFetch("/api/operaciones/mantenimiento", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "No se pudo guardar la tarea");
      return;
    }
    setModalOpen(false);
    setError("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    const res = await apiFetch(`/api/operaciones/mantenimiento?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo eliminar la tarea");
      return;
    }
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
        task.locationName,
      ]),
    );
  }, [tasks, search]);

  return (
    <div>
      <PageHeader
        title="Mantenimiento del Gallinero"
        description="Programación y seguimiento de tareas de mantenimiento e infraestructura"
        help="Registra tareas por lugar o por equipo. Al completar una tarea periódica se programa automáticamente la próxima fecha. El Inicio muestra los vencimientos de los próximos siete días."
        actions={<div className="flex flex-wrap gap-2"><a href="/dashboard/operaciones/activos" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Building2 className="w-4 h-4 text-slate-500" aria-hidden="true" /> Activos y equipos</a><Button onClick={openNew}>+ Nueva Tarea</Button></div>}
      />
      {error && !modalOpen && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="hourglass" label="Pendientes" value={pending} color={pending > 0 ? "yellow" : "green"} />
        <StatCard icon="refresh" label="En Progreso" value={inProgress} color="blue" />
        <StatCard icon="check-circle" label="Completadas" value={completed} color="green" />
        <StatCard icon="money" label="Costo Total Mant." value={`$${totalCost.toLocaleString()}`} color="earth" />
      </div>

      {/* Quick Templates */}
      <Card className="mb-6">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" aria-hidden="true" />
          Tareas Rápidas (click para crear)
        </h3>
        <div className="flex flex-wrap gap-2">
              {taskOptions.map((t) => (
            <button key={t} onClick={() => { setEditing(null); setError(""); setForm({ title: t, description: "", scheduledDate: new Date().toISOString().split("T")[0], status: "pendiente", cost: "0", completedDate: "", locationId: "", assetId: "", recurrenceIntervalDays: "" }); setModalOpen(true); }}
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
            icon="wrench"
            message={
              search.trim()
                ? "No hay tareas que coincidan con la búsqueda"
                : "No hay tareas de mantenimiento"
            }
          />
        ) : (
          <Table headers={["Tarea", "Equipo / lugar", "Programada", "Repetición", "Estado", "Completada", "Costo", "Acciones"]}>
            {filteredTasks.map((t) => (
              <tr key={t.id} className={`hover:bg-slate-50 ${t.status === "pendiente" ? "bg-yellow-50" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-medium">{t.title}</p>
                  {t.description && <p className="text-xs text-slate-400 mt-1">{t.description}</p>}
                </td>
                <td className="px-4 py-3 text-sm">
                  <p>{t.assetName ? `${t.assetName}${t.assetCode ? ` (${t.assetCode})` : ""}` : "Sin equipo asociado"}</p>
                  <p className="text-xs text-slate-500">{t.locationName || "General de la finca"}</p>
                </td>
                <td className="px-4 py-3">{new Date(t.scheduledDate + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3 text-xs">{t.recurrenceIntervalDays ? `Cada ${t.recurrenceIntervalDays} días` : "Una vez"}</td>
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
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Título de la Tarea" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Limpieza del gallinero" required help="Nombre corto y descriptivo de la tarea" />
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalles de la tarea..." help="Detalles adicionales, materiales necesarios, instrucciones, etc." />
          <Select label="Equipo asociado (opcional)" value={form.assetId} onChange={(e) => {
            const asset = assets.find((item) => item.id === e.target.value);
            setForm({ ...form, assetId: e.target.value, locationId: e.target.value ? asset?.locationId || "" : form.locationId });
          }} help="Selecciona la ficha para conservar el historial de reparaciones por equipo.">
            <option value="">Tarea general o solo por lugar</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.code} · {asset.name}</option>)}
          </Select>
          <Select label="Lugar asociado" value={form.locationId} disabled={Boolean(assets.find((asset) => asset.id === form.assetId)?.locationId)} onChange={(e) => setForm({ ...form, locationId: e.target.value })} help="Se completa con el lugar del equipo cuando su ficha ya tiene uno.">
            <option value="">General de la finca / sin lugar específico</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </Select>
          <Input label="Repetir cada cierto número de días" type="number" min="1" max="3650" value={form.recurrenceIntervalDays} onChange={(e) => setForm({ ...form, recurrenceIntervalDays: e.target.value })} placeholder="Dejar vacío para una sola vez" help="Al completar la tarea, se crea la siguiente fecha automáticamente (por ejemplo, 7, 30 o 90 días)." />
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
