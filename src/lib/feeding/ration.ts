import { isFreshFeedCategory } from "@/lib/feed-classification";

export type RationLine = {
  /** Gramos por animal y día, en base fresca (tal como se ofrece). */
  grams: number;
  dryMatterPct: number | null;
  crudeProteinPct: number | null;
  category: string | null;
};

export type RationSummary = {
  totalGrams: number;
  /** Gramos de materia seca por animal/día; solo suma ingredientes con % de materia seca conocido. */
  dryMatterGrams: number;
  /** true cuando todos los ingredientes tienen % de materia seca. */
  dryMatterComplete: boolean;
  /** % de proteína cruda de la ración en base fresca; null si falta algún dato. */
  crudeProteinPctAsFed: number | null;
  /** % de la ración (base fresca) aportado por alimentos de categoría En Fresco. */
  freshSharePct: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Resume una dieta combinada: materia seca, proteína y proporción de forraje fresco. */
export function summarizeRation(lines: RationLine[]): RationSummary {
  const totalGrams = lines.reduce((sum, line) => sum + line.grams, 0);
  let dryMatterGrams = 0;
  let proteinGrams = 0;
  let freshGrams = 0;
  let dryMatterComplete = lines.length > 0;
  let proteinComplete = lines.length > 0;

  for (const line of lines) {
    if (line.dryMatterPct === null) dryMatterComplete = false;
    else dryMatterGrams += (line.grams * line.dryMatterPct) / 100;
    if (line.crudeProteinPct === null) proteinComplete = false;
    else proteinGrams += (line.grams * line.crudeProteinPct) / 100;
    if (isFreshFeedCategory(line.category)) freshGrams += line.grams;
  }

  return {
    totalGrams: round2(totalGrams),
    dryMatterGrams: round2(dryMatterGrams),
    dryMatterComplete,
    crudeProteinPctAsFed: proteinComplete && totalGrams > 0 ? round2((proteinGrams / totalGrams) * 100) : null,
    freshSharePct: totalGrams > 0 ? round2((freshGrams / totalGrams) * 100) : 0,
  };
}

/** Valida un porcentaje opcional (0-100). Devuelve null cuando viene vacío. */
export function parseOptionalPercent(
  value: unknown,
  label: string,
  options: { positive?: boolean } = {},
): { value: string | null } | { error: string } {
  if (value === undefined || value === null || value === "") return { value: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n > 100 || n < 0 || (options.positive && n === 0)) {
    return { error: options.positive ? `${label} debe ser mayor que 0 y hasta 100` : `${label} debe estar entre 0 y 100` };
  }
  return { value: n.toFixed(2) };
}

