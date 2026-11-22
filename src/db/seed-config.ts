import path from "node:path";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  appSettings,
  breedWeightStandards,
  catalogos,
  farmSubscriptions,
  farms,
  manureFactors,
  vaccinationTemplates,
} from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { canonicalBreedType, DEFAULT_BREEDS_BY_SPECIES } from "@/lib/animal-breeds";
import { ALL_BREED_STANDARD_DEFS, inferSpeciesForBreed } from "@/lib/breed-standards";
import { syncLegacyCatalogContacts } from "@/lib/contacts";
import { seedStarterFeedsAndPrograms, type StarterSeedSummary } from "@/lib/feeding/default-tenant-seed";
import { PRODUCTIVE_CAPEX_FAMILIES } from "@/lib/finance/standard-capex-catalog";
import { NON_FEED_STANDARD_EXPENSE_FAMILIES } from "@/lib/finance/standard-expense-catalog";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { SPECIES_PARAMS } from "@/lib/species-params";
import { VACCINATION_SCHEDULE_SPECIES, VACCINATION_SCHEDULES } from "@/lib/vaccination-schedules";

export const NORMATIVE_PACK_VERSION = "2026.11-ICA-NTC1240";

/**
 * Siembra técnica obligatoria e idempotente (Capa Core).
 *
 * - Crea la granja principal por defecto (`DEFAULT_FARM_ID`) y su suscripción base si faltan.
 * - Siembra parámetros globales (`DEFAULT_SETTINGS`) sin sobrescribir valores editados.
 * - Carga catálogos maestros multi-especie, razas, parámetros por especie, estándares de peso y vacunas.
 * - Precarga alimentos neutros (stock 0, sin proveedor), etapas y planes mixtos + factores base de gallinaza.
 *
 * Segura para ejecutar en producción o en el arranque inicial: usa `onConflictDoNothing()` y no borra datos.
 */

const BREED_SPECIES: Record<string, string> = {
  "ISA Brown": "gallina",
  "Hy-Line W-36": "gallina",
  "Hy-Line Brown": "gallina",
  "Cobb 500": "pollo",
  "Ross 308": "pollo",
  "Cuy Mejorado": "cuy",
};

const HEN_STATUSES = [
  { value: "activa", sortOrder: 0 },
  { value: "empollando", sortOrder: 1 },
  { value: "enferma", sortOrder: 2 },
  { value: "recomendada_sacrificio", sortOrder: 3 },
  { value: "descarte", sortOrder: 4 },
  { value: "vendida", sortOrder: 5 },
  { value: "faena", sortOrder: 6 },
  { value: "muerta", sortOrder: 7 },
];

interface MasterCatalogDef {
  category: string;
  value: string;
  description?: string;
  tipo?: string;
  price?: string;
  units?: number;
  minWeeks?: number | null;
  maxWeeks?: number | null;
  expectedEggsPerHen?: string | null;
  sortOrder: number;
}

