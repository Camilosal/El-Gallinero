import {
  COBB_500_FEMALE,
  COBB_500_MALE,
  COTURNIX_JAPONICA,
  CONEJO_NZ_CALIFORNIA,
  ROSS_308_MIXED,
  CUY_MEJORADO,
  CUY_CRIOLLO,
} from "@/lib/breed-standards";

export type CurveSpecies = "gallina" | "pollo" | "codorniz" | "pato" | "conejo" | "cuy";
export type CurveMetric = "postura" | "peso";

export interface StandardCurvePoint {
  week: number;
  target: number;
  min: number;
  max: number;
}

export interface StandardCurve {
  species: CurveSpecies;
  speciesLabel: string;
  breed: string;
  metric: CurveMetric;
  unit: string;
  sourceLabel: string;
  sourceUrl: string;
  note: string;
  points: StandardCurvePoint[];
}

function normalizeWeightCurve(
  points: { week: number; targetG: number; minG?: number; maxG?: number }[],
): StandardCurvePoint[] {
  return points.map((point) => ({
    week: point.week,
    target: point.targetG,
    min: point.minG ?? Math.round(point.targetG * 0.9),
    max: point.maxG ?? Math.round(point.targetG * 1.1),
  }));
}

function mixedCobbCurve(): StandardCurvePoint[] {
  const femaleByWeek = new Map(COBB_500_FEMALE.map((point) => [point.week, point]));
  return COBB_500_MALE.flatMap((male) => {
    const female = femaleByWeek.get(male.week);
    if (!female) return [];
    return [{
      week: male.week,
      target: Math.round((male.targetG + female.targetG) / 2),
      min: Math.min(male.minG ?? male.targetG, female.minG ?? female.targetG),
      max: Math.max(male.maxG ?? male.targetG, female.maxG ?? female.targetG),
    }];
  });
}

// Hy-Line Brown Management Guide: levante/pre-postura (semanas 15-18) y postura hasta semana 100 (% postura ave-día)
const hylineBrownLayerCurve: StandardCurvePoint[] = [
  { week: 15, min: 0, target: 0, max: 0 },
  { week: 16, min: 0, target: 0, max: 1 },
  { week: 17, min: 1, target: 2, max: 4 },
  { week: 18, min: 4, target: 7, max: 10 },
  { week: 19, min: 18, target: 24, max: 30 },
  { week: 20, min: 48, target: 55, max: 62 },
  { week: 22, min: 82, target: 86, max: 90 },
  { week: 24, min: 91, target: 94, max: 96 },
  { week: 26, min: 93, target: 95, max: 97 },
  { week: 30, min: 93, target: 95, max: 97 },
  { week: 40, min: 90, target: 92, max: 94 },
  { week: 50, min: 86, target: 88, max: 90 },
  { week: 60, min: 82, target: 84, max: 86 },
  { week: 70, min: 76, target: 79, max: 82 },
  { week: 80, min: 71, target: 74, max: 77 },
  { week: 90, min: 65, target: 68, max: 71 },
  { week: 100, min: 59, target: 62, max: 65 },
];

// Hy-Line W-36 Commercial Layers, Production Period Performance Table,
// August 2025, weekly % hen-day reference values, aggregated to representative weeks.
const hylineLayerCurve: StandardCurvePoint[] = [
  { week: 19, min: 9, target: 9.5, max: 10 },
  { week: 20, min: 27, target: 27.5, max: 28 },
  { week: 21, min: 53, target: 54, max: 55 },
  { week: 22, min: 72, target: 73.5, max: 75 },
  { week: 23, min: 82, target: 83.5, max: 85 },
  { week: 24, min: 87, target: 89, max: 91 },
  { week: 25, min: 91, target: 92.5, max: 94 },
  { week: 26, min: 92, target: 94, max: 96 },
  { week: 27, min: 93, target: 95, max: 97 },
  { week: 28, min: 93, target: 95, max: 97 },
  { week: 32, min: 94, target: 95.5, max: 97 },
  { week: 36, min: 93, target: 95, max: 97 },
  { week: 40, min: 92, target: 94, max: 96 },
  { week: 50, min: 90, target: 92, max: 94 },
  { week: 60, min: 86, target: 87.5, max: 89 },
  { week: 70, min: 80, target: 81.5, max: 83 },
  { week: 75, min: 76, target: 77.5, max: 79 },
];

