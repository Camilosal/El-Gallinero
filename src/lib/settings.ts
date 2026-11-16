import { db } from "@/db";
import { getCurrentFarmId } from "@/db/tenant-context";
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
  optional?: boolean;
  inputType?: "text" | "date" | "email" | "tel";
  multiline?: boolean;
  setupRequired?: boolean;
  hidden?: boolean;
}

export const SETTING_DEFS: SettingDef[] = [
  {
    key: "farm.name",
    label: "Nombre de la granja",
    description: "Nombre con el que identificas tu granja o unidad productiva. Completa este dato para cerrar la configuración inicial.",
    group: "Datos generales de la granja",
    type: "string",
    default: "",
    optional: true,
    setupRequired: true,
  },
  {
    key: "farm.production_focus",
    label: "Actividad principal",
    description: "Ej.: producción de huevos, carne, doble propósito o crianza de pequeños animales.",
    group: "Datos generales de la granja",
    type: "string",
    default: "",
    optional: true,
  },
  {
    key: "farm.description",
    label: "Descripción general",
    description: "Describe brevemente el sistema productivo, sus objetivos y características importantes.",
    group: "Datos generales de la granja",
    type: "string",
    default: "",
    optional: true,
    multiline: true,
  },
  {
    key: "farm.country",
    label: "País",
    description: "País donde se ubica la granja.",
    group: "Ubicación general",
    type: "string",
    default: "",
    optional: true,
  },
  {
    key: "farm.department",
    label: "Departamento / provincia",
    description: "División territorial donde está ubicada.",
    group: "Ubicación general",
    type: "string",
    default: "",
    optional: true,
  },
  {
    key: "farm.city",
    label: "Ciudad o municipio",
    description: "Municipio donde se ubica la granja. Completa este dato para cerrar la configuración inicial.",
    group: "Ubicación general",
    type: "string",
    default: "",
    optional: true,
    setupRequired: true,
  },
  {
    key: "farm.altitude_meters",
    label: "Altitud del predio (msnm)",
    description: "Metros sobre el nivel del mar de la finca para ajustar curvas térmicas y densidad fisiológica.",
    group: "Ubicación general",
    type: "integer",
    default: "",
    unit: "msnm",
    min: 0,
    max: 5500,
    step: 10,
    optional: true,
  },
  {
    key: "farm.general_location",
    label: "Localización o dirección general",
    description: "Vereda, sector, dirección o indicaciones generales para localizar el predio.",
    group: "Ubicación general",
    type: "string",
    default: "",
    optional: true,
  },
  {
    key: "farm.latitude",
    label: "Latitud general",
    description: "Coordenada aproximada del predio; las ubicaciones internas pueden tener coordenadas propias.",
    group: "Ubicación general",
    type: "number",
    default: "",
    optional: true,
    min: -90,
    max: 90,
    step: 0.000001,
  },
  {
    key: "farm.longitude",
    label: "Longitud general",
    description: "Coordenada aproximada del predio; las ubicaciones internas pueden tener coordenadas propias.",
    group: "Ubicación general",
    type: "number",
    default: "",
    optional: true,
    min: -180,
    max: 180,
    step: 0.000001,
  },
  {
    key: "farm.operation_start_date",
    label: "Inicio de operaciones",
    description: "Fecha desde la que funciona esta unidad productiva.",
    group: "Fechas clave",
    type: "string",
    default: "",
    optional: true,
    inputType: "date",
  },
  {
    key: "farm.registration_date",
    label: "Fecha de registro o constitución",
    description: "Fecha de constitución o registro, si aplica.",
    group: "Fechas clave",
    type: "string",
    default: "",
    optional: true,
    inputType: "date",
  },
  {
    key: "farm.admin_name",
    label: "Administrador o responsable",
    description: "Persona responsable del manejo de la granja. Completa este dato para cerrar la configuración inicial.",
    group: "Datos del administrador",
    type: "string",
    default: "",
    optional: true,
    setupRequired: true,
  },
  {
    key: "farm.admin_phone",
    label: "Teléfono de contacto",
    description: "Teléfono del administrador o responsable.",
    group: "Datos del administrador",
    type: "string",
    default: "",
    optional: true,
    inputType: "tel",
  },
  {
    key: "farm.admin_email",
    label: "Correo electrónico",
    description: "Correo de contacto del administrador o responsable.",
    group: "Datos del administrador",
    type: "string",
    default: "",
    optional: true,
    inputType: "email",
  },
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
    key: "eggs.storage_temp_min_c",
    label: "Temperatura mínima bodega de huevo",
    description: "Límite inferior recomendado (NTC 1240) para almacenar huevos antes de emitir alerta térmica.",
    group: "Producción y validaciones",
    type: "number",
    default: "10",
    unit: "°C",
    min: -5,
    max: 35,
    step: 0.5,
  },
  {
    key: "eggs.storage_temp_max_c",
    label: "Temperatura máxima bodega de huevo",
    description: "Límite superior recomendado (NTC 1240) para almacenar huevos antes de emitir alerta térmica.",
    group: "Producción y validaciones",
    type: "number",
    default: "15",
    unit: "°C",
    min: 0,
    max: 45,
    step: 0.5,
  },
  {
    key: "eggs.storage_humidity_min_pct",
    label: "Humedad relativa mínima bodega",
    description: "Humedad mínima recomendada para almacenamiento de huevo comercial.",
    group: "Producción y validaciones",
    type: "integer",
    default: "75",
    unit: "%",
    min: 20,
    max: 100,
    step: 1,
  },
  {
    key: "eggs.storage_humidity_max_pct",
    label: "Humedad relativa máxima bodega",
    description: "Humedad máxima recomendada para almacenamiento de huevo comercial.",
    group: "Producción y validaciones",
    type: "integer",
    default: "85",
    unit: "%",
    min: 20,
    max: 100,
    step: 1,
  },
  {
    key: "feeding.prediction_horizon_days",
    label: "Horizonte de proyección de alimento",
    description: "Días por defecto para proyectar cobertura de inventario de concentrado/forraje y stock mínimo recomendado.",
    group: "Producción y validaciones",
    type: "integer",
    default: "14",
    unit: "días",
    min: 1,
    max: 180,
    step: 1,
  },
  {
    key: "incubation.days",
    label: "Días de incubación (gallina)",
    description: "Días que tarda la eclosión de gallina para calcular la fecha esperada de nacimiento.",
    group: "Incubación y eclosión",
    type: "integer",
    default: "21",
    unit: "días",
    min: 1,
    max: 60,
    step: 1,
  },
  {
    key: "incubation.quail_days",
    label: "Días de incubación (codorniz)",
    description: "Días de incubación para huevos de codorniz.",
    group: "Incubación y eclosión",
    type: "integer",
    default: "17",
    unit: "días",
    min: 10,
    max: 35,
    step: 1,
  },
  {
    key: "incubation.duck_days",
    label: "Días de incubación (pato)",
    description: "Días de incubación para huevos de pato.",
    group: "Incubación y eclosión",
    type: "integer",
    default: "28",
    unit: "días",
    min: 15,
    max: 45,
    step: 1,
  },
  {
    key: "incubation.turn_stop_days_before",
    label: "Días antes para suspender volteo",
    description: "Días previos a la fecha esperada de eclosión en que se detiene el volteo (nacedora).",
    group: "Incubación y eclosión",
    type: "integer",
    default: "3",
    unit: "días",
    min: 1,
    max: 10,
    step: 1,
  },
  {
    key: "sanitary.empty_days",
    label: "Días de vacío sanitario entre lotes",
    description: "Días de descanso sanitario obligatorio (protocolo ICA) al activar el bloqueo de ingreso en un galpón o corral.",
    group: "Sanidad y alertas",
    type: "integer",
    default: "21",
    unit: "días",
    min: 1,
    max: 90,
    step: 1,
  },
  {
    key: "alerts.production_drop_pct",
    label: "Umbral alerta caída de postura",
    description: "Porcentaje mínimo de caída semanal en postura para emitir alerta operativa.",
    group: "Sanidad y alertas",
    type: "integer",
    default: "20",
    unit: "%",
    min: 5,
    max: 80,
    step: 1,
  },
  {
    key: "alerts.weight_deviation_pct",
    label: "Umbral alerta desviación de peso",
    description: "Porcentaje de desviación respecto a la curva de peso estándar para generar alerta biológica.",
    group: "Sanidad y alertas",
    type: "integer",
    default: "15",
    unit: "%",
    min: 5,
    max: 80,
    step: 1,
  },
  {
    key: "alerts.uniformity_tolerance_pct",
    label: "Banda de tolerancia de uniformidad",
    description: "Porcentaje ± sobre la media en muestreos individuales para calcular % de uniformidad del lote.",
    group: "Sanidad y alertas",
    type: "integer",
    default: "10",
    unit: "%",
    min: 5,
    max: 25,
    step: 1,
  },
  {
    key: "harvest.days_pollo",
    label: "Edad óptima cosecha pollo (días)",
    description: "Edad objetivo para programar beneficio/venta en pollos de engorde antes del deterioro de FCR.",
    group: "Ventanas de cosecha por especie",
    type: "integer",
    default: "42",
    unit: "días",
    min: 21,
    max: 180,
    step: 1,
  },
  {
    key: "harvest.days_pato",
    label: "Edad óptima cosecha pato (días)",
    description: "Edad objetivo para cosecha de patos de engorde.",
    group: "Ventanas de cosecha por especie",
    type: "integer",
    default: "49",
    unit: "días",
    min: 28,
    max: 180,
    step: 1,
  },
  {
    key: "harvest.days_codorniz",
    label: "Edad óptima cosecha codorniz (días)",
    description: "Edad objetivo para cosecha o inicio productivo en lotes de codorniz.",
    group: "Ventanas de cosecha por especie",
    type: "integer",
    default: "42",
    unit: "días",
    min: 21,
    max: 120,
    step: 1,
  },
  {
    key: "harvest.days_conejo",
    label: "Edad óptima cosecha conejo (días)",
    description: "Edad objetivo de beneficio para conejos de engorde.",
    group: "Ventanas de cosecha por especie",
    type: "integer",
    default: "75",
    unit: "días",
    min: 40,
    max: 180,
    step: 1,
  },
  {
    key: "harvest.days_cuy",
    label: "Edad óptima cosecha cuy (días)",
    description: "Edad objetivo para cosecha de cuyes de engorde antes de la inflexión FCR.",
    group: "Ventanas de cosecha por especie",
    type: "integer",
    default: "80",
    unit: "días",
    min: 45,
    max: 180,
    step: 1,
  },
  {
    key: "farm.dane_municipality_code",
    label: "Código DANE del municipio (DIVIPOLA)",
    description: "Código DANE de 5 dígitos para cruzar automáticamente clima, precios regionales SIPSA y alertas sanitarias.",
    group: "Fuentes externas y contexto oficial",
    type: "string",
    default: "25286",
    optional: true,
  },
  {
    key: "external.sync_enabled",
    label: "Sincronización externa activa",
    description: "Habilita el refresco en segundo plano de clima (Open-Meteo), DANE DIVIPOLA/SIPSA, TRM, estándares y festivos manteniendo fallback offline.",
    group: "Fuentes externas y contexto oficial",
    type: "boolean",
    default: "true",
  },
  {
    key: "external.weather_ttl_hours",
    label: "Vigencia caché clima / ITH",
    description: "Horas antes de renovar automáticamente la lectura meteorológica de Open-Meteo.",
    group: "Fuentes externas y contexto oficial",
    type: "integer",
    default: "3",
    unit: "horas",
    min: 1,
    max: 72,
    step: 1,
  },
  {
    key: "external.market_ttl_hours",
    label: "Vigencia caché precios SIPSA / TRM",
    description: "Horas antes de refrescar precios mayoristas DANE SIPSA y tasa representativa del mercado.",
    group: "Fuentes externas y contexto oficial",
    type: "integer",
    default: "12",
    unit: "horas",
    min: 1,
    max: 168,
    step: 1,
  },
  {
    key: "external.auto_adjust_feed_by_weather",
    label: "Ajustar predicción de alimento por clima/ITH",
    description: "Aplica el factor térmico ambiental (frío o estrés calórico) sobre la proyección de consumo diario de alimento.",
    group: "Fuentes externas y contexto oficial",
    type: "boolean",
    default: "true",
  },
  {
    key: "external.tax_uvt_cop",
    label: "Valor UVT DIAN vigente",
    description: "Unidad de Valor Tributario usada para calcular topes de retención y métricas tributarias en contabilidad analítica.",
    group: "Fuentes externas y contexto oficial",
    type: "integer",
    default: "49799",
    unit: "COP",
    min: 30000,
    max: 200000,
    step: 1,
  },
  {
    key: "external.finagro_ibr_ea_pct",
    label: "Tasa de referencia agropecuaria IBR / Finagro",
    description: "Tasa anual efectiva de referencia para comparar el ROI de activos CAPEX frente al costo financiero agropecuario.",
    group: "Fuentes externas y contexto oficial",
    type: "number",
    default: "9.5",
    unit: "% E.A.",
    min: 1,
    max: 45,
    step: 0.1,
  },
  {
    key: "tax.iva_default_pct",
    label: "IVA por defecto en compras/ventas gravadas",
    description: "Tarifa (%) sugerida cuando registras impuestos en una factura gravada (huevos y animales vivos suelen estar en 0%).",
    group: "Tributación, Nómina y Deducciones",
    type: "number",
    default: "0",
    unit: "%",
    min: 0,
    max: 25,
    step: 0.5,
  },
  {
    key: "tax.retefuente_agro_pct",
    label: "ReteFuente agropecuaria por defecto",
    description: "Tarifa (%) de retención en la fuente para productos agropecuarios sin procesar por encima de 92 UVT.",
    group: "Tributación, Nómina y Deducciones",
    type: "number",
    default: "1.5",
    unit: "%",
    min: 0,
    max: 20,
    step: 0.1,
  },
  {
    key: "tax.retefuente_compras_pct",
    label: "ReteFuente compras generales",
    description: "Tarifa (%) referencial para compras generales o insumos por encima de 27 UVT.",
    group: "Tributación, Nómina y Deducciones",
    type: "number",
    default: "2.5",
    unit: "%",
    min: 0,
    max: 20,
    step: 0.1,
  },
  {
    key: "tax.retefuente_servicios_pct",
    label: "ReteFuente servicios / honorarios",
    description: "Tarifa (%) sugerida para servicios técnicos, veterinarios o mantenimiento.",
    group: "Tributación, Nómina y Deducciones",
    type: "number",
    default: "4",
    unit: "%",
    min: 0,
    max: 20,
    step: 0.1,
  },
  {
    key: "tax.ica_default_pct",
    label: "ICA municipal sugerido",
    description: "Tarifa (%) de Industria y Comercio (ej. 0.4 corresponde a 4 por mil).",
    group: "Tributación, Nómina y Deducciones",
    type: "number",
    default: "0.4",
    unit: "%",
    min: 0,
    max: 5,
    step: 0.05,
  },
  {
    key: "tax.gmf_4x1000_enabled",
    label: "Estimar GMF (4x1000) sobre salidas bancarias",
    description: "Incluye el cálculo referencial de 0.4% sobre egresos en el resumen tributario y deducciones.",
    group: "Tributación, Nómina y Deducciones",
    type: "boolean",
    default: "false",
  },
  {
    key: "payroll.smlmv_cop",
    label: "Salario Mínimo Legal Vigente (SMLMV)",
    description: "Referencia mensual en COP para valorar jornales y nómina formal de la granja.",
    group: "Tributación, Nómina y Deducciones",
    type: "integer",
    default: "1423500",
    unit: "COP/mes",
    min: 500000,
    max: 10000000,
    step: 1000,
  },
  {
    key: "payroll.transport_allowance_cop",
    label: "Auxilio de transporte vigente",
    description: "Referencia mensual de auxilio de transporte legal en Colombia.",
    group: "Tributación, Nómina y Deducciones",
    type: "integer",
    default: "200000",
    unit: "COP/mes",
    min: 0,
    max: 2000000,
    step: 1000,
  },
  {
    key: "payroll.employer_burden_pct",
    label: "Factor prestacional y seguridad social empleador",
    description: "Porcentaje adicional asumido por la granja en contratos formales (pensión, ARL, caja, prima, cesantías, vacaciones).",
    group: "Tributación, Nómina y Deducciones",
    type: "number",
    default: "29.52",
    unit: "%",
    min: 0,
    max: 100,
    step: 0.1,
  },
  {
    key: "payroll.worker_deduction_pct",
    label: "Deducción seguridad social trabajador",
    description: "Porcentaje descontado al trabajador en nómina formal (salud 4% + pensión 4% = 8%).",
    group: "Tributación, Nómina y Deducciones",
    type: "number",
    default: "8",
    unit: "%",
    min: 0,
    max: 50,
    step: 0.1,
  },
  {
    key: "payroll.include_imputed_owner_labor",
    label: "Incluir trabajo propio no retirado en punto de equilibrio",
    description: "Cuando está activo, el valor del jornal/trabajo propio del pequeño productor entra en costos unitarios aunque no haya retiro en caja.",
    group: "Tributación, Nómina y Deducciones",
    type: "boolean",
    default: "true",
  },
  {
    key: "normative.custom_items_json",
    label: "Normas y guías personalizadas",
    description: "Catálogo JSON de normas, estándares o guías locales registradas por la granja.",
    group: "Sistema interno",
    type: "string",
    default: "[]",
    optional: true,
    hidden: true,
  },
];

