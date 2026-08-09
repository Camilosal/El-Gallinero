"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState } from "@/components/ui";
import { useCatalog } from "@/lib/useCatalog";
import { apiFetch } from "@/lib/fetch";
import { QrGeneratorButton } from "./QrGenerator";

interface Hen {
  id: string;
  code: string;
  breed: string;
  birthDate: string;
  status: string;
  weight: string | null;
  notes: string | null;
  isBroody: boolean;
  clutchSize: number | null;
  stage?: string | null;
  ageWeeks?: number;
  lifecycleReasons?: string[];
}

interface Stage {
  id: string;
  value: string;
  minWeeks: number | null;
  maxWeeks: number | null;
}

const statusColors: Record<string, string> = {
  activa: "green",
  empollando: "purple",
  enferma: "red",
  descarte: "orange",
  recomendada_sacrificio: "orange",
  vendida: "gray",
  faena: "blue",
  muerta: "gray",
};

const statusLabels: Record<string, string> = {
  activa: "Activa",
  empollando: "Empollando",
  enferma: "Enferma",
  descarte: "Descarte",
  recomendada_sacrificio: "⚠️ Recomendada sacrificio",
  vendida: "Vendida",
  faena: "Faena",
  muerta: "Muerta",
};

const stageColors: Record<string, string> = {
  Pollito: "yellow",
  Juvenil: "blue",
  "Pre-postura": "purple",
  Postura: "green",
};

const breeds = ["Rhode Island Red", "Leghorn", "Plymouth Rock", "Sussex", "Marans", "Araucana", "Isa Brown", "Criolla", "Otra"];
const statusFallback = ["activa", "empollando", "enferma", "descarte", "recomendada_sacrificio", "vendida", "faena", "muerta"];

function getHenStage(birthDate: string, stages: Stage[]): string {
  const today = new Date();
  const birth = new Date(birthDate + "T12:00:00");
  const weeks = (today.getTime() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000);

  for (const stage of stages) {
    const min = stage.minWeeks ?? 0;
    const max = stage.maxWeeks;
    if (weeks >= min && (max === null || weeks < max)) {
      return stage.value;
    }
  }
  return "Desconocida";
}

