"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { PageHeader, Button, Card, Table, Modal, Input, Select, Textarea, EmptyState, StatCard, Badge } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import {
  SPECIES_ICON,
  SPECIES_LABEL,
} from "@/lib/species-params";
import { useSpeciesCatalog } from "@/lib/use-species-params";
import FarmLocationSelect from "@/components/FarmLocationSelect";

interface SlaughterRecord {
  id: string;
  date: string;
  locationId: string | null;
  locationName: string | null;
  species?: string;
  birdType: string;
  quantity: number;
  liveWeightKg?: string | null;
  carcassYieldPercent?: string | null;
  weightKg: string;
  destination: string;
  headsAutoconsumo?: number | null;
  weightKgAutoconsumo?: string | null;
  headsExcedente?: number | null;
  weightKgExcedente?: string | null;
  marketReferencePricePerKg?: string | null;
  estimatedSavingsAmount?: string | null;
  henId: string | null;
  roosterId: string | null;
  batchId: string | null;
  notes: string | null;
  hen?: { id: string; code: string; weight: string; status: string } | null;
  rooster?: { id: string; code: string; status: string } | null;
  batch?: { id: string; code: string; species?: string; status: string } | null;
}

interface Hen { id: string; code: string; weight: string; status: string; birthDate: string; locationId?: string | null; }
interface Rooster { id: string; code: string; weight: string | null; status: string; locationId?: string | null; }
interface Batch { id: string; code: string; species?: string; breed?: string; currentQuantity: number; status: string; avgWeightKg?: string | null; locationId?: string | null; }

const birdTypeLabels: Record<string, string> = {
  gallina_descarte: "🐔 Gallina descarte",
  pollo: "🐓 Pollo de engorde",
  gallo: "🐓 Gallo reproductor",
  codorniz: "🥚 Codorniz",
  pato: "🦆 Pato",
  conejo: "🐇 Conejo de engorde",
};

const destinationLabels: Record<string, string> = {
  consumo_propio: "🏡 Consumo hogar",
  venta: "💰 Venta excedentes",
  mixto: "⚖️ Dual (Hogar + Venta)",
  donacion: "🎁 Donación / Otro",
};

