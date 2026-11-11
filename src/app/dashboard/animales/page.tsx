"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, StatCard, Table, Badge, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";

interface AnimalGroup {
  key: string;
  label: string;
  species: string;
  speciesLabel: string;
  icon: string;
  count: number;
  avgWeightKg: number;
  totalWeightKg: number;
  pricePerKg: number;
  estimatedValue: number;
  weightEstimated: boolean;
  source: "hen" | "rooster" | "batch";
  locationName: string | null;
  detail?: string | null;
}

interface UnassignedAnimal {
  id: string;
  code: string;
  status: string;
  animalType: "gallina" | "gallo" | "lote";
  species: string;
  quantity: number;
}

interface AssignmentLocation { id: string; name: string; status: string; operationalStatus: string; }

interface AnimalSpecies {
  species: string;
  label: string;
  icon: string;
  isBird: boolean;
  count: number;
  totalWeightKg: number;
  estimatedValue: number;
}

interface AnimalInventory {
  summary: {
    totalAnimals: number;
    totalBirds: number;
    totalNonBirds: number;
    registeredHens: number;
    activeHens: number;
    layingHens: number;
    activeRoosters: number;
    activeBatches: number;
    totalWeightKg: number;
    totalValue: number;
  };
  species: AnimalSpecies[];
  groups: AnimalGroup[];
  byPurpose: { purpose: string; label: string; count: number }[];
}

const sourceLabels: Record<AnimalGroup["source"], string> = {
  hen: "Gallinas",
  rooster: "Gallos",
  batch: "Lote",
};

const sourceColors: Record<AnimalGroup["source"], "green" | "red" | "blue"> = {
  hen: "green",
  rooster: "red",
  batch: "blue",
};

const animalFilters = [
  { id: "gallina", label: "Gallinas", icon: "🐔" },
  { id: "gallo", label: "Gallos", icon: "🐓" },
  { id: "pollo", label: "Lotes de pollos", icon: "🐤" },
  { id: "codorniz", label: "Lotes de codornices", icon: "🥚" },
  { id: "pato", label: "Lotes de patos", icon: "🦆" },
  { id: "conejo", label: "Lotes de conejos", icon: "🐇" },
];

function groupMatchesAnimalFilter(group: AnimalGroup, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "gallina") return group.source === "hen";
  if (filter === "gallo") return group.source === "rooster";
  return group.source === "batch" && group.species === filter;
}

const quickLinks = [
  { href: "/dashboard/produccion/adquisiciones", label: "Adquisiciones", icon: "📥", desc: "Origen y destino de nuevas entradas" },
  { href: "/dashboard/produccion?tab=animales", label: "Gestión de Animales", icon: "🐾", desc: "Gallinas, gallos y lotes separados por especie" },
  { href: "/dashboard/produccion/mortalidad", label: "Mortalidad", icon: "💀", desc: "Bajas y causas por lote" },
  { href: "/dashboard/produccion?tab=incubacion", label: "Incubación", icon: "🐣", desc: "Nacimientos y fertilidad" },
];

const fmtMoney = (value: number) => `$${Math.round(value).toLocaleString("es-CO")}`;
const fmtKg = (value: number) => `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg`;

