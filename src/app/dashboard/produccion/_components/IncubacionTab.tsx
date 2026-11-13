"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Bird, Calendar, CheckCircle2, ClipboardList, Egg, Eye, Flame } from "lucide-react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useActionQuery } from "@/lib/useActionQuery";
import { useFarmLocations } from "@/lib/useFarmLocations";
import MicroInsightCard from "@/components/MicroInsightCard";
import { buildIncubationMicroInsight, type MicroInsightPayload } from "@/lib/micro-insights";

interface Hen { id: string; code: string; status: string; }
interface Rooster { id: string; code: string; breed: string; status: string; }
interface Incubation {
  id: string;
  species?: string;
  henId: string | null;
  henCode: string | null;
  roosterId: string | null;
  roosterCode: string | null;
  locationId?: string | null;
  locationName?: string | null;
  incubatorName?: string | null;
  trayCode?: string | null;
  startDate: string;
  turnStopDate?: string | null;
  expectedHatchDate: string;
  humidityTargetPct?: string | null;
  tempTargetC?: string | null;
  eggsSet: number;
  fertileEggs?: number | null;
  discardedEggs?: number | null;
  eggsHatched: number | null;
  malesHatched: number | null;
  femalesHatched: number | null;
  fertilityPct?: number | null;
  hatchOfFertilePct?: number | null;
  hatchTotalPct?: number | null;
  isComplete: boolean;
  notes: string | null;
}

const SPECIES_INC_META: Record<string, { label: string; days: number; turnStopDay: number; tempC: string; humidityPct: string }> = {
  gallina: { label: "Gallina (21 días)", days: 21, turnStopDay: 18, tempC: "37.8", humidityPct: "55.0" },
  codorniz: { label: "Codorniz (17 días)", days: 17, turnStopDay: 14, tempC: "37.7", humidityPct: "60.0" },
  pato: { label: "Pato (28 días)", days: 28, turnStopDay: 25, tempC: "37.5", humidityPct: "65.0" },
};

