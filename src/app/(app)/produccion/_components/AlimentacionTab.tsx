"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { useCatalog } from "@/lib/useCatalog";
import { apiFetch } from "@/lib/fetch";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

interface Feed {
  id: string;
  name: string;
  category: string;
  feedType: string;
  unit: string;
  currentStock: string;
  minStock: string;
  costPerUnit: string;
  supplier: string | null;
}

interface FeedProgramEntry {
  id?: string;
  feedId: string;
  feedName?: string | null;
  feedUnit?: string | null;
  percentage: string;
  dailyAmountPerHen: string;
}

interface Stage {
  id: string;
  value: string;
  minWeeks: number | null;
  maxWeeks: number | null;
  henCount: number;
  programs: FeedProgramEntry[];
}

interface Movement {
  id: string;
  feedId: string;
  feedName: string | null;
  feedUnit: string | null;
  quantity: string;
  isEntry: boolean;
  stageCatalogoId: string | null;
  stageName: string | null;
  henCount: number | null;
  date: string;
  notes: string | null;
}

interface ComparativoItem {
  feedId: string;
  feedName: string;
  plannedDaily: number;
  plannedTotal: number;
  actualTotal: number;
  entryTotal: number;
  variance: number;
  variancePercent: number;
  currentStock: number;
  costPerUnit: number;
}

interface DailyData {
  fecha: string;
  planned: Record<string, number>;
  actual: Record<string, number>;
}

const categoryLabels: Record<string, string> = {
  granja_fresco: "🌿 Granja Fresco",
  granja_procesado: "⚙️ Granja Procesado",
  suplementario: "🛒 Suplementario",
};

const feedTypeLabels: Record<string, string> = {
  mosca_soldado: "Mosca Soldado Negro",
  pastos_gramineas: "Pastos y Gramíneas",
  maiz_germinado: "Maíz Germinado",
  bore_raices: "Bore / Raíces",
  purinas: "Purinas",
  maiz_comprado: "Maíz Comprado",
  concentrado_comercial: "Concentrado Comercial",
  otro: "Otro",
};

const categoryFallback = ["granja_fresco", "granja_procesado", "suplementario"];
const feedTypeFallback = ["pastos_gramineas", "bore_raices", "mosca_soldado", "maiz_germinado", "purinas", "maiz_comprado", "concentrado_comercial", "otro"];

const stageColors: Record<string, string> = {
  Pollito: "yellow",
  Juvenil: "blue",
  "Pre-postura": "purple",
  Postura: "green",
};

interface StockProjection {
  feedId: string;
  feedName: string;
  dailyNeedKg: number;
  currentStockKg: number;
  daysRemaining: number | null;
  calculatedMinStock: number | null;
}

interface ResumenData {
  totalHens: number;
  totalExpectedEggsPerDay: number;
  stockProjection: StockProjection[];
  consumptionVsExpected: { feedId: string; feedName: string; actual7d: number; expected7d: number; variance: number }[];
}

