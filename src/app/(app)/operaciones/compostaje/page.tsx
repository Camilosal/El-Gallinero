"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Flame, Recycle, RefreshCw } from "lucide-react";
import { PageHeader, Card, StatCard, Table, Modal, Button, Badge, Input, Select, Textarea, EmptyState } from "@/components/ui";
import FarmLocationSelect from "@/components/FarmLocationSelect";
import AttachmentPanel from "@/components/attachments/AttachmentPanel";
import { apiFetch } from "@/lib/fetch";
import { bindDraftAttachments, createDraftEntityId } from "@/lib/attachments-shared";
import { useActionQuery } from "@/lib/useActionQuery";

interface CompostPile {
  id: string;
  code: string;
  name: string;
  startDate: string;
  locationId: string | null;
  locationName: string | null;
  species: string | null;
  formulaRatio: string;
  manureKg: string;
  mortalityKg: string;
  carbonMaterialKg: string;
  carbonMaterialType: string | null;
  currentTempC: string | null;
  moisturePct: string | null;
  turnCount: number;
  lastTurnDate: string | null;
  nextTurnDueDate: string | null;
  expectedHarvestDate: string | null;
  status: string;
  harvestedKg: string | null;
  notes: string | null;
  alerts: string[];
}

function suggestCarbon(formula: string, manure: number, mortality: number): string {
  if (formula === "3:1:1") return (manure > 0 ? manure / 3 : mortality).toFixed(1);
  if (formula === "7:2:2") return (manure > 0 ? (manure * 2) / 7 : mortality).toFixed(1);
  return ((manure + mortality) * 0.3).toFixed(1);
}

export default function CompostajePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <CompostajePageInner />
    </Suspense>
  );
}

