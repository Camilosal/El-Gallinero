import { summarizeRation, type RationLine, type RationSummary } from "@/lib/feeding/ration";
import {
  findStandardFeedById,
  resolveEffectiveFeedProfile,
  type FeedNutritionSourceInput,
} from "@/lib/feeding/standard-feed-catalog";
import type { FeedingSpecies } from "@/lib/species";

export interface StageNutritionRequirement {
  species: FeedingSpecies;
  stageKey: string;
  stageLabel: string;
  minWeeks: number;
  maxWeeks: number | null;
  source: string;
  dailyIntakeMinG: number;
  dailyIntakeMaxG: number;
  proteinDmMinPct: number;
  proteinDmMaxPct: number;
  energyKcalKgDmMin: number;
  energyKcalKgDmMax: number;
  calciumDmMinPct: number;
  calciumDmMaxPct: number;
  availablePhosphorusDmMinPct: number;
  fiberDmMinPct?: number;
  fiberDmMaxPct?: number;
  freshShareMaxPct?: number;
  speciesNotes?: string;
}

/**
 * Requerimientos nutricionales de referencia por especie y etapa de desarrollo
 * expresados en base seca (MS) para poder validar dietas mixtas (concentrado + forraje + grano).
 * Referencia alineada con FEDNA / NRC / Hy-Line / Aviagen / INIA (`wave2-standards-sanitary-ica.ts`).
 */
