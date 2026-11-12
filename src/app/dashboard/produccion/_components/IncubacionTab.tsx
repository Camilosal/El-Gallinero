"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Bird, Calendar, CheckCircle2, ClipboardList, Egg, Flame } from "lucide-react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useActionQuery } from "@/lib/useActionQuery";

interface Hen { id: string; code: string; status: string; }
interface Rooster { id: string; code: string; breed: string; status: string; }
interface Incubation {
  id: string;
  henId: string | null;
  henCode: string | null;
  roosterId: string | null;
  roosterCode: string | null;
  startDate: string;
  expectedHatchDate: string;
  eggsSet: number;
  eggsHatched: number | null;
  malesHatched: number | null;
  femalesHatched: number | null;
  isComplete: boolean;
  notes: string | null;
}

export default function IncubacionPage() {
  const searchParams = useSearchParams();
  const [incubations, setIncubations] = useState<Incubation[]>([]);
  const [hens, setHens] = useState<Hen[]>([]);
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [today, setToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [hatchSelectorOpen, setHatchSelectorOpen] = useState(false);
  const [completeModal, setCompleteModal] = useState<Incubation | null>(null);
  const [form, setForm] = useState({ henId: "", roosterId: "", startDate: new Date().toISOString().split("T")[0], eggsSet: 10, notes: "" });
  const [hatchForm, setHatchForm] = useState({ eggsHatched: 0, femalesHatched: 0, malesHatched: 0, notes: "" });
  const [assignmentMsg, setAssignmentMsg] = useState("");
  const [actionError, setActionError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/incubacion").then((r) => r.json()),
      apiFetch("/api/produccion/gallinas").then((r) => r.json()),
      apiFetch("/api/produccion/gallos").then((r) => r.json()),
    ]).then(([i, h, r]) => {
      setIncubations(i);
      setHens(h);
      setRoosters(r);
      setToday(Date.now());
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useActionQuery(searchParams.get("nuevo"), {
    incubacion: () => { setSaveError(""); setForm({ henId: "", roosterId: "", startDate: new Date().toISOString().split("T")[0], eggsSet: 10, notes: "" }); setModalOpen(true); },
    eclosion: async () => {
      try {
        setActionError("");
        const response = await apiFetch("/api/produccion/incubacion");
        if (!response.ok) return setActionError("No se pudieron cargar las incubaciones.");
        const rows = await response.json();
        setIncubations(rows);
        if (rows.some((incubation: Incubation) => !incubation.isComplete)) setHatchSelectorOpen(true);
        else setActionError("No hay una incubación abierta para registrar su eclosión.");
      } catch {
        setActionError("No se pudieron cargar las incubaciones.");
      }
    },
  });

  const save = async () => {
    setSaveError("");
    const response = await apiFetch("/api/produccion/incubacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setSaveError(result.error || "No se pudo iniciar la incubación");
      return;
    }
    setModalOpen(false);
    load();
  };

  const complete = async () => {
    if (!completeModal) return;
    const res = await apiFetch("/api/produccion/incubacion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: completeModal.id, eggsHatched: hatchForm.eggsHatched, femalesHatched: hatchForm.femalesHatched, malesHatched: hatchForm.malesHatched, isComplete: true, notes: hatchForm.notes || completeModal.notes }),
    });
    const data = await res.json().catch(() => ({}));
    const a = data.assignment;
    if (a) {
      const parts: string[] = [];
      if (a.hensCreated) parts.push(`${a.hensCreated} gallina${a.hensCreated > 1 ? "s" : ""} nuevas`);
      if (a.roostersCreated) parts.push(`${a.roostersCreated} gallo${a.roostersCreated > 1 ? "s" : ""} reproductor${a.roostersCreated > 1 ? "es" : ""}`);
      if (a.batchCode) parts.push(`resto al lote de engorde ${a.batchCode}`);
      setAssignmentMsg(parts.length > 0 ? `Asignación automática: ${parts.join(", ")}.` : "Incubación completada sin asignación de aves.");
    } else {
      setAssignmentMsg("");
    }
    setCompleteModal(null);
    load();
  };

  const activeInc = incubations.filter((i) => !i.isComplete);
  const completedInc = incubations.filter((i) => i.isComplete);
  const totalHatched = incubations.reduce((s, i) => s + (i.eggsHatched || 0), 0);
  const totalSet = incubations.reduce((s, i) => s + i.eggsSet, 0);
  const hatchRate = totalSet > 0 ? Math.round((totalHatched / totalSet) * 100) : 0;
  const availableHens = hens.filter((h) => h.status === "activa");

  const filteredCompleted = useMemo(() => {
    if (!search.trim()) return completedInc;
    return completedInc.filter((incubation) =>
      matchesTextQuery(search, [
        incubation.henCode,
        incubation.roosterCode,
        incubation.startDate,
        new Date(incubation.startDate + "T12:00:00").toLocaleDateString("es"),
        incubation.expectedHatchDate,
        new Date(incubation.expectedHatchDate + "T12:00:00").toLocaleDateString("es"),
        incubation.eggsSet,
        incubation.eggsHatched,
        incubation.femalesHatched,
        incubation.malesHatched,
        incubation.notes,
      ]),
    );
  }, [completedInc, search]);

  const getDaysRemaining = (expected: string) => {
    const diff = Math.ceil((new Date(expected + "T12:00:00").getTime() - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div>
      <PageHeader
        theme="incubacion"
        title="Incubación y Reproducción"
        description="Gestión de gallinas cluecas, empollamiento natural y eclosión de pollitos"
        help="Aquí gestionas las incubaciones de huevos. Registra gallina y gallo progenitores cuando se conozcan para que la descendencia conserve esa cadena de parentesco. Al nacer, las nuevas fichas quedan vinculadas a la incubación y a sus padres."
        actions={<Button onClick={() => { setSaveError(""); setForm({ henId: availableHens[0]?.id || "", roosterId: "", startDate: new Date().toISOString().split("T")[0], eggsSet: 10, notes: "" }); setModalOpen(true); }}>+ Nueva Incubación</Button>}
      />

      {actionError && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{actionError}</p>}

      {assignmentMsg && (
        <div className="p-4 rounded-xl mb-6 text-sm font-medium bg-green-50 border border-green-200 text-green-800 flex justify-between items-center">
          <span className="inline-flex items-center gap-2">
            <AppIcon icon="incubator" className="w-4 h-4 text-green-700 shrink-0" />
            <span>{assignmentMsg}</span>
          </span>
          <button onClick={() => setAssignmentMsg("")} className="text-green-700 hover:underline text-xs">Cerrar</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard icon="incubator" label="Incubaciones Activas" value={activeInc.length} color="purple" />
        <StatCard icon="chick" label="Pollitos Nacidos (total)" value={totalHatched} color="yellow" />
        <StatCard icon="hen" label="Gallinas Disponibles" value={availableHens.length} color="blue" />
      </div>

      {/* Active Incubations */}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" aria-hidden="true" />
        <span>Incubaciones Activas</span>
      </h2>
      {activeInc.length === 0 ? (
        <Card className="mb-6"><EmptyState icon="nest" message="No hay incubaciones activas" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {activeInc.map((inc) => {
            const days = getDaysRemaining(inc.expectedHatchDate);
            return (
              <Card key={inc.id} className="border-l-4 border-purple-400">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold flex items-center gap-1.5">
                      <AppIcon icon="hen" className="w-4 h-4 text-amber-700" />
                      <span>{inc.henCode || "Sin gallina asignada"}</span>
                    </p>
                    {inc.roosterCode && (
                      <p className="text-sm text-slate-600 flex items-center gap-1.5">
                        <Bird className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                        <span>Padre: {inc.roosterCode}</span>
                      </p>
                    )}
                    <p className="text-sm text-slate-500">Inicio: {new Date(inc.startDate + "T12:00:00").toLocaleDateString("es")}</p>
                  </div>
                  <Badge color={days <= 3 ? "red" : days <= 7 ? "yellow" : "purple"}>
                    {days > 0 ? `${days} días restantes` : "¡Hoy eclosiona!"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div><span className="text-slate-500">Huevos:</span> <strong>{inc.eggsSet}</strong></div>
                  <div><span className="text-slate-500">Eclosión esperada:</span> <strong>{new Date(inc.expectedHatchDate + "T12:00:00").toLocaleDateString("es")}</strong></div>
                </div>
                {inc.notes && <p className="text-xs text-slate-400 mb-3">{inc.notes}</p>}
                <Button variant="success" className="w-full" onClick={() => { setCompleteModal(inc); setHatchForm({ eggsHatched: 0, femalesHatched: 0, malesHatched: 0, notes: inc.notes || "" }); }}>
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>Registrar Eclosión</span>
                  </span>
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed */}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-slate-600" aria-hidden="true" />
        <span>Historial de Incubaciones</span>
      </h2>
      <Card>
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por madre, padre, fecha o nota..."
          resultCount={filteredCompleted.length}
          totalCount={completedInc.length}
          className="mb-4"
        />
        {filteredCompleted.length === 0 ? (
          <EmptyState
            icon="clipboard"
            message={
              search.trim()
                ? "No hay incubaciones que coincidan con la búsqueda"
                : "No hay incubaciones completadas"
            }
          />
        ) : (
          <Table headers={["Madre", "Padre", "Inicio", "Eclosión", "Huevos", "Nacidos", "Tasa", "Notas"]}>
            {filteredCompleted.map((inc) => (
              <tr key={inc.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{inc.henCode || "—"}</td>
                <td className="px-4 py-3 font-medium">{inc.roosterCode || "—"}</td>
                <td className="px-4 py-3">{new Date(inc.startDate + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3">{new Date(inc.expectedHatchDate + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3">{inc.eggsSet}</td>
                <td className="px-4 py-3 font-bold text-green-600">
                  {inc.eggsHatched}
                  {inc.malesHatched != null && inc.femalesHatched != null && (
                    <span className="block text-xs font-normal text-slate-500">♀ {inc.femalesHatched} · ♂ {inc.malesHatched}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge color={((inc.eggsHatched || 0) / inc.eggsSet) >= 0.7 ? "green" : "yellow"}>
                    {Math.round(((inc.eggsHatched || 0) / inc.eggsSet) * 100)}%
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{inc.notes || "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* New Incubation Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Incubación">
        <div className="space-y-4">
          {saveError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
          <Select label="Gallina Clueca (opcional)" help="Gallina que está empollando. Si no asignas gallina, los huevos se consideran incubación artificial." value={form.henId} onChange={(e) => setForm({ ...form, henId: e.target.value })}>
            <option value="">Sin asignar</option>
            {availableHens.map((h) => <option key={h.id} value={h.id}>{h.code}</option>)}
          </Select>
          <Select label="Gallo progenitor (opcional)" help="Registra el padre cuando se conozca para guardar el linaje de la descendencia." value={form.roosterId} onChange={(e) => setForm({ ...form, roosterId: e.target.value })}>
            <option value="">No identificado</option>
            {roosters.map((rooster) => <option key={rooster.id} value={rooster.id}>{rooster.code} · {rooster.breed} · {rooster.status}</option>)}
          </Select>
          <Input label="Fecha de Inicio" help="Fecha en que iniziaron a incubar los huevos. La eclosión será 21 días después." type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <Input label="Número de Huevos" help="Cantidad de huevos puestos bajo la gallina o en la incubadora." type="number" min="1" value={form.eggsSet} onChange={(e) => setForm({ ...form, eggsSet: parseInt(e.target.value) || 0 })} />
          <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
            <p className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />
              <span>Eclosión estimada: <strong>{new Date(new Date(form.startDate).getTime() + 21 * 24 * 60 * 60 * 1000).toLocaleDateString("es")}</strong> (21 días)</span>
            </p>
          </div>
          <Textarea label="Notas" help="Observaciones sobre esta incubación." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={save} disabled={form.eggsSet < 1}>Iniciar Incubación</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={hatchSelectorOpen} onClose={() => setHatchSelectorOpen(false)} title="Selecciona la incubación">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Elige el registro que vas a completar para asignar los nacimientos correctamente.</p>
          {incubations.filter((incubation) => !incubation.isComplete).map((incubation) => (
            <button key={incubation.id} type="button" onClick={() => { setHatchSelectorOpen(false); setCompleteModal(incubation); setHatchForm({ eggsHatched: 0, femalesHatched: 0, malesHatched: 0, notes: "" }); }} className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-green-400 hover:bg-green-50">
              <strong className="block text-sm text-slate-800">Inicio: {incubation.startDate} · {incubation.eggsSet} huevos</strong>
              <span className="text-xs text-slate-500">Eclosión esperada: {incubation.expectedHatchDate}{incubation.henCode ? ` · ${incubation.henCode}` : ""}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Complete Incubation Modal */}
      <Modal open={!!completeModal} onClose={() => setCompleteModal(null)} title="Registrar Eclosión">
        <div className="space-y-4">
          {completeModal && (
            <>
              <div className="p-3 bg-green-50 rounded-lg text-sm space-y-1">
                <p className="flex items-center gap-1.5">
                  <AppIcon icon="hen" className="w-4 h-4 text-green-700" />
                  <span>Gallina: <strong>{completeModal.henCode || "N/A"}</strong></span>
                </p>
                <p className="flex items-center gap-1.5">
                  <AppIcon icon="rooster" className="w-4 h-4 text-green-700" />
                  <span>Gallo progenitor: <strong>{completeModal.roosterCode || "No identificado"}</strong></span>
                </p>
                <p className="flex items-center gap-1.5">
                  <Egg className="w-4 h-4 text-green-700" aria-hidden="true" />
                  <span>Huevos incubados: <strong>{completeModal.eggsSet}</strong></span>
                </p>
              </div>
              <Input label="Pollitos Nacidos" help="Total de pollitos que nacieron de los huevos incubados." type="number" min="0" max={completeModal.eggsSet} value={hatchForm.eggsHatched} onChange={(e) => setHatchForm({ ...hatchForm, eggsHatched: parseInt(e.target.value) || 0 })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Hembras nacidas" help="Pollitas hembras. Se registrarán como gallinas nuevas." type="number" min="0" value={hatchForm.femalesHatched} onChange={(e) => setHatchForm({ ...hatchForm, femalesHatched: parseInt(e.target.value) || 0 })} />
                <Input label="Machos nacidos" help="Pollitos machos. Se asignan automáticamente como gallos reproductores o al lote de engorde." type="number" min="0" value={hatchForm.malesHatched} onChange={(e) => setHatchForm({ ...hatchForm, malesHatched: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                <p>♀ Las hembras se registrarán como gallinas nuevas.</p>
                <p>♂ Los machos se asignan automáticamente: gallos reproductores según el balance (1 por cada 10 gallinas) y el resto a un lote de engorde.</p>
                {hatchForm.femalesHatched + hatchForm.malesHatched !== hatchForm.eggsHatched && (
                  <p className="mt-1 text-orange-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Hembras + machos ({hatchForm.femalesHatched + hatchForm.malesHatched}) no coincide con los nacidos ({hatchForm.eggsHatched}).</span>
                  </p>
                )}
              </div>
              <Textarea label="Notas finales" help="Observaciones finales de esta incubación." value={hatchForm.notes} onChange={(e) => setHatchForm({ ...hatchForm, notes: e.target.value })} />
              <div className="flex gap-3">
                <Button variant="success" onClick={complete}>Completar Incubación</Button>
                <Button variant="secondary" onClick={() => setCompleteModal(null)}>Cancelar</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