export default function AlimentacionPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [comparativo, setComparativo] = useState<ComparativoItem[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [comparativoDays, setComparativoDays] = useState<number>(14);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inventario" | "movimientos" | "etapas" | "comparativo">("inventario");
  const [modalOpen, setModalOpen] = useState(false);
  const [movModalOpen, setMovModalOpen] = useState(false);
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editing, setEditing] = useState<Feed | null>(null);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [programEntries, setProgramEntries] = useState<FeedProgramEntry[]>([]);
  const [form, setForm] = useState({ name: "", category: "granja_fresco", feedType: "pastos_gramineas", unit: "kg", currentStock: "0", minStock: "10", costPerUnit: "0", supplier: "" });
  const [movForm, setMovForm] = useState({ feedId: "", quantity: "", isEntry: true, stageCatalogoId: "", henCount: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const [stockDays, setStockDays] = useState<number>(14);
  const { values: supplierOptions } = useCatalog("proveedor");
  const { values: unitOptions } = useCatalog("unidad_medida", ["kg", "lb", "litros"]);
  const { values: categoryOptions } = useCatalog("categoria_alimento", categoryFallback);
  const { values: feedTypeOptions } = useCatalog("tipo_alimento", feedTypeFallback);

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/alimentacion").then((r) => r.json()),
      apiFetch("/api/alimentacion/movimientos").then((r) => r.json()),
      apiFetch("/api/etapas").then((r) => r.json()),
      apiFetch(`/api/etapas/resumen?days=${stockDays}`).then((r) => r.json()),
      apiFetch(`/api/alimentacion/comparativo?days=${comparativoDays}`).then((r) => r.json()),
    ]).then(([f, m, s, r, comp]) => {
      setFeeds(f);
      setMovements(m);
      setStages(s);
      setResumen(r);
      setComparativo(comp.comparativo || []);
      setDailyData(comp.dailyData || []);
    }).finally(() => setLoading(false));
  }, [stockDays, comparativoDays]);

  useEffect(() => { load(); }, [load]);

  const openNewFeed = () => {
    setEditing(null);
    setForm({ name: "", category: "granja_fresco", feedType: "pastos_gramineas", unit: "kg", currentStock: "0", minStock: "10", costPerUnit: "0", supplier: "" });
    setModalOpen(true);
  };

  const openEditFeed = (f: Feed) => {
    setEditing(f);
    setForm({ name: f.name, category: f.category, feedType: f.feedType, unit: f.unit, currentStock: f.currentStock, minStock: f.minStock, costPerUnit: f.costPerUnit, supplier: f.supplier || "" });
    setModalOpen(true);
  };

  const saveFeed = async () => {
    const method = editing ? "PUT" : "POST";
    const body = editing ? { ...form, id: editing.id } : form;
    await apiFetch("/api/alimentacion", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setModalOpen(false);
    load();
  };

  const removeFeed = async (id: string) => {
    if (!confirm("¿Eliminar este alimento y sus movimientos?")) return;
    await apiFetch(`/api/alimentacion?id=${id}`, { method: "DELETE" });
    load();
  };

  const openMovement = () => {
    setMovForm({ feedId: feeds[0]?.id || "", quantity: "", isEntry: true, stageCatalogoId: "", henCount: "", date: new Date().toISOString().split("T")[0], notes: "" });
    setMovModalOpen(true);
  };

  const saveMovement = async () => {
    const payload: Record<string, unknown> = { ...movForm };
    if (!payload.stageCatalogoId) delete payload.stageCatalogoId;
    if (!payload.henCount) delete payload.henCount;
    await apiFetch("/api/alimentacion/movimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setMovModalOpen(false);
    load();
  };

  // Programa alimenticio
  const openProgramEditor = (stage: Stage) => {
    setEditingStage(stage);
    setProgramEntries(
      stage.programs.length > 0
        ? stage.programs.map((p) => ({ id: p.id, feedId: p.feedId, percentage: p.percentage, dailyAmountPerHen: p.dailyAmountPerHen }))
        : [{ feedId: feeds[0]?.id || "", percentage: "100", dailyAmountPerHen: "0" }]
    );
    setProgramModalOpen(true);
  };

  const addProgramEntry = () => {
    setProgramEntries([...programEntries, { feedId: feeds[0]?.id || "", percentage: "0", dailyAmountPerHen: "0" }]);
  };

  const removeProgramEntry = (idx: number) => {
    setProgramEntries(programEntries.filter((_, i) => i !== idx));
  };

  const updateProgramEntry = (idx: number, field: keyof FeedProgramEntry, value: string) => {
    const updated = [...programEntries];
    updated[idx] = { ...updated[idx], [field]: value };
    setProgramEntries(updated);
  };

  const saveProgram = async () => {
    if (!editingStage) return;
    await apiFetch(`/api/etapas/${editingStage.id}/programa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: programEntries.map(({ feedId, percentage, dailyAmountPerHen }) => ({ feedId, percentage, dailyAmountPerHen })) }),
    });
    setProgramModalOpen(false);
    load();
  };

  const lowStock = feeds.filter((f) => Number(f.currentStock) <= Number(f.minStock));
  const farmFeeds = feeds.filter((f) => f.category !== "suplementario");
  const purchasedFeeds = feeds.filter((f) => f.category === "suplementario");
  const totalHens = stages.reduce((sum, s) => sum + s.henCount, 0);

  return (
    <div>
      <PageHeader
        title="🌾 Gestión de Alimentación"
        description="Alimentos, etapas de crecimiento y programas de alimentación por etapa"
        actions={
          <div className="flex gap-2">
            <Button onClick={openNewFeed}>+ Nuevo Alimento</Button>
            <Button variant="success" onClick={openMovement}>📦 Registrar Movimiento</Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon="🌿" label="Alimentos de Granja" value={farmFeeds.length} color="green" />
        <StatCard icon="🛒" label="Suplementarios" value={purchasedFeeds.length} color="blue" />
        <StatCard icon="⚠️" label="Stock Bajo" value={lowStock.length} color={lowStock.length > 0 ? "red" : "green"} />
        <StatCard icon="📦" label="Movimientos" value={movements.length} color="purple" />
        <StatCard icon="🐔" label="Gallinas en Producción" value={totalHens} color="green" />
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <h3 className="font-semibold text-red-700 mb-2">⚠️ Alertas de Stock Bajo</h3>
          <div className="space-y-1">
            {lowStock.map((f) => (
              <p key={f.id} className="text-sm text-red-600">
                <strong>{f.name}</strong> — Stock: {f.currentStock} {f.unit} (mínimo: {f.minStock} {f.unit})
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setTab("inventario")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "inventario" ? "bg-green-600 text-white" : "bg-white text-slate-600 border"}`}>
          📋 Inventario
        </button>
        <button onClick={() => setTab("movimientos")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "movimientos" ? "bg-green-600 text-white" : "bg-white text-slate-600 border"}`}>
          📦 Movimientos
        </button>
        <button onClick={() => setTab("etapas")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "etapas" ? "bg-green-600 text-white" : "bg-white text-slate-600 border"}`}>
          📊 Etapas y Programas
        </button>
        <button onClick={() => setTab("comparativo")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "comparativo" ? "bg-green-600 text-white" : "bg-white text-slate-600 border"}`}>
          📈 Planificado vs Real
        </button>
      </div>

      {/* Tab: Inventario */}
      {tab === "inventario" && (
        <Card>
          {loading ? (
            <p className="text-center py-8 text-slate-400">Cargando...</p>
          ) : feeds.length === 0 ? (
            <EmptyState icon="🌾" message="No hay alimentos registrados" />
          ) : (
            <Table headers={["Alimento", "Categoría", "Tipo", "Stock", "Mín.", "Costo/Unidad", "Proveedor", "Acciones"]}>
              {feeds.map((f) => (
                <tr key={f.id} className={`hover:bg-slate-50 ${Number(f.currentStock) <= Number(f.minStock) ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3 font-semibold">{f.name}</td>
                  <td className="px-4 py-3 text-sm">{categoryLabels[f.category] || f.category}</td>
                  <td className="px-4 py-3 text-sm">{feedTypeLabels[f.feedType] || f.feedType}</td>
                  <td className="px-4 py-3 font-semibold">{f.currentStock} {f.unit}</td>
                  <td className="px-4 py-3 text-sm">{f.minStock} {f.unit}</td>
                  <td className="px-4 py-3">${f.costPerUnit}</td>
                  <td className="px-4 py-3 text-sm">{f.supplier || "Producción propia"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEditFeed(f)} className="text-blue-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => removeFeed(f.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* Tab: Movimientos */}
      {tab === "movimientos" && (
        <Card>
          {movements.length === 0 ? (
            <EmptyState icon="📦" message="No hay movimientos registrados" />
          ) : (
            <Table headers={["Fecha", "Alimento", "Tipo", "Etapa", "Gallinas", "Cantidad", "Notas"]}>
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{new Date(m.date + "T12:00:00").toLocaleDateString("es")}</td>
                  <td className="px-4 py-3 font-medium">{m.feedName || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge color={m.isEntry ? "green" : "red"}>{m.isEntry ? "📥 Entrada" : "📤 Consumo"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {m.stageName ? <Badge color={stageColors[m.stageName] || "gray"}>{m.stageName}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">{m.henCount ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">{m.quantity} {m.feedUnit || ""}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.notes || "—"}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* Tab: Etapas y Programas */}
      {tab === "etapas" && (
        <div className="space-y-4">
          {stages.length === 0 ? (
            <Card>
              <EmptyState icon="📊" message="No hay etapas de crecimiento definidas" />
            </Card>
          ) : (
            stages.map((stage) => {
              const totalPercentage = stage.programs.reduce((s, p) => s + Number(p.percentage), 0);
              const totalGrams = stage.programs.reduce((s, p) => s + Number(p.dailyAmountPerHen), 0);
              const totalDailyKg = (stage.henCount * totalGrams / 1000).toFixed(1);

              return (
                <Card key={stage.id}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Badge color={stageColors[stage.value] || "gray"}>{stage.value}</Badge>
                      <span className="text-sm text-slate-500">
                        {stage.minWeeks}–{stage.maxWeeks ? `${stage.maxWeeks} sem` : "+ sem"}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">
                        🐔 {stage.henCount} gallina{stage.henCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Button onClick={() => openProgramEditor(stage)}>
                      ✏️ Editar Programa
                    </Button>
                  </div>

                  {stage.programs.length === 0 ? (
                    <p className="text-sm text-slate-400 py-2">Sin programa alimenticio definido</p>
                  ) : (
                    <div>
                      <Table headers={["Alimento", "% Dieta", "g/gallina/día", `Total/día (${stage.henCount} aves)`]}>
                        {stage.programs.map((p) => (
                          <tr key={p.id || p.feedId} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-medium">{p.feedName || "—"}</td>
                            <td className="px-4 py-2">{p.percentage}%</td>
                            <td className="px-4 py-2">{p.dailyAmountPerHen} g</td>
                            <td className="px-4 py-2 font-semibold">{((Number(p.dailyAmountPerHen) * stage.henCount) / 1000).toFixed(2)} kg</td>
                          </tr>
                        ))}
                        <tr className="border-t font-semibold bg-slate-50">
                          <td className="px-4 py-2">TOTAL</td>
                          <td className="px-4 py-2">{totalPercentage}%</td>
                          <td className="px-4 py-2">{totalGrams} g</td>
                          <td className="px-4 py-2">{totalDailyKg} kg</td>
                        </tr>
                      </Table>
                    </div>
                  )}
                </Card>
              );
            })
          )}

          {/* Stock Projection */}
          {resumen && resumen.stockProjection.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-700">📦 Proyección de Stock (según gallinas por etapa)</h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">Días de stock mínimo:</label>
                  <select
                    value={stockDays}
                    onChange={(e) => setStockDays(Number(e.target.value))}
                    className="border rounded-lg px-3 py-1.5 text-sm font-medium"
                  >
                    <option value={7}>7 días</option>
                    <option value={14}>14 días</option>
                    <option value={21}>21 días</option>
                    <option value={30}>30 días</option>
                    <option value={45}>45 días</option>
                    <option value={60}>60 días</option>
                  </select>
                </div>
              </div>
              <Table headers={["Alimento", "Stock Actual", "Consumo/día", "Días Restantes", `Mín. (${stockDays}d)`, "Acción"]}>
                {resumen.stockProjection.map((item) => {
                  const isCritical = item.daysRemaining !== null && item.daysRemaining <= 7;
                  const isWarning = item.daysRemaining !== null && item.daysRemaining > 7 && item.daysRemaining <= 14;
                  const currentMin = Number(feeds.find((f) => f.id === item.feedId)?.minStock || 0);
                  const calcMin = item.calculatedMinStock || 0;
                  const needsUpdate = Math.abs(currentMin - calcMin) > 0.5;
                  return (
                    <tr key={item.feedId} className={isCritical ? "bg-red-50" : isWarning ? "bg-yellow-50" : ""}>
                      <td className="px-4 py-2 font-medium">{item.feedName}</td>
                      <td className="px-4 py-2">{item.currentStockKg} kg</td>
                      <td className="px-4 py-2">{item.dailyNeedKg} kg/día</td>
                      <td className="px-4 py-2">
                        <span className={`font-bold ${isCritical ? "text-red-600" : isWarning ? "text-yellow-600" : "text-green-600"}`}>
                          {item.daysRemaining !== null ? `${item.daysRemaining} días` : "Sin consumo"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-blue-600">{calcMin} kg</span>
                          {needsUpdate && (
                            <span className="text-xs text-orange-600">(actual: {currentMin} kg)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {needsUpdate && (
                          <button
                            onClick={async () => {
                              const feed = feeds.find((f) => f.id === item.feedId);
                              if (!feed) return;
                              await apiFetch("/api/alimentacion", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: item.feedId, minStock: String(calcMin) }),
                              });
                              load();
                            }}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                          >
                            Actualizar mín.
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            </Card>
          )}

          {/* Consumption vs Expected */}
          {resumen && resumen.consumptionVsExpected.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-3">📊 Consumo Real vs Esperado (últimos 7 días)</h3>
              <Table headers={["Alimento", "Esperado (7d)", "Real (7d)", "Diferencia"]}>
                {resumen.consumptionVsExpected.map((item) => (
                  <tr key={item.feedId} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{item.feedName}</td>
                    <td className="px-4 py-2">{item.expected7d} kg</td>
                    <td className="px-4 py-2">{item.actual7d} kg</td>
                    <td className="px-4 py-2">
                      <span className={`font-bold ${item.variance > 0 ? "text-red-600" : item.variance < 0 ? "text-green-600" : "text-slate-500"}`}>
                        {item.variance > 0 ? "+" : ""}{item.variance} kg
                      </span>
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Comparativo */}
      {tab === "comparativo" && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700">📈 Consumo Planificado vs Real</h3>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Período:</label>
                <select
                  value={comparativoDays}
                  onChange={(e) => setComparativoDays(Number(e.target.value))}
                  className="border rounded-lg px-3 py-1.5 text-sm font-medium"
                >
                  <option value={7}>7 días</option>
                  <option value={14}>14 días</option>
                  <option value={21}>21 días</option>
                  <option value={30}>30 días</option>
                </select>
              </div>
            </div>

            {comparativo.length === 0 ? (
              <EmptyState icon="📈" message="No hay datos de comparativo disponibles" />
            ) : (
              <>
                <Table headers={["Alimento", "Planificado/día", `Planificado (${comparativoDays}d)`, `Real (${comparativoDays}d)`, "Entradas", "Diferencia", "%", "Stock", "Costo/kg"]}>
                  {comparativo.map((item) => {
                    const isOver = item.variance > 0;
                    const isUnder = item.variance < 0;
                    return (
                      <tr key={item.feedId} className={`hover:bg-slate-50 ${isUnder ? "bg-orange-50" : isOver ? "bg-blue-50" : ""}`}>
                        <td className="px-4 py-2 font-medium">{item.feedName}</td>
                        <td className="px-4 py-2">{item.plannedDaily} kg</td>
                        <td className="px-4 py-2">{item.plannedTotal} kg</td>
                        <td className="px-4 py-2 font-semibold">{item.actualTotal} kg</td>
                        <td className="px-4 py-2 text-green-600">{item.entryTotal} kg</td>
                        <td className="px-4 py-2">
                          <span className={`font-bold ${isUnder ? "text-orange-600" : isOver ? "text-blue-600" : "text-slate-500"}`}>
                            {item.variance > 0 ? "+" : ""}{item.variance} kg
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-sm font-semibold ${item.variancePercent > 10 ? "text-red-600" : item.variancePercent < -10 ? "text-orange-600" : "text-green-600"}`}>
                            {item.variancePercent > 0 ? "+" : ""}{item.variancePercent}%
                          </span>
                        </td>
                        <td className="px-4 py-2">{item.currentStock} kg</td>
                        <td className="px-4 py-2">${item.costPerUnit.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </Table>
              </>
            )}
          </Card>

          {/* Chart: Daily planned vs actual */}
          {dailyData.length > 0 && (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-3">📊 Consumo Diario: Planificado vs Real</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" fontSize={11} />
                  <YAxis fontSize={11} label={{ value: "kg", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Legend />
                  {comparativo.map((item, idx) => {
                    const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
                    const color = colors[idx % colors.length];
                    return [
                      <Line key={`p-${item.feedId}`} type="monotone" dataKey={(d: DailyData) => d.planned[item.feedId] || 0} stroke={color} strokeDasharray="5 5" name={`${item.feedName} (plan)`} dot={false} />,
                      <Line key={`a-${item.feedId}`} type="monotone" dataKey={(d: DailyData) => d.actual[item.feedId] || 0} stroke={color} name={`${item.feedName} (real)`} dot={{ r: 3 }} />,
                    ];
                  })}
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-slate-500 mt-2">Líneas punteadas = planificado | Líneas sólidas = real</p>
            </Card>
          )}

          {/* Summary stats */}
          {comparativo.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <p className="text-sm text-slate-500">Total Planificado</p>
                <p className="text-2xl font-bold text-blue-600">{comparativo.reduce((s, c) => s + c.plannedTotal, 0).toFixed(1)} kg</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Total Consumido</p>
                <p className="text-2xl font-bold text-green-600">{comparativo.reduce((s, c) => s + c.actualTotal, 0).toFixed(1)} kg</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Total Entradas (Compras)</p>
                <p className="text-2xl font-bold text-purple-600">{comparativo.reduce((s, c) => s + c.entryTotal, 0).toFixed(1)} kg</p>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* New/Edit Feed Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar Alimento" : "Nuevo Alimento"}>
        <div className="space-y-4">
          <Input label="Nombre del Alimento" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Larvas de BSF deshidratadas" required />
          <Select label="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {categoryOptions.map((c) => <option key={c} value={c}>{categoryLabels[c] || c}</option>)}
          </Select>
          <Select label="Tipo de Alimento" value={form.feedType} onChange={(e) => setForm({ ...form, feedType: e.target.value })}>
            {feedTypeOptions.map((t) => <option key={t} value={t}>{feedTypeLabels[t] || t}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Unidad de medida" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Input label="Stock actual" type="number" step="0.01" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Stock mínimo" type="number" step="0.01" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            <Input label="Costo por unidad ($)" type="number" step="0.01" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} />
          </div>
          <Input label="Proveedor (vacío si es producción propia)" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Nombre del proveedor" list="catalog-proveedores" />
          <datalist id="catalog-proveedores">
            {supplierOptions.map((s) => <option key={s} value={s} />)}
          </datalist>
          <div className="flex gap-3">
            <Button onClick={saveFeed} disabled={!form.name}>{editing ? "Actualizar" : "Registrar"}</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Movement Modal */}
      <Modal open={movModalOpen} onClose={() => setMovModalOpen(false)} title="Registrar Movimiento de Alimento">
        <div className="space-y-4">
          <Select label="Alimento" value={movForm.feedId} onChange={(e) => setMovForm({ ...movForm, feedId: e.target.value })}>
            {feeds.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.currentStock} {f.unit})</option>)}
          </Select>
          <Select label="Tipo de Movimiento" value={movForm.isEntry ? "true" : "false"} onChange={(e) => setMovForm({ ...movForm, isEntry: e.target.value === "true" })}>
            <option value="true">📥 Entrada (compra / producción)</option>
            <option value="false">📤 Salida (consumo diario)</option>
          </Select>
          {movForm.isEntry === false && stages.length > 0 && (
            <>
              <Select label="Etapa destino (grupo)" value={movForm.stageCatalogoId} onChange={(e) => {
                const stageId = e.target.value;
                const stage = stages.find((s) => s.id === stageId);
                setMovForm({ ...movForm, stageCatalogoId: stageId, henCount: stage ? String(stage.henCount) : "" });
              }}>
                <option value="">— Sin etapa —</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.value} ({s.henCount} gallinas)</option>)}
              </Select>
              <Input label="Gallinas en el grupo" type="number" value={movForm.henCount} onChange={(e) => setMovForm({ ...movForm, henCount: e.target.value })} placeholder="Ej: 5" />
            </>
          )}
          <Input label="Cantidad" type="number" step="0.01" value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: e.target.value })} placeholder="Ej: 5.5" />
          <Input label="Fecha" type="date" value={movForm.date} onChange={(e) => setMovForm({ ...movForm, date: e.target.value })} />
          <Textarea label="Notas" value={movForm.notes} onChange={(e) => setMovForm({ ...movForm, notes: e.target.value })} placeholder="Detalles del movimiento..." />
          <div className="flex gap-3">
            <Button onClick={saveMovement} disabled={!movForm.feedId || !movForm.quantity}>Registrar</Button>
            <Button variant="secondary" onClick={() => setMovModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>

      {/* Program Editor Modal */}
      <Modal open={programModalOpen} onClose={() => setProgramModalOpen(false)} title={`Programa: ${editingStage?.value || ""}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Define los alimentos, porcentajes y cantidad diaria por gallina para la etapa{" "}
            <strong>{editingStage?.value}</strong> ({editingStage?.minWeeks}–{editingStage?.maxWeeks ? `${editingStage.maxWeeks} sem` : "+ sem"}).
          </p>

          <div className="space-y-3">
            {programEntries.map((entry, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Alimento</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={entry.feedId}
                    onChange={(e) => updateProgramEntry(idx, "feedId", e.target.value)}
                  >
                    {feeds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-slate-600 mb-1">% Dieta</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={entry.percentage}
                    onChange={(e) => updateProgramEntry(idx, "percentage", e.target.value)}
                  />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-slate-600 mb-1">g/ave/día</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={entry.dailyAmountPerHen}
                    onChange={(e) => updateProgramEntry(idx, "dailyAmountPerHen", e.target.value)}
                  />
                </div>
                <button
                  onClick={() => removeProgramEntry(idx)}
                  className="text-red-500 hover:text-red-700 text-sm pb-2"
                  disabled={programEntries.length <= 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button onClick={addProgramEntry} className="text-sm text-green-600 hover:underline">
            + Agregar alimento
          </button>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveProgram}>Guardar Programa</Button>
            <Button variant="secondary" onClick={() => setProgramModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
