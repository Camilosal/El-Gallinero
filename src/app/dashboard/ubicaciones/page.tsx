"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionQuery } from "@/lib/useActionQuery";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { FileText, MapPin, QrCode, Wrench } from "lucide-react";
import BatchQrSheetModal from "@/components/BatchQrSheetModal";
import EntityQrModal from "@/components/EntityQrModal";
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, StatCard, Textarea } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { addDaysIso, todayColombiaIso } from "@/lib/date-validation";
import {
  FarmLocation, FLOOR_TYPE_LABELS, LOCATION_TYPE_LABELS, OPERATIONAL_STATUS_LABELS, SANITARY_STATUS_LABELS, ZONE_TYPE_LABELS,
} from "@/lib/useFarmLocations";

const SPECIES_ISOLATION_OPTIONS = [
  { value: "gallina", label: "Gallina" },
  { value: "pollo", label: "Pollo" },
  { value: "codorniz", label: "Codorniz" },
  { value: "pato", label: "Pato" },
  { value: "conejo", label: "Conejo" },
  { value: "cuy", label: "Cuy" },
];

const EMPTY_FORM = {
  name: "", type: "corral", parentLocationId: "", description: "", localReference: "",
  latitude: "", longitude: "", areaM2: "", capacity: "", status: "activa",
  operationalStatus: "operativa", sanitaryStatus: "pendiente_revision",
  sanitaryRequirements: "", sanitaryReviewedAt: "", operationalReviewedAt: "",
  maintenanceNeeds: "", zoneType: "produccion", allowedSpecies: [] as string[],
  sanitaryEmptyUntil: "", altitudeMeters: "", floorType: "", environmentalTempC: "",
  isQuarantine: false, notes: "",
};

type LocationForm = typeof EMPTY_FORM;

type MovableAnimalOption = { id: string; code: string; species?: string; status?: string; currentQuantity?: number; label: string };
const EMPTY_TRANSFER_FORM = {
  animalType: "gallina",
  animalId: "",
  toLocationId: "",
  date: "",
  reason: "Cambio de alojamiento",
  notes: "",
};

export default function UbicacionesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <UbicacionesInner />
    </Suspense>
  );
}

