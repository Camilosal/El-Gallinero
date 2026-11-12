"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, StatCard, Table, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { FarmLocation, LOCATION_TYPE_LABELS, OPERATIONAL_STATUS_LABELS, SANITARY_STATUS_LABELS, useFarmLocations } from "@/lib/useFarmLocations";

type MovableAnimal = { id: string; code: string; label?: string; species?: string; status?: string; currentQuantity?: number };
type Movement = {
  id: string; animalCode: string; animalType: string; quantity: number; date: string;
  reason: string; notes: string | null; fromLocationName: string; toLocationName: string;
};

const EMPTY_TRANSFER = { animalType: "gallina", animalId: "", toLocationId: "", date: new Date().toISOString().slice(0, 10), reason: "Cambio de alojamiento", notes: "" };
const SPECIES_PLURAL: Record<string, string> = { gallina: "gallinas", gallo: "gallos", pollo: "pollos", codorniz: "codornices", pato: "patos", conejo: "conejos" };
const speciesLabel = (species: string) => SPECIES_PLURAL[species] || species;

export default function UbicacionFichaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { locations, loading: locationsLoading, reload } = useFarmLocations(false);
  const [hens, setHens] = useState<MovableAnimal[]>([]);
  const [roosters, setRoosters] = useState<MovableAnimal[]>([]);
  const [batches, setBatches] = useState<MovableAnimal[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_TRANSFER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const location = locations.find((item) => item.id === id);
  const availableAnimals = useMemo(() => form.animalType === "gallina" ? hens : form.animalType === "gallo" ? roosters : batches, [form.animalType, hens, roosters, batches]);

  const load = useCallback(async () => {
    const [henResponse, roosterResponse, batchResponse, movementResponse] = await Promise.all([
      apiFetch("/api/produccion/gallinas"), apiFetch("/api/produccion/gallos"),
      apiFetch("/api/produccion/pollos"), apiFetch(`/api/ubicaciones/movimientos?locationId=${encodeURIComponent(id)}`),
    ]);
    if (henResponse.ok) {
      const data = await henResponse.json();
      setHens(data.filter((item: MovableAnimal) => ["activa", "empollando", "enferma", "recomendada_sacrificio"].includes(String(item.status)))
        .map((item: MovableAnimal) => ({ ...item, label: `${item.code} · ${item.status || "activa"}` })));
    }
    if (roosterResponse.ok) {
      const data = await roosterResponse.json();
      setRoosters(data.filter((item: MovableAnimal) => ["activo", "enfermo"].includes(String(item.status)))
        .map((item: MovableAnimal) => ({ ...item, label: `${item.code} · ${item.status || "activo"}` })));
    }
    if (batchResponse.ok) {
      const data = await batchResponse.json();
      setBatches(data.filter((item: MovableAnimal) => ["activo", "listo_sacrificio"].includes(String(item.status)) && Number(item.currentQuantity) > 0)
        .map((item: MovableAnimal) => ({ ...item, label: `${item.code} · ${item.species || "lote"} · ${item.currentQuantity} animales` })));
    }
    if (movementResponse.ok) setMovements(await movementResponse.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void reload(); void load(); });
    return () => cancelAnimationFrame(frame);
  }, [reload, load]);

  const saveTransfer = async () => {
    setError("");
    if (!form.animalId) return setError("Selecciona el animal o lote que vas a trasladar");
    if (!form.toLocationId) return setError("Selecciona el lugar de destino");
    setSaving(true);
    const response = await apiFetch("/api/ubicaciones/movimientos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return setError(result.error || "No se pudo guardar el traslado");
    }
    setForm(EMPTY_TRANSFER);
    await Promise.all([load(), reload()]);
  };

  if (locationsLoading || loading) return <p className="py-12 text-center text-slate-500">Cargando ficha del lugar…</p>;
  if (!location) return <Card><EmptyState icon="location" message="No se encontró este lugar." /><div className="mt-3 text-center"><Link className="text-blue-700 underline" href="/dashboard/ubicaciones">Volver a lugares</Link></div></Card>;

  const mapUrl = location.latitude && location.longitude
    ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(location.latitude)}&mlon=${encodeURIComponent(location.longitude)}#map=18/${encodeURIComponent(location.latitude)}/${encodeURIComponent(location.longitude)}`
    : null;
  const targetLabel = location.status === "activa" ? "Lugar activo" : "Lugar inactivo: no admite nuevos traslados";
  const eggBySpecies = (location.eggsBySpeciesPeriod || []).map((item) => `${item.total} ${speciesLabel(item.species)}`).join(" · ") || "Sin registros";
  const meatBySpecies = (location.meatBySpeciesPeriod || []).map((item) => `${Number(item.totalKg).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg ${speciesLabel(item.species)}`).join(" · ") || "Sin registros";
  const weightBySpecies = (location.averageWeightBySpeciesPeriod || []).filter((item) => item.count > 0 && item.averageKg)
    .map((item) => `${Number(item.averageKg).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg ${speciesLabel(item.species)} (${item.count} pesajes)`).join(" · ") || "Sin pesajes con lugar";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ficha · ${location.name}`}
        description={`${location.code} · ${LOCATION_TYPE_LABELS[location.type] || location.type}${location.parentName ? ` · dentro de ${location.parentName}` : ""}`}
        actions={<div className="flex gap-2"><Link className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" href="/dashboard/ubicaciones">Todos los lugares</Link></div>}
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon="paw-print" label="Animales alojados" value={`${location.animals || 0}${location.capacity ? ` / ${location.capacity}` : ""}`} color="green" />
        <StatCard icon="egg" label="Huevos · últimos 30 días" value={location.eggsPeriod || 0} color="blue" />
        <StatCard icon="meat" label="Carne · kg últimos 30 días" value={Number(location.meatProducedKgPeriod || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} color="earth" />
        <StatCard icon="scale" label="Pesajes · últimos 30 días" value={location.weightSamplesPeriod || 0} color="blue" />
        <StatCard icon="skull" label="Bajas · últimos 30 días" value={location.deathsPeriod || 0} color={location.deathsPeriod ? "yellow" : "green"} />
        <StatCard icon="wheat" label="Consumo asociado · últimos 30 días" value={location.feedConsumptionLabel || "Sin registro"} color="earth" />
        <StatCard icon="stethoscope" label="Controles sanitarios · últimos 30 días" value={location.healthControlsPeriod || 0} color="blue" />
        <StatCard icon="wrench" label="Mantenimientos pendientes" value={location.pendingMaintenance || 0} color={location.pendingMaintenance ? "yellow" : "green"} />
      </div>

      <Card className="grid gap-4 text-sm sm:grid-cols-3">
        <div><p className="font-semibold text-slate-800">Huevos por especie · 30 días</p><p className="mt-1 text-slate-600">{eggBySpecies}</p></div>
        <div><p className="font-semibold text-slate-800">Carne por especie · 30 días</p><p className="mt-1 text-slate-600">{meatBySpecies}</p></div>
        <div><p className="font-semibold text-slate-800">Peso promedio por especie · 30 días</p><p className="mt-1 text-slate-600">{weightBySpecies}</p></div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2"><Badge color={location.status === "activa" ? "green" : "gray"}>{targetLabel}</Badge><Badge color={location.operationalStatus === "operativa" ? "green" : "yellow"}>{OPERATIONAL_STATUS_LABELS[location.operationalStatus] || location.operationalStatus}</Badge><Badge color={location.sanitaryStatus === "cumple" ? "green" : ["requiere_atencion", "no_cumple"].includes(location.sanitaryStatus) ? "yellow" : "gray"}>{SANITARY_STATUS_LABELS[location.sanitaryStatus] || location.sanitaryStatus}</Badge></div>
          <h2 className="font-semibold text-slate-800">Ubicación y condiciones</h2>
          <p className="text-sm text-slate-600">{location.description || "Sin descripción."}</p>
          <p className="text-sm text-slate-600"><strong>Referencia:</strong> {location.localReference || "No registrada"}</p>
          <p className="text-sm text-slate-600"><strong>Área:</strong> {location.areaM2 ? `${location.areaM2} m²` : "No registrada"} · <strong>Coordenadas:</strong> {location.latitude && location.longitude ? `${location.latitude}, ${location.longitude}` : "No registradas"}</p>
          <p className="text-sm text-slate-600"><strong>Animales por especie:</strong> {(location.speciesCounts || []).map((item) => `${item.total} ${speciesLabel(item.species)}`).join(" · ") || "Sin animales asignados"}</p>
          {mapUrl && <a className="inline-block text-sm font-semibold text-blue-700 hover:underline" href={mapUrl} target="_blank" rel="noreferrer">Abrir ubicación en mapa ↗</a>}
          <div className="border-t border-slate-100 pt-3"><p className="text-sm font-semibold text-slate-800">Especificaciones sanitarias</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{location.sanitaryRequirements || "Sin especificaciones registradas."}</p><p className="mt-1 text-xs text-slate-500">Última revisión: {location.sanitaryReviewedAt || "pendiente"}</p></div>
          <div className="border-t border-slate-100 pt-3"><p className="text-sm font-semibold text-slate-800">Mantenimiento y adecuaciones</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{location.maintenanceNeeds || "No se han registrado necesidades."}</p><p className="mt-1 text-xs text-slate-500">Tareas pendientes: {location.pendingMaintenance || 0} · costo completado: ${Number(location.maintenanceCost || 0).toLocaleString()}</p></div>
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Los estados sanitario y operativo reflejan la información ingresada por la finca; no son una certificación automática.</p>
        </Card>

        <Card>
          <h2 className="mb-1 text-lg font-semibold text-slate-800">Registrar traslado</h2>
          <p className="mb-4 text-sm text-slate-500">El traslado cambia el lugar actual y deja fecha, origen, destino y motivo en el historial. En lotes se traslada el grupo completo.</p>
          {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Tipo" value={form.animalType} onChange={(e) => setForm({ ...form, animalType: e.target.value, animalId: "" })}><option value="gallina">Gallina</option><option value="gallo">Gallo</option><option value="lote">Lote completo</option></Select>
              <Select label="Animal o lote" value={form.animalId} onChange={(e) => setForm({ ...form, animalId: e.target.value })}><option value="">Selecciona…</option>{availableAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.label || animal.code}</option>)}</Select>
              <Select label="Lugar de destino" value={form.toLocationId} onChange={(e) => setForm({ ...form, toLocationId: e.target.value })}><option value="">Selecciona…</option>{locations.filter((item) => item.status === "activa").map((item) => <option key={item.id} value={item.id}>{item.name} · {LOCATION_TYPE_LABELS[item.type] || item.type}</option>)}</Select>
              <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <Input label="Motivo del traslado" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={100} />
            <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button onClick={saveTransfer} disabled={saving || location.status !== "activa"}>{saving ? "Guardando…" : "Guardar traslado"}</Button>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Historial de traslados</h2>
        {movements.length === 0 ? <EmptyState icon="transfer" message="Este lugar aún no tiene traslados registrados. Los nuevos ingresos aparecerán al registrar su destino." /> : (
          <Table headers={["Fecha", "Animal o lote", "Cantidad", "Origen", "Destino", "Motivo"]}>
            {movements.map((movement) => <tr key={movement.id} className="border-t border-slate-100"><td className="px-3 py-2 text-sm">{movement.date}</td><td className="px-3 py-2 text-sm font-medium">{movement.animalCode}</td><td className="px-3 py-2 text-sm">{movement.quantity}</td><td className="px-3 py-2 text-sm">{movement.fromLocationName}</td><td className="px-3 py-2 text-sm">{movement.toLocationName}</td><td className="px-3 py-2 text-sm">{movement.reason}{movement.notes && <p className="text-xs text-slate-500">{movement.notes}</p>}</td></tr>)}
          </Table>
        )}
      </Card>
    </div>
  );
}