const MASTER_CATALOG_DEFS: MasterCatalogDef[] = [
  // Tamaños comerciales de huevo (NTC 1240)
  { category: "tamano_huevo", value: "Jumbo", price: "800", sortOrder: 0 },
  { category: "tamano_huevo", value: "Extra", price: "700", sortOrder: 1 },
  { category: "tamano_huevo", value: "Grande", price: "600", sortOrder: 2 },
  { category: "tamano_huevo", value: "Mediano", price: "500", sortOrder: 3 },
  { category: "tamano_huevo", value: "Pequeño", price: "400", sortOrder: 4 },

  // Presentaciones de venta (huevos, codorniz, carne y abonos)
  { category: "presentacion_venta", value: "Unidad", units: 1, sortOrder: 0 },
  { category: "presentacion_venta", value: "Media docena", units: 6, sortOrder: 1 },
  { category: "presentacion_venta", value: "Docena", units: 12, sortOrder: 2 },
  { category: "presentacion_venta", value: "1/2 Bandeja", units: 15, sortOrder: 3 },
  { category: "presentacion_venta", value: "Bandeja/Cubeta", units: 30, sortOrder: 4 },
  { category: "presentacion_venta", value: "Bandeja x24 Huevos Codorniz", price: "6500", units: 24, tipo: "huevos_codorniz", sortOrder: 10 },
  { category: "presentacion_venta", value: "Caja x30 Huevos Codorniz", price: "8000", units: 30, tipo: "huevos_codorniz", sortOrder: 11 },
  { category: "presentacion_venta", value: "Bolsa x50 Huevos Codorniz", price: "12000", units: 50, tipo: "huevos_codorniz", sortOrder: 12 },
  { category: "presentacion_venta", value: "Canal Conejo Entero (kg)", price: "28000", units: 1, tipo: "carne_conejo", sortOrder: 20 },
  { category: "presentacion_venta", value: "Canal Pato Entero (kg)", price: "24000", units: 1, tipo: "carne_pato", sortOrder: 21 },
  { category: "presentacion_venta", value: "Bulto Conejaza 25kg", price: "15000", units: 25, tipo: "abono", sortOrder: 30 },
  { category: "presentacion_venta", value: "Bulto Codornaza 25kg", price: "18000", units: 25, tipo: "abono", sortOrder: 31 },

  // Presentaciones de compra
  { category: "presentacion_compra", value: "Kg", units: 1, sortOrder: 0 },
  { category: "presentacion_compra", value: "Bulto 25kg", units: 25, sortOrder: 1 },
  { category: "presentacion_compra", value: "Bulto 40kg", units: 40, sortOrder: 2 },
  { category: "presentacion_compra", value: "Bulto 50kg", units: 50, sortOrder: 3 },
  { category: "presentacion_compra", value: "Arpilla 5kg", units: 5, sortOrder: 4 },
  { category: "presentacion_compra", value: "Litro", units: 1, sortOrder: 5 },
  { category: "presentacion_compra", value: "Galón", units: 4, sortOrder: 6 },
  { category: "presentacion_compra", value: "Unidad", units: 1, sortOrder: 7 },

  // Enfermedades frecuentes
  { category: "enfermedad", value: "Newcastle", sortOrder: 0 },
  { category: "enfermedad", value: "Coccidiosis", sortOrder: 1 },
  { category: "enfermedad", value: "Viruela aviar", sortOrder: 2 },
  { category: "enfermedad", value: "Mycoplasma", sortOrder: 3 },
  { category: "enfermedad", value: "Ácaros / piojos", sortOrder: 4 },
  { category: "enfermedad", value: "Cólera aviar", sortOrder: 5 },
  { category: "enfermedad", value: "Marek", sortOrder: 6 },
  { category: "enfermedad", value: "Coriza", sortOrder: 7 },

  // Unidades de medida
  { category: "unidad_medida", value: "unidades", sortOrder: 0 },
  { category: "unidad_medida", value: "kg", sortOrder: 1 },
  { category: "unidad_medida", value: "lb", sortOrder: 2 },
  { category: "unidad_medida", value: "litros", sortOrder: 3 },
  { category: "unidad_medida", value: "docenas", sortOrder: 4 },
  { category: "unidad_medida", value: "gramos", sortOrder: 5 },
  { category: "unidad_medida", value: "otro", sortOrder: 6 },

  // Categorías financieras
  { category: "categoria_ingreso", value: "Venta de huevos", sortOrder: 0 },
  { category: "categoria_ingreso", value: "Venta de animales", sortOrder: 1 },
  { category: "categoria_ingreso", value: "Venta de carne", sortOrder: 2 },
  { category: "categoria_ingreso", value: "Venta de gallinas", sortOrder: 3 },
  { category: "categoria_ingreso", value: "Venta de pollitos", sortOrder: 4 },
  { category: "categoria_ingreso", value: "Venta de abono/gallinaza", sortOrder: 5 },
  { category: "categoria_ingreso", value: "Venta de subproductos", sortOrder: 6 },
  { category: "categoria_ingreso", value: "Otro ingreso", sortOrder: 7 },

  { category: "categoria_egreso", value: "Compra de alimento", tipo: "ALIMENTO", sortOrder: 0 },
  { category: "categoria_egreso", value: "Mano de obra", tipo: "FIJO", sortOrder: 1 },
  ...NON_FEED_STANDARD_EXPENSE_FAMILIES.map((fam, idx) => ({
    category: "categoria_egreso",
    value: fam.name,
    tipo: fam.defaultTreatment,
    description: `${fam.conceptsCount} conceptos (${fam.p1Count} P1) del Catálogo Maestro de Egresos`,
    sortOrder: idx + 2,
  })),

  ...PRODUCTIVE_CAPEX_FAMILIES.map((fam, idx) => ({
    category: "categoria_capex",
    value: fam.name,
    tipo: fam.defaultClassification,
    description: `${fam.conceptsCount} conceptos (${fam.p1Count} P1) del Catálogo Maestro de CapEx e Inversiones`,
    sortOrder: idx,
  })),

  // Sanidad y mantenimiento
  { category: "tipo_sanidad", value: "vacunacion", sortOrder: 0 },
  { category: "tipo_sanidad", value: "desparasitacion", sortOrder: 1 },
  { category: "tipo_sanidad", value: "tratamiento", sortOrder: 2 },
  { category: "tipo_sanidad", value: "inspeccion", sortOrder: 3 },
  { category: "tipo_sanidad", value: "fumigacion", sortOrder: 4 },
  { category: "tipo_sanidad", value: "vitaminas", sortOrder: 5 },
  { category: "tipo_sanidad", value: "otro", sortOrder: 6 },

  { category: "tipo_mantenimiento", value: "Limpieza y desinfección del gallinero", sortOrder: 0 },
  { category: "tipo_mantenimiento", value: "Revisión y reparación de nidales", sortOrder: 1 },
  { category: "tipo_mantenimiento", value: "Cambio de cama / viruta", sortOrder: 2 },
  { category: "tipo_mantenimiento", value: "Revisión del sistema de agua", sortOrder: 3 },
  { category: "tipo_mantenimiento", value: "Reparación de cercas y malla", sortOrder: 4 },
  { category: "tipo_mantenimiento", value: "Poda de vegetación alrededor", sortOrder: 5 },
  { category: "tipo_mantenimiento", value: "Revisión de techos y drenajes", sortOrder: 6 },
  { category: "tipo_mantenimiento", value: "Mantenimiento de comederos", sortOrder: 7 },
  { category: "tipo_mantenimiento", value: "Fumigación preventiva", sortOrder: 8 },
  { category: "tipo_mantenimiento", value: "Pintura y protección de estructuras", sortOrder: 9 },

  // Alimentos e insumos
  { category: "categoria_alimento", value: "Concentrado", sortOrder: 0 },
  { category: "categoria_alimento", value: "En Fresco", sortOrder: 1 },
  { category: "categoria_alimento", value: "Preparados", sortOrder: 2 },

  { category: "tipo_alimento", value: "Concentrado Aves", sortOrder: 0 },
  { category: "tipo_alimento", value: "Concentrado Codorniz", sortOrder: 1 },
  { category: "tipo_alimento", value: "Concentrado Conejos", sortOrder: 2 },
  { category: "tipo_alimento", value: "Purinas", sortOrder: 3 },
  { category: "tipo_alimento", value: "Maiz en Grano", sortOrder: 4 },
  { category: "tipo_alimento", value: "Maíz Germinado", sortOrder: 5 },
  { category: "tipo_alimento", value: "Mosca Soldado", sortOrder: 6 },
  { category: "tipo_alimento", value: "Forraje Verde", sortOrder: 7 },
  { category: "tipo_alimento", value: "Pastos y gramíneas", sortOrder: 8 },
  { category: "tipo_alimento", value: "Bore o Raices", sortOrder: 9 },
  { category: "tipo_alimento", value: "Otro", sortOrder: 10 },

  { category: "tipo_ave", value: "Gallina", tipo: "ave", sortOrder: 0 },
  { category: "tipo_ave", value: "Pollo", tipo: "ave", sortOrder: 1 },
  { category: "tipo_ave", value: "Gallo", tipo: "ave", sortOrder: 2 },
  { category: "tipo_ave", value: "Pollito", tipo: "ave", sortOrder: 3 },
  { category: "tipo_ave", value: "Codorniz", tipo: "ave", sortOrder: 4 },
  { category: "tipo_ave", value: "Pato", tipo: "ave", sortOrder: 5 },
  { category: "tipo_ave", value: "Conejo", tipo: "mamifero", sortOrder: 6 },
  { category: "tipo_ave", value: "Cuy", tipo: "mamifero", sortOrder: 7 },

  { category: "categoria_insumo", value: "medicamento", sortOrder: 0 },
  { category: "categoria_insumo", value: "vacuna", sortOrder: 1 },
  { category: "categoria_insumo", value: "desinfectante", sortOrder: 2 },
  { category: "categoria_insumo", value: "limpieza", sortOrder: 3 },
  { category: "categoria_insumo", value: "equipo", sortOrder: 4 },
  { category: "categoria_insumo", value: "otro", sortOrder: 5 },

  { category: "causa_mortalidad", value: "enfermedad", sortOrder: 0 },
  { category: "causa_mortalidad", value: "depredador", sortOrder: 1 },
  { category: "causa_mortalidad", value: "accidente", sortOrder: 2 },
  { category: "causa_mortalidad", value: "sacrificio_sanitario", sortOrder: 3 },
  { category: "causa_mortalidad", value: "causa_natural", sortOrder: 4 },
  { category: "causa_mortalidad", value: "otro", sortOrder: 5 },

  // Etapas base de postura (el resto de especies se completa en seedStarterFeedsAndPrograms)
  { category: "etapa_crecimiento", value: "Pollito", tipo: "gallina", minWeeks: 0, maxWeeks: 6, expectedEggsPerHen: "0", sortOrder: 0 },
  { category: "etapa_crecimiento", value: "Juvenil", tipo: "gallina", minWeeks: 6, maxWeeks: 18, expectedEggsPerHen: "0", sortOrder: 1 },
  { category: "etapa_crecimiento", value: "Pre-postura", tipo: "gallina", minWeeks: 18, maxWeeks: 20, expectedEggsPerHen: "0.3", sortOrder: 2 },
  { category: "etapa_crecimiento", value: "Postura", tipo: "gallina", minWeeks: 20, maxWeeks: null, expectedEggsPerHen: "0.85", sortOrder: 3 },
  { category: "etapa_crecimiento", value: "Cuy Crecimiento (4-8 sem)", tipo: "cuy", minWeeks: 4, maxWeeks: 8, expectedEggsPerHen: "0", sortOrder: 12 },
  { category: "etapa_crecimiento", value: "Cuy Engorde (8-16 sem)", tipo: "cuy", minWeeks: 8, maxWeeks: 16, expectedEggsPerHen: "0", sortOrder: 13 },

  // Plantillas iniciales para formular proyectos donde El Gallinero sea un componente.
  { category: "proyecto_proposito", value: "Seguridad y autonomía alimentaria", description: "El proyecto busca mejorar la disponibilidad de alimentos del hogar. El Gallinero registra producción destinada al autoconsumo y ayuda a observar su aporte y las brechas definidas por el proyecto.", sortOrder: 0 },
  { category: "proyecto_proposito", value: "Diversificación de medios de vida e ingreso complementario", description: "El proyecto fortalece el aporte económico de la actividad animal dentro de los ingresos diversos del hogar.", sortOrder: 1 },
  { category: "proyecto_proposito", value: "Consolidación productiva e ingreso neto", description: "El proyecto acompaña actividades con ventas más regulares y busca mejorar su planificación y viabilidad económica.", sortOrder: 2 },
  { category: "proyecto_proposito", value: "Sanidad y continuidad productiva", description: "El proyecto acompaña prácticas sanitarias y continuidad de la producción con asistencia técnica competente.", sortOrder: 3 },
  { category: "proyecto_proposito", value: "Extensión y adopción de prácticas", description: "El proyecto fortalece el acompañamiento técnico y el uso de información en las decisiones de los productores.", sortOrder: 4 },
  { category: "proyecto_proposito", value: "Fortalecimiento asociativo y mercados locales", description: "El proyecto fortalece coordinación, capacidades colectivas y vínculos comerciales de los productores.", sortOrder: 5 },
  { category: "proyecto_proposito", value: "Producción circular y uso eficiente de recursos", description: "El proyecto promueve prácticas de aprovechamiento de subproductos y gestión eficiente de recursos.", sortOrder: 6 },

  { category: "beneficiario_arquetipo", value: "Hogar que asegura parte de su alimentación", description: "Perfil ilustrativo para adaptar: la cría aporta alimentos al hogar y puede generar excedentes ocasionales. Validar rutina, destino de producción y acceso a TIC en el territorio.", sortOrder: 0 },
  { category: "beneficiario_arquetipo", value: "Hogar que planifica la disponibilidad de alimentos", description: "Perfil ilustrativo para adaptar: busca anticipar cambios en producción y autoconsumo. Validar necesidades, temporadas y condiciones de conectividad.", sortOrder: 1 },
  { category: "beneficiario_arquetipo", value: "Hogar que fortalece su autonomía alimentaria", description: "Perfil ilustrativo para adaptar: incorpora la cría animal en una estrategia de autonomía y aprendizaje familiar o comunitario.", sortOrder: 2 },
  { category: "beneficiario_arquetipo", value: "Hogar que vende excedentes cuando puede", description: "Perfil ilustrativo para adaptar: combina autoconsumo con ventas ocasionales y necesita distinguir el aporte económico de la actividad.", sortOrder: 3 },
  { category: "beneficiario_arquetipo", value: "Productor familiar con ventas recurrentes", description: "Perfil ilustrativo para adaptar: realiza ventas frecuentes a pequeña escala y necesita relacionar producción, costos e ingresos.", sortOrder: 4 },
  { category: "beneficiario_arquetipo", value: "Productor asociado a un mercado local", description: "Perfil ilustrativo para adaptar: participa en una iniciativa colectiva y requiere registrar su actividad con reglas claras de acceso a los datos.", sortOrder: 5 },
  { category: "beneficiario_arquetipo", value: "Productor en transición hacia ventas regulares", description: "Perfil ilustrativo para adaptar: pasa de ventas ocasionales a pedidos más frecuentes y necesita acompañamiento para organizar registros y costos.", sortOrder: 6 },
  { category: "beneficiario_arquetipo", value: "Unidad productiva familiar planificada", description: "Perfil ilustrativo para adaptar: distribuye tareas de producción y gestión entre integrantes del hogar y busca información compartida.", sortOrder: 7 },
  { category: "beneficiario_arquetipo", value: "Emprendedor productor con meta de crecimiento", description: "Perfil ilustrativo para adaptar: busca planear crecimiento con información de producción, ventas, autoconsumo y gastos.", sortOrder: 8 },

  { category: "enfoque_transversal", value: "Género y autonomía económica", description: "Identifica quién realiza el trabajo, quién registra y quién decide sobre la producción y sus ingresos; adaptar al proyecto y territorio.", sortOrder: 0 },
  { category: "enfoque_transversal", value: "Juventud y proyecto de vida", description: "Vincula la actividad productiva con capacidades, aspiraciones y continuidad de proyectos de vida rurales.", sortOrder: 1 },
  { category: "enfoque_transversal", value: "Pertinencia cultural y territorial", description: "Ajusta lenguaje, rutinas y acompañamiento a prácticas, identidades y condiciones del territorio.", sortOrder: 2 },
  { category: "enfoque_transversal", value: "Inclusión y apropiación digital", description: "Considera acceso a dispositivo, conectividad, habilidades, canal preferido y apoyos necesarios para usar la herramienta.", sortOrder: 3 },
  { category: "enfoque_transversal", value: "Trabajo familiar, asociativo o comunitario", description: "Reconoce quiénes participan en la actividad y cómo se distribuyen decisiones, registros y beneficios.", sortOrder: 4 },

  { category: "ruta_implementacion", value: "Acompañamiento al hogar", description: "Diagnóstico, configuración, formación práctica y seguimiento con cada hogar beneficiario.", sortOrder: 0 },
  { category: "ruta_implementacion", value: "Adopción facilitada por grupos", description: "La asociación u organización local facilita formación y apoyo colectivo; cada hogar conserva claridad sobre sus datos.", sortOrder: 1 },
  { category: "ruta_implementacion", value: "Acompañamiento mediante extensión técnica", description: "Los registros se utilizan durante visitas y procesos de asistencia técnica acordados.", sortOrder: 2 },
  { category: "ruta_implementacion", value: "Integración a un programa territorial", description: "La app se incorpora a varios componentes del proyecto con responsables, soporte y reglas de datos definidos.", sortOrder: 3 },

  { category: "alcance_proyecto", value: "Piloto de encaje", description: "Un territorio o grupo pequeño, un propósito principal y pocas rutinas priorizadas para aprender y ajustar.", sortOrder: 0 },
  { category: "alcance_proyecto", value: "Cohorte de implementación", description: "Varias familias o unidades productivas acompañadas con un plan común de formación, uso y soporte.", sortOrder: 1 },
  { category: "alcance_proyecto", value: "Programa territorial", description: "Varias organizaciones o territorios, con gobernanza de datos, soporte sostenido y medición coordinada.", sortOrder: 2 },

  { category: "componente_gallinero", value: "Registro de producción y destino", description: "Seguimiento de producción diferenciando autoconsumo, ventas y otros destinos configurados.", sortOrder: 0 },
  { category: "componente_gallinero", value: "Captura operativa con asistente", description: "Consultas y registros en lenguaje natural desde el asistente de la aplicación, según las funciones habilitadas.", sortOrder: 1 },
  { category: "componente_gallinero", value: "Canal externo de mensajería", description: "Componente sujeto a disponibilidad y validación del canal en cada despliegue; no ofertar como activo sin confirmar su estado.", sortOrder: 2 },
  { category: "componente_gallinero", value: "Producción, alimentación e inventarios", description: "Registro de producción animal, consumo e inventarios relevantes para el proyecto.", sortOrder: 3 },
  { category: "componente_gallinero", value: "Sanidad y mortalidad", description: "Seguimiento de eventos sanitarios, alertas y mortalidad como apoyo al acompañamiento técnico.", sortOrder: 4 },
  { category: "componente_gallinero", value: "Finanzas, ventas e ingreso neto", description: "Relación entre ventas y gastos registrados para observar el aporte económico de la actividad.", sortOrder: 5 },
  { category: "componente_gallinero", value: "Análisis y reportes", description: "Indicadores y reportes disponibles para seguimiento de la granja y del proyecto, sujeto a permisos y alcance técnico.", sortOrder: 6 },

  { category: "medicion_proyecto", value: "Resultado principal del proyecto", description: "Indicador del cambio que busca la intervención, con línea base, periodo, población y método definidos.", sortOrder: 0 },
  { category: "medicion_proyecto", value: "Aporte de autoconsumo y brechas", description: "Seguimiento de producción destinada al hogar y del aporte o brecha alimentaria definida por el proyecto.", sortOrder: 1 },
  { category: "medicion_proyecto", value: "Ingreso complementario o neto", description: "Seguimiento del ingreso que aporta la actividad, considerando costos registrados y el método acordado.", sortOrder: 2 },
  { category: "medicion_proyecto", value: "Adopción y uso sostenido", description: "Seguimiento de hogares activos, rutinas acordadas y continuidad de uso.", sortOrder: 3 },
  { category: "medicion_proyecto", value: "Esfuerzo y tiempo de captura", description: "Comparación del tiempo y esfuerzo de registro antes y durante la intervención.", sortOrder: 4 },
  { category: "medicion_proyecto", value: "Calidad y completitud de datos", description: "Seguimiento de registros completos, oportunos, consistentes y corregidos.", sortOrder: 5 },
  { category: "medicion_proyecto", value: "Uso de información en decisiones", description: "Registro de decisiones de manejo o gestión apoyadas por la información, sin atribuir causalidad automática a la app.", sortOrder: 6 },

  { category: "continuidad_proyecto", value: "Promotor local formado", description: "Persona del territorio con tiempo y responsabilidad asignados para acompañar el uso.", sortOrder: 0 },
  { category: "continuidad_proyecto", value: "Soporte y mantenimiento financiados", description: "Responsable y recursos definidos para soporte técnico, operación y mantenimiento después del proyecto.", sortOrder: 1 },
  { category: "continuidad_proyecto", value: "Portabilidad y custodia de datos", description: "Acuerdos sobre acceso, uso, exportación y conservación de datos al cierre de la intervención.", sortOrder: 2 },
  { category: "continuidad_proyecto", value: "Formación de refuerzo", description: "Plan para capacitar nuevos usuarios y reforzar rutinas de registro cuando sea necesario.", sortOrder: 3 },
  { category: "continuidad_proyecto", value: "Responsable operativo después del cierre", description: "Persona u organización que asumirá la continuidad de la práctica y del servicio al terminar el financiamiento.", sortOrder: 4 },
];

