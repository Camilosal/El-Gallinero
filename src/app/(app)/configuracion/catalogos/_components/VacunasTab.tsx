"use client";

import { useCallback, useEffect, useState } from "react";
import { Syringe } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Table, Textarea } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";

interface VaccineTemplate {
  id: string;
  species: string;
  breed: string;
  weekNumber: number;
  name: string;
  description: string | null;
  type: string;
  frequencyDays: number | null;
  isActive: boolean;
}

const SPECIES = ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"];

const EMPTY = {
  species: "gallina",
  breed: "ISA Brown",
  weekNumber: "1",
  name: "",
  description: "",
  frequencyDays: "",
  isActive: "true",
};

export default function VacunasTab() {
  const [items, setItems] = useState<VaccineTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VaccineTemplate | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/configuracion/vacunas")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setError("No se pudieron cargar las plantillas de vacunación"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const set = (key: keyof typeof EMPTY, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (item: VaccineTemplate) => {
    setEditing(item);
    setForm({
      species: item.species,
      breed: item.breed,
      weekNumber: String(item.weekNumber),
      name: item.name,
      description: item.description || "",
      frequencyDays: item.frequencyDays != null ? String(item.frequencyDays) : "",
      isActive: item.isActive ? "true" : "false",
    });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    if (!form.name.trim()) {
      setError("El nombre de la vacuna o evento es obligatorio");
      return;
    }
    const payload = {
      ...form,
      weekNumber: Number(form.weekNumber),
      frequencyDays: form.frequencyDays === "" ? null : Number(form.frequencyDays),
      isActive: form.isActive === "true",
    };
    const res = await apiFetch("/api/configuracion/vacunas", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Error al guardar");
      return;
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla de vacunación?")) return;
    await apiFetch(`/api/configuracion/vacunas?id=${id}`, { method: "DELETE" });
    load();
  };

  const seed = async () => {
    setSeeding(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/configuracion/vacunas/seed", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al cargar los planes de referencia");
        return;
      }
      setMessage(`Se cargaron ${data.created ?? 0} eventos de referencia.`);
      load();
    } finally {
      setSeeding(false);
    }
  };

  const visibleItems = items.filter((item) =>
    matchesTextQuery(search, [
      item.species,
      item.breed || "general",
      item.weekNumber,
      `semana ${item.weekNumber}`,
      item.name,
      item.description,
      item.frequencyDays ? `cada ${item.frequencyDays} dias` : "unica",
      item.isActive ? "activo" : "inactivo",
    ]),
  );

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Syringe className="w-4 h-4 text-blue-600" aria-hidden="true" />
              Planes de vacunación
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Plantillas por especie, raza y semana. El botón “Plan sanitario automático” usa estas plantillas
              para crear los eventos del calendario.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={seed} disabled={seeding}>{seeding ? "Cargando..." : "Cargar referencias"}</Button>
            <Button onClick={openNew}>+ Agregar evento</Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700 bg-green-50 p-3 rounded-lg">{message}</p>}
      </Card>

      <Card>
        {items.length > 0 && (
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar vacuna por especie, raza, semana o nombre..."
            resultCount={visibleItems.length}
            totalCount={items.length}
            className="mb-4"
          />
        )}
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : items.length === 0 ? (
          <EmptyState icon="vaccine" message="No hay plantillas de vacunación. Usa “Cargar referencias” o agrega una." />
        ) : visibleItems.length === 0 ? (
          <EmptyState icon="vaccine" message="No hay plantillas que coincidan con la búsqueda" />
        ) : (
          <Table headers={["Especie", "Raza", "Semana", "Evento", "Descripción", "Frecuencia", "Estado", ""]}>
            {visibleItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 capitalize">{item.species}</td>
                <td className="px-4 py-3">{item.breed || "General"}</td>
                <td className="px-4 py-3">{item.weekNumber}</td>
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-slate-600">{item.description || "—"}</td>
                <td className="px-4 py-3">{item.frequencyDays ? `Cada ${item.frequencyDays} días` : "Única"}</td>
                <td className="px-4 py-3"><Badge color={item.isActive ? "green" : "gray"}>{item.isActive ? "Activo" : "Inactivo"}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:underline">Editar</button>
                    <button onClick={() => remove(item.id)} className="text-red-600 hover:underline">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar evento" : "Agregar evento de vacunación"}>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Especie" value={form.species} onChange={(e) => set("species", e.target.value)}>
              {SPECIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input label="Raza" value={form.breed} onChange={(e) => set("breed", e.target.value)} placeholder="ISA Brown" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Semana" type="number" min="0" step="1" value={form.weekNumber} onChange={(e) => set("weekNumber", e.target.value)} />
            <Input label="Frecuencia (días, opcional)" type="number" min="0" step="1" value={form.frequencyDays} onChange={(e) => set("frequencyDays", e.target.value)} />
          </div>
          <Input label="Nombre del evento" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Newcastle + Bronquitis" autoFocus />
          <Textarea label="Descripción" value={form.description} onChange={(e) => set("description", e.target.value)} />
          <Select label="Estado" value={form.isActive} onChange={(e) => set("isActive", e.target.value)}>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </Select>
          <div className="flex gap-3 pt-2">
            <Button onClick={save}>{editing ? "Actualizar" : "Agregar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
