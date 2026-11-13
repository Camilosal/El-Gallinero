"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Award, Calendar, CheckCircle2, Dna, HeartHandshake, Rabbit } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, StatCard, Table, Textarea } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { todayColombiaIso } from "@/lib/date-validation";
import { matchesTextQuery } from "@/lib/text";
import { useFarmLocations } from "@/lib/useFarmLocations";
import { useActionQuery } from "@/lib/useActionQuery";
import MicroInsightCard from "@/components/MicroInsightCard";
import FeatureGateBanner from "@/components/FeatureGateBanner";
import { useOnboardingState } from "@/lib/useOnboardingState";
import { buildReproductionMicroInsight, type MicroInsightPayload } from "@/lib/micro-insights";

interface ReproductionEvent {
  id: string;
  species: "conejo" | "cuy";
  eventType: string;
  eventDate: string;
  damCode: string;
  sireCode: string | null;
  damMotherCode: string | null;
  damFatherCode: string | null;
  sireMotherCode: string | null;
  sireFatherCode: string | null;
  locationId: string | null;
  locationName: string | null;
  parentEventId: string | null;
  parityNumber: number;
  expectedPalpationDate: string | null;
  expectedNestboxDate: string | null;
  expectedBirthDate: string | null;
  palpationResult: string | null;
  bornAlive: number | null;
  bornDead: number | null;
  litterBirthWeightG: string | null;
  weanedTotal: number | null;
  weanedMales: number | null;
  weanedFemales: number | null;
  litterWeanWeightG: string | null;
  litterDailyGainG: string | null;
  weanedBatchCode: string | null;
  status: string;
  notes: string | null;
  cullRecommended?: boolean;
  isEliteDam?: boolean;
}

const EVENT_LABELS: Record<string, string> = {
  empadre: "Empadre / Monta",
  palpacion: "Palpación",
  nidal: "Colocación de Nidal",
  parto: "Parto",
  destete: "Destete + Lote",
  diagnostico: "Diagnóstico",
};

