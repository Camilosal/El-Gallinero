"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, lazy } from "react";

const PlanSanitarioTab = lazy(() => import("./_components/PlanSanitarioTab"));

const tabComponents: Record<string, React.ComponentType> = {
  plan: PlanSanitarioTab,
};

function TabFallback() {
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SanidadPage() {
  return (
    <Suspense fallback={<TabFallback />}>
      <SanidadContent />
    </Suspense>
  );
}

function SanidadContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const TabComponent = tab ? tabComponents[tab] : null;

  if (TabComponent) {
    return (
      <Suspense fallback={<TabFallback />}>
        <TabComponent />
      </Suspense>
    );
  }

  // Default: show Plan Sanitario directly
  return (
    <Suspense fallback={<TabFallback />}>
      <PlanSanitarioTab />
    </Suspense>
  );
}