function CompostajePageInner() {
  const searchParams = useSearchParams();
  const [piles, setPiles] = useState<CompostPile[]>([]);
  const [summary, setSummary] = useState<{ total: number; active: number; harvested: number; harvestedTotalKg: number; alertsCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [harvestModal, setHarvestModal] = useState<CompostPile | null>(null);
  const [harvestKg, setHarvestKg] = useState("");
  const [harvestMoisture, setHarvestMoisture] = useState("");
  const [draftId, setDraftId] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    startDate: new Date().toISOString().split("T")[0],
    locationId: "",
    species: "pollo",
    formulaRatio: "3:1:1",
    manureKg: "300",
    mortalityKg: "100",
    carbonMaterialKg: "100",
    carbonMaterialType: "Cascarilla de arroz / aserrín",
    currentTempC: "45",
    moisturePct: "55",
    notes: "",
  });

  const openNew = () => {
    setDraftId(createDraftEntityId());
    setError("");
    setModalOpen(true);
  };

  useActionQuery(searchParams.get("nuevo"), {
    "1": openNew,
    compostaje: openNew,
  });

  const load = useCallback(() => {
    apiFetch("/api/operaciones/compostaje")
      .then((r) => r.json())
      .then((d) => {
        setPiles(Array.isArray(d?.piles) ? d.piles : []);
        setSummary(d?.summary || null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const recalc = (formula: string, manureStr: string, mortStr: string) => {
    return suggestCarbon(formula, Number(manureStr) || 0, Number(mortStr) || 0);
  };

  const saveNew = async () => {
    setError("");
    const res = await apiFetch("/api/operaciones/compostaje", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        locationId: form.locationId || null,
        species: form.species || null,
        manureKg: Number(form.manureKg) || 0,
        mortalityKg: Number(form.mortalityKg) || 0,
        carbonMaterialKg: Number(form.carbonMaterialKg) || 0,
        currentTempC: form.currentTempC ? Number(form.currentTempC) : null,
        moisturePct: form.moisturePct ? Number(form.moisturePct) : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo crear la pila");
      return;
    }
    if (draftId && data?.id) {
      await bindDraftAttachments("composting", draftId, data.id).catch(() => {});
    }
    setModalOpen(false);
    load();
  };

  const registerTurn = async (pile: CompostPile) => {
    const tempPrompt = window.prompt(`Temperatura actual (°C) de ${pile.code} (ideal ≤ 70°C):`, pile.currentTempC || "55");
    if (tempPrompt === null) return;
    const moistPrompt = window.prompt(`Humedad actual (%) de ${pile.code}:`, pile.moisturePct || "45");
    if (moistPrompt === null) return;
    const res = await apiFetch("/api/operaciones/compostaje", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: pile.id,
        action: "turn",
        currentTempC: tempPrompt ? Number(tempPrompt) : null,
        moisturePct: moistPrompt ? Number(moistPrompt) : null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo registrar el volteo");
      return;
    }
    load();
  };

  const submitHarvest = async () => {
    if (!harvestModal) return;
    const res = await apiFetch("/api/operaciones/compostaje", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: harvestModal.id,
        action: "harvest",
        harvestedKg: Number(harvestKg) || 0,
        moisturePct: harvestMoisture ? Number(harvestMoisture) : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Error al cosechar compost");
      return;
    }
    setHarvestModal(null);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Compostaje de Mortalidad y Estiércol"
        description="Formulación 3:1:1 y 7:2:2, ciclos de 8 semanas, control térmico ≤70 °C y humedad de cosecha ≤20 %"
        actions={
          <Button onClick={openNew}>
            + Nueva Pila de Compostaje
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
        <StatCard icon="recycle" label="Pilas Activas" value={summary?.active ?? 0} color="green" />
        <StatCard icon="package" label="Pilas Cosechadas" value={summary?.harvested ?? 0} color="blue" />
        <StatCard icon="scale" label="Compost Cosechado" value={`${summary?.harvestedTotalKg ?? 0} kg`} color="earth" />
        <StatCard icon="alert" label="Alertas Térmicas / Volteo" value={summary?.alertsCount ?? 0} color={(summary?.alertsCount ?? 0) > 0 ? "red" : "green"} />
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : piles.length === 0 ? (
          <EmptyState icon="sprout" message="No hay pilas de compostaje registradas" />
        ) : (
          <Table headers={["Código / Pila", "Fórmula y Mezcla", "Temp. / Humedad", "Volteos y Cronograma 8 sem", "Estado", ""]}>
            {piles.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 text-sm">
                  <div className="font-mono text-xs text-slate-500">{p.code}</div>
                  <div className="font-semibold text-slate-800">{p.name}</div>
                  {p.locationName && <div className="text-xs text-slate-500">{p.locationName}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <Badge color="blue">{p.formulaRatio}</Badge>
                  <div className="mt-1">Estiércol: <strong>{p.manureKg} kg</strong></div>
                  <div>Mortalidad: <strong>{p.mortalityKg} kg</strong></div>
                  <div>Carbono: <strong>{p.carbonMaterialKg} kg</strong></div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span className={p.currentTempC && Number(p.currentTempC) > 70 ? "text-red-600 font-bold" : "font-medium"}>
                      {p.currentTempC ? `${p.currentTempC} °C` : "—"}
                    </span>
                  </div>
                  <div className={p.moisturePct && p.status === "cosechada" && Number(p.moisturePct) > 20 ? "text-amber-700 font-bold mt-1" : "text-slate-600 mt-1"}>
                    Humedad: {p.moisturePct ? `${p.moisturePct}%` : "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div>Volteos: <strong>{p.turnCount}</strong> {p.lastTurnDate ? `(últ. ${p.lastTurnDate})` : ""}</div>
                  {p.nextTurnDueDate && <div>Próx. volteo: {p.nextTurnDueDate}</div>}
                  {p.expectedHarvestDate && <div>Cosecha 8 sem: {p.expectedHarvestDate}</div>}
                  {p.harvestedKg && <div className="text-emerald-700 font-semibold mt-0.5">Cosechado: {p.harvestedKg} kg</div>}
                  {p.alerts.length > 0 && (
                    <div className="mt-1 text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{p.alerts[0]}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge color={p.status === "cosechada" ? "green" : p.status === "alerta" ? "red" : p.status === "madurando" ? "blue" : "yellow"}>
                    {p.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {p.status !== "cosechada" && (
                    <div className="flex flex-col gap-1.5 text-xs">
                      <button
                        onClick={() => registerTurn(p)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Volteo (+1)</span>
                      </button>
                      <button
                        onClick={() => {
                          setHarvestModal(p);
                          setHarvestKg(String(Math.round((Number(p.manureKg) + Number(p.mortalityKg) + Number(p.carbonMaterialKg)) * 0.55)));
                          setHarvestMoisture(p.moisturePct || "18");
                        }}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-medium"
                      >
                        <Recycle className="w-3 h-3" />
                        <span>Cosechar</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Pila de Compostaje">
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre de la pila *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Pila Galpón 1 - Nov" />
            <Input label="Fecha inicio *" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FarmLocationSelect value={form.locationId} onChange={(v) => setForm({ ...form, locationId: v })} allowUnassigned />
            <Select
              label="Fórmula de mezcla *"
              value={form.formulaRatio}
              onChange={(e) => {
                const formulaRatio = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  formulaRatio,
                  carbonMaterialKg: recalc(formulaRatio, prev.manureKg, prev.mortalityKg),
                }));
              }}
            >
              <option value="3:1:1">3:1:1 (Estiércol : Mortalidad : Carbono)</option>
              <option value="7:2:2">7:2:2 (Intensiva avícola ICA)</option>
              <option value="otra">Personalizada</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Pollinaza / estiércol (kg)"
              type="number"
              min="0"
              value={form.manureKg}
              onChange={(e) => {
                const manureKg = e.target.value;
                setForm((prev) => ({ ...prev, manureKg, carbonMaterialKg: recalc(prev.formulaRatio, manureKg, prev.mortalityKg) }));
              }}
            />
            <Input
              label="Mortalidad (kg)"
              type="number"
              min="0"
              value={form.mortalityKg}
              onChange={(e) => {
                const mortalityKg = e.target.value;
                setForm((prev) => ({ ...prev, mortalityKg, carbonMaterialKg: recalc(prev.formulaRatio, prev.manureKg, mortalityKg) }));
              }}
            />
            <Input label="Carbono estructurante (kg)" type="number" min="0" value={form.carbonMaterialKg} onChange={(e) => setForm({ ...form, carbonMaterialKg: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Temp. inicial (°C, máx 70)" type="number" step="0.5" value={form.currentTempC} onChange={(e) => setForm({ ...form, currentTempC: e.target.value })} />
            <Input label="Humedad inicial (%)" type="number" step="0.5" value={form.moisturePct} onChange={(e) => setForm({ ...form, moisturePct: e.target.value })} />
          </div>
          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <AttachmentPanel entityType="composting" entityId={draftId} defaultCategory="antes_despues" compact />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveNew}>Iniciar Compostaje (8 semanas)</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!harvestModal} onClose={() => setHarvestModal(null)} title={`Cosechar Compost ${harvestModal?.code || ""}`}>
        <div className="space-y-4">
          <Input label="Compost cosechado (kg) *" type="number" min="1" value={harvestKg} onChange={(e) => setHarvestKg(e.target.value)} />
          <Input label="Humedad final (% — objetivo ≤ 20%)" type="number" step="0.5" value={harvestMoisture} onChange={(e) => setHarvestMoisture(e.target.value)} />
          {Number(harvestMoisture) > 20 && (
            <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Atención: humedad superior al 20% recomendada para estabilización y empaque.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setHarvestModal(null)}>Cancelar</Button>
            <Button onClick={submitHarvest}>Confirmar Cosecha</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