// Government of India Poultry Farm Manual (2014-15): Japanese quail are
// reported at 170–190 g in week 5; surrounding weeks are the app's local reference curve.
const quailCurve = normalizeWeightCurve(COTURNIX_JAPONICA.map((point) => point.week === 5
  ? { ...point, targetG: 180, minG: 170, maxG: 190 }
  : point));

// FAO Peking duck growth reference (satisfactory / poor growth) is used as an
// indicative target range. Local strains and management can differ substantially.
const pekinCurve: StandardCurvePoint[] = [
  { week: 0, min: 50, target: 50, max: 55 },
  { week: 1, min: 125, target: 180, max: 200 },
  { week: 2, min: 210, target: 380, max: 420 },
  { week: 3, min: 350, target: 750, max: 825 },
  { week: 4, min: 530, target: 1200, max: 1320 },
  { week: 5, min: 645, target: 1600, max: 1760 },
  { week: 6, min: 950, target: 2000, max: 2200 },
  { week: 7, min: 1200, target: 2350, max: 2585 },
  { week: 8, min: 1500, target: 2500, max: 2750 },
];

// The extension market guide defines the acceptable 8–10 week fryer range.
// Earlier points follow the app's existing growth estimate; weeks 8–10 use
// the published 3.5–5.5 lb market range as a comparison band.
const rabbitCurve: StandardCurvePoint[] = normalizeWeightCurve(CONEJO_NZ_CALIFORNIA.map((point) => ({
  week: Math.round(point.day / 7),
  targetG: point.day === 56 || point.day === 63 || point.day === 70 ? 2150 : point.targetG,
  minG: point.day === 56 || point.day === 63 || point.day === 70 ? 1588 : point.minG,
  maxG: point.day === 56 || point.day === 63 || point.day === 70 ? 2495 : point.maxG,
})));

