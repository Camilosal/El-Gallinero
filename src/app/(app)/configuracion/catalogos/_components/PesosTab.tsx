"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, Button, Input, Select, Modal, Badge, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { AppIcon } from "@/components/AppIcon";
import { apiFetch } from "@/lib/fetch";
import { MANAGED_SPECIES, normalizeManagedSpecies, speciesLabelEs } from "@/lib/animal-breeds";
import { matchesTextQuery } from "@/lib/text";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface BreedStandard {
  id: string;
  species: string | null;
  breed: string;
  gender: string;
  weekNumber: number;
  targetWeightG: string;
  minWeightG: string | null;
  maxWeightG: string | null;
}

const GENDER_LABELS: Record<string, string> = {
  mixto: "Mixto",
  hembra: "Hembra",
  macho: "Macho",
};

const GENDER_BADGE_COLORS: Record<string, string> = {
  mixto: "green",
  hembra: "purple",
  macho: "blue",
};

function normalizeSpeciesValue(raw: string | null | undefined): string {
  return (raw || "pollo").toLowerCase();
}

function getManagedSpeciesLabel(raw: string | null | undefined): string {
  const norm = normalizeManagedSpecies(raw);
  return norm ? speciesLabelEs(norm) : raw || "Pollo";
}

export function PesosTab() {
  const [rows, setRows] = useState<BreedStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("todas");
  const [breedFilter, setBreedFilter] = useState("todas");
  const [genderFilter, setGenderFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BreedStandard | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    species: "pollo",
    breed: "",
    gender: "mixto",
    weekNumber: "1",
    targetWeightG: "",
    minWeightG: "",
    maxWeightG: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/configuracion/estandares-peso")
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const speciesStats = useMemo(() => {
    return MANAGED_SPECIES.map((sp) => {
      const spRows = rows.filter((r) => normalizeSpeciesValue(r.species) === sp.value);
      const breedCount = new Set(spRows.map((r) => r.breed)).size;
      return {
        species: sp.value,
        label: sp.label,
        points: spRows.length,
        breeds: breedCount,
      };
    });
  }, [rows]);

  const totalUniqueBreeds = useMemo(() => new Set(rows.map((r) => `${normalizeSpeciesValue(r.species)}::${r.breed}`)).size, [rows]);

  const availableBreedsForFilter = useMemo(() => {
    const scoped = speciesFilter === "todas"
      ? rows
      : rows.filter((r) => normalizeSpeciesValue(r.species) === speciesFilter);
    return Array.from(new Set(scoped.map((r) => r.breed))).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows, speciesFilter]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const sp = normalizeSpeciesValue(r.species);
      if (speciesFilter !== "todas" && sp !== speciesFilter) return false;
      if (breedFilter !== "todas" && r.breed !== breedFilter) return false;
      if (genderFilter !== "todos" && r.gender !== genderFilter) return false;
      return matchesTextQuery(search, [
        sp,
        getManagedSpeciesLabel(sp),
        r.breed,
        r.gender,
        GENDER_LABELS[r.gender] || r.gender,
        `sem ${r.weekNumber}`,
        `semana ${r.weekNumber}`,
        r.targetWeightG,
      ]);
    });
  }, [rows, speciesFilter, breedFilter, genderFilter, search]);

  const chartCurveData = useMemo(() => {
    if (breedFilter === "todas") return [];
    const matching = filtered.filter((r) => r.breed === breedFilter);
    const byWeek = new Map<number, { targetSum: number; minSum: number; maxSum: number; count: number }>();
    for (const point of matching) {
      const t = Number(point.targetWeightG) || 0;
      const min = Number(point.minWeightG ?? Math.round(t * 0.9)) || 0;
      const max = Number(point.maxWeightG ?? Math.round(t * 1.1)) || 0;
      const curr = byWeek.get(point.weekNumber) || { targetSum: 0, minSum: 0, maxSum: 0, count: 0 };
      curr.targetSum += t;
      curr.minSum += min;
      curr.maxSum += max;
      curr.count += 1;
      byWeek.set(point.weekNumber, curr);
    }
    return Array.from(byWeek.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, agg]) => {
        const min = Math.round(agg.minSum / agg.count);
        const target = Math.round(agg.targetSum / agg.count);
        const max = Math.round(agg.maxSum / agg.count);
        return { week, min, target, max, range: [min, max] };
      });
  }, [breedFilter, filtered]);

  const breedsForModalSpecies = useMemo(() => {
    const sp = form.species;
    return Array.from(
      new Set(
        rows
          .filter((r) => normalizeSpeciesValue(r.species) === sp)
          .map((r) => r.breed),
      ),
    ).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows, form.species]);

  const handleSelectSpecies = (nextSpecies: string) => {
    setSpeciesFilter(nextSpecies);
    if (nextSpecies !== "todas" && breedFilter !== "todas") {
      const stillExists = rows.some(
        (r) => normalizeSpeciesValue(r.species) === nextSpecies && r.breed === breedFilter,
      );
      if (!stillExists) setBreedFilter("todas");
    }
  };

  const handleSeedAll = async () => {
    setSeeding(true);
    setStatusMsg("");
    try {
      const res = await apiFetch("/api/produccion/peso/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg(data.error || "No se pudieron cargar las curvas de referencia.");
      } else {
        setStatusMsg(
          data.seeded > 0
            ? `Se cargaron ${data.seeded} puntos nuevos (${data.total} puntos multiespecie activos).`
            : `Todas las curvas base de las 6 especies ya están cargadas (${data.total} puntos).`,
        );
      }
      load();
    } catch {
      setStatusMsg("Error de conexión al cargar las curvas.");
    } finally {
      setSeeding(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormError("");
    setForm({
      species: speciesFilter !== "todas" ? speciesFilter : "pollo",
      breed: breedFilter !== "todas" ? breedFilter : "",
      gender: genderFilter !== "todos" ? genderFilter : "mixto",
      weekNumber: "1",
      targetWeightG: "",
      minWeightG: "",
      maxWeightG: "",
    });
    setModalOpen(true);
  };

  const openEdit = (r: BreedStandard) => {
    setEditing(r);
    setFormError("");
    setForm({
      species: normalizeSpeciesValue(r.species),
      breed: r.breed,
      gender: r.gender || "mixto",
      weekNumber: String(r.weekNumber),
      targetWeightG: r.targetWeightG,
      minWeightG: r.minWeightG || "",
      maxWeightG: r.maxWeightG || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, id: editing.id } : form;
      const res = await apiFetch("/api/configuracion/estandares-peso", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Error al guardar el punto de curva");
        setSaving(false);
        return;
      }
      setModalOpen(false);
      load();
    } catch {
      setFormError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
        Curvas centralizadas por especie y raza. Cada edición o curva nueva impacta automáticamente{" "}
        <span className="font-semibold">Curvas de Peso</span>, <span className="font-semibold">Comparación de Desempeño</span> y las{" "}
        <span className="font-semibold">alertas de desviación de peso</span>.
      </div>

      {/* Cobertura por especie */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleSelectSpecies("todas")}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${speciesFilter === "todas"
            ? "bg-green-700 text-white border-green-700"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
        >
          Todas las especies ({totalUniqueBreeds} razas · {rows.length} pts)
        </button>
        {speciesStats.map((st) => (
          <button
            key={st.species}
            type="button"
            onClick={() => handleSelectSpecies(speciesFilter === st.species ? "todas" : st.species)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${speciesFilter === st.species
              ? "bg-green-700 text-white border-green-700"
              : st.points === 0
                ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
          >
            {st.label}: {st.breeds} {st.breeds === 1 ? "raza" : "razas"} · {st.points} pts
          </button>
        ))}
      </div>

      {/* Filtros y acciones */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={speciesFilter}
            onChange={(e) => handleSelectSpecies(e.target.value)}
            aria-label="Filtrar especie"
          >
            <option value="todas">Todas las especies</option>
            {MANAGED_SPECIES.map((sp) => (
              <option key={sp.value} value={sp.value}>{sp.label}</option>
            ))}
          </Select>

          <Select
            value={breedFilter}
            onChange={(e) => setBreedFilter(e.target.value)}
            aria-label="Filtrar raza"
          >
            <option value="todas">Todas las razas ({availableBreedsForFilter.length})</option>
            {availableBreedsForFilter.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Select>

          <Select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            aria-label="Filtrar sexo"
          >
            <option value="todos">Todos los sexos</option>
            <option value="mixto">Mixto</option>
            <option value="hembra">Hembra</option>
            <option value="macho">Macho</option>
          </Select>

          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar especie, raza o semana..."
            resultCount={filtered.length}
            totalCount={rows.length}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleSeedAll} disabled={seeding}>
            <AppIcon icon="sparkles" className="w-4 h-4 mr-1 inline" />
            {seeding ? "Sincronizando..." : "Cargar referencias (6 especies)"}
          </Button>
          <Button onClick={openNew}>+ Nuevo punto</Button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {statusMsg}
        </div>
      )}

      {/* Vista previa de curva cuando hay una raza seleccionada */}
      {breedFilter !== "todas" && chartCurveData.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Curva de crecimiento: {breedFilter}
              </h3>
              <p className="text-xs text-slate-500">
                Banda esperada (mínimo–máximo) y peso objetivo en gramos por semana
              </p>
            </div>
            <Badge color="green">{chartCurveData.length} semanas</Badge>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={chartCurveData} margin={{ top: 6, right: 16, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tickFormatter={(w) => `S${w}`} />
              <YAxis tickFormatter={(g) => `${g}g`} />
              <Tooltip
                formatter={(val) =>
                  Array.isArray(val) ? `${val[0]}g – ${val[1]}g` : `${val} g`
                }
                labelFormatter={(w) => `Semana ${w}`}
              />
              <Area
                type="monotone"
                dataKey="range"
                name="Rango (mín–máx)"
                stroke="var(--iw-color-outline-soft)"
                fill="var(--iw-color-sage)"
                fillOpacity={0.55}
              />
              <Line
                type="monotone"
                dataKey="target"
                name="Objetivo"
                stroke="var(--iw-color-forest)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando estándares multiespecie...</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon="trend-up" message="No hay puntos de curva para este filtro" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-medium">Especie</th>
                  <th className="py-2 pr-3 font-medium">Raza / Línea</th>
                  <th className="py-2 pr-3 font-medium">Sexo</th>
                  <th className="py-2 pr-3 font-medium">Semana</th>
                  <th className="py-2 pr-3 font-medium text-right">Mín (g)</th>
                  <th className="py-2 pr-3 font-medium text-right">Objetivo (g)</th>
                  <th className="py-2 pr-3 font-medium text-right">Máx (g)</th>
                  <th className="py-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const sp = normalizeSpeciesValue(r.species);
                  const gender = r.gender || "mixto";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2 pr-3">
                        <Badge color="slate">{getManagedSpeciesLabel(sp)}</Badge>
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{r.breed}</td>
                      <td className="py-2 pr-3">
                        <Badge color={GENDER_BADGE_COLORS[gender] || "green"}>
                          {GENDER_LABELS[gender] || gender}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">Sem. {r.weekNumber}</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{r.minWeightG || "—"}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-green-700">{r.targetWeightG} g</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{r.maxWeightG || "—"}</td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="text-xs text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <AppIcon icon="edit" className="w-3.5 h-3.5" /> Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar punto de curva de peso" : "Nuevo punto de curva de peso"}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Especie"
              value={form.species}
              onChange={(e) => setForm({ ...form, species: e.target.value })}
            >
              {MANAGED_SPECIES.map((sp) => (
                <option key={sp.value} value={sp.value}>{sp.label}</option>
              ))}
            </Select>

            <Select
              label="Sexo"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="mixto">Mixto</option>
              <option value="hembra">Hembra</option>
              <option value="macho">Macho</option>
            </Select>
          </div>

          <Input
            label="Raza / Línea genética"
            value={form.breed}
            list="pesos-breed-datalist"
            onChange={(e) => setForm({ ...form, breed: e.target.value })}
            placeholder="Ej: Cobb 500, ISA Brown, Codorniz Japónica, Pato Pekín..."
            required
          />
          <datalist id="pesos-breed-datalist">
            {breedsForModalSpecies.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Semana"
              type="number"
              min="0"
              value={form.weekNumber}
              onChange={(e) => setForm({ ...form, weekNumber: e.target.value })}
              required
            />
            <Input
              label="Peso Objetivo (g)"
              type="number"
              step="0.1"
              min="0"
              value={form.targetWeightG}
              onChange={(e) => setForm({ ...form, targetWeightG: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Peso Mínimo (g)"
              type="number"
              step="0.1"
              min="0"
              value={form.minWeightG}
              onChange={(e) => setForm({ ...form, minWeightG: e.target.value })}
            />
            <Input
              label="Peso Máximo (g)"
              type="number"
              step="0.1"
              min="0"
              value={form.maxWeightG}
              onChange={(e) => setForm({ ...form, maxWeightG: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default PesosTab;
