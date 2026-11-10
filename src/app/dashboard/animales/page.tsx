"use client";

import { useEffect, useMemo, useState } from "react";
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
  detail?: string | null;
}

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

const quickLinks = [
  { href: "/dashboard/produccion?tab=gallinas", label: "Gallinas", icon: "🐔", desc: "Registro individual y postura" },
  { href: "/dashboard/produccion?tab=pollos", label: "Gallos y lotes", icon: "🐓", desc: "Reproductores y lotes multiespecie" },
  { href: "/dashboard/produccion/adquisiciones", label: "Adquisiciones", icon: "📥", desc: "Compras, donaciones y entradas" },
  { href: "/dashboard/produccion/mortalidad", label: "Mortalidad", icon: "💀", desc: "Bajas y causas por lote" },
  { href: "/dashboard/produccion?tab=incubacion", label: "Incubación", icon: "🐣", desc: "Nacimientos y fertilidad" },
];

const fmtMoney = (value: number) => `$${Math.round(value).toLocaleString("es-CO")}`;
const fmtKg = (value: number) => `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg`;

export default function AnimalesPage() {
  const [data, setData] = useState<AnimalInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/inventarios/animales")
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const list = data?.groups ?? [];
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
  }, [data, search]);

  const visibleSpecies = (data?.species ?? []).filter((species) => species.count > 0);
  const inventoryValue = data?.summary.totalValue ?? 0;

  return (
    <div>
      <PageHeader
        title="🐾 Animales"
        description="Inventario y registro unificado de gallinas, gallos, pollos, codornices, patos y conejos."
        help="Aquí ves todos los animales que hoy están en la granja, sin importar la especie ni si están en un lote. El inventario incluye únicamente animales no vendidos, faenados ni muertos. El valor se calcula con el peso real o el peso objetivo y los precios de Catálogos.\n\n• Gallinas: registro individual, estado y postura.\n• Gallos y lotes: reproductores y lotes de crianza o engorde multiespecie.\n• Adquisiciones: compras, donaciones y entradas de animales.\n• Mortalidad: bajas y causas.\n• Incubación: nacimientos y fertilidad."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/produccion?tab=gallinas"
              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              + Gallina
            </Link>
            <Link
              href="/dashboard/produccion?tab=pollos"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              + Lote / Gallo
            </Link>
            <Link
              href="/dashboard/produccion/adquisiciones"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Registrar adquisición
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Registro unificado</h2>
                <p className="text-sm text-slate-500">
                  Gallinas y gallos individuales, más los lotes multiespecie, en una sola lista.
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
              totalCount={data.groups.length}
              className="mb-4"
            />

            {groups.length === 0 ? (
              <EmptyState
                icon="🐾"
                message={
                  search.trim()
                    ? "No hay animales que coincidan con la búsqueda"
                    : "No hay animales en inventario"
                }
              />
            ) : (
              <Table
                headers={[
                  "Grupo",
                  "Especie",
                  "Origen",
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
