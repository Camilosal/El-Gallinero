import { FEEDING_SPECIES, normalizeFeedingSpecies, SPECIES_LABELS, type FeedingSpecies } from "@/lib/species";

export interface FeedImagePreset {
  id: string;
  label: string;
  group: string;
  imageUrl: string;
}

export const FEED_IMAGE_PRESETS: ReadonlyArray<FeedImagePreset> = [
  {
    id: "concentrado-aves",
    label: "Concentrado ponedoras / aves",
    group: "Balanceados",
    imageUrl: "/images/alimentos/concentrado-aves.svg",
  },
  {
    id: "concentrado-pollo",
    label: "Concentrado pollo de engorde",
    group: "Balanceados",
    imageUrl: "/images/alimentos/concentrado-pollo.svg",
  },
  {
    id: "concentrado-codorniz",
    label: "Concentrado codorniz",
    group: "Balanceados",
    imageUrl: "/images/alimentos/concentrado-codorniz.svg",
  },
  {
    id: "concentrado-patos",
    label: "Concentrado patos",
    group: "Balanceados",
    imageUrl: "/images/alimentos/concentrado-patos.svg",
  },
  {
    id: "concentrado-conejos",
    label: "Peletizado conejos",
    group: "Balanceados",
    imageUrl: "/images/alimentos/concentrado-conejos.svg",
  },
  {
    id: "concentrado-cuyes",
    label: "Peletizado cuyes / curíes",
    group: "Balanceados",
    imageUrl: "/images/alimentos/concentrado-cuyes.svg",
  },
  {
    id: "concentrado-multiespecie",
    label: "Peletizado mixto / multiespecie",
    group: "Balanceados",
    imageUrl: "/images/alimentos/concentrado-multiespecie.svg",
  },
  {
    id: "cereales-semillas",
    label: "Cereales, granos y harinas",
    group: "Cereales y semillas",
    imageUrl: "/images/alimentos/cereales-semillas.svg",
  },
  {
    id: "forrajes-hojas",
    label: "Forrajes verdes, hojas y pastos",
    group: "Hojas y forrajes",
    imageUrl: "/images/alimentos/forrajes-hojas.svg",
  },
  {
    id: "raices-tuberculos",
    label: "Raíces y tubérculos",
    group: "Raíces y tubérculos",
    imageUrl: "/images/alimentos/raices-tuberculos.svg",
  },
  {
    id: "insectos-proteina",
    label: "Insectos, larvas BSF y lombriz",
    group: "Insectos y anélidos",
    imageUrl: "/images/alimentos/insectos-proteina.svg",
  },
  {
    id: "hortalizas-verduras",
    label: "Hortalizas y verduras",
    group: "Hortalizas y verduras",
    imageUrl: "/images/alimentos/hortalizas-verduras.svg",
  },
  {
    id: "frutas",
    label: "Frutas y pulpas frescas",
    group: "Frutas",
    imageUrl: "/images/alimentos/frutas.svg",
  },
  {
    id: "minerales-aditivos",
    label: "Minerales, calcio y premezclas",
    group: "Minerales y aditivos",
    imageUrl: "/images/alimentos/minerales-aditivos.svg",
  },
  {
    id: "recuperados-subproductos",
    label: "Recuperados y subproductos",
    group: "Recuperados y subproductos",
    imageUrl: "/images/alimentos/recuperados-subproductos.svg",
  },
];

export const FEED_SPECIES_SELECTOR_OPTIONS: ReadonlyArray<{
  value: FeedingSpecies;
  label: string;
  shortLabel: string;
  aliases: string[];
}> = [
  { value: "gallina", label: "Gallinas ponedoras", shortLabel: "Gallinas", aliases: ["gallinas", "ponedora", "ponedoras"] },
  { value: "gallo", label: "Gallos reproductores", shortLabel: "Gallos", aliases: ["gallos", "reproductor"] },
  { value: "pollo", label: "Pollos de engorde", shortLabel: "Pollos", aliases: ["pollos", "engorde", "broiler"] },
  { value: "codorniz", label: "Codornices", shortLabel: "Codornices", aliases: ["codornices", "coturnix"] },
  { value: "pato", label: "Patos", shortLabel: "Patos", aliases: ["patos", "anseriformes"] },
  { value: "conejo", label: "Conejos", shortLabel: "Conejos", aliases: ["conejos", "gazapos", "cunicultura"] },
  { value: "cuy", label: "Cuyes / curíes", shortLabel: "Cuyes", aliases: ["cuyes", "curi", "curies", "cobayo", "cobayos"] },
];

