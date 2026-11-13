"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";
import { getCachedCatalog, setCachedCatalog } from "@/lib/offline/db";

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
  zoneType?: string;
  allowedSpecies?: string[];
  sanitaryEmptyUntil?: string | null;
  altitudeMeters?: number | null;
  floorType?: string | null;
  environmentalTempC?: string | null;
  isQuarantine?: boolean;
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

  const cacheKey = `farm_locations_${activeOnly ? "active" : "all"}`;

  const load = useCallback(async () => {
    try {
      const cached = await getCachedCatalog<FarmLocation[]>(cacheKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setLocations(cached);
        setLoading(false);
      }
    } catch {
      // Ignore cache errors
    }

    try {
      const response = await apiFetch(`/api/ubicaciones${activeOnly ? "?active=true" : ""}`);
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        setLocations(list);
        void setCachedCatalog(cacheKey, list);
      }
    } catch {
      // Offline fallback already loaded
    } finally {
      setLoading(false);
    }
  }, [activeOnly, cacheKey]);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  return { locations, loading, reload: load };
}

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  corral: "Corral",
  jaula: "Jaula",
  galpon: "Galpón",
  potrero: "Potrero",
  jardin: "Jardín",
  patio: "Patio",
  compostaje: "Zona de compostaje",
  bodega: "Bodega / Almacén",
  cuarentena: "Área de cuarentena",
  otro: "Otro",
};

export const ZONE_TYPE_LABELS: Record<string, string> = {
  limpia: "Zona Limpia",
  sucia: "Zona Sucia / Desechos",
  produccion: "Zona de Producción",
  cuarentena: "Cuarentena / Aislamiento",
  almacen: "Bodega / Almacén",
  forraje: "Banco de Forraje",
};

export const FLOOR_TYPE_LABELS: Record<string, string> = {
  tierra: "Tierra",
  cemento: "Cemento",
  cama_profunda: "Cama profunda / Viruta",
  jaula_elevada: "Jaula elevada / Malla",
  pasto: "Pasto / Pastoreo",
  mixto: "Mixto",
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
