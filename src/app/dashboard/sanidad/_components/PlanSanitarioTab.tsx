"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState, StatCard } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";

// ─── Types ───
interface ProtocolAction {
  weekOffset: number;
  type: string;
  name: string;
  description: string;
  frequencyDays: number | null;
  withdrawalDays: number;
  supplyCategory: string | null;
}

interface StageData {
  id: string;
  value: string;
  minWeeks: number | null;
  maxWeeks: number | null;
  henCount: number;
  protocol: ProtocolAction[];
}

interface CalendarEvent {
  id: string;
  type: string;
  name: string;
  description: string | null;
  targetBirds: string | null;
  targetStageId: string | null;
  frequencyDays: number | null;
  nextDueDate: string;
  withdrawalDays: number | null;
  isActive: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  daysUntilDue: number;
  supplyCategory: string | null;
  availableSupplies: { id: string; name: string; currentStock: number; unit: string; minStock: number }[];
}

interface SupplyStatus {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  isLow: boolean;
  isCritical: boolean;
}

interface HealthRecord {
  id: string;
  date: string;
  type: string;
  description: string;
  affectedHens: string | null;
  product: string | null;
  cost: string | null;
  nextScheduled: string | null;
  notes: string | null;
}

interface PlanSummary {
  totalActiveEvents: number;
  overdueCount: number;
  upcomingCount: number;
  executedLast30d: number;
  costLast30d: number;
  lowSupplyCount: number;
  compliancePercent: number;
}

interface PlanData {
  stages: StageData[];
  protocols: Record<string, ProtocolAction[]>;
  calendarEvents: CalendarEvent[];
  upcomingActions: CalendarEvent[];
  overdueActions: CalendarEvent[];
  supplyStatus: SupplyStatus[];
  recentExecutions: HealthRecord[];
  summary: PlanSummary;
}

const TYPE_LABELS: Record<string, string> = {
  vacunacion: "💉 Vacunación",
  desparasitacion: "🪱 Desparasitación",
  inspeccion: "🔍 Inspección",
  tratamiento: "💊 Tratamiento",
  vitaminas: "💧 Vitaminas",
  fumigacion: "🧪 Fumigación",
  limpieza: "🧹 Limpieza",
  otro: "📋 Otro",
};

const TYPE_COLORS: Record<string, string> = {
  vacunacion: "blue",
  desparasitacion: "purple",
  inspeccion: "green",
  tratamiento: "red",
  vitaminas: "yellow",
  fumigacion: "orange",
  limpieza: "earth",
  otro: "gray",
};

const stageColors: Record<string, string> = {
  Pollito: "yellow",
  Juvenil: "blue",
  "Pre-postura": "purple",
  Postura: "green",
};

const supplyCategoryLabels: Record<string, string> = {
  medicamento: "💊 Medicamentos/Vacunas",
  antiparasitario: "🪱 Antiparasitarios",
  vitamina: "💧 Vitaminas/Suplementos",
  insumo_limpieza: "🧹 Insumos de limpieza",
};

