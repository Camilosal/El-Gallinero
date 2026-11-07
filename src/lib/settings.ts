import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Parámetros globales de cálculo, editables desde Catálogos y Datos Maestros.
 * Cada definición declara su valor por defecto y sus límites de validación.
 * Los valores guardados en app_settings sobrescriben el default.
 */

export type SettingType = "number" | "integer" | "boolean" | "string";

export interface SettingDef {
  key: string;
  label: string;
  description: string;
  group: string;
  type: SettingType;
  default: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const SETTING_DEFS: SettingDef[] = [
  {
    key: "lifecycle.fin_postura_weeks",
    label: "Fin de postura (semanas)",
    description: "Edad a partir de la cual una gallina se recomienda para sacrificio por haber terminado su ciclo de postura.",
    group: "Ciclo de vida",
    type: "integer",
    default: "80",
    unit: "semanas",
    min: 1,
    max: 300,
    step: 1,
  },
  {
    key: "lifecycle.peso_venta_kg",
    label: "Peso de venta (kg)",
    description: "Peso vivo a partir del cual un ave se considera apta para venta o sacrificio.",
    group: "Ciclo de vida",
    type: "number",
    default: "2.5",
    unit: "kg",
    min: 0.01,
    max: 100,
    step: 0.01,
  },
  {
    key: "flock.hens_per_rooster",
    label: "Gallinas por gallo",
    description: "Número de gallinas que cubre cada gallo reproductor. Se usa para calcular el déficit de gallos.",
    group: "Parvada",
    type: "integer",
    default: "10",
    unit: "gallinas/gallo",
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: "flock.default_target_weeks",
    label: "Edad objetivo de lote (semanas)",
    description: "Edad objetivo por defecto al crear un lote de engorde, si no se especifica otra.",
    group: "Parvada",
    type: "integer",
    default: "7",
    unit: "semanas",
    min: 1,
    max: 200,
    step: 1,
  },
  {
    key: "flock.default_target_weight_kg",
    label: "Peso objetivo de lote (kg)",
    description: "Peso promedio objetivo por defecto al crear un lote de engorde.",
    group: "Parvada",
    type: "number",
    default: "2.5",
    unit: "kg",
    min: 0.01,
    max: 200,
    step: 0.01,
  },
  {
    key: "inventory.bird_price_per_kg",
    label: "Precio de ave viva ($/kg)",
    description: "Precio de referencia para valorar animales vivos cuando la especie no tiene precio propio en Parámetros por especie.",
    group: "Inventario y valoración",
    type: "number",
    default: "10000",
    unit: "COP/kg",
    min: 0,
    step: 100,
  },
  {
    key: "inventory.manure_price_per_kg",
    label: "Precio de gallinaza ($/kg)",
    description: "Precio de referencia para valorar el inventario de gallinaza.",
    group: "Inventario y valoración",
    type: "number",
    default: "300",
    unit: "COP/kg",
    min: 0,
    step: 10,
  },
  {
    key: "eggs.validation_threshold",
    label: "Tolerancia de producción de huevos",
    description: "Factor sobre la producción esperada que se acepta al registrar huevos. Ej.: 1.5 permite hasta 150% de lo esperado.",
    group: "Producción y validaciones",
    type: "number",
    default: "1.5",
    unit: "factor",
    min: 1,
    max: 10,
    step: 0.1,
  },
  {
    key: "incubation.days",
    label: "Días de incubación",
    description: "Días que tarda la eclosión para calcular la fecha esperada de nacimiento.",
    group: "Producción y validaciones",
    type: "integer",
    default: "21",
    unit: "días",
    min: 1,
    max: 60,
    step: 1,
  },
];

export const DEFAULT_SETTINGS: Record<string, string> = Object.fromEntries(
  SETTING_DEFS.map((def) => [def.key, def.default]),
);

const CACHE_TTL_MS = 30_000;

let cache: { values: Record<string, string>; loadedAt: number } | null = null;

function coerceValue(def: SettingDef, raw: unknown): string {
  const text = raw === null || raw === undefined ? "" : String(raw).trim();
  if (def.type === "string") {
    if (!text) throw new Error(`El parámetro "${def.label}" no puede estar vacío`);
    return text;
  }
  if (def.type === "boolean") {
    if (text === "true" || text === "false") return text;
    throw new Error(`El parámetro "${def.label}" debe ser true o false`);
  }
  const num = Number(text);
  if (!Number.isFinite(num)) throw new Error(`El parámetro "${def.label}" debe ser numérico`);
  if (def.type === "integer" && !Number.isInteger(num)) {
    throw new Error(`El parámetro "${def.label}" debe ser un número entero`);
  }
  if (def.min !== undefined && num < def.min) {
    throw new Error(`El parámetro "${def.label}" debe ser mayor o igual a ${def.min}`);
  }
  if (def.max !== undefined && num > def.max) {
    throw new Error(`El parámetro "${def.label}" debe ser menor o igual a ${def.max}`);
  }
  return String(num);
}

/** Valores efectivos: defaults + overrides de la base de datos. */
export async function getSettings(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.values;
  }

