"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { PageHeader, Button, Card, Table, Modal, Input, Textarea, EmptyState, StatCard, Badge, Select } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog } from "@/lib/useCatalog";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { SPECIES_ICON, SPECIES_LABEL } from "@/lib/species-params";
import { useSpeciesCatalog } from "@/lib/use-species-params";

interface EggDetail {
  size: string;
  quantity: number;
}

interface EggRecord {
  id: string;
  date: string;
  species?: string;
  batchId?: string | null;
  totalCollected: number;
  broken: number;
  forIncubation: number;
  quantityAutoconsumo?: number | null;
  quantityExcedente?: number | null;
  referenceUnitPrice?: string | null;
  notes: string | null;
  details: EggDetail[];
}

interface StageEggData {
  name: string;
  count: number;
  expectedEggsPerDay: number;
}

interface BroilerBatch {
  id: string;
  code: string;
  species: string;
  currentQuantity: number;
  status: string;
}

const SIZE_COLORS: Record<string, string> = {
  Jumbo: "#7c3aed",
  Extra: "#3b82f6",
  Grande: "#22c55e",
  Mediano: "#eab308",
  Pequeño: "#f97316",
};

const stageColors: Record<string, string> = {
  Pollito: "yellow",
  Juvenil: "blue",
  "Pre-postura": "purple",
  Postura: "green",
};

