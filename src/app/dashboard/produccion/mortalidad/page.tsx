"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/fetch";
import { Card, StatCard, PageHeader, Button, Input, Select, Textarea, Modal, Table, Badge, EmptyState } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useFarmLocations } from "@/lib/useFarmLocations";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";
import { syncManager } from "@/lib/offline/syncManager";
import { getCachedRecords, setCachedRecords } from "@/lib/offline/db";

type MortalityRecord = {
  id: string;
  date: string;
  birdType: string;
  species?: string | null;
  quantity: number;
  cause: string;
  henId: string | null;
  roosterId: string | null;
  batchId: string | null;
  locationId: string | null;
  locationName: string | null;
  healthControlId: string | null;
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
const BATCH_TYPES = ["lote_pollos", "lote_codornices", "lote_patos", "lote_conejos"];
const BATCH_SPECIES_BY_TYPE: Record<string, string> = {
  lote_pollos: "pollo",
  lote_codornices: "codorniz",
  lote_patos: "pato",
  lote_conejos: "conejo",
};
const BIRD_LABELS: Record<string, string> = {
  gallina: "Gallina",
  gallo: "Gallo",
  lote_pollos: "Lote de pollos",
  lote_codornices: "Lote de codornices",
  lote_patos: "Lote de patos",
  lote_conejos: "Lote de conejos",
};
const REASON_COLORS = ["#ef4444", "#f97316", "#eab308", "#6b7280"];

const emptyForm = { date: new Date().toISOString().split("T")[0], birdType: "gallina", cause: "enfermedad", henId: "", roosterId: "", batchId: "", locationId: "", quantity: "1", description: "" };
const emptyLoss = { date: new Date().toISOString().split("T")[0], quantity: "1", size: "", reason: "roto", notes: "" };

export default function MortalidadPage() {
  const searchParams = useSearchParams();
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
  const [hens, setHens] = useState<{ id: string; code: string; locationId?: string | null }[]>([]);
  const [roosters, setRoosters] = useState<{ id: string; code: string; locationId?: string | null }[]>([]);
  const [batches, setBatches] = useState<{ id: string; code: string; species: string; locationId?: string | null }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mortalitySearch, setMortalitySearch] = useState("");
  const [lossSearch, setLossSearch] = useState("");
  const { locations } = useFarmLocations();

  const load = useCallback(async () => {
    // 1. Cargar primero de caché local
    void getCachedRecords<any[]>("produccion_mortalidad").then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setRecords(cached);
        setLoading(false);
      }
    });

    try {
      const [mortRes, lossRes, hensRes, roostersRes, batchesRes] = await Promise.all([
        apiFetch("/api/produccion/mortalidad?period=30"),
        apiFetch("/api/perdidas-huevos?period=30").catch(() => null),
        apiFetch("/api/produccion/gallinas").catch(() => null),
        apiFetch("/api/produccion/gallos").catch(() => null),
        apiFetch("/api/produccion/pollos").catch(() => null),
      ]);
      if (mortRes && mortRes.ok) {
        const data = await mortRes.json();
        setRecords(data.records);
        void setCachedRecords("produccion_mortalidad", data.records);
        setStats({ mortalityRate: data.mortalityRate, totalDeaths: data.totalDeaths, totalFlock: data.totalFlock, byCause: data.byCause });
      }
      if (lossRes && lossRes.ok) {
        const data = await lossRes.json();
        setLosses(data.losses);
        setLossStats({ totalLost: data.totalLost, byReason: data.byReason });
      }
      if (hensRes && hensRes.ok) { const d = await hensRes.json(); setHens(d.map((h: any) => ({ id: h.id, code: h.code, locationId: h.locationId }))); }
      if (roostersRes && roostersRes.ok) { const d = await roostersRes.json(); setRoosters(d.map((r: any) => ({ id: r.id, code: r.code, locationId: r.locationId }))); }
      if (batchesRes && batchesRes.ok) {
        const d = await batchesRes.json();
        setBatches(d.filter((b: any) => (b.status === "activo" || b.status === "listo_sacrificio") && b.currentQuantity > 0)
          .map((b: any) => ({ id: b.id, code: b.code, species: b.species, locationId: b.locationId })));
      }
    } catch {
      // Si falla la red, mantenemos los datos cargados desde IndexedDB
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  // Escuchar eventos de sincronización para actualizar registros
  useEffect(() => {
    const handler = () => { void load(); };
    window.addEventListener("gallinero-sync-status", handler);
    return () => window.removeEventListener("gallinero-sync-status", handler);
  }, [load]);

  useActionQuery(searchParams.get("nuevo"), {
    perdida: () => { setLossForm(emptyLoss); setLossError(""); setLossModalOpen(true); },
    "1": () => { setForm(emptyForm); setError(""); setEditingId(null); setModalOpen(true); },
  });

  const save = async () => {
    setError("");
    const payload: any = { date: form.date, birdType: form.birdType, cause: form.cause, description: form.description, locationId: form.locationId };
    if (!form.locationId) return setError("Seleccione el lugar donde ocurrió la mortalidad");
    if (form.birdType === "gallina") payload.henId = form.henId || undefined;
    if (form.birdType === "gallo") payload.roosterId = form.roosterId || undefined;
    if (BATCH_TYPES.includes(form.birdType)) { payload.batchId = form.batchId || undefined; payload.quantity = form.quantity; }
    if (form.birdType === "gallina" && !form.henId) return setError("Seleccione una gallina");
    if (form.birdType === "gallo" && !form.roosterId) return setError("Seleccione un gallo");
    if (BATCH_TYPES.includes(form.birdType) && !form.batchId) return setError("Seleccione un lote");

    const method = editingId ? "PUT" : "POST";
    const mutationPayload = editingId ? { ...payload, id: editingId } : payload;

    const result = await syncManager.executeMutation({
      endpoint: "/api/produccion/mortalidad",
      method,
      entity: "mortalidad",
      description: `Baja de ${payload.quantity || 1} ${payload.birdType} (${payload.cause})`,
      payload: mutationPayload,
    });

    if (result.offline) {
      setModalOpen(false);
      setForm(emptyForm);
      setEditingId(null);

      const optimisticRecord: MortalityRecord = {
        id: result.mutationId,
        date: payload.date,
        birdType: payload.birdType,
        species: payload.birdType === "gallina" || payload.birdType === "gallo" ? "gallina" : "pollo",
        quantity: payload.quantity || 1,
        cause: payload.cause,
        henId: payload.henId || null,
        roosterId: payload.roosterId || null,
        batchId: payload.batchId || null,
        locationId: payload.locationId || null,
        locationName: locations.find((l) => l.id === payload.locationId)?.name || null,
        healthControlId: null,
        henCode: hens.find((h) => h.id === payload.henId)?.code || null,
        roosterCode: roosters.find((r) => r.id === payload.roosterId)?.code || null,
        batchCode: batches.find((b) => b.id === payload.batchId)?.code || null,
        description: payload.description ? `${payload.description} (Guardado en móvil)` : "Guardado en móvil",
      };

      setRecords((prev) => [optimisticRecord, ...prev.filter((r) => r.id !== optimisticRecord.id)]);
      return;
    }

    if (!result.ok) {
      return setError(result.error || "Error al registrar la mortalidad");
    }

    setModalOpen(false);
    setForm(emptyForm);
    setEditingId(null);
    void load();
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
    const res = await apiFetch(`/api/produccion/mortalidad?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "No se pudo eliminar el registro");
      return;
    }
    load();
  };

  const editRecord = (r: MortalityRecord) => {
    setEditingId(r.id);
    setForm({
      date: r.date,
      birdType: r.birdType,
      cause: r.cause,
      description: r.description || "",
      henId: r.henId || "",
      roosterId: r.roosterId || "",
      batchId: r.batchId || "",
      locationId: r.locationId || "",
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

  const filteredRecords = useMemo(() => {
    if (!mortalitySearch.trim()) return records;
    return records.filter((record) =>
      matchesTextQuery(mortalitySearch, [
        record.date,
        BIRD_LABELS[record.birdType] || record.birdType,
        record.henCode,
        record.roosterCode,
        record.batchCode,
        record.locationName,
        CAUSE_LABELS[record.cause] || record.cause,
        record.description,
        record.quantity,
      ]),
    );
  }, [records, mortalitySearch]);

  const filteredLosses = useMemo(() => {
    if (!lossSearch.trim()) return losses;
    return losses.filter((loss) =>
      matchesTextQuery(lossSearch, [
        loss.date,
        loss.quantity,
        loss.size,
        loss.reason,
        loss.notes,
      ]),
    );
  }, [losses, lossSearch]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mortalidad y Pérdidas"
        description="Registro de muertes por causa y pérdidas de huevo"
        help="Registra muertes de gallinas y gallos individuales, o de animales en lotes de pollos, codornices, patos y conejos. Indica la causa para identificar problemas sanitarios. También puedes registrar pérdidas de huevo. El panel resume la mortalidad de los últimos 30 días y su distribución por causa."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setLossForm(emptyLoss); setLossError(""); setLossModalOpen(true); }}>Pérdida de huevos</Button>
            <Button onClick={() => { setForm(emptyForm); setError(""); setEditingId(null); setModalOpen(true); }}>Registrar muerte</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="mortality" label="Tasa mortalidad (30d)" value={`${stats.mortalityRate}%`} color="red" />
        <StatCard icon="hen" label="Muertes (30d)" value={String(stats.totalDeaths)} color="yellow" />
        <StatCard icon="home" label="Animales en inventario" value={String(stats.totalFlock)} color="green" />
        <StatCard icon="egg" label="Huevos perdidos (30d)" value={String(lossStats.totalLost)} color="purple" />
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
        <TableSearch
          value={mortalitySearch}
          onChange={setMortalitySearch}
          placeholder="Buscar por fecha, ave, causa o descripción..."
          resultCount={filteredRecords.length}
          totalCount={records.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon="mortality"
            message={
              mortalitySearch.trim()
                ? "No hay registros que coincidan con la búsqueda"
                : "No hay registros de mortalidad"
            }
          />
        ) : (
          <Table headers={["Fecha", "Tipo", "Ave/Lote", "Lugar", "Causa", "Descripción", "Acciones"]}>
            {filteredRecords.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{r.date}</td>
                <td className="px-4 py-3 text-sm">{BIRD_LABELS[r.birdType] || r.birdType}</td>
                <td className="px-4 py-3 text-sm">{r.henCode || r.roosterCode || r.batchCode || "—"}</td>
                <td className="px-4 py-3 text-sm">{r.locationName || "Sin lugar asignado"}</td>
                <td className="px-4 py-3"><Badge color="red">{CAUSE_LABELS[r.cause] || r.cause}</Badge></td>
                <td className="px-4 py-3 text-sm text-slate-500">{r.description || "—"}</td>
                <td className="px-4 py-3">
                  {r.healthControlId ? (
                    <span className="text-xs text-slate-500">Gestionar desde Sanidad</span>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => editRecord(r)} className="text-blue-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => removeRecord(r.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {losses.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Pérdidas de huevo</h3>
          <TableSearch
            value={lossSearch}
            onChange={setLossSearch}
            placeholder="Buscar por fecha, tamaño o razón..."
            resultCount={filteredLosses.length}
            totalCount={losses.length}
            className="mb-4"
          />
          <Table headers={["Fecha", "Cantidad", "Tamaño", "Razón", "Notas", "Acciones"]}>
            {filteredLosses.map((l) => (
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
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} help="Fecha en que se encontró o ocurrió la muerte" />
          <Select label="Tipo de animal" value={form.birdType} onChange={(e) => setForm({ ...form, birdType: e.target.value, henId: "", roosterId: "", batchId: "", locationId: "", quantity: "1" })} help="Selecciona la especie o lote afectado">
            <option value="gallina">Gallina</option>
            <option value="gallo">Gallo</option>
            <option value="lote_pollos">Lote de pollos</option>
            <option value="lote_codornices">Lote de codornices</option>
            <option value="lote_patos">Lote de patos</option>
            <option value="lote_conejos">Lote de conejos</option>
          </Select>

          {form.birdType === "gallina" && (
            <Select label="Gallina" value={form.henId} onChange={(e) => { const selected = hens.find((hen) => hen.id === e.target.value); setForm({ ...form, henId: e.target.value, locationId: selected?.locationId || "" }); }} help="Selecciona la gallina específica (por su código QR)">
              <option value="">Seleccionar...</option>
              {hens.map((h) => <option key={h.id} value={h.id}>{h.code}</option>)}
            </Select>
          )}
          {form.birdType === "gallo" && (
            <Select label="Gallo" value={form.roosterId} onChange={(e) => { const selected = roosters.find((rooster) => rooster.id === e.target.value); setForm({ ...form, roosterId: e.target.value, locationId: selected?.locationId || "" }); }} help="Selecciona el gallo específico">
              <option value="">Seleccionar...</option>
              {roosters.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
            </Select>
          )}
          {BATCH_TYPES.includes(form.birdType) && (
            <>
              <Select label={BIRD_LABELS[form.birdType] || "Lote"} value={form.batchId} onChange={(e) => { const selected = batches.find((batch) => batch.id === e.target.value); setForm({ ...form, batchId: e.target.value, locationId: selected?.locationId || "" }); }} help="Selecciona el lote afectado">
                <option value="">Seleccionar...</option>
                {batches.filter((b) => b.species === BATCH_SPECIES_BY_TYPE[form.birdType]).map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
              </Select>
              <Input label="Cantidad" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} help="Cuántos animales del lote fallecieron" />
            </>
          )}

          <Select label="Lugar donde ocurrió *" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} help="Se propone el alojamiento actual del animal. Corrígelo si el hecho ocurrió en otro lugar.">
            <option value="">Selecciona un lugar…</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.type}</option>)}
          </Select>
          {locations.length === 0 && <p className="text-sm text-amber-700"><Link className="font-semibold underline" href="/dashboard/ubicaciones">Crea primero un lugar de manejo</Link>.</p>}

          <Select label="Causa" value={form.cause} onChange={(e) => setForm({ ...form, cause: e.target.value })} help="Causa principal de la muerte (enfermedad, accidente, depredador, etc.)">
            {Object.entries(CAUSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} help="Detalles adicionales sobre el suceso" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setModalOpen(false); setEditingId(null); }}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Actualizar" : "Guardar"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={lossModalOpen} onClose={() => setLossModalOpen(false)} title="Registrar Pérdida de Huevos">
        <div className="space-y-4">
          {lossError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{lossError}</p>}
          <Input label="Fecha" type="date" value={lossForm.date} onChange={(e) => setLossForm({ ...lossForm, date: e.target.value })} help="Fecha en que se descubrieron los huevos perdidos" />
          <Input label="Cantidad" type="number" min="1" value={lossForm.quantity} onChange={(e) => setLossForm({ ...lossForm, quantity: e.target.value })} help="Número de huevos perdidos" />
          <Input label="Tamaño (opcional)" value={lossForm.size} onChange={(e) => setLossForm({ ...lossForm, size: e.target.value })} help="Tamaño de los huevos afectados si se conoce" />
          <Select label="Razón" value={lossForm.reason} onChange={(e) => setLossForm({ ...lossForm, reason: e.target.value })} help="Motivo de la pérdida: roto, deteriorado, contaminado u otro">
            <option value="roto">Roto</option>
            <option value="deteriorado">Deteriorado</option>
            <option value="contaminado">Contaminado</option>
            <option value="otro">Otro</option>
          </Select>
          <Textarea label="Notas" value={lossForm.notes} onChange={(e) => setLossForm({ ...lossForm, notes: e.target.value })} help="Observaciones adicionales sobre la pérdida" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setLossModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveLoss}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