export const DEFAULT_SETTINGS: Record<string, string> = Object.fromEntries(
  SETTING_DEFS.map((def) => [def.key, def.default]),
);

const CACHE_TTL_MS = 30_000;

const cacheByFarm = new Map<string, { values: Record<string, string>; loadedAt: number }>();

function coerceValue(def: SettingDef, raw: unknown): string {
  const text = raw === null || raw === undefined ? "" : String(raw).trim();
  if (def.type === "string") {
    if (!text && def.optional) return "";
    if (!text) throw new Error(`El parámetro "${def.label}" no puede estar vacío`);
    if (def.inputType === "date") {
      const date = new Date(`${text}T12:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
        throw new Error(`El parámetro "${def.label}" debe ser una fecha válida`);
      }
    }
    if (def.inputType === "email" && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      throw new Error(`El parámetro "${def.label}" debe ser un correo válido`);
    }
    return text;
  }
  if (def.type === "boolean") {
    if (text === "true" || text === "false") return text;
    throw new Error(`El parámetro "${def.label}" debe ser true o false`);
  }
  if (!text && def.optional) return "";
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
  const farmId = getCurrentFarmId();
  const entry = cacheByFarm.get(farmId);
  if (entry && Date.now() - entry.loadedAt < CACHE_TTL_MS) {
    return entry.values;
  }

  const values = { ...DEFAULT_SETTINGS };
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.farmId, farmId));
    for (const row of rows) {
      if (row.key in values) values[row.key] = row.value;
    }
  } catch {
    // Si la tabla aún no existe (primer despliegue), se usan los defaults.
  }

  cacheByFarm.set(farmId, { values, loadedAt: Date.now() });
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
  cacheByFarm.delete(getCurrentFarmId());
}

/** Lista para la UI: definición + valor efectivo. */
export async function getSettingsForApi() {
  const values = await getSettings();
  return SETTING_DEFS.filter((def) => !def.hidden).map((def) => ({
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

  const validUserId =
    typeof userId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      ? userId
      : null;

  for (const item of normalized) {
    await db
      .insert(appSettings)
      .values({ farmId: getCurrentFarmId(), key: item.key, value: item.value, updatedBy: validUserId })
      .onConflictDoUpdate({
        target: [appSettings.farmId, appSettings.key],
        set: {
          value: item.value,
          updatedBy: validUserId,
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

export async function getIncubationRulesForSpecies(species: string): Promise<{ days: number; turnStopDaysBefore: number }> {
  const sp = (species || "gallina").trim().toLowerCase();
  const key = sp === "codorniz" ? "incubation.quail_days" : sp === "pato" ? "incubation.duck_days" : "incubation.days";
  const [days, turnStopDaysBefore] = await Promise.all([
    getNumberSetting(key),
    getNumberSetting("incubation.turn_stop_days_before"),
  ]);
  return { days, turnStopDaysBefore };
}

export async function getEggStorageThresholds() {
  const [minTempC, maxTempC, minHumidityPct, maxHumidityPct] = await Promise.all([
    getNumberSetting("eggs.storage_temp_min_c"),
    getNumberSetting("eggs.storage_temp_max_c"),
    getNumberSetting("eggs.storage_humidity_min_pct"),
    getNumberSetting("eggs.storage_humidity_max_pct"),
  ]);
  return { minTempC, maxTempC, minHumidityPct, maxHumidityPct };
}

export async function getSanitaryEmptyDays(): Promise<number> {
  return getNumberSetting("sanitary.empty_days");
}

export async function getFeedingHorizonDays(): Promise<number> {
  return getNumberSetting("feeding.prediction_horizon_days");
}

export async function getAlertThresholds() {
  const [productionDropPct, weightDeviationPct, uniformityTolerancePct] = await Promise.all([
    getNumberSetting("alerts.production_drop_pct"),
    getNumberSetting("alerts.weight_deviation_pct"),
    getNumberSetting("alerts.uniformity_tolerance_pct"),
  ]);
  return { productionDropPct, weightDeviationPct, uniformityTolerancePct };
}

export async function getHarvestDaysBySpecies(): Promise<Record<string, number>> {
  const [pollo, pato, codorniz, conejo, cuy] = await Promise.all([
    getNumberSetting("harvest.days_pollo"),
    getNumberSetting("harvest.days_pato"),
    getNumberSetting("harvest.days_codorniz"),
    getNumberSetting("harvest.days_conejo"),
    getNumberSetting("harvest.days_cuy"),
  ]);
  return { pollo, pato, codorniz, conejo, cuy };
}

export async function getExternalSyncConfig() {
  const [syncEnabled, weatherTtlHours, marketTtlHours, autoAdjustFeedByWeather, daneMunicipalityCode] =
    await Promise.all([
      getBooleanSetting("external.sync_enabled"),
      getNumberSetting("external.weather_ttl_hours"),
      getNumberSetting("external.market_ttl_hours"),
      getBooleanSetting("external.auto_adjust_feed_by_weather"),
      getSetting("farm.dane_municipality_code"),
    ]);
  return {
    syncEnabled,
    weatherTtlHours,
    marketTtlHours,
    autoAdjustFeedByWeather,
    daneMunicipalityCode,
  };
}

export async function getTaxAndFinanceDefaults() {
  const [uvtCop, finagroIbrEaPct] = await Promise.all([
    getNumberSetting("external.tax_uvt_cop"),
    getNumberSetting("external.finagro_ibr_ea_pct"),
  ]);
  return { uvtCop, finagroIbrEaPct };
}

export async function getTaxAndPayrollConfig() {
  const [
    uvtCop,
    ivaDefaultPct,
    reteAgroPct,
    reteComprasPct,
    reteServiciosPct,
    icaDefaultPct,
    gmf4x1000Enabled,
    smlmvCop,
    transportAllowanceCop,
    employerBurdenPct,
    workerDeductionPct,
    includeImputedOwnerLabor,
  ] = await Promise.all([
    getNumberSetting("external.tax_uvt_cop"),
    getNumberSetting("tax.iva_default_pct"),
    getNumberSetting("tax.retefuente_agro_pct"),
    getNumberSetting("tax.retefuente_compras_pct"),
    getNumberSetting("tax.retefuente_servicios_pct"),
    getNumberSetting("tax.ica_default_pct"),
    getBooleanSetting("tax.gmf_4x1000_enabled"),
    getNumberSetting("payroll.smlmv_cop"),
    getNumberSetting("payroll.transport_allowance_cop"),
    getNumberSetting("payroll.employer_burden_pct"),
    getNumberSetting("payroll.worker_deduction_pct"),
    getBooleanSetting("payroll.include_imputed_owner_labor"),
  ]);

  return {
    uvtCop,
    ivaDefaultPct,
    reteAgroPct,
    reteComprasPct,
    reteServiciosPct,
    icaDefaultPct,
    gmf4x1000Enabled,
    smlmvCop,
    dailySmlmvCop: Math.round(smlmvCop / 30),
    transportAllowanceCop,
    employerBurdenPct,
    workerDeductionPct,
    includeImputedOwnerLabor,
  };
}

/** Helper para pruebas: permite inyectar valores sin tocar la DB. */
export function __setSettingsCacheForTests(values: Record<string, string> | null): void {
  const farmId = getCurrentFarmId();
  if (values) {
    cacheByFarm.set(farmId, { values: { ...DEFAULT_SETTINGS, ...values }, loadedAt: Date.now() });
  } else {
    cacheByFarm.delete(farmId);
  }
}
