import { isFreshFeedCategory } from "@/lib/feed-classification";

export type RationLine = {
  /** Gramos por animal y día, en base fresca (tal como se ofrece). */
  grams: number;
  dryMatterPct: number | null;
  crudeProteinPct: number | null;
  category: string | null;
  /** Campos nutricionales opcionales en base seca (MS). */
  energyKcalKgDm?: number | null;
  calciumDmPct?: number | null;
  availablePhosphorusDmPct?: number | null;
  lysineDigDmPct?: number | null;
  metCysDigDmPct?: number | null;
  crudeFiberDmPct?: number | null;
  sanitaryStatus?: string | null;
  standardCatalogId?: string | null;
  feedName?: string | null;
  allowedSpecies?: string[] | null;
};

export type RationSummary = {
  totalGrams: number;
  /** Gramos de materia seca por animal/día; solo suma ingredientes con % de materia seca conocido. */
  dryMatterGrams: number;
  /** true cuando todos los ingredientes tienen % de materia seca. */
  dryMatterComplete: boolean;
  /** % de materia seca de la mezcla completa; null si falta % MS en algún ingrediente. */
  dryMatterPct: number | null;
  /** % de proteína cruda de la ración en base fresca; null si falta algún dato. */
  crudeProteinPctAsFed: number | null;
  /** % de proteína cruda en base seca (MS); null si falta MS o PB en algún ingrediente. */
  crudeProteinPctDm: number | null;
  /** Energía metabolizable ponderada (kcal/kg MS); null si falta MS o EM en algún ingrediente. */
  energyKcalKgDm: number | null;
  /** Calcio ponderado (% MS); null si falta MS o Ca en algún ingrediente. */
  calciumPctDm: number | null;
  /** Fósforo disponible ponderado (% MS); null si falta MS o P disp en algún ingrediente. */
  availablePhosphorusPctDm: number | null;
  /** Lisina digestible ponderada (% MS). */
  lysineDigPctDm: number | null;
  /** Metionina+Cistina digestible ponderada (% MS). */
  metCysDigPctDm: number | null;
  /** Fibra bruta ponderada (% MS). */
  crudeFiberPctDm: number | null;
  /** % de la ración (base fresca) aportado por alimentos de categoría En Fresco. */
  freshSharePct: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Resume una dieta combinada en base fresca y base seca (MS). */
export function summarizeRation(lines: RationLine[]): RationSummary {
  const totalGrams = lines.reduce((sum, line) => sum + line.grams, 0);
  let dryMatterGrams = 0;
  let proteinGrams = 0;
  let freshGrams = 0;

  let energyKcalTotal = 0;
  let calciumDmGrams = 0;
  let phosphorusDmGrams = 0;
  let lysineDmGrams = 0;
  let metCysDmGrams = 0;
  let fiberDmGrams = 0;

  let dryMatterComplete = lines.length > 0;
  let proteinComplete = lines.length > 0;
  let energyComplete = lines.length > 0;
  let calciumComplete = lines.length > 0;
  let phosphorusComplete = lines.length > 0;
  let lysineComplete = lines.length > 0;
  let metCysComplete = lines.length > 0;
  let fiberComplete = lines.length > 0;

  for (const line of lines) {
    if (isFreshFeedCategory(line.category)) freshGrams += line.grams;

    if (line.crudeProteinPct === null) {
      proteinComplete = false;
    } else {
      proteinGrams += (line.grams * line.crudeProteinPct) / 100;
    }

    if (line.dryMatterPct === null || line.dryMatterPct <= 0) {
      dryMatterComplete = false;
      energyComplete = false;
      calciumComplete = false;
      phosphorusComplete = false;
      lysineComplete = false;
      metCysComplete = false;
      fiberComplete = false;
      continue;
    }

    const lineDmGrams = (line.grams * line.dryMatterPct) / 100;
    dryMatterGrams += lineDmGrams;

    if (line.energyKcalKgDm == null) energyComplete = false;
    else energyKcalTotal += (lineDmGrams / 1000) * line.energyKcalKgDm;

    if (line.calciumDmPct == null) calciumComplete = false;
    else calciumDmGrams += (lineDmGrams * line.calciumDmPct) / 100;

    if (line.availablePhosphorusDmPct == null) phosphorusComplete = false;
    else phosphorusDmGrams += (lineDmGrams * line.availablePhosphorusDmPct) / 100;

    if (line.lysineDigDmPct == null) lysineComplete = false;
    else lysineDmGrams += (lineDmGrams * line.lysineDigDmPct) / 100;

    if (line.metCysDigDmPct == null) metCysComplete = false;
    else metCysDmGrams += (lineDmGrams * line.metCysDigDmPct) / 100;

    if (line.crudeFiberDmPct == null) fiberComplete = false;
    else fiberDmGrams += (lineDmGrams * line.crudeFiberDmPct) / 100;
  }

  const hasDm = dryMatterComplete && dryMatterGrams > 0;

  return {
    totalGrams: round2(totalGrams),
    dryMatterGrams: round2(dryMatterGrams),
    dryMatterComplete,
    dryMatterPct: hasDm && totalGrams > 0 ? round2((dryMatterGrams / totalGrams) * 100) : null,
    crudeProteinPctAsFed: proteinComplete && totalGrams > 0 ? round2((proteinGrams / totalGrams) * 100) : null,
    crudeProteinPctDm: hasDm && proteinComplete ? round2((proteinGrams / dryMatterGrams) * 100) : null,
    energyKcalKgDm: hasDm && energyComplete ? Math.round((energyKcalTotal / dryMatterGrams) * 1000) : null,
    calciumPctDm: hasDm && calciumComplete ? round2((calciumDmGrams / dryMatterGrams) * 100) : null,
    availablePhosphorusPctDm: hasDm && phosphorusComplete ? round2((phosphorusDmGrams / dryMatterGrams) * 100) : null,
    lysineDigPctDm: hasDm && lysineComplete ? round2((lysineDmGrams / dryMatterGrams) * 100) : null,
    metCysDigPctDm: hasDm && metCysComplete ? round2((metCysDmGrams / dryMatterGrams) * 100) : null,
    crudeFiberPctDm: hasDm && fiberComplete ? round2((fiberDmGrams / dryMatterGrams) * 100) : null,
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

/** Valida un valor numérico decimal no negativo con límite configurable (ej: EM kcal/kg MS). */
export function parseOptionalNutrientDecimal(
  value: unknown,
  label: string,
  options: { min?: number; max: number } = { max: 99999.99 },
): { value: string | null } | { error: string } {
  if (value === undefined || value === null || value === "") return { value: null };
  const n = Number(value);
  const min = options.min ?? 0;
  if (!Number.isFinite(n) || n < min || n > options.max) {
    return { error: `${label} debe estar entre ${min} y ${options.max}` };
  }
  return { value: n.toFixed(2) };
}
