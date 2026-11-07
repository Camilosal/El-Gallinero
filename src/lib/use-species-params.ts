"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";
import { SPECIES_PARAMS, type SpeciesProductionParams } from "@/lib/species-params";

/**
 * Parámetros productivos por especie para componentes de cliente.
 *
 * Se cargan desde `/api/especies/params`, que lee Catálogos → Especies.
 * Mientras llega la respuesta (o si la API falla) se usa la referencia
 * estática para que la UI nunca quede vacía.
 *
 * El resultado se cachea a nivel de módulo: varias pestañas comparten una
 * sola petición durante la sesión del navegador.
 */

let cached: SpeciesProductionParams[] | null = null;
let inflight: Promise<SpeciesProductionParams[]> | null = null;

function normalizeRows(data: unknown): SpeciesProductionParams[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is SpeciesProductionParams =>
      Boolean(row) && typeof row === "object" && typeof (row as { species?: unknown }).species === "string",
  );
}

export function loadSpeciesParamsClient(): Promise<SpeciesProductionParams[]> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = apiFetch("/api/especies/params")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const rows = normalizeRows(data);
        cached = rows.length > 0 ? rows : SPECIES_PARAMS;
        return cached;
      })
      .catch(() => {
        cached = SPECIES_PARAMS;
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useSpeciesCatalog() {
  const [params, setParams] = useState<SpeciesProductionParams[]>(cached || SPECIES_PARAMS);

  useEffect(() => {
    let alive = true;
    loadSpeciesParamsClient().then((rows) => {
      if (alive) setParams(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  const getParams = useCallback(
    (species: string, breed?: string): SpeciesProductionParams | undefined => {
      if (breed) {
        const needle = breed.trim().toLowerCase();
        const exact = params.find(
          (row) => row.species === species && row.breed.toLowerCase().includes(needle),
        );
        if (exact) return exact;
      }
      return params.find((row) => row.species === species);
    },
    [params],
  );

  const getMany = useCallback(
    (species: string): SpeciesProductionParams[] => params.filter((row) => row.species === species),
    [params],
  );

  const priceKg = useCallback(
    (species: string): number => getParams(species)?.marketPriceKgCanalCOP ?? 14000,
    [getParams],
  );

  const priceEgg = useCallback(
    (species: string): number => getParams(species)?.marketPriceEggUnitCOP ?? 600,
    [getParams],
  );

  return { params, getParams, getMany, priceKg, priceEgg };
}