async function ensureDefaultFarmAndSubscription(): Promise<void> {
  await db
    .insert(farms)
    .values({
      id: DEFAULT_FARM_ID,
      slug: "default",
      name: "Granja Principal",
      deploymentMode: "dedicated",
      planCode: "COMERCIAL_MEDIANO",
    })
    .onConflictDoNothing();

  await db
    .insert(farmSubscriptions)
    .values({
      farmId: DEFAULT_FARM_ID,
      planCode: "COMERCIAL_MEDIANO",
      status: "active",
      maxActiveBatches: null,
      maxUsers: 8,
    })
    .onConflictDoNothing();
}

async function ensureHenStatuses(): Promise<number> {
  const existing = await db
    .select({ value: catalogos.value })
    .from(catalogos)
    .where(and(eq(catalogos.farmId, DEFAULT_FARM_ID), eq(catalogos.category, "estado_gallina")));
  const present = new Set(existing.map((row) => row.value));
  const missing = HEN_STATUSES.filter((item) => !present.has(item.value));
  if (missing.length === 0) return 0;

  for (const item of missing) {
    await db.transaction(async (tx) => {
      await tx
        .update(catalogos)
        .set({ sortOrder: sql`${catalogos.sortOrder} + 1` })
        .where(
          and(
            eq(catalogos.farmId, DEFAULT_FARM_ID),
            eq(catalogos.category, "estado_gallina"),
            gte(catalogos.sortOrder, item.sortOrder),
          ),
        );
      await tx
        .insert(catalogos)
        .values({
          farmId: DEFAULT_FARM_ID,
          category: "estado_gallina",
          value: item.value,
          sortOrder: item.sortOrder,
        })
        .onConflictDoNothing();
    });
  }

  return missing.length;
}

