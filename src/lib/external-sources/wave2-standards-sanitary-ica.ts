import { count } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, breedWeightStandards, vaccinationTemplates } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import { ALL_BREED_STANDARD_DEFS } from "@/lib/breed-standards";
import { VACCINATION_SCHEDULES, VACCINATION_SCHEDULE_SPECIES } from "@/lib/vaccination-schedules";
import { getSettings, invalidateSettingsCache } from "@/lib/settings";
import { resolveZoneWithFallback, type ZoneCoverageScope } from "@/lib/divipola-catalog";
import {
  getNormativeCatalogWithSyncMeta,
  NORMATIVE_CATALOG,
  NORMATIVE_CATALOG_VERSION,
  type NormativeCatalogItem,
} from "@/lib/normative-catalog";
import {
  getExternalSnapshot,
  isSnapshotExpired,
  saveExternalSnapshot,
  type StoredExternalSnapshot,
} from "./snapshot-store";

export const STANDARDS_FEED_VERSION = "2026.11-ICA-NTC1240-FEDNA";

export interface FednaNutritionRef {
  species: "gallina" | "pollo" | "codorniz" | "pato" | "conejo" | "cuy";
  speciesLabel: string;
  stage: string;
  crudeProteinPct: string;
  metabolizableEnergyKcalKg: number;
  calciumPct: string;
  phosphorusPct: string;
  dailyIntakeG: string;
  source: string;
}

export const FEDNA_NRC_NUTRITION_TABLES: FednaNutritionRef[] = [
  { species: "gallina", speciesLabel: "Gallina ponedora", stage: "Cría (0–6 sem)", crudeProteinPct: "19.5%", metabolizableEnergyKcalKg: 2900, calciumPct: "1.0%", phosphorusPct: "0.45%", dailyIntakeG: "15–45 g", source: "FEDNA / Hy-Line Management" },
  { species: "gallina", speciesLabel: "Gallina ponedora", stage: "Postura Pico (18–45 sem)", crudeProteinPct: "17.5%", metabolizableEnergyKcalKg: 2780, calciumPct: "3.9%", phosphorusPct: "0.42%", dailyIntakeG: "110–118 g", source: "FEDNA / ISA Brown Guide" },
  { species: "pollo", speciesLabel: "Pollo de engorde", stage: "Pre-iniciador / Inicio (0–21 d)", crudeProteinPct: "22.0%", metabolizableEnergyKcalKg: 3000, calciumPct: "0.95%", phosphorusPct: "0.48%", dailyIntakeG: "20–105 g", source: "Aviagen Ross 308 / Cobb 500" },
  { species: "pollo", speciesLabel: "Pollo de engorde", stage: "Finalizador (22–42 d)", crudeProteinPct: "19.0%", metabolizableEnergyKcalKg: 3180, calciumPct: "0.80%", phosphorusPct: "0.40%", dailyIntakeG: "115–195 g", source: "Aviagen / NRC Poultry" },
  { species: "codorniz", speciesLabel: "Codorniz", stage: "Postura activa (6+ sem)", crudeProteinPct: "21.0%", metabolizableEnergyKcalKg: 2850, calciumPct: "3.0%", phosphorusPct: "0.45%", dailyIntakeG: "23–28 g", source: "NRC Quail / Coturnicultura" },
  { species: "pato", speciesLabel: "Pato", stage: "Levante / Engorde (3–7 sem)", crudeProteinPct: "16.5%", metabolizableEnergyKcalKg: 2950, calciumPct: "0.85%", phosphorusPct: "0.40%", dailyIntakeG: "130–210 g", source: "FAO Peking Duck Table / NRC" },
  { species: "conejo", speciesLabel: "Conejo", stage: "Ceba / Engorde (destete–75 d)", crudeProteinPct: "15.5%", metabolizableEnergyKcalKg: 2450, calciumPct: "0.85%", phosphorusPct: "0.50%", dailyIntakeG: "110–140 g + forraje", source: "FEDNA Cunicultura / NRC" },
  { species: "cuy", speciesLabel: "Cuy / Curí", stage: "Crecimiento–Engorde", crudeProteinPct: "18.0% (+ Vit. C 200mg/kg)", metabolizableEnergyKcalKg: 2700, calciumPct: "0.90%", phosphorusPct: "0.45%", dailyIntakeG: "35–45 g conc. + 180 g forraje", source: "INIA Perú / NRC Guinea Pig" },
];