export default function AnimalesPage() {
  const [data, setData] = useState<AnimalInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("all");
  const [unassignedAnimals, setUnassignedAnimals] = useState<UnassignedAnimal[]>([]);
  const [locations, setLocations] = useState<AssignmentLocation[]>([]);
  const [targetByAnimal, setTargetByAnimal] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState("");
  const [assignmentError, setAssignmentError] = useState("");

  const loadInventory = useCallback(async () => {
    try {
      const [inventoryResult, queueResult, locationResult] = await Promise.allSettled([
        apiFetch("/api/inventarios/animales"), apiFetch("/api/ubicaciones/sin-asignar"), apiFetch("/api/ubicaciones"),
      ]);
      if (inventoryResult.status === "fulfilled" && inventoryResult.value.ok) setData(await inventoryResult.value.json());
      if (queueResult.status === "fulfilled" && queueResult.value.ok) setUnassignedAnimals(await queueResult.value.json());
      if (locationResult.status === "fulfilled" && locationResult.value.ok) setLocations(await locationResult.value.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void loadInventory().catch(console.error); });
    return () => cancelAnimationFrame(frame);
  }, [loadInventory]);

  const assignLocation = async (animal: UnassignedAnimal) => {
    const toLocationId = targetByAnimal[animal.id];
    if (!toLocationId) return setAssignmentError("Elige un lugar de destino para cada registro.");
    setAssignmentError("");
    setAssigningId(animal.id);
    try {
      const response = await apiFetch("/api/ubicaciones/movimientos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalType: animal.animalType, animalId: animal.id, toLocationId,
          date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
          reason: "Asignación de ubicación pendiente",
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setAssignmentError(result.error || "No se pudo asignar el lugar.");
        return;
      }
      setTargetByAnimal((current) => { const next = { ...current }; delete next[animal.id]; return next; });
      await loadInventory();
    } catch {
      setAssignmentError("No se pudo conectar para asignar el lugar.");
    } finally {
      setAssigningId("");
    }
  };

  const groups = useMemo(() => {
    const list = (data?.groups ?? []).filter((group) => groupMatchesAnimalFilter(group, speciesFilter));
    if (!search.trim()) return list;
    return list.filter((group) =>
      matchesTextQuery(search, [
        group.label,
        group.speciesLabel,
        group.detail,
        sourceLabels[group.source],
        group.count,
        group.avgWeightKg,
        group.totalWeightKg,
        group.estimatedValue,
      ]),
    );
  }, [data, search, speciesFilter]);

  const visibleSpecies = (data?.species ?? []).filter((species) => species.count > 0);
  const inventoryValue = data?.summary.totalValue ?? 0;

  return (
    <div>
      <PageHeader
        title="🐾 Inventario de Animales"
        description="Inventario y seguimiento unificado de gallinas, gallos, pollos, codornices, patos y conejos."
        help="Aquí ves los animales que están en la granja, separados por especie en los filtros. Para registrar una entrada nueva, empieza por Adquisiciones: ahí indicas el tipo, su raza asociada y el origen. El inventario incluye únicamente animales no vendidos, faenados ni muertos."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/produccion/adquisiciones"
              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              + Registrar ingreso
            </Link>
          </div>
        }
      />

      {loading ? (
        <Card>
          <p className="py-8 text-center text-slate-400">Cargando inventario de animales...</p>
        </Card>
      ) : !data ? (
        <Card>
          <EmptyState icon="🐾" message="No se pudo cargar el inventario de animales" />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon="🐾" label="Animales en inventario" value={data.summary.totalAnimals} color="green" />
            <StatCard icon="🐔" label="Aves" value={data.summary.totalBirds} color="yellow" />
            <StatCard icon="🐇" label="No aves" value={data.summary.totalNonBirds} color="blue" />
            <StatCard icon="💰" label="Valor estimado" value={fmtMoney(inventoryValue)} color="purple" />
          </div>

          <Card>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <span className="text-slate-600">
                🐔 <strong className="text-slate-900">{data.summary.activeHens}</strong> gallinas en inventario
              </span>
              <span className="text-slate-600">
                🥚 <strong className="text-slate-900">{data.summary.layingHens}</strong> en postura
              </span>
              <span className="text-slate-600">
                🐓 <strong className="text-slate-900">{data.summary.activeRoosters}</strong> gallos activos
              </span>
              <span className="text-slate-600">
                🧺 <strong className="text-slate-900">{data.summary.activeBatches}</strong> lotes activos
              </span>
              <span className="text-slate-600">
                ⚖️ <strong className="text-slate-900">{fmtKg(data.summary.totalWeightKg)}</strong> en pie
              </span>
              <span className="text-slate-500">
                {data.summary.registeredHens} gallinas registradas en total
              </span>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="text-2xl">{link.icon}</span>
                <p className="mt-2 font-semibold text-slate-800">{link.label}</p>
                <p className="mt-1 text-xs text-slate-500">{link.desc}</p>
              </Link>
            ))}
          </div>

          {visibleSpecies.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Composición por especie</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {visibleSpecies.map((species) => (
                  <Card key={species.species}>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{species.icon}</span>
                      <Badge color={species.isBird ? "green" : "blue"}>
                        {species.isBird ? "Ave" : "No ave"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{species.count}</p>
                    <p className="text-sm text-slate-600">{species.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{fmtKg(species.totalWeightKg)}</p>
                    <p className="text-xs font-semibold text-green-700">{fmtMoney(species.estimatedValue)}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {unassignedAnimals.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/60">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-amber-950">Pendientes de asignar lugar</h2>
                  <p className="mt-1 text-sm text-amber-800">{unassignedAnimals.reduce((sum, animal) => sum + animal.quantity, 0)} animales activos no tienen una ubicación actual registrada. Asignarlos conserva el historial de traslado.</p>
                </div>
                {locations.length === 0 && <Link href="/dashboard/ubicaciones" className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white">Crear un lugar</Link>}
              </div>
              {assignmentError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{assignmentError}</p>}
              <div className="space-y-2">
                {unassignedAnimals.map((animal) => (
                  <div key={animal.id} className="grid gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                    <div><strong className="text-sm text-slate-800">{animal.code}</strong><p className="text-xs text-slate-500">{animal.species} · {animal.quantity} · {animal.status}</p></div>
                    <select aria-label={`Lugar de ${animal.code}`} value={targetByAnimal[animal.id] || ""} onChange={(event) => setTargetByAnimal((current) => ({ ...current, [animal.id]: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      <option value="">Selecciona un lugar…</option>
                      {locations.filter((location) => location.status === "activa" && !["fuera_servicio", "restringida"].includes(location.operationalStatus)).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                    <button type="button" disabled={assigningId === animal.id || locations.length === 0} onClick={() => void assignLocation(animal)} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{assigningId === animal.id ? "Guardando…" : "Asignar lugar"}</button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Registro unificado</h2>
                <p className="text-sm text-slate-500">
                  Gallinas y gallos individuales, con lotes agrupados y filtrables por especie.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {data.groups.length} grupos de animales
              </span>
            </div>

            <TableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar por código, especie, origen o valor..."
              resultCount={groups.length}
              totalCount={data.groups.filter((group) => groupMatchesAnimalFilter(group, speciesFilter)).length}
              className="mb-4"
            />

            <div className="mb-4 flex flex-wrap gap-2" aria-label="Filtrar inventario por tipo de animal">
              <button
                type="button"
                aria-pressed={speciesFilter === "all"}
                onClick={() => setSpeciesFilter("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${speciesFilter === "all" ? "bg-green-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Todos ({data.summary.totalAnimals})
              </button>
              {animalFilters.map((filter) => {
                const count = data.groups.filter((group) => groupMatchesAnimalFilter(group, filter.id)).reduce((sum, group) => sum + group.count, 0);
                if (count === 0) return null;
                return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={speciesFilter === filter.id}
                  onClick={() => setSpeciesFilter(filter.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${speciesFilter === filter.id ? "bg-green-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {filter.icon} {filter.label} ({count})
                </button>
                );
              })}
            </div>

            {groups.length === 0 ? (
              <EmptyState
                icon="🐾"
                message={
                  search.trim()
                    ? "No hay animales que coincidan con la búsqueda"
                    : speciesFilter !== "all" ? "No hay animales de esta especie en inventario" : "No hay animales en inventario"
                }
              />
            ) : (
              <Table
                headers={[
                  "Grupo",
                  "Especie",
                  "Origen",
                  "Lugar actual",
                  "Cantidad",
                  "Peso prom.",
                  "Peso total",
                  "Valor estimado",
                ]}
              >
                {groups.map((group) => (
                  <tr key={group.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">
                        {group.icon} {group.label}
                      </div>
                      {group.detail && <p className="text-xs text-slate-500">{group.detail}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm">{group.speciesLabel}</td>
                    <td className="px-4 py-3">
                      <Badge color={sourceColors[group.source]}>{sourceLabels[group.source]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{group.locationName || <span className="font-medium text-amber-700">Sin lugar asignado</span>}</td>
                    <td className="px-4 py-3 font-semibold">{group.count}</td>
                    <td className="px-4 py-3 text-sm">
                      {fmtKg(group.avgWeightKg)}
                      {group.weightEstimated && (
                        <span className="ml-1 text-[11px] text-amber-600">estimado</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{fmtKg(group.totalWeightKg)}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">
                      {fmtMoney(group.estimatedValue)}
                    </td>
                  </tr>
                ))}
              </Table>
            )}

            <p className="mt-3 text-xs text-slate-500">
              El valor usa el precio de Catálogos y el peso real cuando existe; si no, el peso objetivo de la especie.
            </p>
          </Card>

          {data.byPurpose.length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Lotes por propósito</h2>
              <div className="flex flex-wrap gap-2">
                {data.byPurpose.map((purpose) => (
                  <span
                    key={purpose.purpose}
                    className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
                  >
                    {purpose.label}: {purpose.count}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