export const SPECIES_STAGE_REQUIREMENTS: ReadonlyArray<StageNutritionRequirement> = [
  // Gallinas ponedoras
  {
    species: "gallina",
    stageKey: "gallina_cria",
    stageLabel: "Pollita Cría / Iniciación (0–6 sem)",
    minWeeks: 0,
    maxWeeks: 6,
    source: "FEDNA / Hy-Line Management",
    dailyIntakeMinG: 18,
    dailyIntakeMaxG: 50,
    proteinDmMinPct: 19.5,
    proteinDmMaxPct: 24.0,
    energyKcalKgDmMin: 2950,
    energyKcalKgDmMax: 3350,
    calciumDmMinPct: 0.9,
    calciumDmMaxPct: 1.4,
    availablePhosphorusDmMinPct: 0.42,
    fiberDmMaxPct: 6.0,
    freshShareMaxPct: 15,
  },
  {
    species: "gallina",
    stageKey: "gallina_levante",
    stageLabel: "Juvenil / Levante (6–18 sem)",
    minWeeks: 6,
    maxWeeks: 18,
    source: "FEDNA / Hy-Line Management",
    dailyIntakeMinG: 50,
    dailyIntakeMaxG: 90,
    proteinDmMinPct: 16.0,
    proteinDmMaxPct: 19.5,
    energyKcalKgDmMin: 2800,
    energyKcalKgDmMax: 3250,
    calciumDmMinPct: 0.9,
    calciumDmMaxPct: 1.5,
    availablePhosphorusDmMinPct: 0.38,
    fiberDmMaxPct: 7.5,
    freshShareMaxPct: 25,
  },
  {
    species: "gallina",
    stageKey: "gallina_prepostura",
    stageLabel: "Pre-postura (18–20 sem)",
    minWeeks: 18,
    maxWeeks: 20,
    source: "FEDNA / Hy-Line Management",
    dailyIntakeMinG: 80,
    dailyIntakeMaxG: 110,
    proteinDmMinPct: 17.5,
    proteinDmMaxPct: 20.5,
    energyKcalKgDmMin: 2850,
    energyKcalKgDmMax: 3250,
    calciumDmMinPct: 2.0,
    calciumDmMaxPct: 3.2,
    availablePhosphorusDmMinPct: 0.4,
    fiberDmMaxPct: 7.0,
    freshShareMaxPct: 20,
  },
  {
    species: "gallina",
    stageKey: "gallina_postura",
    stageLabel: "Postura activa (20+ sem)",
    minWeeks: 20,
    maxWeeks: null,
    source: "FEDNA / ISA Brown Guide",
    dailyIntakeMinG: 105,
    dailyIntakeMaxG: 145,
    proteinDmMinPct: 17.5,
    proteinDmMaxPct: 21.5,
    energyKcalKgDmMin: 2850,
    energyKcalKgDmMax: 3300,
    calciumDmMinPct: 3.6,
    calciumDmMaxPct: 4.8,
    availablePhosphorusDmMinPct: 0.4,
    fiberDmMaxPct: 7.5,
    freshShareMaxPct: 20,
    speciesNotes: "En postura el calcio total en MS (3.6–4.8%) es crítico para evitar descalcificación y huevo frágil.",
  },
  // Gallo reproductor
  {
    species: "gallo",
    stageKey: "gallo_reproductor",
    stageLabel: "Gallo Reproductor (18+ sem)",
    minWeeks: 0,
    maxWeeks: null,
    source: "FEDNA / NRC Poultry",
    dailyIntakeMinG: 110,
    dailyIntakeMaxG: 155,
    proteinDmMinPct: 13.5,
    proteinDmMaxPct: 17.5,
    energyKcalKgDmMin: 2850,
    energyKcalKgDmMax: 3250,
    calciumDmMinPct: 0.85,
    calciumDmMaxPct: 1.6,
    availablePhosphorusDmMinPct: 0.35,
    fiberDmMaxPct: 8.0,
    freshShareMaxPct: 25,
    speciesNotes: "Evitar exceso de calcio en machos adultos (>1.6% MS) para prevenir daño renal.",
  },
  // Pollo de engorde
  {
    species: "pollo",
    stageKey: "pollo_inicio",
    stageLabel: "Pollo Inicio / Pre-iniciador (0–3 sem)",
    minWeeks: 0,
    maxWeeks: 3,
    source: "Aviagen Ross 308 / Cobb 500",
    dailyIntakeMinG: 25,
    dailyIntakeMaxG: 115,
    proteinDmMinPct: 22.5,
    proteinDmMaxPct: 26.5,
    energyKcalKgDmMin: 3100,
    energyKcalKgDmMax: 3500,
    calciumDmMinPct: 0.95,
    calciumDmMaxPct: 1.3,
    availablePhosphorusDmMinPct: 0.45,
    fiberDmMaxPct: 5.5,
    freshShareMaxPct: 10,
  },
  {
    species: "pollo",
    stageKey: "pollo_engorde",
    stageLabel: "Pollo Engorde / Finalización (3+ sem)",
    minWeeks: 3,
    maxWeeks: null,
    source: "Aviagen / NRC Poultry",
    dailyIntakeMinG: 115,
    dailyIntakeMaxG: 220,
    proteinDmMinPct: 19.0,
    proteinDmMaxPct: 23.5,
    energyKcalKgDmMin: 3200,
    energyKcalKgDmMax: 3650,
    calciumDmMinPct: 0.8,
    calciumDmMaxPct: 1.2,
    availablePhosphorusDmMinPct: 0.38,
    fiberDmMaxPct: 6.5,
    freshShareMaxPct: 15,
  },
  // Codorniz
  {
    species: "codorniz",
    stageKey: "codorniz_cria",
    stageLabel: "Codorniz Cría (0–5 sem)",
    minWeeks: 0,
    maxWeeks: 5,
    source: "NRC Quail / Coturnicultura",
    dailyIntakeMinG: 10,
    dailyIntakeMaxG: 24,
    proteinDmMinPct: 24.0,
    proteinDmMaxPct: 28.0,
    energyKcalKgDmMin: 3000,
    energyKcalKgDmMax: 3400,
    calciumDmMinPct: 0.9,
    calciumDmMaxPct: 1.4,
    availablePhosphorusDmMinPct: 0.42,
    fiberDmMaxPct: 5.5,
    freshShareMaxPct: 10,
  },
  {
    species: "codorniz",
    stageKey: "codorniz_postura",
    stageLabel: "Codorniz Postura (5+ sem)",
    minWeeks: 5,
    maxWeeks: null,
    source: "NRC Quail / Coturnicultura",
    dailyIntakeMinG: 22,
    dailyIntakeMaxG: 34,
    proteinDmMinPct: 20.5,
    proteinDmMaxPct: 24.5,
    energyKcalKgDmMin: 2950,
    energyKcalKgDmMax: 3350,
    calciumDmMinPct: 2.8,
    calciumDmMaxPct: 4.0,
    availablePhosphorusDmMinPct: 0.42,
    fiberDmMaxPct: 6.5,
    freshShareMaxPct: 15,
  },
  // Pato
  {
    species: "pato",
    stageKey: "pato_cria",
    stageLabel: "Pato Cría (0–4 sem)",
    minWeeks: 0,
    maxWeeks: 4,
    source: "FAO Peking Duck Table / NRC",
    dailyIntakeMinG: 45,
    dailyIntakeMaxG: 130,
    proteinDmMinPct: 21.0,
    proteinDmMaxPct: 25.0,
    energyKcalKgDmMin: 3000,
    energyKcalKgDmMax: 3400,
    calciumDmMinPct: 0.9,
    calciumDmMaxPct: 1.3,
    availablePhosphorusDmMinPct: 0.42,
    fiberDmMaxPct: 6.5,
    freshShareMaxPct: 20,
  },
  {
    species: "pato",
    stageKey: "pato_engorde",
    stageLabel: "Pato Levante / Engorde (4+ sem)",
    minWeeks: 4,
    maxWeeks: null,
    source: "FAO Peking Duck Table / NRC",
    dailyIntakeMinG: 130,
    dailyIntakeMaxG: 240,
    proteinDmMinPct: 16.5,
    proteinDmMaxPct: 20.5,
    energyKcalKgDmMin: 3000,
    energyKcalKgDmMax: 3450,
    calciumDmMinPct: 0.85,
    calciumDmMaxPct: 1.3,
    availablePhosphorusDmMinPct: 0.38,
    fiberDmMaxPct: 8.5,
    freshShareMaxPct: 30,
  },
  // Conejo
  {
    species: "conejo",
    stageKey: "conejo_gazapo",
    stageLabel: "Conejo Gazapo / Destete (0–8 sem)",
    minWeeks: 0,
    maxWeeks: 8,
    source: "FEDNA Cunicultura / NRC",
    dailyIntakeMinG: 60,
    dailyIntakeMaxG: 145,
    proteinDmMinPct: 17.0,
    proteinDmMaxPct: 21.0,
    energyKcalKgDmMin: 2450,
    energyKcalKgDmMax: 2950,
    calciumDmMinPct: 0.75,
    calciumDmMaxPct: 1.4,
    availablePhosphorusDmMinPct: 0.42,
    fiberDmMinPct: 12.0,
    fiberDmMaxPct: 22.0,
    speciesNotes: "Conejos requieren fibra bruta mínima (~12%+ MS) y oreado previo del forraje verde.",
  },
  {
    species: "conejo",
    stageKey: "conejo_engorde",
    stageLabel: "Conejo Engorde / Cría (8+ sem)",
    minWeeks: 8,
    maxWeeks: null,
    source: "FEDNA Cunicultura / NRC",
    dailyIntakeMinG: 120,
    dailyIntakeMaxG: 260,
    proteinDmMinPct: 15.5,
    proteinDmMaxPct: 19.5,
    energyKcalKgDmMin: 2400,
    energyKcalKgDmMax: 2900,
    calciumDmMinPct: 0.7,
    calciumDmMaxPct: 1.5,
    availablePhosphorusDmMinPct: 0.4,
    fiberDmMinPct: 14.0,
    fiberDmMaxPct: 24.0,
    speciesNotes: "Asegurar fibra efectiva (forraje oreado/heno) para evitar trastornos digestivos.",
  },
  // Cuy / Curí
  {
    species: "cuy",
    stageKey: "cuy_cria",
    stageLabel: "Cuy Cría / Destete (0–6 sem)",
    minWeeks: 0,
    maxWeeks: 6,
    source: "INIA Perú / NRC Guinea Pig",
    dailyIntakeMinG: 65,
    dailyIntakeMaxG: 195,
    proteinDmMinPct: 18.0,
    proteinDmMaxPct: 22.5,
    energyKcalKgDmMin: 2650,
    energyKcalKgDmMax: 3150,
    calciumDmMinPct: 0.85,
    calciumDmMaxPct: 1.5,
    availablePhosphorusDmMinPct: 0.42,
    fiberDmMinPct: 10.0,
    fiberDmMaxPct: 22.0,
    speciesNotes: "El cuy exige aporte diario de Vitamina C (200 mg/kg MS) y forraje oreado sin exceso de humedad.",
  },
  {
    species: "cuy",
    stageKey: "cuy_engorde",
    stageLabel: "Cuy Engorde / Cría (6+ sem)",
    minWeeks: 6,
    maxWeeks: null,
    source: "INIA Perú / NRC Guinea Pig",
    dailyIntakeMinG: 140,
    dailyIntakeMaxG: 260,
    proteinDmMinPct: 16.5,
    proteinDmMaxPct: 21.0,
    energyKcalKgDmMin: 2600,
    energyKcalKgDmMax: 3100,
    calciumDmMinPct: 0.8,
    calciumDmMaxPct: 1.5,
    availablePhosphorusDmMinPct: 0.4,
    fiberDmMinPct: 11.0,
    fiberDmMaxPct: 23.0,
    speciesNotes: "Aportar Vitamina C diaria y marchitar/orear el forraje verde antes de suministrar.",
  },
];

