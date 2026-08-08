"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface SanitaryEvent {
  id: string;
  type: string;
  name: string;
  description: string | null;
  targetBirds: string | null;
  targetStageId: string | null;
  frequencyDays: number | null;
  nextDueDate: string;
  withdrawalDays: number | null;
  isActive: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  daysUntilDue: number;
}

const eventTypes = ["vacunacion", "desparasitacion", "inspeccion", "tratamiento", "limpieza", "otro"];
const TYPE_LABELS: Record<string, string> = {
  vacunacion: "Vacunación",
  desparasitacion: "Desparasitación",
  inspeccion: "Inspección",
  tratamiento: "Tratamiento",
  limpieza: "Limpieza",
  otro: "Otro",
};

export default function CalendarioSanitarioPage() {
  const [events, setEvents] = useState<SanitaryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: eventTypes[0],
    name: "",
    description: "",
    targetBirds: "todas",
    frequencyDays: "",
    nextDueDate: new Date().toISOString().split("T")[0],
    withdrawalDays: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/calendario-sanitario")
      .then((r) => r.json())
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const overdueEvents = events.filter((e) => e.isOverdue);
  const dueSoonEvents = events.filter((e) => e.isDueSoon);
  const upcomingEvents = events.filter((e) => !e.isOverdue && !e.isDueSoon && e.isActive);

  const save = async () => {
    setError("");
    if (!form.name || !form.nextDueDate) {
      return setError("Nombre y fecha son requeridos");
    }

    const res = await apiFetch("/api/calendario-sanitario", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editingId ? { id: editingId } : {}),
        ...form,
        frequencyDays: form.frequencyDays ? Number(form.frequencyDays) : null,
        withdrawalDays: form.withdrawalDays ? Number(form.withdrawalDays) : null,
      }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "Error al guardar");
    }

    setModalOpen(false);
    setEditingId(null);
    setForm({ type: eventTypes[0], name: "", description: "", targetBirds: "todas", frequencyDays: "", nextDueDate: new Date().toISOString().split("T")[0], withdrawalDays: "" });
    load();
  };

  const removeEvent = async (id: string) => {
    if (!confirm("¿Eliminar este evento del calendario?")) return;
    await apiFetch(`/api/calendario-sanitario?id=${id}`, { method: "DELETE" });
    load();
  };

  const editEvent = (e: SanitaryEvent) => {
    setEditingId(e.id);
    setForm({
      type: e.type,
      name: e.name,
      description: e.description || "",
      targetBirds: e.targetBirds || "todas",
      frequencyDays: e.frequencyDays ? String(e.frequencyDays) : "",
      nextDueDate: e.nextDueDate,
      withdrawalDays: e.withdrawalDays ? String(e.withdrawalDays) : "",
    });
    setError("");
    setModalOpen(true);
  };

  const markDone = async (event: SanitaryEvent) => {
    // Advance next due date by frequency
    if (event.frequencyDays) {
      const nextDate = new Date(event.nextDueDate + "T12:00:00");
      nextDate.setDate(nextDate.getDate() + event.frequencyDays);
      const nextStr = nextDate.toISOString().split("T")[0];
      await apiFetch("/api/calendario-sanitario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: event.id, nextDueDate: nextStr }),
      });
    } else {
      await apiFetch(`/api/calendario-sanitario?id=${event.id}`, { method: "DELETE" });
    }
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="📅 Calendario Sanitario"
        description="Programación de actividades sanitarias preventivas"
        actions={
          <Button onClick={() => { setEditingId(null); setForm({ type: eventTypes[0], name: "", description: "", targetBirds: "todas", frequencyDays: "", nextDueDate: new Date().toISOString().split("T")[0], withdrawalDays: "" }); setError(""); setModalOpen(true); }}>
            + Nuevo Evento
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="📅" label="Total eventos" value={String(events.length)} color="blue" />
        <StatCard icon="🔴" label="Vencidos" value={String(overdueEvents.length)} color="red" />
        <StatCard icon="🟡" label="Próximos (7 días)" value={String(dueSoonEvents.length)} color="yellow" />
        <StatCard icon="🟢" label="Al día" value={String(upcomingEvents.length)} color="green" />
      </div>

      {/* Alert panel */}
      {(overdueEvents.length > 0 || dueSoonEvents.length > 0) && (
        <div className="space-y-3">
          {overdueEvents.length > 0 && (
            <Card className="border-red-300 bg-red-50">
              <h3 className="font-semibold text-red-700 mb-3">🔴 Eventos Vencidos</h3>
              <div className="space-y-2">
                {overdueEvents.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-2 bg-white rounded">
                    <div>
                      <span className="font-medium text-sm">{e.name}</span>
                      <Badge color="red">{TYPE_LABELS[e.type] || e.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-600">{Math.abs(e.daysUntilDue)} días vencido</span>
                      <button onClick={() => editEvent(e)} className="text-amber-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => markDone(e)} className="text-green-600 hover:underline text-xs">Marcar hecho</button>
                      <button onClick={() => removeEvent(e.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {dueSoonEvents.length > 0 && (
            <Card className="border-yellow-300 bg-yellow-50">
              <h3 className="font-semibold text-yellow-700 mb-3">🟡 Próximos 7 Días</h3>
              <div className="space-y-2">
                {dueSoonEvents.map((e) => (
                  <div key={e.id} className="flex justify-between items-center p-2 bg-white rounded">
                    <div>
                      <span className="font-medium text-sm">{e.name}</span>
                      <Badge color="yellow">{TYPE_LABELS[e.type] || e.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-yellow-600">En {e.daysUntilDue} días</span>
                      <button onClick={() => editEvent(e)} className="text-amber-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => markDone(e)} className="text-green-600 hover:underline text-xs">Marcar hecho</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Upcoming events table */}
      <Card>
        <h3 className="font-semibold text-slate-700 mb-3">Próximos Eventos</h3>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : events.length === 0 ? (
          <EmptyState icon="📅" message="No hay eventos en el calendario" />
        ) : (
          <Table headers={["Fecha", "Tipo", "Nombre", "Aves objetivo", "Frecuencia", "Retiro", "Estado", "Acciones"]}>
            {events.map((e) => (
              <tr key={e.id} className={`hover:bg-slate-50 ${e.isOverdue ? "bg-red-50" : e.isDueSoon ? "bg-yellow-50" : ""}`}>
                <td className="px-4 py-3 text-sm font-medium">{e.nextDueDate}</td>
                <td className="px-4 py-3">
                  <Badge color={e.isOverdue ? "red" : e.isDueSoon ? "yellow" : "green"}>
                    {TYPE_LABELS[e.type] || e.type}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">{e.name}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{e.targetBirds || "todas"}</td>
                <td className="px-4 py-3 text-sm">{e.frequencyDays ? `Cada ${e.frequencyDays} días` : "Único"}</td>
                <td className="px-4 py-3 text-sm">{e.withdrawalDays ? `${e.withdrawalDays} días` : "—"}</td>
                <td className="px-4 py-3">
                  {e.isOverdue ? (
                    <Badge color="red">Vencido ({Math.abs(e.daysUntilDue)}d)</Badge>
                  ) : e.isDueSoon ? (
                    <Badge color="yellow">En {e.daysUntilDue}d</Badge>
                  ) : (
                    <Badge color="green">Al día</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => editEvent(e)} className="text-amber-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => markDone(e)} className="text-green-600 hover:underline text-xs">Hecho</button>
                    <button onClick={() => removeEvent(e.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Create modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); }} title={editingId ? "✏️ Editar Evento Sanitario" : "📅 Nuevo Evento Sanitario"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Select label="Tipo" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {eventTypes.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
          </Select>
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Vacuna Newcastle" required />
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalle del evento..." />
          <Input label="Aves objetivo" value={form.targetBirds} onChange={(e) => setForm({ ...form, targetBirds: e.target.value })} placeholder="Ej: todas, gallinas adultas, lote 1" />
          <Input label="Fecha programada" type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} required />
          <Input label="Frecuencia (días)" type="number" min="1" value={form.frequencyDays} onChange={(e) => setForm({ ...form, frequencyDays: e.target.value })} placeholder="Ej: 30 para mensual, dejar vacío para único" />
          <Input label="Días de retiro" type="number" min="0" value={form.withdrawalDays} onChange={(e) => setForm({ ...form, withdrawalDays: e.target.value })} placeholder="Días sin consumir huevos/carne" />
          <div className="flex gap-3">
            <Button onClick={save}>{editingId ? "Actualizar" : "Guardar"}</Button>
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditingId(null); }}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