export default function ReproduccionTab() {
  const searchParams = useSearchParams();
  const { locations } = useFarmLocations();
  const { isFlagEnabled } = useOnboardingState();
  const advancedGenetics = isFlagEnabled("genealogia_3gen_qr_iot");
  const [events, setEvents] = useState<ReproductionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [lastInsight, setLastInsight] = useState<MicroInsightPayload | null>(null);
  const [form, setForm] = useState({
    species: "conejo" as "conejo" | "cuy",
    eventType: "empadre",
    eventDate: todayColombiaIso(),
    damCode: "",
    sireCode: "",
    damMotherCode: "",
    damFatherCode: "",
    sireMotherCode: "",
    sireFatherCode: "",
    locationId: "",
    parentEventId: "",
    palpationResult: "positiva",
    bornAlive: "7",
    bornDead: "0",
    litterBirthWeightG: "",
    weanedMales: "3",
    weanedFemales: "4",
    litterWeanWeightG: "",
    weanPurpose: "engorde_carne",
    createWeanedBatch: true,
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/produccion/reproduccion");
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (speciesFilter !== "all" && e.species !== speciesFilter) return false;
      if (!search.trim()) return true;
      return matchesTextQuery(search, [e.damCode, e.sireCode, e.eventType, e.locationName, e.weanedBatchCode, e.notes]);
    });
  }, [events, speciesFilter, search]);

  const activeMatings = useMemo(() => events.filter((e) => e.eventType === "empadre" && e.status === "activo"), [events]);
  const birthEvents = useMemo(() => events.filter((e) => e.eventType === "parto" && e.status !== "destetada"), [events]);
  const eliteDams = useMemo(() => events.filter((e) => e.isEliteDam), [events]);
  const cullAlerts = useMemo(() => {
    const map = new Map<string, ReproductionEvent>();
    for (const e of events) {
      if (e.cullRecommended) map.set(`${e.species}:${e.damCode}`, e);
    }
    return Array.from(map.values());
  }, [events]);

  const openModalWith = (eventType: string, parent?: ReproductionEvent) => {
    setError("");
    setForm((prev) => ({
      ...prev,
      species: parent?.species || prev.species,
      eventType,
      eventDate: todayColombiaIso(),
      damCode: parent?.damCode || "",
      sireCode: parent?.sireCode || "",
      locationId: parent?.locationId || prev.locationId || (locations[0]?.id || ""),
      parentEventId: parent?.id || "",
      notes: "",
    }));
    setModalOpen(true);
  };

  useActionQuery(searchParams.get("nuevo"), {
    "1": () => openModalWith("empadre"),
    empadre: () => openModalWith("empadre"),
    parto: () => openModalWith("parto"),
    destete: () => openModalWith("destete"),
  });

  const submit = async () => {
    setError("");
    const res = await apiFetch("/api/produccion/reproduccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo guardar el evento reproductivo");
      return;
    }
    const weanedTotal =
      form.eventType === "destete"
        ? Number(form.weanedMales || 0) + Number(form.weanedFemales || 0)
        : null;
    setLastInsight(
      buildReproductionMicroInsight({
        species: form.species,
        eventType: form.eventType,
        eventDate: form.eventDate,
        damCode: form.damCode,
        sireCode: form.sireCode || null,
        expectedPalpationDate: data.expectedPalpationDate || null,
        expectedNestboxDate: data.expectedNestboxDate || null,
        expectedBirthDate: data.expectedBirthDate || null,
        bornAlive: form.eventType === "parto" ? Number(form.bornAlive || 0) : null,
        bornDead: form.eventType === "parto" ? Number(form.bornDead || 0) : null,
        weanedTotal,
        litterDailyGainG: data.litterDailyGainG ?? null,
        weanedBatchCode: data.weanedBatchCode ?? null,
      }),
    );
    setModalOpen(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este evento reproductivo?")) return;
    const res = await apiFetch(`/api/produccion/reproduccion?id=${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reproducción de Conejos F1 y Cuyes"
        description={
          advancedGenetics
            ? "Control anti-consanguinidad, agenda de palpación/nidal, partos por paridad, ganancia diaria (>32 g/día madres élite) y lotes destetados sexados."
            : "Registro básico de empadres, partos y destetes de conejos y cuyes."
        }
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openModalWith("empadre")}>+ Registrar Empadre</Button>
            <Button variant="secondary" onClick={() => openModalWith("parto")}>+ Registrar Parto</Button>
            <Button variant="success" onClick={() => openModalWith("destete")}>+ Destete y Lote</Button>
          </div>
        )}
      />

      <FeatureGateBanner
        flagKey="genealogia_3gen_qr_iot"
        mode="banner"
        customHint="La captura básica de empadre, parto y destete está activa desde el Día 1. Al alcanzar 30 mamíferos reproductores se habilita automáticamente el árbol genealógico de 3 generaciones, carnets QR y telemetría IoT."
      />

      {lastInsight && (
        <MicroInsightCard
          insight={lastInsight}
          onAnother={() => openModalWith(form.eventType)}
          onDismiss={() => setLastInsight(null)}
          doneLabel="Entendido"
        />
      )}

      <div className={`grid gap-2.5 sm:gap-4 ${advancedGenetics ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}>
        <StatCard icon="rabbit" label="Gestaciones activas" value={activeMatings.length} color="blue" />
        <StatCard icon="paw-print" label="Camadas por destetar" value={birthEvents.length} color="purple" />
        {advancedGenetics && (
          <>
            <StatCard icon="sparkles" label="Madres élite (>=32 g/d)" value={eliteDams.length} color="green" />
            <StatCard icon="warning" label="Alertas de descarte (>=4-5 partos)" value={cullAlerts.length} color={cullAlerts.length ? "yellow" : "green"} />
          </>
        )}
      </div>

      {advancedGenetics && (cullAlerts.length > 0 || eliteDams.length > 0) && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {eliteDams.length > 0 && (
            <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-900">
              <p className="font-semibold flex items-center gap-1.5 mb-1">
                <Award className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <span>Madres Élites Detectadas (&gt;= 32 g/día en lactancia/destete)</span>
              </p>
              <p className="text-xs">
                {eliteDams.slice(0, 5).map((d) => `${d.damCode} (${d.litterDailyGainG} g/d)`).join(" · ")} — recomendadas para selección de reemplazo.
              </p>
            </Card>
          )}
          {cullAlerts.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
              <p className="font-semibold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-700" aria-hidden="true" />
                <span>Recomendación de Descarte / Reemplazo por Paridad</span>
              </p>
              <p className="text-xs">
                {cullAlerts.map((d) => `${d.damCode} (${d.species}, parto #${d.parityNumber})`).join(" · ")} alcanzaron el ciclo máximo reproductivo recomendado.
              </p>
            </Card>
          )}
        </div>
      )}

      {activeMatings.length > 0 && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" aria-hidden="true" />
            <span>Agenda de Gestación Activa</span>
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeMatings.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Rabbit className="w-4 h-4 text-slate-600" aria-hidden="true" />
                    <span>{m.damCode} {m.sireCode ? `× ${m.sireCode}` : ""}</span>
                  </span>
                  <Badge color={m.species === "cuy" ? "purple" : "blue"}>{m.species} · P#{m.parityNumber}</Badge>
                </div>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p>Palpación esperada: <strong>{m.expectedPalpationDate || "—"}</strong></p>
                  <p>Colocar nidal: <strong>{m.expectedNestboxDate || "—"}</strong></p>
                  <p>Parto probable: <strong>{m.expectedBirthDate || "—"}</strong></p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="secondary" onClick={() => openModalWith("palpacion", m)}>Palpación</Button>
                  <Button variant="primary" onClick={() => openModalWith("parto", m)}>Registrar Parto</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex gap-1">
            {[
              { id: "all", label: "Todos" },
              { id: "conejo", label: "Conejos (31d)" },
              { id: "cuy", label: "Cuyes (67d)" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSpeciesFilter(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${speciesFilter === tab.id ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <TableSearch value={search} onChange={setSearch} placeholder="Buscar hembra, macho, lote..." resultCount={filtered.length} totalCount={events.length} className="w-full sm:w-64" />
        </div>

        {loading ? <p className="text-center py-8 text-slate-400">Cargando...</p> : filtered.length === 0 ? (
          <EmptyState icon="rabbit" message="Aún no hay eventos reproductivos registrados" />
        ) : (
          <Table headers={["Fecha", "Especie", "Evento", "Hembra / Macho", "Paridad", "Detalle / Agenda", "Lote / Élite", ""]}>
            {filtered.map((ev) => (
              <tr key={ev.id} className="hover:bg-slate-50 text-sm">
                <td className="px-4 py-3">{ev.eventDate}</td>
                <td className="px-4 py-3 capitalize">{ev.species}</td>
                <td className="px-4 py-3"><Badge color={ev.eventType === "destete" ? "green" : ev.eventType === "parto" ? "blue" : "purple"}>{EVENT_LABELS[ev.eventType] || ev.eventType}</Badge></td>
                <td className="px-4 py-3 font-medium">
                  {ev.damCode}
                  {ev.sireCode ? <span className="text-xs text-slate-500"> × {ev.sireCode}</span> : null}
                </td>
                <td className="px-4 py-3">
                  #{ev.parityNumber}
                  {ev.cullRecommended && <Badge color="yellow" >Descarte</Badge>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {ev.eventType === "empadre" && `Parto: ${ev.expectedBirthDate || "—"}`}
                  {ev.eventType === "palpacion" && `Resultado: ${ev.palpationResult || "—"}`}
                  {ev.eventType === "parto" && `Vivos: ${ev.bornAlive ?? 0} · Muertos: ${ev.bornDead ?? 0}`}
                  {ev.eventType === "destete" && `Destetados: ${ev.weanedTotal ?? 0} (${ev.weanedMales ?? 0}M/${ev.weanedFemales ?? 0}H)${ev.litterDailyGainG ? ` · ${ev.litterDailyGainG} g/d` : ""}`}
                </td>
                <td className="px-4 py-3 text-xs">
                  {ev.weanedBatchCode && <Badge color="blue">{ev.weanedBatchCode}</Badge>}
                  {ev.isEliteDam && <Badge color="green">Madre Élite</Badge>}
                  {ev.eventType === "parto" && ev.status !== "destetada" && (
                    <button type="button" onClick={() => openModalWith("destete", ev)} className="ml-2 text-emerald-700 hover:underline font-medium">Destetar</button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => remove(ev.id)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Registro Reproductivo: ${EVENT_LABELS[form.eventType] || form.eventType}`}>
        <div className="max-h-[75vh] overflow-y-auto pr-1 space-y-3">
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2"><Dna className="w-4 h-4 shrink-0" /><span>{error}</span></p>}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Especie" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value as "conejo" | "cuy" })}>
              <option value="conejo">Conejo F1 (31 días)</option>
              <option value="cuy">Cuy mejorado (67 días)</option>
            </Select>
            <Select label="Evento" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
              <option value="empadre">Empadre / Monta</option>
              <option value="palpacion">Palpación</option>
              <option value="nidal">Colocación de Nidal</option>
              <option value="parto">Parto</option>
              <option value="destete">Destete (+ Lote sexado)</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha *" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            <Select label="Lugar / Corral / Jaula" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">Opcional…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Código Hembra (Madre) *" value={form.damCode} onChange={(e) => setForm({ ...form, damCode: e.target.value })} placeholder="Ej: CON-H01 o CUY-H03" />
            <Input label="Código Macho (Padre)" value={form.sireCode} onChange={(e) => setForm({ ...form, sireCode: e.target.value })} placeholder="Ej: CON-M02" />
          </div>

          {advancedGenetics && form.eventType === "empadre" && (
            <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50">
              <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                <span>Validación genealógica anti-consanguinidad (padres de los reproductores)</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Madre de la hembra" value={form.damMotherCode} onChange={(e) => setForm({ ...form, damMotherCode: e.target.value })} placeholder="Opcional" />
                <Input label="Padre de la hembra" value={form.damFatherCode} onChange={(e) => setForm({ ...form, damFatherCode: e.target.value })} placeholder="Opcional" />
                <Input label="Madre del macho" value={form.sireMotherCode} onChange={(e) => setForm({ ...form, sireMotherCode: e.target.value })} placeholder="Opcional" />
                <Input label="Padre del macho" value={form.sireFatherCode} onChange={(e) => setForm({ ...form, sireFatherCode: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
          )}

          {form.eventType === "palpacion" && (
            <Select label="Resultado palpación" value={form.palpationResult} onChange={(e) => setForm({ ...form, palpationResult: e.target.value })}>
              <option value="positiva">Positiva (Preñada)</option>
              <option value="negativa">Negativa (Vacía — reprogramar)</option>
              <option value="dudosa">Dudosa</option>
            </Select>
          )}

          {form.eventType === "parto" && (
            <div className="grid grid-cols-3 gap-2">
              <Input label="Nacidos vivos *" type="number" min="0" value={form.bornAlive} onChange={(e) => setForm({ ...form, bornAlive: e.target.value })} />
              <Input label="Nacidos muertos" type="number" min="0" value={form.bornDead} onChange={(e) => setForm({ ...form, bornDead: e.target.value })} />
              <Input label="Peso camada nac. (g)" type="number" step="0.1" value={form.litterBirthWeightG} onChange={(e) => setForm({ ...form, litterBirthWeightG: e.target.value })} />
            </div>
          )}

          {form.eventType === "destete" && (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="grid grid-cols-3 gap-2">
                <Input label="Machos destetados *" type="number" min="0" value={form.weanedMales} onChange={(e) => setForm({ ...form, weanedMales: e.target.value })} />
                <Input label="Hembras destetadas *" type="number" min="0" value={form.weanedFemales} onChange={(e) => setForm({ ...form, weanedFemales: e.target.value })} />
                <Input label="Peso camada destete (g)" type="number" step="0.1" value={form.litterWeanWeightG} onChange={(e) => setForm({ ...form, litterWeanWeightG: e.target.value })} />
              </div>
              <Select label="Propósito del lote creado" value={form.weanPurpose} onChange={(e) => setForm({ ...form, weanPurpose: e.target.value })}>
                <option value="engorde_carne">Engorde / Carne</option>
                <option value="pie_cria">Pie de cría / Reemplazo</option>
              </Select>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={form.createWeanedBatch} onChange={(e) => setForm({ ...form, createWeanedBatch: e.target.checked })} />
                <span>Crear lote automáticamente en el lugar seleccionado (L-CON-D### / L-CUY-D###)</span>
              </label>
            </div>
          )}

          <Textarea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={submit}><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /><span>Guardar Evento</span></span></Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
