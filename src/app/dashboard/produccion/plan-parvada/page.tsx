"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Target, TrendingUp } from "lucide-react";
import { PageHeader, Button, Card, Badge, Modal, Input, Textarea, EmptyState } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/lib/fetch";
import { addDays, parseISODate, toISODate } from "@/lib/flock-plan";

interface PlanAlert {
  level: "success" | "warning" | "info";
  title: string;
  detail: string;
  action?: { label: string; href: string };
}

interface LiveData {
  date: string;
  animalsTotal: number;
  hens: {
    total: number;
    laying: number;
    broody: number;
    sick: number;
    recommended: number;
    inCycle: number;
    avgAgeWeeks: number;
    phase: string;
    stageCounts: { stage: string; count: number }[];
  };
  roosters: { active: number; required: number; deficit: number; surplus: number };
  batches: { count: number; quantity: number };
  eggs: {
    last7: number;
    previous7: number;
    avgDaily: number;
    expectedPerDay: number;
    expectedPerWeek: number;
    compliancePct: number;
  };
  feed: { dailyKg: number; weeklyKg: number };
  replacement: { dueNow: number; nextWeeks: number | null; nextDate: string | null };
  alerts: PlanAlert[];
}

interface ProjectionWeek {
  offset: number;
  weekStart: string;
  weekEnd: string;
  label: string;
  rangeLabel: string;
  expectedHens: number;
  expectedEggs: number;
  expectedFeedKg: number;
  actualEggs: number | null;
  actualHens: number | null;
  compliancePct: number | null;
  isCurrent: boolean;
  isPast: boolean;
}

const EMPTY_WEEKS: ProjectionWeek[] = [];

interface PlanSummary {
  progressPct: number;
  daysToReplacement: number | null;
  currentHens: number;
  gapHens: number;
  gapRoosters: number;
  phase: string;
}

interface FlockPlan {
  id: string;
  name: string;
  startDate: string;
  targetHenCount: number;
  targetRoosterCount: number | null;
  replacementDate: string | null;
  currentPhase: string | null;
  status: string;
  notes: string | null;
  summary: PlanSummary;
}

interface PlanResponse {
  today: string;
  finPosturaWeeks: number;
  live: LiveData;
  projection: {
    weeks: ProjectionWeek[];
    currentWeek: ProjectionWeek | null;
  };
  plans: FlockPlan[];
}

interface PlanForm {
  name: string;
  startDate: string;
  targetHenCount: string;
  targetRoosterCount: string;
  replacementDate: string;
  notes: string;
}

const ALERT_STYLES: Record<PlanAlert["level"], { box: string; title: string; icon: string }> = {
  success: { box: "border-green-200 bg-green-50", title: "text-green-800", icon: "check-circle" },
  warning: { box: "border-amber-200 bg-amber-50", title: "text-amber-800", icon: "warning" },
  info: { box: "border-blue-200 bg-blue-50", title: "text-blue-800", icon: "info" },
};

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formFromPlan(
  plan: FlockPlan | null,
  today: string,
  live: LiveData | null,
  finPosturaWeeks = 80,
): PlanForm {
  if (plan) {
    return {
      name: plan.name,
      startDate: plan.startDate,
      targetHenCount: String(plan.targetHenCount),
      targetRoosterCount: plan.targetRoosterCount != null ? String(plan.targetRoosterCount) : "",
      replacementDate: plan.replacementDate ?? "",
      notes: plan.notes ?? "",
    };
  }

  return {
    name: `Plan de parvada ${new Date(`${today}T12:00:00`).getFullYear()}`,
    startDate: today,
    targetHenCount: String(live?.hens.inCycle ?? 0),
    targetRoosterCount: String(live?.roosters.active ?? 0),
    replacementDate: toISODate(addDays(parseISODate(today), finPosturaWeeks * 7)),
    notes: "",
  };
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = "slate",
}: {
  icon: string;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "slate" | "green" | "amber" | "blue" | "purple";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    green: "border-green-200 bg-green-50 text-green-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    purple: "border-purple-200 bg-purple-50 text-purple-800",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-medium opacity-80 flex items-center gap-1.5">
        <AppIcon icon={icon} className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-[11px] opacity-70">{hint}</p>}
    </div>
  );
}

