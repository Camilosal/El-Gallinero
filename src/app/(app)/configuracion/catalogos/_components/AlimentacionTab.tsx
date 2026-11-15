"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wheat } from "lucide-react";
import { Badge, Button, Card, EmptyState, StatCard, Table } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";

interface StageOption { id: string; value: string }
interface FeedProgram {
  id: string;
  stageCatalogoId: string;
  feedId: string;
  feedName: string | null;
  feedUnit: string | null;
  percentage: string;
  dailyAmountPerHen: string;
}

export default function AlimentacionTab() {
  const [stages, setStages] = useState<StageOption[]>([]);
  const [programs, setPrograms] = useState<FeedProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/configuracion/programas-alimentacion")
      .then((r) => r.json())
      .then((data) => {
        setStages(data.stages || []);
        setPrograms(data.programs || []);
      })
      .catch(() => setError("No se pudo cargar el resumen de programas de alimentación"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const stageRows = useMemo(() => {
    return stages.map((stage) => {
      const stagePrograms = programs.filter((p) => p.stageCatalogoId === stage.id);
      const totalGrams = stagePrograms.reduce((acc, p) => acc + Number(p.dailyAmountPerHen || 0), 0);
      const totalPct = stagePrograms.reduce((acc, p) => acc + Number(p.percentage || 0), 0);
      return {
        stage,
        programs: stagePrograms,
        totalGrams,
        totalPct,
      };
    });
  }, [stages, programs]);

  const coveredCount = stageRows.filter((r) => r.programs.length > 0).length;
  const uncoveredCount = stageRows.length - coveredCount;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Wheat className="w-4 h-4 text-amber-600" aria-hidden="true" />
              Resumen de Programas de Alimentación
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Los programas por especie y etapa se crean y editan directamente en la hoja operativa de{" "}
              <strong>Etapas y Programas de Alimentación</strong> para usar siempre el mismo modelo nutricional.
            </p>
          </div>
          <Link href="/produccion?tab=alimentacion&subtab=etapas" className="shrink-0">
            <Button>Ir a Programas de Alimentación →</Button>
          </Link>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <StatCard icon="sprout" label="Etapas activas" value={stages.length} color="blue" />
        <StatCard icon="wheat" label="Etapas con programa" value={coveredCount} color="green" />
        <StatCard icon="alert" label="Etapas sin programa" value={uncoveredCount} color={uncoveredCount > 0 ? "yellow" : "green"} />
        <StatCard icon="clipboard" label="Raciones configuradas" value={programs.length} color="purple" />
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando resumen...</p>
        ) : stageRows.length === 0 ? (
          <EmptyState
            icon="wheat"
            message="No hay etapas configuradas todavía. Créalas en Listas maestras → Etapas de crecimiento."
          />
        ) : (
          <Table headers={["Etapa", "Alimentos asignados", "Suma %", "Ración total (g/día)", "Estado"]}>
            {stageRows.map(({ stage, programs: stagePrograms, totalGrams, totalPct }) => (
              <tr key={stage.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{stage.value}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {stagePrograms.length === 0 ? (
                    <span className="text-slate-400">Sin alimento asignado</span>
                  ) : (
                    stagePrograms
                      .map((p) => `${p.feedName || "Alimento"} (${Number(p.dailyAmountPerHen).toFixed(0)} g)`)
                      .join(" · ")
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{stagePrograms.length > 0 ? `${totalPct.toFixed(0)}%` : "—"}</td>
                <td className="px-4 py-3 text-sm font-semibold text-emerald-700">
                  {stagePrograms.length > 0 ? `${totalGrams.toFixed(0)} g` : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge color={stagePrograms.length > 0 ? "green" : "yellow"}>
                    {stagePrograms.length > 0 ? "Configurado" : "Pendiente"}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