export type CheckSeverity = "ok" | "warning" | "error" | "missing";

export interface NutritionMetricCheck {
  metric: "intake" | "protein_dm" | "energy_dm" | "calcium_dm" | "phosphorus_dm" | "fiber_dm" | "fresh_share";
  label: string;
  actualLabel: string;
  targetLabel: string;
  status: CheckSeverity;
  message: string;
}

export interface SanitaryFeedAlert {
  feedName: string;
  standardCatalogId: string | null;
  status: "NO USAR" | "RESTRINGIDO";
  message: string;
}

export interface DietSubstituteCandidate {
  source: "inventory" | "standard_catalog";
  feedId?: string;
  standardCatalogId?: string;
  name: string;
  reason: string;
  suggestedGrams?: number;
  condition?: string;
}

export interface DietRecommendation {
  id: string;
  category: "substitute" | "adjust_intake" | "add_nutrient" | "condition" | "complete_data";
  priority: "alta" | "media";
  title: string;
  detail: string;
  candidates: DietSubstituteCandidate[];
}

export interface AvailableInventoryFeed extends FeedNutritionSourceInput {
  id: string;
  name: string;
  category?: string | null;
}

export interface DietValidationResult {
  status: "cumple" | "advertencia" | "rechazado";
  headline: string;
  requirement: StageNutritionRequirement;
  summary: RationSummary;
  checks: NutritionMetricCheck[];
  sanitaryAlerts: SanitaryFeedAlert[];
  missingNutrients: string[];
  recommendations: DietRecommendation[];
}

/**
 * Mapa explícito de sustitutos seguros desde el Catálogo Estandarizado
 * cuando el productor selecciona ingredientes bloqueados (NO USAR).
 */
const SAFE_SUBSTITUTE_IDS: Record<string, string[]> = {
  "IG-027": ["IG-025", "IG-026", "IG-007"], // Soya cruda -> Harina soya 48%, soya tostada, BSF
  "IG-036": ["IG-035", "IG-038", "IG-039", "IG-015"], // Yuca sin tratar -> tratada, harina detox, batata, maíz
  "IG-037": ["IG-035", "IG-038", "IG-039", "IG-015"],
  "IG-046": ["IG-045", "IG-039", "IG-052"], // Papa verde/brotada -> Papa cocida sin brotes, batata, plátano verde
  "IG-059": ["IG-054", "IG-062", "IG-058", "IG-060"], // Follaje yuca sin tratar -> Moringa, Botón de oro, Alfalfa, follaje tratado
  "IG-087": ["IG-086", "IG-082", "IG-049"], // Tomate verde/tallos -> Tomate rojo maduro, ahuyama, zanahoria
  "IG-106": ["IG-082", "IG-098", "IG-100"], // Aguacate -> Ahuyama, banano maduro, papaya madura
  "IG-109": ["IG-107", "IG-108", "IG-015"], // Restos salados -> Descarte hortalizas limpio, restos sin sal, maíz
  "IG-110": ["IG-015", "IG-018", "IG-001"], // Alimento con moho -> Maíz sano, sorgo, concentrado vigente
  "IG-113": ["IG-015", "IG-052", "IG-098"], // Cacao/café -> Maíz, plátano verde, banano
};

export function suggestSafeSubstitutesForStandardId(
  standardCatalogId: string | null | undefined,
  availableFeeds: AvailableInventoryFeed[] = [],
): DietSubstituteCandidate[] {
  const normalizedId = (standardCatalogId || "").trim().toUpperCase();
  const preferredIds = SAFE_SUBSTITUTE_IDS[normalizedId] || ["IG-015", "IG-025", "IG-054"];
  const candidates: DietSubstituteCandidate[] = [];

  for (const stdId of preferredIds) {
    const std = findStandardFeedById(stdId);
    if (!std || std.isBlocked) continue;
    const invMatch = availableFeeds.find((f) => f.standardCatalogId === std.id && f.sanitaryStatus !== "NO USAR");
    if (invMatch) {
      candidates.push({
        source: "inventory",
        feedId: invMatch.id,
        standardCatalogId: std.id,
        name: invMatch.name,
        reason: `Disponible en tu bodega · ${std.id} (${std.sanitaryStatus}).`,
        condition: std.preparation || undefined,
      });
    } else {
      candidates.push({
        source: "standard_catalog",
        standardCatalogId: std.id,
        name: std.name,
        reason: `Alternativa segura en catálogo base (${std.group} · ${std.sanitaryStatus}).`,
        condition: std.preparation || undefined,
      });
    }
  }
  return candidates.slice(0, 4);
}

export function resolveStageNutritionRequirement(
  species: FeedingSpecies,
  stageName = "",
  minWeeks = 0,
  maxWeeks: number | null = null,
): StageNutritionRequirement {
  const candidates = SPECIES_STAGE_REQUIREMENTS.filter((item) => item.species === species);
  if (candidates.length === 0) return SPECIES_STAGE_REQUIREMENTS[3]; // fallback gallina postura
  if (candidates.length === 1) return candidates[0];

  const normalizedName = stageName.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  if (species === "gallina") {
    if (normalizedName.includes("pre-postura") || normalizedName.includes("prepostura")) return candidates[2];
    if (normalizedName.includes("postura")) return candidates[3];
    if (normalizedName.includes("pollit") || normalizedName.includes("cria") || normalizedName.includes("inic")) return candidates[0];
    if (normalizedName.includes("juvenil") || normalizedName.includes("levante")) return candidates[1];
  }
  if (species === "pollo" && (normalizedName.includes("inicio") || normalizedName.includes("pre"))) return candidates[0];
  if (species === "pollo" && (normalizedName.includes("engorde") || normalizedName.includes("final"))) return candidates[1];

  const midWeek = maxWeeks !== null ? (minWeeks + maxWeeks) / 2 : minWeeks + 2;
  const byWeek = candidates.find(
    (c) => midWeek >= c.minWeeks && (c.maxWeeks === null || midWeek <= c.maxWeeks),
  );
  return byWeek || candidates[candidates.length - 1];
}