export interface IcaVademecumItem {
  id: string;
  commercialName: string;
  activeIngredient: string;
  icaRegistration: string;
  laboratory: string;
  category: "antibiotico" | "antiparasitario" | "coccidicida" | "biologico";
  species: string[];
  route: string;
  withdrawalDaysMeat: number;
  withdrawalDaysEggs: number;
  contraindicatedInLayingHens: boolean;
  notes: string;
}

export const ICA_VETERINARY_VADEMECUM: IcaVademecumItem[] = [
  {
    id: "ica-enro-10",
    commercialName: "Enrofloxacina 10% Oral (Enrovet / Baytril)",
    activeIngredient: "Enrofloxacina 100 mg/mL",
    icaRegistration: "Reg. ICA 5120-MV",
    laboratory: "Vecol / Bayer",
    category: "antibiotico",
    species: ["pollo", "pato", "codorniz", "conejo"],
    route: "agua_bebida",
    withdrawalDaysMeat: 7,
    withdrawalDaysEggs: 10,
    contraindicatedInLayingHens: true,
    notes: "No usar en aves ponedoras cuyos huevos se destinen a consumo humano.",
  },
  {
    id: "ica-tylosina-20",
    commercialName: "Tylosina Tartrato Soluble 20%",
    activeIngredient: "Tilosina Tartrato",
    icaRegistration: "Reg. ICA 4398-MV",
    laboratory: "Elanco / Genfar",
    category: "antibiotico",
    species: ["gallina", "pollo", "codorniz", "pato"],
    route: "agua_bebida",
    withdrawalDaysMeat: 5,
    withdrawalDaysEggs: 0,
    contraindicatedInLayingHens: false,
    notes: "Indicado para ERC / Mycoplasma. Respetar retiro en carne de 5 días.",
  },
  {
    id: "ica-oxi-la",
    commercialName: "Oxitetraciclina LA 200 mg/mL",
    activeIngredient: "Oxitetraciclina clorhidrato",
    icaRegistration: "Reg. ICA 3891-MV",
    laboratory: "Zoetis / Carval",
    category: "antibiotico",
    species: ["pollo", "gallina", "conejo", "cuy", "pato"],
    route: "intramuscular",
    withdrawalDaysMeat: 21,
    withdrawalDaysEggs: 14,
    contraindicatedInLayingHens: true,
    notes: "Tiempo de retiro prolongado en tejido y huevo según Res. ICA 3651.",
  },
  {
    id: "ica-sulfaclozina",
    commercialName: "Sulfaclozina Sódica 30% (ESB3)",
    activeIngredient: "Sulfaclozina sódica monohidrato",
    icaRegistration: "Reg. ICA 2945-MV",
    laboratory: "Elanco",
    category: "coccidicida",
    species: ["gallina", "pollo", "codorniz", "conejo"],
    route: "agua_bebida",
    withdrawalDaysMeat: 14,
    withdrawalDaysEggs: 14,
    contraindicatedInLayingHens: true,
    notes: "Coccidicida curativo. Bloquea comercialización de huevo y carne durante 14 días.",
  },
  {
    id: "ica-toltrazuril",
    commercialName: "Toltrazuril 2.5% Aves (Baycox)",
    activeIngredient: "Toltrazuril 25 mg/mL",
    icaRegistration: "Reg. ICA 4712-MV",
    laboratory: "Elanco / Bayer",
    category: "coccidicida",
    species: ["pollo", "gallina", "codorniz", "pato", "conejo"],
    route: "agua_bebida",
    withdrawalDaysMeat: 16,
    withdrawalDaysEggs: 18,
    contraindicatedInLayingHens: true,
    notes: "Control de Eimeria spp. en levante y engorde.",
  },
  {
    id: "ica-ivermectina-1",
    commercialName: "Ivermectina 1% Inyectable / Oral",
    activeIngredient: "Ivermectina 10 mg/mL",
    icaRegistration: "Reg. ICA 3110-MV",
    laboratory: "Vecol / Boehringer",
    category: "antiparasitario",
    species: ["conejo", "cuy", "gallina"],
    route: "subcutanea",
    withdrawalDaysMeat: 28,
    withdrawalDaysEggs: 14,
    contraindicatedInLayingHens: true,
    notes: "Sarna psoróptica / ácaros en conejo y cuy. Retiro estricto de 28 días.",
  },
  {
    id: "ica-fenbendazol",
    commercialName: "Fenbendazol 10% Suspensión Oral",
    activeIngredient: "Fenbendazol",
    icaRegistration: "Reg. ICA 5640-MV",
    laboratory: "MSD / Virbac",
    category: "antiparasitario",
    species: ["gallina", "pollo", "pato", "conejo", "cuy"],
    route: "agua_bebida",
    withdrawalDaysMeat: 6,
    withdrawalDaysEggs: 0,
    contraindicatedInLayingHens: false,
    notes: "Antihelmíntico de amplio espectro compatible con ponedoras comerciales (0 días en huevo en formulación autorizada).",
  },
  {
    id: "ica-levamisol",
    commercialName: "Levamisol 15% Soluble",
    activeIngredient: "Clorhidrato de Levamisol",
    icaRegistration: "Reg. ICA 4108-MV",
    laboratory: "Carval",
    category: "antiparasitario",
    species: ["gallina", "pollo", "pato"],
    route: "agua_bebida",
    withdrawalDaysMeat: 7,
    withdrawalDaysEggs: 7,
    contraindicatedInLayingHens: false,
    notes: "Nematodos gastrointestinales y traqueales.",
  },
  {
    id: "ica-florfenicol",
    commercialName: "Florfenicol 20% Solución Oral",
    activeIngredient: "Florfenicol 200 mg/mL",
    icaRegistration: "Reg. ICA 7450-MV",
    laboratory: "Vicar / Virbac",
    category: "antibiotico",
    species: ["pollo", "pato"],
    route: "agua_bebida",
    withdrawalDaysMeat: 5,
    withdrawalDaysEggs: 14,
    contraindicatedInLayingHens: true,
    notes: "Infecciones respiratorias y colibacilosis en engorde.",
  },
  {
    id: "ica-amoxicilina",
    commercialName: "Amoxicilina 50% Polvo Soluble",
    activeIngredient: "Amoxicilina trihidrato",
    icaRegistration: "Reg. ICA 6814-MV",
    laboratory: "Zoetis / Livisto",
    category: "antibiotico",
    species: ["pollo", "gallina", "pato", "codorniz"],
    route: "agua_bebida",
    withdrawalDaysMeat: 3,
    withdrawalDaysEggs: 3,
    contraindicatedInLayingHens: false,
    notes: "Enteritis necrótica y colibacilosis; 3 días de retiro.",
  },
  {
    id: "ica-doxiciclina",
    commercialName: "Doxiciclina 20% Hiclato Oral",
    activeIngredient: "Doxiciclina hiclato",
    icaRegistration: "Reg. ICA 8190-MV",
    laboratory: "Ceva / Calier",
    category: "antibiotico",
    species: ["pollo", "pato"],
    route: "agua_bebida",
    withdrawalDaysMeat: 7,
    withdrawalDaysEggs: 14,
    contraindicatedInLayingHens: true,
    notes: "Complejo respiratorio crónico en pollos de engorde.",
  },
  {
    id: "ica-fluralaner",
    commercialName: "Fluralaner 10 mg/mL (Exzolt)",
    activeIngredient: "Fluralaner",
    icaRegistration: "Reg. ICA 10244-MV",
    laboratory: "MSD Animal Health",
    category: "antiparasitario",
    species: ["gallina", "pollo", "codorniz"],
    route: "agua_bebida",
    withdrawalDaysMeat: 14,
    withdrawalDaysEggs: 0,
    contraindicatedInLayingHens: false,
    notes: "Control de ácaro rojo Dermanyssus gallinae; 0 días retiro en huevo.",
  },
  {
    id: "ica-vac-newcastle",
    commercialName: "Vacuna Newcastle Cepa LaSota / B1",
    activeIngredient: "Virus vivo Newcastle cepa LaSota/B1",
    icaRegistration: "Reg. ICA 1840-DB",
    laboratory: "Vecol / Ceva / MSD",
    category: "biologico",
    species: ["gallina", "pollo", "codorniz"],
    route: "ocular_nasal",
    withdrawalDaysMeat: 0,
    withdrawalDaysEggs: 0,
    contraindicatedInLayingHens: false,
    notes: "Vacuna obligatoria en plan sanitario ICA Res. 3651/3652. Mantener cadena de frío 2–8°C.",
  },
  {
    id: "ica-vac-gumboro",
    commercialName: "Vacuna Gumboro (IBD) Intermedia",
    activeIngredient: "Virus vivo Bursitis Infecciosa",
    icaRegistration: "Reg. ICA 2491-DB",
    laboratory: "Boehringer / MSD",
    category: "biologico",
    species: ["gallina", "pollo"],
    route: "agua_bebida",
    withdrawalDaysMeat: 0,
    withdrawalDaysEggs: 0,
    contraindicatedInLayingHens: false,
    notes: "Aplicación días 10–14 y refuerzo según desafío de granja.",
  },
  {
    id: "ica-vac-bronquitis",
    commercialName: "Vacuna Bronquitis Infecciosa H120 + Massachusetts",
    activeIngredient: "Coronavirus aviar cepa Mass/H120",
    icaRegistration: "Reg. ICA 2150-DB",
    laboratory: "Zoetis / Ceva",
    category: "biologico",
    species: ["gallina", "pollo", "codorniz"],
    route: "aspersor",
    withdrawalDaysMeat: 0,
    withdrawalDaysEggs: 0,
    contraindicatedInLayingHens: false,
    notes: "Refrigeración estricta 2–8°C.",
  },
  {
    id: "ica-vac-viruela",
    commercialName: "Vacuna Viruela Aviar Punción Alar",
    activeIngredient: "Virus vivo viruela aviar",
    icaRegistration: "Reg. ICA 1995-DB",
    laboratory: "Vecol",
    category: "biologico",
    species: ["gallina", "codorniz"],
    route: "punzon_alar",
    withdrawalDaysMeat: 0,
    withdrawalDaysEggs: 0,
    contraindicatedInLayingHens: false,
    notes: "Verificar formación de nódulo alar a los 7 días post-vacunación.",
  },
  {
    id: "ica-vac-clostridio-pasteurella",
    commercialName: "Bacterina Polivalente Pasteurella + Clostridium",
    activeIngredient: "Bacterina inactivada multiespecie",
    icaRegistration: "Reg. ICA 3304-DB",
    laboratory: "Vecol",
    category: "biologico",
    species: ["conejo", "cuy", "pato"],
    route: "subcutanea",
    withdrawalDaysMeat: 0,
    withdrawalDaysEggs: 0,
    contraindicatedInLayingHens: false,
    notes: "Prevención respiratoria/entérica en conejos, cuyes y patos.",
  },
];

