"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch";
import { PageHeader, StatCard, Card, Button, Input, Select, Textarea, Badge, Modal, Table, EmptyState } from "@/components/ui";

interface Rooster {
  id: string;
  code: string;
  breed: string;
  birthDate: string;
  status: string;
  weight: string | null;
  notes: string | null;
  ageWeeks: number;
}

interface Batch {
  id: string;
  code: string;
  breed: string;
  startDate: string;
  initialQuantity: number;
  currentQuantity: number;
  targetWeeks: number;
  targetWeightKg: string;
  avgWeightKg: string | null;
  status: string;
  notes: string | null;
  ageWeeks: number;
  readinessReasons: string[];
}

interface FlockBalance {
  required: number;
  active: number;
  deficit: number;
  surplus: number;
}

const roosterStatusLabels: Record<string, { label: string; color: string }> = {
  activo: { label: "✅ Activo", color: "green" },
  enfermo: { label: "🤒 Enfermo", color: "yellow" },
  vendido: { label: "💰 Vendido", color: "blue" },
  faena: { label: "🍗 Faena", color: "orange" },
  muerto: { label: "💀 Muerto", color: "gray" },
};

const batchStatusLabels: Record<string, { label: string; color: string }> = {
  activo: { label: "🐥 En crianza", color: "green" },
  listo_sacrificio: { label: "✅ Listo sacrificio", color: "orange" },
  vendido: { label: "💰 Vendido", color: "blue" },
  faena: { label: "🍗 Faena", color: "gray" },
};

type Tab = "gallos" | "lotes";

