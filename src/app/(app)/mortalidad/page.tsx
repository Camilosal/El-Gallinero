"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/fetch";
import { Card, StatCard, PageHeader, Button, Input, Select, Textarea, Modal, Table, Badge, EmptyState } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type MortalityRecord = {
  id: string;
  date: string;
  birdType: string;
  quantity: number;
  cause: string;
  henCode: string | null;
  roosterCode: string | null;
  batchCode: string | null;
  description: string | null;
};

type EggLoss = {
  id: string;
  date: string;
  quantity: number;
  size: string | null;
  reason: string;
  notes: string | null;
};

const CAUSE_LABELS: Record<string, string> = { enfermedad: "Enfermedad", depredador: "Depredador", accidente: "Accidente", sacrificio_sanitario: "Sacrificio sanitario", causa_natural: "Causa natural", otro: "Otro" };
const CAUSE_COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#8b5cf6", "#6b7280"];
const BIRD_LABELS: Record<string, string> = { gallina: "Gallina", gallo: "Gallo", lote_pollos: "Lote pollos" };
const REASON_COLORS = ["#ef4444", "#f97316", "#eab308", "#6b7280"];

const emptyForm = { date: new Date().toISOString().split("T")[0], birdType: "gallina", cause: "enfermedad", henId: "", roosterId: "", batchId: "", quantity: "1", description: "" };
const emptyLoss = { date: new Date().toISOString().split("T")[0], quantity: "1", size: "", reason: "roto", notes: "" };

