"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Bird, CheckCircle2, CircleDollarSign, ClipboardList, Egg, FileEdit, Pill, Skull } from "lucide-react";
import { Card, Badge, Button, Modal, Input, Select, Textarea, EmptyState } from "@/components/ui";
import ContactField from "@/components/contacts/ContactField";
import { AppIcon } from "@/components/AppIcon";
import { HeroBanner } from "@/components/HeroBanner";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { HEN_PRESENT_STATUSES, isHenAvailableForExit } from "@/lib/animal-status";

interface Hen {
  id: string;
  code: string;
  breed: string;
  birthDate: string;
  status: string;
  weight: string | null;
  notes: string | null;
  isBroody: boolean;
  stage?: string | null;
  ageWeeks?: number;
  lifecycleReasons?: string[];
}

interface TimelineEvent {
  id: string;
  date: string;
  type: string;
  icon: string;
  title: string;
  detail: string;
  color: string;
}

const statusLabels: Record<string, string> = {
  activa: "Activa",
  empollando: "Empollando",
  enferma: "Enferma",
  descarte: "Descarte",
  recomendada_sacrificio: "Recomendada sacrificio",
  vendida: "Vendida",
  faena: "Faena",
  muerta: "Muerta",
};

const statusColors: Record<string, string> = {
  activa: "green",
  empollando: "purple",
  enferma: "red",
  descarte: "orange",
  recomendada_sacrificio: "orange",
  vendida: "gray",
  faena: "blue",
  muerta: "gray",
};

const stageColors: Record<string, string> = {
  Pollito: "yellow",
  Juvenil: "blue",
  "Pre-postura": "purple",
  Postura: "green",
};