const curves: StandardCurve[] = [
  {
    species: "gallina",
    speciesLabel: "Gallinas ponedoras",
    breed: "Ponedora comercial (Hy-Line W-36)",
    metric: "postura",
    unit: "% de postura ave-día",
    sourceLabel: "Hy-Line W-36, tabla de rendimiento agosto 2025",
    sourceUrl: "https://www.hyline.com/filesimages/Hy-Line-Products/Hy-Line-Product-PDFs/W-36/36%20PS%20ENG.pdf",
    note: "Referencia comercial de semanas 19–75. Compara huevos por día y por gallina activa; otras líneas, luz y manejo pueden cambiar la curva.",
    points: hylineLayerCurve,
  },
  {
    species: "gallina",
    speciesLabel: "Gallinas ponedoras",
    breed: "Hy-Line Brown",
    metric: "postura",
    unit: "% de postura ave-día",
    sourceLabel: "Hy-Line Brown Management Guide (semanas 15–100)",
    sourceUrl: "https://www.hyline.com/varieties/brown",
    note: "Incluye transición de pre-postura semanas 15–18 y postura comercial hasta semana 100 (consumo objetivo ~110–115 g/ave/día).",
    points: hylineBrownLayerCurve,
  },
  {
    species: "pollo",
    speciesLabel: "Pollos de engorde",
    breed: "Ross 308 (mixto)",
    metric: "peso",
    unit: "g de peso vivo",
    sourceLabel: "Aviagen Ross 308 Broiler Performance Objectives",
    sourceUrl: "https://aviagen.com/en/brands/ross/products/ross-308",
    note: "Curva mixta as-hatched semanas 0–7 para pollo comercial Ross 308.",
    points: normalizeWeightCurve(ROSS_308_MIXED),
  },
  {
    species: "pollo",
    speciesLabel: "Pollos de engorde",
    breed: "Cobb 500 (mixto)",
    metric: "peso",
    unit: "g de peso vivo",
    sourceLabel: "Curva Cobb 500 combinada de las referencias de hembras y machos ya cargadas",
    sourceUrl: "https://www.cobb-vantress.com/resource/managementguides",
    note: "Se muestra una sola referencia: el objetivo es el promedio de ambas curvas y el rango cubre sus mínimos y máximos. No requiere registrar sexo.",
    points: mixedCobbCurve(),
  },
  {
    species: "codorniz",
    speciesLabel: "Codornices",
    breed: "Codorniz Japónica",
    metric: "peso",
    unit: "g de peso vivo",
    sourceLabel: "Poultry Farm Manual, Department of Animal Husbandry, India",
    sourceUrl: "https://www.greentribunal.gov.in/sites/default/files/news_updates/14720_1.pdf",
    note: "El manual informa 170–190 g a la semana 5. Los demás puntos son una guía de comparación orientativa.",
    points: quailCurve,
  },
  {
    species: "pato",
    speciesLabel: "Patos",
    breed: "Pato Pekín (referencia)",
    metric: "peso",
    unit: "g de peso vivo",
    sourceLabel: "FAO, Peking duck growth table",
    sourceUrl: "https://www.fao.org/4/p8669e/P8669E04.htm",
    note: "Curva de referencia para Pekín; el propio documento advierte que las líneas locales y el manejo alteran el crecimiento.",
    points: pekinCurve,
  },
  {
    species: "conejo",
    speciesLabel: "Conejos",
    breed: "Nueva Zelanda / California (referencia)",
    metric: "peso",
    unit: "g de peso vivo",
    sourceLabel: "Ohio 4-H, recomendaciones de peso para conejo de mercado",
    sourceUrl: "https://ohio4h.org/sites/ohio4h/files/imce/Market%20Rabbit%20Weight%20Recommendations.pdf",
    note: "La banda publicada es 1.59–2.50 kg entre 8 y 10 semanas. Los puntos previos al engorde final son orientativos.",
    points: rabbitCurve,
  },
  {
    species: "cuy",
    speciesLabel: "Cuyes",
    breed: "Cuy Mejorado (Andino / Perú)",
    metric: "peso",
    unit: "g de peso vivo",
    sourceLabel: "INIA Perú / Manual Técnico de Crianza de Cuyes",
    sourceUrl: "https://www.inia.gob.pe/",
    note: "Peso esperado en crianza tecnificada con forraje oreado + concentrado y suplemento de Vitamina C (destete semana 3, cosecha semanas 12–13).",
    points: normalizeWeightCurve(CUY_MEJORADO),
  },
  {
    species: "cuy",
    speciesLabel: "Cuyes",
    breed: "Cuy Criollo",
    metric: "peso",
    unit: "g de peso vivo",
    sourceLabel: "Referencia andina micro-granja rural",
    sourceUrl: "https://www.inia.gob.pe/",
    note: "Curva orientativa para líneas rústicas criollas.",
    points: normalizeWeightCurve(CUY_CRIOLLO),
  },
];

export function getStandardCurves(species: string): StandardCurve[] {
  return curves.filter((curve) => curve.species === species);
}

export function getStandardCurve(species: string, breed?: string | null): StandardCurve | undefined {
  const options = getStandardCurves(species);
  if (!breed) return options[0];
  const normalized = breed.trim().toLowerCase();
  return (
    options.find((curve) => curve.breed === breed) ||
    options.find((curve) => curve.breed.toLowerCase().includes(normalized)) ||
    options[0]
  );
}

export function interpolateStandard(curve: StandardCurve, week: number): StandardCurvePoint | null {
  const points = curve.points;
  if (!Number.isFinite(week) || points.length === 0 || week < points[0].week || week > points[points.length - 1].week) return null;
  const exact = points.find((point) => point.week === week);
  if (exact) return exact;
  const upperIndex = points.findIndex((point) => point.week > week);
  if (upperIndex <= 0) return null;
  const lower = points[upperIndex - 1];
  const upper = points[upperIndex];
  const ratio = (week - lower.week) / (upper.week - lower.week);
  return {
    week,
    target: lower.target + (upper.target - lower.target) * ratio,
    min: lower.min + (upper.min - lower.min) * ratio,
    max: lower.max + (upper.max - lower.max) * ratio,
  };
}
