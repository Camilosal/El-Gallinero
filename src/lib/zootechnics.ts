import type { StandardCurvePoint } from "@/lib/standard-curves";

export interface UniformityStats {
  sampleCount: number;
  meanG: number;
  stdDevG: number;
  cvPercent: number;
  uniformityPct: number;
  withinBandCount: number;
  cvStatus: "excelente" | "aceptable" | "desuniforme";
}

export function parseIndividualWeightsInput(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\s,;]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  return [];
}

export function computeUniformityStats(weightsG: number[], tolerancePct = 10): UniformityStats | null {
  const valid = weightsG.filter((w) => Number.isFinite(w) && w > 0);
  if (valid.length === 0) return null;
  const n = valid.length;
  const meanG = valid.reduce((s, w) => s + w, 0) / n;
  const variance = n > 1 ? valid.reduce((s, w) => s + (w - meanG) ** 2, 0) / (n - 1) : 0;
  const stdDevG = Math.sqrt(variance);
  const cvPercent = meanG > 0 ? (stdDevG / meanG) * 100 : 0;
  const bandMin = meanG * (1 - tolerancePct / 100);
  const bandMax = meanG * (1 + tolerancePct / 100);
  const withinBandCount = valid.filter((w) => w >= bandMin && w <= bandMax).length;
  const uniformityPct = (withinBandCount / n) * 100;
  const cvStatus = cvPercent <= 8 ? "excelente" : cvPercent <= 12 ? "aceptable" : "desuniforme";
  return {
    sampleCount: n,
    meanG: Number(meanG.toFixed(1)),
    stdDevG: Number(stdDevG.toFixed(1)),
    cvPercent: Number(cvPercent.toFixed(2)),
    uniformityPct: Number(uniformityPct.toFixed(2)),
    withinBandCount,
    cvStatus,
  };
}

export function computeDailyGainG(previousWeightG: number, currentWeightG: number, daysElapsed: number): number | null {
  if (!Number.isFinite(previousWeightG) || !Number.isFinite(currentWeightG) || !Number.isFinite(daysElapsed) || daysElapsed <= 0) {
    return null;
  }
  return Number(((currentWeightG - previousWeightG) / daysElapsed).toFixed(2));
}

export function computeEpef(params: { livabilityPct: number; bodyWeightKg: number; ageDays: number; fcr: number }): number | null {
  const { livabilityPct, bodyWeightKg, ageDays, fcr } = params;
  if (ageDays <= 0 || fcr <= 0 || livabilityPct <= 0 || bodyWeightKg <= 0) return null;
  return Number((((livabilityPct * bodyWeightKg) / (ageDays * fcr)) * 100).toFixed(1));
}

export interface EnvironmentCalibration {
  factor: number;
  altitudeMeters: number | null;
  floorType: string | null;
  notes: string[];
}

export function calibrateTargetForEnvironment(
  species: string,
  altitudeMeters?: number | null,
  floorType?: string | null,
): EnvironmentCalibration {
  let factor = 1.0;
  const notes: string[] = [];
  const alt = altitudeMeters != null && Number.isFinite(altitudeMeters) ? altitudeMeters : null;
  const floor = floorType ? floorType.toLowerCase().trim() : null;

  if (alt != null) {
    if (["pollo", "pato"].includes(species) && alt >= 2200) {
      factor *= 0.94;
      notes.push(`Altitud ${alt} msnm: -6% en peso objetivo por menor presión de O₂ y control de ascitis`);
    } else if (["pollo", "pato"].includes(species) && alt >= 1600) {
      factor *= 0.97;
      notes.push(`Altitud ${alt} msnm: -3% ajuste metabólico moderado`);
    } else if (species === "cuy" && alt >= 1800 && alt <= 3400) {
      notes.push(`Altitud ${alt} msnm óptima para cuy andino`);
    }
  }

  if (floor === "pastoreo") {
    factor *= 0.95;
    notes.push("Sistema pastoreo: -5% por mayor gasto energético de locomoción");
  } else if (floor === "jaula" || floor === "baterias" || floor === "pozas") {
    factor *= 1.02;
    notes.push(`Alojamiento en ${floor}: +2% eficiencia energética por menor desplazamiento`);
  }

  return {
    factor: Number(factor.toFixed(4)),
    altitudeMeters: alt,
    floorType: floor,
    notes,
  };
}


export interface CurveCalibrationObservation {
  week: number;
  actualValue: number;
  sampleSize?: number | null;
  ageDaysFromNow?: number | null;
}

export interface EmpiricalCurveCalibration {
  empiricalFactor: number;
  environmentFactor: number;
  combinedFactor: number;
  observationCount: number;
  confidencePct: number;
  meanObservedRatio: number | null;
  status: "sin_historial" | "en_aprendizaje" | "calibrada";
  calibratedPoints: StandardCurvePoint[];
  explanation: string;
}

