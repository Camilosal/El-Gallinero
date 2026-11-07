"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Input, Modal, Select, Table } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface WeightStandard {
  id: string;
  breed: string;
  gender: string;
  weekNumber: number;
  targetWeightG: string;
  minWeightG: string | null;
  maxWeightG: string | null;
}

const EMPTY = {
  breed: "",
  gender: "hembra",
  weekNumber: "1",
  targetWeightG: "",
  minWeightG: "",
  maxWeightG: "",
};

export default function PesosTab() {
  const [items, setItems] = useState<WeightStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [breedFilter, setBreedFilter] = useState("todas");
  const [genderFilter, setGenderFilter] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WeightStandard | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/configuracion/estandares-peso")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setError("No se pudieron cargar los estándares de peso"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const breeds = useMemo(() => Array.from(new Set(items.map((i) => i.breed))).sort(), [items]);
  const filtered = useMemo(() => items.filter((item) => {
    if (breedFilter !== "todas" && item.breed !== breedFilter) return false;
    if (genderFilter !== "todos" && item.gender !== genderFilter) return false;
    return true;
  }), [items, breedFilter, genderFilter]);

  const set = (key: keyof typeof EMPTY, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, breed: breedFilter !== "todas" ? breedFilter : "" });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (item: WeightStandard) => {
    setEditing(item);
    setForm({
      breed: item.breed,
      gender: item.gender,
      weekNumber: String(item.weekNumber),
      targetWeightG: item.targetWeightG,
      minWeightG: item.minWeightG || "",
      maxWeightG: item.maxWeightG || "",
    });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    if (!form.breed.trim()) {
      setError("La raza es obligatoria");
      return;
    }
    const payload = { ...form, weekNumber: Number(form.weekNumber) };
    const res = await apiFetch("/api/configuracion/estandares-peso", {
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
    if (!confirm("¿Eliminar este estándar de peso?")) return;
    await apiFetch(`/api/configuracion/estandares-peso?id=${id}`, { method: "DELETE" });
    load();
  };

  const seed = async () => {
    setSeeding(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/api/produccion/peso/seed", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al cargar los estándares");
        return;
      }
      setMessage(`Se cargaron ${data.seeded ?? 0} puntos de referencia.`);
      load();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-700">⚖️ Estándares de peso por raza</h3>
            <p className="text-xs text-slate-500 mt-1">
              Curvas de referencia para comparar el peso real de las aves y detectar desviaciones.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={seed} disabled={seeding}>{seeding ? "Cargando..." : "Cargar referencias"}</Button>
            <Button onClick={openNew}>+ Agregar punto</Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-700 bg-green-50 p-3 rounded-lg">{message}</p>}
      </Card>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Select label="Raza" value={breedFilter} onChange={(e) => setBreedFilter(e.target.value)}>
            <option value="todas">Todas</option>
            {breeds.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
          </Select>
          <Select label="Sexo" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="hembra">Hembra</option>
            <option value="macho">Macho</option>
          </Select>
          <div className="flex items-end text-xs text-slate-500">{filtered.length} puntos</div>
        </div>

        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon="⚖️" message="No hay estándares de peso para el filtro seleccionado" />
        ) : (
          <Table headers={["Raza", "Sexo", "Semana", "Peso objetivo", "Mínimo", "Máximo", ""]}>
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{item.breed}</td>
                <td className="px-4 py-3 capitalize">{item.gender}</td>
                <td className="px-4 py-3">{item.weekNumber}</td>
                <td className="px-4 py-3">{Number(item.targetWeightG).toLocaleString()} g</td>
                <td className="px-4 py-3">{item.minWeightG ? `${Number(item.minWeightG).toLocaleString()} g` : "—"}</td>
                <td className="px-4 py-3">{item.maxWeightG ? `${Number(item.maxWeightG).toLocaleString()} g` : "—"}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "✏️ Editar estándar de peso" : "➕ Agregar estándar de peso"}>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Raza" value={form.breed} onChange={(e) => set("breed", e.target.value)} placeholder="ISA Brown" autoFocus />
            <Select label="Sexo" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="hembra">Hembra</option>
              <option value="macho">Macho</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Semana" type="number" min="0" step="1" value={form.weekNumber} onChange={(e) => set("weekNumber", e.target.value)} />
            <Input label="Peso objetivo (g)" type="number" min="0" step="0.1" value={form.targetWeightG} onChange={(e) => set("targetWeightG", e.target.value)} />
            <Input label="Mínimo (g)" type="number" min="0" step="0.1" value={form.minWeightG} onChange={(e) => set("minWeightG", e.target.value)} />
          </div>
          <Input label="Máximo (g)" type="number" min="0" step="0.1" value={form.maxWeightG} onChange={(e) => set("maxWeightG", e.target.value)} />
          <div className="flex gap-3 pt-2">
            <Button onClick={save}>{editing ? "Actualizar" : "Agregar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
