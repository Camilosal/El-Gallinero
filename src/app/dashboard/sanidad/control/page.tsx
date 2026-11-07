"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";

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

interface CalendarEvent {
  id: string;
  type: string;
  name: string;
  description: string | null;
  targetBirds: string | null;
  frequencyDays: number | null;
  nextDueDate: string;
  isOverdue: boolean;
  daysUntilDue: number;
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
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <SanidadPageInner />
    </Suspense>
  );
}

function SanidadPageInner() {
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HealthRecord | null>(null);
  const [error, setError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [search, setSearch] = useState("");
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
    Promise.all([
      apiFetch("/api/sanidad/control").then((r) => r.json()),
      apiFetch("/api/sanidad/calendario").then((r) => r.json()),
    ]).then(([control, calendar]) => {
      setRecords(control);
      setCalendarEvents(calendar);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Find most urgent pending calendar event
  const pendingEvent = calendarEvents
    .filter((e) => e.isOverdue || (e.daysUntilDue >= 0 && e.daysUntilDue <= 7))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)[0] || null;

  // Handle ?pendiente=ID from Dashboard
  useEffect(() => {
    const pendienteId = searchParams.get("pendiente");
    if (pendienteId && calendarEvents.length > 0) {
      const event = calendarEvents.find((e) => e.id === pendienteId);
      if (event) {
        openNewWithEvent(event);
      }
    }
  }, [searchParams, calendarEvents]);

  const openNew = () => {
    setEditing(null);
    setError("");
    setForm({ date: new Date().toISOString().split("T")[0], type: "inspeccion", description: "", affectedHens: "todas", product: "", cost: "0", nextScheduled: "", notes: "" });
    setModalOpen(true);
  };

  const openNewWithEvent = (event: CalendarEvent) => {
    setEditing(null);
    setError("");
    // Calculate next scheduled date based on frequency
    let nextDate = "";
    if (event.frequencyDays) {
      const d = new Date(event.nextDueDate + "T12:00:00");
      d.setDate(d.getDate() + event.frequencyDays);
      nextDate = d.toISOString().split("T")[0];
    }
    setForm({
      date: new Date().toISOString().split("T")[0],
      type: event.type,
      description: `${event.name}${event.description ? ` — ${event.description}` : ""}`,
      affectedHens: event.targetBirds || "todas",
      product: "",
      cost: "0",
      nextScheduled: nextDate,
      notes: "",
    });
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
    const res = await apiFetch("/api/sanidad/control", {
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
    await apiFetch(`/api/sanidad/control?id=${id}`, { method: "DELETE" });
    load();
  };

  const totalCost = records.reduce((s, r) => s + Number(r.cost || 0), 0);
  const upcoming = records.filter((r) => r.nextScheduled && new Date(r.nextScheduled + "T12:00:00") >= new Date()).sort((a, b) => new Date(a.nextScheduled!).getTime() - new Date(b.nextScheduled!).getTime());

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    return records.filter((record) =>
      matchesTextQuery(search, [
        record.date,
        new Date(record.date + "T12:00:00").toLocaleDateString("es"),
        record.type,
        eventTypes.find((type) => type.value === record.type)?.label,
        record.description,
        record.affectedHens,
        record.product,
        record.cost,
        record.nextScheduled,
        record.notes,
      ]),
    );
  }, [records, search]);

  return (
    <div>
      <PageHeader
        title="💊 Control Fitosanitario"
        description="Vacunaciones, desparasitaciones, tratamientos, inspecciones y fumigaciones"
        help="Registra todos los eventos sanitarios: vacunaciones, desparasitaciones, tratamientos, inspecciones y fumigaciones.\n\n• Si hay un evento pendiente del calendario sanitario, verás un banner para pre-llenar el formulario automáticamente.\n• El campo 'Próximo evento programado' ayuda a mantener el calendario actualizado.\n• Los costos se reflejan automáticamente en los egresos de finanzas."
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
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por fecha, tipo, producto o descripción..."
          resultCount={filteredRecords.length}
          totalCount={records.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon="💊"
            message={
              search.trim()
                ? "No hay registros que coincidan con la búsqueda"
                : "No hay registros sanitarios"
            }
          />
        ) : (
          <Table headers={["Fecha", "Tipo", "Descripción", "Gallinas", "Producto", "Costo", "Próximo", ""]}>
            {filteredRecords.map((r) => (
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
          {/* Calendar event suggestion banner */}
          {!editing && pendingEvent && (
            <div className={`p-3 rounded-lg border ${pendingEvent.isOverdue ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
              <p className="text-sm font-semibold text-slate-700 mb-1">
                📅 Evento pendiente: "{pendingEvent.name}"
              </p>
              <p className="text-xs text-slate-500 mb-2">
                {eventTypes.find((t) => t.value === pendingEvent.type)?.label || pendingEvent.type}
                {" · "}
                {pendingEvent.isOverdue
                  ? `Vencido hace ${Math.abs(pendingEvent.daysUntilDue)} días`
                  : `Vence en ${pendingEvent.daysUntilDue} días`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => openNewWithEvent(pendingEvent)}
                  className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                >
                  Usar estos datos
                </button>
                <button
                  onClick={() => setForm({ ...form, type: "inspeccion", description: "", affectedHens: "todas", product: "", cost: "0", nextScheduled: "" })}
                  className="px-3 py-1 bg-white text-slate-600 text-xs font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
                >
                  Formulario vacío
                </button>
              </div>
            </div>
          )}
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
