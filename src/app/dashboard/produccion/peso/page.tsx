"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Card, Select, Button, Modal, Input, Table, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
} from "recharts";
import { apiFetch } from "@/lib/fetch";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";
import FarmLocationSelect from "@/components/FarmLocationSelect";

interface Standard {
  id: string;
  breed: string;
  gender: string;
  weekNumber: number;
  targetWeightG: string;
  minWeightG: string | null;
  maxWeightG: string | null;
}

interface WeightLog {
  id: string;
  date: string;
  batchId: string | null;
  locationId: string | null;
  locationName: string | null;
  henGroup: string | null;
  breed: string | null;
  species?: string;
  batchCode?: string | null;
  weekNumber: number | null;
  avgWeightKg: string;
  sampleSize: number;
  notes: string | null;
}

interface BatchOption {
  id: string;
  code: string;
  species: string;
  breed: string;
  startDate: string;
  currentQuantity: number;
  locationId: string | null;
}

const BREEDS = ["ISA Brown", "Hy-Line W-36", "Cobb 500"];
const SPECIES = [
  { value: "gallina", label: "Gallina" },
  { value: "pollo", label: "Pollo" },
  { value: "codorniz", label: "Codorniz" },
  { value: "pato", label: "Pato" },
  { value: "conejo", label: "Conejo" },
];

