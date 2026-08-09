"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge, Button, Modal, Input, Select, Textarea, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

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
    if (!hen) return;
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
            weightKg: Number(actionForm.weightKg) || 0,
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
        await apiFetch("/api/produccion/gallinas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: hen.id,
            code: hen.code,
            breed: hen.breed,
            birthDate: hen.birthDate,
            status: "vendida",
            weight: hen.weight,
          }),
        });
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
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🐔</div>
          <p className="text-slate-500">Cargando ficha...</p>
        </div>
      </div>
    );
  }

  if (!hen) {
    return <EmptyState icon="🐔" message="Gallina no encontrada" />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/escanear" className="text-sm text-green-600 hover:text-green-700 mb-2 inline-block">
          ← Volver al escáner
        </Link>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-3xl">
            🐔
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{hen.code}</h1>
              <Badge color={statusColors[hen.status] || "gray"}>{statusLabels[hen.status] || hen.status}</Badge>
              {hen.stage && <Badge color={stageColors[hen.stage] || "gray"}>{hen.stage}</Badge>}
            </div>
            <p className="text-slate-500 mt-1">{hen.breed}</p>
            {hen.lifecycleReasons && hen.lifecycleReasons.length > 0 && (
              <p className="text-xs text-orange-600 mt-1">{hen.lifecycleReasons.join(" · ")}</p>
            )}
          </div>
        </div>
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
          <p className="text-lg font-bold text-slate-800">{hen.isBroody ? "🐣 Sí" : "No"}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500">Eventos</p>
          <p className="text-lg font-bold text-slate-800">{timeline.length}</p>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => openAction("vender")}
          className="flex flex-col items-center gap-1 p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
        >
          <span className="text-2xl">💰</span>
          <span className="text-xs font-medium text-green-700">Vender</span>
        </button>
        <button
          onClick={() => openAction("tratar")}
          className="flex flex-col items-center gap-1 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
        >
          <span className="text-2xl">💊</span>
          <span className="text-xs font-medium text-blue-700">Tratar</span>
        </button>
        <button
          onClick={() => openAction("muerte")}
          className="flex flex-col items-center gap-1 p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
        >
          <span className="text-2xl">💀</span>
          <span className="text-xs font-medium text-red-700">Muerte</span>
        </button>
      </div>

      {/* Notes */}
      {hen.notes && (
        <Card className="mb-6 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-600 mb-1">📝 Notas</h3>
          <p className="text-sm text-slate-700">{hen.notes}</p>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <h3 className="font-semibold text-slate-700 mb-4">📋 Historial de Eventos</h3>
        {timeline.length === 0 ? (
          <p className="text-center text-slate-400 py-6 text-sm">Sin eventos registrados</p>
        ) : (
          <div className="space-y-3">
            {timeline.map((event) => (
              <div key={event.id} className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg">
                  {event.icon}
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
        onClose={() => setActionModal(null)}
        title={
          actionModal === "vender" ? "💰 Vender Ave" : actionModal === "tratar" ? "💊 Registrar Tratamiento" : "💀 Registrar Muerte"
        }
      >
        {actionSuccess ? (
          <div className="text-center py-4">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-green-700 font-medium">{actionSuccess}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {actionError && <p className="text-red-600 text-sm">{actionError}</p>}

            {actionModal === "vender" && (
              <>
                <Input
                  label="Comprador"
                  value={actionForm.buyer || ""}
                  onChange={(e) => setActionForm({ ...actionForm, buyer: e.target.value })}
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
                  <option value="vacunacion">💉 Vacunación</option>
                  <option value="desparasitacion">🪱 Desparasitación</option>
                  <option value="tratamiento">💊 Tratamiento</option>
                  <option value="vitaminas">💧 Vitaminas</option>
                  <option value="otro">📋 Otro</option>
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
              <Button onClick={submitAction}>Registrar</Button>
              <Button variant="secondary" onClick={() => setActionModal(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