export interface EpidemiologicalAlertItem {
  id: string;
  department: string;
  disease: string;
  speciesAffected: string[];
  riskLevel: "alto" | "medio" | "vigilancia";
  authority: string;
  resolutionRef: string;
  recommendation: string;
  active: boolean;
}

export const REGIONAL_EPIDEMIOLOGICAL_BULLETIN: EpidemiologicalAlertItem[] = [
  {
    id: "epi-newcastle-zona-centro",
    department: "Cundinamarca",
    disease: "Enfermedad de Newcastle / Vigilancia activa corredor central",
    speciesAffected: ["gallina", "pollo", "codorniz"],
    riskLevel: "medio",
    authority: "ICA Dirección Técnica de Vigilancia Epidemiológica",
    resolutionRef: "Res. ICA 3651/2014 y vigilancia semanal",
    recommendation: "Reforzar esquema vacunal Newcastle al día, exigir GSMI para todo ingreso de aves y desinfección estricta de vehículos en arco sanitario.",
    active: true,
  },
  {
    id: "epi-influenza-aves-migratorias",
    department: "Antioquia",
    disease: "Vigilancia Influenza Aviar de Alta Patogenicidad (H5N1)",
    speciesAffected: ["gallina", "pollo", "pato", "codorniz"],
    riskLevel: "alto",
    authority: "ICA + OMSA / WAHIS",
    resolutionRef: "Alerta sanitaria preventiva humedales y rutas migratorias",
    recommendation: "Aislar cuerpos de agua de aves silvestres, reforzar malla antipájaro en galpones de patos y notificar mortalidad súbita > 2% en 24h al ICA.",
    active: true,
  },
  {
    id: "epi-salmonella-santander",
    department: "Santander",
    disease: "Programa Nacional de Control de Salmonella aviar",
    speciesAffected: ["gallina", "pollo"],
    riskLevel: "vigilancia",
    authority: "ICA / FENAVI",
    resolutionRef: "POE GAB - Limpieza, desinfección y vacío sanitario >= 21 días",
    recommendation: "Cumplir protocolo de lavado, desinfección y vacío sanitario antes de cada nuevo encasetamiento.",
    active: true,
  },
  {
    id: "epi-ehc-conejos-andina",
    department: "Boyacá",
    disease: "Prevención Enfermedad Hemorrágica del Conejo y Pasteurelosis",
    speciesAffected: ["conejo", "cuy"],
    riskLevel: "medio",
    authority: "ICA Sanidad Animal / OMSA",
    resolutionRef: "Cuarentena de reproductores >= 21 días",
    recommendation: "Evitar ingreso de conejos o forraje de predios sin historial sanitario verificado; aislar jaulas nuevas por 3 semanas.",
    active: true,
  },
  {
    id: "epi-salmonelosis-cuy-narino",
    department: "Nariño",
    disease: "Control de Salmonelosis y estrés térmico nocturno en cuyes",
    speciesAffected: ["cuy", "conejo"],
    riskLevel: "medio",
    authority: "ICA Nariño / AGROSAVIA",
    resolutionRef: "Bioseguridad en galpones cuyícolas",
    recommendation: "Orear el forraje verde antes de suministrarlo, desinfectar pozas entre camadas y proteger crías contra corrientes frías.",
    active: true,
  },
  {
    id: "epi-nacional-bioseguridad",
    department: "Nacional",
    disease: "Vigilancia preventiva Influenza Aviar y Bienestar Animal",
    speciesAffected: ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"],
    riskLevel: "vigilancia",
    authority: "ICA / MADR / OMSA",
    resolutionRef: "Res. ICA 3651/3652 + Res. 16409/2024 + Res. 8452/2025",
    recommendation: "Mantener bitácora POE GAB al día, registro de visitantes, control de plagas y bloqueo automático por tiempo de retiro farmacológico.",
    active: true,
  },
];