/** Agrega razas por especie y clasifica las razas históricas de gallina. */
async function ensureAnimalBreeds(): Promise<{ added: number; associated: number }> {
  const rows = await db
    .select({ id: catalogos.id, value: catalogos.value, tipo: catalogos.tipo })
    .from(catalogos)
    .where(and(eq(catalogos.farmId, DEFAULT_FARM_ID), eq(catalogos.category, "raza")));
  const normalizeValue = (value: string) =>
    value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const byValue = new Map(rows.map((row) => [normalizeValue(row.value), row]));
  let added = 0;
  let associated = 0;
  let nextOrder = rows.length;

  for (const row of rows) {
    if (row.tipo) continue;
    const species = canonicalBreedType(row.value) || "gallina";
    await db.update(catalogos).set({ tipo: species }).where(eq(catalogos.id, row.id));
    row.tipo = species;
    associated += 1;
  }

  for (const [species, breeds] of Object.entries(DEFAULT_BREEDS_BY_SPECIES)) {
    for (const value of breeds) {
      const key = normalizeValue(value);
      const existing = byValue.get(key);
      if (existing) {
        if (!existing.tipo) {
          await db.update(catalogos).set({ tipo: species }).where(eq(catalogos.id, existing.id));
          existing.tipo = species;
          associated += 1;
        }
        continue;
      }

      const [created] = await db
        .insert(catalogos)
        .values({
          farmId: DEFAULT_FARM_ID,
          category: "raza",
          value,
          tipo: species,
          sortOrder: nextOrder,
        })
        .onConflictDoNothing()
        .returning({ id: catalogos.id, value: catalogos.value, tipo: catalogos.tipo });
      if (created) {
        byValue.set(key, created);
        added += 1;
        nextOrder += 1;
      }
    }
  }
  return { added, associated };
}

