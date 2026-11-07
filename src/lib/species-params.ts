/**
 * Parámetros productivos de referencia por especie
 * Valores adaptados al contexto colombiano (micro-granja, precios COP 2024-2026)
 */

export interface SpeciesProductionParams {
  species: string;
  breed: string;
  label: string;
  icon: string;
  cycleWeeks: number;
  cycleDays: number;
  targetWeightKg: number;
  carcassYieldPercent: number;
  dailyFeedGPerHead: number;
  feedCostPerKgCOP: number;
  feedConversionRatio: number;
  marketPriceKgCanalCOP: number;
  marketPriceEggUnitCOP?: number;
  eggsPerDayPerFemale?: number;
  systemType: string;
  notes: string;
}

export const SPECIES_PARAMS: SpeciesProductionParams[] = [
  {
    species: "pollo",
    breed: "Cobb 500 / Ross 308",
    label: "Pollo de engorde",
    icon: "🐓",
    cycleWeeks: 7,
    cycleDays: 49,
    targetWeightKg: 2.5,
    carcassYieldPercent: 72,
    dailyFeedGPerHead: 120,
    feedCostPerKgCOP: 2800,
    feedConversionRatio: 1.9,
    marketPriceKgCanalCOP: 14000,
    systemType: "piso",
    notes: "Pollo de engorde comercial. Alta eficiencia alimenticia. Listo a las 6-7 semanas.",
  },
  {
    species: "pollo",
    breed: "Criollo / Campero",
    label: "Pollo criollo / campero",
    icon: "🐓",
    cycleWeeks: 12,
    cycleDays: 84,
    targetWeightKg: 2.0,
    carcassYieldPercent: 68,
    dailyFeedGPerHead: 90,
    feedCostPerKgCOP: 2600,
    feedConversionRatio: 2.8,
    marketPriceKgCanalCOP: 18000,
    systemType: "pastoreo",
    notes: "Pollo criollo. Ciclo más largo pero mayor precio por kg canal en mercados locales.",
  },
  {
    species: "codorniz",
    breed: "Coturnix japonica",
    label: "Codorniz Japónica",
    icon: "🥚",
    cycleWeeks: 6,
    cycleDays: 42,
    targetWeightKg: 0.16,
    carcassYieldPercent: 65,
    dailyFeedGPerHead: 25,
    feedCostPerKgCOP: 3000,
    feedConversionRatio: 2.7,
    marketPriceKgCanalCOP: 32000,
    marketPriceEggUnitCOP: 300,
    eggsPerDayPerFemale: 0.9,
    systemType: "baterias",
    notes: "Codorniz de doble propósito (huevo y carne). Alta densidad, poco espacio. Huevo desde semana 6-7.",
  },
  {
    species: "pato",
    breed: "Pato Pekín",
    label: "Pato Pekín",
    icon: "🦆",
    cycleWeeks: 8,
    cycleDays: 56,
    targetWeightKg: 3.0,
    carcassYieldPercent: 70,
    dailyFeedGPerHead: 200,
    feedCostPerKgCOP: 2700,
    feedConversionRatio: 2.6,
    marketPriceKgCanalCOP: 24000,
    systemType: "piso",
    notes: "Pato de engorde comercial. Crecimiento rápido, listo en 7-8 semanas.",
  },
  {
    species: "pato",
    breed: "Pato Muscovy (Criollo)",
    label: "Pato Muscovy / Criollo",
    icon: "🦆",
    cycleWeeks: 12,
    cycleDays: 84,
    targetWeightKg: 3.2,
    carcassYieldPercent: 73,
    dailyFeedGPerHead: 180,
    feedCostPerKgCOP: 2600,
    feedConversionRatio: 3.0,
    marketPriceKgCanalCOP: 26000,
    systemType: "pastoreo",
    notes: "Pato criollo. Ciclo más largo, mejor adaptación a condiciones locales. Carne muy apreciada.",
  },
  {
    species: "conejo",
    breed: "Nueva Zelanda / California",
    label: "Conejo de engorde",
    icon: "🐇",
    cycleWeeks: 11,
    cycleDays: 77,
    targetWeightKg: 2.4,
    carcassYieldPercent: 55,
    dailyFeedGPerHead: 130,
    feedCostPerKgCOP: 2500,
    feedConversionRatio: 3.0,
    marketPriceKgCanalCOP: 28000,
    systemType: "jaulas",
    notes: "Conejo de engorde. Alto valor proteico, bajo costo de alimentación relativo. Ciclo ~70-85 días.",
  },
];

