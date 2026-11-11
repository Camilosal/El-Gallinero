"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader, Button, Card, Table, Badge, Modal, Input, Select, Textarea, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { useCatalog } from "@/lib/useCatalog";
import { getBreedsForSpecies } from "@/lib/animal-breeds";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { isHenPresent } from "@/lib/animal-status";
import { QrGeneratorButton } from "./QrGenerator";

interface Hen {
  id: string;
  code: string;
  breed: string;
  birthDate: string;
  status: string;
  weight: string | null;
  notes: string | null;
  isBroody: boolean;
  clutchSize: number | null;
  stage?: string | null;
  ageWeeks?: number;
  lifecycleReasons?: string[];
}

interface Stage {
  id: string;
  value: string;
  minWeeks: number | null;
  maxWeeks: number | null;
}

interface InventorySummary {
  totalAves: number;
  species: { species: string; label: string; count: number }[];
}

const statusColors: Record<string, string> = {
  activa: "green",
  empollando: "purple",
  enferma: "red",
  descarte: "orange",
  recomendada_sacrificio: "orange",
  vendida: "gray",
  faena: "blue",
  muerta: "gray",
};

const statusLabels: Record<string, string> = {
  activa: "Activa",
  empollando: "Empollando",
  enferma: "Enferma",
  descarte: "Descarte",
  recomendada_sacrificio: "⚠️ Recomendada sacrificio",
  vendida: "Vendida",
  faena: "Faena",
  muerta: "Muerta",
};

const stageColors: Record<string, string> = {
  Pollito: "yellow",
  Juvenil: "blue",
  "Pre-postura": "purple",
  Postura: "green",
};

const breeds = ["Rhode Island Red", "Leghorn", "Plymouth Rock", "Sussex", "Marans", "Araucana", "Isa Brown", "Criolla", "Otra"];
const statusFallback = ["activa", "empollando", "enferma", "descarte", "recomendada_sacrificio", "vendida", "faena", "muerta"];

function getHenStage(birthDate: string, stages: Stage[]): string {
  const today = new Date();
  const birth = new Date(birthDate + "T12:00:00");
  const weeks = (today.getTime() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000);

  for (const stage of stages) {
    const min = stage.minWeeks ?? 0;
    const max = stage.maxWeeks;
    if (weeks >= min && (max === null || weeks < max)) {
      return stage.value;
    }
  }
  return "Desconocida";
}

