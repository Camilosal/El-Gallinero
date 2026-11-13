"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { useFarmLocations } from "@/lib/useFarmLocations";
import { useActionQuery } from "@/lib/useActionQuery";
import AttachmentPanel from "@/components/attachments/AttachmentPanel";
import MicroInsightCard from "@/components/MicroInsightCard";
import {
  bindDraftAttachments,
  calculateWithdrawalUntilDate,
  createDraftEntityId,
  type OcrExtractedPayload,
} from "@/lib/attachments-shared";
import { buildHealthMicroInsight, type MicroInsightPayload } from "@/lib/micro-insights";
import Link from "next/link";

interface HealthRecord {
  id: string;
  date: string;
  locationId: string | null;
  locationName: string | null;
  type: string;
  description: string;
  affectedHens: string | null;
  product: string | null;
  withdrawalDays?: number | null;
  withdrawalUntilDate?: string | null;
  vaccineLot?: string | null;
  vaccineLab?: string | null;
  vaccineExpiryDate?: string | null;
  coldChainTempC?: string | null;
  administrationRoute?: string | null;
  cost: string | null;
  nextScheduled: string | null;
  notes: string | null;
}

interface CalendarEvent {
  id: string;
  type: string;
  name: string;
  description: string | null;
  targetBirds: string | null;
  frequencyDays: number | null;
  nextDueDate: string;
  isOverdue: boolean;
  daysUntilDue: number;
}

const eventTypes = [
  { value: "vacunacion", label: "Vacunación" },
  { value: "desparasitacion", label: "Desparasitación" },
  { value: "tratamiento", label: "Tratamiento" },
  { value: "inspeccion", label: "Inspección" },
  { value: "fumigacion", label: "Fumigación" },
  { value: "vitaminas", label: "Vitaminas/Suplementos" },
  { value: "otro", label: "Otro" },
];

const typeColors: Record<string, string> = {
  vacunacion: "blue",
  desparasitacion: "purple",
  tratamiento: "red",
  inspeccion: "green",
  fumigacion: "orange",
  vitaminas: "yellow",
  otro: "gray",
};

export default function SanidadPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <SanidadPageInner />
    </Suspense>
  );
}