/**
 * Evalúa si la mezcla de ingredientes y dosis diarias cumple con los requerimientos nutricionales
 * e inocuidad sanitaria de la especie y etapa de desarrollo.
 */
export function validateFeedingProgram(params: {
  species: FeedingSpecies;
  stageName?: string;
  minWeeks?: number;
  maxWeeks?: number | null;
  lines: RationLine[];
  availableFeeds?: AvailableInventoryFeed[];
}): DietValidationResult {
  const requirement = resolveStageNutritionRequirement(
    params.species,
    params.stageName,
    params.minWeeks ?? 0,
    params.maxWeeks ?? null,
  );
  const summary = summarizeRation(params.lines);
  const checks: NutritionMetricCheck[] = [];
  const sanitaryAlerts: SanitaryFeedAlert[] = [];
  const missingNutrients: string[] = [];

  for (const line of params.lines) {
    if (line.sanitaryStatus === "NO USAR") {
      sanitaryAlerts.push({
        feedName: line.feedName || "Ingrediente",
        standardCatalogId: line.standardCatalogId ?? null,
        status: "NO USAR",
        message: "Ingrediente prohibido (NO USAR). No es seguro formular ni suministrar este alimento.",
      });
    } else if (line.sanitaryStatus === "RESTRINGIDO") {
      sanitaryAlerts.push({
        feedName: line.feedName || "Ingrediente",
        standardCatalogId: line.standardCatalogId ?? null,
        status: "RESTRINGIDO",
        message: "Ingrediente RESTRINGIDO: exige tratamiento, límite de inclusión y validación del lote.",
      });
    }
  }

  // 1. Ingesta diaria total tal como se ofrece (g/animal/día)
  if (summary.totalGrams <= 0) {
    checks.push({
      metric: "intake",
      label: "Ingesta diaria",
      actualLabel: "0 g/día",
      targetLabel: `${requirement.dailyIntakeMinG}–${requirement.dailyIntakeMaxG} g/día`,
      status: "error",
      message: "La ración no registra dosis diaria.",
    });
  } else if (summary.totalGrams < requirement.dailyIntakeMinG * 0.65) {
    checks.push({
      metric: "intake",
      label: "Ingesta diaria",
      actualLabel: `${summary.totalGrams} g/día`,
      targetLabel: `${requirement.dailyIntakeMinG}–${requirement.dailyIntakeMaxG} g/día`,
      status: "error",
      message: `Ingesta crítica muy por debajo del mínimo esperado (${requirement.dailyIntakeMinG} g/día).`,
    });
  } else if (summary.totalGrams < requirement.dailyIntakeMinG || summary.totalGrams > requirement.dailyIntakeMaxG * 1.2) {
    checks.push({
      metric: "intake",
      label: "Ingesta diaria",
      actualLabel: `${summary.totalGrams} g/día`,
      targetLabel: `${requirement.dailyIntakeMinG}–${requirement.dailyIntakeMaxG} g/día`,
      status: "warning",
      message:
        summary.totalGrams < requirement.dailyIntakeMinG
          ? `Por debajo de ${requirement.dailyIntakeMinG} g/día recomendados para ${requirement.stageLabel}.`
          : `Supera el rango típico (${requirement.dailyIntakeMaxG} g/día); verifica humedad o desperdicio.`,
    });
  } else {
    checks.push({
      metric: "intake",
      label: "Ingesta diaria",
      actualLabel: `${summary.totalGrams} g/día`,
      targetLabel: `${requirement.dailyIntakeMinG}–${requirement.dailyIntakeMaxG} g/día`,
      status: "ok",
      message: "Dosis diaria acorde con la etapa.",
    });
  }

  // 2. Proteína cruda en MS
  if (summary.crudeProteinPctDm === null) {
    missingNutrients.push("PB % / MS %");
    checks.push({
      metric: "protein_dm",
      label: "Proteína bruta (MS)",
      actualLabel: "Incompleta",
      targetLabel: `${requirement.proteinDmMinPct}–${requirement.proteinDmMaxPct}% MS`,
      status: "missing",
      message: "Falta % MS o % Proteína cruda en al menos un ingrediente.",
    });
  } else if (summary.crudeProteinPctDm < requirement.proteinDmMinPct * 0.75) {
    checks.push({
      metric: "protein_dm",
      label: "Proteína bruta (MS)",
      actualLabel: `${summary.crudeProteinPctDm}% MS`,
      targetLabel: `${requirement.proteinDmMinPct}–${requirement.proteinDmMaxPct}% MS`,
      status: "error",
      message: `Déficit proteico severo frente a ${requirement.proteinDmMinPct}% MS requeridos.`,
    });
  } else if (
    summary.crudeProteinPctDm < requirement.proteinDmMinPct ||
    summary.crudeProteinPctDm > requirement.proteinDmMaxPct
  ) {
    checks.push({
      metric: "protein_dm",
      label: "Proteína bruta (MS)",
      actualLabel: `${summary.crudeProteinPctDm}% MS`,
      targetLabel: `${requirement.proteinDmMinPct}–${requirement.proteinDmMaxPct}% MS`,
      status: "warning",
      message:
        summary.crudeProteinPctDm < requirement.proteinDmMinPct
          ? `Proteína ligeramente baja (${summary.crudeProteinPctDm}% vs ${requirement.proteinDmMinPct}% mín.).`
          : `Exceso de proteína (${summary.crudeProteinPctDm}% vs ${requirement.proteinDmMaxPct}% máx.).`,
    });
  } else {
    checks.push({
      metric: "protein_dm",
      label: "Proteína bruta (MS)",
      actualLabel: `${summary.crudeProteinPctDm}% MS`,
      targetLabel: `${requirement.proteinDmMinPct}–${requirement.proteinDmMaxPct}% MS`,
      status: "ok",
      message: "Proteína dentro del rango óptimo.",
    });
  }

  // 3. Energía metabolizable (kcal/kg MS)
  if (summary.energyKcalKgDm === null) {
    missingNutrients.push("EM kcal/kg MS");
    checks.push({
      metric: "energy_dm",
      label: "Energía (EM)",
      actualLabel: "Sin perfil completo",
      targetLabel: `${requirement.energyKcalKgDmMin}–${requirement.energyKcalKgDmMax} kcal/kg MS`,
      status: "missing",
      message: "Completa la EM (kcal/kg MS) de todos los ingredientes para validar aporte energético.",
    });
  } else if (summary.energyKcalKgDm < requirement.energyKcalKgDmMin * 0.75) {
    checks.push({
      metric: "energy_dm",
      label: "Energía (EM)",
      actualLabel: `${summary.energyKcalKgDm} kcal/kg MS`,
      targetLabel: `${requirement.energyKcalKgDmMin}–${requirement.energyKcalKgDmMax} kcal/kg MS`,
      status: "error",
      message: `Densidad energética crítica (< ${Math.round(requirement.energyKcalKgDmMin * 0.75)} kcal/kg MS).`,
    });
  } else if (
    summary.energyKcalKgDm < requirement.energyKcalKgDmMin ||
    summary.energyKcalKgDm > requirement.energyKcalKgDmMax
  ) {
    checks.push({
      metric: "energy_dm",
      label: "Energía (EM)",
      actualLabel: `${summary.energyKcalKgDm} kcal/kg MS`,
      targetLabel: `${requirement.energyKcalKgDmMin}–${requirement.energyKcalKgDmMax} kcal/kg MS`,
      status: "warning",
      message:
        summary.energyKcalKgDm < requirement.energyKcalKgDmMin
          ? "Energía por debajo de la meta para la etapa; revisa granos o concentrado."
          : "Energía por encima del rango objetivo (riesgo de engrasamiento).",
    });
  } else {
    checks.push({
      metric: "energy_dm",
      label: "Energía (EM)",
      actualLabel: `${summary.energyKcalKgDm} kcal/kg MS`,
      targetLabel: `${requirement.energyKcalKgDmMin}–${requirement.energyKcalKgDmMax} kcal/kg MS`,
      status: "ok",
      message: "Aporte energético balanceado.",
    });
  }

  // 4. Calcio (% MS)
  if (summary.calciumPctDm === null) {
    missingNutrients.push("Ca % MS");
    checks.push({
      metric: "calcium_dm",
      label: "Calcio (MS)",
      actualLabel: "Incompleto",
      targetLabel: `${requirement.calciumDmMinPct}–${requirement.calciumDmMaxPct}% MS`,
      status: "missing",
      message: "Completa el Ca % MS (clave en postura y crecimiento óseo).",
    });
  } else if (summary.calciumPctDm < requirement.calciumDmMinPct * 0.65) {
    checks.push({
      metric: "calcium_dm",
      label: "Calcio (MS)",
      actualLabel: `${summary.calciumPctDm}% MS`,
      targetLabel: `${requirement.calciumDmMinPct}–${requirement.calciumDmMaxPct}% MS`,
      status: "error",
      message: `Déficit severo de calcio (${summary.calciumPctDm}% vs ${requirement.calciumDmMinPct}% mín.).`,
    });
  } else if (
    summary.calciumPctDm < requirement.calciumDmMinPct ||
    summary.calciumPctDm > requirement.calciumDmMaxPct
  ) {
    checks.push({
      metric: "calcium_dm",
      label: "Calcio (MS)",
      actualLabel: `${summary.calciumPctDm}% MS`,
      targetLabel: `${requirement.calciumDmMinPct}–${requirement.calciumDmMaxPct}% MS`,
      status: "warning",
      message:
        summary.calciumPctDm < requirement.calciumDmMinPct
          ? "Calcio bajo; evalúa suplementar carbonato de calcio o conchilla de ostra."
          : "Exceso de calcio frente al rango objetivo de esta etapa.",
    });
  } else {
    checks.push({
      metric: "calcium_dm",
      label: "Calcio (MS)",
      actualLabel: `${summary.calciumPctDm}% MS`,
      targetLabel: `${requirement.calciumDmMinPct}–${requirement.calciumDmMaxPct}% MS`,
      status: "ok",
      message: "Calcio adecuado.",
    });
  }

  // 5. Fósforo disponible (% MS)
  if (summary.availablePhosphorusPctDm === null) {
    missingNutrients.push("P disp % MS");
    checks.push({
      metric: "phosphorus_dm",
      label: "Fósforo disp. (MS)",
      actualLabel: "Incompleto",
      targetLabel: `>= ${requirement.availablePhosphorusDmMinPct}% MS`,
      status: "missing",
      message: "Completa P disp % MS en los ingredientes para validar relación Ca:P.",
    });
  } else if (summary.availablePhosphorusPctDm < requirement.availablePhosphorusDmMinPct) {
    checks.push({
      metric: "phosphorus_dm",
      label: "Fósforo disp. (MS)",
      actualLabel: `${summary.availablePhosphorusPctDm}% MS`,
      targetLabel: `>= ${requirement.availablePhosphorusDmMinPct}% MS`,
      status: "warning",
      message: `Fósforo disponible bajo (${summary.availablePhosphorusPctDm}% vs ${requirement.availablePhosphorusDmMinPct}% mín.).`,
    });
  } else {
    checks.push({
      metric: "phosphorus_dm",
      label: "Fósforo disp. (MS)",
      actualLabel: `${summary.availablePhosphorusPctDm}% MS`,
      targetLabel: `>= ${requirement.availablePhosphorusDmMinPct}% MS`,
      status: "ok",
      message: "Fósforo disponible suficiente.",
    });
  }

  // 6. Fibra bruta (% MS) cuando aplica
  if (requirement.fiberDmMinPct !== undefined || requirement.fiberDmMaxPct !== undefined) {
    const targetFiber =
      requirement.fiberDmMinPct !== undefined && requirement.fiberDmMaxPct !== undefined
        ? `${requirement.fiberDmMinPct}–${requirement.fiberDmMaxPct}% MS`
        : requirement.fiberDmMaxPct !== undefined
          ? `<= ${requirement.fiberDmMaxPct}% MS`
          : `>= ${requirement.fiberDmMinPct}% MS`;

    if (summary.crudeFiberPctDm === null) {
      missingNutrients.push("Fibra % MS");
      checks.push({
        metric: "fiber_dm",
        label: "Fibra bruta (MS)",
        actualLabel: "Incompleta",
        targetLabel: targetFiber,
        status: "missing",
        message: "Completa Fibra bruta % MS para verificar volumen digestivo.",
      });
    } else if (
      (requirement.fiberDmMinPct !== undefined && summary.crudeFiberPctDm < requirement.fiberDmMinPct) ||
      (requirement.fiberDmMaxPct !== undefined && summary.crudeFiberPctDm > requirement.fiberDmMaxPct)
    ) {
      checks.push({
        metric: "fiber_dm",
        label: "Fibra bruta (MS)",
        actualLabel: `${summary.crudeFiberPctDm}% MS`,
        targetLabel: targetFiber,
        status: "warning",
        message:
          requirement.fiberDmMinPct !== undefined && summary.crudeFiberPctDm < requirement.fiberDmMinPct
            ? `Fibra insuficiente para herbívoro (${summary.crudeFiberPctDm}% vs ${requirement.fiberDmMinPct}% mín.).`
            : `Fibra alta (${summary.crudeFiberPctDm}%) puede diluir energía en aves.`,
      });
    } else {
      checks.push({
        metric: "fiber_dm",
        label: "Fibra bruta (MS)",
        actualLabel: `${summary.crudeFiberPctDm}% MS`,
        targetLabel: targetFiber,
        status: "ok",
        message: "Fibra dentro de rango.",
      });
    }
  }

  // 7. Dilución por exceso de forraje fresco en aves
  if (requirement.freshShareMaxPct !== undefined && summary.freshSharePct > requirement.freshShareMaxPct) {
    checks.push({
      metric: "fresh_share",
      label: "Fracción en fresco",
      actualLabel: `${summary.freshSharePct}% tal cual`,
      targetLabel: `<= ${requirement.freshShareMaxPct}% tal cual`,
      status: "warning",
      message: `Alto aporte en fresco (${summary.freshSharePct}%): vigila consumo efectivo de materia seca.`,
    });
  }

  const hasError = checks.some((c) => c.status === "error") || sanitaryAlerts.some((a) => a.status === "NO USAR");
  const hasWarningOrMissing =
    checks.some((c) => c.status === "warning" || c.status === "missing") || sanitaryAlerts.length > 0;

  const status: DietValidationResult["status"] = hasError
    ? "rechazado"
    : hasWarningOrMissing
      ? "advertencia"
      : "cumple";

  const headline =
    status === "rechazado"
      ? sanitaryAlerts.some((a) => a.status === "NO USAR")
        ? "Dieta bloqueada por ingrediente NO USAR"
        : `Déficit nutricional crítico para ${requirement.stageLabel}`
      : status === "advertencia"
        ? missingNutrients.length > 0
          ? `Con datos faltantes (${missingNutrients.join(", ")}) o ajustes sugeridos`
          : `Revisar observaciones para ${requirement.stageLabel}`
        : `Cumple requerimientos nutricionales (${requirement.stageLabel})`;

  const recommendations = buildDietRecommendations({
    species: params.species,
    requirement,
    summary,
    lines: params.lines,
    checks,
    sanitaryAlerts,
    availableFeeds: params.availableFeeds || [],
  });

  return {
    status,
    headline,
    requirement,
    summary,
    checks,
    sanitaryAlerts,
    missingNutrients,
    recommendations,
  };
}