/** Siembra parámetros productivos por especie cuando una especie aún no tiene filas en catálogos. */
async function ensureSpeciesParams(): Promise<number> {
  const existing = await db
    .select({ tipo: catalogos.tipo, sortOrder: catalogos.sortOrder })
    .from(catalogos)
    .where(and(eq(catalogos.farmId, DEFAULT_FARM_ID), eq(catalogos.category, "params_especie")));
  const presentSpecies = new Set(existing.map((r) => r.tipo).filter(Boolean));
  const missing = SPECIES_PARAMS.filter((p) => !presentSpecies.has(p.species));
  if (missing.length === 0) return 0;

  let nextOrder = existing.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), 0) + 1;
  let added = 0;
  for (const p of missing) {
    const [inserted] = await db
      .insert(catalogos)
      .values({
        farmId: DEFAULT_FARM_ID,
        category: "params_especie",
        value: p.label,
        tipo: p.species,
        minWeeks: p.cycleWeeks,
        maxWeeks: p.cycleDays ?? p.cycleWeeks * 7,
        targetWeightKg: String(p.targetWeightKg),
        units: p.carcassYieldPercent,
        dailyFeedG: p.dailyFeedGPerHead,
        feedCostPerKg: p.feedCostPerKgCOP > 0 ? String(p.feedCostPerKgCOP) : null,
        initialUnitCostCop: p.initialUnitCostCOP != null ? String(p.initialUnitCostCOP) : null,
        pointOfLayUnitValueCop: p.pointOfLayUnitValueCOP != null ? String(p.pointOfLayUnitValueCOP) : null,
        breederUnitValueCop: p.breederUnitValueCOP != null ? String(p.breederUnitValueCOP) : null,
        feedConversionRatio: String(p.feedConversionRatio),
        price: p.marketPriceKgCanalCOP > 0 ? String(p.marketPriceKgCanalCOP) : null,
        eggPrice: p.marketPriceEggUnitCOP != null ? String(p.marketPriceEggUnitCOP) : null,
        expectedEggsPerHen: p.eggsPerDayPerFemale != null ? String(p.eggsPerDayPerFemale) : null,
        systemType: p.systemType,
        description: p.notes,
        sortOrder: nextOrder++,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ id: catalogos.id });
    if (inserted) added += 1;
  }
  return added;
}

