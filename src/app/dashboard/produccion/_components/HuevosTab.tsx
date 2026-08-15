"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { PageHeader, Button, Card, Table, Modal, Input, Textarea, EmptyState, StatCard, Badge } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, ReferenceLine } from "recharts";
import { apiFetch } from "@/lib/fetch";
import { useCatalog, type CatalogItem } from "@/lib/useCatalog";

interface EggDetail {
  size: string;
  quantity: number;
}

interface EggRecord {
  id: string;
  date: string;
  totalCollected: number;
  broken: number;
  forIncubation: number;
  notes: string | null;
  details: EggDetail[];
}

interface StageEggData {
  name: string;
  count: number;
  expectedEggsPerDay: number;
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
  const [records, setRecords] = useState<EggRecord[]>([]);
  const [stageData, setStageData] = useState<StageEggData[]>([]);
  const [totalExpected, setTotalExpected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EggRecord | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ date: string; sizes: Record<string, number>; broken: number; forIncubation: number; notes: string }>({
    date: new Date().toISOString().split("T")[0],
    sizes: {},
    broken: 0,
    forIncubation: 0,
    notes: "",
  });
  const [confirmOverLimit, setConfirmOverLimit] = useState(false);
  const [overLimitMsg, setOverLimitMsg] = useState("");
  const [quickMode, setQuickMode] = useState(true);
  const [quickTotal, setQuickTotal] = useState(0);
  const [showSaleSuggestion, setShowSaleSuggestion] = useState(false);
  const [saleSuggestionQty, setSaleSuggestionQty] = useState(0);
  const { items: sizeOptions } = useCatalog("tamano_huevo");

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/huevos").then((r) => r.json()),
      apiFetch("/api/produccion/etapas/resumen").then((r) => r.json()),
    ]).then(([eggs, resumen]) => {
      setRecords(eggs);
      setStageData(resumen.stages || []);
      setTotalExpected(resumen.totalExpectedEggsPerDay || 0);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const sizesTotal = sizeOptions.reduce((s, o) => s + (form.sizes[o.value] || 0), 0);
  const totalCollected = sizesTotal + form.broken + form.forIncubation;

  // ─── Historical averages for quick mode ───
  const historicalAvg = useMemo(() => {
    const recent = records.slice(0, 14);
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
    // If no history, distribute evenly
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

  const openNew = () => {
    setEditing(null);
    setError("");
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    setQuickMode(true);
    setQuickTotal(0);
    setForm({ date: new Date().toISOString().split("T")[0], sizes: {}, broken: 0, forIncubation: 0, notes: "" });
    setModalOpen(true);
  };

  const openEdit = (r: EggRecord) => {
    setEditing(r);
    setError("");
    setConfirmOverLimit(false);
    setOverLimitMsg("");
    setQuickMode(false); // editing always uses detailed mode
    const sizes: Record<string, number> = {};
    r.details.forEach((d) => { sizes[d.size] = d.quantity; });
    setForm({ date: r.date, sizes, broken: r.broken, forIncubation: r.forIncubation, notes: r.notes || "" });
    setModalOpen(true);
  };

  const setSizeQty = (size: string, qty: number) => {
    setForm({ ...form, sizes: { ...form.sizes, [size]: qty } });
  };

  // Apply quick mode distribution to form before saving
  const applyQuickMode = useCallback(() => {
    if (!quickMode || editing) return;
    const sizes: Record<string, number> = {};
    Object.entries(quickDistribution).forEach(([size, qty]) => { if (qty > 0) sizes[size] = qty; });
    setForm((prev) => ({ ...prev, sizes, broken: quickBroken, forIncubation: quickIncub }));
  }, [quickMode, editing, quickDistribution, quickBroken, quickIncub]);

  const save = async (overrideValidation = false) => {
    setError("");
    if (quickMode && !editing) applyQuickMode();
    const method = editing ? "PUT" : "POST";
    // Use the form state (which was just updated by applyQuickMode if in quick mode)
    const formToSave = quickMode && !editing
      ? { ...form, sizes: Object.fromEntries(Object.entries(quickDistribution).filter(([, v]) => v > 0)), broken: quickBroken, forIncubation: quickIncub }
      : form;
    const sizesToSave = sizeOptions.map((o) => ({ size: o.value, quantity: formToSave.sizes[o.value] || 0 })).filter((x) => x.quantity > 0);
    const totalToSave = sizesToSave.reduce((s, x) => s + x.quantity, 0) + formToSave.broken + formToSave.forIncubation;
    const body = editing ? { ...formToSave, id: editing.id } : formToSave;
    const res = await apiFetch("/api/produccion/huevos", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, sizes: sizesToSave, totalCollected: totalToSave, overrideValidation }),
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
    // Check if we should suggest selling (Phase 2.2)
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
    if (!confirm("¿Eliminar este registro?")) return;
    await apiFetch(`/api/produccion/huevos?id=${id}`, { method: "DELETE" });
    load();
  };

  const totalAll = records.reduce((s, r) => s + r.totalCollected, 0);
  const totalBroken = records.reduce((s, r) => s + r.broken, 0);
  const totalIncub = records.reduce((s, r) => s + r.forIncubation, 0);
  const avgDaily = records.length > 0 ? Math.round(totalAll / records.length) : 0;
  const bySizeTotals = sizeOptions.map((o) => ({
    size: o.value,
    total: records.reduce((s, r) => s + (r.details.find((d) => d.size === o.value)?.quantity || 0), 0),
  }));

  const chartData = records.slice(0, 30).reverse().map((r) => {
    const row: Record<string, number | string> = {
      fecha: new Date(r.date + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" }),
    };
    sizeOptions.forEach((o) => { row[o.value] = r.details.find((d) => d.size === o.value)?.quantity || 0; });
    row.Rotos = r.broken;
    row.Incubación = r.forIncubation;
    if (totalExpected > 0) row.Proyección = totalExpected;
    return row;
  });

  const sizeHeaders = sizeOptions.map((o) => o.value);

  return (
    <div>
      <PageHeader
        title="🥚 Producción de Huevos"
        description="Registro diario de recolección clasificada por tamaño según el catálogo"
        help="Aquí registras la recolección diaria de huevos. Puedes usar el modo rápido (un solo campo, el sistema distribuye por tamaño automáticamente) o el modo detallado (ingresas cada tamaño manualmente).\n\n• Modo rápido: ideal para el día a día. Solo ingresa el total y el sistema calcula la distribución según tus últimos 14 registros.\n• Modo detallado: para cuando quieres ser preciso e ingresar cada tamaño por separado.\n• Después de recoger, si tienes mucho stock, el sistema te sugerirá vender."
        actions={<Button onClick={openNew}>+ Registrar Recolección</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon="🥚" label="Total Recolectados" value={totalAll} color="yellow" />
        <StatCard icon="📊" label="Promedio Real/día" value={avgDaily} color="blue" />
        <StatCard icon="🎯" label="Esperado/día" value={totalExpected} color="green" />
        <StatCard icon="💔" label="Rotos" value={totalBroken} color="red" />
        <StatCard icon="🐣" label="Para Incubación" value={totalIncub} color="purple" />
      </div>

      {/* Expected Production by Stage */}
      {stageData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-3">🎯 Producción Esperada por Etapa</h3>
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
          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200 flex justify-between items-center">
            <span className="text-sm font-semibold text-green-700">TOTAL ESPERADO</span>
            <span className="text-xl font-bold text-green-700">{totalExpected} huevos/día</span>
          </div>
          {avgDaily > 0 && totalExpected > 0 && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg flex justify-between items-center">
              <span className="text-sm font-semibold text-blue-700">RENDIMIENTO</span>
              <span className={`text-xl font-bold ${avgDaily >= totalExpected ? "text-green-600" : "text-orange-600"}`}>
                {Math.round((avgDaily / totalExpected) * 100)}%
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-4">📊 Producción por Tamaño (últimos 30 registros)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" fontSize={10} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              {sizeOptions.map((o) => (
                <Bar key={o.id} dataKey={o.value} stackId="a" fill={SIZE_COLORS[o.value] || "#94a3b8"} />
              ))}
              <Bar dataKey="Rotos" stackId="a" fill="#ef4444" />
              <Bar dataKey="Incubación" stackId="a" fill="#a855f7" />
              {totalExpected > 0 && (
                <Line type="monotone" dataKey="Proyección" stroke="#16a34a" strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="line" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : records.length === 0 ? (
          <EmptyState icon="🥚" message="No hay registros de producción" />
        ) : (
          <Table headers={["Fecha", ...sizeHeaders, "Rotos", "Incubación", "Notas", ""]}>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{new Date(r.date + "T12:00:00").toLocaleDateString("es")}</td>
                {sizeOptions.map((o) => (
                  <td key={o.id} className="px-4 py-3 text-slate-700">{r.details.find((d) => d.size === o.value)?.quantity || 0}</td>
                ))}
                <td className="px-4 py-3 text-red-600">{r.broken}</td>
                <td className="px-4 py-3 text-purple-600">{r.forIncubation}</td>
                <td className="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate">{r.notes || "—"}</td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "✏️ Editar Recolección" : "🥚 Registrar Recolección de Huevos"}>
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setQuickMode(true)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${quickMode ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
            >
              ⚡ Recogida rápida
            </button>
            <button
              type="button"
              onClick={() => setQuickMode(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${!quickMode ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
            >
              📋 Detallado
            </button>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          <Input label="Fecha de Recolección" help="Fecha en que se recogieron los huevos. Por defecto hoy." type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />

          {quickMode && !editing ? (
            <>
              <Input
                label="Total de huevos recogidos"
                help="Ingresa el total de huevos recogidos. El sistema los distribuirá automáticamente por tamaño según el promedio de tus últimos 14 registros."
                type="number"
                min="0"
                value={quickTotal}
                onChange={(e) => setQuickTotal(parseInt(e.target.value) || 0)}
              />
              {quickTotal > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-2">Se distribuirá así (según promedio reciente):</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(quickDistribution).filter(([, qty]) => qty > 0).map(([size, qty]) => (
                      <span key={size} className="px-2 py-1 bg-white rounded text-xs font-medium text-slate-700 border">
                        {size}: <strong>{qty}</strong>
                      </span>
                    ))}
                  </div>
                  {(quickBroken > 0 || quickIncub > 0) && (
                    <p className="text-xs text-slate-500 mt-2">
                      Rotos: ~{quickBroken} · Incubación: ~{quickIncub}
                    </p>
                  )}
                </div>
              )}
              {quickTotal > 0 && totalExpected > 0 && (
                <div className="p-2 bg-farm-50 rounded-lg">
                  <p className="text-xs text-slate-500">
                    Producción esperada: <strong className="text-green-700">{totalExpected}</strong> huevos/día
                    <span className={quickTotal > totalExpected * 1.5 ? " text-red-600 font-semibold" : ""}>
                      {" "}— {Math.round((quickTotal / totalExpected) * 100)}% de lo esperado
                    </span>
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {sizeOptions.map((o) => (
                  <Input
                    key={o.id}
                    label={`${o.value}${o.price ? ` ($${Number(o.price).toLocaleString()})` : ""}`}
                    help={`Cantidad de huevos tamaño ${o.value} recogidos hoy.`}
                    type="number"
                    min="0"
                    value={form.sizes[o.value] || 0}
                    onChange={(e) => setSizeQty(o.value, parseInt(e.target.value) || 0)}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Rotos / Dañados" help="Huevos que se rompieron o dañaron y no se pueden vender ni incubir." type="number" min="0" value={form.broken} onChange={(e) => setForm({ ...form, broken: parseInt(e.target.value) || 0 })} />
                <Input label="Para Incubación (seleccionados)" help="Huevos seleccionados para poner en la incubadora. Se restan del inventario disponible para venta." type="number" min="0" value={form.forIncubation} onChange={(e) => setForm({ ...form, forIncubation: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="p-3 bg-farm-50 rounded-lg">
                <p className="text-sm font-medium text-farm-700">Total a registrar: <span className="text-xl font-bold">{totalCollected}</span> huevos</p>
                {totalExpected > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Producción esperada: <strong className="text-green-700">{totalExpected}</strong> huevos/día
                    {totalCollected > 0 && (
                      <span className={totalCollected > totalExpected * 1.5 ? " text-red-600 font-semibold" : ""}>
                        {" "}— {Math.round((totalCollected / totalExpected) * 100)}% de lo esperado
                      </span>
                    )}
                  </p>
                )}
              </div>
            </>
          )}
          <Textarea label="Notas" help="Observaciones opcionales sobre esta recolección (clima, novedades, etc.)." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones de la recolección..." />
          {confirmOverLimit && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <p className="text-sm text-amber-800 font-semibold mb-1">⚠️ Producción inusualmente alta</p>
              <p className="text-xs text-amber-700 mb-3">{overLimitMsg}</p>
              <div className="flex gap-2">
                <button onClick={confirmAndSave} className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700">
                  Sí, es correcto — Guardar así
                </button>
                <button onClick={() => { setConfirmOverLimit(false); setOverLimitMsg(""); }} className="px-3 py-1.5 bg-white text-amber-700 text-xs rounded-lg border border-amber-300 hover:bg-amber-50">
                  Revisar cantidades
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={() => save()} disabled={(quickMode && !editing ? quickTotal === 0 : totalCollected === 0) || confirmOverLimit}>
              {editing ? "Actualizar Registro" : "Registrar Recolección"}
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Sale suggestion banner (Phase 2.2) */}
      {showSaleSuggestion && (
        <div className="fixed bottom-4 right-4 z-50 p-4 bg-green-50 border border-green-300 rounded-xl shadow-lg max-w-sm animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-semibold text-green-800">📦 Tienes {saleSuggestionQty} huevos disponibles</p>
            <button onClick={() => setShowSaleSuggestion(false)} className="text-green-600 hover:text-green-800 text-xs">✕</button>
          </div>
          <p className="text-xs text-green-700 mb-3">¿Quieres registrar una venta?</p>
          <div className="flex gap-2">
            <Link href="/dashboard/finanzas/ventas?quick=1">
              <Button variant="success">Vender ahora</Button>
            </Link>
            <Button variant="secondary" onClick={() => setShowSaleSuggestion(false)}>Ahora no</Button>
          </div>
        </div>
      )}
    </div>
  );
}
