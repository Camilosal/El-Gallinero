"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Tag } from "lucide-react";
import { PageHeader, Card, Table, StatCard, EmptyState, Button, Badge } from "@/components/ui";
import { AppIcon } from "@/components/AppIcon";
import { apiFetch } from "@/lib/fetch";
import TableSearch from "@/components/TableSearch";
import { matchesTextQuery } from "@/lib/text";
import { SPECIES_ICON, SPECIES_LABEL } from "@/lib/species-params";

interface MeatSpeciesSummary {
  species: string;
  producedKg: number;
  availableKg: number;
  estimatedPriceKg: number;
  estimatedValue: number;
}

interface MeatLot {
  id: string;
  date: string;
  species: string;
  birdType: string;
  destination?: string | null;
  weightKgAutoconsumo?: number | null;
  weightKgExcedente?: number | null;
  quantityKg: number;
  soldKg: number;
  lostKg: number;
  remainingKg: number;
  ageDays: number;
}

interface InventoryData {
  summary: {
    produced: number;
    sold: number;
    lost: number;
    available: number;
    value: number;
    bySpecies?: MeatSpeciesSummary[];
  };
  lots: MeatLot[];
  oldestLot: MeatLot | null;
  estimatedValue: number;
}

const birdTypeLabels: Record<string, string> = {
  gallina_descarte: "Gallina descarte",
  pollo: "Pollo",
  gallo: "Gallo",
  codorniz: "Codorniz",
  pato: "Pato",
  conejo: "Conejo",
  cuy: "Cuy",
};