function SanidadPageInner() {
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const handledPendingId = useRef<string | null>(null);
  const pendingOpenTimer = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HealthRecord | null>(null);
  const [draftEntityId, setDraftEntityId] = useState(() => createDraftEntityId("health"));
  const [lastInsight, setLastInsight] = useState<MicroInsightPayload | null>(null);
  const [error, setError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    locationId: "",
    type: "inspeccion",
    description: "",
    affectedHens: "todas",
    product: "",
    withdrawalDays: "0",
    vaccineLot: "",
    vaccineLab: "",
    vaccineExpiryDate: "",
    coldChainTempC: "",
    administrationRoute: "",
    cost: "0",
    nextScheduled: "",
    notes: "",
  });
  const { locations } = useFarmLocations();
  const { values: typeOptions } = useCatalog("tipo_sanidad", eventTypes.map((t) => t.value));

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/sanidad/control").then((r) => r.json()),
      apiFetch("/api/sanidad/calendario").then((r) => r.json()),
    ]).then(([control, calendar]) => {
      setRecords(control);
      setCalendarEvents(calendar);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  // Find most urgent pending calendar event
  const pendingEvent = calendarEvents
    .filter((e) => e.isOverdue || (e.daysUntilDue >= 0 && e.daysUntilDue <= 7))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)[0] || null;

  const openNew = () => {
    setEditing(null);
    setDraftEntityId(createDraftEntityId("health"));
    setError("");
    setForm({
      date: new Date().toISOString().split("T")[0],
      locationId: "",
      type: "inspeccion",
      description: "",
      affectedHens: "todas",
      product: "",
      withdrawalDays: "0",
      vaccineLot: "",
      vaccineLab: "",
      vaccineExpiryDate: "",
      coldChainTempC: "",
      administrationRoute: "",
      cost: "0",
      nextScheduled: "",
      notes: "",
    });
    setModalOpen(true);
  };
  useActionQuery(searchParams.get("nuevo"), { "1": openNew });

  const openNewWithEvent = useCallback((event: CalendarEvent) => {
    setEditing(null);
    setDraftEntityId(createDraftEntityId("health"));
    setError("");
    // Calculate next scheduled date based on frequency
    let nextDate = "";
    if (event.frequencyDays) {
      const d = new Date(event.nextDueDate + "T12:00:00");
      d.setDate(d.getDate() + event.frequencyDays);
      nextDate = d.toISOString().split("T")[0];
    }
    setForm({
      date: new Date().toISOString().split("T")[0],
      locationId: "",
      type: event.type,
      description: `${event.name}${event.description ? ` — ${event.description}` : ""}`,
      affectedHens: event.targetBirds || "todas",
      product: "",
      withdrawalDays: "0",
      vaccineLot: "",
      vaccineLab: "",
      vaccineExpiryDate: "",
      coldChainTempC: "",
      administrationRoute: "",
      cost: "0",
      nextScheduled: nextDate,
      notes: "",
    });
    setModalOpen(true);
  }, []);

  // Handle ?pendiente=ID once. Reloading calendar data after save must not
  // reopen the modal for the same query parameter.
  useEffect(() => {
    const pendienteId = searchParams.get("pendiente");
    if (!pendienteId) {
      handledPendingId.current = null;
      if (pendingOpenTimer.current !== null) {
        window.clearTimeout(pendingOpenTimer.current);
        pendingOpenTimer.current = null;
      }
      return;
    }
    if (pendienteId === handledPendingId.current || pendingOpenTimer.current !== null || calendarEvents.length === 0) return;

    const event = calendarEvents.find((candidate) => candidate.id === pendienteId);
    if (event) {
      const timer = window.setTimeout(() => {
        pendingOpenTimer.current = null;
        handledPendingId.current = pendienteId;
        openNewWithEvent(event);
      }, 0);
      pendingOpenTimer.current = timer;
      return () => {
        window.clearTimeout(timer);
        if (pendingOpenTimer.current === timer) pendingOpenTimer.current = null;
      };
    }
  }, [searchParams, calendarEvents, openNewWithEvent]);

  const openEdit = (r: HealthRecord) => {
    setEditing(r);
    setError("");
    setForm({
      date: r.date,
      locationId: r.locationId || "",
      type: r.type,
      description: r.description,
      affectedHens: r.affectedHens || "",
      product: r.product || "",
      withdrawalDays: String(r.withdrawalDays ?? 0),
      vaccineLot: r.vaccineLot || "",
      vaccineLab: r.vaccineLab || "",
      vaccineExpiryDate: r.vaccineExpiryDate || "",
      coldChainTempC: r.coldChainTempC || "",
      administrationRoute: r.administrationRoute || "",
      cost: r.cost || "0",
      nextScheduled: r.nextScheduled || "",
      notes: r.notes || "",
    });
    setModalOpen(true);
  };

  const handleOcrEtiquetaIca = (extracted: OcrExtractedPayload) => {
    if (extracted.mode !== "etiqueta_ica") return;
    setForm((prev) => {
      const nextProduct = extracted.product || prev.product;
      const nextLot = extracted.vaccineLot || prev.vaccineLot;
      const nextLab = extracted.vaccineLab || prev.vaccineLab;
      const nextType = extracted.eventType || prev.type;
      const extraDesc = [
        nextProduct ? `Aplicación de ${nextProduct}` : "",
        extracted.icaRegistration ? `Reg. ICA ${extracted.icaRegistration}` : "",
        nextLot ? `Lote ${nextLot}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        ...prev,
        type: nextType,
        product: nextProduct,
        description: prev.description || extraDesc,
        vaccineLot: nextLot,
        vaccineLab: nextLab,
        vaccineExpiryDate: extracted.vaccineExpiryDate || prev.vaccineExpiryDate,
        withdrawalDays:
          extracted.withdrawalDays !== undefined ? String(extracted.withdrawalDays) : prev.withdrawalDays,
        coldChainTempC: extracted.coldChainTempC || prev.coldChainTempC,
        administrationRoute: extracted.administrationRoute || prev.administrationRoute,
        notes: [prev.notes, extracted.icaRegistration ? `Reg. ICA: ${extracted.icaRegistration}` : ""]
          .filter(Boolean)
          .join(" | "),
      };
    });
  };

  const save = async () => {
    setError("");
    if (!form.locationId) return setError("Selecciona el lugar donde se realizó el control");
    const method = editing ? "PUT" : "POST";
    const withdrawalDaysNum = Math.max(0, Math.round(Number(form.withdrawalDays || 0)));
    const withdrawalUntilDate = calculateWithdrawalUntilDate(form.date, withdrawalDaysNum);
    const body = {
      ...(editing ? { id: editing.id } : {}),
      ...form,
      withdrawalDays: withdrawalDaysNum,
      withdrawalUntilDate,
    };
    const res = await apiFetch("/api/sanidad/control", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const saved = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(saved.error || "Error al guardar el registro");
      return;
    }
    if (!editing && saved?.id) {
      await bindDraftAttachments(draftEntityId, saved.id, "health_control");
    }
    const eventTypeLabel =
      eventTypes.find((t) => t.value === form.type)?.label || form.type;
    const locName = locations.find((l) => l.id === form.locationId)?.name || null;
    setLastInsight(
      buildHealthMicroInsight({
        date: form.date,
        eventTypeLabel,
        product: form.product || null,
        withdrawalDays: withdrawalDaysNum,
        withdrawalUntilDate,
        coldChainTempC: form.coldChainTempC || null,
        vaccineLot: form.vaccineLot || null,
        nextScheduled: form.nextScheduled || null,
        locationName: locName,
      }),
    );
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro?")) return;
    await apiFetch(`/api/sanidad/control?id=${id}`, { method: "DELETE" });
    load();
  };

  const totalCost = records.reduce((s, r) => s + Number(r.cost || 0), 0);
  const upcoming = records.filter((r) => r.nextScheduled && new Date(r.nextScheduled + "T12:00:00") >= new Date()).sort((a, b) => new Date(a.nextScheduled!).getTime() - new Date(b.nextScheduled!).getTime());

  const filteredRecords = !search.trim() ? records : records.filter((record) =>
      matchesTextQuery(search, [
        record.date,
    record.locationName,
        new Date(record.date + "T12:00:00").toLocaleDateString("es"),
        record.type,
        eventTypes.find((type) => type.value === record.type)?.label,
        record.description,
        record.affectedHens,
        record.product,
        record.cost,
        record.nextScheduled,
        record.notes,
      ]),
    );

  return (
    <div>
      <PageHeader
        title="Control Fitosanitario"
        description="Vacunaciones, desparasitaciones, tratamientos, inspecciones y fumigaciones"
        help="Registra todos los eventos sanitarios: vacunaciones, desparasitaciones, tratamientos, inspecciones y fumigaciones.\n\n• Si hay un evento pendiente del calendario sanitario, verás un banner para pre-llenar el formulario automáticamente.\n• El campo 'Próximo evento programado' ayuda a mantener el calendario actualizado.\n• Los costos se reflejan automáticamente en los egresos de finanzas."
        actions={<Button onClick={openNew}>+ Nuevo Registro</Button>}
      />

      {lastInsight && (
        <div className="mb-6">
          <MicroInsightCard
            insight={lastInsight}
            onAnother={openNew}
            onDismiss={() => setLastInsight(null)}
            doneLabel="Entendido"
          />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
        <StatCard icon="clipboard" label="Total Registros" value={records.length} color="blue" />
        <StatCard icon="vaccine" label="Vacunaciones" value={records.filter((r) => r.type === "vacunacion").length} color="purple" />
        <StatCard icon="calendar" label="Próximos Eventos" value={upcoming.length} color={upcoming.length > 0 ? "yellow" : "green"} />
        <StatCard icon="money" label="Costo Total" value={`$${totalCost.toLocaleString()}`} color="red" />
      </div>

      {/* Upcoming Events */}
      {upcoming.length > 0 && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <h3 className="font-semibold text-yellow-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" aria-hidden="true" />
            Próximos Eventos Sanitarios Programados
          </h3>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map((r) => (
              <div key={r.id} className="flex justify-between items-center p-2 bg-white rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge color={typeColors[r.type] || "gray"}>{eventTypes.find((t) => t.value === r.type)?.label || r.type}</Badge>
                  <span className="text-sm">{r.description}</span>
                </div>
                <span className="text-sm font-medium text-yellow-700">{new Date(r.nextScheduled! + "T12:00:00").toLocaleDateString("es")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <TableSearch
          value={search}
          onChange={setSearch}
          placeholder="Buscar por fecha, tipo, producto o descripción..."
          resultCount={filteredRecords.length}
          totalCount={records.length}
          className="mb-4"
        />
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon="pill"
            message={
              search.trim()
                ? "No hay registros que coincidan con la búsqueda"
                : "No hay registros sanitarios"
            }
          />
        ) : (
          <Table headers={["Fecha", "Lugar", "Tipo", "Descripción", "Gallinas", "Producto", "Costo", "Próximo", ""]}>
            {filteredRecords.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(r.date + "T12:00:00").toLocaleDateString("es")}</td>
                <td className="px-4 py-3 text-sm">{r.locationName || "Sin lugar asignado"}</td>
                <td className="px-4 py-3"><Badge color={typeColors[r.type] || "gray"}>{eventTypes.find((t) => t.value === r.type)?.label || r.type}</Badge></td>
                <td className="px-4 py-3 text-sm max-w-[200px]">{r.description}</td>
                <td className="px-4 py-3 text-sm">{r.affectedHens || "—"}</td>
                <td className="px-4 py-3 text-sm">
                  <div>{r.product || "—"}</div>
                  {(r.vaccineLot || r.vaccineLab) && (
                    <div className="text-[11px] text-slate-500">
                      {[r.vaccineLab, r.vaccineLot ? `Lote ${r.vaccineLot}` : ""].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {r.withdrawalUntilDate && Number(r.withdrawalDays || 0) > 0 && (
                    <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                      Retiro ICA hasta {r.withdrawalUntilDate} ({r.withdrawalDays}d)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{Number(r.cost) > 0 ? `$${Number(r.cost).toLocaleString()}` : "—"}</td>
                <td className="px-4 py-3 text-sm">{r.nextScheduled ? new Date(r.nextScheduled + "T12:00:00").toLocaleDateString("es") : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs">Editar</button>
                    <button onClick={() => remove(r.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Registro Sanitario" : "Nuevo Registro Sanitario"}>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          {/* Calendar event suggestion banner */}
          {!editing && pendingEvent && (
            <div className={`p-3 rounded-lg border ${pendingEvent.isOverdue ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
              <p className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Evento pendiente: &quot;{pendingEvent.name}&quot;</span>
              </p>
              <p className="text-xs text-slate-500 mb-2">
                {eventTypes.find((t) => t.value === pendingEvent.type)?.label || pendingEvent.type}
                {" · "}
                {pendingEvent.isOverdue
                  ? `Vencido hace ${Math.abs(pendingEvent.daysUntilDue)} días`
                  : `Vence en ${pendingEvent.daysUntilDue} días`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => openNewWithEvent(pendingEvent)}
                  className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                >
                  Usar estos datos
                </button>
                <button
                  onClick={() => setForm({ ...form, type: "inspeccion", description: "", affectedHens: "todas", product: "", cost: "0", nextScheduled: "" })}
                  className="px-3 py-1 bg-white text-slate-600 text-xs font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
                >
                  Formulario vacío
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Select label="Tipo de Evento" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {typeOptions.map((v) => <option key={v} value={v}>{eventTypes.find((t) => t.value === v)?.label || v}</option>)}
            </Select>
          </div>
          <Select label="Lugar de la revisión o tratamiento *" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} help="El control queda asociado a este lugar para consultar su historial sanitario.">
            <option value="">Selecciona un lugar…</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.type}</option>)}
          </Select>
          {locations.length === 0 && <p className="text-sm text-amber-700"><Link className="font-semibold underline" href="/dashboard/ubicaciones">Crea primero un lugar de manejo</Link>.</p>}
          <Textarea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalle del evento sanitario..." required />
          <Input label="Gallinas Afectadas" value={form.affectedHens} onChange={(e) => setForm({ ...form, affectedHens: e.target.value })} placeholder="'todas' o códigos: G-001, G-002" />
          <Input label="Producto Utilizado" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Ej: Newcastle B1, Ivermectina..." />

          {/* Trazabilidad ICA y Tiempo de Retiro Farmacológico (Res. ICA 3651/2014) */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-blue-900">
                Trazabilidad ICA, Lote de Vacuna y Tiempo de Retiro
              </span>
              {Number(form.withdrawalDays || 0) > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
                  Bloqueo sanitario hasta {calculateWithdrawalUntilDate(form.date, form.withdrawalDays)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Lote vacuna / fármaco"
                value={form.vaccineLot}
                onChange={(e) => setForm({ ...form, vaccineLot: e.target.value })}
                placeholder="Ej: NK-2026A"
              />
              <Input
                label="Laboratorio"
                value={form.vaccineLab}
                onChange={(e) => setForm({ ...form, vaccineLab: e.target.value })}
                placeholder="Ej: MSD, Vecol, Ceva"
              />
              <Input
                label="Vencimiento lote"
                type="date"
                value={form.vaccineExpiryDate}
                onChange={(e) => setForm({ ...form, vaccineExpiryDate: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Días de retiro ICA"
                type="number"
                min="0"
                max="180"
                value={form.withdrawalDays}
                onChange={(e) => setForm({ ...form, withdrawalDays: e.target.value })}
                help="0 para vacunas sin retiro; >0 bloquea venta/faena."
              />
              <Select
                label="Vía de administración"
                value={form.administrationRoute}
                onChange={(e) => setForm({ ...form, administrationRoute: e.target.value })}
              >
                <option value="">Seleccionar vía…</option>
                <option value="agua_bebida">Agua de bebida</option>
                <option value="ocular_nasal">Ocular / Nasal (gota)</option>
                <option value="punzon_alar">Punzón alar</option>
                <option value="intramuscular">Intramuscular (I.M.)</option>
                <option value="subcutanea">Subcutánea (S.C.)</option>
                <option value="aspersor">Aspersión / Spray</option>
              </Select>
              <Input
                label="Cadena de frío (°C)"
                value={form.coldChainTempC}
                onChange={(e) => setForm({ ...form, coldChainTempC: e.target.value })}
                placeholder="Ej: 4.5 (rango 2-8°C)"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Costo ($)" type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            <Input label="Próxima Aplicación" type="date" value={form.nextScheduled} onChange={(e) => setForm({ ...form, nextScheduled: e.target.value })} />
          </div>
          <Textarea label="Notas adicionales" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <AttachmentPanel
            entityType="health_control"
            entityId={editing ? editing.id : draftEntityId}
            defaultCategory="etiqueta_ica"
            ocrMode="etiqueta_ica"
            onOcrExtracted={handleOcrEtiquetaIca}
            title="Etiqueta ICA, frasco de vacuna o receta veterinaria"
            helpText="Toma foto del frasco o etiqueta para extraer automáticamente el Reg. ICA, lote, vencimiento y días de retiro."
            compact
          />

          <div className="flex gap-3">
            <Button onClick={save} disabled={!form.description}>{editing ? "Actualizar Registro" : "Registrar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