export default function PlanParvadaPage() {
  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>({
    name: "",
    startDate: "",
    targetHenCount: "",
    targetRoosterCount: "",
    replacementDate: "",
    notes: "",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await apiFetch("/api/produccion/plan-parvada");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPageError(payload.error || "No se pudo cargar el plan de parvada");
        return;
      }
      setData(payload);
      setSelectedPlanId((previous) => {
        if (previous && payload.plans?.some((plan: FlockPlan) => plan.id === previous)) {
          return previous;
        }
        return payload.plans?.[0]?.id ?? null;
      });
    } catch {
      setPageError("Error de conexión al cargar el plan de parvada");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const live = data?.live ?? null;
  const selectedPlan =
    data?.plans.find((plan) => plan.id === selectedPlanId) ?? data?.plans[0] ?? null;

  const planAlert = useMemo<PlanAlert | null>(() => {
    if (!selectedPlan) return null;
    const gap = selectedPlan.summary.gapHens;
    if (gap < 0) {
      return {
        level: "warning",
        title: `Faltan ${Math.abs(gap)} gallinas para la meta`,
        detail: `La meta es ${selectedPlan.targetHenCount} gallinas en ciclo y hoy hay ${selectedPlan.summary.currentHens}. Programa reposición o revisa si la meta sigue vigente.`,
      };
    }
    if (gap > 0) {
      return {
        level: "info",
        title: `Hay ${gap} gallina${gap === 1 ? "" : "s"} por encima de la meta`,
        detail: `La meta es ${selectedPlan.targetHenCount} gallinas en ciclo y hoy hay ${selectedPlan.summary.currentHens}. Puedes ajustar la meta o destinar el excedente a venta.`,
      };
    }
    return {
      level: "success",
      title: "La parvada cumple la meta de gallinas",
      detail: `${selectedPlan.summary.currentHens} gallinas en ciclo frente a una meta de ${selectedPlan.targetHenCount}.`,
    };
  }, [selectedPlan]);

  const alerts = useMemo(
    () => [...(live?.alerts ?? []), ...(planAlert ? [planAlert] : [])],
    [live, planAlert],
  );

  const weeks = data?.projection.weeks ?? EMPTY_WEEKS;
  const visibleWeeks = useMemo(
    () => (showAllWeeks ? weeks : weeks.filter((week) => week.offset >= -2 && week.offset <= 8)),
    [showAllWeeks, weeks],
  );

  const chartData = useMemo(
    () =>
      weeks.map((week) => ({
        name: week.label,
        rango: week.rangeLabel,
        esperado: week.expectedEggs,
        // La semana actual está en curso; no se compara como semana cerrada.
        real: week.isCurrent ? null : week.actualEggs,
      })),
    [weeks],
  );

  const openNew = () => {
    const today = data?.today ?? toISODate(new Date());
    setEditingId(null);
    setForm(formFromPlan(null, today, live, data?.finPosturaWeeks));
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedPlan || !data) return;
    setEditingId(selectedPlan.id);
    setForm(formFromPlan(selectedPlan, data.today, live, data.finPosturaWeeks));
    setFormError("");
    setModalOpen(true);
  };

  const save = async () => {
    setFormError("");
    if (!form.name.trim()) return setFormError("El nombre del plan es requerido");
    if (!form.startDate) return setFormError("La fecha de inicio es requerida");
    if (!form.targetHenCount || Number(form.targetHenCount) < 1) {
      return setFormError("La meta de gallinas debe ser mayor a cero");
    }

    setSaving(true);
    try {
      const body = {
        ...(editingId ? { id: editingId } : {}),
        name: form.name.trim(),
        startDate: form.startDate,
        targetHenCount: Number(form.targetHenCount),
        targetRoosterCount: form.targetRoosterCount ? Number(form.targetRoosterCount) : null,
        replacementDate: form.replacementDate || null,
        notes: form.notes.trim() || null,
      };
      const res = await apiFetch("/api/produccion/plan-parvada", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(payload.error || "No se pudo guardar el plan");
        return;
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const removePlan = async () => {
    if (!selectedPlan) return;
    if (!confirm(`¿Eliminar el plan "${selectedPlan.name}"? La proyección de la parvada se mantiene.`)) {
      return;
    }
    const res = await apiFetch(`/api/produccion/plan-parvada?id=${selectedPlan.id}`, { method: "DELETE" });
    if (!res.ok) {
      setPageError("No se pudo eliminar el plan");
      return;
    }
    setSelectedPlanId(null);
    await load();
  };

  const replacementLabel =
    selectedPlan?.summary.daysToReplacement == null
      ? "—"
      : selectedPlan.summary.daysToReplacement < 0
        ? "Vencido"
        : `${selectedPlan.summary.daysToReplacement} días`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan de Parvada"
        description="Diagnóstico y proyección real de la postura, el alimento y el reemplazo"
        help="El plan compara la parvada real con una curva de postura calculada a partir de la edad de cada gallina y los estándares de Catálogos. Muestra las 4 semanas anteriores, la semana actual y las 12 próximas, con huevos esperados vs reales, gallinas en ciclo, alimento estimado y recomendaciones. Crea un plan para fijar la meta de gallinas/gallos y la fecha de reemplazo; la proyección se actualiza sola con los datos reales."
        actions={<Button onClick={openNew}>+ Nuevo Plan</Button>}
      />

      {loading ? (
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </Card>
      ) : pageError ? (
        <Card>
          <EmptyState icon="warning" message={pageError} />
          <div className="mt-4 flex justify-center">
            <Button onClick={load}>Reintentar</Button>
          </div>
        </Card>
      ) : !data || !live ? (
        <Card>
          <EmptyState icon="incubator" message="No hay datos disponibles para calcular el plan" />
        </Card>
      ) : (
        <>
          {/* Diagnóstico actual */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard
              icon="paw"
              label="Animales en inventario"
              value={live.animalsTotal}
              hint={`${live.hens.total} gallinas · ${live.roosters.active} gallos · ${live.batches.quantity} en lotes`}
              tone="green"
            />
            <MetricCard
              icon="hen"
              label="Gallinas en postura"
              value={live.hens.laying}
              hint={`${live.hens.inCycle} en ciclo productivo`}
              tone="amber"
            />
            <MetricCard
              icon="egg"
              label="Huevos últimos 7 días"
              value={live.eggs.last7}
              hint={`${live.eggs.avgDaily} por día en promedio`}
              tone="blue"
            />
            <MetricCard
              icon="bar-chart"
              label="Cumplimiento 7 días"
              value={`${live.eggs.compliancePct}%`}
              hint={`Esperado: ${live.eggs.expectedPerWeek} huevos/semana`}
              tone={live.eggs.compliancePct >= 90 ? "green" : "amber"}
            />
            <MetricCard
              icon="wheat"
              label="Alimento estimado"
              value={`${live.feed.weeklyKg} kg`}
              hint={`${live.feed.dailyKg} kg/día para la parvada en ciclo`}
              tone="purple"
            />
          </div>

          {/* Alertas y recomendaciones */}
          {alerts.length > 0 && (
            <Card>
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Target className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Qué requiere tu atención</span>
                </h3>
                <span className="text-xs text-slate-400">
                  Fase actual: <strong className="text-slate-600">{live.hens.phase}</strong> · Edad promedio{" "}
                  {live.hens.avgAgeWeeks} sem
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {alerts.map((alert) => {
                  const style = ALERT_STYLES[alert.level];
                  return (
                    <div key={`${alert.level}-${alert.title}`} className={`rounded-xl border p-3 ${style.box}`}>
                      <p className={`text-sm font-semibold flex items-center gap-1.5 ${style.title}`}>
                        <AppIcon icon={style.icon} className="w-4 h-4 shrink-0" />
                        <span>{alert.title}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{alert.detail}</p>
                      {alert.action && (
                        <Link
                          href={alert.action.href}
                          className="mt-1.5 inline-block text-xs font-semibold text-green-700 underline decoration-green-300 underline-offset-2 hover:text-green-800"
                        >
                          {alert.action.label} →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Plan vigente */}
          {data.plans.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {data.plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    selectedPlan?.id === plan.id
                      ? "bg-green-600 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {plan.name}
                </button>
              ))}
            </div>
          )}

          {selectedPlan ? (
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-800">{selectedPlan.name}</h2>
                    <Badge color={selectedPlan.status === "activo" ? "green" : "gray"}>
                      {selectedPlan.status === "activo" ? "Activo" : selectedPlan.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Inicio {fmtDate(selectedPlan.startDate)} · Reemplazo {fmtDate(selectedPlan.replacementDate)} ·
                    Fase {selectedPlan.summary.phase}
                  </p>
                  {selectedPlan.notes && (
                    <p className="mt-1 text-xs text-slate-400">{selectedPlan.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" onClick={openEdit}>Editar</Button>
                  <Button variant="danger" onClick={removePlan}>Eliminar</Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  icon="hen"
                  label="Gallinas meta"
                  value={selectedPlan.targetHenCount}
                  hint={
                    selectedPlan.summary.gapHens === 0
                      ? `${selectedPlan.summary.currentHens} en ciclo · meta cumplida`
                      : `${selectedPlan.summary.currentHens} en ciclo · ${
                          selectedPlan.summary.gapHens > 0
                            ? `sobran ${selectedPlan.summary.gapHens}`
                            : `faltan ${Math.abs(selectedPlan.summary.gapHens)}`
                        }`
                  }
                  tone={selectedPlan.summary.gapHens === 0 ? "green" : "amber"}
                />
                <MetricCard
                  icon="rooster"
                  label="Gallos meta"
                  value={selectedPlan.targetRoosterCount ?? "—"}
                  hint={`${live.roosters.active} activos · ${live.roosters.required} requeridos`}
                  tone={live.roosters.deficit === 0 && live.roosters.surplus === 0 ? "green" : "amber"}
                />
                <MetricCard
                  icon="calendar"
                  label="Avance del plan"
                  value={`${selectedPlan.summary.progressPct}%`}
                  hint={`${replacementLabel} para el reemplazo`}
                  tone="blue"
                />
                <MetricCard
                  icon="refresh"
                  label="Reemplazo natural"
                  value={live.replacement.dueNow > 0 ? `${live.replacement.dueNow} ahora` : "Al día"}
                  hint={
                    live.replacement.nextWeeks != null
                      ? `Próxima gallina en ${live.replacement.nextWeeks} sem (${fmtDate(live.replacement.nextDate)})`
                      : `Sin gallinas próximas a cumplir ${data.finPosturaWeeks} semanas`
                  }
                  tone={live.replacement.dueNow > 0 ? "amber" : "green"}
                />
              </div>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>Progreso del ciclo</span>
                  <span>{selectedPlan.summary.progressPct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-green-600 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, selectedPlan.summary.progressPct))}%` }}
                  />
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-dashed border-green-300 bg-green-50/40">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-green-900">Aún no hay un plan activo</h3>
                  <p className="mt-1 text-sm text-green-800">
                    El diagnóstico ya está calculado con tus {live.hens.total} gallinas. Crea un plan para fijar la
                    meta de parvada y la fecha de reemplazo.
                  </p>
                </div>
                <Button onClick={openNew}>Crear plan con la parvada actual</Button>
              </div>
            </Card>
          )}

          {/* Proyección */}
          <Card>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-600" aria-hidden="true" />
                <span>Proyección: esperado vs real</span>
              </h3>
              <span className="text-xs text-slate-400">
                Calculada con la edad real de cada gallina y los estándares de Catálogos
              </span>
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={10} interval={1} />
                  <YAxis fontSize={11} />
                  <Tooltip
                    labelFormatter={(_label, payload) => {
                      const item = payload?.[0]?.payload as { rango?: string } | undefined;
                      return item?.rango || "";
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="esperado"
                    name="Esperado"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Bar dataKey="real" name="Real" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Semanas clave */}
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  <span>Semanas clave</span>
                </h3>
                <p className="text-xs text-slate-400">
                  La semana actual se muestra en curso; las futuras son proyección.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setShowAllWeeks((value) => !value)}>
                {showAllWeeks ? "Ver solo las próximas" : "Ver las 17 semanas"}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th className="px-3 py-3 font-medium">Semana</th>
                    <th className="px-3 py-3 font-medium">Gallinas en ciclo</th>
                    <th className="px-3 py-3 font-medium">Huevos esperados</th>
                    <th className="px-3 py-3 font-medium">Huevos reales</th>
                    <th className="px-3 py-3 font-medium">Cumplimiento</th>
                    <th className="px-3 py-3 font-medium">Alimento est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleWeeks.map((week) => (
                    <tr key={week.weekStart} className={week.isCurrent ? "bg-blue-50" : "hover:bg-slate-50"}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">{week.rangeLabel}</span>
                          {week.isCurrent && <Badge color="blue">Actual</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">{week.expectedHens}</td>
                      <td className="px-3 py-2.5">{week.expectedEggs}</td>
                      <td className="px-3 py-2.5">{week.actualEggs != null ? week.actualEggs : "—"}</td>
                      <td className="px-3 py-2.5">
                        {week.isCurrent ? (
                          <span className="text-xs font-medium text-blue-700">En curso</span>
                        ) : week.compliancePct != null ? (
                          <span
                            className={`font-semibold ${
                              week.compliancePct >= 90
                                ? "text-green-700"
                                : week.compliancePct >= 70
                                  ? "text-amber-700"
                                  : "text-red-700"
                            }`}
                          >
                            {week.compliancePct}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{week.expectedFeedKg} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!showAllWeeks && weeks.length > visibleWeeks.length && (
              <p className="mt-3 text-xs text-slate-400">
                Mostrando desde 2 semanas atrás hasta 8 semanas adelante. Usa “Ver las 17 semanas” para el rango
                completo.
              </p>
            )}
          </Card>

          {/* Detalle de la parvada */}
          <Card>
            <h3 className="mb-3 font-semibold text-slate-700 flex items-center gap-2">
              <AppIcon icon="hen" className="w-4 h-4 text-slate-600" />
              <span>Composición de la parvada</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-6">
              <div className="rounded-lg bg-green-50 p-3">
                <p className="text-xs text-slate-500">En inventario</p>
                <p className="text-xl font-bold text-green-700">{live.hens.total}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-slate-500">En postura</p>
                <p className="text-xl font-bold text-emerald-700">{live.hens.laying}</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3">
                <p className="text-xs text-slate-500">Empollando</p>
                <p className="text-xl font-bold text-purple-700">{live.hens.broody}</p>
              </div>
              <div className="rounded-lg bg-yellow-50 p-3">
                <p className="text-xs text-slate-500">Enfermas</p>
                <p className="text-xl font-bold text-yellow-700">{live.hens.sick}</p>
              </div>
              <div className="rounded-lg bg-orange-50 p-3">
                <p className="text-xs text-slate-500">Recomendadas</p>
                <p className="text-xl font-bold text-orange-700">{live.hens.recommended}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">En ciclo</p>
                <p className="text-xl font-bold text-slate-700">{live.hens.inCycle}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              {live.hens.stageCounts.map((stage) => (
                <span key={stage.stage} className="rounded-full bg-slate-100 px-2.5 py-1">
                  {stage.stage}: {stage.count}
                </span>
              ))}
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                Lotes: {live.batches.quantity} animales
              </span>
            </div>
          </Card>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar plan de parvada" : "Nuevo plan de parvada"}
      >
        <div className="space-y-4">
          {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{formError}</p>}

          <Input
            label="Nombre del plan"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ej: Parvada 2026"
            required
            help="Nombre para identificar el plan."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Fecha de inicio"
              type="date"
              value={form.startDate}
              onChange={(event) => setForm({ ...form, startDate: event.target.value })}
              required
              help="Desde cuándo quieres medir el avance. Normalmente hoy."
            />
            <Input
              label="Fecha de reemplazo"
              type="date"
              value={form.replacementDate}
              onChange={(event) => setForm({ ...form, replacementDate: event.target.value })}
              help="Fecha planeada para renovar la parvada. Opcional."
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Gallinas meta"
              type="number"
              min="1"
              value={form.targetHenCount}
              onChange={(event) => setForm({ ...form, targetHenCount: event.target.value })}
              required
              help="Número de gallinas que quieres mantener en ciclo productivo."
            />
            <Input
              label="Gallos meta"
              type="number"
              min="0"
              value={form.targetRoosterCount}
              onChange={(event) => setForm({ ...form, targetRoosterCount: event.target.value })}
              placeholder="Opcional"
              help="Gallos reproductores deseados para la relación de la granja."
            />
          </div>
          <Textarea
            label="Notas"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Objetivos, proveedor de reposición, observaciones..."
            help="Notas para el seguimiento del plan."
          />
          <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
            La proyección se calcula con la edad real de las gallinas y los estándares de Catálogos. No se generan
            hitos fijos de 80 semanas.
          </p>
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Actualizar plan" : "Crear plan"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