export default function PollosPage() {
  const [tab, setTab] = useState<Tab>("gallos");

  // ─── Gallos state ───
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [balance, setBalance] = useState<FlockBalance | null>(null);
  const [roosterModalOpen, setRoosterModalOpen] = useState(false);
  const [editingRooster, setEditingRooster] = useState<Rooster | null>(null);
  const [roosterError, setRoosterError] = useState("");
  const [roosterForm, setRoosterForm] = useState({
    code: "",
    breed: "",
    birthDate: new Date().toISOString().split("T")[0],
    status: "activo",
    weight: "",
    notes: "",
  });

  // ─── Lotes state ───
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchError, setBatchError] = useState("");
  const [batchForm, setBatchForm] = useState({
    code: "",
    breed: "",
    startDate: new Date().toISOString().split("T")[0],
    initialQuantity: "",
    currentQuantity: "",
    targetWeeks: "7",
    targetWeightKg: "2.5",
    avgWeightKg: "",
    status: "activo",
    notes: "",
  });

  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/pollos").then((r) => r.json()),
      apiFetch("/api/produccion/pollos").then((r) => r.json()),
    ]).then(([gallosData, lotesData]) => {
      setRoosters(Array.isArray(gallosData?.roosters) ? gallosData.roosters : []);
      setBalance(gallosData?.balance || null);
      setBatches(Array.isArray(lotesData) ? lotesData : []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Gallos CRUD ───
  const openNewRooster = () => {
    setEditingRooster(null);
    setRoosterError("");
    setRoosterForm({ code: "", breed: "", birthDate: new Date().toISOString().split("T")[0], status: "activo", weight: "", notes: "" });
    setRoosterModalOpen(true);
  };

  const openEditRooster = (r: Rooster) => {
    setEditingRooster(r);
    setRoosterError("");
    setRoosterForm({ code: r.code, breed: r.breed, birthDate: r.birthDate, status: r.status, weight: r.weight || "", notes: r.notes || "" });
    setRoosterModalOpen(true);
  };

  const saveRooster = async () => {
    setRoosterError("");
    if (!roosterForm.breed) { setRoosterError("Raza requerida"); return; }
    if (!roosterForm.birthDate) { setRoosterError("Fecha de nacimiento requerida"); return; }

    const payload: Record<string, unknown> = {
      code: roosterForm.code || undefined,
      breed: roosterForm.breed,
      birthDate: roosterForm.birthDate,
      status: roosterForm.status,
      weight: roosterForm.weight || null,
      notes: roosterForm.notes || null,
    };
    if (editingRooster) payload.id = editingRooster.id;

    const method = editingRooster ? "PUT" : "POST";
    const res = await apiFetch("/api/produccion/pollos", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setRoosterError(data.error || "Error al guardar"); return; }
    setRoosterModalOpen(false);
    load();
  };

  const removeRooster = async (id: string) => {
    if (!confirm("¿Eliminar este gallo?")) return;
    await apiFetch(`/api/produccion/pollos?id=${id}`, { method: "DELETE" });
    load();
  };

  // ─── Lotes CRUD ───
  const openNewBatch = () => {
    setEditingBatch(null);
    setBatchError("");
    setBatchForm({ code: "", breed: "", startDate: new Date().toISOString().split("T")[0], initialQuantity: "", currentQuantity: "", targetWeeks: "7", targetWeightKg: "2.5", avgWeightKg: "", status: "activo", notes: "" });
    setBatchModalOpen(true);
  };

  const openEditBatch = (b: Batch) => {
    setEditingBatch(b);
    setBatchError("");
    setBatchForm({
      code: b.code, breed: b.breed, startDate: b.startDate,
      initialQuantity: String(b.initialQuantity), currentQuantity: String(b.currentQuantity),
      targetWeeks: String(b.targetWeeks), targetWeightKg: b.targetWeightKg,
      avgWeightKg: b.avgWeightKg || "", status: b.status, notes: b.notes || "",
    });
    setBatchModalOpen(true);
  };

  const saveBatch = async () => {
    setBatchError("");
    if (!batchForm.breed) { setBatchError("Raza requerida"); return; }
    const initialQty = Number(batchForm.initialQuantity);
    if (!initialQty || initialQty < 1) { setBatchError("Cantidad inicial inválida"); return; }
    const currentQty = batchForm.currentQuantity ? Number(batchForm.currentQuantity) : initialQty;
    if (currentQty < 0 || currentQty > initialQty) { setBatchError("La cantidad actual debe estar entre 0 y la cantidad inicial"); return; }

    const payload: Record<string, unknown> = {
      code: batchForm.code || undefined,
      breed: batchForm.breed,
      startDate: batchForm.startDate,
      initialQuantity: initialQty,
      currentQuantity: currentQty,
      targetWeeks: Number(batchForm.targetWeeks) || 7,
      targetWeightKg: batchForm.targetWeightKg || "2.5",
      avgWeightKg: batchForm.avgWeightKg || null,
      status: batchForm.status,
      notes: batchForm.notes || null,
    };
    if (editingBatch) payload.id = editingBatch.id;

    const method = editingBatch ? "PUT" : "POST";
    const res = await apiFetch("/api/produccion/pollos", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setBatchError(data.error || "Error al guardar"); return; }
    setBatchModalOpen(false);
    load();
  };

  const removeBatch = async (id: string) => {
    if (!confirm("¿Eliminar este lote?")) return;
    await apiFetch(`/api/produccion/pollos?id=${id}`, { method: "DELETE" });
    load();
  };

  // ─── Stats ───
  const activeRoosters = roosters.filter((r) => r.status === "activo").length;
  const totalInBatches = batches.reduce((s, b) => s + b.currentQuantity, 0);
  const readyBatches = batches.filter((b) => b.status === "listo_sacrificio");

  return (
    <div>
      <PageHeader
        title="🐓 Pollos y Gallos"
        description="Gestión de gallos reproductores y lotes de pollos de engorde"
        help="Aquí gestionas gallos reproductores y lotes de pollos de engorde.\n\n• Gallos: reproductores que mantienen el balance con las gallinas (1 gallo por cada 10 gallinas).\n• Lotes de engorde: pollitos nacidos de incubaciones que se crían para carne. Cuando alcanzan el peso objetivo (~7 sem), están listos para sacrificio.\n• El sistema marca automáticamente los lotes como 'listos para sacrificio' cuando cumplen la edad o peso objetivo."
        actions={
          <div className="flex gap-2">
            {tab === "gallos" && <Button onClick={openNewRooster}>+ Nuevo Gallo</Button>}
            {tab === "lotes" && <Button onClick={openNewBatch}>+ Nuevo Lote</Button>}
          </div>
        }
      />

      {/* Banner de balance gallos/gallinas */}
      {balance && (
        <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${balance.deficit > 0 ? "bg-orange-50 border border-orange-200 text-orange-800" : "bg-green-50 border border-green-200 text-green-800"}`}>
          {balance.deficit > 0 ? (
            <>⚠️ Faltan <strong>{balance.deficit}</strong> gallo{balance.deficit > 1 ? "s" : ""} reproductor{balance.deficit > 1 ? "es" : ""}: se requieren <strong>{balance.required}</strong> para las gallinas activas y hay <strong>{balance.active}</strong> activos.</>
          ) : (
            <>✅ Balance correcto: <strong>{balance.active}</strong> gallo{balance.active !== 1 ? "s" : ""} activos para un requerimiento de <strong>{balance.required}</strong> (1 gallo por cada 10 gallinas).</>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon="🐓" label="Gallos Activos" value={activeRoosters} color="red" />
        <StatCard icon="🐥" label="Pollos en Lotes" value={totalInBatches} color="yellow" />
        <StatCard icon="✅" label="Lotes Listos" value={readyBatches.length} color="green" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab("gallos")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "gallos" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🐓 Gallos
        </button>
        <button onClick={() => setTab("lotes")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "lotes" ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
          🐥 Lotes de Engorde
        </button>
      </div>

      {/* ─── TAB: GALLOS ─── */}
      {tab === "gallos" && (
        <Card>
          {loading ? (
            <p className="text-center py-8 text-slate-400">Cargando...</p>
          ) : roosters.length === 0 ? (
            <EmptyState icon="🐓" message="No hay gallos registrados" />
          ) : (
            <Table headers={["Código", "Raza", "Edad", "Peso", "Estado", ""]}>
              {roosters.map((r) => {
                const st = roosterStatusLabels[r.status] || { label: r.status, color: "gray" };
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-red-700">🐓 {r.code}</td>
                    <td className="px-4 py-3 text-sm">{r.breed}</td>
                    <td className="px-4 py-3 text-sm">{r.ageWeeks} sem</td>
                    <td className="px-4 py-3 text-sm">{r.weight ? `${r.weight} kg` : "—"}</td>
                    <td className="px-4 py-3"><Badge color={st.color}>{st.label}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEditRooster(r)} className="text-blue-600 hover:underline text-xs">Editar</button>
                        <button onClick={() => removeRooster(r.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      )}

      {/* ─── TAB: LOTES ─── */}
      {tab === "lotes" && (
        <Card>
          {loading ? (
            <p className="text-center py-8 text-slate-400">Cargando...</p>
          ) : batches.length === 0 ? (
            <EmptyState icon="🐥" message="No hay lotes de engorde registrados" />
          ) : (
            <Table headers={["Código", "Raza", "Edad", "Cantidad", "Peso Prom.", "Objetivo", "Estado", ""]}>
              {batches.map((b) => {
                const st = batchStatusLabels[b.status] || { label: b.status, color: "gray" };
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-orange-700">📦 {b.code}</td>
                    <td className="px-4 py-3 text-sm">{b.breed}</td>
                    <td className="px-4 py-3 text-sm">{b.ageWeeks} sem</td>
                    <td className="px-4 py-3 text-sm">{b.currentQuantity} / {b.initialQuantity}</td>
                    <td className="px-4 py-3 text-sm">{b.avgWeightKg ? `${b.avgWeightKg} kg` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{b.targetWeeks} sem o {Number(b.targetWeightKg)} kg</td>
                    <td className="px-4 py-3">
                      <Badge color={st.color}>{st.label}</Badge>
                      {b.readinessReasons.length > 0 && (
                        <p className="text-xs text-orange-600 mt-1">{b.readinessReasons.join(" · ")}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEditBatch(b)} className="text-blue-600 hover:underline text-xs">Editar</button>
                        <button onClick={() => removeBatch(b.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      )}

      {/* ─── Modal Gallo ─── */}
      <Modal open={roosterModalOpen} onClose={() => setRoosterModalOpen(false)} title={editingRooster ? "✏️ Editar Gallo" : "🐓 Nuevo Gallo"}>
        <div className="space-y-4">
          {roosterError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{roosterError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Código (opcional)" help="Código del gallo. Si lo dejas vacío se genera automáticamente (GA-###)." placeholder="Autogenerado GA-###" value={roosterForm.code} onChange={(e) => setRoosterForm({ ...roosterForm, code: e.target.value })} disabled={!!editingRooster} />
            <Input label="Raza *" help="Raza del gallo." placeholder="Ej: Rhode Island" value={roosterForm.breed} onChange={(e) => setRoosterForm({ ...roosterForm, breed: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha de nacimiento *" help="Fecha de nacimiento del gallo." type="date" value={roosterForm.birthDate} onChange={(e) => setRoosterForm({ ...roosterForm, birthDate: e.target.value })} />
            <Input label="Peso (kg)" help="Peso actual del gallo." type="number" step="0.1" value={roosterForm.weight} onChange={(e) => setRoosterForm({ ...roosterForm, weight: e.target.value })} />
          </div>
          <Select label="Estado" help="Estado actual del gallo reproductor." value={roosterForm.status} onChange={(e) => setRoosterForm({ ...roosterForm, status: e.target.value })}>
            {Object.entries(roosterStatusLabels).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Textarea label="Notas" help="Observaciones sobre el gallo." value={roosterForm.notes} onChange={(e) => setRoosterForm({ ...roosterForm, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={saveRooster}>{editingRooster ? "Actualizar" : "Registrar"}</Button>
            <Button variant="secondary" onClick={() => setRoosterModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Modal Lote ─── */}
      <Modal open={batchModalOpen} onClose={() => setBatchModalOpen(false)} title={editingBatch ? "✏️ Editar Lote" : "🐥 Nuevo Lote de Engorde"}>
        <div className="space-y-4">
          {batchError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{batchError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Código (opcional)" help="Código del lote. Si lo dejas vacío se genera automáticamente (L-###)." placeholder="Autogenerado L-###" value={batchForm.code} onChange={(e) => setBatchForm({ ...batchForm, code: e.target.value })} disabled={!!editingBatch} />
            <Input label="Raza *" help="Raza de los pollitos del lote." placeholder="Ej: Cobb 500" value={batchForm.breed} onChange={(e) => setBatchForm({ ...batchForm, breed: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha de inicio" help="Fecha en que iniciaste la crianza del lote." type="date" value={batchForm.startDate} onChange={(e) => setBatchForm({ ...batchForm, startDate: e.target.value })} />
            <Input label="Cantidad inicial *" help="Número de pollitos al inicio del lote." type="number" min="1" value={batchForm.initialQuantity} onChange={(e) => setBatchForm({ ...batchForm, initialQuantity: e.target.value })} />
          </div>
          {editingBatch && (
            <Input label="Cantidad actual" help="Cantidad de pollos vivos actualmente en el lote." type="number" min="0" value={batchForm.currentQuantity} onChange={(e) => setBatchForm({ ...batchForm, currentQuantity: e.target.value })} />
          )}
          <div className="grid grid-cols-3 gap-3">
            <Input label="Edad objetivo (sem)" help="Semanas de edad a las que el lote estará listo para sacrificio." type="number" min="1" value={batchForm.targetWeeks} onChange={(e) => setBatchForm({ ...batchForm, targetWeeks: e.target.value })} />
            <Input label="Peso objetivo (kg)" help="Peso esperado por ave para considerar el lote listo." type="number" step="0.1" value={batchForm.targetWeightKg} onChange={(e) => setBatchForm({ ...batchForm, targetWeightKg: e.target.value })} />
            <Input label="Peso promedio (kg)" help="Peso promedio actual del lote (opcional, para seguimiento)." type="number" step="0.1" value={batchForm.avgWeightKg} onChange={(e) => setBatchForm({ ...batchForm, avgWeightKg: e.target.value })} />
          </div>
          {editingBatch && (
            <Select label="Estado" help="Estado actual del lote." value={batchForm.status} onChange={(e) => setBatchForm({ ...batchForm, status: e.target.value })}>
              {Object.entries(batchStatusLabels).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          )}
          <Textarea label="Notas" help="Observaciones sobre el lote." value={batchForm.notes} onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={saveBatch}>{editingBatch ? "Actualizar" : "Registrar"}</Button>
            <Button variant="secondary" onClick={() => setBatchModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
