"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import GallinasTab from "./GallinasTab";
import PollosTab from "./PollosTab";

type AnimalSection = "gallinas" | "gallos" | "pollos" | "codornices" | "patos" | "conejos";

const tabs: { id: AnimalSection; label: string; icon: string }[] = [
  { id: "gallinas", label: "Gallinas", icon: "🐔" },
  { id: "gallos", label: "Gallos", icon: "🐓" },
  { id: "pollos", label: "Lotes de pollos", icon: "🐤" },
  { id: "codornices", label: "Lotes de codornices", icon: "🥚" },
  { id: "patos", label: "Lotes de patos", icon: "🦆" },
  { id: "conejos", label: "Lotes de conejos", icon: "🐇" },
];

const animalTypeByTab: Record<AnimalSection, string> = {
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
  const requestedTab = searchParams.get("tab");
  const rawSubtab = searchParams.get("subtab");
  const requestedSubtab = rawSubtab === "lotes" ? "pollos" : rawSubtab;
  const normalizedTab = requestedTab === "lotes" ? "pollos" : requestedTab;
  const activeTab: AnimalSection = requestedSubtab && Object.hasOwn(animalTypeByTab, requestedSubtab)
    ? requestedSubtab as AnimalSection
    : normalizedTab && Object.hasOwn(animalTypeByTab, normalizedTab)
      ? normalizedTab as AnimalSection
      : "gallinas";

  const selectTab = (tab: AnimalSection) => {
    router.replace(`/dashboard/produccion?tab=animales&subtab=${tab}`, { scroll: false });
  };

  const acquisitionPreset = animalTypeByTab[activeTab];

  return (
    <div className="space-y-5">
      <PageHeader
        title="🐾 Gestión de Animales"
        description="Registro, seguimiento y estado de gallinas, gallos, pollos, codornices, patos y conejos."
        help="Cada pestaña muestra una especie o tipo de animal por separado. Las gallinas y gallos tienen ficha individual; pollos, codornices, patos y conejos se manejan por lote. Adquisiciones conserva el criador, ubicación, lote de origen, línea genética, generación, progenitores y referencias documentales enlazadas a cada ficha o lote."
        actions={
          <Link
            href={`/dashboard/produccion/adquisiciones?nuevo=${acquisitionPreset}`}
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
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"}`}
          >
            <span className="mr-2" aria-hidden="true">{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {activeTab === "gallinas" ? (
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
