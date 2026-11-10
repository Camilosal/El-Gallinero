"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Card, Select, Button, EmptyState } from "@/components/ui";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
} from "recharts";
import { apiFetch } from "@/lib/fetch";

interface Standard {
  id: string;
  breed: string;
  gender: string;
  weekNumber: number;
  targetWeightG: string;
  minWeightG: string | null;
  maxWeightG: string | null;
}

const BREEDS = ["ISA Brown", "Hy-Line W-36", "Cobb 500"];
const GENDERS = ["hembra", "macho"];

export default function RazasPage() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [breed, setBreed] = useState("ISA Brown");
  const [gender, setGender] = useState("hembra");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/produccion/peso?breed=${encodeURIComponent(breed)}&gender=${gender}`)
      .then((r) => r.json())
      .then((data) => setStandards(data.standards || []))
      .finally(() => setLoading(false));
  }, [breed, gender]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const seedStandards = async () => {
    setSeeding(true);
    try {
      await apiFetch("/api/produccion/peso/seed", { method: "POST" });
      load();
    } finally {
      setSeeding(false);
    }
  };

  const chartData = standards.map((s) => ({
    week: s.weekNumber,
    objetivo: parseFloat(s.targetWeightG),
    min: s.minWeightG ? parseFloat(s.minWeightG) : null,
    max: s.maxWeightG ? parseFloat(s.maxWeightG) : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="🧬 Estándares de Raza"
        description="Curvas de referencia de peso por raza y género"
        help="Muestra las curvas de crecimiento estándar según la genética de cada raza (ISA Brown, Hy-Line W-36, Cobb 500). Compara el peso real de tus aves contra los rangos mínimo, objetivo y máximo publicados por las casas genéticas. Útil para detectar problemas de nutrición, salud o manejo. Selecciona raza y género para ver la curva de referencia."
        actions={
          <div className="flex gap-2">
            <Select value={breed} onChange={(e) => setBreed(e.target.value)}>
              {BREEDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </div>
        }
      />

      {standards.length === 0 && !loading && (
        <Card>
          <EmptyState icon="🧬" message="No hay estándares cargados" />
          <div className="text-center mt-4">
            <Button onClick={seedStandards} disabled={seeding}>
              {seeding ? "Cargando..." : "Cargar estándares de todas las razas"}
            </Button>
          </div>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Curva estándar — {breed} ({gender})</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" label={{ value: "Semana de edad", position: "bottom" }} />
              <YAxis label={{ value: "Peso (g)", angle: -90, position: "left" }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="min" name="Mínimo" stroke="#86efac" fill="#bbf7d0" fillOpacity={0.3} />
              <Area type="monotone" dataKey="max" name="Máximo" stroke="#86efac" fill="#bbf7d0" fillOpacity={0.3} />
              <Line type="monotone" dataKey="objetivo" name="Peso objetivo" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {standards.length > 0 && (
        <Card>
          <h3 className="font-semibold text-slate-700 mb-4">Tabla de referencia</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-2 px-3">Semana</th>
                  <th className="text-right py-2 px-3">Mínimo (g)</th>
                  <th className="text-right py-2 px-3">Objetivo (g)</th>
                  <th className="text-right py-2 px-3">Máximo (g)</th>
                </tr>
              </thead>
              <tbody>
                {standards.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2 px-3">{s.weekNumber}</td>
                    <td className="py-2 px-3 text-right">{s.minWeightG ? parseFloat(s.minWeightG).toFixed(0) : "-"}</td>
                    <td className="py-2 px-3 text-right font-semibold text-green-700">{parseFloat(s.targetWeightG).toFixed(0)}</td>
                    <td className="py-2 px-3 text-right">{s.maxWeightG ? parseFloat(s.maxWeightG).toFixed(0) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