export default function HuevosPage() {
  const { priceEgg } = useSpeciesCatalog();
  const [records, setRecords] = useState<EggRecord[]>([]);
  const [stageData, setStageData] = useState<StageEggData[]>([]);
  const [batches, setBatches] = useState<BroilerBatch[]>([]);
  const [totalExpected, setTotalExpected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EggRecord | null>(null);
  const [error, setError] = useState("");
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string>("all");

  const [form, setForm] = useState<{
    date: string;
    species: string;
    batchId: string;
    totalUnits: number;
    sizes: Record<string, number>;
    broken: number;
    forIncubation: number;
    quantityAutoconsumo: number;
    quantityExcedente: number;
    referenceUnitPrice: string;
    notes: string;
  }>({
    date: new Date().toISOString().split("T")[0],
    species: "gallina",
    batchId: "",
    totalUnits: 0,
    sizes: {},
    broken: 0,
    forIncubation: 0,
    quantityAutoconsumo: 0,
    quantityExcedente: 0,
    referenceUnitPrice: "600",
    notes: "",
  });

  const [confirmOverLimit, setConfirmOverLimit] = useState(false);
  const [overLimitMsg, setOverLimitMsg] = useState("");
  const [quickMode, setQuickMode] = useState(true);
  const [quickTotal, setQuickTotal] = useState(0);
  const [showSaleSuggestion, setShowSaleSuggestion] = useState(false);
  const [saleSuggestionQty, setSaleSuggestionQty] = useState(0);
  const [search, setSearch] = useState("");
  const { items: sizeOptions } = useCatalog("tamano_huevo");

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/huevos").then((r) => r.json()),
      apiFetch("/api/produccion/etapas/resumen").then((r) => r.json()),
      apiFetch("/api/produccion/pollos").then((r) => r.json()),
    ]).then(([eggs, resumen, lotes]) => {
      setRecords(Array.isArray(eggs) ? eggs : []);
      setStageData(resumen.stages || []);
      setTotalExpected(resumen.totalExpectedEggsPerDay || 0);
      const lotesList = Array.isArray(lotes) ? lotes : [];
      setBatches(lotesList.filter((b: BroilerBatch) => b.species === "codorniz" || b.species === "pato"));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const sizesTotal = sizeOptions.reduce((s, o) => s + (form.sizes[o.value] || 0), 0);
  const effectiveGoodEggs = form.species === "gallina" ? (quickMode && !editing ? quickTotal : sizesTotal) : form.totalUnits;
  const totalCollected = effectiveGoodEggs + form.broken + form.forIncubation;

  // Promedio histórico para modo rápido de gallinas
  const historicalAvg = useMemo(() => {
    const recent = records.filter((r) => (r.species || "gallina") === "gallina").slice(0, 14);
    if (recent.length === 0) return { sizePcts: {} as Record<string, number>, brokenPct: 0.02, incubPct: 0 };
    const sizeTotals: Record<string, number> = {};
    let grandTotal = 0;
    let totalBroken = 0;
    let totalIncub = 0;
    recent.forEach((r) => {
      r.details.forEach((d) => { sizeTotals[d.size] = (sizeTotals[d.size] || 0) + d.quantity; });
      grandTotal += r.totalCollected;
      totalBroken += r.broken;
      totalIncub += r.forIncubation;
    });
    const sizePcts: Record<string, number> = {};
    Object.entries(sizeTotals).forEach(([size, qty]) => {
      sizePcts[size] = grandTotal > 0 ? qty / grandTotal : 0;
    });
    return {
      sizePcts,
      brokenPct: grandTotal > 0 ? totalBroken / grandTotal : 0.02,
      incubPct: grandTotal > 0 ? totalIncub / grandTotal : 0,
    };
  }, [records]);

  const quickDistribution = useMemo(() => {
    if (quickTotal <= 0) return {} as Record<string, number>;
    const { sizePcts } = historicalAvg;
    const sizes = sizeOptions.map((o) => o.value);
    const dist: Record<string, number> = {};
    let assigned = 0;
    const hasHistory = Object.values(sizePcts).some((p) => p > 0);
    sizes.forEach((size, i) => {
      const pct = hasHistory ? (sizePcts[size] || 0) : 1 / sizes.length;
      const qty = i < sizes.length - 1 ? Math.round(quickTotal * pct) : quickTotal - assigned;
      dist[size] = Math.max(0, qty);
      assigned += dist[size];
    });
    return dist;
  }, [quickTotal, historicalAvg, sizeOptions]);

  const quickBroken = useMemo(() => Math.round(quickTotal * historicalAvg.brokenPct), [quickTotal, historicalAvg]);
  const quickIncub = useMemo(() => Math.round(quickTotal * historicalAvg.incubPct), [quickTotal, historicalAvg]);

  const handleSpeciesChange = (species: string) => {
    const refPrice = priceEgg(species);
    setForm((prev) => ({
      ...prev,
      species,
      referenceUnitPrice: String(refPrice),
      batchId: "",
      totalUnits: 0,
    }));
  };

  const openNew = () => {
    setEditing(null);
    setError("");
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    setQuickMode(true);
    setQuickTotal(0);
    setForm({
      date: new Date().toISOString().split("T")[0],
      species: "gallina",
      batchId: "",
      totalUnits: 0,
      sizes: {},
      broken: 0,
      forIncubation: 0,
      quantityAutoconsumo: 0,
      quantityExcedente: 0,
      referenceUnitPrice: "600",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (r: EggRecord) => {
    setEditing(r);
    setError("");
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    setQuickMode(false);
    const sp = r.species || "gallina";
    const sizes: Record<string, number> = {};
    r.details.forEach((d) => { sizes[d.size] = d.quantity; });
    const autoQty = r.quantityAutoconsumo || 0;
    const excQty = r.quantityExcedente || Math.max(0, r.totalCollected - r.broken - r.forIncubation - autoQty);

    setForm({
      date: r.date,
      species: sp,
      batchId: r.batchId || "",
      totalUnits: r.totalCollected - r.broken - r.forIncubation,
      sizes,
      broken: r.broken,
      forIncubation: r.forIncubation,
      quantityAutoconsumo: autoQty,
      quantityExcedente: excQty,
      referenceUnitPrice: r.referenceUnitPrice || String(priceEgg(sp)),
      notes: r.notes || "",
    });
    setModalOpen(true);
  };

  const setSizeQty = (size: string, qty: number) => {
    setForm((prev) => {
      const updatedSizes = { ...prev.sizes, [size]: qty };
      const newTotalGood = Object.values(updatedSizes).reduce((a, b) => a + b, 0);
      return {
        ...prev,
        sizes: updatedSizes,
        quantityExcedente: Math.max(0, newTotalGood - prev.quantityAutoconsumo),
      };
    });
  };

  const save = async (overrideValidation = false) => {
    setError("");
    const method = editing ? "PUT" : "POST";
    const isGallina = form.species === "gallina";

    let sizesToSave: { size: string; quantity: number }[] = [];
    let totalGood = 0;
    let broken = form.broken;
    let forIncubation = form.forIncubation;

    if (isGallina) {
      if (quickMode && !editing) {
        sizesToSave = Object.entries(quickDistribution)
          .filter(([, v]) => v > 0)
          .map(([size, quantity]) => ({ size, quantity }));
        totalGood = quickTotal;
        broken = quickBroken;
        forIncubation = quickIncub;
      } else {
        sizesToSave = sizeOptions
          .map((o) => ({ size: o.value, quantity: form.sizes[o.value] || 0 }))
          .filter((x) => x.quantity > 0);
        totalGood = sizesToSave.reduce((s, x) => s + x.quantity, 0);
      }
    } else {
      // Codorniz o Pato: tamaño genérico estándar
      totalGood = form.totalUnits;
      const genericSizeName = form.species === "codorniz" ? "Codorniz estándar" : "Pato estándar";
      sizesToSave = [{ size: genericSizeName, quantity: totalGood }];
    }

    const totalToSave = totalGood + broken + forIncubation;
    if (totalToSave <= 0) {
      setError("Debes ingresar al menos 1 huevo recolectado");
      return;
    }

    const autoQty = form.quantityAutoconsumo || 0;
    const excQty = form.quantityExcedente !== undefined ? form.quantityExcedente : Math.max(0, totalGood - autoQty);

    const payload = {
      id: editing?.id,
      date: form.date,
      species: form.species,
      batchId: form.batchId || null,
      totalCollected: totalToSave,
      broken,
      forIncubation,
      quantityAutoconsumo: autoQty,
      quantityExcedente: excQty,
      referenceUnitPrice: form.referenceUnitPrice || null,
      notes: form.notes || null,
      sizes: sizesToSave,
      overrideValidation,
    };

    const res = await apiFetch("/api/produccion/huevos", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      setOverLimitMsg(data.error || "Producción inusualmente alta");
      setConfirmOverLimit(true);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al guardar el registro");
      return;
    }

    setModalOpen(false);
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    load();

    try {
      const invRes = await apiFetch("/api/produccion/huevos/inventario");
      const invData = await invRes.json();
      const totalAvailable = invData.summary?.sizes?.reduce((s: number, i: { available: number }) => s + i.available, 0) || 0;
      if (totalAvailable > 30) {
        setSaleSuggestionQty(totalAvailable);
        setShowSaleSuggestion(true);
      }
    } catch { /* ignore */ }
  };

  const confirmAndSave = () => {
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    save(true);
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este registro de postura? Si tenía huevos asignados al hogar se revertirá en Soberanía.")) return;
    await apiFetch(`/api/produccion/huevos?id=${id}`, { method: "DELETE" });
    load();
  };

  // Filtrado por especie
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const sp = record.species || "gallina";
      if (selectedSpeciesFilter !== "all" && sp !== selectedSpeciesFilter) {
        return false;
      }
      if (!search.trim()) return true;
      return matchesTextQuery(search, [
        record.date,
        new Date(record.date + "T12:00:00").toLocaleDateString("es"),
        sp,
        SPECIES_LABEL[sp],
        record.notes,
        record.broken,
        record.forIncubation,
        ...record.details.map((detail) => `${detail.size} ${detail.quantity}`),
      ]);
    });
  }, [records, search, selectedSpeciesFilter]);

  const totalAll = filteredRecords.reduce((s, r) => s + r.totalCollected, 0);
  const totalBroken = filteredRecords.reduce((s, r) => s + r.broken, 0);
  const totalIncub = filteredRecords.reduce((s, r) => s + r.forIncubation, 0);
  const totalAutoconsumo = filteredRecords.reduce((s, r) => s + (r.quantityAutoconsumo || 0), 0);
  const totalExcedente = filteredRecords.reduce((s, r) => s + (r.quantityExcedente || 0), 0);
  const totalSavings = filteredRecords.reduce((s, r) => s + ((r.quantityAutoconsumo || 0) * Number(r.referenceUnitPrice || 0)), 0);
  const avgDaily = filteredRecords.length > 0 ? Math.round(totalAll / filteredRecords.length) : 0;

  // Gráfico de evolución
  const chartData = filteredRecords.slice(0, 30).reverse().map((r) => {
    const sp = r.species || "gallina";
    const row: Record<string, number | string> = {
      fecha: new Date(r.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" }),
      Total: r.totalCollected,
      Hogar: r.quantityAutoconsumo || 0,
      Excedente: r.quantityExcedente || 0,
      Rotos: r.broken,
    };
    return row;
  });

  return (
    <div>
      <PageHeader
        title="🥚 Producción de Huevos Multiespecie"
        description="Recolección de huevos de Gallinas, Codornices y Patos con partición para el hogar y venta"
        help="Aquí registras la recolección diaria de huevos de todas las aves ponedoras:\n\n• Gallinas: clasificación por tamaño comercial o modo rápido.\n• Codornices: alta densidad y postura continua desde semana 6.\n• Patos: huevos grandes de alto valor culinario.\n\nCada registro permite destinar unidades al hogar (autoconsumo familiar) y a la venta de excedentes."
        actions={<Button onClick={openNew}>+ Registrar Recolección</Button>}
      />

      {/* StatCards Principales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon="🥚" label="Total Huevos" value={totalAll} color="yellow" />
        <StatCard icon="📊" label="Promedio/día" value={avgDaily} color="blue" />
        <StatCard icon="🏡" label="Para el Hogar" value={`${totalAutoconsumo} uds`} color="green" />
        <StatCard icon="💵" label="Ahorro Hogar" value={`$${Math.round(totalSavings).toLocaleString("es-CO")}`} color="purple" />
        <StatCard icon="💰" label="Excedentes Venta" value={`${totalExcedente} uds`} color="blue" />
        <StatCard icon="💔" label="Rotos / Descarte" value={totalBroken} color="red" />
      </div>

      {/* Producción esperada de gallinas (si hay gallinas activas) */}
      {selectedSpeciesFilter !== "codorniz" && selectedSpeciesFilter !== "pato" && stageData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-3">🎯 Producción Esperada de Gallinas por Etapa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stageData.map((stage) => (
              <div key={stage.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <Badge color={stageColors[stage.name] || "gray"}>{stage.name}</Badge>
                  <p className="text-xs text-slate-500 mt-1">{stage.count} gallina{stage.count !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-yellow-700">{stage.expectedEggsPerDay}</p>
                  <p className="text-xs text-slate-500">huevos/día</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Gráfico de evolución */}
      {chartData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">📊 Evolución de Postura y Distribución (Hogar vs Venta)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" fontSize={10} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Hogar" fill="#16a34a" radius={[3, 3, 0, 0]} name="🏡 Consumo Hogar" />
              <Bar dataKey="Excedente" fill="#3b82f6" radius={[3, 3, 0, 0]} name="💰 Venta Excedente" />
              <Bar dataKey="Rotos" fill="#ef4444" radius={[3, 3, 0, 0]} name="💔 Rotos" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Filtros por Especie y Buscador */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap gap-1">
            {[
              { id: "all", label: "Todas las Aves", icon: "🌐" },
              { id: "gallina", label: "Gallinas", icon: "🐔" },
              { id: "codorniz", label: "Codornices", icon: "🥚" },
              { id: "pato", label: "Patas", icon: "🦆" },
            ].map((sp) => {
              const isSelected = selectedSpeciesFilter === sp.id;
              const count = sp.id === "all"
                ? records.length
                : records.filter((r) => (r.species || "gallina") === sp.id).length;
              return (
                <button
                  key={sp.id}
                  onClick={() => setSelectedSpeciesFilter(sp.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isSelected
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
            placeholder="Buscar por fecha, notas..."
            resultCount={filteredRecords.length}
            totalCount={records.length}
            className="w-full sm:w-64"
          />
        </div>

        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            icon="🥚"
            message={
              search.trim() || selectedSpeciesFilter !== "all"
                ? "No hay registros que coincidan con la búsqueda"
                : "No hay registros de producción de huevos"
            }
          />
        ) : (
          <Table headers={["Fecha", "Especie", "Total Recogido", "Para el Hogar", "Para Venta", "Ahorro ($)", "Rotos / Inc.", ""]}>
            {filteredRecords.map((r) => {
              const sp = r.species || "gallina";
              const icon = SPECIES_ICON[sp] || "🥚";
              const autoUnits = r.quantityAutoconsumo || 0;
              const excUnits = r.quantityExcedente || Math.max(0, r.totalCollected - r.broken - r.forIncubation - autoUnits);
              const savings = autoUnits * Number(r.referenceUnitPrice || priceEgg(sp));

              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-sm">
                    {new Date(r.date + "T12:00:00").toLocaleDateString("es")}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-semibold text-slate-800">{icon} {SPECIES_LABEL[sp] || sp}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800 text-base">
                    {r.totalCollected} <span className="text-xs text-slate-400 font-normal">uds</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-emerald-700 font-medium">
                    {autoUnits > 0 ? `🏡 ${autoUnits} uds` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-blue-700 font-medium">
                    {excUnits > 0 ? `💰 ${excUnits} uds` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-800">
                    {savings > 0 ? `+$${Math.round(savings).toLocaleString("es-CO")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {r.broken > 0 && <span className="text-red-600 mr-2">💔 {r.broken}</span>}
                    {r.forIncubation > 0 && <span className="text-purple-600">🐣 {r.forIncubation}</span>}
                    {r.broken === 0 && r.forIncubation === 0 && "0"}
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

      {/* ─── Modal: Registro de Huevos Multiespecie ─── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "✏️ Editar Recolección de Huevos" : "🥚 Registrar Recolección de Huevos"}
      >
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fecha de Recolección *"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <Select
              label="Especie de Ave *"
              value={form.species}
              onChange={(e) => handleSpeciesChange(e.target.value)}
              disabled={!!editing}
            >
              <option value="gallina">🐔 Gallinas ponedoras</option>
              <option value="codorniz">🥚 Codornices</option>
              <option value="pato">🦆 Patas</option>
            </Select>
          </div>

          {/* Si es codorniz o pato, permitir asociar a lote */}
          {form.species !== "gallina" && batches.length > 0 && (
            <Select
              label="Lote de procedencia (opcional)"
              value={form.batchId}
              onChange={(e) => setForm({ ...form, batchId: e.target.value })}
            >
              <option value="">-- Sin lote asignado --</option>
              {batches
                .filter((b) => b.species === form.species)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} ({b.currentQuantity} aves)
                  </option>
                ))}
            </Select>
          )}

          {/* Formulario específico según especie */}
          {form.species === "gallina" ? (
            <>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setQuickMode(true)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${quickMode ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-300"
                    }`}
                >
                  ⚡ Recogida rápida
                </button>
                <button
                  type="button"
                  onClick={() => setQuickMode(false)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!quickMode ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-300"
                    }`}
                >
                  📋 Detallado por Tamaño
                </button>
              </div>

              {quickMode && !editing ? (
                <div>
                  <Input
                    label="Total de huevos recogidos *"
                    type="number"
                    min="1"
                    value={quickTotal || ""}
                    placeholder="Ej: 30"
                    onChange={(e) => {
                      const q = parseInt(e.target.value) || 0;
                      setQuickTotal(q);
                      setForm((prev) => ({
                        ...prev,
                        quantityExcedente: Math.max(0, q - prev.quantityAutoconsumo),
                      }));
                    }}
                  />
                  {quickTotal > 0 && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs mt-2">
                      <p className="font-semibold text-blue-700 mb-1">Distribución automática estimada:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(quickDistribution).filter(([, qty]) => qty > 0).map(([size, qty]) => (
                          <span key={size} className="px-2 py-0.5 bg-white rounded text-slate-700 border text-xs">
                            {size}: <strong>{qty}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {sizeOptions.map((o) => (
                    <Input
                      key={o.id}
                      label={`${o.value}`}
                      type="number"
                      min="0"
                      value={form.sizes[o.value] || 0}
                      onChange={(e) => setSizeQty(o.value, parseInt(e.target.value) || 0)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Codornices o Patos: ingreso directo sin tamaños AAA */
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <Input
                label={`Total Huevos de ${SPECIES_LABEL[form.species] || form.species} Recolectados *`}
                type="number"
                min="1"
                placeholder="Ej: 24"
                value={form.totalUnits || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setForm((prev) => ({
                    ...prev,
                    totalUnits: val,
                    quantityExcedente: Math.max(0, val - prev.quantityAutoconsumo),
                  }));
                }}
              />
            </div>
          )}

          {/* Rotos e Incubación */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Rotos / Descarte"
              type="number"
              min="0"
              value={form.broken}
              onChange={(e) => setForm({ ...form, broken: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Para Incubación"
              type="number"
              min="0"
              value={form.forIncubation}
              onChange={(e) => setForm({ ...form, forIncubation: parseInt(e.target.value) || 0 })}
            />
          </div>

          {/* Bloque de Partición Dual: Consumo Hogar vs Excedentes */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide block">
              🏡 Destino Dual de la Postura (Alimentación Familiar y Venta)
            </span>

            <div className="grid grid-cols-3 gap-2">
              <Input
                label="Para el Hogar (uds)"
                type="number"
                min="0"
                value={form.quantityAutoconsumo}
                onChange={(e) => {
                  const auto = parseInt(e.target.value) || 0;
                  const good = form.species === "gallina" ? (quickMode && !editing ? quickTotal : sizesTotal) : form.totalUnits;
                  const exc = Math.max(0, good - auto);
                  setForm({ ...form, quantityAutoconsumo: auto, quantityExcedente: exc });
                }}
              />
              <Input
                label="Para Venta (uds)"
                type="number"
                min="0"
                value={form.quantityExcedente}
                onChange={(e) => setForm({ ...form, quantityExcedente: parseInt(e.target.value) || 0 })}
              />
              <Input
                label="Precio ref. ($/ud COP)"
                type="number"
                value={form.referenceUnitPrice}
                onChange={(e) => setForm({ ...form, referenceUnitPrice: e.target.value })}
              />
            </div>

            <div className="flex justify-between items-center text-xs text-emerald-800 pt-1 border-t border-emerald-200">
              <span>Ahorro familiar generado:</span>
              <strong className="text-sm font-bold text-emerald-700">
                +${((form.quantityAutoconsumo || 0) * Number(form.referenceUnitPrice || 0)).toLocaleString("es-CO")} COP
              </strong>
            </div>
          </div>

          <Textarea
            label="Notas"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Observaciones de la recolección..."
          />

          {confirmOverLimit && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs">
              <p className="font-semibold text-amber-800 mb-1">⚠️ Producción inusualmente alta</p>
              <p className="text-amber-700 mb-2">{overLimitMsg}</p>
              <div className="flex gap-2">
                <Button onClick={confirmAndSave} variant="primary">Confirmar y Guardar</Button>
                <Button onClick={() => setConfirmOverLimit(false)} variant="secondary">Revisar</Button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={() => save()} disabled={confirmOverLimit}>
              {editing ? "Actualizar Registro" : "Registrar Recolección"}
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Sugerencia de venta rápida */}
      {showSaleSuggestion && (
        <div className="fixed bottom-4 right-4 z-50 p-4 bg-green-50 border border-green-300 rounded-xl shadow-lg max-w-sm">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-semibold text-green-800">📦 Tienes {saleSuggestionQty} huevos listos para venta</p>
            <button onClick={() => setShowSaleSuggestion(false)} className="text-green-600 hover:text-green-800 text-xs">✕</button>
          </div>
          <div className="flex gap-2 mt-2">
            <Link href="/dashboard/finanzas/ventas">
              <Button variant="primary">Registrar Venta</Button>
            </Link>
            <Button variant="secondary" onClick={() => setShowSaleSuggestion(false)}>Cerrar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
