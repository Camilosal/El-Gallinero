"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";

export interface FarmLocation {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  operationalStatus: string;
  sanitaryStatus: string;
  parentLocationId: string | null;
  parentName?: string | null;
  description: string | null;
  localReference: string | null;
  latitude: string | null;
  longitude: string | null;
  areaM2: string | null;
  capacity: number | null;
  sanitaryRequirements: string | null;
  sanitaryReviewedAt: string | null;
  operationalReviewedAt: string | null;
  maintenanceNeeds: string | null;
  notes: string | null;
  animals?: number;
  speciesCounts?: { species: string; total: number }[];
  eggsPeriod?: number;
  eggsBySpeciesPeriod?: { species: string; total: number }[];
  feedConsumedPeriod?: { unit: string | null; total: string }[];
  feedConsumptionLabel?: string;
  deathsPeriod?: number;
  healthControlsPeriod?: number;
  weightSamplesPeriod?: number;
  averageWeightBySpeciesPeriod?: { species: string; count: number; averageKg: string | null }[];
  meatProducedKgPeriod?: number;
  meatBySpeciesPeriod?: { species: string; totalKg: number }[];
  pendingMaintenance?: number;
  maintenanceCost?: number;
  capacityUsedPercent?: number | null;
}

export function useFarmLocations(activeOnly = true) {
  const [locations, setLocations] = useState<FarmLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const response = await apiFetch(`/api/ubicaciones${activeOnly ? "?active=true" : ""}`);
      if (response.ok) {
        const data = await response.json();
        setLocations(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);
  useEffect(() => { void load(); }, [load]);
  return { locations, loading, reload: load };
}

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  corral: "Corral",
  jaula: "Jaula",
  galpon: "Galpón",
  potrero: "Potrero",
  jardin: "Jardín",
  patio: "Patio",
  otro: "Otro",
};

export const OPERATIONAL_STATUS_LABELS: Record<string, string> = {
  operativa: "Operativa",
  mantenimiento: "En mantenimiento",
  restringida: "Restringida",
  fuera_servicio: "Fuera de servicio",
};

export const SANITARY_STATUS_LABELS: Record<string, string> = {
  pendiente_revision: "Pendiente de revisión",
  cumple: "Cumple según revisión registrada",
  requiere_atencion: "Requiere atención",
  no_cumple: "No cumple según revisión registrada",
};