function getHenAgeWeeks(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate + "T12:00:00");
  return Math.floor((today.getTime() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export default function GallinasPage() {
  const [hens, setHens] = useState<Hen[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Hen | null>(null);
  const [form, setForm] = useState({ code: "", breed: "", birthDate: "", status: "activa", weight: "", notes: "", isBroody: false, clutchSize: 0 });
  const [filter, setFilter] = useState("todos");
  const [stageFilter, setStageFilter] = useState("todas");
  const { values: breedOptions } = useCatalog("raza", breeds);
  const { values: statusOptions } = useCatalog("estado_gallina", statusFallback);

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/gallinas").then((r) => r.json()),
      apiFetch("/api/produccion/etapas").then((r) => r.json()),
    ]).then(([h, s]) => {
      setHens(h);
      setStages(s.map((st: { id: string; value: string; minWeeks: number | null; maxWeeks: number | null }) => ({
        id: st.id,
        value: st.value,
        minWeeks: st.minWeeks,
        maxWeeks: st.maxWeeks,
      })));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ code: "", breed: breeds[0], birthDate: new Date().toISOString().split("T")[0], status: "activa", weight: "", notes: "", isBroody: false, clutchSize: 0 });
    setModalOpen(true);
  };

  const openEdit = (h: Hen) => {
    setEditing(h);
    setForm({ code: h.code, breed: h.breed, birthDate: h.birthDate, status: h.status, weight: h.weight || "", notes: h.notes || "", isBroody: h.isBroody, clutchSize: h.clutchSize || 0 });
    setModalOpen(true);
  };

  const save = async () => {
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing.id } : form;
    await apiFetch("/api/produccion/gallinas", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta gallina?")) return;
    await apiFetch(`/api/produccion/gallinas?id=${id}`, { method: "DELETE" });
    load();
  };

  const stageNames = useMemo(() => [...new Set(stages.map((s) => s.value))], [stages]);

  const henStage = useCallback((h: Hen) => h.stage ?? getHenStage(h.birthDate, stages), [stages]);
  const henAge = useCallback((h: Hen) => h.ageWeeks ?? getHenAgeWeeks(h.birthDate), []);

  const recommended = useMemo(() => hens.filter((h) => h.status === "recomendada_sacrificio"), [hens]);

  const filtered = useMemo(() => {
    let result = filter === "todos" ? hens : hens.filter((h) => h.status === filter);
    if (stageFilter !== "todas") {
      result = result.filter((h) => henStage(h) === stageFilter);
    }
    return result;
  }, [hens, filter, stageFilter, henStage]);

  return (
    <div>
      <PageHeader
        title="🐔 Gestión de Gallinas"
        description="Registro, seguimiento y estado de todas las gallinas del gallinero"
        help="Aquí registras cada gallina del gallinero con su código, raza, fecha de nacimiento y estado.\n\n• El sistema calcula automáticamente la etapa de crecimiento y cambia el estado según la edad y condición.\n• Las gallinas marcadas como 'recomendada sacrificio' son candidatos para venta o faena según su rendimiento.\n• Usa el botón 'Etiquetas QR' para generar códigos QR que puedes imprimir y pegar en bandas de pata. Luego escanéalo con tu celular para acceder rápido a cada ave.\n• Filtra por estado o etapa para encontrar gallinas específicas."
        actions={
          <div className="flex gap-2">
            <QrGeneratorButton hens={hens} />
            <Button onClick={openNew}>+ Nueva Gallina</Button>
          </div>
        }
      />

      {/* Alerta de gallinas recomendadas para sacrificio */}
      {recommended.length > 0 && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="font-semibold text-orange-800 mb-1">
            ⚠️ {recommended.length} gallina{recommended.length > 1 ? "s" : ""} recomendada{recommended.length > 1 ? "s" : ""} para sacrificio o venta
          </p>
          <div className="flex flex-wrap gap-2">
            {recommended.map((h) => (
              <span key={h.id} className="text-xs bg-white border border-orange-200 rounded px-2 py-1 text-orange-700" title={h.lifecycleReasons?.join(" · ")}>
                <strong>{h.code}</strong> — {h.lifecycleReasons?.join(" · ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {["todos", ...statusOptions].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${filter === s ? "bg-green-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border"}`}>
            {statusLabels[s] || s.charAt(0).toUpperCase() + s.slice(1)} ({s === "todos" ? hens.length : hens.filter((h) => h.status === s).length})
          </button>
        ))}
      </div>

      {/* Stage Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setStageFilter("todas")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition ${stageFilter === "todas" ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border"}`}>
          Todas las etapas
        </button>
        {stageNames.map((s) => (
          <button key={s} onClick={() => setStageFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${stageFilter === s ? "bg-amber-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100 border"}`}>
            {s} ({hens.filter((h) => henStage(h) === s).length})
          </button>
        ))}
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon="🐔" message="No hay gallinas registradas aún" />
        ) : (
          <Table headers={["Código", "Raza", "Edad", "Etapa", "Estado", "Peso (kg)", "Empollando", "Acciones"]}>
            {filtered.map((h) => {
              const stage = henStage(h);
              const ageWeeks = henAge(h);
              return (
                <tr key={h.id} className={`hover:bg-slate-50 ${h.status === "recomendada_sacrificio" ? "bg-orange-50/50" : ""}`}>
                  <td className="px-4 py-3 font-semibold">{h.code}</td>
                  <td className="px-4 py-3">{h.breed}</td>
                  <td className="px-4 py-3 text-sm">{ageWeeks} sem</td>
                  <td className="px-4 py-3">
                    <Badge color={stageColors[stage] || "gray"}>{stage}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColors[h.status]}>{statusLabels[h.status] || h.status}</Badge>
                    {h.lifecycleReasons && h.lifecycleReasons.length > 0 && (
                      <p className="text-xs text-orange-600 mt-1">{h.lifecycleReasons.join(" · ")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{h.weight || "—"}</td>
                  <td className="px-4 py-3">{h.isBroody ? "🐣 Sí" : "No"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(h)} className="text-blue-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => remove(h.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Gallina" : "Nueva Gallina"}>
        <div className="space-y-4">
          <Input label="Código / Identificación" help="Código único para identificar a esta gallina. Ej: G-001, A-012. Debe ser único." value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ej: G-001" required />
          <Select label="Raza" help="Raza de la gallina. Cada raza tiene diferentes niveles de postura, peso y comportamiento." value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })}>
            {breedOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Input label="Fecha de Nacimiento" help="Fecha de nacimiento de la gallina. El sistema calcula automáticamente su edad y etapa de crecimiento." type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          <Select label="Estado" help="Estado actual de la gallina. 'Activa' es el estado normal. 'Empollando' si está incubando. 'Enferma' si necesita atención. El sistema puede sugerir 'recomendada sacrificio' automáticamente." value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {statusOptions.map((s) => <option key={s} value={s}>{statusLabels[s] || s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </Select>
          <Input label="Peso (kg)" help="Peso actual de la gallina en kilogramos. Importante para monitorear salud y rendimiento." type="number" step="0.01" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="Ej: 2.5" />
          <Textarea label="Notas" help="Observaciones sobre la gallina: comportamiento, salud, tratamientos, etc." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones sobre la gallina..." />
          <div className="flex gap-3">
            <Button onClick={save} disabled={!form.code || !form.breed}>{editing ? "Actualizar" : "Registrar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