export default function InventarioCarnePage() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string>("all");

  const load = useCallback(() => {
    apiFetch("/api/inventarios/carne").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredLots = useMemo(() => {
    const lots = data?.lots ?? [];
    return lots.filter((lot) => {
      const sp = lot.species || "pollo";
      if (selectedSpeciesFilter !== "all" && sp !== selectedSpeciesFilter) {
        return false;
      }
      if (!search.trim()) return true;
      return matchesTextQuery(search, [
        lot.date,
        new Date(lot.date + "T12:00:00").toLocaleDateString("es"),
        sp,
        SPECIES_LABEL[sp],
        birdTypeLabels[lot.birdType] || lot.birdType,
        lot.destination,
        lot.quantityKg,
        lot.soldKg,
        lot.lostKg,
        lot.remainingKg,
        lot.ageDays,
      ]);
    });
  }, [data, search, selectedSpeciesFilter]);

  return (
    <div>
      <PageHeader
        title="Inventario de Carne Multiespecie"
        description="Stock de carne limpia en frío: pollo, gallina, codorniz, pato, conejo y cuy. Consumo FIFO."
        help="Inventario de carne disponible proveniente de faenas. Se muestra lo producido, vendido, perdido y disponible por especie y lote. Los precios de valoración se basan en el mercado local por kg canal."
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/produccion/sacrificio"><Button variant="secondary">Registrar Faena</Button></Link>
            <Link href="/dashboard/finanzas/ventas?tab=carne"><Button>+ Registrar Venta de Carne</Button></Link>
          </div>
        }
      />

      {/* StatCards Principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-6">
        <StatCard icon="beef" label="Producido Total (kg)" value={(data?.summary.produced ?? 0).toFixed(1)} color="green" />
        <StatCard icon="money" label="Vendido Total (kg)" value={(data?.summary.sold ?? 0).toFixed(1)} color="blue" />
        <StatCard icon="package" label="Disponible en Frío (kg)" value={(data?.summary.available ?? 0).toFixed(1)} color="yellow" />
        <StatCard icon="banknote" label="Valor Estimado Stock" value={`$${Math.round(data?.estimatedValue ?? 0).toLocaleString("es-CO")}`} color="purple" />
      </div>

      {/* Desglose por Especie */}
      {data?.summary.bySpecies && data.summary.bySpecies.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>Disponibilidad y Valoración por Especie</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {data.summary.bySpecies.map((spData) => {
              const icon = SPECIES_ICON[spData.species] || "meat";
              const label = SPECIES_LABEL[spData.species] || spData.species;
              return (
                <div key={spData.species} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 text-sm">
                      <AppIcon icon={icon} className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>{label}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">${spData.estimatedPriceKg.toLocaleString("es-CO")}/kg</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-700">
                    {spData.availableKg.toFixed(1)} <span className="text-xs text-slate-500 font-normal">kg disp.</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Valor: ${spData.estimatedValue.toLocaleString("es-CO")}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {loading ? (
        <Card><p className="text-center py-8 text-slate-400">Cargando...</p></Card>
      ) : data && data.summary.produced > 0 ? (
        <Card>
          {/* Filtros por Especie y Buscador */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap gap-1">
              {[
                { id: "all", label: "Todas las Carnes", icon: "globe" },
                { id: "pollo", label: "Pollo", icon: "rooster" },
                { id: "gallina", label: "Gallina", icon: "hen" },
                { id: "codorniz", label: "Codorniz", icon: "egg" },
                { id: "pato", label: "Pato", icon: "duck" },
                { id: "conejo", label: "Conejo", icon: "rabbit" },
                { id: "cuy", label: "Cuy", icon: "paw-print" },
              ].map((sp) => {
                const isSelected = selectedSpeciesFilter === sp.id;
                const count = sp.id === "all"
                  ? data.lots.length
                  : data.lots.filter((l) => (l.species || "pollo") === sp.id).length;
                return (
                  <button
                    key={sp.id}
                    onClick={() => setSelectedSpeciesFilter(sp.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <AppIcon icon={sp.icon} className="w-3.5 h-3.5" />
                    <span>{sp.label} ({count})</span>
                  </button>
                );
              })}
            </div>

            <TableSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar por fecha, especie, edad..."
              resultCount={filteredLots.length}
              totalCount={data.lots.length}
              className="w-full sm:w-64"
            />
          </div>

          {filteredLots.length === 0 ? (
            <EmptyState
              icon="meat"
              message={
                search.trim() || selectedSpeciesFilter !== "all"
                  ? "No hay lotes de carne que coincidan con los filtros"
                  : "No hay lotes de carne en inventario"
              }
            />
          ) : (
            <Table headers={["Fecha", "Especie / Tipo", "Destino Lote", "Producido (kg)", "Vendido (kg)", "Disponible (kg)", "Tiempo en Frío"]}>
              {filteredLots.map((lot) => {
                const sp = lot.species || "pollo";
                const icon = SPECIES_ICON[sp] || "meat";
                const isAvailable = lot.remainingKg > 0;

                return (
                  <tr key={lot.id} className={`hover:bg-slate-50 ${!isAvailable ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-sm font-medium">
                      {new Date(lot.date + "T12:00:00").toLocaleDateString("es")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <AppIcon icon={icon} className="w-4 h-4 text-slate-600 shrink-0" />
                        <span>{SPECIES_LABEL[sp] || sp}</span>
                      </div>
                      <span className="text-xs text-slate-400">{birdTypeLabels[lot.birdType] || lot.birdType}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {lot.destination === "consumo_propio" && <Badge color="green">Hogar</Badge>}
                      {lot.destination === "venta" && <Badge color="blue">Venta</Badge>}
                      {lot.destination === "mixto" && <Badge color="purple">Dual</Badge>}
                      {!lot.destination && <Badge color="gray">General</Badge>}
                    </td>
                    <td className="px-4 py-3 text-sm">{lot.quantityKg.toFixed(1)} kg</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{lot.soldKg.toFixed(1)} kg</td>
                    <td className="px-4 py-3 font-bold text-emerald-700 text-sm">
                      {lot.remainingKg.toFixed(1)} kg
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={lot.ageDays > 30 ? "text-red-600 font-semibold" : lot.ageDays > 14 ? "text-yellow-600" : "text-slate-600"}>
                        {lot.ageDays} días
                      </span>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      ) : (
        <Card>
          <EmptyState icon="meat" message="No hay producción de carne registrada. Registra faenas desde Producción → Faena." />
        </Card>
      )}
    </div>
  );
}