export default function PesoPage() {
  const searchParams = useSearchParams();
  const [standards, setStandards] = useState<Standard[]>([]);
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [breed, setBreed] = useState("ISA Brown");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    species: "gallina",
    batchId: "",
    locationId: "",
    henGroup: "",
    breed: "ISA Brown",
    weekNumber: "",
    avgWeightKg: "",
    sampleSize: "1",
    notes: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/produccion/peso?breed=${encodeURIComponent(breed)}`)
      .then((r) => r.json())
      .then((data) => { setStandards(data.standards || []); setLogs(data.logs || []); setBatches(data.batches || []); })
      .finally(() => setLoading(false));
  }, [breed]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useActionQuery(searchParams.get("nuevo"), { "1": () => setModalOpen(true) });

  const seedStandards = async () => {
    setSeeding(true);
    try {
      await apiFetch("/api/produccion/peso/seed", { method: "POST" });
      load();
    } finally {
      setSeeding(false);
    }
  };

  const createLog = async () => {
    setError("");
    if (!form.locationId) return setError("Selecciona el lugar donde se realizó el pesaje");
    const response = await apiFetch("/api/produccion/peso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        weekNumber: form.weekNumber ? parseInt(form.weekNumber) : null,
        sampleSize: parseInt(form.sampleSize) || 1,
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.error || "No se pudo guardar el pesaje");
      return;
    }
    setModalOpen(false);
    setForm({ date: new Date().toISOString().split("T")[0], species: "gallina", batchId: "", locationId: "", henGroup: "", breed: "ISA Brown", weekNumber: "", avgWeightKg: "", sampleSize: "1", notes: "" });
    load();
  };

  const deleteLog = async (id: string) => {
    if (!confirm("Eliminar este registro?")) return;
    await apiFetch(`/api/produccion/peso?id=${id}`, { method: "DELETE" });
    load();
  };

  const chartData = standards.map((s) => {
    const target = parseFloat(s.targetWeightG);
    const min = s.minWeightG ? parseFloat(s.minWeightG) : target * 0.9;
    const max = s.maxWeightG ? parseFloat(s.maxWeightG) : target * 1.1;
    return {
      week: s.weekNumber,
      target,
      min,
      max,
      range: [min, max],
    };
  });

  const logPoints = logs
    .filter((l) => l.breed === breed)
    .map((l) => ({
      week: l.weekNumber || 0,
      actual: parseFloat(l.avgWeightKg) * 1000,
    }));

  const combinedData = chartData.map((d) => {
    const match = logPoints.find((l) => l.week === d.week);
    return { ...d, actual: match?.actual };
  });

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    return logs.filter((log) =>
      matchesTextQuery(search, [
        log.date,
        log.species,
        log.breed,
        log.batchCode,
        log.locationName,
        log.henGroup,
        log.weekNumber,
        log.avgWeightKg,
        log.sampleSize,
        log.notes,
      ]),
    );
  }, [logs, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curvas de Peso"
        description="Registra pesajes de lotes multiespecie y compáralos con referencias de crecimiento sin separar por sexo."
        help="Vincula cada pesaje a un lote de pollos, codornices, patos o conejos para que el informe use la edad real del lote. Las gallinas se registran por grupo y semana. Para ver todas las curvas de postura y crecimiento, usa Comparación de desempeño."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={breed} onChange={(e) => setBreed(e.target.value)}>
              {BREEDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Link href="/dashboard/analisis/razas" className="inline-flex items-center rounded-lg border border-white/40 bg-white/95 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-white transition-colors">Comparación de desempeño</Link>
          </div>
        }
      />

      {standards.length === 0 && !loading && (
        <Card>
          <EmptyState icon="trend-up" message="No hay estándares cargados para esta raza" />
          <div className="text-center mt-4">
            <Button onClick={seedStandards} disabled={seeding}>
              {seeding ? "Cargando..." : "Cargar estándares de razas"}
            </Button>
          </div>
        </Card>
      )}

      {combinedData.length > 0 && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Curva de peso — {breed} (referencia combinada)</h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" label={{ value: "Semana", position: "bottom" }} />
              <YAxis label={{ value: "Gramos", angle: -90, position: "left" }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="range" name="Rango (min-max)" fill="#bbf7d0" stroke="#86efac" fillOpacity={0.5} />
              <Line type="monotone" dataKey="target" name="Peso objetivo" stroke="#16a34a" strokeDasharray="5 5" dot={false} />
              <Scatter dataKey="actual" name="Peso real" fill="#2563eb" shape="circle" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-700">Registros de peso</h3>
          <Button onClick={() => setModalOpen(true)}>+ Nuevo registro</Button>
        </div>
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por fecha, raza o grupo..."
          resultCount={filteredLogs.length}
          totalCount={logs.length}
          className="mb-4"
        />
        {filteredLogs.length === 0 ? (
          <EmptyState
            icon="clipboard"
            message={
              search.trim()
                ? "No hay registros que coincidan con la búsqueda"
                : "No hay registros de peso"
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table headers={["Fecha", "Especie", "Lugar", "Raza", "Grupo / lote", "Semana", "Peso (kg)", "Muestra", "Notas", ""]}>
              {filteredLogs.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-2">{l.date}</td>
                  <td className="py-2 capitalize">{l.species || "gallina"}</td>
                  <td className="py-2">{l.locationName || "Sin lugar asignado"}</td>
                  <td className="py-2">{l.breed || "-"}</td>
                  <td className="py-2">{l.batchCode || l.henGroup || "-"}</td>
                  <td className="py-2">{l.weekNumber ?? "-"}</td>
                  <td className="py-2">{l.avgWeightKg}</td>
                  <td className="py-2">{l.sampleSize}</td>
                  <td className="py-2 text-sm text-slate-500">{l.notes || "-"}</td>
                  <td className="py-2">
                    <button onClick={() => deleteLog(l.id)} className="text-red-500 hover:text-red-700 text-sm">Eliminar</button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo registro de peso">
        <div className="space-y-3">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} help="Fecha del pesaje" />
          <Select label="Especie" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value, batchId: "", locationId: "", henGroup: "", breed: e.target.value === "gallina" ? "ISA Brown" : "" })}>
            {SPECIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          {form.species === "gallina" ? (
            <>
              <Input label="Raza" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} help="Raza del grupo pesado" />
              <Input label="Grupo" value={form.henGroup} onChange={(e) => setForm({ ...form, henGroup: e.target.value })} placeholder="Ej. gallinas jóvenes A" help="Identificador del grupo pesado" />
              <Input label="Semana" type="number" min="0" value={form.weekNumber} onChange={(e) => setForm({ ...form, weekNumber: e.target.value })} help="Edad del grupo en semanas" />
            </>
          ) : (
            <Select label="Lote" value={form.batchId} onChange={(e) => {
              const selected = batches.find((batch) => batch.id === e.target.value);
              setForm({ ...form, batchId: e.target.value, breed: selected?.breed || "", locationId: selected?.locationId || "" });
            }} help="La edad del lote se calculará desde la fecha de ingreso">
              <option value="">Seleccionar lote...</option>
              {batches.filter((batch) => batch.species === form.species).map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.code} · {batch.breed} · {batch.currentQuantity} animales</option>
              ))}
            </Select>
          )}
          <FarmLocationSelect value={form.locationId} onChange={(locationId) => setForm({ ...form, locationId })} label="Lugar donde se realizó el pesaje *" help="Los pesos se comparan con los estándares dentro del lugar donde está el grupo." />
          <Input label="Peso promedio (kg)" type="number" step="0.01" value={form.avgWeightKg} onChange={(e) => setForm({ ...form, avgWeightKg: e.target.value })} help="Peso promedio del grupo en kilogramos" />
          <Input label="Tamaño muestra" type="number" value={form.sampleSize} onChange={(e) => setForm({ ...form, sampleSize: e.target.value })} help="Cuántos animales se pesaron para obtener el promedio" />
          <Input label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} help="Observaciones del pesaje (condiciones, comentarios, etc.)" />
          <Button onClick={createLog} className="w-full">Guardar</Button>
        </div>
      </Modal>
    </div>
  );
}
