// Clasificación oficial de huevo comercial en Colombia (NTC 1240),
// generación de código de lote PEPS y control de almacenamiento.

export interface Ntc1240CaliberSpec {
  code: "Jumbo" | "AAA" | "AA" | "A" | "B" | "C";
  label: string;
  rangeHint: string;
  minWeightG: number | null;
  maxWeightG: number | null;
  legacyAliases: string[];
}

export const NTC1240_GRADES: Ntc1240CaliberSpec[] = [
  { code: "Jumbo", label: "Jumbo (>78 g)", rangeHint: ">78 g", minWeightG: 78.1, maxWeightG: null, legacyAliases: ["jumbo"] },
  { code: "AAA", label: "AAA (67 – 77.9 g)", rangeHint: "67–77.9 g", minWeightG: 67, maxWeightG: 77.9, legacyAliases: ["aaa", "extra"] },
  { code: "AA", label: "AA (60 – 66.9 g)", rangeHint: "60–66.9 g", minWeightG: 60, maxWeightG: 66.9, legacyAliases: ["aa", "grande"] },
  { code: "A", label: "A (53 – 59.9 g)", rangeHint: "53–59.9 g", minWeightG: 53, maxWeightG: 59.9, legacyAliases: ["a", "mediano", "mediana"] },
  { code: "B", label: "B (46 – 52.9 g)", rangeHint: "46–52.9 g", minWeightG: 46, maxWeightG: 52.9, legacyAliases: ["b", "pequeño", "pequeno", "pequeña", "pequena"] },
  { code: "C", label: "C (<46 g)", rangeHint: "<46 g", minWeightG: null, maxWeightG: 45.9, legacyAliases: ["c"] },
];

export function classifyWeightNtc1240(weightGrams: number): Ntc1240CaliberSpec {
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    return NTC1240_GRADES[2]; // AA por defecto ante entrada inválida
  }
  if (weightGrams > 78) return NTC1240_GRADES[0];
  if (weightGrams >= 67) return NTC1240_GRADES[1];
  if (weightGrams >= 60) return NTC1240_GRADES[2];
  if (weightGrams >= 53) return NTC1240_GRADES[3];
  if (weightGrams >= 46) return NTC1240_GRADES[4];
  return NTC1240_GRADES[5];
}

export function getNtc1240Hint(sizeName: string | null | undefined): string | null {
  const s = String(sizeName || "").trim().toLowerCase();
  if (!s) return null;
  for (const grade of NTC1240_GRADES) {
    if (grade.code.toLowerCase() === s || grade.legacyAliases.includes(s)) {
      return `${grade.code} (${grade.rangeHint})`;
    }
  }
  return null;
}

export function generateEggLotCode(dateIso: string, species: string, uniqueHint?: string): string {
  const compactDate = String(dateIso || "").replace(/-/g, "").slice(0, 8) || "00000000";
  const prefix = String(species || "gallina").slice(0, 3).toUpperCase();
  const suffix = (uniqueHint || Math.random().toString(36).slice(2, 6)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase().padStart(4, "0");
  return `H-${compactDate}-${prefix}-${suffix}`;
}

export function checkEggStorageTelemetry(
  tempC: number | string | null | undefined,
  humidityPct: number | string | null | undefined,
): string[] {
  const warnings: string[] = [];
  if (tempC !== null && tempC !== undefined && tempC !== "") {
    const t = Number(tempC);
    if (Number.isFinite(t)) {
      if (t < 10) warnings.push(`Temperatura bodega (${t}°C) por debajo del rango ideal (10–15°C)`);
      else if (t > 15) warnings.push(`Temperatura bodega (${t}°C) sobre el máximo recomendado (10–15°C)`);
    }
  }
  if (humidityPct !== null && humidityPct !== undefined && humidityPct !== "") {
    const h = Number(humidityPct);
    if (Number.isFinite(h)) {
      if (h < 75) warnings.push(`Humedad relativa (${h}%) baja respecto al rango ideal (75–85%)`);
      else if (h > 85) warnings.push(`Humedad relativa (${h}%) alta respecto al rango ideal (75–85%)`);
    }
  }
  return warnings;
}