function UbicacionesInner() {
  const searchParams = useSearchParams();
  const [locations, setLocations] = useState<FarmLocation[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState(() => ({ ...EMPTY_TRANSFER_FORM, date: todayColombiaIso() }));
  const [transferError, setTransferError] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);
  const [hensList, setHensList] = useState<MovableAnimalOption[]>([]);
  const [roostersList, setRoostersList] = useState<MovableAnimalOption[]>([]);
  const [batchesList, setBatchesList] = useState<MovableAnimalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FarmLocation | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [qrLocation, setQrLocation] = useState<FarmLocation | null>(null);
  const [batchQrOpen, setBatchQrOpen] = useState(false);

  const visibleLocations = locations.filter((location) =>
    matchesTextQuery(search, [
      location.name,
      location.code,
      LOCATION_TYPE_LABELS[location.type] || location.type,
      location.localReference,
      location.parentName,
      location.description,
      location.notes,
      location.maintenanceNeeds,
      OPERATIONAL_STATUS_LABELS[location.operationalStatus] || location.operationalStatus,
      SANITARY_STATUS_LABELS[location.sanitaryStatus] || location.sanitaryStatus,
      location.status === "activa" ? "activa" : "inactiva",
    ]),
  );

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
  const loadMovableAnimals = useCallback(async () => {
    const [henRes, roosterRes, batchRes] = await Promise.all([
      apiFetch("/api/produccion/gallinas"),
      apiFetch("/api/produccion/gallos"),
      apiFetch("/api/produccion/pollos"),
    ]);
    if (henRes.ok) {
      const data = await henRes.json();
      setHensList(
        data
          .filter((item: MovableAnimalOption) => ["activa", "empollando", "enferma", "recomendada_sacrificio"].includes(String(item.status)))
          .map((item: MovableAnimalOption) => ({ ...item, label: `${item.code} · ${item.status || "activa"}` })),
      );
    }
    if (roosterRes.ok) {
      const data = await roosterRes.json();
      setRoostersList(
        data
          .filter((item: MovableAnimalOption) => ["activo", "enfermo"].includes(String(item.status)))
          .map((item: MovableAnimalOption) => ({ ...item, label: `${item.code} · ${item.status || "activo"}` })),
      );
    }
    if (batchRes.ok) {
      const data = await batchRes.json();
      setBatchesList(
        data
          .filter((item: MovableAnimalOption) => ["activo", "listo_sacrificio"].includes(String(item.status)) && Number(item.currentQuantity) > 0)
          .map((item: MovableAnimalOption) => ({ ...item, label: `${item.code} · ${item.species || "lote"} · ${item.currentQuantity} animales` })),
      );
    }
  }, []);

  const openTransferModal = useCallback(() => {
    setTransferForm({ ...EMPTY_TRANSFER_FORM, date: todayColombiaIso() });
    setTransferError("");
    setTransferOpen(true);
    void loadMovableAnimals();
  }, [loadMovableAnimals]);

  const transferOptions = useMemo(() => {
    if (transferForm.animalType === "gallina") return hensList;
    if (transferForm.animalType === "gallo") return roostersList;
    return batchesList;
  }, [transferForm.animalType, hensList, roostersList, batchesList]);

  const saveTransferModal = async () => {
    setTransferError("");
    if (!transferForm.animalId) return setTransferError("Selecciona el animal o lote a trasladar");
    if (!transferForm.toLocationId) return setTransferError("Selecciona el lugar de destino");
    setTransferSaving(true);
    const res = await apiFetch("/api/ubicaciones/movimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transferForm),
    });
    setTransferSaving(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return setTransferError(payload.error || "No se pudo registrar el traslado");
    }
    setTransferOpen(false);
    void load();
  };

  useActionQuery(searchParams.get("nuevo"), {
    "1": startNew,
    traslado: openTransferModal,
  });

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
      zoneType: location.zoneType || "produccion",
      allowedSpecies: Array.isArray(location.allowedSpecies) ? location.allowedSpecies : [],
      sanitaryEmptyUntil: location.sanitaryEmptyUntil || "",
      altitudeMeters: location.altitudeMeters != null ? String(location.altitudeMeters) : "",
      floorType: location.floorType || "",
      environmentalTempC: location.environmentalTempC || "",
      isQuarantine: Boolean(location.isQuarantine),
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
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => window.open("/api/operaciones/entregables-ruta2?tipo=zonificacion&format=pdf", "_blank")}
            >
              <FileText className="w-4 h-4 mr-1.5 inline" />
              Mapa de zonificación PDF
            </Button>
            <Button variant="secondary" onClick={() => setBatchQrOpen(true)}>
              <QrCode className="w-4 h-4 mr-1.5 inline" />
              Plancha QR en lote
            </Button>
            <Button variant="secondary" onClick={openTransferModal}>Trasladar animal / lote</Button>
            <Button onClick={startNew}>+ Nuevo lugar</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon="location" label="Lugares activos" value={activeCount} color="blue" />
        <StatCard icon="paw-print" label="Animales asignados" value={occupiedAnimals} color="green" />
        <StatCard icon="stethoscope" label="Requieren atención" value={attentionCount} color={attentionCount ? "yellow" : "green"} />
        <StatCard icon="wrench" label="Mantenimientos pendientes" value={pendingTasks} color={pendingTasks ? "yellow" : "green"} />
      </div>

      {loading ? <p className="py-10 text-center text-slate-500">Cargando lugares…</p> : locations.length === 0 ? (
        <Card><EmptyState icon="location" message="Aún no hay lugares de manejo registrados. Crea el primero para asignar las nuevas entradas de animales." /><div className="mt-4 text-center"><Button onClick={startNew}>Crear el primer lugar</Button></div></Card>
      ) : (
        <div className="space-y-4">
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar lugar por nombre, código, tipo, referencia o estado..."
            resultCount={visibleLocations.length}
            totalCount={locations.length}
          />
          {visibleLocations.length === 0 ? (
            <Card>
              <EmptyState icon="location" message="No hay lugares que coincidan con la búsqueda" />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visibleLocations.map((location) => {
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
                  {location.zoneType && <Badge color={location.isQuarantine || location.zoneType === "cuarentena" ? "red" : "purple"}>{ZONE_TYPE_LABELS[location.zoneType] || location.zoneType}</Badge>}
                  {location.sanitaryEmptyUntil && location.sanitaryEmptyUntil >= todayColombiaIso() && (
                    <Badge color="red">Vacío sanitario hasta {location.sanitaryEmptyUntil}</Badge>
                  )}
                </div>
                {(location.allowedSpecies?.length || location.altitudeMeters || location.floorType) && (
                  <p className="text-xs text-slate-500">
                    {location.allowedSpecies?.length ? `Bioseguridad: solo ${location.allowedSpecies.join(", ")}` : ""}
                    {location.altitudeMeters ? `${location.allowedSpecies?.length ? " · " : ""}${location.altitudeMeters} msnm` : ""}
                    {location.floorType ? ` · Piso: ${FLOOR_TYPE_LABELS[location.floorType] || location.floorType}` : ""}
                  </p>
                )}
                {location.localReference && <p className="text-sm text-slate-600 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" /> {location.localReference}</p>}
                {mapUrl && <a className="text-sm font-medium text-blue-700 hover:underline" href={mapUrl} target="_blank" rel="noreferrer">Ver coordenadas en mapa ↗</a>}
                {!!location.speciesCounts?.length && <p className="text-xs text-slate-500">Composición: {location.speciesCounts.map((item) => `${item.total} ${({ gallina: "gallinas", gallo: "gallos", pollo: "pollos", codorniz: "codornices", pato: "patos", conejo: "conejos", cuy: "cuyes" } as Record<string, string>)[item.species] || item.species}`).join(" · ")}</p>}
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4">
                  <div><p className="text-xs text-slate-500">Animales</p><strong>{location.animals || 0}{location.capacity ? ` / ${location.capacity}` : ""}</strong></div>
                  <div><p className="text-xs text-slate-500">Huevos · 30 días</p><strong>{location.eggsPeriod || 0}</strong></div>
                  <div><p className="text-xs text-slate-500">Bajas · 30 días</p><strong>{location.deathsPeriod || 0}</strong></div>
                  <div><p className="text-xs text-slate-500">Consumo con lugar · 30 días</p><strong className="text-xs">{location.feedConsumptionLabel || "Sin registro"}</strong></div>
                </div>
                {location.capacityUsedPercent != null && <div><div className="mb-1 flex justify-between text-xs text-slate-500"><span>Uso de capacidad</span><span>{location.capacityUsedPercent}%</span></div><div className="h-2 overflow-hidden rounded bg-slate-100"><div className={`h-full ${location.capacityUsedPercent > 100 ? "bg-red-600" : location.capacityUsedPercent >= 90 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, location.capacityUsedPercent)}%` }} /></div></div>}
                {(location.maintenanceNeeds || Number(location.pendingMaintenance || 0) > 0) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 flex items-center gap-2"><Wrench className="w-4 h-4 shrink-0 text-amber-700" aria-hidden="true" /> {location.maintenanceNeeds || `${location.pendingMaintenance} tareas de mantenimiento pendientes`}</p>}
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Link className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100" href={`/dashboard/ubicaciones/${location.id}`}>Abrir ficha</Link>
                  <Button variant="secondary" onClick={() => setQrLocation(location)} className="inline-flex items-center gap-1.5">
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                    <span>QR</span>
                  </Button>
                  <Button variant="secondary" onClick={() => editLocation(location)}>Editar ficha</Button>
                  {location.status === "activa" && <Button variant="secondary" onClick={() => deactivate(location)}>Marcar inactiva</Button>}
                </div>
              </Card>
            );
          })}
            </div>
          )}
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
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-800">Bioseguridad, vacío sanitario (21 d) y calibración</h3>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setForm((prev) => ({
                  ...prev,
                  sanitaryEmptyUntil: addDaysIso(todayColombiaIso(), 21),
                  operationalStatus: "restringida",
                }))}
              >
                + Activar 21 días vacío sanitario
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Zona biosegura" value={form.zoneType} onChange={(e) => setForm({ ...form, zoneType: e.target.value })}>
                {Object.entries(ZONE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Input label="Vacío sanitario hasta" type="date" value={form.sanitaryEmptyUntil} onChange={(e) => setForm({ ...form, sanitaryEmptyUntil: e.target.value })} help="Bloquea ingresos/traslados de animales hasta esta fecha." />
              <Input label="Altitud (msnm)" type="number" min="0" max="5500" value={form.altitudeMeters} onChange={(e) => setForm({ ...form, altitudeMeters: e.target.value })} placeholder="Ej: 2100" />
              <Select label="Tipo de piso" value={form.floorType} onChange={(e) => setForm({ ...form, floorType: e.target.value })}>
                <option value="">Sin especificar</option>
                {Object.entries(FLOOR_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Input label="Temperatura ambiental (°C)" type="number" step="0.1" value={form.environmentalTempC} onChange={(e) => setForm({ ...form, environmentalTempC: e.target.value })} placeholder="Ej: 18.5" />
              <label className="flex items-center gap-2 pt-5 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.isQuarantine} onChange={(e) => setForm({ ...form, isQuarantine: e.target.checked })} />
                <span>Área exclusiva de cuarentena</span>
              </label>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">Especies permitidas (vacío = cualquier especie; seleccionar para aislamiento bioseguro):</p>
              <div className="flex flex-wrap gap-2">
                {SPECIES_ISOLATION_OPTIONS.map((sp) => {
                  const checked = form.allowedSpecies.includes(sp.value);
                  return (
                    <label key={sp.value} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer ${checked ? "border-emerald-600 bg-emerald-100 text-emerald-900 font-semibold" : "border-slate-300 bg-white text-slate-600"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          allowedSpecies: e.target.checked
                            ? [...prev.allowedSpecies, sp.value]
                            : prev.allowedSpecies.filter((item) => item !== sp.value),
                        }))}
                      />
                      <span>{sp.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <Textarea label="Especificaciones sanitarias" value={form.sanitaryRequirements} onChange={(e) => setForm({ ...form, sanitaryRequirements: e.target.value })} placeholder="Protocolo de limpieza, control de plagas, ventilación, agua…" />
          <Textarea label="Mantenimiento o adecuaciones necesarias" value={form.maintenanceNeeds} onChange={(e) => setForm({ ...form, maintenanceNeeds: e.target.value })} placeholder="Reparaciones, materiales o tareas pendientes" />
          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>{editing ? "Guardar cambios" : "Crear lugar"}</Button></div>
        </div>
      </Modal>

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Registrar Traslado de Animal o Lote">
        <div className="space-y-4">
          {transferError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{transferError}</p>}
          <Select
            label="Tipo de registro *"
            value={transferForm.animalType}
            onChange={(e) => setTransferForm({ ...transferForm, animalType: e.target.value, animalId: "" })}
          >
            <option value="gallina">Gallina / Ponedora</option>
            <option value="gallo">Gallo reproductor</option>
            <option value="lote_pollos">Lote de animales</option>
          </Select>
          <Select
            label="Animal o lote *"
            value={transferForm.animalId}
            onChange={(e) => setTransferForm({ ...transferForm, animalId: e.target.value })}
          >
            <option value="">Selecciona…</option>
            {transferOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </Select>
          <Select
            label="Lugar de destino *"
            value={transferForm.toLocationId}
            onChange={(e) => setTransferForm({ ...transferForm, toLocationId: e.target.value })}
          >
            <option value="">Selecciona destino…</option>
            {locations.filter((l) => l.status === "activa").map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha *" type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} />
            <Input label="Motivo" value={transferForm.reason} onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })} />
          </div>
          <Textarea label="Notas" value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button onClick={saveTransferModal} disabled={transferSaving}>
              {transferSaving ? "Guardando..." : "Registrar traslado"}
            </Button>
          </div>
        </div>
      </Modal>

      <EntityQrModal
        open={Boolean(qrLocation)}
        onClose={() => setQrLocation(null)}
        entityType="ubicacion"
        entityId={qrLocation?.id || ""}
        code={qrLocation?.code}
        title={qrLocation?.name || "Lugar"}
        subtitle={qrLocation ? `${LOCATION_TYPE_LABELS[qrLocation.type] || qrLocation.type}${qrLocation.localReference ? ` · ${qrLocation.localReference}` : ""}` : undefined}
      />

      <BatchQrSheetModal
        open={batchQrOpen}
        onClose={() => setBatchQrOpen(false)}
        defaultTypes={["ubicacion", "lote"]}
      />
    </div>
  );
}