function normalizeKey(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function findIcaDrugByProduct(productName: string | null | undefined, species?: string | null): IcaVademecumItem | null {
  const clean = normalizeKey(productName);
  if (!clean || clean.length < 3) return null;
  const sp = normalizeKey(species);

  const candidates = ICA_VETERINARY_VADEMECUM.filter((item) => {
    const hay = [
      normalizeKey(item.commercialName),
      normalizeKey(item.activeIngredient),
      normalizeKey(item.icaRegistration),
    ].join(" ");

    const tokenMatched =
      hay.includes(clean) ||
      clean.includes(normalizeKey(item.activeIngredient.split(" ")[0])) ||
      normalizeKey(item.commercialName)
        .split(/[\s/()-]+/)
        .some((tok) => tok.length >= 5 && clean.includes(tok));

    if (!tokenMatched) return false;
    if (sp && item.species.length > 0 && !item.species.includes(sp)) {
      return true; // Sigue aplicando tiempo de retiro oficial aunque no esté optimizado para la especie.
    }
    return true;
  });

  return candidates[0] || null;
}

export function getEpidemiologicalAlertsForDepartment(department: string | null | undefined): EpidemiologicalAlertItem[] {
  const cleanDept = normalizeKey(department);
    const filtered = REGIONAL_EPIDEMIOLOGICAL_BULLETIN.filter((item) => {
      if (!item.active) return false;
      if (item.department === "Nacional") return true;
      if (!cleanDept || cleanDept === "promedio nacional") return true;
      const itemDept = normalizeKey(item.department);
      return cleanDept.includes(itemDept) || itemDept.includes(cleanDept);
    });

    // Priorizar alertas específicas del departamento antes que las nacionales generales
    return filtered.sort((a, b) => {
      const aDirect = cleanDept && normalizeKey(a.department).includes(cleanDept) ? 0 : a.department === "Nacional" ? 2 : 1;
      const bDirect = cleanDept && normalizeKey(b.department).includes(cleanDept) ? 0 : b.department === "Nacional" ? 2 : 1;
      return aDirect - bDirect;
    });
  }

export interface StandardsFeedSnapshotPayload extends Record<string, unknown> {
    feedVersion: string;
    installedVersion: string;
    geneticsCurvesInFeed: number;
    geneticsCurvesInDb: number;
    weightPointsInDb: number;
    vaccineTemplatesInFeed: number;
    vaccineTemplatesInDb: number;
    nutritionTablesCount: number;
    normativeStandards: string[];
    normativeCatalogVersion: string;
    normativeCatalogCount: number;
    normativeLastCheckedAt: null;
    normativeCatalog: NormativeCatalogItem[];
    nutritionTables: FednaNutritionRef[];
    upToDate: boolean;
  }

  export async function syncStandardsNormativeSnapshot(
    options?: { forceRefresh?: boolean },
  ): Promise<StoredExternalSnapshot<StandardsFeedSnapshotPayload>> {
    const [existing, settings, weightCountRow, vaccineCountRow, distinctBreedRows] = await Promise.all([
      getExternalSnapshot<StandardsFeedSnapshotPayload>("standards_normative_feed"),
      getSettings(),
      db.select({ n: count() }).from(breedWeightStandards),
      db.select({ n: count() }).from(vaccinationTemplates),
      db.select({ breed: breedWeightStandards.breed, species: breedWeightStandards.species }).from(breedWeightStandards),
    ]);

    const hasCurrentCatalog =
      existing?.payload?.normativeCatalogVersion === NORMATIVE_CATALOG_VERSION &&
      Array.isArray(existing?.payload?.normativeCatalog) &&
      existing.payload.normativeCatalog.length === NORMATIVE_CATALOG.length;

    if (
      !options?.forceRefresh &&
      existing &&
      !isSnapshotExpired(existing) &&
      hasCurrentCatalog &&
      existing.providerName.startsWith("Catálogo interno versionado")
    ) {
      return existing;
    }

    let installedVersion = STANDARDS_FEED_VERSION;
    try {
      const rawPack = settings["normative.pack_version"];
      if (rawPack) {
        const parsed = JSON.parse(rawPack) as { version?: string };
        if (parsed.version) installedVersion = parsed.version;
      }
    } catch {
      // Usar versión por defecto
    }

    const totalFeedVaccines = Object.values(VACCINATION_SCHEDULES).reduce((sum, list) => sum + list.length, 0);
    const totalFeedWeightPoints = ALL_BREED_STANDARD_DEFS.reduce((sum, def) => sum + def.points.length, 0);
    const weightPointsInDb = Number(weightCountRow[0]?.n || 0);
    const vaccineTemplatesInDb = Number(vaccineCountRow[0]?.n || 0);
    const geneticsCurvesInDb = new Set(distinctBreedRows.map((r) => `${r.species || "ave"}::${r.breed}`)).size;

    const upToDate = weightPointsInDb >= totalFeedWeightPoints && vaccineTemplatesInDb >= totalFeedVaccines;
    const normativeMeta = getNormativeCatalogWithSyncMeta();

    const payload: StandardsFeedSnapshotPayload = {
      feedVersion: STANDARDS_FEED_VERSION,
      installedVersion,
      geneticsCurvesInFeed: new Set(ALL_BREED_STANDARD_DEFS.map((d) => `${d.species}::${d.breed}`)).size,
      geneticsCurvesInDb,
      weightPointsInDb,
      vaccineTemplatesInFeed: totalFeedVaccines,
      vaccineTemplatesInDb,
      nutritionTablesCount: FEDNA_NRC_NUTRITION_TABLES.length,
      normativeStandards: NORMATIVE_CATALOG.map((item) => `${item.code} (${item.title})`),
      normativeCatalogVersion: normativeMeta.version,
      normativeCatalogCount: normativeMeta.totalItems,
      normativeLastCheckedAt: null,
      normativeCatalog: normativeMeta.items,
      nutritionTables: FEDNA_NRC_NUTRITION_TABLES,
      upToDate,
    };

    return saveExternalSnapshot({
      sourceKey: "standards_normative_feed",
      wave: 2,
      status: "fallback",
      providerName: "Catálogo interno versionado; consulta normativa externa pendiente",
      sourceUrl: "https://www.ica.gov.co/normatividad",
      payload,
      summary: `Catálogo local ${normativeMeta.version}: ${normativeMeta.totalItems} referencias, ${geneticsCurvesInDb} curvas genéticas (${weightPointsInDb} pts), ${vaccineTemplatesInDb} esquemas vacunales y ${FEDNA_NRC_NUTRITION_TABLES.length} tablas nutricionales. No se valida automáticamente contra ICA/NTC/FEDNA/NRC.`,
      ttlHours: 24 * 7,
    });
  }

  export async function applyStandardsNormativeFeedToDb() {
    const farmId = getCurrentFarmId();

    const [existingWeights, existingVaccines] = await Promise.all([
      db.select({ breed: breedWeightStandards.breed, gender: breedWeightStandards.gender, weekNumber: breedWeightStandards.weekNumber }).from(breedWeightStandards),
      db.select({ species: vaccinationTemplates.species, breed: vaccinationTemplates.breed, weekNumber: vaccinationTemplates.weekNumber, name: vaccinationTemplates.name }).from(vaccinationTemplates),
    ]);

    const weightKeys = new Set(existingWeights.map((w) => `${w.breed}|${w.gender}|${w.weekNumber}`));
    const flattenedWeights = ALL_BREED_STANDARD_DEFS.flatMap((def) =>
      def.points.map((pt) => ({
        species: def.species,
        breed: def.breed,
        gender: def.gender,
        weekNumber: pt.week,
        targetWeightG: String(pt.targetG),
        minWeightG: pt.minG != null ? String(pt.minG) : null,
        maxWeightG: pt.maxG != null ? String(pt.maxG) : null,
      })),
    );
    const missingWeights = flattenedWeights.filter(
      (s) => !weightKeys.has(`${s.breed}|${s.gender}|${s.weekNumber}`),
    );
    if (missingWeights.length > 0) {
      await db
        .insert(breedWeightStandards)
        .values(missingWeights)
        .onConflictDoNothing();
    }

    const vaccineKeys = new Set(existingVaccines.map((v) => `${v.species}|${v.breed}|${v.weekNumber}|${v.name}`));
    const missingVaccines: Array<{
      species: string;
      breed: string;
      weekNumber: number;
      name: string;
      description: string;
      type: string;
      frequencyDays: number | null;
    }> = [];
    for (const [breedName, events] of Object.entries(VACCINATION_SCHEDULES)) {
      const sp = VACCINATION_SCHEDULE_SPECIES[breedName] || "gallina";
      for (const item of events) {
        const k = `${sp}|${breedName}|${item.weekNumber}|${item.name}`;
        if (!vaccineKeys.has(k)) {
          missingVaccines.push({
            species: sp,
            breed: breedName,
            weekNumber: item.weekNumber,
            name: item.name,
            description: item.description,
            type: item.type,
            frequencyDays: item.frequencyDays,
          });
        }
      }
    }
    if (missingVaccines.length > 0) {
      await db.insert(vaccinationTemplates).values(missingVaccines).onConflictDoNothing();
    }

    const normativePayload = JSON.stringify({
      version: STANDARDS_FEED_VERSION,
      updatedAt: new Date().toISOString(),
      standards: [
        "NTC 1240",
        "ICA Res. 3650-3652/2014",
        "MADR Res. 205/2022",
        "ICA Res. 16409/2024",
        "ICA Res. 8452/2025",
        "ICA Res. 30292/2017",
      ],
    });

    await db
      .insert(appSettings)
      .values({
        farmId,
        key: "normative.pack_version",
        value: normativePayload,
      })
      .onConflictDoUpdate({
        target: [appSettings.farmId, appSettings.key],
        set: { value: normativePayload, updatedAt: new Date() },
      });
    invalidateSettingsCache();

    const snapshot = await syncStandardsNormativeSnapshot({ forceRefresh: true });
    return {
      addedWeightPoints: missingWeights.length,
      addedVaccineTemplates: missingVaccines.length,
      snapshot,
    };
  }

  export interface IcaVademecumSnapshotPayload extends Record<string, unknown> {
    department: string;
    coverageScope: ZoneCoverageScope;
    coverageLabel: string;
    periodLabel: string;
    vademecumCount: number;
    activeAlertsCount: number;
    alerts: EpidemiologicalAlertItem[];
    lastAuthorityCheck: string;
  }

  export async function syncIcaVademecumAndAlertsSnapshot(
    options?: { forceRefresh?: boolean },
  ): Promise<StoredExternalSnapshot<IcaVademecumSnapshotPayload>> {
    const [settings, existing] = await Promise.all([
      getSettings(),
      getExternalSnapshot<IcaVademecumSnapshotPayload>("ica_vademecum_alerts"),
    ]);

      const zone = resolveZoneWithFallback({
        daneCode: settings["farm.dane_municipality_code"],
        city: settings["farm.city"],
        department: settings["farm.department"],
        country: settings["farm.country"],
      });
      const department = zone.matchedDepartment || settings["farm.department"] || "Promedio Nacional";

      if (
        !options?.forceRefresh &&
        existing &&
        !isSnapshotExpired(existing) &&
        existing.providerName.startsWith("Referencias locales ICA") &&
        normalizeKey(existing.payload.department) === normalizeKey(department)
      ) {
        return existing;
      }

      const alerts = getEpidemiologicalAlertsForDepartment(department);
      const hasDirectDeptAlert = alerts.some(
        (a) => a.department !== "Nacional" && normalizeKey(a.department).includes(normalizeKey(department)),
      );
      const coverageScope: ZoneCoverageScope =
        zone.coverageScope === "nacional"
          ? "nacional"
          : hasDirectDeptAlert
            ? zone.coverageScope
            : "nacional";
      const coverageLabel =
        coverageScope === "nacional"
          ? `Vigilancia nacional Colombia (${zone.periodLabel})`
          : hasDirectDeptAlert
            ? `${zone.coverageLabel}`
            : `Promedio nacional Colombia (${zone.periodLabel})`;

      const status: "fallback" = "fallback";
      const lastError = "La consulta automática del vademécum y los boletines ICA aún no está conectada; se muestran referencias locales que requieren revisión antes de decisiones sanitarias.";

      const payload: IcaVademecumSnapshotPayload = {
        department,
        coverageScope,
        coverageLabel,
        periodLabel: zone.periodLabel,
        vademecumCount: ICA_VETERINARY_VADEMECUM.length,
        activeAlertsCount: alerts.length,
        alerts,
        lastAuthorityCheck: "Sin conexión automática",
      };

      return saveExternalSnapshot({
        sourceKey: "ica_vademecum_alerts",
        wave: 2,
        status,
        providerName: "Referencias locales ICA; conexión automática pendiente",
        sourceUrl: "https://www.ica.gov.co/areas/pecuaria/servicios/epidemiologia-veterinaria",
        payload,
        summary: `${ICA_VETERINARY_VADEMECUM.length} referencias de productos · ${alerts.length} alertas de catálogo local (${coverageLabel}); sin verificación automática ICA.`,
        ttlHours: 24,
        lastError,
      });
    }
