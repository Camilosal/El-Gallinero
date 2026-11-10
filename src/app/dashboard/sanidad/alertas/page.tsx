"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";

interface Alert {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  date: string;
  birdGroup?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "red",
  warning: "yellow",
  info: "blue",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Crítico",
  warning: "Advertencia",
  info: "Información",
};

const TYPE_ICONS: Record<string, string> = {
  feed_change: "🌾",
  point_of_lay: "🥚",
  overdue_vaccination: "💉",
  production_drop: "📉",
  weight_deviation: "⚖️",
};

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    apiFetch("/api/produccion/alertas")
      .then((r) => r.json())
      .then((data: Alert[]) => setAlerts(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const filteredAlerts = useMemo(() => {
    if (!search.trim()) return alerts;
    return alerts.filter((alert) =>
      matchesTextQuery(search, [
        alert.type,
        SEVERITY_LABELS[alert.severity],
        alert.title,
        alert.message,
        alert.date,
        alert.birdGroup,
      ]),
    );
  }, [alerts, search]);

  const filteredCritical = filteredAlerts.filter((a) => a.severity === "critical");
  const filteredWarnings = filteredAlerts.filter((a) => a.severity === "warning");
  const filteredInfos = filteredAlerts.filter((a) => a.severity === "info");

  const renderGroup = (title: string, group: Alert[], color: string) => {
    if (group.length === 0) return null;
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
          <Badge color={color}>{title}</Badge>
          <span className="text-sm font-normal text-slate-500">{group.length}</span>
        </h2>
        {group.map((a, i) => (
          <Card key={i} className="border-l-4" >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{TYPE_ICONS[a.type] || "🔔"}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{a.title}</h3>
                  <Badge color={SEVERITY_COLORS[a.severity]}>{SEVERITY_LABELS[a.severity]}</Badge>
                </div>
                <p className="text-sm text-slate-600 mt-1">{a.message}</p>
                <div className="flex gap-4 mt-2 text-xs text-slate-400">
                  <span>{a.date}</span>
                  {a.birdGroup && <span>Grupo: {a.birdGroup}</span>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="🔔 Alertas de Fase"
        description="Monitoreo automático de transiciones, vacunación y producción"
        help="El sistema monitorea automáticamente las transiciones de etapa de tus gallinas, los eventos de vacunación pendientes y los niveles de producción. Las alertas aparecen cuando algo necesita tu atención. No necesitas hacer nada manualmente, el sistema genera las alertas según los datos registrados."
      />

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando alertas...</p></Card>
      ) : alerts.length === 0 ? (
        <EmptyState icon="✅" message="No hay alertas activas" />
      ) : (
        <>
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar por título, mensaje o grupo..."
            resultCount={filteredAlerts.length}
            totalCount={alerts.length}
          />
          {filteredAlerts.length === 0 ? (
            <EmptyState
              icon="🔔"
              message={
                search.trim()
                  ? "No hay alertas que coincidan con la búsqueda"
                  : "No hay alertas activas"
              }
            />
          ) : (
            <>
              {renderGroup("Críticas", filteredCritical, "red")}
              {renderGroup("Advertencias", filteredWarnings, "yellow")}
              {renderGroup("Información", filteredInfos, "blue")}
            </>
          )}
        </>
      )}
    </div>
  );
}