function buildNutrientCandidates(params: {
  metric: "protein_dm" | "energy_dm" | "calcium_dm" | "phosphorus_dm" | "fiber_dm";
  availableFeeds: AvailableInventoryFeed[];
  existingStandardIds: Set<string>;
  existingFeedIds: Set<string>;
  defaultGrams: number;
}): DietSubstituteCandidate[] {
  const { metric, availableFeeds, existingStandardIds, existingFeedIds, defaultGrams } = params;
  const candidates: DietSubstituteCandidate[] = [];

  const scoreAndReason = (profile: ReturnType<typeof resolveEffectiveFeedProfile>): { score: number; reason: string } | null => {
    if (profile.sanitaryStatus === "NO USAR") return null;
    if (metric === "protein_dm" && (profile.crudeProteinDmPct ?? 0) >= 20) {
      return {
        score: profile.crudeProteinDmPct ?? 0,
        reason: `Aporta ${profile.crudeProteinDmPct}% PB en MS${profile.lysineDigDmPct ? ` y ${profile.lysineDigDmPct}% Lis dig` : ""}.`,
      };
    }
    if (metric === "energy_dm" && (profile.energyKcalKgDm ?? 0) >= 3000) {
      return {
        score: profile.energyKcalKgDm ?? 0,
        reason: `Alta densidad energética: ${profile.energyKcalKgDm} kcal/kg MS.`,
      };
    }
    if (metric === "calcium_dm" && (profile.calciumDmPct ?? 0) >= 1.5) {
      return {
        score: profile.calciumDmPct ?? 0,
        reason: `Rico en calcio (${profile.calciumDmPct}% MS).`,
      };
    }
    if (metric === "phosphorus_dm" && (profile.availablePhosphorusDmPct ?? 0) >= 0.25) {
      return {
        score: profile.availablePhosphorusDmPct ?? 0,
        reason: `Aporta ${profile.availablePhosphorusDmPct}% P disponible en MS.`,
      };
    }
    if (metric === "fiber_dm" && (profile.crudeFiberDmPct ?? 0) >= 12) {
      return {
        score: profile.crudeFiberDmPct ?? 0,
        reason: `Aporta ${profile.crudeFiberDmPct}% fibra bruta en MS.`,
      };
    }
    return null;
  };

  // 1. Primero sugerir alimentos ya disponibles en la bodega de la granja
  const inventoryScored = availableFeeds
    .filter((f) => !existingFeedIds.has(f.id))
    .map((f) => {
      const profile = resolveEffectiveFeedProfile(f);
      const hit = scoreAndReason(profile);
      return hit ? { feed: f, profile, ...hit } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  for (const item of inventoryScored) {
    candidates.push({
      source: "inventory",
      feedId: item.feed.id,
      standardCatalogId: item.profile.standardCatalogId ?? undefined,
      name: item.feed.name,
      reason: `En tu bodega · ${item.reason}`,
      suggestedGrams: defaultGrams,
      condition: item.profile.preparation || undefined,
    });
  }

  // 2. Complementar con opciones del catálogo estandarizado (incluso minerales/premezclas de etiqueta pendiente)
  const fallbackStdIds: Record<typeof metric, string[]> = {
    protein_dm: ["IG-025", "IG-007", "IG-054", "IG-013"],
    energy_dm: ["IG-018", "IG-015", "IG-019", "IG-023"],
    calcium_dm: ["IG-115", "IG-114", "IG-001", "IG-007", "IG-116"],
    phosphorus_dm: ["IG-117", "IG-023", "IG-025"],
    fiber_dm: ["IG-058", "IG-054", "IG-020"],
  };

  for (const stdId of fallbackStdIds[metric]) {
    if (candidates.length >= 4) break;
    if (existingStandardIds.has(stdId)) continue;
    const std = findStandardFeedById(stdId);
    if (!std || std.isBlocked) continue;
    if (candidates.some((c) => c.standardCatalogId === std.id)) continue;

    const alreadyInInv = availableFeeds.find((f) => f.standardCatalogId === std.id);
    if (alreadyInInv && existingFeedIds.has(alreadyInInv.id)) continue;

    const profile = resolveEffectiveFeedProfile({ standardCatalogId: std.id });
    const hit = scoreAndReason(profile);
    const reasonText =
      hit?.reason ||
      (std.group === "Minerales y aditivos" || std.group === "Balanceados"
        ? `Fuente estándar de ${std.group.toLowerCase()} (completar % según etiqueta del proveedor).`
        : std.compositionNotes || std.risks || "Opción del catálogo estándar.");

    candidates.push({
      source: alreadyInInv ? "inventory" : "standard_catalog",
      feedId: alreadyInInv?.id,
      standardCatalogId: std.id,
      name: alreadyInInv ? alreadyInInv.name : std.name,
      reason: alreadyInInv ? `En tu bodega · ${reasonText}` : `${std.id} · ${reasonText}`,
      suggestedGrams: defaultGrams,
      condition: std.preparation || undefined,
    });
  }

  return candidates.slice(0, 4);
}

function buildDietRecommendations(params: {
  species: FeedingSpecies;
  requirement: StageNutritionRequirement;
  summary: RationSummary;
  lines: RationLine[];
  checks: NutritionMetricCheck[];
  sanitaryAlerts: SanitaryFeedAlert[];
  availableFeeds: AvailableInventoryFeed[];
}): DietRecommendation[] {
  const { species, requirement, summary, lines, checks, sanitaryAlerts, availableFeeds } = params;
  const recommendations: DietRecommendation[] = [];

  const existingStandardIds = new Set(
    lines.map((l) => l.standardCatalogId).filter((v): v is string => Boolean(v)),
  );
  const existingFeedIds = new Set(
    availableFeeds
      .filter((f) => lines.some((l) => l.feedName && l.feedName === f.name))
      .map((f) => f.id),
  );

  // 1. Sustitutos si hay ingredientes NO USAR
  for (const alert of sanitaryAlerts.filter((a) => a.status === "NO USAR")) {
    recommendations.push({
      id: `sub-${alert.standardCatalogId || alert.feedName}`,
      category: "substitute",
      priority: "alta",
      title: `Reemplazar ingrediente bloqueado: ${alert.feedName}`,
      detail: "Retira este ingrediente de la receta y sustitúyelo por una alternativa inocua equivalente.",
      candidates: suggestSafeSubstitutesForStandardId(alert.standardCatalogId, availableFeeds),
    });
  }

  // 2. Condiciones obligatorias para ingredientes RESTRINGIDO o especie/sistema
  for (const line of lines) {
    const std = findStandardFeedById(line.standardCatalogId);
    if (line.sanitaryStatus === "RESTRINGIDO" || std?.sanitaryStatus === "RESTRINGIDO") {
      recommendations.push({
        id: `cond-${line.standardCatalogId || line.feedName}`,
        category: "condition",
        priority: "alta",
        title: `Condición obligatoria para ${line.feedName || std?.name || "ingrediente restringido"}`,
        detail: [
          std?.preparation || "Aplicar tratamiento validado y controlar dosis máxima de inclusión.",
          std?.risks ? `Riesgo: ${std.risks}` : "",
        ]
          .filter(Boolean)
          .join(" "),
        candidates: [],
      });
    }
  }

  // 3. Ajuste de gramos totales si la ingesta diaria no cumple
  const intakeCheck = checks.find((c) => c.metric === "intake");
  if (intakeCheck && intakeCheck.status !== "ok") {
    if (summary.totalGrams < requirement.dailyIntakeMinG) {
      const missingGrams = Math.round((requirement.dailyIntakeMinG - summary.totalGrams) * 10) / 10;
      recommendations.push({
        id: "adjust-intake-low",
        category: "adjust_intake",
        priority: intakeCheck.status === "error" ? "alta" : "media",
        title: `Aumentar ración total en +${missingGrams} g/animal/día`,
        detail: `Para ${requirement.stageLabel} se requieren al menos ${requirement.dailyIntakeMinG} g/animal/día. Ajusta proporcionalmente las dosis o complementa con el alimento base.`,
        candidates: [],
      });
    } else if (summary.totalGrams > requirement.dailyIntakeMaxG * 1.2) {
      const excessGrams = Math.round((summary.totalGrams - requirement.dailyIntakeMaxG) * 10) / 10;
      recommendations.push({
        id: "adjust-intake-high",
        category: "adjust_intake",
        priority: "media",
        title: `Reducir exceso aproximado de ${excessGrams} g/animal/día`,
        detail: `Supera el rango típico (${requirement.dailyIntakeMaxG} g/animal/día); verifica si se debe a alta humedad del forraje fresco o sobreoferta.`,
        candidates: [],
      });
    }
  }

  // 4. Suplementación / sustitutos para déficits nutricionales concretos
  const proteinCheck = checks.find((c) => c.metric === "protein_dm");
  if (proteinCheck && (proteinCheck.status === "error" || proteinCheck.status === "warning") && (summary.crudeProteinPctDm ?? 0) < requirement.proteinDmMinPct) {
    recommendations.push({
      id: "add-protein",
      category: "add_nutrient",
      priority: proteinCheck.status === "error" ? "alta" : "media",
      title: `Subir aporte proteico (meta >= ${requirement.proteinDmMinPct}% PB en MS)`,
      detail: "Incorpora una fuente concentrada de proteína digestible o reduce ingredientes muy diluidos.",
      candidates: buildNutrientCandidates({
        metric: "protein_dm",
        availableFeeds,
        existingStandardIds,
        existingFeedIds,
        defaultGrams: Math.max(8, Math.round(requirement.dailyIntakeMinG * 0.15)),
      }),
    });
  }

  const energyCheck = checks.find((c) => c.metric === "energy_dm");
  if (energyCheck && (energyCheck.status === "error" || energyCheck.status === "warning") && (summary.energyKcalKgDm ?? 0) < requirement.energyKcalKgDmMin) {
    recommendations.push({
      id: "add-energy",
      category: "add_nutrient",
      priority: energyCheck.status === "error" ? "alta" : "media",
      title: `Subir energía metabolizable (meta >= ${requirement.energyKcalKgDmMin} kcal/kg MS)`,
      detail: "Agrega un cereal energético o reduce el exceso de forraje/fibra de baja densidad.",
      candidates: buildNutrientCandidates({
        metric: "energy_dm",
        availableFeeds,
        existingStandardIds,
        existingFeedIds,
        defaultGrams: Math.max(15, Math.round(requirement.dailyIntakeMinG * 0.25)),
      }),
    });
  }

  const calciumCheck = checks.find((c) => c.metric === "calcium_dm");
  if (calciumCheck && (calciumCheck.status === "error" || calciumCheck.status === "warning") && (summary.calciumPctDm ?? 0) < requirement.calciumDmMinPct) {
    const suggestedCalciumGrams = Math.max(2, Math.round((requirement.dailyIntakeMinG * 0.05) * 10) / 10);
    recommendations.push({
      id: "add-calcium",
      category: "add_nutrient",
      priority: calciumCheck.status === "error" ? "alta" : "media",
      title: `Suplementar calcio (meta >= ${requirement.calciumDmMinPct}% Ca en MS)`,
      detail:
        species === "gallina" || species === "codorniz"
          ? "En postura es indispensable fuente cálcica (conchilla/carbonato ~5–8 g/ave/día o concentrado completo de postura)."
          : "Complementa calcio mineral o concentrado de etapa para soportar desarrollo óseo.",
      candidates: buildNutrientCandidates({
        metric: "calcium_dm",
        availableFeeds,
        existingStandardIds,
        existingFeedIds,
        defaultGrams: suggestedCalciumGrams,
      }),
    });
  }

  const phosphorusCheck = checks.find((c) => c.metric === "phosphorus_dm");
  if (phosphorusCheck && phosphorusCheck.status === "warning") {
    recommendations.push({
      id: "add-phosphorus",
      category: "add_nutrient",
      priority: "media",
      title: `Reforzar fósforo disponible (meta >= ${requirement.availablePhosphorusDmMinPct}% MS)`,
      detail: "Considera fosfato dicálcico grado aviar o balanceado con fitasa verificada.",
      candidates: buildNutrientCandidates({
        metric: "phosphorus_dm",
        availableFeeds,
        existingStandardIds,
        existingFeedIds,
        defaultGrams: 2,
      }),
    });
  }

  const fiberCheck = checks.find((c) => c.metric === "fiber_dm");
  if (fiberCheck && fiberCheck.status === "warning") {
    const needsMoreFiber =
      requirement.fiberDmMinPct !== undefined && (summary.crudeFiberPctDm ?? 0) < requirement.fiberDmMinPct;
    recommendations.push({
      id: "adjust-fiber",
      category: "add_nutrient",
      priority: "media",
      title: needsMoreFiber
        ? `Aumentar fibra efectiva (meta >= ${requirement.fiberDmMinPct}% MS)`
        : `Moderar fibra bruta (máx <= ${requirement.fiberDmMaxPct}% MS)`,
      detail: needsMoreFiber
        ? "Añade forraje oreado o heno de leguminosa/gramínea para proteger el tránsito digestivo."
        : "Reduce la fracción fibrosa/forrajera y prioriza concentrado o grano de mayor digestibilidad.",
      candidates: needsMoreFiber
        ? buildNutrientCandidates({
            metric: "fiber_dm",
            availableFeeds,
            existingStandardIds,
            existingFeedIds,
            defaultGrams: Math.max(20, Math.round(requirement.dailyIntakeMinG * 0.25)),
          })
        : [],
    });
  }

  // 5. Ingredientes con ficha incompleta que impiden certificar la dieta
  const incompleteLines = lines.filter(
    (l) =>
      l.dryMatterPct === null ||
      l.crudeProteinPct === null ||
      l.energyKcalKgDm === null ||
      l.calciumDmPct === null ||
      l.availablePhosphorusDmPct === null,
  );
  if (incompleteLines.length > 0) {
    const details = incompleteLines.slice(0, 3).map((l) => {
      const missing: string[] = [];
      if (l.dryMatterPct === null) missing.push("MS%");
      if (l.crudeProteinPct === null) missing.push("PB%");
      if (l.energyKcalKgDm === null) missing.push("EM");
      if (l.calciumDmPct === null) missing.push("Ca%");
      if (l.availablePhosphorusDmPct === null) missing.push("P disp%");
      return `${l.feedName || "Alimento"} (${missing.join(", ")})`;
    });
    recommendations.push({
      id: "complete-missing-labels",
      category: "complete_data",
      priority: "media",
      title: "Condición para certificar la dieta: completar datos de etiqueta",
      detail: `Edita en Inventario y diligencia los campos faltantes en: ${details.join("; ")}${incompleteLines.length > 3 ? ` y ${incompleteLines.length - 3} más` : ""}.`,
      candidates: [],
    });
  }

  return recommendations;
}
