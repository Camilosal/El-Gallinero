"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";
import { SPECIES_BIOLOGY_FALLBACKS, type SpeciesProductionParams } from "@/lib/species-params";

/**
 * Parámetros productivos por especie para componentes de cliente.
 *
 * Se cargan desde `/api/especies/params`, que lee Catálogos → Especies.
 * Mientras llega la respuesta (o si la API falla) se usan referencias
 * biológicas estáticas sin valores económicos para no presentar precios obsoletos.
 *
 * El resultado se cachea a nivel de módulo: varias pestañas comparten una
 * sola petición durante la sesión del navegador.
 */

let cached: SpeciesProductionParams[] | null = null;
let cachedMasterRows: SpeciesProductionParams[] | null = null;
let cachedAt = 0;
let inflight: Promise<SpeciesProductionParams[]> | null = null;
const SPECIES_CACHE_TTL_MS = 30_000;
const speciesSubscribers = new Set<(params: SpeciesProductionParams[], masterParams: SpeciesProductionParams[]) => void>();

function publishSpeciesParams(): void {
  const params = cached || SPECIES_BIOLOGY_FALLBACKS;
  const masterParams = cachedMasterRows || [];
  for (const subscriber of speciesSubscribers) subscriber(params, masterParams);
}

function normalizeRows(data: unknown): SpeciesProductionParams[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is SpeciesProductionParams =>
      Boolean(row) && typeof row === "object" && typeof (row as { species?: unknown }).species === "string",
  );
}

function withBiologyFallbacks(rows: SpeciesProductionParams[]): SpeciesProductionParams[] {
  if (rows.length === 0) return SPECIES_BIOLOGY_FALLBACKS;
  const configuredSpecies = new Set(rows.map((row) => row.species));
  const missingSpecies = SPECIES_BIOLOGY_FALLBACKS.filter((row) => !configuredSpecies.has(row.species));
  return [...rows, ...missingSpecies];
}

export function loadSpeciesParamsClient(forceRefresh = false): Promise<SpeciesProductionParams[]> {
  if (!forceRefresh && cached && Date.now() - cachedAt < SPECIES_CACHE_TTL_MS) return Promise.resolve(cached);
  if (!inflight) {
    inflight = apiFetch("/api/especies/params?masterOnly=true")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const rows = normalizeRows(data);
        cachedMasterRows = rows;
        cached = withBiologyFallbacks(rows);
        cachedAt = Date.now();
        publishSpeciesParams();
        return cached;
      })
      .catch(() => {
        cachedMasterRows = [];
        cached = SPECIES_BIOLOGY_FALLBACKS;
        cachedAt = Date.now();
        publishSpeciesParams();
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function loadSpeciesMasterParamsClient(forceRefresh = false): Promise<SpeciesProductionParams[]> {
  await loadSpeciesParamsClient(forceRefresh);
  return cachedMasterRows || [];
}

export function invalidateSpeciesParamsCache(): void {
  cached = null;
  cachedMasterRows = null;
  cachedAt = 0;
  if (speciesSubscribers.size > 0) void loadSpeciesParamsClient(true);
}

export function useSpeciesCatalog() {
  const [params, setParams] = useState<SpeciesProductionParams[]>(cached || SPECIES_BIOLOGY_FALLBACKS);
  const [masterRows, setMasterRows] = useState<SpeciesProductionParams[]>(cachedMasterRows || []);

  useEffect(() => {
    let alive = true;
    const update = (rows: SpeciesProductionParams[], masterRows: SpeciesProductionParams[]) => {
      if (!alive) return;
      setParams(rows);
      setMasterRows(masterRows);
    };
    speciesSubscribers.add(update);
    loadSpeciesParamsClient().then((rows) => update(rows, cachedMasterRows || []));
    return () => {
      alive = false;
      speciesSubscribers.delete(update);
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
    (species: string): number => masterRows.find((row) => row.species === species)?.marketPriceKgCanalCOP ?? 0,
    [masterRows],
  );

  const priceEgg = useCallback(
    (species: string): number => masterRows.find((row) => row.species === species)?.marketPriceEggUnitCOP ?? 0,
    [masterRows],
  );

  return { params, masterParams: masterRows, getParams, getMany, priceKg, priceEgg };
}
