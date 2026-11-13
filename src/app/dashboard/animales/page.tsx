"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bird, Egg, Feather, PackageOpen, Scale } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { PageHeader, Card, StatCard, Table, Badge, EmptyState } from "@/components/ui";
import TableSearch from "@/components/TableSearch";
import { apiFetch } from "@/lib/fetch";
import { matchesTextQuery } from "@/lib/text";
import { isHrefEnabledByFlags } from "@/lib/onboarding";
import { useOnboardingState } from "@/lib/useOnboardingState";

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
  { id: "gallina", label: "Gallinas", icon: "hen" },
  { id: "gallo", label: "Gallos", icon: "rooster" },
  { id: "pollo", label: "Lotes de pollos", icon: "chick" },
  { id: "codorniz", label: "Lotes de codornices", icon: "egg" },
  { id: "pato", label: "Lotes de patos", icon: "duck" },
  { id: "conejo", label: "Lotes de conejos", icon: "rabbit" },
  { id: "cuy", label: "Lotes de cuyes", icon: "paw-print" },
];

function groupMatchesAnimalFilter(group: AnimalGroup, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "gallina") return group.source === "hen";
  if (filter === "gallo") return group.source === "rooster";
  return group.source === "batch" && group.species === filter;
}

const quickLinks = [
  { href: "/dashboard/produccion/adquisiciones", label: "Adquisiciones", icon: "incoming", desc: "Origen y destino de nuevas entradas" },
  { href: "/dashboard/produccion?tab=animales", label: "Gestión de Animales", icon: "paw-print", desc: "Gallinas, gallos, conejos, cuyes y lotes por especie" },
  { href: "/dashboard/ubicaciones", label: "Lugares de manejo", icon: "map-pin", desc: "Corrales, galpones, jaulas y potreros" },
  { href: "/dashboard/produccion?tab=reproduccion", label: "Reproducción", icon: "rabbit", desc: "Empadre, palpación, parto, destete y consanguinidad" },
  { href: "/dashboard/produccion/peso", label: "Control de peso", icon: "scale", desc: "Biometría, ganancia diaria, CV% y uniformidad" },
  { href: "/dashboard/produccion?tab=incubacion", label: "Incubación", icon: "incubator", desc: "Nacimientos, ovoscopía y fertilidad" },
  { href: "/dashboard/produccion/mortalidad", label: "Mortalidad", icon: "mortality", desc: "Bajas y causas por lote o ficha" },
];

const fmtMoney = (value: number) => `$${Math.round(value).toLocaleString("es-CO")}`;
const fmtKg = (value: number) => `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg`;