async function ensureMasterCatalogs(): Promise<number> {
  let added = 0;
  for (const item of MASTER_CATALOG_DEFS) {
    const [inserted] = await db
      .insert(catalogos)
      .values({
        farmId: DEFAULT_FARM_ID,
        category: item.category,
        value: item.value,
        description: item.description ?? null,
        tipo: item.tipo ?? null,
        price: item.price ?? null,
        units: item.units ?? null,
        minWeeks: item.minWeeks ?? null,
        maxWeeks: item.maxWeeks ?? null,
        expectedEggsPerHen: item.expectedEggsPerHen ?? null,
        sortOrder: item.sortOrder,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ id: catalogos.id });
    if (inserted) added += 1;
  }
  return added;
}

async function ensureBreedWeightStandards(): Promise<number> {
  const existingMissingSpecies = await db
    .select({ id: breedWeightStandards.id, breed: breedWeightStandards.breed })
    .from(breedWeightStandards)
    .where(isNull(breedWeightStandards.species));

  for (const row of existingMissingSpecies) {
    await db
      .update(breedWeightStandards)
      .set({ species: inferSpeciesForBreed(row.breed) })
      .where(eq(breedWeightStandards.id, row.id));
  }

  let added = 0;
  for (const def of ALL_BREED_STANDARD_DEFS) {
    const rows = def.points.map((p) => ({
      species: def.species,
      breed: def.breed,
      gender: def.gender,
      weekNumber: p.week,
      targetWeightG: String(p.targetG),
      minWeightG: p.minG != null ? String(p.minG) : null,
      maxWeightG: p.maxG != null ? String(p.maxG) : null,
    }));
    const inserted = await db
      .insert(breedWeightStandards)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: breedWeightStandards.id });
    added += inserted.length;
  }
  return added;
}