function getHenAgeWeeks(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate + "T12:00:00");
  return Math.floor((today.getTime() - birth.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export default function GallinasPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [hens, setHens] = useState<Hen[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Hen | null>(null);
  const [form, setForm] = useState({ code: "", breed: "", birthDate: "", status: "activa", weight: "", notes: "", isBroody: false, clutchSize: 0 });
  const searchParams = useSearchParams();
  const estadoParam = searchParams.get("estado");
  const [filter, setFilter] = useState(estadoParam || "en_inventario");
  const [stageFilter, setStageFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);

  // Permite enlaces profundos desde el plan de parvada u otras pantallas.
  useEffect(() => {
    if (!estadoParam) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setFilter(estadoParam);
    });
    return () => { active = false; };
  }, [estadoParam]);
  const { items: breedItems } = useCatalog("raza", breeds);
  const breedOptions = getBreedsForSpecies(breedItems, "gallina", editing ? form.breed : null);
  const { values: statusOptions } = useCatalog("estado_gallina", statusFallback);

  const load = useCallback(() => {
    Promise.all([
      apiFetch("/api/produccion/gallinas").then((r) => r.json()),
      apiFetch("/api/produccion/etapas").then((r) => r.json()),
      apiFetch("/api/inventarios/resumen").then((r) => r.json()).catch(() => null),
    ]).then(([h, s, inv]) => {
      setHens(h);
      setStages(s.map((st: { id: string; value: string; minWeeks: number | null; maxWeeks: number | null }) => ({
        id: st.id,
        value: st.value,
        minWeeks: st.minWeeks,
        maxWeeks: st.maxWeeks,
      })));
      setInventorySummary(inv);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const openEdit = (h: Hen) => {
    setEditing(h);
    setForm({ code: h.code, breed: h.breed, birthDate: h.birthDate, status: h.status, weight: h.weight || "", notes: h.notes || "", isBroody: h.isBroody, clutchSize: h.clutchSize || 0 });
    setModalOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    await apiFetch("/api/produccion/gallinas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editing.id }) });
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta gallina?")) return;
    const res = await apiFetch(`/api/produccion/gallinas?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo eliminar la gallina");
      return;
    }
    load();
  };

  const henStage = useCallback((h: Hen) => h.stage ?? getHenStage(h.birthDate, stages), [stages]);
  const henAge = useCallback((h: Hen) => h.ageWeeks ?? getHenAgeWeeks(h.birthDate), []);

  // Solo mostramos etapas que realmente aplican a las gallinas registradas:
  // el catálogo también contiene etapas de pollos, codornices, patos y conejos.
  const stageNames = useMemo(() => {
    const present = new Set(hens.map((h) => henStage(h)));
    return [...new Set(stages.map((s) => s.value))].filter((name) => present.has(name));
  }, [hens, stages, henStage]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of hens) counts.set(h.status, (counts.get(h.status) ?? 0) + 1);
    return counts;
  }, [hens]);

  const recommended = useMemo(() => hens.filter((h) => h.status === "recomendada_sacrificio"), [hens]);
  const presentHens = useMemo(() => hens.filter((h) => isHenPresent(h.status)), [hens]);
  const layingHens = useMemo(() => presentHens.filter((h) => h.status === "activa"), [presentHens]);
  const outsideHens = hens.length - presentHens.length;

  const statusFiltered = useMemo(() => {
    if (filter === "todos") return hens;
    if (filter === "en_inventario") return presentHens;
    return hens.filter((h) => h.status === filter);
  }, [hens, filter, presentHens]);

  const filtered = useMemo(() => {
    let result = statusFiltered;
    if (stageFilter !== "todas") {
      result = result.filter((h) => henStage(h) === stageFilter);
    }
    if (search.trim()) {
      result = result.filter((h) =>
        matchesTextQuery(search, [
          h.code,
          h.breed,
          henStage(h),
          statusLabels[h.status] || h.status,
          h.notes,
          h.lifecycleReasons?.join(" "),
        ]),
      );
    }
    return result;
  }, [statusFiltered, stageFilter, search, henStage]);

  const filtersActive = filter !== "en_inventario" || stageFilter !== "todas" || search.trim().length > 0;
  const resetFilters = () => {
    setFilter("en_inventario");
    setStageFilter("todas");
    setSearch("");
  };
  const speciesBreakdown = (inventorySummary?.species ?? [])
    .filter((s) => s.count > 0)
    .map((s) => `${s.count} ${s.label.toLowerCase()}`)
    .join(" · ");
  const stageCount = (stage: string) => statusFiltered.filter((h) => henStage(h) === stage).length;

  return (
    <div>
      {!embedded && <PageHeader
        title="🐔 Seguimiento de Gallinas"
        description="Estado, postura y evolución de las gallinas ya ingresadas"
        help="Esta vista sirve para dar seguimiento a gallinas que ya están registradas. Toda gallina nueva debe ingresar primero por Adquisiciones con su origen (compra, donación o cría propia); las gallinas nacidas por incubación quedan vinculadas automáticamente a ese proceso.\n\n• Los gallos y lotes se gestionan aparte en Animales.\n• El sistema calcula automáticamente la etapa de crecimiento y cambia el estado según la edad y condición.\n• Las gallinas marcadas como 'recomendada sacrificio' son candidatas para venta o faena según su rendimiento.\n• Usa el botón 'Etiquetas QR' para generar códigos QR que puedes imprimir y pegar en bandas de pata. Luego escanéalo con tu celular para acceder rápido a cada ave.\n• Filtra por estado o etapa para encontrar gallinas específicas."
        actions={
          <div className="flex gap-2">
            <QrGeneratorButton hens={hens} />
            <Link href="/dashboard/produccion/adquisiciones?nuevo=gallina" className="inline-flex items-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">
              Registrar ingreso
            </Link>
          </div>
        }
      />}
      {embedded && <div className="mb-4 flex justify-end"><QrGeneratorButton hens={hens} /></div>}

      {/* Resumen de inventario: esta vista solo lista gallinas */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-green-700">
            <strong className="text-lg">{presentHens.length}</strong> gallinas en inventario
          </span>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <span className="text-slate-600">
            <strong>{layingHens.length}</strong> en postura
          </span>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <span className="text-slate-500">
            <strong>{hens.length}</strong> gallinas registradas
          </span>
          {outsideHens > 0 && (
            <>
              <span className="hidden text-slate-300 sm:inline">|</span>
              <span className="text-slate-400">{outsideHens} fuera del inventario</span>
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Esta vista solo lista gallinas.
          {inventorySummary ? (
            <>
              {" "}El inventario total es <strong className="text-slate-700">{inventorySummary.totalAves} animales</strong>
              {speciesBreakdown ? ` (${speciesBreakdown})` : ""}.
            </>
          ) : null}{" "}
          <Link href="/dashboard/inventarios/balance" className="font-medium text-blue-600 hover:underline">
            Ver balance de animales →
          </Link>
        </p>
      </div>

      {/* Alerta de gallinas recomendadas para sacrificio */}
      {recommended.length > 0 && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="font-semibold text-orange-800 mb-1">
            ⚠️ {recommended.length} gallina{recommended.length > 1 ? "s" : ""} recomendada{recommended.length > 1 ? "s" : ""} para sacrificio o venta
          </p>
          <div className="flex flex-wrap gap-2">
            {recommended.map((h) => (
              <span key={h.id} className="text-xs bg-white border border-orange-200 rounded px-2 py-1 text-orange-700" title={h.lifecycleReasons?.join(" · ")}>
                <strong>{h.code}</strong> — {h.lifecycleReasons?.join(" · ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtros compactos: búsqueda + estado + etapa */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar por código, raza, etapa o estado..."
            resultCount={filtered.length}
            totalCount={statusFiltered.length}
            className="lg:flex-1"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              Estado
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="en_inventario">En inventario ({presentHens.length})</option>
                <option value="todos">Todas ({hens.length})</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s] || s.charAt(0).toUpperCase() + s.slice(1)} ({statusCounts.get(s) ?? 0})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              Etapa
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="todas">Todas ({statusFiltered.length})</option>
                {stageNames.map((s) => (
                  <option key={s} value={s}>{s} ({stageCount(s)})</option>
                ))}
              </select>
            </label>
            {filtersActive && (
              <button onClick={resetFilters} className="text-xs font-medium text-slate-500 underline hover:text-slate-800">
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      <Card>
        {loading ? (
          <p className="text-center py-8 text-slate-400">Cargando...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🐔"
            message={
              filtersActive
                ? "No hay gallinas que coincidan con los filtros"
                : "No hay gallinas registradas aún"
            }
          />
        ) : (
          <Table headers={["Código", "Raza", "Edad", "Etapa", "Estado", "Peso (kg)", "Empollando", "Acciones"]}>
            {filtered.map((h) => {
              const stage = henStage(h);
              const ageWeeks = henAge(h);
              return (
                <tr key={h.id} className={`hover:bg-slate-50 ${h.status === "recomendada_sacrificio" ? "bg-orange-50/50" : ""}`}>
                  <td className="px-4 py-3 font-semibold">{h.code}</td>
                  <td className="px-4 py-3">{h.breed}</td>
                  <td className="px-4 py-3 text-sm">{ageWeeks} sem</td>
                  <td className="px-4 py-3">
                    <Badge color={stageColors[stage] || "gray"}>{stage}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColors[h.status]}>{statusLabels[h.status] || h.status}</Badge>
                    {h.lifecycleReasons && h.lifecycleReasons.length > 0 && (
                      <p className="text-xs text-orange-600 mt-1">{h.lifecycleReasons.join(" · ")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{h.weight || "—"}</td>
                  <td className="px-4 py-3">{h.isBroody ? "🐣 Sí" : "No"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(h)} className="text-blue-600 hover:underline text-xs">Editar</button>
                      <button onClick={() => remove(h.id)} className="text-red-600 hover:underline text-xs">Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Editar Gallina">
        <div className="space-y-4">
          <Input label="Código / Identificación" help="Código único para identificar a esta gallina. Ej: G-001, A-012. Debe ser único." value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ej: G-001" required />
          <Select label="Raza" help="Raza de la gallina. Cada raza tiene diferentes niveles de postura, peso y comportamiento." value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })}>
            {breedOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Input label="Fecha de Nacimiento" help="Fecha de nacimiento de la gallina. El sistema calcula automáticamente su edad y etapa de crecimiento." type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          <Select label="Estado" help="Estado actual de la gallina. 'Activa' es el estado normal. 'Empollando' si está incubando. 'Enferma' si necesita atención. El sistema puede sugerir 'recomendada sacrificio' automáticamente." value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {statusOptions.map((s) => <option key={s} value={s}>{statusLabels[s] || s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </Select>
          <Input label="Peso (kg)" help="Peso actual de la gallina en kilogramos. Importante para monitorear salud y rendimiento." type="number" step="0.01" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="Ej: 2.5" />
          <Textarea label="Notas" help="Observaciones sobre la gallina: comportamiento, salud, tratamientos, etc." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observaciones sobre la gallina..." />
          <div className="flex gap-3">
            <Button onClick={save} disabled={!form.code || !form.breed}>Actualizar</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