export default function HenDetailPage() {
  const params = useParams();
  const henId = params.id as string;
  const [hen, setHen] = useState<Hen | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<"vender" | "tratar" | "muerte" | null>(null);
  const [actionForm, setActionForm] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [timelineSearch, setTimelineSearch] = useState("");
  const actionSubmittingRef = useRef(false);

  const visibleTimeline = timeline.filter((event) =>
    matchesTextQuery(timelineSearch, [event.title, event.type, event.detail, event.date]),
  );

  const load = useCallback(() => {
    apiFetch(`/api/produccion/gallinas/historial?henId=${henId}`)
      .then((r) => r.json())
      .then((data) => {
        setHen(data.hen);
        setTimeline(data.timeline || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [henId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAction = (action: "vender" | "tratar" | "muerte") => {
    setActionModal(action);
    setActionError("");
    setActionSuccess("");
    if (action === "vender") {
      setActionForm({ buyer: "", pricePerUnit: "15000", weightKg: hen?.weight || "" });
    } else if (action === "tratar") {
      setActionForm({
        date: new Date().toISOString().split("T")[0],
        type: "tratamiento",
        description: "",
        product: "",
        cost: "0",
      });
    } else {
      setActionForm({
        date: new Date().toISOString().split("T")[0],
        cause: "causa_natural",
        description: "",
      });
    }
  };

  const submitAction = async () => {
    if (!hen || actionSubmittingRef.current) return;
    actionSubmittingRef.current = true;
    setActionSubmitting(true);
    setActionError("");
    setActionSuccess("");

    try {
      if (actionModal === "vender") {
        const price = Number(actionForm.pricePerUnit) || 0;
        const res = await apiFetch("/api/finanzas/finanzas/ventas-aves", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: new Date().toISOString().split("T")[0],
            birdType: "gallina_descarte",
            quantity: 1,
            weightKg: actionForm.weightKg ? Number(actionForm.weightKg) : null,
            pricePerUnit: price,
            priceMode: "por_ave",
            totalAmount: price,
            buyer: actionForm.buyer,
            henId: hen.id,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al registrar venta");
        }
        setActionSuccess("Venta registrada correctamente");
      } else if (actionModal === "tratar") {
        const res = await apiFetch("/api/sanidad/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: actionForm.date,
            type: actionForm.type,
            description: actionForm.description,
            affectedHens: JSON.stringify([hen.id]),
            product: actionForm.product,
            cost: actionForm.cost,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al registrar tratamiento");
        }
        setActionSuccess("Tratamiento registrado correctamente");
      } else if (actionModal === "muerte") {
        const res = await apiFetch("/api/produccion/mortalidad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: actionForm.date,
            birdType: "gallina",
            quantity: 1,
            cause: actionForm.cause,
            henId: hen.id,
            description: actionForm.description,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al registrar mortalidad");
        }
        setActionSuccess("Mortalidad registrada correctamente");
      }
      setTimeout(() => {
        setActionModal(null);
        load();
      }, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      actionSubmittingRef.current = false;
      setActionSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="flex justify-center mb-4 animate-bounce">
            <Bird className="w-12 h-12 text-earth-700" aria-hidden="true" />
          </div>
          <p className="text-slate-500">Cargando ficha...</p>
        </div>
      </div>
    );
  }

  if (!hen) {
    return <EmptyState icon="hen" message="Gallina no encontrada" />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/escanear" className="text-sm text-green-700 hover:text-green-800 mb-3 inline-flex items-center gap-1 font-medium">
          ← Volver al escáner
        </Link>
        <HeroBanner
          theme="aves"
          compact
          icon={<AppIcon icon="hen" className="w-4 h-4 text-amber-200" />}
          eyebrow="Ficha individual de ave"
          title={hen.code}
          description={hen.breed}
          badge={
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge color={statusColors[hen.status] || "gray"}>{statusLabels[hen.status] || hen.status}</Badge>
              {hen.stage && <Badge color={stageColors[hen.stage] || "gray"}>{hen.stage}</Badge>}
            </div>
          }
          className="mb-0"
        />
        {hen.lifecycleReasons && hen.lifecycleReasons.length > 0 && (
          <p className="text-xs text-orange-600 mt-2">{hen.lifecycleReasons.join(" · ")}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="text-center">
          <p className="text-xs text-slate-500">Peso</p>
          <p className="text-lg font-bold text-slate-800">{hen.weight ? `${hen.weight} kg` : "—"}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500">Edad</p>
          <p className="text-lg font-bold text-slate-800">{hen.ageWeeks ? `${hen.ageWeeks} sem` : "—"}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500">Empollando</p>
          <p className="text-lg font-bold text-slate-800">
            {hen.isBroody ? (
              <span className="inline-flex items-center gap-1">
                <Egg className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <span>Sí</span>
              </span>
            ) : "No"}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500">Eventos</p>
          <p className="text-lg font-bold text-slate-800">{timeline.length}</p>
        </Card>
      </div>

      {/* Quick Actions */}
      {HEN_PRESENT_STATUSES.includes(hen.status) ? (
        <div className={`grid gap-3 mb-6 ${isHenAvailableForExit(hen.status) ? "grid-cols-3" : "grid-cols-2"}`}>
          {isHenAvailableForExit(hen.status) && (
            <button
              onClick={() => openAction("vender")}
              className="flex flex-col items-center gap-1.5 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
            >
              <CircleDollarSign className="w-6 h-6 text-green-700" aria-hidden="true" />
              <span className="text-xs font-medium text-green-700">Vender</span>
            </button>
          )}
          <button
            onClick={() => openAction("tratar")}
            className="flex flex-col items-center gap-1.5 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <Pill className="w-6 h-6 text-blue-700" aria-hidden="true" />
            <span className="text-xs font-medium text-blue-700">Tratar</span>
          </button>
          <button
            onClick={() => openAction("muerte")}
            className="flex flex-col items-center gap-1.5 p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
          >
            <Skull className="w-6 h-6 text-red-700" aria-hidden="true" />
            <span className="text-xs font-medium text-red-700">Muerte</span>
          </button>
        </div>
      ) : (
        <p className="mb-6 rounded-lg bg-slate-100 p-3 text-center text-sm text-slate-600">Esta ave ya salió del inventario y no admite nuevas acciones.</p>
      )}

      {/* Notes */}
      {hen.notes && (
        <Card className="mb-6 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
            <FileEdit className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>Notas</span>
          </h3>
          <p className="text-sm text-slate-700">{hen.notes}</p>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>Historial de Eventos</span>
          </h3>
        </div>
        {timeline.length > 0 && (
          <TableSearch
            value={timelineSearch}
            onChange={setTimelineSearch}
            placeholder="Buscar evento por título, tipo, detalle o fecha..."
            resultCount={visibleTimeline.length}
            totalCount={timeline.length}
            className="mb-4"
          />
        )}
        {timeline.length === 0 ? (
          <p className="text-center text-slate-400 py-6 text-sm">Sin eventos registrados</p>
        ) : visibleTimeline.length === 0 ? (
          <EmptyState icon="clipboard" message="No hay eventos que coincidan con la búsqueda" />
        ) : (
          <div className="space-y-3">
            {visibleTimeline.map((event) => (
              <div key={event.id} className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                  <AppIcon icon={event.icon} className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-800">{event.title}</span>
                    <Badge color={event.color}>{event.type}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{event.detail}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(event.date + "T12:00:00").toLocaleDateString("es", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Action Modal */}
      <Modal
        open={actionModal !== null}
        onClose={() => { if (!actionSubmitting) setActionModal(null); }}
        title={
          actionModal === "vender" ? "Vender Ave" : actionModal === "tratar" ? "Registrar Tratamiento" : "Registrar Muerte"
        }
      >
        {actionSuccess ? (
          <div className="text-center py-4">
            <div className="flex justify-center mb-2">
              <CheckCircle2 className="w-9 h-9 text-green-600" aria-hidden="true" />
            </div>
            <p className="text-green-700 font-medium">{actionSuccess}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

            {actionModal === "vender" && (
              <>
                <ContactField
                  role="cliente"
                  label="Comprador"
                  value={actionForm.buyer || ""}
                  onChange={(name) => setActionForm({ ...actionForm, buyer: name })}
                  placeholder="Nombre del comprador"
                />
                <Input
                  label="Peso (kg)"
                  type="number"
                  step="0.01"
                  value={actionForm.weightKg || ""}
                  onChange={(e) => setActionForm({ ...actionForm, weightKg: e.target.value })}
                />
                <Input
                  label="Precio por ave ($)"
                  type="number"
                  value={actionForm.pricePerUnit || ""}
                  onChange={(e) => setActionForm({ ...actionForm, pricePerUnit: e.target.value })}
                />
              </>
            )}

            {actionModal === "tratar" && (
              <>
                <Input
                  label="Fecha"
                  type="date"
                  value={actionForm.date || ""}
                  onChange={(e) => setActionForm({ ...actionForm, date: e.target.value })}
                />
                <Select
                  label="Tipo"
                  value={actionForm.type || "tratamiento"}
                  onChange={(e) => setActionForm({ ...actionForm, type: e.target.value })}
                >
                  <option value="vacunacion">Vacunación</option>
                  <option value="desparasitacion">Desparasitación</option>
                  <option value="tratamiento">Tratamiento</option>
                  <option value="vitaminas">Vitaminas</option>
                  <option value="otro">Otro</option>
                </Select>
                <Input
                  label="Descripción"
                  value={actionForm.description || ""}
                  onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                />
                <Input
                  label="Producto"
                  value={actionForm.product || ""}
                  onChange={(e) => setActionForm({ ...actionForm, product: e.target.value })}
                />
                <Input
                  label="Costo ($)"
                  type="number"
                  value={actionForm.cost || "0"}
                  onChange={(e) => setActionForm({ ...actionForm, cost: e.target.value })}
                />
              </>
            )}

            {actionModal === "muerte" && (
              <>
                <Input
                  label="Fecha"
                  type="date"
                  value={actionForm.date || ""}
                  onChange={(e) => setActionForm({ ...actionForm, date: e.target.value })}
                />
                <Select
                  label="Causa"
                  value={actionForm.cause || "causa_natural"}
                  onChange={(e) => setActionForm({ ...actionForm, cause: e.target.value })}
                >
                  <option value="enfermedad">Enfermedad</option>
                  <option value="depredador">Depredador</option>
                  <option value="accidente">Accidente</option>
                  <option value="sacrificio_sanitario">Sacrificio sanitario</option>
                  <option value="causa_natural">Causa natural</option>
                  <option value="otro">Otro</option>
                </Select>
                <Textarea
                  label="Descripción"
                  value={actionForm.description || ""}
                  onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                />
              </>
            )}

            <div className="flex gap-2">
              <Button onClick={submitAction} disabled={actionSubmitting}>{actionSubmitting ? "Guardando…" : "Registrar"}</Button>
              <Button variant="secondary" onClick={() => setActionModal(null)} disabled={actionSubmitting}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