const DEFAULT_STAGE_MANURE_FACTORS: Record<string, string> = {
  Pollito: "0.050",
  Juvenil: "0.080",
  "Pre-postura": "0.110",
  Postura: "0.130",
};

async function ensureDefaultManureFactors(): Promise<number> {
  const existingGlobals = await db
    .select({ birdGroup: manureFactors.birdGroup })
    .from(manureFactors)
    .where(and(eq(manureFactors.farmId, DEFAULT_FARM_ID), isNull(manureFactors.stageCatalogoId)));

  const globalSet = new Set(existingGlobals.map((row) => row.birdGroup));
  let added = 0;

  for (const [birdGroup, kg] of [
    ["gallo", "0.150"],
    ["lote", "0.100"],
  ] as const) {
    if (globalSet.has(birdGroup)) continue;
    const [inserted] = await db
      .insert(manureFactors)
      .values({
        farmId: DEFAULT_FARM_ID,
        stageCatalogoId: null,
        birdGroup,
        kgPerBirdPerDay: kg,
      })
      .onConflictDoNothing()
      .returning({ id: manureFactors.id });
    if (inserted) added += 1;
  }

  const baseStages = await db
    .select({ id: catalogos.id, value: catalogos.value })
    .from(catalogos)
    .where(and(eq(catalogos.farmId, DEFAULT_FARM_ID), eq(catalogos.category, "etapa_crecimiento")));

  for (const stage of baseStages) {
    const defaultKg = DEFAULT_STAGE_MANURE_FACTORS[stage.value];
    if (!defaultKg) continue;
    const [inserted] = await db
      .insert(manureFactors)
      .values({
        farmId: DEFAULT_FARM_ID,
        stageCatalogoId: stage.id,
        birdGroup: "etapa",
        kgPerBirdPerDay: defaultKg,
      })
      .onConflictDoNothing()
      .returning({ id: manureFactors.id });
    if (inserted) added += 1;
  }

  return added;
}