function interpolateCurvePoints(points: StandardCurvePoint[], week: number): StandardCurvePoint | null {
  if (!Number.isFinite(week) || points.length === 0) return null;
  if (week < points[0].week || week > points[points.length - 1].week) return null;
  const exact = points.find((pt) => pt.week === week);
  if (exact) return exact;
  const upperIdx = points.findIndex((pt) => pt.week > week);
  if (upperIdx <= 0) return null;
  const lower = points[upperIdx - 1];
  const upper = points[upperIdx];
  const ratio = (week - lower.week) / (upper.week - lower.week);
  return {
    week,
    target: lower.target + (upper.target - lower.target) * ratio,
    min: lower.min + (upper.min - lower.min) * ratio,
    max: lower.max + (upper.max - lower.max) * ratio,
  };
}

/**
 * Autocalibración empírica por finca (Capacidad 1) usando encogimiento Bayesiano:
 * combina mediciones reales válidas de la finca ponderadas por tamaño de muestra y recencia
 * contra pseudoconteos de la curva estándar (K = priorStrength).
 */
export function computeEmpiricalCurveCalibration(params: {
  points: StandardCurvePoint[];
  observations: CurveCalibrationObservation[];
  environmentFactor?: number;
  priorStrength?: number;
  minFactor?: number;
  maxFactor?: number;
}): EmpiricalCurveCalibration {
  const environmentFactor =
    params.environmentFactor != null && Number.isFinite(params.environmentFactor) && params.environmentFactor > 0
      ? Number(params.environmentFactor.toFixed(4))
      : 1;
  const priorStrength = Math.max(1, params.priorStrength ?? 4);
  const minFactor = params.minFactor ?? 0.82;
  const maxFactor = params.maxFactor ?? 1.18;

  let weightedRatioSum = 0;
  let weightSum = 0;
  let validCount = 0;

  for (const obs of params.observations) {
    if (!Number.isFinite(obs.week) || obs.week < 0 || !Number.isFinite(obs.actualValue) || obs.actualValue <= 0) {
      continue;
    }
    const expected = interpolateCurvePoints(params.points, obs.week);
    if (!expected || expected.target <= 0) continue;

    const ratio = obs.actualValue / expected.target;
    // Descartar errores evidentes de digitación fuera de [0.45, 1.65]
    if (ratio < 0.45 || ratio > 1.65) continue;

    const sampleN = Math.max(1, Number(obs.sampleSize ?? 1));
    const ageDays = Math.max(0, Number(obs.ageDaysFromNow ?? 0));
    const weight = Math.log1p(sampleN) * Math.exp(-0.015 * ageDays);

    weightedRatioSum += ratio * weight;
    weightSum += weight;
    validCount += 1;
  }

  if (validCount === 0 || weightSum <= 0) {
    return {
      empiricalFactor: 1,
      environmentFactor,
      combinedFactor: environmentFactor,
      observationCount: 0,
      confidencePct: 0,
      meanObservedRatio: null,
      status: "sin_historial",
      calibratedPoints: params.points.map((pt) => ({ ...pt })),
      explanation: "Sin suficientes mediciones históricas válidas; se conserva la referencia estándar.",
    };
  }

  const meanObservedRatio = weightedRatioSum / weightSum;
  const shrinkageWeight = validCount / (validCount + priorStrength);
  const rawEmp = 1 + shrinkageWeight * (meanObservedRatio - 1);
  const empiricalFactor = Number(Math.min(maxFactor, Math.max(minFactor, rawEmp)).toFixed(4));
  const combinedFactor = Number((environmentFactor * empiricalFactor).toFixed(4));
  const confidencePct = Math.round(shrinkageWeight * 100);
  const status: EmpiricalCurveCalibration["status"] =
    validCount >= 4 ? "calibrada" : "en_aprendizaje";

  const calibratedPoints = params.points.map((pt) => ({
    week: pt.week,
    target: Number((pt.target * empiricalFactor).toFixed(1)),
    min: Number((pt.min * empiricalFactor).toFixed(1)),
    max: Number((pt.max * empiricalFactor).toFixed(1)),
  }));

  const deltaPct = Math.round((empiricalFactor - 1) * 1000) / 10;
  const sign = deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`;
  const explanation =
    status === "calibrada"
      ? `Curva autocalibrada con ${validCount} mediciones reales (${sign}, confianza ${confidencePct}%).`
      : `En aprendizaje con ${validCount} mediciones reales (${sign} parcial, confianza ${confidencePct}%; alcanza 4+ muestras para calibración estable).`;

  return {
    empiricalFactor,
    environmentFactor,
    combinedFactor,
    observationCount: validCount,
    confidencePct,
    meanObservedRatio: Number(meanObservedRatio.toFixed(4)),
    status,
    calibratedPoints,
    explanation,
  };
}