  const values = { ...DEFAULT_SETTINGS };
  try {
    const rows = await db.select().from(appSettings);
    for (const row of rows) {
      if (row.key in values) values[row.key] = row.value;
    }
  } catch {
    // Si la tabla aún no existe (primer despliegue), se usan los defaults.
  }

  cache = { values, loadedAt: Date.now() };
  return values;
}

export async function getSetting(key: string): Promise<string> {
  const values = await getSettings();
  return values[key] ?? DEFAULT_SETTINGS[key] ?? "";
}

export async function getNumberSetting(key: string): Promise<number> {
  const raw = await getSetting(key);
  const num = Number(raw);
  return Number.isFinite(num) ? num : Number(DEFAULT_SETTINGS[key] ?? 0);
}

export async function getBooleanSetting(key: string): Promise<boolean> {
  return (await getSetting(key)) === "true";
}

export function invalidateSettingsCache(): void {
  cache = null;
}

/** Lista para la UI: definición + valor efectivo. */
export async function getSettingsForApi() {
  const values = await getSettings();
  return SETTING_DEFS.map((def) => ({
    ...def,
    value: values[def.key] ?? def.default,
  }));
}

/** Actualiza uno o varios parámetros validando tipo y límites. */
export async function updateSettings(
  updates: { key: string; value: unknown }[],
  userId?: string | null,
): Promise<Record<string, string>> {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("No se enviaron parámetros para actualizar");
  }

  const defsByKey = new Map(SETTING_DEFS.map((def) => [def.key, def]));
  const normalized: { key: string; value: string }[] = [];

  for (const update of updates) {
    const def = defsByKey.get(update.key);
    if (!def) throw new Error(`Parámetro desconocido: ${update.key}`);
    normalized.push({ key: def.key, value: coerceValue(def, update.value) });
  }

  for (const item of normalized) {
    await db
      .insert(appSettings)
      .values({ key: item.key, value: item.value, updatedBy: userId ?? null })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: item.value,
          updatedBy: userId ?? null,
          updatedAt: new Date(),
        },
      });
  }

  invalidateSettingsCache();
  return getSettings();
}

export async function getLifecycleRules() {
  return {
    finPosturaWeeks: await getNumberSetting("lifecycle.fin_postura_weeks"),
    pesoVentaKg: await getNumberSetting("lifecycle.peso_venta_kg"),
  };
}

export async function getFlockRules() {
  return {
    hensPerRooster: await getNumberSetting("flock.hens_per_rooster"),
    defaultTargetWeeks: await getNumberSetting("flock.default_target_weeks"),
    defaultTargetWeightKg: await getNumberSetting("flock.default_target_weight_kg"),
  };
}

export async function getInventoryPrices() {
  return {
    birdPricePerKg: await getNumberSetting("inventory.bird_price_per_kg"),
    manurePricePerKg: await getNumberSetting("inventory.manure_price_per_kg"),
  };
}

export async function getEggValidationThreshold(): Promise<number> {
  return getNumberSetting("eggs.validation_threshold");
}

export async function getIncubationDays(): Promise<number> {
  return getNumberSetting("incubation.days");
}

/** Helper para pruebas: permite inyectar valores sin tocar la DB. */
export function __setSettingsCacheForTests(values: Record<string, string> | null): void {
  cache = values ? { values: { ...DEFAULT_SETTINGS, ...values }, loadedAt: Date.now() } : null;
}