export default function PlanSanitarioTab() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"plan" | "protocolos" | "ejecutar" | "historial" | "recursos">("plan");
  const [execModalOpen, setExecModalOpen] = useState(false);
  const [execEvent, setExecEvent] = useState<CalendarEvent | null>(null);
  const [execForm, setExecForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    affectedHens: "todas",
    product: "",
    cost: "0",
    notes: "",
  });
  const [execError, setExecError] = useState("");
  const [execSuccess, setExecSuccess] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [seedStage, setSeedStage] = useState("");
  const [seedDate, setSeedDate] = useState(new Date().toISOString().split("T")[0]);
  const [planDays, setPlanDays] = useState(30);
  const [upcomingSearch, setUpcomingSearch] = useState("");
  const [protocolSearch, setProtocolSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [supplySearch, setSupplySearch] = useState("");

  const load = useCallback(() => {
    apiFetch(`/api/sanidad/plan?days=${planDays}`)
      .then((r) => r.json())
      .then(setPlan)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [planDays]);

  useEffect(() => { load(); }, [load]);

  const filteredUpcoming = useMemo(() => {
    const actions = plan?.upcomingActions ?? [];
    if (!upcomingSearch.trim()) return actions;
    return actions.filter((action) =>
      matchesTextQuery(upcomingSearch, [
        action.nextDueDate,
        action.type,
        TYPE_LABELS[action.type] || action.type,
        action.name,
        action.description,
        action.targetBirds,
        action.frequencyDays ? `cada ${action.frequencyDays}d` : "unico",
        action.withdrawalDays ? `retiro ${action.withdrawalDays}d` : "",
        action.supplyCategory
          ? supplyCategoryLabels[action.supplyCategory] || action.supplyCategory
          : "",
        action.daysUntilDue <= 7 ? "esta semana" : `en ${action.daysUntilDue}d`,
      ]),
    );
  }, [plan, upcomingSearch]);

  const filteredProtocolsByStage = useMemo(() => {
    const map: Record<string, ProtocolAction[]> = {};
    for (const stage of plan?.stages ?? []) {
      map[stage.id] = !protocolSearch.trim()
        ? stage.protocol
        : stage.protocol.filter((action) =>
            matchesTextQuery(protocolSearch, [
              `sem ${action.weekOffset}`,
              action.weekOffset,
              action.type,
              TYPE_LABELS[action.type] || action.type,
              action.name,
              action.description,
              action.frequencyDays ? `cada ${action.frequencyDays}d` : "unico",
              action.withdrawalDays,
              action.supplyCategory
                ? supplyCategoryLabels[action.supplyCategory] || action.supplyCategory
                : "",
            ]),
          );
    }
    return map;
  }, [plan, protocolSearch]);

  const filteredExecutions = useMemo(() => {
    const executions = plan?.recentExecutions ?? [];
    if (!historySearch.trim()) return executions;
    return executions.filter((record) =>
      matchesTextQuery(historySearch, [
        record.date,
        new Date(record.date + "T12:00:00").toLocaleDateString("es"),
        record.type,
        TYPE_LABELS[record.type] || record.type,
        record.description,
        record.affectedHens,
        record.product,
        record.cost,
        record.notes,
      ]),
    );
  }, [plan, historySearch]);

  const filteredSupplies = useMemo(() => {
    const supplies = plan?.supplyStatus ?? [];
    if (!supplySearch.trim()) return supplies;
    return supplies.filter((supply) =>
      matchesTextQuery(supplySearch, [
        supply.name,
        supply.category,
        supplyCategoryLabels[supply.category] || supply.category,
        supply.unit,
        supply.currentStock,
        supply.minStock,
        supply.costPerUnit,
        supply.isCritical ? "critico" : supply.isLow ? "bajo" : "ok",
      ]),
    );
  }, [plan, supplySearch]);

  // ─── Execute action ───
  const openExecute = (event: CalendarEvent) => {
    setExecEvent(event);
    setExecForm({
      date: new Date().toISOString().split("T")[0],
      description: `${event.name}${event.description ? ` — ${event.description}` : ""}`,
      affectedHens: event.targetBirds || "todas",
      product: event.availableSupplies.length > 0 ? event.availableSupplies[0].name : "",
      cost: "0",
      notes: "",
    });
    setExecError("");
    setExecSuccess(false);
    setExecModalOpen(true);
  };

  const executeAction = async () => {
    if (!execEvent) return;
    setExecError("");

    // Create health control record
    const res = await apiFetch("/api/sanidad/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: execForm.date,
        type: execEvent.type,
        description: execForm.description,
        affectedHens: execForm.affectedHens,
        product: execForm.product,
        cost: execForm.cost,
        nextScheduled: "",
        notes: execForm.notes,
      }),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setExecError(d.error || "Error al registrar");
      return;
    }

    // Advance calendar event
    if (execEvent.frequencyDays) {
      const nextDate = new Date(execEvent.nextDueDate + "T12:00:00");
      nextDate.setDate(nextDate.getDate() + execEvent.frequencyDays);
      await apiFetch("/api/sanidad/calendario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: execEvent.id, nextDueDate: nextDate.toISOString().split("T")[0] }),
      });
    } else {
      // Deactivate one-time event
      await apiFetch(`/api/sanidad/calendario?id=${execEvent.id}`, { method: "DELETE" });
    }

    setExecSuccess(true);
    load();
  };

  // ─── Seed protocol events ───
  const seedProtocol = async () => {
    if (!seedStage) return;
    await apiFetch("/api/sanidad/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageName: seedStage, startDate: seedDate, targetBirds: "todas" }),
    });
    setSeedModalOpen(false);
    load();
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="text-5xl mb-4 animate-bounce">💊</div>
        <p>Cargando plan sanitario...</p>
      </div>
    );
  }

  if (!plan) {
    return <p className="text-red-500 text-center py-8">Error cargando plan sanitario</p>;
  }

  const { stages, protocols, overdueActions, upcomingActions, supplyStatus, recentExecutions, summary } = plan;

  return (
    <div>
      <PageHeader
        title="💊 Plan Sanitario"
        description="Plan sanitario proactivo: protocolos por etapa, acciones programadas y recursos necesarios"
        help="El Plan Sanitario es tu sistema proactivo de salud para la parvada.\n\n• Plan de Acción: muestra las acciones pendientes organizadas por urgencia.\n• Protocolos por Etapa: define qué acciones sanitarias corresponden a cada etapa de crecimiento.\n• Ejecutar: registra la aplicación de cada acción, confirmando los recursos utilizados.\n• Historial: registro completo de todas las acciones sanitarias ejecutadas.\n• Recursos: estado del inventario de insumos sanitarios (medicamentos, vacunas, antiparasitarios).\n\nEl sistema genera automáticamente eventos en el calendario según los protocolos definidos."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => { setSeedStage(stages[0]?.value || ""); setSeedModalOpen(true); }}>
              📋 Generar desde Protocolo
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon="📋" label="Eventos Activos" value={summary.totalActiveEvents} color="blue" />
        <StatCard icon="🔴" label="Vencidos" value={summary.overdueCount} color={summary.overdueCount > 0 ? "red" : "green"} />
        <StatCard icon="📅" label="Próximos" value={summary.upcomingCount} color="yellow" />
        <StatCard icon="✅" label="Ejecutados (30d)" value={summary.executedLast30d} color="green" />
        <StatCard icon="💰" label="Costo (30d)" value={`$${summary.costLast30d.toLocaleString()}`} color="purple" />
        <StatCard icon="📊" label="Cumplimiento" value={`${summary.compliancePercent}%`} color={summary.compliancePercent >= 80 ? "green" : summary.compliancePercent >= 50 ? "yellow" : "red"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setTab("plan")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "plan" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border"}`}>
          📋 Plan de Acción
        </button>
        <button onClick={() => setTab("protocolos")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "protocolos" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border"}`}>
          📊 Protocolos por Etapa
        </button>
        <button onClick={() => setTab("ejecutar")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "ejecutar" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border"}`}>
          ⚡ Ejecutar
          {overdueActions.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{overdueActions.length}</span>}
        </button>
        <button onClick={() => setTab("historial")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "historial" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border"}`}>
          📜 Historial
        </button>
        <button onClick={() => setTab("recursos")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "recursos" ? "bg-blue-600 text-white" : "bg-white text-slate-600 border"}`}>
          🧰 Recursos
          {summary.lowSupplyCount > 0 && <span className="ml-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">{summary.lowSupplyCount}</span>}
        </button>
      </div>

      {/* ─── Tab: Plan de Acción ─── */}
      {tab === "plan" && (
        <div className="space-y-4">
          {/* Overdue actions */}
          {overdueActions.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <h3 className="font-semibold text-red-700 mb-3">🔴 Acciones Vencidas — Requieren Atención Inmediata</h3>
              <div className="space-y-2">
                {overdueActions.map((e) => (
                  <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-lg border border-red-100">
                    <div className="flex items-center gap-3">
                      <Badge color="red">{TYPE_LABELS[e.type] || e.type}</Badge>
                      <div>
                        <p className="font-medium text-sm">{e.name}</p>
                        <p className="text-xs text-slate-500">{e.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-red-600">{Math.abs(e.daysUntilDue)}d vencido</span>
                      {e.availableSupplies.length > 0 ? (
                        <span className="text-xs text-green-600">✅ Recursos disponibles</span>
                      ) : (
                        <span className="text-xs text-orange-600">⚠️ Verificar recursos</span>
                      )}
                      <button onClick={() => openExecute(e)} className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700">
                        Ejecutar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Upcoming actions by period */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700">📅 Próximas Acciones Programadas</h3>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Horizonte:</label>
                <select value={planDays} onChange={(e) => setPlanDays(Number(e.target.value))} className="border rounded-lg px-3 py-1.5 text-sm font-medium">
                  <option value={7}>7 días</option>
                  <option value={14}>14 días</option>
                  <option value={30}>30 días</option>
                  <option value={60}>60 días</option>
                  <option value={90}>90 días</option>
                </select>
              </div>
            </div>
            <TableSearch
              value={upcomingSearch}
              onChange={setUpcomingSearch}
              placeholder="Buscar por fecha, acción o recurso..."
              resultCount={filteredUpcoming.length}
              totalCount={upcomingActions.length}
              className="mb-4"
            />
            {filteredUpcoming.length === 0 ? (
              <EmptyState
                icon="✅"
                message={
                  upcomingSearch.trim()
                    ? "No hay acciones que coincidan con la búsqueda"
                    : "No hay acciones programadas en este período"
                }
              />
            ) : (
              <Table headers={["Fecha", "Tipo", "Acción", "Objetivo", "Frecuencia", "Recursos", "Estado", ""]}>
                {filteredUpcoming.map((e) => {
                  const thisWeek = e.daysUntilDue <= 7;
                  return (
                    <tr key={e.id} className={`hover:bg-slate-50 ${thisWeek ? "bg-yellow-50" : ""}`}>
                      <td className="px-4 py-3 text-sm font-medium">{e.nextDueDate}</td>
                      <td className="px-4 py-3"><Badge color={TYPE_COLORS[e.type] || "gray"}>{TYPE_LABELS[e.type] || e.type}</Badge></td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium">{e.name}</span>
                        {e.description && <p className="text-xs text-slate-500 mt-0.5 max-w-[200px] truncate">{e.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{e.targetBirds || "todas"}</td>
                      <td className="px-4 py-3 text-sm">{e.frequencyDays ? `Cada ${e.frequencyDays}d` : "Único"}</td>
                      <td className="px-4 py-3">
                        {e.availableSupplies.length > 0 ? (
                          <span className="text-xs text-green-600 font-medium">✅ {e.availableSupplies[0].name} ({e.availableSupplies[0].currentStock} {e.availableSupplies[0].unit})</span>
                        ) : e.supplyCategory ? (
                          <span className="text-xs text-orange-600">⚠️ Sin stock de {supplyCategoryLabels[e.supplyCategory] || e.supplyCategory}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {thisWeek ? (
                          <Badge color="yellow">Esta semana</Badge>
                        ) : (
                          <Badge color="green">En {e.daysUntilDue}d</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openExecute(e)} className="text-blue-600 hover:underline text-xs font-medium">
                          Ejecutar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Card>

          {/* Compliance summary */}
          <Card>
            <h3 className="font-semibold text-slate-700 mb-3">📊 Cumplimiento del Plan</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-slate-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${summary.compliancePercent >= 80 ? "bg-green-500" : summary.compliancePercent >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${summary.compliancePercent}%` }}
                />
              </div>
              <span className={`text-lg font-bold ${summary.compliancePercent >= 80 ? "text-green-600" : summary.compliancePercent >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                {summary.compliancePercent}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Porcentaje de eventos sanitarios al día sobre el total de eventos activos.
            </p>
          </Card>
        </div>
      )}

      {/* ─── Tab: Protocolos por Etapa ─── */}
      {tab === "protocolos" && (
        <div className="space-y-4">
          <TableSearch
            value={protocolSearch}
            onChange={setProtocolSearch}
            placeholder="Buscar por acción, tipo o recurso..."
            resultCount={Object.values(filteredProtocolsByStage).reduce((sum, actions) => sum + actions.length, 0)}
            totalCount={stages.reduce((sum, stage) => sum + stage.protocol.length, 0)}
          />
          {stages.length === 0 ? (
            <Card>
              <EmptyState icon="📊" message="No hay etapas de crecimiento definidas" />
            </Card>
          ) : (
            stages.map((stage) => (
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
                  <Button onClick={() => { setSeedStage(stage.value); setSeedModalOpen(true); }}>
                    📋 Generar Eventos
                  </Button>
                </div>

                {(filteredProtocolsByStage[stage.id] ?? []).length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">
                    {stage.protocol.length === 0
                      ? "Sin protocolo sanitario definido para esta etapa"
                      : "Sin acciones que coincidan con la búsqueda en esta etapa"}
                  </p>
                ) : (
                  <Table headers={["Semana", "Tipo", "Acción", "Descripción", "Frecuencia", "Retiro", "Recurso Esperado"]}>
                    {(filteredProtocolsByStage[stage.id] ?? []).map((action, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-sm font-medium">Sem {action.weekOffset}</td>
                        <td className="px-4 py-2"><Badge color={TYPE_COLORS[action.type] || "gray"}>{TYPE_LABELS[action.type] || action.type}</Badge></td>
                        <td className="px-4 py-2 text-sm font-semibold">{action.name}</td>
                        <td className="px-4 py-2 text-sm text-slate-500 max-w-[200px]">{action.description}</td>
                        <td className="px-4 py-2 text-sm">{action.frequencyDays ? `Cada ${action.frequencyDays}d` : "Único"}</td>
                        <td className="px-4 py-2 text-sm">{action.withdrawalDays > 0 ? `${action.withdrawalDays}d` : "—"}</td>
                        <td className="px-4 py-2 text-sm">
                          {action.supplyCategory ? (
                            <span className="text-blue-600">{supplyCategoryLabels[action.supplyCategory] || action.supplyCategory}</span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* ─── Tab: Ejecutar ─── */}
      {tab === "ejecutar" && (
        <div className="space-y-4">
          {/* Pending actions to execute */}
          {(overdueActions.length > 0 || upcomingActions.some((e) => e.daysUntilDue <= 7)) ? (
            <Card>
              <h3 className="font-semibold text-slate-700 mb-3">⚡ Acciones Pendientes de Ejecución</h3>
              <p className="text-sm text-slate-500 mb-4">
                Haz clic en &quot;Ejecutar&quot; para registrar la aplicación. El sistema verificará los recursos disponibles y actualizará el calendario.
              </p>
              <div className="space-y-3">
                {[...overdueActions, ...upcomingActions.filter((e) => e.daysUntilDue <= 7)].map((e) => (
                  <div key={e.id} className={`p-4 rounded-lg border ${e.isOverdue ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge color={e.isOverdue ? "red" : "yellow"}>{TYPE_LABELS[e.type] || e.type}</Badge>
                          <span className="font-semibold text-sm">{e.name}</span>
                          {e.isOverdue && <span className="text-xs text-red-600 font-bold">VENCIDO</span>}
                        </div>
                        <p className="text-xs text-slate-500">{e.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-slate-500">📅 {e.nextDueDate}</span>
                          {e.withdrawalDays && e.withdrawalDays > 0 && (
                            <span className="text-xs text-orange-600">⏱️ Retiro: {e.withdrawalDays}d</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {/* Resource status */}
                        {e.availableSupplies.length > 0 ? (
                          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            ✅ {e.availableSupplies.map((s) => `${s.name} (${s.currentStock} ${s.unit})`).join(", ")}
                          </div>
                        ) : e.supplyCategory ? (
                          <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                            ⚠️ Sin stock: {supplyCategoryLabels[e.supplyCategory] || e.supplyCategory}
                          </div>
                        ) : null}
                        <button
                          onClick={() => openExecute(e)}
                          className={`px-4 py-2 text-white text-sm font-medium rounded-lg ${e.isOverdue ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
                        >
                          ⚡ Ejecutar Acción
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState icon="✅" message="No hay acciones pendientes de ejecución" />
            </Card>
          )}
        </div>
      )}

      {/* ─── Tab: Historial ─── */}
      {tab === "historial" && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-3">📜 Historial de Acciones Sanitarias</h3>
          <TableSearch
            value={historySearch}
            onChange={setHistorySearch}
            placeholder="Buscar por fecha, tipo, producto o notas..."
            resultCount={filteredExecutions.length}
            totalCount={recentExecutions.length}
            className="mb-4"
          />
          {filteredExecutions.length === 0 ? (
            <EmptyState
              icon="📜"
              message={
                historySearch.trim()
                  ? "No hay registros que coincidan con la búsqueda"
                  : "No hay registros sanitarios aún"
              }
            />
          ) : (
            <Table headers={["Fecha", "Tipo", "Descripción", "Aves", "Producto", "Costo", "Notas"]}>
              {filteredExecutions.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">{new Date(r.date + "T12:00:00").toLocaleDateString("es")}</td>
                  <td className="px-4 py-3"><Badge color={TYPE_COLORS[r.type] || "gray"}>{TYPE_LABELS[r.type] || r.type}</Badge></td>
                  <td className="px-4 py-3 text-sm max-w-[200px]">{r.description}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{r.affectedHens || "—"}</td>
                  <td className="px-4 py-3 text-sm">{r.product || "—"}</td>
                  <td className="px-4 py-3">{Number(r.cost) > 0 ? `$${Number(r.cost).toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 max-w-[150px] truncate">{r.notes || "—"}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* ─── Tab: Recursos ─── */}
      {tab === "recursos" && (
        <div className="space-y-4">
          {/* Low stock alerts */}
          {supplyStatus.filter((s) => s.isLow).length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <h3 className="font-semibold text-red-700 mb-2">⚠️ Insumos con Stock Bajo</h3>
              <div className="space-y-1">
                {supplyStatus.filter((s) => s.isLow).map((s) => (
                  <p key={s.id} className={`text-sm ${s.isCritical ? "text-red-600 font-bold" : "text-orange-600"}`}>
                    {s.isCritical ? "🔴" : "🟡"} <strong>{s.name}</strong> — Stock: {s.currentStock} {s.unit} (mín: {s.minStock} {s.unit})
                  </p>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h3 className="font-semibold text-slate-700 mb-3">🧰 Inventario de Insumos Sanitarios</h3>
            <TableSearch
              value={supplySearch}
              onChange={setSupplySearch}
              placeholder="Buscar por insumo, categoría o estado..."
              resultCount={filteredSupplies.length}
              totalCount={supplyStatus.length}
              className="mb-4"
            />
            {filteredSupplies.length === 0 ? (
              <EmptyState
                icon="🧰"
                message={
                  supplySearch.trim()
                    ? "No hay insumos que coincidan con la búsqueda"
                    : "No hay insumos registrados. Agrega insumos desde el módulo de Inventarios."
                }
              />
            ) : (
              <Table headers={["Insumo", "Categoría", "Stock Actual", "Stock Mín.", "Costo/Unidad", "Estado"]}>
                {filteredSupplies.map((s) => (
                  <tr key={s.id} className={s.isCritical ? "bg-red-50" : s.isLow ? "bg-yellow-50" : "hover:bg-slate-50"}>
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-sm">{supplyCategoryLabels[s.category] || s.category}</td>
                    <td className="px-4 py-2 font-semibold">{s.currentStock} {s.unit}</td>
                    <td className="px-4 py-2 text-sm">{s.minStock} {s.unit}</td>
                    <td className="px-4 py-2">${s.costPerUnit.toLocaleString()}</td>
                    <td className="px-4 py-2">
                      {s.isCritical ? (
                        <Badge color="red">🔴 Crítico</Badge>
                      ) : s.isLow ? (
                        <Badge color="yellow">🟡 Bajo</Badge>
                      ) : (
                        <Badge color="green">✅ OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <p className="text-xs text-slate-500">
            💡 Los insumos sanitarios se gestionan desde <a href="/dashboard/inventarios/insumos" className="text-blue-600 hover:underline">Inventarios → Insumos</a>.
            Al ejecutar una acción sanitaria, el sistema descuenta automáticamente los recursos utilizados.
          </p>
        </div>
      )}

      {/* ─── Execute Modal ─── */}
      <Modal open={execModalOpen} onClose={() => setExecModalOpen(false)} title={execSuccess ? "✅ Acción Registrada" : `⚡ Ejecutar: ${execEvent?.name || ""}`}>
        <div className="space-y-4">
          {execSuccess ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-lg font-semibold text-green-700">Acción registrada exitosamente</p>
              <p className="text-sm text-slate-500 mt-2">
                {execEvent?.frequencyDays
                  ? `Próxima ejecución: se ha avanzado la fecha automáticamente.`
                  : `Evento único completado y desactivado.`}
              </p>
              {execEvent?.withdrawalDays && execEvent.withdrawalDays > 0 && (
                <p className="text-sm text-orange-600 mt-2 bg-orange-50 p-2 rounded-lg">
                  ⏱️ Período de retiro: {execEvent.withdrawalDays} días. No consumir huevos/carne durante este período.
                </p>
              )}
              <div className="flex gap-3 justify-center mt-4">
                <Button onClick={() => { setExecModalOpen(false); setExecSuccess(false); }}>Cerrar</Button>
                <Button variant="secondary" onClick={() => setTab("historial")}>Ver Historial</Button>
              </div>
            </div>
          ) : (
            <>
              {execError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{execError}</p>}

              {/* Resource check */}
              {execEvent && (
                <div className={`p-3 rounded-lg border ${execEvent.availableSupplies.length > 0 ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
                  <p className="text-sm font-semibold mb-1">
                    {execEvent.availableSupplies.length > 0 ? "✅ Recursos disponibles:" : "⚠️ No hay recursos en stock para esta acción"}
                  </p>
                  {execEvent.availableSupplies.length > 0 ? (
                    <div className="space-y-1">
                      {execEvent.availableSupplies.map((s) => (
                        <p key={s.id} className="text-xs text-green-700">
                          • {s.name}: {s.currentStock} {s.unit} disponibles
                        </p>
                      ))}
                    </div>
                  ) : execEvent.supplyCategory ? (
                    <p className="text-xs text-orange-600">
                      Se necesita: {supplyCategoryLabels[execEvent.supplyCategory] || execEvent.supplyCategory}.
                      Puedes registrar la acción igual y adquirir los recursos después.
                    </p>
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input label="Fecha" type="date" value={execForm.date} onChange={(e) => setExecForm({ ...execForm, date: e.target.value })} />
                <Select label="Tipo" value={execEvent?.type || "inspeccion"} disabled>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </div>
              <Textarea label="Descripción" value={execForm.description} onChange={(e) => setExecForm({ ...execForm, description: e.target.value })} required />
              <Input label="Aves afectadas" value={execForm.affectedHens} onChange={(e) => setExecForm({ ...execForm, affectedHens: e.target.value })} placeholder="'todas' o códigos: G-001, G-002" />
              <Input label="Producto utilizado" value={execForm.product} onChange={(e) => setExecForm({ ...execForm, product: e.target.value })} placeholder="Ej: Newcastle B1, Ivermectina..." />
              <Input label="Costo ($)" type="number" step="0.01" value={execForm.cost} onChange={(e) => setExecForm({ ...execForm, cost: e.target.value })} />
              <Textarea label="Notas" value={execForm.notes} onChange={(e) => setExecForm({ ...execForm, notes: e.target.value })} placeholder="Observaciones adicionales..." />

              {execEvent?.withdrawalDays && execEvent.withdrawalDays > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700 font-medium">
                    ⏱️ Período de retiro: {execEvent.withdrawalDays} días
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    No consumir huevos ni carne de las aves tratadas durante este período.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={executeAction} disabled={!execForm.description}>
                  ⚡ Confirmar Ejecución
                </Button>
                <Button variant="secondary" onClick={() => setExecModalOpen(false)}>Cancelar</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ─── Seed Protocol Modal ─── */}
      <Modal open={seedModalOpen} onClose={() => setSeedModalOpen(false)} title="📋 Generar Eventos desde Protocolo">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Genera automáticamente los eventos del calendario sanitario según el protocolo definido para la etapa seleccionada.
            Los eventos se crearán a partir de la fecha indicada.
          </p>
          <Select label="Etapa" value={seedStage} onChange={(e) => setSeedStage(e.target.value)}>
            {stages.map((s) => <option key={s.id} value={s.value}>{s.value} ({s.henCount} aves)</option>)}
          </Select>
          <Input label="Fecha de inicio" type="date" value={seedDate} onChange={(e) => setSeedDate(e.target.value)} />

          {seedStage && protocols[seedStage] && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-semibold text-blue-700 mb-2">Se crearán {protocols[seedStage].length} eventos:</p>
              <div className="space-y-1">
                {protocols[seedStage].map((a, i) => (
                  <p key={i} className="text-xs text-blue-600">
                    • Sem {a.weekOffset}: {TYPE_LABELS[a.type] || a.type} — {a.name}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={seedProtocol} disabled={!seedStage}>Generar Eventos</Button>
            <Button variant="secondary" onClick={() => setSeedModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
