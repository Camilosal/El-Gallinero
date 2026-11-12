"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/AppIcon";
import TableSearch from "@/components/TableSearch";
import { EmptyState, PageHeader } from "@/components/ui";
import { matchesTextQuery } from "@/lib/text";
import GallinasTab from "./GallinasTab";
import PollosTab from "./PollosTab";

type AnimalSection = "resumen" | "gallinas" | "gallos" | "pollos" | "codornices" | "patos" | "conejos";

const tabs: { id: AnimalSection; label: string; icon: string }[] = [
  { id: "resumen", label: "Resumen", icon: "paw-print" },
  { id: "gallinas", label: "Gallinas", icon: "hen" },
  { id: "gallos", label: "Gallos", icon: "rooster" },
  { id: "pollos", label: "Lotes de pollos", icon: "chick" },
  { id: "codornices", label: "Lotes de codornices", icon: "egg" },
  { id: "patos", label: "Lotes de patos", icon: "duck" },
  { id: "conejos", label: "Lotes de conejos", icon: "rabbit" },
];

const animalTypeByTab: Partial<Record<AnimalSection, string>> = {
  gallinas: "gallina",
  gallos: "gallo",
  pollos: "lote_pollos",
  codornices: "codorniz",
  patos: "pato",
  conejos: "conejo",
};

const batchSpeciesByTab: Partial<Record<AnimalSection, string>> = {
  pollos: "pollo",
  codornices: "codorniz",
  patos: "pato",
  conejos: "conejo",
};

export default function AnimalesTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const requestedTab = searchParams.get("tab");
  const rawSubtab = searchParams.get("subtab");
  const requestedSubtab = rawSubtab === "lotes" ? "pollos" : rawSubtab;
  const normalizedTab = requestedTab === "lotes" ? "pollos" : requestedTab;
  const activeTab: AnimalSection = requestedSubtab && Object.hasOwn(animalTypeByTab, requestedSubtab)
    ? requestedSubtab as AnimalSection
    : normalizedTab && Object.hasOwn(animalTypeByTab, normalizedTab)
      ? normalizedTab as AnimalSection
      : "resumen";

  const selectTab = (tab: AnimalSection) => {
    router.replace(`/dashboard/produccion?tab=animales&subtab=${tab}`, { scroll: false });
  };

  const acquisitionPreset = animalTypeByTab[activeTab];
  const speciesCards = tabs.filter((tab) => tab.id !== "resumen");
  const visibleSpeciesCards = speciesCards.filter((tab) => {
    const desc =
      tab.id === "gallinas" || tab.id === "gallos"
        ? "Fichas individuales y su estado actual."
        : "Registro y seguimiento agrupado por lote.";
    return matchesTextQuery(search, [tab.label, desc]);
  });

  return (
    <div className="space-y-5">
      <PageHeader
        theme="aves"
        title="Gestión de Animales"
        description="Registro, seguimiento y estado de gallinas, gallos, pollos, codornices, patos y conejos."
        help="Cada pestaña muestra una especie o tipo de animal por separado. Las gallinas y gallos tienen ficha individual; pollos, codornices, patos y conejos se manejan por lote. Adquisiciones conserva el criador, ubicación, lote de origen, línea genética, generación, progenitores y referencias documentales enlazadas a cada ficha o lote."
        actions={
          <Link
            href={acquisitionPreset ? `/dashboard/produccion/adquisiciones?nuevo=${acquisitionPreset}` : "/dashboard/produccion/adquisiciones"}
            className="inline-flex items-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
          >
            + Registrar ingreso y genética
          </Link>
        }
      />

      <div className="flex w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 sm:w-fit" role="tablist" aria-label="Tipo de animal">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => selectTab(tab.id)}
            className={`inline-flex items-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
          >
            <AppIcon icon={tab.icon} className="w-4 h-4 mr-1.5 shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "resumen" ? (
        <div className="space-y-4">
          <TableSearch
            value={search}
            onChange={setSearch}
            placeholder="Buscar especie o tipo de animal..."
            resultCount={visibleSpeciesCards.length}
            totalCount={speciesCards.length}
          />
          {visibleSpeciesCards.length === 0 ? (
            <EmptyState
              icon="paw-print"
              message="No hay especies o grupos que coincidan con la búsqueda"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleSpeciesCards.map((tab) => {
                const preset = animalTypeByTab[tab.id];
                return (
                  <section key={tab.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                      <AppIcon icon={tab.icon} className="w-5 h-5" />
                    </div>
                    <h2 className="mt-3 font-semibold text-slate-800">{tab.label}</h2>
                    <p className="mt-1 text-sm text-slate-500">{tab.id === "gallinas" || tab.id === "gallos" ? "Fichas individuales y su estado actual." : "Registro y seguimiento agrupado por lote."}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => selectTab(tab.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Ver registros</button>
                      <Link href={`/dashboard/produccion/adquisiciones?nuevo=${preset}`} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800">Registrar ingreso</Link>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "gallinas" ? (
        <GallinasTab embedded />
      ) : (
        <PollosTab
          key={activeTab}
          embedded
          initialTab={activeTab === "gallos" ? "gallos" : "lotes"}
          initialSpeciesFilter={batchSpeciesByTab[activeTab] || "all"}
        />
      )}
    </div>
  );
}
