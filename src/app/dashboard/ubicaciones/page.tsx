"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, StatCard, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import {
  FarmLocation, LOCATION_TYPE_LABELS, OPERATIONAL_STATUS_LABELS, SANITARY_STATUS_LABELS,
} from "@/lib/useFarmLocations";

const EMPTY_FORM = {
  name: "", type: "corral", parentLocationId: "", description: "", localReference: "",
  latitude: "", longitude: "", areaM2: "", capacity: "", status: "activa",
  operationalStatus: "operativa", sanitaryStatus: "pendiente_revision",
  sanitaryRequirements: "", sanitaryReviewedAt: "", operationalReviewedAt: "",
  maintenanceNeeds: "", notes: "",
};

type LocationForm = typeof EMPTY_FORM;

export default function UbicacionesPage() {
  const searchParams = useSearchParams();
  const [locations, setLocations] = useState<FarmLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FarmLocation | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await apiFetch("/api/ubicaciones");
    if (response.ok) setLocations(await response.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(frame);
  }, [load]);


  const startNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setOpen(true);
  };
  useActionQuery(searchParams.get("nuevo"), { "1": startNew });

  const editLocation = (location: FarmLocation) => {
    setEditing(location);
    setForm({
      name: location.name,
      type: location.type,
      parentLocationId: location.parentLocationId || "",
      description: location.description || "",
      localReference: location.localReference || "",
      latitude: location.latitude || "",
      longitude: location.longitude || "",
      areaM2: location.areaM2 || "",
      capacity: location.capacity == null ? "" : String(location.capacity),
      status: location.status,
      operationalStatus: location.operationalStatus,
      sanitaryStatus: location.sanitaryStatus,
      sanitaryRequirements: location.sanitaryRequirements || "",
      sanitaryReviewedAt: location.sanitaryReviewedAt || "",
      operationalReviewedAt: location.operationalReviewedAt || "",
      maintenanceNeeds: location.maintenanceNeeds || "",
      notes: location.notes || "",
    });
    setError("");
    setOpen(true);
  };

  const save = async () => {
    setError("");
    if (!form.name.trim()) return setError("Escribe un nombre para el lugar");
    const response = await apiFetch("/api/ubicaciones", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...form, id: editing.id } : form),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      return setError(result.error || "No se pudo guardar el lugar");
    }
    setOpen(false);
    await load();
  };

  const deactivate = async (location: FarmLocation) => {
    if (!confirm(`¿Marcar “${location.name}” como inactivo? Se conservarán sus animales e historial.`)) return;
    const response = await apiFetch(`/api/ubicaciones?id=${location.id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      alert(result.error || "No se pudo actualizar el lugar");
      return;
    }
    await load();
  };

  const activeCount = locations.filter((location) => location.status === "activa").length;
  const attentionCount = locations.filter((location) => ["requiere_atencion", "no_cumple"].includes(location.sanitaryStatus) || ["restringida", "fuera_servicio"].includes(location.operationalStatus)).length;
  const occupiedAnimals = locations.reduce((total, location) => total + Number(location.animals || 0), 0);
  const pendingTasks = locations.reduce((total, location) => total + Number(location.pendingMaintenance || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lugares de la finca"
        description="Registra dónde se alojan y manejan los animales, con su ficha sanitaria, operativa y de mantenimiento."
        help="Crea cada corral, jaula, galpón, potrero, jardín o patio. Añade coordenadas para ubicarlo en el predio. El estado sanitario refleja la última revisión que registraste; la aplicación no certifica cumplimiento ni sustituye una inspección profesional. Los registros antiguos quedan como ubicación no informada hasta que se asignen."
        actions={<Button onClick={startNew}>+ Nuevo lugar</Button>}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon="📍" label="Lugares activos" value={activeCount} color="blue" />
        <StatCard icon="🐾" label="Animales asignados" value={occupiedAnimals} color="green" />
        <StatCard icon="🩺" label="Requieren atención" value={attentionCount} color={attentionCount ? "yellow" : "green"} />
        <StatCard icon="🔧" label="Mantenimientos pendientes" value={pendingTasks} color={pendingTasks ? "yellow" : "green"} />
      </div>

      {loading ? <p className="py-10 text-center text-slate-500">Cargando lugares…</p> : locations.length === 0 ? (
        <Card><EmptyState icon="📍" message="Aún no hay lugares de manejo registrados. Crea el primero para asignar las nuevas entradas de animales." /><div className="mt-4 text-center"><Button onClick={startNew}>Crear el primer lugar</Button></div></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {locations.map((location) => {
            const attention = ["requiere_atencion", "no_cumple"].includes(location.sanitaryStatus) || ["restringida", "fuera_servicio"].includes(location.operationalStatus);
            const mapUrl = location.latitude && location.longitude
              ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(location.latitude)}&mlon=${encodeURIComponent(location.longitude)}#map=18/${encodeURIComponent(location.latitude)}/${encodeURIComponent(location.longitude)}`
              : null;
            return (
              <Card key={location.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{location.code} · {LOCATION_TYPE_LABELS[location.type] || location.type}</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-800">{location.name}</h2>
                    {location.parentName && <p className="text-sm text-slate-500">Dentro de: {location.parentName}</p>}
                  </div>
                  <Badge color={location.status === "activa" ? "green" : "gray"}>{location.status === "activa" ? "Activa" : "Inactiva"}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge color={attention ? "yellow" : "blue"}>{OPERATIONAL_STATUS_LABELS[location.operationalStatus] || location.operationalStatus}</Badge>
                  <Badge color={location.sanitaryStatus === "cumple" ? "green" : attention ? "yellow" : "gray"}>{SANITARY_STATUS_LABELS[location.sanitaryStatus] || location.sanitaryStatus}</Badge>
                </div>
                {location.localReference && <p className="text-sm text-slate-600">📌 {location.localReference}</p>}
                {mapUrl && <a className="text-sm font-medium text-blue-700 hover:underline" href={mapUrl} target="_blank" rel="noreferrer">Ver coordenadas en mapa ↗</a>}
                {!!location.speciesCounts?.length && <p className="text-xs text-slate-500">Composición: {location.speciesCounts.map((item) => `${item.total} ${({ gallina: "gallinas", gallo: "gallos", pollo: "pollos", codorniz: "codornices", pato: "patos", conejo: "conejos" } as Record<string, string>)[item.species] || item.species}`).join(" · ")}</p>}
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4">
                  <div><p className="text-xs text-slate-500">Animales</p><strong>{location.animals || 0}{location.capacity ? ` / ${location.capacity}` : ""}</strong></div>
                  <div><p className="text-xs text-slate-500">Huevos · 30 días</p><strong>{location.eggsPeriod || 0}</strong></div>
                  <div><p className="text-xs text-slate-500">Bajas · 30 días</p><strong>{location.deathsPeriod || 0}</strong></div>
                  <div><p className="text-xs text-slate-500">Consumo con lugar · 30 días</p><strong className="text-xs">{location.feedConsumptionLabel || "Sin registro"}</strong></div>
                </div>
                {location.capacityUsedPercent != null && <div><div className="mb-1 flex justify-between text-xs text-slate-500"><span>Uso de capacidad</span><span>{location.capacityUsedPercent}%</span></div><div className="h-2 overflow-hidden rounded bg-slate-100"><div className={`h-full ${location.capacityUsedPercent > 100 ? "bg-red-600" : location.capacityUsedPercent >= 90 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, location.capacityUsedPercent)}%` }} /></div></div>}
                {(location.maintenanceNeeds || Number(location.pendingMaintenance || 0) > 0) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">🔧 {location.maintenanceNeeds || `${location.pendingMaintenance} tareas de mantenimiento pendientes`}</p>}
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Link className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100" href={`/dashboard/ubicaciones/${location.id}`}>Abrir ficha</Link>
                  <Button variant="secondary" onClick={() => editLocation(location)}>Editar ficha</Button>
                  {location.status === "activa" && <Button variant="secondary" onClick={() => deactivate(location)}>Marcar inactiva</Button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar ficha del lugar" : "Nuevo lugar de manejo"}>
        <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Galpón de postura norte" required />
            <Select label="Tipo de lugar" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(LOCATION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
            <Select label="Lugar superior (opcional)" value={form.parentLocationId} onChange={(e) => setForm({ ...form, parentLocationId: e.target.value })}><option value="">Sin lugar superior</option>{locations.filter((item) => item.status === "activa" && item.id !== editing?.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
            <Input label="Capacidad de animales (opcional)" type="number" min="0" step="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} help="Se usa para avisar si un traslado excede el máximo." />
          </div>
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Uso, distribución o características del lugar" />
          <Input label="Referencia para encontrarlo" value={form.localReference} onChange={(e) => setForm({ ...form, localReference: e.target.value })} placeholder="Ej. 20 m al sur de la casa, junto al tanque" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Latitud" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="4.1234567" />
            <Input label="Longitud" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-74.1234567" />
            <Input label="Área (m²)" type="number" step="0.01" min="0" value={form.areaM2} onChange={(e) => setForm({ ...form, areaM2: e.target.value })} />
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 font-semibold text-slate-800">Estado y revisiones</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Estado del lugar" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="activa">Activo</option><option value="inactiva">Inactivo</option></Select>
              <Select label="Estado operativo" value={form.operationalStatus} onChange={(e) => setForm({ ...form, operationalStatus: e.target.value })}>{Object.entries(OPERATIONAL_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
              <Select label="Estado sanitario registrado" value={form.sanitaryStatus} onChange={(e) => setForm({ ...form, sanitaryStatus: e.target.value })}>{Object.entries(SANITARY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
              <Input label="Última revisión sanitaria" type="date" value={form.sanitaryReviewedAt} onChange={(e) => setForm({ ...form, sanitaryReviewedAt: e.target.value })} />
              <Input label="Última revisión operativa" type="date" value={form.operationalReviewedAt} onChange={(e) => setForm({ ...form, operationalReviewedAt: e.target.value })} />
            </div>
          </div>
          <Textarea label="Especificaciones sanitarias" value={form.sanitaryRequirements} onChange={(e) => setForm({ ...form, sanitaryRequirements: e.target.value })} placeholder="Protocolo de limpieza, control de plagas, ventilación, agua…" />
          <Textarea label="Mantenimiento o adecuaciones necesarias" value={form.maintenanceNeeds} onChange={(e) => setForm({ ...form, maintenanceNeeds: e.target.value })} placeholder="Reparaciones, materiales o tareas pendientes" />
          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>{editing ? "Guardar cambios" : "Crear lugar"}</Button></div>
        </div>
      </Modal>
    </div>
  );
}
