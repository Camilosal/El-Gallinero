"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wheat } from "lucide-react";
import { Button, Card, EmptyState, Input, Modal, Select, Table } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";

interface StageOption { id: string; value: string }
interface FeedOption { id: string; name: string; unit: string }
interface FeedProgram {
  id: string;
  stageCatalogoId: string;
  feedId: string;
  feedName: string | null;
  feedUnit: string | null;
  percentage: string;
  dailyAmountPerHen: string;
}

const EMPTY = {
  stageCatalogoId: "",
  feedId: "",
  percentage: "0",
  dailyAmountPerHen: "0",
};

export default function AlimentacionTab() {
  const [stages, setStages] = useState<StageOption[]>([]);
  const [feeds, setFeeds] = useState<FeedOption[]>([]);
  const [programs, setPrograms] = useState<FeedProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeedProgram | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/configuracion/programas-alimentacion")
      .then((r) => r.json())
      .then((data) => {
        setStages(data.stages || []);
        setFeeds(data.feeds || []);
        setPrograms(data.programs || []);
      })
      .catch(() => setError("No se pudieron cargar los programas de alimentación"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const stageName = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s.value])), [stages]);
  const visiblePrograms = useMemo(
    () =>
      programs.filter((item) =>
        matchesTextQuery(search, [
          stageName[item.stageCatalogoId],
          item.feedName,
          item.feedUnit,
          item.percentage,
          item.dailyAmountPerHen,
        ]),
      ),
    [programs, search, stageName],
  );
  const stagesWithoutProgram = useMemo(
    () => stages.filter((stage) => !programs.some((program) => program.stageCatalogoId === stage.id)),
    [stages, programs],
  );

  const set = (key: keyof typeof EMPTY, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const openNew = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      stageCatalogoId: stagesWithoutProgram[0]?.id || stages[0]?.id || "",
      feedId: feeds[0]?.id || "",
    });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (item: FeedProgram) => {
    setEditing(item);
    setForm({
      stageCatalogoId: item.stageCatalogoId,
      feedId: item.feedId,
      percentage: item.percentage,
      dailyAmountPerHen: item.dailyAmountPerHen,
    });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    setError("");
    if (!form.stageCatalogoId || !form.feedId) {
      setError("Seleccione la etapa y el alimento");
      return;
    }
    const res = await apiFetch("/api/configuracion/programas-alimentacion", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Error al guardar el programa");
      return;
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este programa de alimentación?")) return;
    await apiFetch(`/api/configuracion/programas-alimentacion?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Wheat className="w-4 h-4 text-amber-600" aria-hidden="true" />
              Programas de alimentación por etapa
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Definen qué alimentos consume cada etapa y en qué cantidad diaria por animal.
              El consumo automático usa estos programas.
            </p>
          </div>
          <Button onClick={openNew} disabled={stages.length === 0 || feeds.length === 0}>+ Agregar programa</Button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        {stages.length === 0 && <p className="mt-3 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">Primero cree etapas de crecimiento en la pestaña Listas.</p>}
        {feeds.length === 0 && <p className="mt-3 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">Primero registre alimentos en Inventario de insumos.</p>}
      </Card>

      {stagesWithoutProgram.length > 0 && (
        <Card>
          <h4 className="font-semibold text-slate-700 mb-2">Etapas sin programa</h4>
          <div className="flex flex-wrap gap-2">
            {stagesWithoutProgram.map((stage) => (
              <span key={stage.id} className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs border border-amber-200">
                {stage.value}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card>
        {programs.length > 0 && (
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar programa por etapa, alimento o gramos..."
            resultCount={visiblePrograms.length}
            totalCount={programs.length}
            className="mb-4"
          />
        )}
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : programs.length === 0 ? (
          <EmptyState icon="wheat" message="No hay programas de alimentación configurados" />
        ) : visiblePrograms.length === 0 ? (
          <EmptyState icon="wheat" message="No hay programas que coincidan con la búsqueda" />
        ) : (
          <Table headers={["Etapa", "Alimento", "Porcentaje", "g/animal/día", ""]}>
            {visiblePrograms.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{stageName[item.stageCatalogoId] || "—"}</td>
                <td className="px-4 py-3">{item.feedName || "—"}</td>
                <td className="px-4 py-3">{Number(item.percentage).toFixed(1)}%</td>
                <td className="px-4 py-3">{Number(item.dailyAmountPerHen).toFixed(2)} g</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar programa" : "Agregar programa de alimentación"}>
        <div className="space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Select label="Etapa de crecimiento" value={form.stageCatalogoId} onChange={(e) => set("stageCatalogoId", e.target.value)}>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.value}</option>)}
          </Select>
          <Select label="Alimento" value={form.feedId} onChange={(e) => set("feedId", e.target.value)}>
            {feeds.map((feed) => <option key={feed.id} value={feed.id}>{feed.name} ({feed.unit})</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Porcentaje de la dieta (%)" type="number" min="0" max="100" step="0.1" value={form.percentage} onChange={(e) => set("percentage", e.target.value)} />
            <Input label="Consumo (g/animal/día)" type="number" min="0" step="0.01" value={form.dailyAmountPerHen} onChange={(e) => set("dailyAmountPerHen", e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={save}>{editing ? "Actualizar" : "Agregar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
