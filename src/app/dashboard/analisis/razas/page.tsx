"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { Card, EmptyState, PageHeader, Select } from "@/components/ui";
import { apiFetch } from "@/lib/fetch";
import { getStandardCurve, getStandardCurves, type CurveSpecies, type StandardCurve } from "@/lib/standard-curves";

interface ActualPoint {
  week: number;
  actual: number;
  date: string;
  count: number;
}

interface Comparison {
  week: number | null;
  actual: number | null;
  target: number | null;
  min: number | null;
  max: number | null;
  variancePercent: number | null;
  status: "por_debajo" | "alineado" | "por_encima" | "sin_datos";
  date: string;
  eligibleAnimals: number;
  eggsLastSevenDays?: number;
  collectionDays?: number;
  batchCode?: string | null;
}

interface CurveResponse {
  curve: StandardCurve;
  actualPoints: ActualPoint[];
  comparison: Comparison | null;
  logs: { id: string; date: string; week: number | null; avgWeightKg: number; sampleSize: number; batchCode: string | null; breed: string }[];
}

const SPECIES_OPTIONS: { value: CurveSpecies; label: string }[] = [
  { value: "gallina", label: "Gallinas ponedoras" },
  { value: "pollo", label: "Pollos de engorde" },
  { value: "codorniz", label: "Codornices" },
  { value: "pato", label: "Patos" },
  { value: "conejo", label: "Conejos" },
];

const STATUS: Record<Comparison["status"], { label: string; style: string }> = {
  por_debajo: { label: "Por debajo del rango", style: "border-red-200 bg-red-50 text-red-800" },
  alineado: { label: "Alineado con el rango", style: "border-green-200 bg-green-50 text-green-800" },
  por_encima: { label: "Por encima del rango", style: "border-blue-200 bg-blue-50 text-blue-800" },
  sin_datos: { label: "Sin datos suficientes", style: "border-slate-200 bg-slate-50 text-slate-700" },
};

function formatMetric(value: number | null | undefined, curve: StandardCurve): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return curve.metric === "postura" ? `${value.toFixed(1)}%` : `${Math.round(value).toLocaleString("es-CO")} g`;
}

