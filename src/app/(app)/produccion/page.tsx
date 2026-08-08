"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HuevosTab from "./_components/HuevosTab";
import CarneTab from "./_components/CarneTab";
import GallinasTab from "./_components/GallinasTab";
import PollosTab from "./_components/PollosTab";
import GallinazaTab from "./_components/GallinazaTab";
import IncubacionTab from "./_components/IncubacionTab";
import AlimentacionTab from "./_components/AlimentacionTab";

const TABS = [
  { key: "huevos", label: "🥚 Huevos", View: HuevosTab },
  { key: "carne", label: "🍗 Carne", View: CarneTab },
  { key: "gallinas", label: "🐔 Gallinas", View: GallinasTab },
  { key: "pollos", label: "🐓 Pollos y Gallos", View: PollosTab },
  { key: "gallinaza", label: "🌱 Gallinaza", View: GallinazaTab },
  { key: "incubacion", label: "🐣 Incubación", View: IncubacionTab },
  { key: "alimentacion", label: "🌾 Alimentación", View: AlimentacionTab },
];

function ProduccionTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const active = TABS.find((t) => t.key === param) ?? TABS[0];
  const ActiveView = active.View;

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit max-w-full">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => router.replace(`/produccion?tab=${t.key}`, { scroll: false })}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              active.key === t.key ? "bg-white text-green-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ActiveView />
    </div>
  );
}

export default function ProduccionPage() {
  return (
    <Suspense fallback={null}>
      <ProduccionTabs />
    </Suspense>
  );
}