export interface CoreSeedOptions {
  includeStarterFeeding?: boolean;
}

export interface CoreSeedResult {
  settingsCreated: number;
  speciesParamsAdded: number;
  vaccinationTemplatesCreated: number;
  statusesAdded: number;
  breedsAdded: number;
  breedsAssociated: number;
  masterCatalogsAdded: number;
  weightStandardsAdded: number;
  manureFactorsAdded: number;
  contactsMigrated: number;
  starterFeeding: StarterSeedSummary | null;
}

export async function runCoreSeed(options: CoreSeedOptions = {}): Promise<CoreSeedResult> {
  const includeStarterFeeding = options.includeStarterFeeding ?? true;

  await ensureDefaultFarmAndSubscription();

  return await runWithFarmContext(DEFAULT_FARM_ID, async () => {
    const settingsRows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({
      farmId: DEFAULT_FARM_ID,
      key,
      value,
    }));

    const insertedSettings = settingsRows.length
      ? await db.insert(appSettings).values(settingsRows).onConflictDoNothing().returning({ key: appSettings.key })
      : [];

    const templateRows = Object.entries(VACCINATION_SCHEDULES).flatMap(([breed, events]) =>
      events.map((event) => ({
        species: VACCINATION_SCHEDULE_SPECIES[breed] || BREED_SPECIES[breed] || "gallina",
        breed,
        weekNumber: event.weekNumber,
        name: event.name,
        description: event.description,
        type: event.type,
        frequencyDays: event.frequencyDays,
        isActive: true,
      })),
    );

    const insertedTemplates = templateRows.length
      ? await db
          .insert(vaccinationTemplates)
          .values(templateRows)
          .onConflictDoNothing()
          .returning({ id: vaccinationTemplates.id })
      : [];

    const statusesAdded = await ensureHenStatuses();
    const animalBreeds = await ensureAnimalBreeds();
    const speciesParamsAdded = await ensureSpeciesParams();
    const masterCatalogsAdded = await ensureMasterCatalogs();
    const weightStandardsAdded = await ensureBreedWeightStandards();
    const manureFactorsAdded = await ensureDefaultManureFactors();
    const starterFeeding = includeStarterFeeding
      ? await seedStarterFeedsAndPrograms(DEFAULT_FARM_ID)
      : null;
    const contactsMigrated = await syncLegacyCatalogContacts();

    const normativePayload = JSON.stringify({
      version: NORMATIVE_PACK_VERSION,
      updatedAt: new Date().toISOString(),
      standards: [
        "NTC 1240",
        "ICA Res. 3650-3652/2014",
        "MADR Res. 205/2022",
        "ICA Res. 8452/2025",
        "ICA Res. 30292/2017",
      ],
    });

    await db
      .insert(appSettings)
      .values({
        farmId: DEFAULT_FARM_ID,
        key: "normative.pack_version",
        value: normativePayload,
      })
      .onConflictDoUpdate({
        target: [appSettings.farmId, appSettings.key],
        set: {
          value: normativePayload,
          updatedAt: new Date(),
        },
      });

    return {
      settingsCreated: insertedSettings.length,
      speciesParamsAdded,
      vaccinationTemplatesCreated: insertedTemplates.length,
      statusesAdded,
      breedsAdded: animalBreeds.added,
      breedsAssociated: animalBreeds.associated,
      masterCatalogsAdded,
      weightStandardsAdded,
      manureFactorsAdded,
      contactsMigrated,
      starterFeeding,
    };
  });
}

const isSeedCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  path.basename(process.argv[1] || "") === "seed-config.ts";

if (isSeedCli) {
  runCoreSeed()
    .then((res) => {
      console.log(`Parámetros globales creados: ${res.settingsCreated}.`);
      console.log(`Parámetros por especie agregados: ${res.speciesParamsAdded}.`);
      console.log(`Plantillas de vacunación creadas: ${res.vaccinationTemplatesCreated}.`);
      console.log(`Estados de gallina agregados: ${res.statusesAdded}.`);
      console.log(`Razas agregadas: ${res.breedsAdded}, asociadas: ${res.breedsAssociated}.`);
      console.log(`Catálogos maestros agregados: ${res.masterCatalogsAdded}.`);
      console.log(`Estándares de peso agregados: ${res.weightStandardsAdded}.`);
      console.log(`Factores base de gallinaza agregados: ${res.manureFactorsAdded}.`);
      if (res.starterFeeding) {
        console.log(
          `Planes iniciales de alimentación: ${res.starterFeeding.createdFeeds} alimentos, ${res.starterFeeding.createdStages} etapas, ${res.starterFeeding.createdPrograms} programas.`,
        );
      }
      console.log(`Contactos migrados desde catálogos: ${res.contactsMigrated}.`);
      console.log(`Paquete normativo ICA/NTC: ${NORMATIVE_PACK_VERSION}.`);
    })
    .catch((error) => {
      console.error("Error sembrando configuración:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
