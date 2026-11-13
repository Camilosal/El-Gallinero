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