export default function IncubacionPage() {
  const searchParams = useSearchParams();
  const { locations } = useFarmLocations();
  const [incubations, setIncubations] = useState<Incubation[]>([]);
  const [hens, setHens] = useState<Hen[]>([]);
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [today, setToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [hatchSelectorOpen, setHatchSelectorOpen] = useState(false);
  const [completeModal, setCompleteModal] = useState<Incubation | null>(null);
  const [candlingModal, setCandlingModal] = useState<Incubation | null>(null);
  const [candlingForm, setCandlingForm] = useState({ fertileEggs: 0, discardedEggs: 0 });
  const [form, setForm] = useState({
    species: "gallina",
    henId: "",
    roosterId: "",
    locationId: "",
    incubatorName: "",
    trayCode: "",
    startDate: new Date().toISOString().split("T")[0],
    eggsSet: 10,
    notes: "",
  });
  const [hatchForm, setHatchForm] = useState({ eggsHatched: 0, femalesHatched: 0, malesHatched: 0, notes: "" });
  const [assignmentMsg, setAssignmentMsg] = useState("");
  const [lastInsight, setLastInsight] = useState<MicroInsightPayload | null>(null);
  const [actionError, setActionError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/incubacion").then((r) => r.json()),
      apiFetch("/api/produccion/gallinas").then((r) => r.json()),
      apiFetch("/api/produccion/gallos").then((r) => r.json()),
    ]).then(([i, h, r]) => {
      setIncubations(Array.isArray(i) ? i : []);
      setHens(Array.isArray(h) ? h : []);
      setRoosters(Array.isArray(r) ? r : []);
      setToday(Date.now());
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useActionQuery(searchParams.get("nuevo"), {
    incubacion: () => {
      setSaveError("");
      setForm({ species: "gallina", henId: "", roosterId: "", locationId: "", incubatorName: "", trayCode: "", startDate: new Date().toISOString().split("T")[0], eggsSet: 10, notes: "" });
      setModalOpen(true);
    },
    eclosion: async () => {
      try {
        setActionError("");
        const response = await apiFetch("/api/produccion/incubacion");
        if (!response.ok) return setActionError("No se pudieron cargar las incubaciones.");
        const rows = await response.json();
        setIncubations(rows);
        if (rows.some((inc: Incubation) => !inc.isComplete)) setHatchSelectorOpen(true);
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
    const saved = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaveError(saved.error || "No se pudo iniciar la incubación");
      return;
    }
    setLastInsight(
      buildIncubationMicroInsight({
        species: form.species,
        startDate: form.startDate,
        eggsSet: Number(form.eggsSet || 0),
        expectedHatchDate: saved.expectedHatchDate,
        turnStopDate: saved.turnStopDate,
        isCompletion: false,
      }),
    );
    setModalOpen(false);
    load();
  };

  const saveCandling = async () => {
    if (!candlingModal) return;
    const res = await apiFetch("/api/produccion/incubacion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: candlingModal.id, fertileEggs: candlingForm.fertileEggs, discardedEggs: candlingForm.discardedEggs }),
    });
    if (res.ok) {
      setCandlingModal(null);
      load();
    }
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
      if (a.batchCode) parts.push(`lote creado: ${a.batchCode}`);
      setAssignmentMsg(parts.length > 0 ? `Asignación automática: ${parts.join(", ")}.` : "Incubación completada sin asignación de aves.");
    } else {
      setAssignmentMsg("");
    }
    setLastInsight(
      buildIncubationMicroInsight({
        species: completeModal.species || "gallina",
        startDate: completeModal.startDate,
        eggsSet: completeModal.eggsSet,
        eggsHatched: hatchForm.eggsHatched,
        fertileEggs: completeModal.fertileEggs ?? completeModal.eggsSet,
        batchCode: a?.batchCode,
        isCompletion: true,
      }),
    );
    setCompleteModal(null);
    load();
  };

  const activeInc = incubations.filter((i) => !i.isComplete);
  const completedInc = incubations.filter((i) => i.isComplete);
  const totalHatched = incubations.reduce((s, i) => s + (i.eggsHatched || 0), 0);
  const totalFertile = incubations.reduce((s, i) => s + (i.fertileEggs ?? i.eggsSet), 0);
  const totalSet = incubations.reduce((s, i) => s + i.eggsSet, 0);
  const avgFertilityPct = totalSet > 0 ? Math.round((totalFertile / totalSet) * 100) : 0;
  const hatchOfFertile = totalFertile > 0 ? Math.round((totalHatched / totalFertile) * 100) : 0;
  const availableHens = hens.filter((h) => h.status === "activa");

  const filteredCompleted = useMemo(() => {
    if (!search.trim()) return completedInc;
    return completedInc.filter((inc) =>
      matchesTextQuery(search, [
        inc.species, inc.henCode, inc.roosterCode, inc.incubatorName, inc.trayCode,
        inc.startDate, inc.expectedHatchDate, inc.notes,
      ]),
    );
  }, [completedInc, search]);

  const getDaysRemaining = (expected: string) => Math.ceil((new Date(expected + "T12:00:00").getTime() - today) / 86400000);
  const selectedSpec = SPECIES_INC_META[form.species] || SPECIES_INC_META.gallina;

  return (
    <div>
      <PageHeader
        theme="incubacion"
        title="Incubación Multiespecie"
        description="Incubación natural y artificial para gallinas (21d), codornices (17d) y patos (28d) con ovoscopía, fertilidad y nacimiento sobre fértiles."
        actions={<Button onClick={() => { setSaveError(""); setForm({ species: "gallina", henId: "", roosterId: "", locationId: locations[0]?.id || "", incubatorName: "", trayCode: "", startDate: new Date().toISOString().split("T")[0], eggsSet: 10, notes: "" }); setModalOpen(true); }}>+ Nueva Incubación</Button>}
      />

      {lastInsight && (
        <div className="mb-6">
          <MicroInsightCard
            insight={lastInsight}
            onDismiss={() => setLastInsight(null)}
            doneLabel="Entendido"
          />
        </div>
      )}

      {actionError && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{actionError}</p>}
      {assignmentMsg && (
        <div className="p-4 rounded-xl mb-6 text-sm font-medium bg-green-50 border border-green-200 text-green-800 flex justify-between items-center">
          <span className="inline-flex items-center gap-2"><AppIcon icon="incubator" className="w-4 h-4 text-green-700 shrink-0" /><span>{assignmentMsg}</span></span>
          <button onClick={() => setAssignmentMsg("")} className="text-green-700 hover:underline text-xs">Cerrar</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
        <StatCard icon="incubator" label="Incubaciones Activas" value={activeInc.length} color="purple" />
        <StatCard icon="chick" label="Crías Nacidas (total)" value={totalHatched} color="yellow" />
        <StatCard icon="eye" label="Fertilidad Ovoscopía" value={`${avgFertilityPct}%`} color="blue" />
        <StatCard icon="percent" label="Nacimiento / Fértiles" value={`${hatchOfFertile}%`} color="green" />
      </div>

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
            const sp = inc.species || "gallina";
            return (
              <Card key={inc.id} className="border-l-4 border-purple-400">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge color="purple">{sp.toUpperCase()}</Badge>
                      {inc.incubatorName && <Badge color="blue">{inc.incubatorName}{inc.trayCode ? ` · ${inc.trayCode}` : ""}</Badge>}
                    </div>
                    <p className="font-semibold flex items-center gap-1.5">
                      <AppIcon icon={sp === "pato" ? "duck" : sp === "codorniz" ? "egg" : "hen"} className="w-4 h-4 text-amber-700" />
                      <span>{inc.henCode || inc.incubatorName || "Incubadora artificial"}</span>
                    </p>
                    {inc.roosterCode && (
                      <p className="text-sm text-slate-600 flex items-center gap-1.5"><Bird className="w-3.5 h-3.5 text-slate-500" /><span>Padre: {inc.roosterCode}</span></p>
                    )}
                    <p className="text-xs text-slate-500">Inicio: {inc.startDate}{inc.turnStopDate ? ` · Detener volteo: ${inc.turnStopDate}` : ""}</p>
                  </div>
                  <Badge color={days <= 3 ? "red" : days <= 7 ? "yellow" : "purple"}>
                    {days > 0 ? `${days} d` : "¡Eclosión!"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div><span className="text-slate-500">Huevos:</span> <strong>{inc.eggsSet}</strong></div>
                  <div><span className="text-slate-500">Eclosión:</span> <strong>{inc.expectedHatchDate}</strong></div>
                  {inc.fertileEggs != null && <div><span className="text-slate-500">Fértiles:</span> <strong>{inc.fertileEggs} ({inc.fertilityPct}%)</strong></div>}
                  {inc.tempTargetC && <div><span className="text-slate-500">Meta T°/HR:</span> <strong>{inc.tempTargetC}°C / {inc.humidityTargetPct}%</strong></div>}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setCandlingModal(inc); setCandlingForm({ fertileEggs: inc.fertileEggs ?? inc.eggsSet, discardedEggs: inc.discardedEggs ?? 0 }); }}>
                    <Eye className="w-4 h-4 mr-1 inline" />Ovoscopía
                  </Button>
                  <Button variant="success" className="flex-1" onClick={() => { setCompleteModal(inc); setHatchForm({ eggsHatched: 0, femalesHatched: 0, malesHatched: 0, notes: inc.notes || "" }); }}>
                    <CheckCircle2 className="w-4 h-4 mr-1 inline" />Eclosión
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-slate-600" aria-hidden="true" />
        <span>Historial de Incubaciones</span>
      </h2>
      <Card>
        <TableSearch value={search} onChange={setSearch} placeholder="Buscar por especie, madre, incubadora, fecha..." resultCount={filteredCompleted.length} totalCount={completedInc.length} className="mb-4" />
        {filteredCompleted.length === 0 ? (
          <EmptyState icon="clipboard" message={search.trim() ? "No hay incubaciones que coincidan" : "No hay incubaciones completadas"} />
        ) : (
          <Table headers={["Especie / Equipo", "Inicio", "Eclosión", "Cargados", "Fértiles (%)", "Nacidos", "Eclosión / Fértiles", "Notas"]}>
            {filteredCompleted.map((inc) => (
              <tr key={inc.id} className="hover:bg-slate-50 text-sm">
                <td className="px-4 py-3 font-medium">
                  <span className="capitalize">{inc.species || "gallina"}</span>
                  {(inc.henCode || inc.incubatorName) && <span className="block text-xs text-slate-500">{inc.henCode || inc.incubatorName}{inc.trayCode ? ` · ${inc.trayCode}` : ""}</span>}
                </td>
                <td className="px-4 py-3">{inc.startDate}</td>
                <td className="px-4 py-3">{inc.expectedHatchDate}</td>
                <td className="px-4 py-3">{inc.eggsSet}</td>
                <td className="px-4 py-3">{inc.fertileEggs != null ? `${inc.fertileEggs} (${inc.fertilityPct}%)` : "—"}</td>
                <td className="px-4 py-3 font-bold text-green-600">
                  {inc.eggsHatched}
                  {inc.malesHatched != null && inc.femalesHatched != null && (
                    <span className="block text-xs font-normal text-slate-500">♀ {inc.femalesHatched} · ♂ {inc.malesHatched}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge color={((inc.hatchOfFertilePct ?? inc.hatchTotalPct ?? 0) >= 75) ? "green" : "yellow"}>
                    {inc.hatchOfFertilePct != null ? `${inc.hatchOfFertilePct}% / fértiles` : `${inc.hatchTotalPct ?? 0}% total`}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">{inc.notes || "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Incubación Multiespecie">
        <div className="space-y-4">
          {saveError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Especie *" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value, henId: "" })}>
              <option value="gallina">Gallina (21 días · detener volteo día 18)</option>
              <option value="codorniz">Codorniz (17 días · detener volteo día 14)</option>
              <option value="pato">Pato (28 días · detener volteo día 25)</option>
            </Select>
            <Select label="Lugar destino crías" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">Opcional…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </div>
          {form.species === "gallina" && (
            <div className="grid grid-cols-2 gap-3">
              <Select label="Gallina Clueca (opcional)" value={form.henId} onChange={(e) => setForm({ ...form, henId: e.target.value })}>
                <option value="">Incubación artificial</option>
                {availableHens.map((h) => <option key={h.id} value={h.id}>{h.code}</option>)}
              </Select>
              <Select label="Gallo progenitor (opcional)" value={form.roosterId} onChange={(e) => setForm({ ...form, roosterId: e.target.value })}>
                <option value="">No identificado</option>
                {roosters.map((rooster) => <option key={rooster.id} value={rooster.id}>{rooster.code} · {rooster.breed}</option>)}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Incubadora / Nacedora" value={form.incubatorName} onChange={(e) => setForm({ ...form, incubatorName: e.target.value })} placeholder="Ej: Incubadora 120H" />
            <Input label="Bandeja / Lote" value={form.trayCode} onChange={(e) => setForm({ ...form, trayCode: e.target.value })} placeholder="Ej: B-02" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha de Inicio *" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Número de Huevos *" type="number" min="1" value={form.eggsSet} onChange={(e) => setForm({ ...form, eggsSet: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-800 space-y-1">
            <p className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Ciclo: <strong>{selectedSpec.days} días</strong> · Detener volteo día {selectedSpec.turnStopDay} · Eclosión estimada: <strong>{new Date(new Date(form.startDate).getTime() + selectedSpec.days * 86400000).toLocaleDateString("es")}</strong></span>
            </p>
            <p className="text-xs text-purple-700">Parámetros meta: {selectedSpec.tempC}°C · {selectedSpec.humidityPct}% HR</p>
          </div>
          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={save} disabled={form.eggsSet < 1}>Iniciar Incubación</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!candlingModal} onClose={() => setCandlingModal(null)} title="Registrar Ovoscopía (Fertilidad)">
        {candlingModal && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Huevos cargados: <strong>{candlingModal.eggsSet}</strong></p>
            <Input label="Huevos fértiles confirmados" type="number" min="0" max={candlingModal.eggsSet} value={candlingForm.fertileEggs} onChange={(e) => setCandlingForm({ ...candlingForm, fertileEggs: parseInt(e.target.value) || 0 })} />
            <Input label="Claros / Aborto embrionario retirados" type="number" min="0" max={candlingModal.eggsSet} value={candlingForm.discardedEggs} onChange={(e) => setCandlingForm({ ...candlingForm, discardedEggs: parseInt(e.target.value) || 0 })} />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setCandlingModal(null)}>Cancelar</Button>
              <Button onClick={saveCandling}>Guardar Ovoscopía</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={hatchSelectorOpen} onClose={() => setHatchSelectorOpen(false)} title="Selecciona la incubación">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Elige el registro que vas a completar:</p>
          {incubations.filter((inc) => !inc.isComplete).map((inc) => (
            <button key={inc.id} type="button" onClick={() => { setHatchSelectorOpen(false); setCompleteModal(inc); setHatchForm({ eggsHatched: 0, femalesHatched: 0, malesHatched: 0, notes: "" }); }} className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-green-400 hover:bg-green-50">
              <strong className="block text-sm text-slate-800">{(inc.species || "gallina").toUpperCase()} · Inicio: {inc.startDate} · {inc.eggsSet} huevos</strong>
              <span className="text-xs text-slate-500">Eclosión esperada: {inc.expectedHatchDate}{inc.henCode ? ` · ${inc.henCode}` : ""}</span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={!!completeModal} onClose={() => setCompleteModal(null)} title="Registrar Eclosión">
        <div className="space-y-4">
          {completeModal && (
            <>
              <div className="p-3 bg-green-50 rounded-lg text-sm space-y-1">
                <p>Especie: <strong className="capitalize">{completeModal.species || "gallina"}</strong></p>
                <p className="flex items-center gap-1.5"><Egg className="w-4 h-4 text-green-700" /><span>Huevos incubados: <strong>{completeModal.eggsSet}</strong>{completeModal.fertileEggs != null ? ` (Fértiles: ${completeModal.fertileEggs})` : ""}</span></p>
              </div>
              <Input label="Crías Nacidas" type="number" min="0" max={completeModal.eggsSet} value={hatchForm.eggsHatched} onChange={(e) => setHatchForm({ ...hatchForm, eggsHatched: parseInt(e.target.value) || 0 })} />
              {(completeModal.species || "gallina") === "gallina" && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Hembras nacidas" type="number" min="0" value={hatchForm.femalesHatched} onChange={(e) => setHatchForm({ ...hatchForm, femalesHatched: parseInt(e.target.value) || 0 })} />
                  <Input label="Machos nacidos" type="number" min="0" value={hatchForm.malesHatched} onChange={(e) => setHatchForm({ ...hatchForm, malesHatched: parseInt(e.target.value) || 0 })} />
                </div>
              )}
              {(completeModal.species || "gallina") === "gallina" && hatchForm.femalesHatched + hatchForm.malesHatched !== hatchForm.eggsHatched && (
                <p className="text-xs text-orange-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /><span>Hembras + machos no coincide con nacidos.</span></p>
              )}
              <Textarea label="Notas finales" value={hatchForm.notes} onChange={(e) => setHatchForm({ ...hatchForm, notes: e.target.value })} />
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