export default function RazasPage() {
  const [species, setSpecies] = useState<CurveSpecies>("gallina");
  const [breed, setBreed] = useState("");
  const [data, setData] = useState<CurveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const breedOptions = getStandardCurves(species);
  const selectedBreed = breedOptions.some((option) => option.breed === breed) ? breed : breedOptions[0]?.breed || "";

  const load = useCallback(async () => {
    if (!selectedBreed) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ species, breed: selectedBreed });
      const response = await apiFetch(`/api/analisis/curvas?${params.toString()}`);
      const result = await response.json();
      if (response.ok) setData(result);
      else setData(null);
    } finally {
      setLoading(false);
    }
  }, [species, selectedBreed]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const selectedCurve = data?.curve || getStandardCurve(species, selectedBreed);
  const chartData = useMemo(() => (selectedCurve?.points || []).map((point) => ({
    week: point.week,
    target: point.target,
    min: point.min,
    max: point.max,
    range: [point.min, point.max],
  })), [selectedCurve]);

  const isLayer = selectedCurve?.metric === "postura";
  const comparison = data?.comparison || null;
  const actualLink = isLayer ? "/dashboard/produccion?tab=huevos" : "/dashboard/produccion/peso";
  const actualAction = isLayer ? "Registrar huevos" : "Registrar pesajes";

  return (
    <div className="space-y-6">
      <PageHeader
        title="📈 Curvas de referencia y desempeño"
        description="Compara la postura de las gallinas y el crecimiento de cada especie con una curva de referencia."
        help="Las curvas de peso se muestran en una sola referencia, sin separar machos y hembras. El desempeño real se compara con los registros recientes de huevos o pesajes vinculados a lotes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select label="Especie" value={species} onChange={(event) => { setSpecies(event.target.value as CurveSpecies); setBreed(""); }}>
              {SPECIES_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
            <Select label="Curva" value={selectedBreed} onChange={(event) => setBreed(event.target.value)}>
              {breedOptions.map((option) => <option key={option.breed} value={option.breed}>{option.breed}</option>)}
            </Select>
          </div>
        }
      />

      {loading ? (
        <Card><p className="py-8 text-center text-slate-400">Cargando curva y registros recientes…</p></Card>
      ) : !selectedCurve ? (
        <Card><EmptyState icon="📈" message="No hay una curva de referencia para esta especie" /></Card>
      ) : (
        <>
          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{selectedCurve.breed}</h2>
                <p className="text-sm text-slate-500">
                  {isLayer ? "Postura por edad del lote" : "Crecimiento por edad"} · {selectedCurve.unit}
                </p>
              </div>
              <Link href={actualLink} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800">
                {actualAction}
              </Link>
            </div>

            <ResponsiveContainer width="100%" height={390}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" type="number" domain={["dataMin", "dataMax"]} label={{ value: "Edad (semanas)", position: "bottom" }} />
                <YAxis label={{ value: isLayer ? "% postura ave-día" : "Peso (g)", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(value) => typeof value === "number" ? formatMetric(value, selectedCurve) : value} />
                <Area type="monotone" dataKey="range" name="Rango esperado" stroke="#86efac" fill="#bbf7d0" fillOpacity={0.45} />
                <Line type="monotone" dataKey="target" name="Objetivo" stroke="#15803d" strokeWidth={2} dot={false} />
                <Scatter data={data?.actualPoints || []} dataKey="actual" name={isLayer ? "Postura real" : "Peso real"} fill="#2563eb" shape="circle" />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-slate-500">
              Referencia: <a className="font-medium text-blue-700 underline" href={selectedCurve.sourceUrl} target="_blank" rel="noreferrer">{selectedCurve.sourceLabel}</a>.
              {" "}{selectedCurve.note}
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-semibold text-slate-800">Comparación reciente</h3>
              {!comparison || comparison.status === "sin_datos" || comparison.actual == null ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    {isLayer
                      ? "Se necesitan gallinas activas en edad de postura y registros de huevos de los últimos 7 días."
                      : "Aún no hay pesajes vinculados a lotes de esta especie para comparar."}
                  </p>
                  <Link href={actualLink} className="text-sm font-semibold text-green-700 hover:underline">{actualAction} →</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${STATUS[comparison.status].style}`}>
                    {STATUS[comparison.status].label}
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-slate-500">Real</p><p className="text-xl font-bold text-slate-900">{formatMetric(comparison.actual, selectedCurve)}</p></div>
                    <div><p className="text-slate-500">Objetivo</p><p className="text-xl font-bold text-green-700">{formatMetric(comparison.target, selectedCurve)}</p></div>
                    <div><p className="text-slate-500">Rango de referencia</p><p className="font-semibold">{formatMetric(comparison.min, selectedCurve)} – {formatMetric(comparison.max, selectedCurve)}</p></div>
                    <div><p className="text-slate-500">Edad comparada</p><p className="font-semibold">{comparison.week == null ? "—" : `${comparison.week.toFixed(1)} semanas`}</p></div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {isLayer
                      ? `${comparison.eligibleAnimals} gallinas activas · ${comparison.eggsLastSevenDays || 0} huevos en ${comparison.collectionDays || 0} días con registro (últimos 7)`
                      : `${comparison.eligibleAnimals} animales en la última muestra${comparison.batchCode ? ` · ${comparison.batchCode}` : ""} · ${comparison.date}`}
                  </p>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="mb-3 font-semibold text-slate-800">Puntos de referencia</h3>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Semana</th>
                      <th className="px-3 py-2 text-right">Mín.</th>
                      <th className="px-3 py-2 text-right">Objetivo</th>
                      <th className="px-3 py-2 text-right">Máx.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCurve.points.map((point) => (
                      <tr key={point.week} className="border-b border-slate-100">
                        <td className="px-3 py-2">{point.week}</td>
                        <td className="px-3 py-2 text-right">{formatMetric(point.min, selectedCurve)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">{formatMetric(point.target, selectedCurve)}</td>
                        <td className="px-3 py-2 text-right">{formatMetric(point.max, selectedCurve)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