/** Obtiene los parámetros de la especie por defecto (primer registro que coincide) */
export function getSpeciesParams(species: string, breed?: string): SpeciesProductionParams | undefined {
  if (breed) {
    const exact = SPECIES_PARAMS.find(
      (p) => p.species === species && p.breed.toLowerCase().includes(breed.toLowerCase())
    );
    if (exact) return exact;
  }
  return SPECIES_PARAMS.find((p) => p.species === species);
}

/** Devuelve todos los parámetros de una especie (puede haber varias razas) */
export function getAllSpeciesParams(species: string): SpeciesProductionParams[] {
  return SPECIES_PARAMS.filter((p) => p.species === species);
}

/**
 * Calculadora de rentabilidad de un lote
 */
export interface LoteProfitCalc {
  costoAlimentoTotal: number;
  costoAlimentoPorCabeza: number;
  kgCanalTotal: number;
  kgCanalAutoconsumo: number;
  kgCanalExcedente: number;
  ingresoExcedentes: number;
  ahorroAutoconsumo: number;
  costoTotal: number;
  margenNeto: number;
  margenPorcentaje: number;
  roiDias: number;
}

export function calcularRentabilidadLote(
  params: SpeciesProductionParams,
  quantity: number,
  acquisitionCostCOP: number = 0,
  headsAutoconsumo: number = 0,
  headsExcedente?: number
): LoteProfitCalc {
  const heads = quantity;
  const exc = headsExcedente ?? Math.max(0, heads - headsAutoconsumo);

  const costoAlimentoPorCabeza =
    (params.cycleDays * params.dailyFeedGPerHead / 1000) * params.feedCostPerKgCOP;
  const costoAlimentoTotal = costoAlimentoPorCabeza * heads;

  const kgCanalPorCabeza = params.targetWeightKg * (params.carcassYieldPercent / 100);
  const kgCanalTotal = kgCanalPorCabeza * heads;
  const kgCanalAutoconsumo = kgCanalPorCabeza * headsAutoconsumo;
  const kgCanalExcedente = kgCanalPorCabeza * exc;

  const ingresoExcedentes = kgCanalExcedente * params.marketPriceKgCanalCOP;
  const ahorroAutoconsumo = kgCanalAutoconsumo * params.marketPriceKgCanalCOP;

  const costoTotal = costoAlimentoTotal + acquisitionCostCOP;
  const margenNeto = ingresoExcedentes + ahorroAutoconsumo - costoTotal;
  const margenPorcentaje = costoTotal > 0 ? (margenNeto / costoTotal) * 100 : 0;
  const roiDias = params.cycleDays;

  return {
    costoAlimentoTotal,
    costoAlimentoPorCabeza,
    kgCanalTotal,
    kgCanalAutoconsumo,
    kgCanalExcedente,
    ingresoExcedentes,
    ahorroAutoconsumo,
    costoTotal,
    margenNeto,
    margenPorcentaje,
    roiDias,
  };
}

/** Precio mercado por kg canal según especie (COP) */
export const MARKET_PRICE_PER_KG: Record<string, number> = {
  gallina: 10000,
  pollo: 14000,
  codorniz: 32000,
  pato: 24000,
  conejo: 28000,
};

/** Precio mercado por huevo según especie (COP) */
export const MARKET_PRICE_PER_EGG: Record<string, number> = {
  gallina: 600,
  codorniz: 300,
  pato: 800,
};

/** Icono de especie */
export const SPECIES_ICON: Record<string, string> = {
  gallina: "🐔",
  pollo: "🐓",
  codorniz: "🥚",
  pato: "🦆",
  conejo: "🐇",
};

/** Label legible de especie */
export const SPECIES_LABEL: Record<string, string> = {
  gallina: "Gallina",
  pollo: "Pollo",
  codorniz: "Codorniz",
  pato: "Pato",
  conejo: "Conejo",
};