export default function CarneTab() {
  const { getParams, priceKg } = useSpeciesCatalog();
  const [records, setRecords] = useState<SlaughterRecord[]>([]);
  const [hens, setHens] = useState<Hen[]>([]);
  const [roosters, setRoosters] = useState<Rooster[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SlaughterRecord | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string>("all");

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    species: "pollo",
    birdType: "pollo",
    quantity: "1",
    liveWeightKg: "",
    carcassYieldPercent: "72",
    weightKg: "",
    destination: "mixto",
    headsAutoconsumo: "1",
    weightKgAutoconsumo: "",
    headsExcedente: "0",
    weightKgExcedente: "",
    marketReferencePricePerKg: "14000",
    henId: "",
    roosterId: "",
    batchId: "",
    locationId: "",
    notes: "",
  });

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/sacrificio").then((r) => r.json()),
      apiFetch("/api/produccion/gallinas").then((r) => r.json()),
      apiFetch("/api/produccion/gallos").then((r) => (r.ok ? r.json() : [])),
      apiFetch("/api/produccion/pollos").then((r) => r.json()),
    ]).then(([data, hensData, gallosData, lotesData]) => {
      setRecords(Array.isArray(data) ? data : []);
      setHens(Array.isArray(hensData) ? hensData
        .filter((h: Hen) => h.status === "activa" || h.status === "empollando" || h.status === "recomendada_sacrificio")
        .sort((a: Hen, b: Hen) => Number(b.status === "recomendada_sacrificio") - Number(a.status === "recomendada_sacrificio")) : []);
      setRoosters(Array.isArray(gallosData)
        ? gallosData.filter((r: Rooster) => r.status === "activo" || r.status === "enfermo")
        : []);
      const batchesData = Array.isArray(lotesData) ? lotesData : [];
      setBatches(batchesData.filter((b: Batch) => b.status === "activo" || b.status === "listo_sacrificio"));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setError("");
    const defaultPrice = priceKg("pollo");
    setForm({
      date: new Date().toISOString().split("T")[0],
      species: "pollo",
      birdType: "pollo",
      quantity: "1",
      liveWeightKg: "2.5",
      carcassYieldPercent: "72",
      weightKg: "1.8",
      destination: "mixto",
      headsAutoconsumo: "1",
      weightKgAutoconsumo: "1.8",
      headsExcedente: "0",
      weightKgExcedente: "0",
      marketReferencePricePerKg: String(defaultPrice),
      henId: "",
      roosterId: "",
      batchId: "",
      locationId: "",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (r: SlaughterRecord) => {
    setEditing(r);
    setError("");
    const sp = r.species || "pollo";
    setForm({
      date: r.date,
      species: sp,
      birdType: r.birdType,
      quantity: String(r.quantity),
      liveWeightKg: r.liveWeightKg || "",
      carcassYieldPercent: r.carcassYieldPercent || "70",
      weightKg: r.weightKg,
      destination: r.destination,
      headsAutoconsumo: String(r.headsAutoconsumo ?? (r.destination === "consumo_propio" ? r.quantity : 0)),
      weightKgAutoconsumo: String(r.weightKgAutoconsumo ?? (r.destination === "consumo_propio" ? r.weightKg : "0")),
      headsExcedente: String(r.headsExcedente ?? (r.destination === "venta" ? r.quantity : 0)),
      weightKgExcedente: String(r.weightKgExcedente ?? (r.destination === "venta" ? r.weightKg : "0")),
      marketReferencePricePerKg: r.marketReferencePricePerKg || String(priceKg(sp)),
      henId: r.henId || "",
      roosterId: r.roosterId || "",
      batchId: r.batchId || "",
      locationId: r.locationId || "",
      notes: r.notes || "",
    });
    setModalOpen(true);
  };

  const handleSpeciesChange = (species: string) => {
    const p = getParams(species);
    const refPrice = priceKg(species);
    const yieldPct = p?.carcassYieldPercent || 70;
    const qty = Number(form.quantity) || 1;
    const liveWeight = (p?.targetWeightKg || 2.0) * qty;
    const canalWeight = Number((liveWeight * (yieldPct / 100)).toFixed(2));

    const birdType = species === "gallina" ? "gallina_descarte"
      : species === "pollo" ? "pollo"
      : species;

    setForm((prev) => ({
      ...prev,
      species,
      birdType,
      carcassYieldPercent: String(yieldPct),
      liveWeightKg: String(liveWeight),
      weightKg: String(canalWeight),
      weightKgAutoconsumo: String(canalWeight),
      marketReferencePricePerKg: String(refPrice),
      henId: "",
      roosterId: "",
      batchId: "",
      locationId: "",
    }));
  };

  const handleHenSelect = (henId: string) => {
    if (henId) {
      const hen = hens.find((h) => h.id === henId);
      const weight = hen ? Number(hen.weight || "1.8") : 1.8;
      const canalWeight = (weight * 0.65).toFixed(2);
      setForm((prev) => ({
        ...prev,
        species: "gallina",
        birdType: "gallina_descarte",
        henId,
        roosterId: "",
        batchId: "",
        locationId: hen?.locationId || "",
        quantity: "1",
        liveWeightKg: String(weight),
        carcassYieldPercent: "65",
        weightKg: canalWeight,
        headsAutoconsumo: "1",
        weightKgAutoconsumo: canalWeight,
        headsExcedente: "0",
        weightKgExcedente: "0",
        marketReferencePricePerKg: String(priceKg("gallina")),
      }));
    } else {
      setForm((prev) => ({ ...prev, henId: "", locationId: "" }));
    }
  };

  const handleRoosterSelect = (roosterId: string) => {
    if (roosterId) {
      const rooster = roosters.find((r) => r.id === roosterId);
      const weight = rooster?.weight ? Number(rooster.weight) : 2.5;
      const canalWeight = (weight * 0.70).toFixed(2);
      setForm((prev) => ({
        ...prev,
        species: "pollo",
        birdType: "gallo",
        roosterId,
        henId: "",
        batchId: "",
        locationId: rooster?.locationId || "",
        quantity: "1",
        liveWeightKg: String(weight),
        carcassYieldPercent: "70",
        weightKg: canalWeight,
        headsAutoconsumo: "1",
        weightKgAutoconsumo: canalWeight,
        headsExcedente: "0",
        weightKgExcedente: "0",
        marketReferencePricePerKg: String(priceKg("pollo")),
      }));
    } else {
      setForm((prev) => ({ ...prev, roosterId: "", locationId: "" }));
    }
  };

  const handleBatchSelect = (batchId: string) => {
    if (batchId) {
      const batch = batches.find((b) => b.id === batchId);
      const sp = batch?.species || "pollo";
      const p = getParams(sp);
      const qty = batch?.currentQuantity || 1;
      const unitWeight = batch?.avgWeightKg ? Number(batch.avgWeightKg) : (p?.targetWeightKg || 2.2);
      const liveWeight = (unitWeight * qty).toFixed(1);
      const yieldPct = p?.carcassYieldPercent || 70;
      const canalWeight = (Number(liveWeight) * (yieldPct / 100)).toFixed(2);
      const autoHeads = Math.max(1, Math.round(qty * 0.25));
      const excHeads = Math.max(0, qty - autoHeads);
      const autoKg = ((Number(canalWeight) / qty) * autoHeads).toFixed(2);
      const excKg = (Number(canalWeight) - Number(autoKg)).toFixed(2);

      setForm((prev) => ({
        ...prev,
        species: sp,
        birdType: sp === "pollo" ? "pollo" : sp,
        batchId,
        henId: "",
        roosterId: "",
        locationId: batch?.locationId || "",
        quantity: String(qty),
        liveWeightKg: liveWeight,
        carcassYieldPercent: String(yieldPct),
        weightKg: canalWeight,
        headsAutoconsumo: String(autoHeads),
        weightKgAutoconsumo: autoKg,
        headsExcedente: String(excHeads),
        weightKgExcedente: excKg,
        marketReferencePricePerKg: String(priceKg(sp)),
      }));
    } else {
      setForm((prev) => ({ ...prev, batchId: "", locationId: "" }));
    }
  };

  // Recálculo automático de pesos de partición al cambiar cabezas
  const handleAutoconsumoHeadsChange = (val: string) => {
    const autoHeads = Number(val) || 0;
    const totalQty = Number(form.quantity) || 1;
    const totalCanalKg = Number(form.weightKg) || 0;
    const clampedAuto = Math.min(totalQty, Math.max(0, autoHeads));
    const excHeads = totalQty - clampedAuto;

    const autoKg = totalQty > 0 ? ((totalCanalKg / totalQty) * clampedAuto).toFixed(2) : "0";
    const excKg = totalQty > 0 ? (totalCanalKg - Number(autoKg)).toFixed(2) : "0";

    setForm((prev) => ({
      ...prev,
      headsAutoconsumo: String(clampedAuto),
      headsExcedente: String(excHeads),
      weightKgAutoconsumo: autoKg,
      weightKgExcedente: excKg,
    }));
  };

  const save = async () => {
    setError("");
    const qty = Number(form.quantity);
    const weightKg = Number(form.weightKg);
    if (!form.birdType) { setError("Tipo de animal requerido"); return; }
    if (!form.locationId) { setError("Selecciona el lugar de procedencia de los animales"); return; }
    if (!form.henId && !form.roosterId && !form.batchId) { setError("Debe seleccionar una gallina, un gallo o un lote"); return; }
    if (!qty || qty < 1) { setError("Cantidad inválida"); return; }
    if (!weightKg || weightKg <= 0) { setError("Peso requerido"); return; }

    const headsAuto = Number(form.headsAutoconsumo) || 0;
    const headsExc = Number(form.headsExcedente) || 0;
    const weightAuto = Number(form.weightKgAutoconsumo) || 0;
    const weightExc = Number(form.weightKgExcedente) || 0;
    const refPrice = Number(form.marketReferencePricePerKg) || 0;
    const savingsAmount = (weightAuto * refPrice).toFixed(2);

    const payload: Record<string, unknown> = {
      date: form.date,
      species: form.species,
      birdType: form.birdType,
      quantity: qty,
      liveWeightKg: form.liveWeightKg || null,
      carcassYieldPercent: form.carcassYieldPercent || null,
      weightKg,
      destination: form.destination,
      headsAutoconsumo: headsAuto,
      weightKgAutoconsumo: weightAuto,
      headsExcedente: headsExc,
      weightKgExcedente: weightExc,
      marketReferencePricePerKg: refPrice > 0 ? refPrice : null,
      estimatedSavingsAmount: savingsAmount,
      henId: form.henId || null,
      roosterId: form.roosterId || null,
      batchId: form.batchId || null,
      locationId: form.locationId,
      notes: form.notes || null,
    };
    if (editing) payload.id = editing.id;

    const method = editing ? "PUT" : "POST";
    const res = await apiFetch("/api/produccion/sacrificio", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.error || "Error al guardar"); return; }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro de faena? Se revertirá también el registro de consumo familiar vinculado.")) return;
    await apiFetch(`/api/produccion/sacrificio?id=${id}`, { method: "DELETE" });
    load();
  };

  // ─── Estadísticas Globales ───
  const totalBirds = records.reduce((s, r) => s + r.quantity, 0);
  const totalWeight = records.reduce((s, r) => s + Number(r.weightKg), 0);
  const totalSavings = records.reduce((s, r) => s + Number(r.estimatedSavingsAmount || 0), 0);
  const totalCarneExcedente = records.reduce((s, r) => s + Number(r.weightKgExcedente || (r.destination === "venta" ? r.weightKg : 0)), 0);

  const chartMap = new Map<string, { fecha: string; kg: number; aves: number }>();
  records.forEach((r) => {
    const key = new Date(r.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
    const prev = chartMap.get(key) || { fecha: key, kg: 0, aves: 0 };
    chartMap.set(key, { fecha: key, kg: prev.kg + Number(r.weightKg), aves: prev.aves + r.quantity });
  });
  const chartData = Array.from(chartMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const sp = record.species || "pollo";
      if (selectedSpeciesFilter !== "all" && sp !== selectedSpeciesFilter) {
        return false;
      }
      if (!search.trim()) return true;
      return matchesTextQuery(search, [
        record.date,
        new Date(record.date + "T12:00:00").toLocaleDateString("es"),
        record.hen?.code,
        record.rooster?.code,
        record.batch?.code,
        record.locationName,
        sp,
        SPECIES_LABEL[sp],
        birdTypeLabels[record.birdType] || record.birdType,
        destinationLabels[record.destination] || record.destination,
        record.weightKg,
        record.notes,
      ]);
    });
  }, [records, search, selectedSpeciesFilter]);

  // Cálculo en vivo dentro del modal
  const modalAhorroPreview = useMemo(() => {
    const w = Number(form.weightKgAutoconsumo) || 0;
    const p = Number(form.marketReferencePricePerKg) || 0;
    return w * p;
  }, [form.weightKgAutoconsumo, form.marketReferencePricePerKg]);

  const modalIngresoExcedentePreview = useMemo(() => {
    const w = Number(form.weightKgExcedente) || 0;
    const p = Number(form.marketReferencePricePerKg) || 0;
    return w * p;
  }, [form.weightKgExcedente, form.marketReferencePricePerKg]);

  return (
    <div>
      <PageHeader
        title="🍗 Faena y Producción de Carne"
        description="Registro multiespecie de faena con partición dual: autoconsumo del hogar y venta de excedentes"
        help="Aquí registras la faena de pollos, codornices, patos, conejos o aves de descarte.\n\n• Partición Dual: divide cada faena entre carne para el hogar (calcula el ahorro familiar según precios locales) y carne para la venta (va al inventario comercial).\n• El peso en canal es el peso limpio listo para cocina.\n• Cada registro con destino hogar se sincroniza automáticamente con el módulo de Soberanía Alimentaria."
        actions={<Button onClick={openNew}>+ Registrar Faena</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="🍗" label="Animales Faenados" value={totalBirds} color="green" />
        <StatCard icon="⚖️" label="Carne Canal Total" value={`${totalWeight.toFixed(1)} kg`} color="yellow" />
        <StatCard icon="🏡" label="Ahorro Familiar Generado" value={`$${Math.round(totalSavings).toLocaleString("es-CO")}`} color="purple" />
        <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200 flex flex-col justify-center">
          <p className="text-xs text-slate-500 font-medium mb-1">🥩 Carne para Venta (Excedentes)</p>
          <div className="text-xl font-bold text-blue-700">{totalCarneExcedente.toFixed(1)} kg</div>
          <div className="flex gap-2 mt-2">
            <Link href="/dashboard/inventarios/carne" className="text-xs text-blue-600 hover:underline">Ver inventario</Link>
            <span className="text-slate-300">|</span>
            <Link href="/dashboard/finanzas/ventas?tab=carne" className="text-xs text-blue-600 hover:underline">Registrar venta</Link>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">Evolución de Faena y Carne Producida</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" fontSize={11} />
              <YAxis yAxisId="left" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} />
              <Tooltip />
              <Bar yAxisId="left" dataKey="kg" fill="#f97316" radius={[4, 4, 0, 0]} name="kg Canal" />
              <Bar yAxisId="right" dataKey="aves" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Animales" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        {/* Filtros por Especie */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap gap-1">
            {[
              { id: "all", label: "Todas", icon: "🌐" },
              { id: "gallina", label: "Gallinas", icon: "🐔" },
              { id: "pollo", label: "Pollos", icon: "🐓" },
              { id: "codorniz", label: "Codornices", icon: "🥚" },
              { id: "pato", label: "Patos", icon: "🦆" },
              { id: "conejo", label: "Conejos", icon: "🐇" },
            ].map((sp) => {
              const isSelected = selectedSpeciesFilter === sp.id;
              const count = sp.id === "all"
                ? records.length
                : records.filter((r) => (r.species || "pollo") === sp.id).length;
              return (
                <button
                  key={sp.id}
                  onClick={() => setSelectedSpeciesFilter(sp.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {sp.icon} {sp.label} ({count})
                </button>
              );
            })}
          </div>

          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar por fecha, lote, ave..."
            resultCount={filteredRecords.length}
            totalCount={records.length}
            className="w-full sm:w-64"
          />
        </div>

        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon="🍗"
            message={
              search.trim() || selectedSpeciesFilter !== "all"
                ? "No hay registros que coincidan con la búsqueda"
                : "No hay registros de faena"
            }
          />
        ) : (
          <Table headers={["Fecha", "Especie / Origen", "Lugar", "Tipo Animal", "Canal Total", "Destino / Partición", "Ahorro Hogar", ""]}>
            {filteredRecords.map((r) => {
              const sp = r.species || "pollo";
              const icon = SPECIES_ICON[sp] || "🍗";
              const savings = Number(r.estimatedSavingsAmount || 0);
              const autoKg = Number(r.weightKgAutoconsumo || 0);
              const excKg = Number(r.weightKgExcedente || 0);

              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">{new Date(r.date + "T12:00:00").toLocaleDateString("es")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-medium text-slate-800 text-sm">
                      <span>{icon}</span>
                      {r.hen ? (
                        <span className="text-blue-600 font-semibold">{r.hen.code}</span>
                      ) : r.rooster ? (
                        <span className="text-red-600 font-semibold">{r.rooster.code}</span>
                      ) : r.batch ? (
                        <span className="text-orange-600 font-semibold">{r.batch.code}</span>
                      ) : (
                        <span className="text-slate-500">{SPECIES_LABEL[sp] || sp}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">{r.quantity} {r.quantity === 1 ? "cabeza" : "cabezas"}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{r.locationName || "Sin lugar asignado"}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {birdTypeLabels[r.birdType] || r.birdType}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800 text-sm">
                    {r.weightKg} kg
                    {r.carcassYieldPercent && (
                      <span className="text-[11px] text-slate-400 block font-normal">
                        Rend: {r.carcassYieldPercent}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium text-slate-700">
                      {destinationLabels[r.destination] || r.destination}
                    </div>
                    {(autoKg > 0 || excKg > 0) && (
                      <div className="text-[11px] text-slate-500 mt-0.5 space-x-2">
                        {autoKg > 0 && <span className="text-emerald-700">🏡 {autoKg} kg</span>}
                        {excKg > 0 && <span className="text-blue-700">💰 {excKg} kg</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {savings > 0 ? (
                      <span className="font-semibold text-emerald-700">
                        +${Math.round(savings).toLocaleString("es-CO")}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => remove(r.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* ─── Modal de Registro de Faena ─── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "✏️ Editar Registro de Faena" : "🍗 Registrar Faena de Animales"}
      >
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha *" help="Fecha en que se realizó la faena." type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Select
              label="Especie *"
              help="Especie del animal faenado."
              value={form.species}
              onChange={(e) => handleSpeciesChange(e.target.value)}
              disabled={!!editing}
            >
              <option value="pollo">🐓 Pollo de engorde</option>
              <option value="gallina">🐔 Gallina de descarte</option>
              <option value="codorniz">🥚 Codorniz</option>
              <option value="pato">🦆 Pato</option>
              <option value="conejo">🐇 Conejo de engorde</option>
            </Select>
          </div>

          {/* Selector de Origen: Lote, Gallina o Gallo */}
          {form.species === "gallina" ? (
            <Select label="Gallina específica *" help="Prioriza las marcadas como recomendadas para sacrificio." value={form.henId} onChange={(e) => handleHenSelect(e.target.value)}>
              <option value="">-- Seleccione una gallina --</option>
              {hens.map((h) => (
                <option key={h.id} value={h.id}>{h.code} — {h.weight} kg{h.status === "recomendada_sacrificio" ? " (Recomendada sacrificio)" : ""}</option>
              ))}
            </Select>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Select label="Lote de engorde / crianza" help="Lote de donde proceden los animales." value={form.batchId} onChange={(e) => handleBatchSelect(e.target.value)}>
                <option value="">-- Seleccionar Lote --</option>
                {batches
                  .filter((b) => !form.species || (b.species || "pollo") === form.species)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} ({b.currentQuantity} disp.) {b.status === "listo_sacrificio" ? "✅ Listo" : ""}
                    </option>
                  ))}
              </Select>

              {form.species === "pollo" && (
                <Select label="O seleccionar Gallo reproductor" value={form.roosterId} onChange={(e) => handleRoosterSelect(e.target.value)}>
                  <option value="">-- Sin gallo --</option>
                  {roosters.map((r) => (
                    <option key={r.id} value={r.id}>{r.code} {r.weight ? `— ${r.weight} kg` : ""}</option>
                  ))}
                </Select>
              )}
            </div>
          )}

          <FarmLocationSelect value={form.locationId} onChange={(locationId) => setForm({ ...form, locationId })} label="Lugar donde estaban alojados *" help="La faena se atribuye al lugar actual del animal o lote." />

          {/* Pesos y Rendimiento */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Cantidad (cabezas) *"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => {
                const q = e.target.value;
                setForm({ ...form, quantity: q, headsAutoconsumo: q, headsExcedente: "0" });
              }}
            />
            <Input
              label="Peso vivo total (kg)"
              help="Peso de los animales antes del sacrificio."
              type="number"
              step="0.01"
              value={form.liveWeightKg}
              onChange={(e) => setForm({ ...form, liveWeightKg: e.target.value })}
            />
            <Input
              label="Rendimiento canal (%)"
              help="% de peso limpio aprovechable."
              type="number"
              min="10"
              max="100"
              value={form.carcassYieldPercent}
              onChange={(e) => setForm({ ...form, carcassYieldPercent: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Peso canal total (kg) *"
              help="Carne limpia obtenida tras la faena."
              type="number"
              step="0.01"
              value={form.weightKg}
              onChange={(e) => setForm({ ...form, weightKg: e.target.value, weightKgAutoconsumo: e.target.value, weightKgExcedente: "0" })}
            />
            <Input
              label="Precio ref. mercado ($/kg COP)"
              help="Precio local de venta para valorar el ahorro de casa."
              type="number"
              value={form.marketReferencePricePerKg}
              onChange={(e) => setForm({ ...form, marketReferencePricePerKg: e.target.value })}
            />
          </div>

          {/* Bloque de Partición Dual: Hogar vs Venta */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                ⚖️ Distribución Dual: Seguridad Alimentaria vs Económica
              </span>
              <Select
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="text-xs py-1"
              >
                <option value="mixto">Dual (Hogar + Venta)</option>
                <option value="consumo_propio">100% Consumo Hogar</option>
                <option value="venta">100% Venta Comercial</option>
                <option value="donacion">Donación / Regalo</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                <span className="text-xs font-semibold text-emerald-800 block mb-1">🏡 Para el Hogar (Autoconsumo)</span>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Cabezas"
                    type="number"
                    min="0"
                    value={form.headsAutoconsumo}
                    onChange={(e) => handleAutoconsumoHeadsChange(e.target.value)}
                  />
                  <Input
                    label="kg Canal"
                    type="number"
                    step="0.01"
                    value={form.weightKgAutoconsumo}
                    onChange={(e) => setForm({ ...form, weightKgAutoconsumo: e.target.value })}
                  />
                </div>
                <div className="mt-1 text-[11px] text-emerald-700 font-medium">
                  Ahorro generado: +${Math.round(modalAhorroPreview).toLocaleString("es-CO")}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-amber-100">
                <span className="text-xs font-semibold text-blue-800 block mb-1">💰 Para Venta (Excedentes)</span>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Cabezas"
                    type="number"
                    min="0"
                    value={form.headsExcedente}
                    onChange={(e) => setForm({ ...form, headsExcedente: e.target.value })}
                  />
                  <Input
                    label="kg Canal"
                    type="number"
                    step="0.01"
                    value={form.weightKgExcedente}
                    onChange={(e) => setForm({ ...form, weightKgExcedente: e.target.value })}
                  />
                </div>
                <div className="mt-1 text-[11px] text-blue-700 font-medium">
                  Ingreso potencial: ~${Math.round(modalIngresoExcedentePreview).toLocaleString("es-CO")}
                </div>
              </div>
            </div>
          </div>

          <Textarea label="Notas" help="Observaciones sobre la faena o calidad de canal." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <div className="flex gap-3">
            <Button onClick={save}>{editing ? "Actualizar Registro" : "Guardar Faena"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