export default function MortalidadPage() {
  const [records, setRecords] = useState<MortalityRecord[]>([]);
  const [losses, setLosses] = useState<EggLoss[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lossForm, setLossForm] = useState(emptyLoss);
  const [error, setError] = useState("");
  const [lossError, setLossError] = useState("");
  const [stats, setStats] = useState<{ mortalityRate: number; totalDeaths: number; totalFlock: number; byCause: { cause: string; total: number }[] }>({ mortalityRate: 0, totalDeaths: 0, totalFlock: 0, byCause: [] });
  const [lossStats, setLossStats] = useState<{ totalLost: number; byReason: { reason: string; total: number }[] }>({ totalLost: 0, byReason: [] });
  const [hens, setHens] = useState<{ id: string; code: string }[]>([]);
  const [roosters, setRoosters] = useState<{ id: string; code: string }[]>([]);
  const [batches, setBatches] = useState<{ id: string; code: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [mortRes, lossRes, hensRes, roostersRes, batchesRes] = await Promise.all([
      apiFetch("/api/mortalidad?period=30"),
      apiFetch("/api/perdidas-huevos?period=30"),
      apiFetch("/api/gallinas"),
      apiFetch("/api/gallos"),
      apiFetch("/api/lotes-pollos"),
    ]);
    if (mortRes.ok) {
      const data = await mortRes.json();
      setRecords(data.records);
      setStats({ mortalityRate: data.mortalityRate, totalDeaths: data.totalDeaths, totalFlock: data.totalFlock, byCause: data.byCause });
    }
    if (lossRes.ok) {
      const data = await lossRes.json();
      setLosses(data.losses);
      setLossStats({ totalLost: data.totalLost, byReason: data.byReason });
    }
    if (hensRes.ok) { const d = await hensRes.json(); setHens(d.map((h: any) => ({ id: h.id, code: h.code }))); }
    if (roostersOk(roostersRes)) { const d = await roostersRes.json(); setRoosters(d.map((r: any) => ({ id: r.id, code: r.code }))); }
    if (batchesRes.ok) { const d = await batchesRes.json(); setBatches(d.filter((b: any) => b.status === "activo" || b.status === "listo_sacrificio").map((b: any) => ({ id: b.id, code: b.code }))); }
    setLoading(false);
  }, []);

  function roostersOk(r: Response) { return r.ok; }

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setError("");
    const payload: any = { date: form.date, birdType: form.birdType, cause: form.cause, description: form.description };
    if (form.birdType === "gallina") payload.henId = form.henId || undefined;
    if (form.birdType === "gallo") payload.roosterId = form.roosterId || undefined;
    if (form.birdType === "lote_pollos") { payload.batchId = form.batchId || undefined; payload.quantity = form.quantity; }
    if (form.birdType === "gallina" && !form.henId) return setError("Seleccione una gallina");
    if (form.birdType === "gallo" && !form.roosterId) return setError("Seleccione un gallo");
    if (form.birdType === "lote_pollos" && !form.batchId) return setError("Seleccione un lote");

    const method = editingId ? "PUT" : "POST";
    const body = editingId ? JSON.stringify({ ...payload, id: editingId }) : JSON.stringify(payload);
    const res = await apiFetch("/api/mortalidad", { method, headers: { "Content-Type": "application/json" }, body });
    if (!res.ok) { const e = await res.json(); return setError(e.error || "Error"); }
    setModalOpen(false);
    setForm(emptyForm);
    setEditingId(null);
    load();
  };

  const saveLoss = async () => {
    setLossError("");
    if (!lossForm.quantity || Number(lossForm.quantity) < 1) return setLossError("Cantidad mínima: 1");
    const res = await apiFetch("/api/perdidas-huevos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lossForm) });
    if (!res.ok) { const e = await res.json(); return setLossError(e.error || "Error"); }
    setLossModalOpen(false);
    setLossForm(emptyLoss);
    load();
  };

  const removeRecord = async (id: string) => {
    if (!confirm("¿Eliminar este registro? Se restaurará el ave/lote.")) return;
    await apiFetch(`/api/mortalidad?id=${id}`, { method: "DELETE" });
    load();
  };

  const editRecord = (r: MortalityRecord) => {
    setEditingId(r.id);
    setForm({
      date: r.date,
      birdType: r.birdType,
      cause: r.cause,
      description: r.description || "",
      henId: "",
      roosterId: "",
      batchId: "",
      quantity: String(r.quantity || 1),
    });
    setError("");
    setModalOpen(true);
  };

  const removeLoss = async (id: string) => {
    if (!confirm("¿Eliminar esta pérdida?")) return;
    await apiFetch(`/api/perdidas-huevos?id=${id}`, { method: "DELETE" });
    load();
  };

  const pieData = stats.byCause.map((b) => ({ name: CAUSE_LABELS[b.cause] || b.cause, value: b.total }));
  const lossPieData = lossStats.byReason.map((r) => ({ name: r.reason, value: r.total }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mortalidad y Pérdidas"
        description="Registro de muertes por causa y pérdidas de huevo"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setLossForm(emptyLoss); setLossError(""); setLossModalOpen(true); }}>Pérdida de huevos</Button>
            <Button onClick={() => { setForm(emptyForm); setError(""); setEditingId(null); setModalOpen(true); }}>Registrar muerte</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="💀" label="Tasa mortalidad (30d)" value={`${stats.mortalityRate}%`} color="red" />
        <StatCard icon="🐔" label="Muertes (30d)" value={String(stats.totalDeaths)} color="yellow" />
        <StatCard icon="🏠" label="Parvada total" value={String(stats.totalFlock)} color="green" />
        <StatCard icon="🥚" label="Huevos perdidos (30d)" value={String(lossStats.totalLost)} color="purple" />
      </div>

      {pieData.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Muertes por causa (30 días)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {pieData.map((_, i) => <Cell key={i} fill={CAUSE_COLORS[i % CAUSE_COLORS.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Historial de mortalidad</h3>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : records.length === 0 ? (
          <EmptyState icon="💀" message="No hay registros de mortalidad" />
        ) : (
          <Table headers={["Fecha", "Tipo", "Ave/Lote", "Causa", "Descripción", "Acciones"]}>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{r.date}</td>
                <td className="px-4 py-3 text-sm">{BIRD_LABELS[r.birdType] || r.birdType}</td>
                <td className="px-4 py-3 text-sm">{r.henCode || r.roosterCode || r.batchCode || "—"}</td>
                <td className="px-4 py-3"><Badge color="red">{CAUSE_LABELS[r.cause] || r.cause}</Badge></td>
                <td className="px-4 py-3 text-sm text-slate-500">{r.description || "—"}</td>
                <td className="px-4 py-3 flex gap-3"><button onClick={() => editRecord(r)} className="text-blue-600 hover:underline text-xs">Editar</button><button onClick={() => removeRecord(r.id)} className="text-red-600 hover:underline text-xs">Eliminar</button></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {losses.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Pérdidas de huevo</h3>
          <Table headers={["Fecha", "Cantidad", "Tamaño", "Razón", "Notas", "Acciones"]}>
            {losses.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{l.date}</td>
                <td className="px-4 py-3 text-sm font-medium">{l.quantity}</td>
                <td className="px-4 py-3 text-sm">{l.size || "—"}</td>
                <td className="px-4 py-3"><Badge color="yellow">{l.reason}</Badge></td>
                <td className="px-4 py-3 text-sm text-slate-500">{l.notes || "—"}</td>
                <td className="px-4 py-3"><button onClick={() => removeLoss(l.id)} className="text-red-600 hover:underline text-xs">Eliminar</button></td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); }} title={editingId ? "Editar Muerte" : "Registrar Muerte"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Select label="Tipo de ave" value={form.birdType} onChange={(e) => setForm({ ...form, birdType: e.target.value })}>
            <option value="gallina">Gallina</option>
            <option value="gallo">Gallo</option>
            <option value="lote_pollos">Lote de pollos</option>
          </Select>

          {form.birdType === "gallina" && (
            <Select label="Gallina" value={form.henId} onChange={(e) => setForm({ ...form, henId: e.target.value })}>
              <option value="">Seleccionar...</option>
              {hens.map((h) => <option key={h.id} value={h.id}>{h.code}</option>)}
            </Select>
          )}
          {form.birdType === "gallo" && (
            <Select label="Gallo" value={form.roosterId} onChange={(e) => setForm({ ...form, roosterId: e.target.value })}>
              <option value="">Seleccionar...</option>
              {roosters.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
            </Select>
          )}
          {form.birdType === "lote_pollos" && (
            <>
              <Select label="Lote" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
                <option value="">Seleccionar...</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
              </Select>
              <Input label="Cantidad" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </>
          )}

          <Select label="Causa" value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })}>
            {Object.entries(CAUSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Actualizar" : "Guardar"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={lossModalOpen} onClose={() => setLossModalOpen(false)} title="Registrar Pérdida de Huevos">
        <div className="space-y-4">
          {lossError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{lossError}</p>}
          <Input label="Fecha" type="date" value={lossForm.date} onChange={(e) => setLossForm({ ...lossForm, date: e.target.value })} />
          <Input label="Cantidad" type="number" min="1" value={lossForm.quantity} onChange={(e) => setLossForm({ ...lossForm, quantity: e.target.value })} />
          <Input label="Tamaño (opcional)" value={lossForm.size} onChange={(e) => setLossForm({ ...lossForm, size: e.target.value })} />
          <Select label="Razón" value={lossForm.reason} onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value })}>
            <option value="roto">Roto</option>
            <option value="deteriorado">Deteriorado</option>
            <option value="contaminado">Contaminado</option>
            <option value="otro">Otro</option>
          </Select>
          <Textarea label="Notas" value={lossForm.notes} onChange={(e) => setLossForm({ ...lossForm, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setLossModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveLoss}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