export default function AnimalesPage() {
  const [data, setData] = useState<AnimalInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("all");
  const { config, flags } = useOnboardingState();
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

  const visibleSpecies = (data?.species ?? []).filter((species) => {
    if (species.count <= 0) return false;
    if (!search.trim()) return true;
    return matchesTextQuery(search, [species.label, species.species, species.isBird ? "ave" : "no ave", species.count]);
  });
  const hasMammals = Boolean(
    data?.species?.some((s) => (s.species === "conejo" || s.species === "cuy") && s.count > 0) ||
      config?.selectedSpecies?.some((s) => s === "conejo" || s === "cuy"),
  );
  const hasWeightFocus = Boolean(
    config?.scale === "MEDIANO" ||
      hasMammals ||
      data?.species?.some((s) => s.species === "pollo" && s.count > 0) ||
      config?.selectedSpecies?.some((s) => s === "pollo"),
  );
  const visibleQuickLinks = useMemo(() => {
    const enabled = quickLinks.filter((l) => {
      if (!isHrefEnabledByFlags(l.href, flags)) return false;
      if (config?.scale === "PEQUENO" && l.href === "/dashboard/produccion?tab=reproduccion" && !hasMammals) {
        return false;
      }
      if (config?.scale === "PEQUENO" && l.href === "/dashboard/produccion/peso" && !hasWeightFocus) {
        return false;
      }
      return true;
    });
    return search.trim() ? enabled.filter((l) => matchesTextQuery(search, [l.label, l.desc])) : enabled;
  }, [config?.scale, flags, hasMammals, hasWeightFocus, search]);
  const visibleUnassigned = useMemo(
    () =>
      search.trim()
        ? unassignedAnimals.filter((a) => matchesTextQuery(search, [a.code, a.species, a.animalType, a.status]))
        : unassignedAnimals,
    [unassignedAnimals, search],
  );
  const inventoryValue = data?.summary.totalValue ?? 0;

  return (
    <div>
      <PageHeader
        title="Inventario de Animales"
        description="Inventario y seguimiento unificado de gallinas, gallos, pollos, codornices, patos, conejos y cuyes."
        help="Aquí ves los animales activos en la granja separados por especie, junto con accesos directos a Adquisiciones, Gestión de Animales, Lugares de manejo, Reproducción (conejos y cuyes), Control de peso y biometría, Incubación y Mortalidad. El inventario excluye animales vendidos, faenados o fallecidos."
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
          <EmptyState icon="paw-print" message="No se pudo cargar el inventario de animales" />
        </Card>
      ) : (
        <div className="space-y-6">
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar animales por código, especie, lugar, origen o módulo..."
            resultCount={groups.length}
            totalCount={data.groups.filter((group) => groupMatchesAnimalFilter(group, speciesFilter)).length}
          />

          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            <StatCard icon="paw-print" label="Animales en inventario" value={data.summary.totalAnimals} color="green" />
            <StatCard icon="hen" label="Aves" value={data.summary.totalBirds} color="yellow" />
            <StatCard icon="rabbit" label="No aves" value={data.summary.totalNonBirds} color="blue" />
            <StatCard icon="money" label="Valor estimado" value={fmtMoney(inventoryValue)} color="purple" />
          </div>

          <Card>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Bird className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <strong className="text-slate-900">{data.summary.activeHens}</strong> gallinas en inventario
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Egg className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <strong className="text-slate-900">{data.summary.layingHens}</strong> en postura
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Feather className="w-4 h-4 text-orange-600" aria-hidden="true" />
                <strong className="text-slate-900">{data.summary.activeRoosters}</strong> gallos activos
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <PackageOpen className="w-4 h-4 text-blue-600" aria-hidden="true" />
                <strong className="text-slate-900">{data.summary.activeBatches}</strong> lotes activos
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <Scale className="w-4 h-4 text-slate-600" aria-hidden="true" />
                <strong className="text-slate-900">{fmtKg(data.summary.totalWeightKg)}</strong> en pie
              </span>
              <span className="text-slate-500">
                {data.summary.registeredHens} gallinas registradas en total
              </span>
            </div>
          </Card>

          {visibleQuickLinks.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              {visibleQuickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 min-w-0 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                    <AppIcon icon={link.icon} className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <p className="mt-2 text-xs sm:text-base font-semibold text-slate-800 leading-snug">{link.label}</p>
                  <p className="mt-1 text-[11px] sm:text-xs text-slate-500 line-clamp-2">{link.desc}</p>
                </Link>
              ))}
            </div>
          )}

          {visibleSpecies.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-800">Composición por especie</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                {visibleSpecies.map((species) => (
                  <Card key={species.species}>
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                        <AppIcon icon={species.icon} className="w-5 h-5" />
                      </div>
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

          {visibleUnassigned.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/60">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-amber-950">Pendientes de asignar lugar</h2>
                  <p className="mt-1 text-sm text-amber-800">{visibleUnassigned.reduce((sum, animal) => sum + animal.quantity, 0)} animales activos no tienen una ubicación actual registrada. Asignarlos conserva el historial de traslado.</p>
                </div>
                {locations.length === 0 && <Link href="/dashboard/ubicaciones?nuevo=1" className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white">Crear un lugar</Link>}
              </div>
              {assignmentError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{assignmentError}</p>}
              <div className="space-y-2">
                {visibleUnassigned.map((animal) => (
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
                {groups.length} de {data.groups.length} grupos de animales
              </span>
            </div>

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
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${speciesFilter === filter.id ? "bg-green-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    <AppIcon icon={filter.icon} className="w-3.5 h-3.5" />
                    <span>{filter.label} ({count})</span>
                  </button>
                );
              })}
            </div>

            {groups.length === 0 ? (
              <EmptyState
                icon="paw-print"
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
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <AppIcon icon={group.icon} className="w-4 h-4 shrink-0 text-slate-600" />
                        <span>{group.label}</span>
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