const ALL_BIRDS: FeedingSpecies[] = ["gallina", "gallo", "pollo", "codorniz", "pato"];
const ALL_MAMMALS: FeedingSpecies[] = ["conejo", "cuy"];
const ALL_FARM_SPECIES: FeedingSpecies[] = ["gallina", "gallo", "pollo", "codorniz", "pato", "conejo", "cuy"];

const SPECIES_SYNONYMS: Record<string, FeedingSpecies> = {
  gallina: "gallina",
  gallinas: "gallina",
  ponedora: "gallina",
  ponedoras: "gallina",
  pollita: "gallina",
  pollitas: "gallina",
  gallo: "gallo",
  gallos: "gallo",
  pollo: "pollo",
  pollos: "pollo",
  "pollo de engorde": "pollo",
  engorde: "pollo",
  broiler: "pollo",
  codorniz: "codorniz",
  codornices: "codorniz",
  pato: "pato",
  patos: "pato",
  conejo: "conejo",
  conejos: "conejo",
  gazapo: "conejo",
  gazapos: "conejo",
  cuy: "cuy",
  cuyes: "cuy",
  curi: "cuy",
  curies: "cuy",
  cobayo: "cuy",
  cobayos: "cuy",
};

function normText(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

/**
 * Normaliza una lista de especies objetivo (acepta arreglo o cadena separada por comas).
 * Mantiene el orden canónico de `FEEDING_SPECIES` y elimina duplicados o valores no válidos.
 */
export function normalizeFeedSpeciesList(input: unknown): FeedingSpecies[] {
  const rawList: string[] = Array.isArray(input)
    ? input.filter((v): v is string => typeof v === "string")
    : typeof input === "string"
      ? input.split(/[,;|]+/)
      : [];

  const found = new Set<FeedingSpecies>();
  for (const raw of rawList) {
    const clean = normText(raw);
    if (!clean) continue;
    const direct = normalizeFeedingSpecies(clean) ?? SPECIES_SYNONYMS[clean];
    if (direct) {
      found.add(direct);
    }
  }
  return FEEDING_SPECIES.filter((sp) => found.has(sp));
}

/**
 * Normaliza alias o nombres regionales (ej. "cuido", "ahuyama", "zapallo", "chonque").
 */
export function normalizeRegionalNamesList(input: unknown): string[] {
  const rawList: string[] = Array.isArray(input)
    ? input.filter((v): v is string => typeof v === "string")
    : typeof input === "string"
      ? input.split(/[,;\n|]+/)
      : [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of rawList) {
    const trimmed = item.trim().replace(/\s+/g, " ").slice(0, 64);
    if (!trimmed) continue;
    const key = normText(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= 16) break;
  }
  return out;
}

export function formatSpeciesBadgesLabel(species: ReadonlyArray<string> | null | undefined): string {
  const list = normalizeFeedSpeciesList(species ?? []);
  if (list.length === 0) return "Sin restricción específica";
  return list.map((sp) => {
    const plural = SPECIES_LABELS[sp]?.plural ?? sp;
    return plural.charAt(0).toUpperCase() + plural.slice(1);
  }).join(", ");
}

export function isFeedCompatibleWithSpecies(
  allowedSpecies: ReadonlyArray<string> | null | undefined,
  targetSpecies: FeedingSpecies,
): boolean {
  const normalized = normalizeFeedSpeciesList(allowedSpecies ?? []);
  // Si el alimento no restringe especies (legacy o genérico), no bloquea la selección manual.
  if (normalized.length === 0) return true;
  if (normalized.includes(targetSpecies)) return true;
  // Un gallo adulto puede compartir concentrados de levante/reproducción con gallina excepto ponedora alta en calcio;
  // la compatibilidad explícita sigue prevaleciendo arriba.
  return false;
}

interface CatalogOverride {
  species: FeedingSpecies[];
  regionalNames?: string[];
  description?: string;
  imageUrl?: string;
}

const SPECIFIC_IG_OVERRIDES: Record<string, CatalogOverride> = {
  "IG-001": {
    species: ["gallina"],
    regionalNames: ["Cuido ponedora", "Purina postura", "Concentrado postura", "Mash ponedora"],
    imageUrl: "/images/alimentos/concentrado-aves.svg",
    description: "Balanceado completo con alto aporte de calcio (3.6–4.8% MS) formulado exclusivamente para gallinas en postura activa de huevo. No usar en gallos machos, pollos de engorde ni mamíferos.",
  },
  "IG-002": {
    species: ["gallina"],
    regionalNames: ["Cuido prepostura", "Purina prepostura", "Concentrado polla 18 sem"],
    imageUrl: "/images/alimentos/concentrado-aves.svg",
    description: "Concentrado de transición (18–20 semanas) que prepara la reserva medular de calcio en pollonas antes del inicio de postura.",
  },
  "IG-003": {
    species: ["gallina", "gallo", "pollo"],
    regionalNames: ["Cuido levante", "Purina desarrollo", "Concentrado crecimiento aves"],
    imageUrl: "/images/alimentos/concentrado-aves.svg",
    description: "Balanceado de desarrollo para aves en recría, pollas de levante (6–18 sem), gallos y doble propósito con calcio moderado.",
  },
  "IG-004": {
    species: ["gallina", "gallo", "pollo", "codorniz", "pato"],
    regionalNames: ["Cuido iniciación", "Preiniciador aves", "Migaja pollito", "Purina cría"],
    imageUrl: "/images/alimentos/concentrado-aves.svg",
    description: "Alimento en migaja fina alta en proteína para primera semana de aves. Antes de dar a patos, comprobar en etiqueta que no contenga coccidiostatos tóxicos.",
  },
  "IG-005": {
    species: ["gallina", "gallo"],
    regionalNames: ["Cuido reproductoras", "Concentrado pie de cría aviar"],
    imageUrl: "/images/alimentos/concentrado-aves.svg",
    description: "Balanceado formulado para lotes reproductores orientados a fertilidad embrionaria e incubación.",
  },
  "IG-120": {
    species: ["pollo"],
    regionalNames: ["Cuido engorde", "Pollo ceba", "Finalizador broiler", "Purina pollo"],
    imageUrl: "/images/alimentos/concentrado-pollo.svg",
    description: "Balanceado de alta energía y proteína para pollos de engorde en fases de iniciación y finalización, orientado a rápida conversión en carne.",
  },
  "IG-121": {
    species: ["codorniz"],
    regionalNames: ["Cuido codorniz inicio", "Iniciador coturnícola", "Harina cría codorniz"],
    imageUrl: "/images/alimentos/concentrado-codorniz.svg",
    description: "Concentrado fino de muy alta proteína (24–27% PB en MS) adaptado al pico pequeño y veloz emplume inicial de codornices (0–5 sem).",
  },
  "IG-122": {
    species: ["codorniz"],
    regionalNames: ["Cuido codorniz postura", "Concentrado ponedora codorniz"],
    imageUrl: "/images/alimentos/concentrado-codorniz.svg",
    description: "Balanceado fino con densidad elevada de proteína (20–24% PB MS) y calcio equilibrado para alta tasa de postura en codornices adultas.",
  },
  "IG-123": {
    species: ["pato"],
    regionalNames: ["Cuido patos", "Concentrado anseriformes", "Pellet para pato"],
    imageUrl: "/images/alimentos/concentrado-patos.svg",
    description: "Alimento peletizado (evita atoramiento en picos planos) libre de medicamentos incompatibles con aves acuáticas, con aporte adecuado de niacina para cría y engorde de patos.",
  },
  "IG-124": {
    species: ["conejo"],
    regionalNames: ["Cuido conejos", "Conejina", "Pellet cunícola", "Concentrado ceba conejo"],
    imageUrl: "/images/alimentos/concentrado-conejos.svg",
    description: "Pellet fibroso (>12% fibra bruta MS) para conejos de engorde, gazapos y reproducción. Suministrar siempre acompañado de forraje oreado o heno para cuidar la flora cecal.",
  },
  "IG-125": {
    species: ["cuy"],
    regionalNames: ["Cuido cuyes", "Cuyina", "Concentrado curí", "Pellet cobayos Vitamina C"],
    imageUrl: "/images/alimentos/concentrado-cuyes.svg",
    description: "Pellet formulado para cuyes/curíes enriquecido con fibra digestible y Vitamina C protegida (ácido ascórbico esencial que el cobayo no sintetiza).",
  },
  "IG-126": {
    species: ["conejo", "cuy"],
    regionalNames: ["Cuido conejo y cuy", "Conejina multiuso", "Pellet curí y conejo"],
    imageUrl: "/images/alimentos/concentrado-multiespecie.svg",
    description: "Pellet fibroso multipropósito para granjas mixtas de conejos y cuyes; cuando se suministra a cuyes requiere complementar con forraje verde oreado o Vitamina C estable.",
  },
  // Insectos (aves únicamente)
  "IG-006": { species: ALL_BIRDS, regionalNames: ["Larva BSF fresca", "Mosca soldado negra", "Gusano compostero"] },
  "IG-007": { species: ALL_BIRDS, regionalNames: ["BSF deshidratada", "Harina entera de larva", "Mosca soldado seca"] },
  "IG-008": { species: ALL_BIRDS, regionalNames: ["Harina BSF desgrasada", "Torta de larva BSF"] },
  "IG-009": { species: ALL_BIRDS, regionalNames: ["Prepupa BSF", "Larva pupada seca"] },
  "IG-010": { species: ALL_BIRDS, regionalNames: ["Tenebrio vivo", "Gusano de la harina"] },
  "IG-011": { species: ALL_BIRDS, regionalNames: ["Tenebrio seco", "Harina de tenebrio"] },
  "IG-012": { species: ALL_BIRDS, regionalNames: ["Lombriz roja californiana", "Lombriz de compost"] },
  "IG-013": { species: ALL_BIRDS, regionalNames: ["Harina de lombriz"] },
  "IG-014": { species: ALL_BIRDS, regionalNames: ["Grillo seco", "Harina de grillo"] },
  // Cereales clave
  "IG-015": { species: ALL_FARM_SPECIES, regionalNames: ["Maíz amarillo", "Choclo seco", "Cucho", "Maíz duro"] },
  "IG-016": { species: ALL_FARM_SPECIES, regionalNames: ["Maíz blanco", "Trillado", "Maíz tierno seco"] },
  "IG-017": { species: ALL_FARM_SPECIES, regionalNames: ["Maíz molido", "Maíz partido", "Cuchuco", "Maíz picado"] },
  "IG-018": { species: ALL_FARM_SPECIES, regionalNames: ["Sorgo", "Millo", "Maicillo"] },
  "IG-022": { species: ALL_FARM_SPECIES, regionalNames: ["Arrocillo", "Granza de arroz", "Arroz partido"] },
  "IG-023": { species: ALL_FARM_SPECIES, regionalNames: ["Polvillo de arroz", "Salvado de arroz", "Harinilla de arroz"] },
  "IG-024": { species: ALL_FARM_SPECIES, regionalNames: ["Mogolla de trigo", "Salvado de trigo", "Afrecho de trigo"] },
  "IG-025": { species: ALL_FARM_SPECIES, regionalNames: ["Torta de soya", "Harina de soja 48%"] },
  "IG-026": { species: ALL_FARM_SPECIES, regionalNames: ["Soya tostada", "Frijol de soya cocido"] },
  "IG-031": { species: ALL_FARM_SPECIES, regionalNames: ["Maíz germinado", "Grano brotado"] },
  "IG-032": { species: ALL_FARM_SPECIES, regionalNames: ["FVH de maíz", "Pasto hidropónico", "Forraje verde hidropónico"] },
  // Raíces clave
  "IG-035": { species: ALL_FARM_SPECIES, regionalNames: ["Yuca tratada", "Mandioca seca", "Casava picada"] },
  "IG-038": { species: ALL_FARM_SPECIES, regionalNames: ["Harina de yuca", "Casabe molido"] },
  "IG-039": { species: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"], regionalNames: ["Batata", "Camote", "Boniato", "Papa dulce"] },
  "IG-040": { species: ALL_FARM_SPECIES, regionalNames: ["Harina de camote", "Batata deshidratada"] },
  "IG-041": { species: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"], regionalNames: ["Rizoma de bore", "Chonque", "Mafafa", "Rasgadera"] },
  "IG-042": { species: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"], regionalNames: ["Hoja de bore", "Chonque", "Mafafa", "Alocasia tratada"] },
  "IG-043": { species: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"], regionalNames: ["Malanga", "Taro", "Papa china", "Otoe"] },
  "IG-044": { species: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"], regionalNames: ["Hoja de malanga", "Hoja de taro"] },
  "IG-049": { species: ALL_FARM_SPECIES, regionalNames: ["Zanahoria", "Zanahoria forrajera"] },
  "IG-052": { species: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"], regionalNames: ["Plátano verde", "Hartón", "Dominico", "Guineo verde"] },
  // Forrajes clave
  "IG-054": { species: ALL_FARM_SPECIES, regionalNames: ["Moringa", "Árbol milagro", "Marango", "Ben"] },
  "IG-055": { species: ALL_FARM_SPECIES, regionalNames: ["Harina de moringa", "Moringa seca"] },
  "IG-056": { species: ALL_FARM_SPECIES, regionalNames: ["Morera blanca", "Hoja de morera"] },
  "IG-058": { species: ALL_FARM_SPECIES, regionalNames: ["Alfalfa", "Lucerna", "Mielga", "Heno de alfalfa"] },
  "IG-062": { species: ALL_FARM_SPECIES, regionalNames: ["Botón de oro", "Falso girasol", "Mirasol", "Árnica de monte", "Tithonia"] },
  "IG-064": { species: ALL_BIRDS, regionalNames: ["Azolla", "Helecho de agua"] },
  "IG-065": { species: ALL_BIRDS, regionalNames: ["Lenteja de agua", "Lemna"] },
  "IG-067": { species: ALL_FARM_SPECIES, regionalNames: ["Leucaena", "Acacia forrajera", "Guaje"] },
  "IG-068": { species: ALL_FARM_SPECIES, regionalNames: ["Matarratón", "Madero negro", "Cacao de nance", "Gliricidia"] },
  "IG-069": { species: ALL_FARM_SPECIES, regionalNames: ["Nacedero", "Quiebrabarrigo", "Madre de agua", "Cajeto"] },
  "IG-070": { species: ALL_FARM_SPECIES, regionalNames: ["Ramio", "Ortiga blanca forrajera"] },
  "IG-071": { species: ALL_FARM_SPECIES, regionalNames: ["Pasto de corte", "Pasto elefante", "King grass", "Maralfalfa", "Kikuyo"] },
  // Hortalizas clave
  "IG-082": { species: ALL_FARM_SPECIES, regionalNames: ["Ahuyama", "Auyama", "Zapallo", "Calabaza", "Vitoria"] },
  "IG-083": { species: ALL_FARM_SPECIES, regionalNames: ["Subproducto de ahuyama", "Descarte de zapallo"] },
  "IG-084": { species: ALL_FARM_SPECIES, regionalNames: ["Calabacín", "Zucchini", "Calabacita"] },
  "IG-088": { species: ALL_FARM_SPECIES, regionalNames: ["Pimentón rojo", "Pimiento morrón", "Chiltoma"] },
  "IG-096": { species: ALL_BIRDS, regionalNames: ["Ají", "Chile picante"] },
  // Frutas clave
  "IG-098": { species: ["gallina", "gallo", "pollo", "pato"], regionalNames: ["Banano con cáscara", "Guineo", "Cambur"] },
  "IG-099": { species: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"], regionalNames: ["Pulpa de banano", "Guineo maduro", "Cambur"] },
  "IG-100": { species: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"], regionalNames: ["Papaya", "Lechosa"] },
  "IG-102": { species: ["gallina", "gallo", "pollo", "pato", "conejo", "cuy"], regionalNames: ["Guayaba", "Fuente natural Vitamina C"] },
  // Minerales
  "IG-114": { species: ["gallina", "codorniz", "pato"], regionalNames: ["Conchilla marina", "Concha de ostra molida", "Grit cálcico"] },
  "IG-115": { species: ["gallina", "gallo", "codorniz", "pato"], regionalNames: ["Carbonato de calcio", "Caliza alimentaria", "CaCO3"] },
  "IG-116": { species: ["gallina", "codorniz", "pato"], regionalNames: ["Cáscara de huevo molida", "Calcio casero pasteurizado"] },
  "IG-117": { species: ALL_BIRDS, regionalNames: ["Fosfato dicálcico", "Fosfato cálcico"] },
  "IG-118": { species: ["gallina", "codorniz"], regionalNames: ["Premezcla ponedora", "Núcleo vitamínico postura"] },
  "IG-119": { species: ALL_FARM_SPECIES, regionalNames: ["Sal yodada", "Cloruro de sodio", "Sal común"] },
};

const LEGACY_POULTRY_GENERIC_IDS = new Set(["IG-001", "IG-002", "IG-003", "IG-004", "IG-005"]);

function hasExplicitNonLayerSpeciesCue(hay: string): boolean {
  return (
    hay.includes("codorniz") ||
    hay.includes("conej") ||
    hay.includes("cuy") ||
    hay.includes("curi") ||
    hay.includes("cobayo") ||
    hay.includes("pato") ||
    hay.includes("multiespecie") ||
    (hay.includes("pollo") && !hay.includes("pollita"))
  );
}

export function inferDefaultImageByFeed(input: {
  standardCatalogId?: string | null;
  group?: string | null;
  feedType?: string | null;
  name?: string | null;
}): string {
  const stdId = input.standardCatalogId?.trim().toUpperCase();
  const normalizedName = normText(input.name || "");
  const normalizedType = normText(input.feedType || "");
  const normalizedGroup = normText(input.group || "");
  const hay = `${normalizedName} ${normalizedType}`.trim();

  if (stdId && SPECIFIC_IG_OVERRIDES[stdId]?.imageUrl) {
    if (!LEGACY_POULTRY_GENERIC_IDS.has(stdId) || !hasExplicitNonLayerSpeciesCue(hay)) {
      return SPECIFIC_IG_OVERRIDES[stdId].imageUrl!;
    }
  }

  if (normalizedGroup === "balanceados" || normalizedType.includes("concentrado") || normalizedName.includes("concentrado")) {
    if (normalizedType.includes("cuy") || normalizedName.includes("cuy") || normalizedName.includes("curi")) {
      return normalizedName.includes("conejo")
        ? "/images/alimentos/concentrado-multiespecie.svg"
        : "/images/alimentos/concentrado-cuyes.svg";
    }
    if (normalizedType.includes("multiespecie") || (normalizedName.includes("conejo") && normalizedName.includes("cuy"))) {
      return "/images/alimentos/concentrado-multiespecie.svg";
    }
    if (normalizedType.includes("conejo") || normalizedName.includes("conejo")) {
      return "/images/alimentos/concentrado-conejos.svg";
    }
    if (normalizedType.includes("codorniz") || normalizedName.includes("codorniz")) {
      return "/images/alimentos/concentrado-codorniz.svg";
    }
    if (normalizedType.includes("pato") || normalizedName.includes("pato")) {
      return "/images/alimentos/concentrado-patos.svg";
    }
    if (normalizedType.includes("pollo") || normalizedName.includes("pollo") || normalizedName.includes("engorde")) {
      return "/images/alimentos/concentrado-pollo.svg";
    }
    return "/images/alimentos/concentrado-aves.svg";
  }

  if (normalizedGroup.includes("insecto") || normalizedType.includes("mosca") || normalizedName.includes("bsf") || normalizedName.includes("lombriz") || normalizedName.includes("tenebrio")) {
    return "/images/alimentos/insectos-proteina.svg";
  }
  if (normalizedGroup.includes("raiz") || normalizedType.includes("bore") || normalizedName.includes("yuca") || normalizedName.includes("batata") || normalizedName.includes("papa") || normalizedName.includes("bore")) {
    return "/images/alimentos/raices-tuberculos.svg";
  }
  if (normalizedGroup.includes("cereal") || normalizedType.includes("maiz") || normalizedType === "purinas" || normalizedName.includes("maiz") || normalizedName.includes("soya") || normalizedName.includes("sorgo")) {
    return "/images/alimentos/cereales-semillas.svg";
  }
  if (normalizedGroup.includes("hojas") || normalizedType.includes("forraje") || normalizedType.includes("pastos") || normalizedName.includes("alfalfa") || normalizedName.includes("moringa")) {
    return "/images/alimentos/forrajes-hojas.svg";
  }
  if (normalizedGroup.includes("hortaliza") || normalizedName.includes("ahuyama") || normalizedName.includes("zapallo") || normalizedName.includes("pimenton") || normalizedName.includes("tomate")) {
    return "/images/alimentos/hortalizas-verduras.svg";
  }
  if (normalizedGroup.includes("fruta") || normalizedName.includes("banano") || normalizedName.includes("papaya") || normalizedName.includes("guayaba")) {
    return "/images/alimentos/frutas.svg";
  }
  if (normalizedGroup.includes("mineral") || normalizedName.includes("calcio") || normalizedName.includes("conchilla") || normalizedName.includes("fosfato") || normalizedName.includes("premezcla")) {
    return "/images/alimentos/minerales-aditivos.svg";
  }
  if (normalizedGroup.includes("recuperado") || normalizedName.includes("subproducto") || normalizedName.includes("descarte")) {
    return "/images/alimentos/recuperados-subproductos.svg";
  }
  return "/images/alimentos/cereales-semillas.svg";
}

export function inferDefaultSpeciesByFeed(input: {
  standardCatalogId?: string | null;
  group?: string | null;
  feedType?: string | null;
  name?: string | null;
  sanitaryStatus?: string | null;
}): FeedingSpecies[] {
  if (input.sanitaryStatus === "NO USAR") return [];
  const stdId = input.standardCatalogId?.trim().toUpperCase();
  const hay = normText(`${input.name || ""} ${input.feedType || ""}`);
  const group = normText(input.group || "");

  if (stdId && SPECIFIC_IG_OVERRIDES[stdId]?.species) {
    if (!LEGACY_POULTRY_GENERIC_IDS.has(stdId) || !hasExplicitNonLayerSpeciesCue(hay)) {
      return [...SPECIFIC_IG_OVERRIDES[stdId].species];
    }
  }

  if (hay.includes("conejo") && (hay.includes("cuy") || hay.includes("curi"))) return ["conejo", "cuy"];
  if (hay.includes("conej")) return ["conejo"];
  if (hay.includes("cuy") || hay.includes("curi") || hay.includes("cobayo")) return ["cuy"];
  if (hay.includes("codorniz")) return ["codorniz"];
  if (hay.includes("pato")) return ["pato"];
  if (hay.includes("pollo") && !hay.includes("pollita")) return ["pollo"];
  if (hay.includes("ponedora") || hay.includes("postura") || hay.includes("prepostura") || hay.includes("pre-postura")) {
    return ["gallina"];
  }
  if (hay.includes("pollita") || hay.includes("levante")) return ["gallina", "gallo"];
  if (hay.includes("reproductor")) return ["gallina", "gallo"];
  if (hay.includes("concentrado aves")) return ["gallina", "gallo", "pollo"];
  if (hay.includes("multiespecie")) return ["conejo", "cuy"];

  if (group.includes("insecto") || hay.includes("bsf") || hay.includes("mosca") || hay.includes("lombriz") || hay.includes("tenebrio")) {
    return [...ALL_BIRDS];
  }
  if (group.includes("mineral")) {
    return ["gallina", "gallo", "codorniz", "pato"];
  }
  if (group.includes("fruta")) {
    return ["gallina", "gallo", "pollo", "pato"];
  }
  if (group.includes("hojas") || group.includes("cereal") || group.includes("raiz") || group.includes("hortaliza")) {
    return [...ALL_FARM_SPECIES];
  }
  if (group.includes("recuperado")) {
    return ["gallina", "gallo", "pollo", "pato"];
  }
  return ["gallina", "pollo", "codorniz", "pato"];
}

export function resolveStandardFeedEnrichment(input: {
  id: string;
  group: string;
  name: string;
  botanicalName?: string | null;
  presentation?: string | null;
  origin?: string | null;
  sanitaryStatus?: string | null;
  preparation?: string | null;
  risks?: string | null;
  compositionNotes?: string | null;
  defaultFeedType?: string;
}): {
  targetSpecies: FeedingSpecies[];
  regionalNames: string[];
  description: string;
  imageUrl: string;
} {
  const override = SPECIFIC_IG_OVERRIDES[input.id.toUpperCase()];
  const targetSpecies = inferDefaultSpeciesByFeed({
    standardCatalogId: input.id,
    group: input.group,
    feedType: input.defaultFeedType,
    name: input.name,
    sanitaryStatus: input.sanitaryStatus,
  });
  const imageUrl = inferDefaultImageByFeed({
    standardCatalogId: input.id,
    group: input.group,
    feedType: input.defaultFeedType,
    name: input.name,
  });
  const regionalNames = override?.regionalNames ?? [];

  let description = override?.description;
  if (!description) {
    const parts: string[] = [];
    if (input.botanicalName && input.botanicalName !== "Desconocido") {
      parts.push(`Origen/especie: ${input.botanicalName}${input.presentation ? ` (${input.presentation})` : ""}.`);
    } else if (input.presentation) {
      parts.push(`Presentación habitual: ${input.presentation}.`);
    }
    if (input.preparation) parts.push(`Manejo: ${input.preparation}`);
    if (input.compositionNotes) parts.push(input.compositionNotes);
    if (!input.preparation && input.risks) parts.push(`Condición: ${input.risks}`);
    description = parts.join(" ").trim() || `Ingrediente del grupo ${input.group} (${input.origin || "uso en granja"}).`;
  }

  return {
    targetSpecies,
    regionalNames,
    description,
    imageUrl,
  };
}

/** Validates imageUrl stored in DB: preset local path, uploaded attachment, https URL, or compressed image data URI. */
export function normalizeFeedImageUrl(value: unknown): { value: string | null; error?: string } {
  if (value === undefined) return { value: null };
  if (value === null || value === "") return { value: null };
  if (typeof value !== "string") return { value: null, error: "Imagen inválida." };
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  if (trimmed.length > 360_000) {
    return { value: null, error: "La imagen excede el tamaño máximo permitido (250 KB aprox.). Comprime o elige una imagen más liviana." };
  }
  const isLocalAsset = /^\/images\/[a-zA-Z0-9_./-]+$/i.test(trimmed);
  const isAttachmentApi = /^\/api\/adjuntos(\?id=[a-f0-9-]+)?$/i.test(trimmed);
  const isHttps = /^https?:\/\/[^\s]+$/i.test(trimmed);
  const isSafeDataImage = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,[a-zA-Z0-9+/=]+$/i.test(trimmed);
  if (!isLocalAsset && !isAttachmentApi && !isHttps && !isSafeDataImage) {
    return { value: null, error: "Formato de imagen no válido. Usa una ilustración del catálogo, carga una foto o una URL https:// válida." };
  }
  return { value: trimmed };
}
