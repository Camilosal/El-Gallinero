import { InternalApiClient, InternalApiError } from "./internal-api";
import { normalizeSpecies, speciesLabel } from "@/lib/species-db";
import { isBatchPresent, isHenPresent, isRoosterPresent } from "@/lib/animal-status";
import type { LlmToolDefinition } from "./llm";
import { searchFarmKnowledge } from "./knowledge";
import { jevRerankCandidates } from "./jev-routing";

/**
 * Herramientas del asistente.
 *
 * - Lecturas: se ejecutan de inmediato.
 * - Escrituras de bajo riesgo (producción, mortalidad, peso, consumo,
 *   autoconsumo, sensores, reproducción, incubación, bioseguridad, compostaje,
 *   control sanitario, rutinas diarias y contactos): se ejecutan automáticamente.
 * - Ventas, gastos, ingresos, prorrateos y cierres diarios: quedan pendientes de confirmación humana.
 *
 * Ninguna herramienta recibe SQL. Todas reutilizan endpoints existentes.
 */

export interface ToolContext {
  api: InternalApiClient;
  userId: string;
  userName: string;
  conversationId?: string;
}

export interface PreparedWrite {
  args: Record<string, unknown>;
  summary: string;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  kind: "read" | "write";
  requiresConfirmation: boolean;
  prepare?: (args: Record<string, any>, ctx: ToolContext) => Promise<PreparedWrite>;
  execute: (args: Record<string, any>, ctx: ToolContext) => Promise<unknown>;
}

// ─── Utilidades ───

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatCop(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CO")} COP`;
}

function formatDateEs(iso: string): string {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

function asNumber(value: unknown, field: string, options?: { min?: number; integer?: boolean }): number {
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error(`El campo "${field}" debe ser numérico`);
  if (options?.integer && !Number.isInteger(num)) throw new Error(`El campo "${field}" debe ser un entero`);
  if (options?.min !== undefined && num < options.min) {
    throw new Error(`El campo "${field}" debe ser mayor o igual a ${options.min}`);
  }
  return num;
}

function normalizeDate(value: unknown): string {
  if (value === undefined || value === null || value === "") return todayISO();
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("La fecha debe tener el formato AAAA-MM-DD");
  }
  return text;
}

function truncate(value: unknown, maxLength = 12_000): unknown {
  if (value === undefined) return null;
  const text = JSON.stringify(value);
  if (!text || text.length <= maxLength) return value;
  if (Array.isArray(value)) {
    return { nota: "Resultado truncado por tamaño", total: value.length, items: value.slice(0, 40) };
  }
  if (typeof value === "object" && value !== null) {
    return { nota: "Resultado truncado por tamaño", resumen: text.slice(0, maxLength - 200) };
  }
  return text.slice(0, maxLength);
}

function sortBy<T>(rows: T[], selector: (row: T) => string): T[] {
  return [...rows].sort((a, b) => selector(a).localeCompare(selector(b)));
}

/** Mapea texto libre a los valores del enum mortality_cause de PostgreSQL. */
function normalizeMortalityCause(value: string): string {
  const text = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!text) return "otro";
  if (/(enferm|infecc|respirat|diarrea|parasit|viru|bacter|gripe|newcastle|coriza)/.test(text)) return "enfermedad";
  if (/(depred|zorro|zarigue|gavilan|perro|gato|serpiente|rata|comadreja)/.test(text)) return "depredador";
  if (/(accident|golpe|caida|atropell|ahog|electro)/.test(text)) return "accidente";
  if (/(sacrificio|sanitari|eutanasia)/.test(text)) return "sacrificio_sanitario";
  if (/(natural|vejez|viejo|edad)/.test(text)) return "causa_natural";
  return "otro";
}

// ─── Normalización de lecturas ───

interface HenRow {
  id: string;
  code: string;
  locationId?: string | null;
  breed?: string | null;
  birthDate?: string | null;
  status: string;
  weight?: string | number | null;
  ageWeeks?: number | null;
}

interface RoosterRow {
  id: string;
  code: string;
  locationId?: string | null;
  breed?: string | null;
  birthDate?: string | null;
  status: string;
  weight?: string | number | null;
  ageWeeks?: number | null;
}

interface BatchRow {
  id: string;
  code: string;
  species: string;
  purpose?: string | null;
  locationId?: string | null;
  breed?: string | null;
  startDate?: string | null;
  currentQuantity: number;
  targetWeightKg?: string | number | null;
  avgWeightKg?: string | number | null;
  status: string;
  ageWeeks?: number | null;
  readinessReasons?: string[];
}

async function loadHens(ctx: ToolContext): Promise<HenRow[]> {
  return asArray<HenRow>(await ctx.api.get("/api/produccion/gallinas"));
}

async function loadRoosters(ctx: ToolContext): Promise<RoosterRow[]> {
  return asArray<RoosterRow>(await ctx.api.get("/api/produccion/gallos"));
}

async function loadBatches(ctx: ToolContext): Promise<BatchRow[]> {
  return asArray<BatchRow>(await ctx.api.get("/api/produccion/pollos"));
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as any).data)) {
    return (value as any).data as T[];
  }
  return [];
}

interface FarmLocationRow {
  id: string;
  name: string;
  status?: string;
  operationalStatus?: string;
  sanitaryStatus?: string;
  [key: string]: unknown;
}

function normalizeLookup(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-CO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

async function loadFarmLocations(ctx: ToolContext): Promise<FarmLocationRow[]> {
  return asArray<FarmLocationRow>(await ctx.api.get("/api/ubicaciones?active=true"));
}

/** Resuelve por nombre o usa el lugar actual del registro; si hay ambigüedad, pide el nombre. */
async function resolveFarmLocation(
  ctx: ToolContext,
  requestedName?: unknown,
  preferredId?: string | null,
): Promise<FarmLocationRow> {
  const locations = await loadFarmLocations(ctx);
  let selected: FarmLocationRow | undefined;
  const requested = normalizeLookup(requestedName);

  if (requested) {
    const exact = locations.filter((location) => normalizeLookup(location.name) === requested);
    const matches = exact.length > 0
      ? exact
      : locations.filter((location) => normalizeLookup(location.name).includes(requested));
    if (matches.length === 0) {
      throw new Error(`No encontré un lugar activo llamado "${String(requestedName).trim()}". Lugares disponibles: ${locations.map((item) => item.name).join(", ") || "ninguno"}`);
    }
    if (matches.length > 1) {
      throw new Error(`El nombre "${String(requestedName).trim()}" coincide con varios lugares: ${matches.map((item) => item.name).join(", ")}. Indica el nombre completo.`);
    }
    selected = matches[0];
    if (preferredId && selected.id !== preferredId) {
      const current = locations.find((location) => location.id === preferredId);
      throw new Error(`El registro corresponde a ${current?.name || "otro lugar"}. Indica ese lugar o corrige primero el alojamiento actual.`);
    }
  } else if (preferredId) {
    selected = locations.find((location) => location.id === preferredId);
    if (!selected) throw new Error("El lugar actual del animal no está activo. Indica el lugar real del registro.");
  } else if (locations.length === 1) {
    selected = locations[0];
  } else if (locations.length === 0) {
    throw new Error("Primero crea un lugar de manejo en Animales → Lugares de manejo.");
  } else {
    throw new Error(`Indica el lugar donde ocurrió el registro. Lugares activos: ${locations.map((item) => item.name).join(", ")}.`);
  }

  if (!selected || selected.status === "inactiva") throw new Error("El lugar debe estar activo para registrar esta operación.");
  if (["restringida", "fuera_servicio"].includes(String(selected.operationalStatus))) {
    throw new Error(`${selected.name} está restringido o fuera de servicio y no admite este registro.`);
  }
  return selected;
}

function activeHens(rows: HenRow[]): HenRow[] {
  return rows.filter((row) => isHenPresent(row.status));
}

function activeRoosters(rows: RoosterRow[]): RoosterRow[] {
  return rows.filter((row) => isRoosterPresent(row.status));
}

function activeBatches(rows: BatchRow[]): BatchRow[] {
  return rows.filter((row) => isBatchPresent(row.status, row.currentQuantity));
}

function findByIdOrCode<T extends { id: string; code: string }>(rows: T[], value?: string | null): T | undefined {
  if (!value) return undefined;
  const needle = String(value).trim().toLowerCase();
  return rows.find((row) => row.id === value || String(row.code || "").toLowerCase() === needle);
}

// ─── Herramientas de lectura ───

const consultarResumenGranja: AgentTool = {
  name: "consultar_resumen_granja",
  description:
    "Devuelve el panorama general de la granja: animales activos por especie, gallinas, gallos, huevos disponibles, " +
    "producción esperada, finanzas del mes, mortalidad y alertas. Úsala para preguntas como '¿cómo está la granja?'.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  kind: "read",
  requiresConfirmation: false,
  async execute(_args, ctx) {
    const data = await ctx.api.get<any>("/api/dashboard");
    return {
      fecha: todayISO(),
      animales: {
        total: data.totalAnimals ?? data.animals?.totalAnimals ?? 0,
        aves: data.totalBirds ?? data.animals?.totalBirds ?? 0,
        noAves: data.animals?.totalNonBirds ?? 0,
        desglosePorEspecie: data.species ?? [],
      },
      gallinas: data.hens
        ? {
            total: data.hens.total,
            activas: data.hens.active,
            enPostura: data.hens.laying ?? 0,
            empollando: data.hens.broody,
            enfermas: data.hens.sick,
            recomendadasSacrificio: data.hens.recommendedForSlaughter,
          }
        : null,
      gallos: data.roosters ?? null,
      huevos: data.eggs ?? null,
      produccionEsperadaHoy: data.totalExpectedEggsPerDay ?? null,
      finanzas: data.finance ?? null,
      mortalidad: data.mortality ?? null,
      lotesListos: data.readyBatches ?? 0,
      alertas: {
        alimentosBajos: data.feedAlerts ?? 0,
        sanidad: data.sanitaryAlerts ?? 0,
        insumosBajos: data.supplyAlerts ?? 0,
        mantenimiento: data.pendingMaintenance ?? 0,
      },
    };
  },
};

const consultarInventario: AgentTool = {
  name: "consultar_inventario",
  description:
    "Consulta el inventario de animales (gallinas, gallos, pollos, codornices, patos, conejos y cuyes), huevos disponibles, " +
    "valor del inventario y alertas de stock. La unidad es 'animal'; 'aves' excluye conejos y cuyes.",
  parameters: {
    type: "object",
    properties: {
      incluir_huevos: {
        type: "boolean",
        description: "Si es true, incluye huevos disponibles y valoración. Por defecto true.",
      },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const includeEggs = args.incluir_huevos !== false;
    const animals = await ctx.api.get<any>("/api/inventarios/animales");
    const result: Record<string, unknown> = {
      resumenAnimales: animals.summary,
      especies: animals.species,
      grupos: (animals.groups || []).map((g: any) => ({
        grupo: g.label,
        especie: g.species,
        cantidad: g.count,
        pesoPromedioKg: g.avgWeightKg,
        pesoTotalKg: g.totalWeightKg,
        valorEstimado: g.estimatedValue,
        detalle: g.detail,
      })),
      porProposito: animals.byPurpose,
    };

    if (includeEggs) {
      const consolidated = await ctx.api.get<any>("/api/inventarios/huevos/consolidado?days=30");
      result.huevos = {
        disponibles: consolidated.summary?.totalEggsAvailable ?? 0,
        porTamano: consolidated.eggs ?? [],
      };
      result.valorInventario = {
        total: consolidated.summary?.totalValue ?? 0,
        alimentos: consolidated.summary?.foodValue ?? 0,
        aves: consolidated.summary?.birdsValue ?? 0,
        huevos: consolidated.summary?.eggValue ?? 0,
        gallinaza: consolidated.summary?.manureValue ?? 0,
        insumos: consolidated.summary?.suppliesValue ?? 0,
        carne: consolidated.summary?.meatValue ?? 0,
      };
      result.alertas = {
        alimentosBajos: consolidated.summary?.lowStockFeeds ?? 0,
        insumosBajos: consolidated.summary?.lowStockSupplies ?? 0,
        alimentos: (consolidated.foods || [])
          .filter((f: any) => f.isLow)
          .map((f: any) => ({ nombre: f.name, stock: f.currentStock, unidad: f.unit, minimo: f.minStock })),
      };
    }

    return result;
  },
};

const consultarAves: AgentTool = {
  name: "consultar_aves",
  description:
    "Lista animales individuales y lotes con su id, código, especie, estado, edad y peso. Úsala antes de registrar " +
    "mortalidad, ventas o pesos cuando necesites identificar un animal o lote específico.",
  parameters: {
    type: "object",
    properties: {
      especie: {
        type: "string",
        description: "Filtra por especie: gallina, gallo, pollo, codorniz, pato, conejo o cuy.",
      },
      solo_activas: {
        type: "boolean",
        description: "Si es true (por defecto), excluye animales vendidos, faenados o muertos.",
      },
      lugar: { type: "string", description: "Filtra por nombre del lugar de manejo. Opcional." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const onlyActive = args.solo_activas !== false;
    const rawSpecies = String(args.especie || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const wantsRoosters = rawSpecies.startsWith("gallo");
    const requested = args.especie && !wantsRoosters ? normalizeSpecies(rawSpecies) : null;

    const [hensRaw, roostersRaw, batchesRaw, locationRows] = await Promise.all([
      loadHens(ctx),
      loadRoosters(ctx),
      loadBatches(ctx),
      ctx.api.get<any>("/api/ubicaciones"),
    ]);
    const places = asArray<any>(locationRows);
    const placeNameById = new Map(places.map((place) => [place.id, place.name]));

    const hens = (onlyActive ? activeHens(hensRaw) : hensRaw).map((hen) => ({
      id: hen.id,
      codigo: hen.code,
      especie: "gallina",
      sexo: "hembra",
      raza: hen.breed || null,
      estado: hen.status,
      edadSemanas: hen.ageWeeks ?? null,
      pesoKg: hen.weight != null ? Number(hen.weight) : null,
      lugarId: hen.locationId || null,
      lugar: hen.locationId ? placeNameById.get(hen.locationId) || null : null,
    }));

    const roosters = (onlyActive ? activeRoosters(roostersRaw) : roostersRaw).map((rooster) => ({
      id: rooster.id,
      codigo: rooster.code,
      especie: "gallo",
      sexo: "macho",
      raza: rooster.breed || null,
      estado: rooster.status,
      edadSemanas: rooster.ageWeeks ?? null,
      pesoKg: rooster.weight != null ? Number(rooster.weight) : null,
      lugarId: rooster.locationId || null,
      lugar: rooster.locationId ? placeNameById.get(rooster.locationId) || null : null,
    }));

    const batches = (onlyActive ? activeBatches(batchesRaw) : batchesRaw).map((batch) => ({
      id: batch.id,
      codigo: batch.code,
      especie: batch.species,
      tipo: "lote",
      raza: batch.breed || null,
      estado: batch.status,
      cantidadActual: batch.currentQuantity,
      pesoPromedioKg: batch.avgWeightKg != null ? Number(batch.avgWeightKg) : null,
      pesoObjetivoKg: batch.targetWeightKg != null ? Number(batch.targetWeightKg) : null,
      edadSemanas: batch.ageWeeks ?? null,
      proposito: batch.purpose || null,
      lugarId: batch.locationId || null,
      lugar: batch.locationId ? placeNameById.get(batch.locationId) || null : null,
    }));

    let animals = [...hens, ...roosters, ...batches];
    if (wantsRoosters) {
      animals = animals.filter((row) => row.especie === "gallo");
    } else if (requested) {
      animals = animals.filter((row) => row.especie === requested);
    }
    const requestedLocation = normalizeLookup(args.lugar);
    if (requestedLocation) {
      const exact = places.filter((place) => normalizeLookup(place.name) === requestedLocation);
      const matches = exact.length > 0 ? exact : places.filter((place) => normalizeLookup(place.name).includes(requestedLocation));
      if (matches.length === 0) throw new Error(`No encontré el lugar "${String(args.lugar).trim()}".`);
      if (matches.length > 1) throw new Error(`El lugar coincide con varios nombres: ${matches.map((place) => place.name).join(", ")}. Indica el nombre completo.`);
      animals = animals.filter((animal) => animal.lugarId === matches[0].id);
    }

    return {
      total: animals.length,
      animales: animals.slice(0, 100),
      nota:
        animals.length > 100
          ? "Se muestran los primeros 100 animales. Filtra por especie para ver menos."
          : undefined,
    };
  },
};

const consultarUbicaciones: AgentTool = {
  name: "consultar_ubicaciones",
  description:
    "Consulta la ficha y el desempeño por lugar de manejo: ocupación, especies, huevos, carne, pesajes, bajas, consumo, sanidad y mantenimiento. Los indicadores operativos resumidos son de los últimos 30 días salvo que se indique el período disponible.",
  parameters: {
    type: "object",
    properties: {
      lugar: { type: "string", description: "Nombre o parte inequívoca del nombre del corral, jaula, galpón, potrero, jardín o patio. Opcional." },
      periodo_dias: { type: "integer", description: "Período para los indicadores resumidos, entre 1 y 365 días. Por defecto 30.", minimum: 1, maximum: 365 },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const days = args.periodo_dias ? asNumber(args.periodo_dias, "periodo_dias", { min: 1, integer: true }) : 30;
    if (days > 365) throw new Error("El período máximo para consultar lugares es 365 días.");
    const locations = asArray<any>(await ctx.api.get(`/api/ubicaciones?period=${days}`));
    const requested = normalizeLookup(args.lugar);
    let matches = locations;
    if (requested) {
      const exact = locations.filter((place) => normalizeLookup(place.name) === requested);
      matches = exact.length > 0 ? exact : locations.filter((place) => normalizeLookup(place.name).includes(requested));
      if (matches.length === 0) throw new Error(`No encontré el lugar "${String(args.lugar).trim()}". Lugares disponibles: ${locations.map((place) => place.name).join(", ") || "ninguno"}`);
      if (matches.length > 1) throw new Error(`El nombre coincide con varios lugares: ${matches.map((place) => place.name).join(", ")}. Indica el nombre completo.`);
    }
    return {
      periodoDias: days,
      totalLugares: matches.length,
      lugares: matches.slice(0, 50).map((place: any) => ({
        codigo: place.code,
        nombre: place.name,
        tipo: place.type,
        lugarSuperior: place.parentName || null,
        estado: place.status,
        estadoOperativo: place.operationalStatus,
        estadoSanitario: place.sanitaryStatus,
        especificacionesSanitarias: place.sanitaryRequirements || null,
        ultimaRevisionSanitaria: place.sanitaryReviewedAt || null,
        ultimaRevisionOperativa: place.operationalReviewedAt || null,
        referenciaLocal: place.localReference || null,
        coordenadas: place.latitude && place.longitude ? { latitud: place.latitude, longitud: place.longitude } : null,
        areaM2: place.areaM2 || null,
        animales: place.animals || 0,
        capacidad: place.capacity ?? null,
        especies: place.speciesCounts || [],
        huevos: place.eggsPeriod || 0,
        huevosPorEspecie: place.eggsBySpeciesPeriod || [],
        carneKg: Number(place.meatProducedKgPeriod || 0),
        carnePorEspecie: place.meatBySpeciesPeriod || [],
        pesajes: place.weightSamplesPeriod || 0,
        pesoPromedioPorEspecie: place.averageWeightBySpeciesPeriod || [],
        bajas: place.deathsPeriod || 0,
        consumoAlimento: place.feedConsumptionLabel || "Sin registros",
        controlesSanitarios: place.healthControlsPeriod || 0,
        tareasMantenimientoPendientes: place.pendingMaintenance || 0,
        necesidadesMantenimiento: place.maintenanceNeeds || null,
        costoMantenimientoCompletado: Number(place.maintenanceCost || 0),
      })),
      nota: "El estado sanitario y operativo refleja lo que registró la finca; no constituye una certificación automática.",
    };
  },
};

const consultarTrazabilidadGenetica: AgentTool = {
  name: "consultar_trazabilidad_genetica",
  description:
    "Consulta procedencia y trazabilidad genética desde adquisiciones o cría propia: línea, generación, finca y lugar de origen, lote de origen, progenitores, lugar de destino y referencia documental. Busca por código de animal/lote o línea genética.",
  parameters: {
    type: "object",
    properties: {
      codigo: { type: "string", description: "Código de animal o lote, código de progenitor o código de lote de origen." },
      linea_genetica: { type: "string", description: "Nombre o parte de una línea genética." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const acquisitions = asArray<any>(await ctx.api.get("/api/produccion/adquisiciones"));
    const code = normalizeLookup(args.codigo);
    const line = normalizeLookup(args.linea_genetica);
    if (!code && !line) {
      return { registros: [], nota: "Indica un código de animal o lote, o una línea genética para consultar su trazabilidad." };
    }
    const matches = acquisitions.filter((row) => {
      const codeMatch = !code || [
        ...(Array.isArray(row.registeredCodes) ? row.registeredCodes : []),
        row.sourceBatchCode,
        row.motherIdentifier,
        row.fatherIdentifier,
      ].some((value) => normalizeLookup(value) === code);
      const lineMatch = !line || normalizeLookup(row.geneticLine).includes(line);
      return codeMatch && lineMatch;
    });
    return {
      total: matches.length,
      registros: matches.slice(0, 40).map((row) => ({
        fecha: row.date,
        ingreso: row.acquisitionType,
        especie: row.species,
        tipoAnimal: row.birdType,
        cantidad: row.quantity,
        codigosRegistrados: row.registeredCodes || [],
        razaDeclarada: row.breed || null,
        lineaGenetica: row.geneticLine || null,
        generacion: row.generation || null,
        fincaDeOrigen: row.originFarm || null,
        lugarDeOrigen: row.originLocation || null,
        loteDeOrigen: row.sourceBatchCode || null,
        madre: row.motherIdentifier || null,
        padre: row.fatherIdentifier || null,
        lugarDeDestino: row.destinationLocationName || null,
        evidenciaGenetica: row.geneticEvidenceReference || null,
        evidenciaSanitaria: row.healthEvidenceReference || null,
        parentescoConCodigo: code
          ? (Array.isArray(row.registeredCodes) && row.registeredCodes.some((value: string) => normalizeLookup(value) === code)
            ? "registro del animal o lote"
            : normalizeLookup(row.motherIdentifier) === code
              ? "descendencia registrada por línea materna"
              : normalizeLookup(row.fatherIdentifier) === code
                ? "descendencia registrada por línea paterna"
                : normalizeLookup(row.sourceBatchCode) === code
                  ? "lote de origen"
                  : "coincidencia")
          : undefined,
      })),
      nota: "La app consulta los datos y referencias que ingresó la finca; no autentica certificados ni confirma pureza genética.",
    };
  },
};

const consultarMantenimiento: AgentTool = {
  name: "consultar_mantenimiento",
  description:
    "Consulta tareas de mantenimiento por estado, lugar y equipo asociado. Sirve para revisar vencimientos, repeticiones programadas, costos e historial.",
  parameters: {
    type: "object",
    properties: {
      lugar: { type: "string", description: "Nombre del lugar asociado. Opcional." },
      solo_pendientes: { type: "boolean", description: "Por defecto true; si es false incluye tareas completadas." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const tasks = asArray<any>(await ctx.api.get("/api/operaciones/mantenimiento"));
    const requested = normalizeLookup(args.lugar);
    let filtered = tasks;
    if (requested) {
      const exact = tasks.filter((task) => normalizeLookup(task.locationName) === requested);
      filtered = exact.length > 0 ? exact : tasks.filter((task) => normalizeLookup(task.locationName).includes(requested));
      if (filtered.length === 0) throw new Error(`No encontré tareas asociadas al lugar "${String(args.lugar).trim()}".`);
      if (filtered.length > 1) {
        const names = [...new Set(filtered.map((task) => String(task.locationName || "General de la finca")))];
        if (names.length > 1) throw new Error(`El nombre coincide con varios lugares: ${names.join(", ")}. Indica el nombre completo.`);
      }
    }
    if (args.solo_pendientes !== false) filtered = filtered.filter((task) => task.status !== "completado");
    return {
      total: filtered.length,
      tareas: filtered.slice(0, 100).map((task) => ({
        titulo: task.title,
        descripcion: task.description || null,
        equipo: task.assetName ? `${task.assetName}${task.assetCode ? ` (${task.assetCode})` : ""}` : null,
        lugar: task.locationName || "General de la finca",
        estado: task.status,
        fechaProgramada: task.scheduledDate,
        fechaCompletada: task.completedDate || null,
        repetirCadaDias: task.recurrenceIntervalDays || null,
        costoCOP: Number(task.cost || 0),
      })),
    };
  },
};

const consultarActivos: AgentTool = {
  name: "consultar_activos",
  description: "Consulta equipos, herramientas e infraestructura por código, nombre, serie, lugar o estado. Incluye ubicación, garantía, costo registrado y estado operativo.",
  parameters: {
    type: "object",
    properties: {
      buscar: { type: "string", description: "Código, nombre, marca, modelo o número de serie. Opcional." },
      lugar: { type: "string", description: "Nombre del lugar asociado. Opcional." },
      estado: { type: "string", description: "operativo, requiere_mantenimiento, fuera_servicio o retirado. Opcional." },
      incluir_retirados: { type: "boolean", description: "Por defecto false; si es true incluye activos retirados con historial." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const assets = asArray<any>(await ctx.api.get("/api/operaciones/activos"));
    const requested = normalizeLookup(args.buscar);
    const place = normalizeLookup(args.lugar);
    const status = normalizeLookup(args.estado);
    const filtered = assets.filter((asset) => {
      if (args.incluir_retirados !== true && asset.status === "retirado") return false;
      if (status && normalizeLookup(asset.status) !== status) return false;
      if (place && !normalizeLookup(asset.locationName).includes(place)) return false;
      if (requested && ![
        asset.code, asset.name, asset.brand, asset.model, asset.serialNumber,
      ].some((value) => normalizeLookup(value).includes(requested))) return false;
      return true;
    });
    return {
      total: filtered.length,
      activos: filtered.slice(0, 100).map((asset) => ({
        codigo: asset.code,
        nombre: asset.name,
        tipo: asset.category,
        marca: asset.brand || null,
        modelo: asset.model || null,
        serie: asset.serialNumber || null,
        lugar: asset.locationName || "Finca / sin lugar específico",
        estado: asset.status,
        fechaAdquisicion: asset.acquisitionDate || null,
        garantiaHasta: asset.warrantyUntil || null,
        costoRegistradoCOP: Number(asset.acquisitionCost || 0),
        descripcion: asset.description || null,
      })),
      nota: "El costo corresponde al valor registrado por la finca; no representa depreciación ni avalúo contable.",
    };
  },
};

const consultarProduccion: AgentTool = {
  name: "consultar_produccion",
  description:
    "Consulta los registros recientes de producción de huevos por especie, con totales, tamaños y autoconsumo.",
  parameters: {
    type: "object",
    properties: {
      especie: { type: "string", description: "gallina, codorniz, pato, etc. Opcional." },
      lugar: { type: "string", description: "Nombre del lugar de manejo. Opcional; filtra la producción registrada allí." },
      dias: { type: "integer", description: "Días hacia atrás. Por defecto 14.", minimum: 1, maximum: 365 },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const days = args.dias ? asNumber(args.dias, "dias", { min: 1, integer: true }) : 14;
    const speciesParam = args.especie ? normalizeSpecies(String(args.especie)) : null;
    const path = speciesParam
      ? `/api/produccion/huevos?species=${encodeURIComponent(speciesParam)}`
      : "/api/produccion/huevos";

    const rows = asArray<any>(await ctx.api.get(path));
    let selectedLocation: any | null = null;
    const requestedLocation = normalizeLookup(args.lugar);
    if (requestedLocation) {
      const locations = asArray<any>(await ctx.api.get("/api/ubicaciones"));
      const exact = locations.filter((place) => normalizeLookup(place.name) === requestedLocation);
      const matches = exact.length > 0 ? exact : locations.filter((place) => normalizeLookup(place.name).includes(requestedLocation));
      if (matches.length === 0) throw new Error(`No encontré el lugar "${String(args.lugar).trim()}".`);
      if (matches.length > 1) throw new Error(`El lugar coincide con varios nombres: ${matches.map((place) => place.name).join(", ")}. Indica el nombre completo.`);
      selectedLocation = matches[0];
    }
    const cutoff = new Date(`${todayISO()}T12:00:00`);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const filtered = rows.filter((row) =>
      String(row.date) >= cutoffStr && (!selectedLocation || row.locationId === selectedLocation.id),
    );
    const bySize = new Map<string, number>();
    let totalCollected = 0;
    let broken = 0;
    let discarded = 0;
    let forIncubation = 0;
    let autoconsumo = 0;

    for (const row of filtered) {
      totalCollected += Number(row.totalCollected || 0);
      broken += Number(row.broken || 0);
      discarded += Number(row.discarded || 0);
      forIncubation += Number(row.forIncubation || 0);
      autoconsumo += Number(row.quantityAutoconsumo || 0);
      for (const detail of row.details || []) {
        bySize.set(detail.size, (bySize.get(detail.size) || 0) + Number(detail.quantity || 0));
      }
    }

    return {
      periodoDias: days,
      especie: speciesParam || "todas",
      lugar: selectedLocation?.name || "todos",
      registros: filtered.length,
      totalRecolectado: totalCollected,
      roto: broken,
      descartados: discarded,
      paraIncubacion: forIncubation,
      autoconsumo,
      porTamano: Array.from(bySize.entries()).map(([size, quantity]) => ({ tamano: size, cantidad: quantity })),
      ultimos: filtered.slice(0, 20).map((row) => ({
        fecha: row.date,
        especie: row.species,
        lugar: row.locationName || null,
        codigoLote: row.lotCode || null,
        total: row.totalCollected,
        roto: row.broken,
        descartados: row.discarded || 0,
        incubacion: row.forIncubation,
        autoconsumo: row.quantityAutoconsumo,
        temperaturaAlmacenC: row.storageTempC ?? null,
        humedadAlmacenPct: row.storageHumidityPct ?? null,
        alertasAlmacenamiento: row.storageWarnings || [],
        tamanos: row.details,
      })),
    };
  },
};

const consultarFinanzas: AgentTool = {
  name: "consultar_finanzas",
  description:
    "Consulta ingresos, egresos, utilidad, categorías y movimientos recientes del período indicado. Los montos están en COP.",
  parameters: {
    type: "object",
    properties: {
      periodo_dias: { type: "integer", description: "Días hacia atrás. Por defecto 30.", minimum: 1, maximum: 3650 },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const period = args.periodo_dias
      ? asNumber(args.periodo_dias, "periodo_dias", { min: 1, integer: true })
      : 30;
    const data = await ctx.api.get<any>(`/api/finanzas/finanzas?period=${period}`);
    return {
      periodoDias: period,
      resumen: data.summary,
      indicadores: data.kpis,
      porCategoria: data.byCategory,
      ultimosMovimientos: (data.transactions || []).slice(0, 20).map((t: any) => ({
        fecha: t.date,
        tipo: t.type,
        categoria: t.category,
        descripcion: t.description,
        monto: t.amount,
        contraparte: t.counterparty,
      })),
    };
  },
};

const consultarLotes: AgentTool = {
  name: "consultar_lotes",
  description:
    "Lista los lotes de producción (pollos, codornices, patos, conejos, cuyes) con especie, cantidad, edad, peso y estado de sacrificio.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  kind: "read",
  requiresConfirmation: false,
  async execute(_args, ctx) {
    const rows = await loadBatches(ctx);
    return {
      total: rows.length,
      lotes: rows.map((batch) => ({
        id: batch.id,
        codigo: batch.code,
        especie: batch.species,
        raza: batch.breed,
        proposito: batch.purpose,
        estado: batch.status,
        cantidadInicial: (batch as any).initialQuantity,
        cantidadActual: batch.currentQuantity,
        pesoPromedioKg: batch.avgWeightKg != null ? Number(batch.avgWeightKg) : null,
        pesoObjetivoKg: batch.targetWeightKg != null ? Number(batch.targetWeightKg) : null,
        edadSemanas: batch.ageWeeks ?? null,
        listoParaSacrificio: batch.status === "listo_sacrificio",
        motivos: batch.readinessReasons || [],
      })),
    };
  },
};

const consultarSanidad: AgentTool = {
  name: "consultar_sanidad",
  description:
    "Consulta el calendario sanitario (vacunaciones, desparasitaciones, vencidos o próximos) y, " +
    "si se indica incluir_controles=true, los últimos controles aplicados con lote de vacuna, cadena de frío y días de retiro.",
  parameters: {
    type: "object",
    properties: {
      solo_pendientes: { type: "boolean", description: "Si es true, excluye eventos ya aplicados. Por defecto true." },
      incluir_controles: { type: "boolean", description: "Si es true, incluye bitácora de controles sanitarios aplicados. Por defecto false." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const rows = asArray<any>(await ctx.api.get("/api/sanidad/calendario"));
    const pending = args.solo_pendientes === false ? rows : rows.filter((row) => row.isActive);
    const result: Record<string, unknown> = {
      total: pending.length,
      vencidos: pending.filter((row) => row.isOverdue).length,
      proximos7Dias: pending.filter((row) => row.isDueSoon).length,
      eventos: pending.slice(0, 40).map((row) => ({
        nombre: row.name,
        tipo: row.type,
        fecha: row.nextDueDate,
        diasRestantes: row.daysUntilDue,
        vencido: row.isOverdue,
        proximo: row.isDueSoon,
        avesObjetivo: row.targetBirds,
        descripcion: row.description,
      })),
    };
    if (args.incluir_controles === true) {
      const controls = asArray<any>(await ctx.api.get("/api/sanidad/control"));
      result.controlesRecientes = controls.slice(0, 20).map((c) => ({
        fecha: c.date,
        tipo: c.type,
        especie: c.species || "todas",
        lugar: c.locationName || null,
        descripcion: c.description,
        producto: c.product || null,
        loteVacuna: c.vaccineLot || null,
        vencimientoVacuna: c.vaccineExpiryDate || null,
        tempFrioC: c.coldChainTempC || null,
        finRetiro: c.withdrawalUntilDate || null,
        proximaFecha: c.nextScheduled || null,
      }));
    }
    return result;
  },
};

const consultarParametros: AgentTool = {
  name: "consultar_parametros",
  description:
    "Consulta los parámetros globales de cálculo y, si se pide, los parámetros productivos por especie y raza.",
  parameters: {
    type: "object",
    properties: {
      incluir_especies: { type: "boolean", description: "Incluye parámetros por especie. Por defecto false." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const settings = asArray<any>(await ctx.api.get("/api/configuracion/parametros"));
    const result: Record<string, unknown> = {
      parametros: settings.map((item) => ({
        clave: item.key,
        etiqueta: item.label,
        grupo: item.group,
        valor: item.value,
        unidad: item.unit,
        descripcion: item.description,
      })),
    };

    if (args.incluir_especies === true) {
      const species = asArray<any>(await ctx.api.get("/api/especies/params"));
      result.especies = species.map((item) => ({
        especie: item.species,
        raza: item.breed,
        cicloSemanas: item.cycleWeeks,
        pesoObjetivoKg: item.targetWeightKg,
        rendimientoCanalPct: item.carcassYieldPercent,
        consumoDiarioG: item.dailyFeedGPerHead,
        costoAlimentoKg: item.feedCostPerKgCOP,
        conversionAlimenticia: item.feedConversionRatio,
        precioKgCanal: item.marketPriceKgCanalCOP,
        precioHuevo: item.marketPriceEggUnitCOP ?? null,
        sistema: item.systemType,
      }));
    }

    return result;
  },
};

const consultarAlimentos: AgentTool = {
  name: "consultar_alimentos",
  description:
    "Consulta el inventario de alimentos: nombre, id, stock actual, unidad, costo y alertas. Úsala antes de registrar consumo.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  kind: "read",
  requiresConfirmation: false,
  async execute(_args, ctx) {
    const rows = asArray<any>(await ctx.api.get("/api/produccion/alimentacion"));
    return {
      total: rows.length,
      alimentos: rows.map((row) => ({
        id: row.id,
        nombre: row.name,
        categoria: row.category,
        tipo: row.feedType,
        stockActual: Number(row.currentStock || 0),
        unidad: row.unit,
        minimo: Number(row.minStock || 0),
        costoPorUnidad: Number(row.costPerUnit || 0),
        bajoStock: row.isLow ?? Number(row.currentStock || 0) <= Number(row.minStock || 0),
      })),
    };
  },
};

// ─── Herramientas de escritura automática (bajo riesgo) ───

const registrarProduccionHuevos: AgentTool = {
  name: "registrar_produccion_huevos",
  description:
    "Registra la producción de huevos de una fecha. Se ejecuta automáticamente. Si la cantidad supera el límite " +
    "esperado, el sistema pedirá confirmación explícita con confirmar_exceso=true.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      especie: { type: "string", description: "gallina (por defecto), codorniz, pato, etc." },
      lugar: { type: "string", description: "Lugar donde se recogieron los huevos. Si hay varios lugares, indica el nombre." },
      lote: { type: "string", description: "Código del lote de postura; obligatorio para codornices y patos." },
      tamanos: {
        type: "array",
        description: "Detalle por tamaño de huevo. Si se envía, no es necesario total_recolectado.",
        items: {
          type: "object",
          properties: {
            tamano: { type: "string", description: "AA, A, B, Jumbo, etc." },
            cantidad: { type: "integer", minimum: 0 },
          },
          required: ["tamano", "cantidad"],
        },
      },
      total_recolectado: { type: "integer", minimum: 0, description: "Total si no se detalla por tamaño." },
      roto: { type: "integer", minimum: 0 },
      descartados: { type: "integer", minimum: 0, description: "Huevos sucios/deformes descartados no vendibles." },
      para_incubacion: { type: "integer", minimum: 0 },
      autoconsumo: { type: "integer", minimum: 0 },
      codigo_lote: { type: "string", description: "Código de lote PEPS/FIFO de huevo (ej. HUE-20261112). Opcional." },
      temperatura_almacen_c: { type: "number", description: "Temperatura de cuarto frío / almacenamiento en °C." },
      humedad_almacen_pct: { type: "number", minimum: 0, maximum: 100, description: "Humedad relativa de almacenamiento en %." },
      precio_referencia: { type: "number", minimum: 0, description: "Precio de referencia por huevo en COP." },
      notas: { type: "string" },
      confirmar_exceso: {
        type: "boolean",
        description: "Solo usar cuando el usuario confirme explícitamente una producción superior a la esperada.",
      },
    },
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const date = normalizeDate(args.fecha);
    const species = args.especie ? normalizeSpecies(String(args.especie)) || "gallina" : "gallina";
    let batch: BatchRow | undefined;
    if (species !== "gallina") {
      if (!args.lote) throw new Error(`Indica el código del lote de ${speciesLabel(species, true).toLowerCase()} destinado a postura.`);
      const batches = await loadBatches(ctx);
      batch = findByIdOrCode(batches, String(args.lote));
      if (!batch || batch.species !== species || batch.purpose !== "postura_huevo" || batch.currentQuantity < 1 || !isBatchPresent(batch.status, batch.currentQuantity)) {
        throw new Error(`No encontré un lote activo de ${speciesLabel(species, true).toLowerCase()} con destino de postura y código ${String(args.lote)}.`);
      }
    }
    const location = await resolveFarmLocation(ctx, args.lugar, batch?.locationId);
    const sizes = Array.isArray(args.tamanos)
      ? args.tamanos
          .map((item: any) => ({ size: String(item.tamano || item.size || "").trim(), quantity: Number(item.cantidad || item.quantity || 0) }))
          .filter((item: any) => item.size && item.quantity > 0)
      : [];
    const total = sizes.length > 0
      ? sizes.reduce((sum: number, item: any) => sum + item.quantity, 0)
      : asNumber(args.total_recolectado, "total_recolectado", { min: 0, integer: true });

    if (total <= 0) throw new Error("Indica el total de huevos o el detalle por tamaño");

    const body: Record<string, unknown> = {
      date,
      species,
      locationId: location.id,
      totalCollected: total,
      broken: args.roto ? asNumber(args.roto, "roto", { min: 0, integer: true }) : 0,
      forIncubation: args.para_incubacion ? asNumber(args.para_incubacion, "para_incubacion", { min: 0, integer: true }) : 0,
      quantityAutoconsumo: args.autoconsumo ? asNumber(args.autoconsumo, "autoconsumo", { min: 0, integer: true }) : 0,
      notes: args.notas ? String(args.notas) : null,
      overrideValidation: args.confirmar_exceso === true,
    };
    if (args.descartados !== undefined && args.descartados !== null && args.descartados !== "") {
      body.discarded = asNumber(args.descartados, "descartados", { min: 0, integer: true });
    }
    if (args.codigo_lote) body.lotCode = String(args.codigo_lote).trim();
    if (args.temperatura_almacen_c !== undefined && args.temperatura_almacen_c !== null && args.temperatura_almacen_c !== "") {
      body.storageTempC = asNumber(args.temperatura_almacen_c, "temperatura_almacen_c");
    }
    if (args.humedad_almacen_pct !== undefined && args.humedad_almacen_pct !== null && args.humedad_almacen_pct !== "") {
      const hum = asNumber(args.humedad_almacen_pct, "humedad_almacen_pct", { min: 0 });
      if (hum > 100) throw new Error("humedad_almacen_pct debe estar entre 0 y 100");
      body.storageHumidityPct = hum;
    }
    if (batch) body.batchId = batch.id;
    if (sizes.length > 0) body.sizes = sizes;
    if (args.precio_referencia !== undefined && args.precio_referencia !== null && args.precio_referencia !== "") {
      body.referenceUnitPrice = String(asNumber(args.precio_referencia, "precio_referencia", { min: 0 }));
    }

    const sizeText = sizes.length > 0
      ? ` (${sizes.map((item: any) => `${item.size}: ${item.quantity}`).join(", ")})`
      : "";
    return {
      args: body,
      summary: `Registrar ${total} huevos de ${speciesLabel(species, true).toLowerCase()} en ${location.name}${batch ? ` (lote ${batch.code})` : ""} del ${formatDateEs(date)}${sizeText}.`,
    };
  },
  async execute(args, ctx) {
    try {
      return await ctx.api.post("/api/produccion/huevos", args);
    } catch (error) {
      if (error instanceof InternalApiError && error.status === 409) {
        const payload = error.payload as any;
        const message = payload?.error || "La producción supera el límite esperado.";
        throw new Error(
          `${message} Si el dato es correcto, confírmalo explícitamente y vuelve a registrarlo con confirmar_exceso=true.`,
        );
      }
      throw error;
    }
  },
};

const registrarMortalidad: AgentTool = {
  name: "registrar_mortalidad",
  description:
    "Registra la muerte de un animal o de varias aves de un lote. Se ejecuta automáticamente. " +
    "Debe identificar el animal o lote y registrar el lugar donde ocurrió; si hay varias opciones, solicita código y lugar.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      especie: {
        type: "string",
        description: "gallina, gallo, pollo, codorniz, pato, conejo o cuy.",
      },
      cantidad: { type: "integer", minimum: 1, description: "Por defecto 1. Solo lotes admiten más de 1." },
      causa: { type: "string", description: "Causa de la muerte." },
      codigo: { type: "string", description: "Código o id del animal o lote. Obligatorio si hay más de una opción." },
      lugar: { type: "string", description: "Lugar donde ocurrió la mortalidad. Puede inferirse del alojamiento actual del animal o lote." },
      descripcion: { type: "string" },
    },
    required: ["causa"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const date = normalizeDate(args.fecha);
    const rawSpecies = String(args.especie || "gallina").toLowerCase();
    const quantity = args.cantidad ? asNumber(args.cantidad, "cantidad", { min: 1, integer: true }) : 1;
    const causeText = String(args.causa || "").trim();
    if (!causeText) throw new Error("Indica la causa de la muerte");
    const cause = normalizeMortalityCause(causeText);

    if (rawSpecies.startsWith("gallina") || rawSpecies === "gallos" || rawSpecies === "gallo") {
      const isRooster = rawSpecies.startsWith("gallo");
      const rows = isRooster ? await loadRoosters(ctx) : await loadHens(ctx);
      const active: (HenRow | RoosterRow)[] = isRooster
        ? activeRoosters(rows as RoosterRow[])
        : activeHens(rows as HenRow[]);
      const selected = findByIdOrCode(active, args.codigo);
      if (args.codigo && !selected) throw new Error(`No se encontró un ${isRooster ? "gallo" : "gallina"} activo con código ${args.codigo}`);
      if (!selected && active.length > 1) throw new Error(`Hay ${active.length} ${isRooster ? "gallos" : "gallinas"} activos. Indica el código del animal que falleció.`);
      const animal = selected || active[0];
      if (!animal) throw new Error(`No hay ${isRooster ? "gallos" : "gallinas"} activos para registrar la muerte`);
      const location = await resolveFarmLocation(ctx, args.lugar, animal.locationId);

      return {
        args: {
          date,
          locationId: location.id,
          birdType: isRooster ? "gallo" : "gallina",
          quantity: 1,
          cause,
          [isRooster ? "roosterId" : "henId"]: animal.id,
          description: args.descripcion ? String(args.descripcion) : `Registrado por asistente IA (${animal.code})`,
        },
        summary: `Registrar muerte de ${isRooster ? "el gallo" : "la gallina"} ${animal.code} en ${location.name} por ${causeText} el ${formatDateEs(date)}.`,
      };
    }

    const species = normalizeSpecies(rawSpecies);
    if (!species) throw new Error("Especie no reconocida. Usa gallina, gallo, pollo, codorniz, pato, conejo o cuy.");
    const batches = activeBatches(await loadBatches(ctx)).filter((batch) => batch.species === species);
    const selected = findByIdOrCode(batches, args.codigo);
    if (args.codigo && !selected) throw new Error(`No se encontró un lote activo de ${species} con código ${args.codigo}`);
    if (!selected && batches.length > 1) throw new Error(`Hay ${batches.length} lotes activos de ${speciesLabel(species, true).toLowerCase()}. Indica el código del lote.`);
    const batch = selected || batches[0];
    if (!batch) throw new Error(`No hay lotes activos de ${species}`);
    if (quantity > Number(batch.currentQuantity)) {
      throw new Error(`El lote ${batch.code} solo tiene ${batch.currentQuantity} animales`);
    }
    const location = await resolveFarmLocation(ctx, args.lugar, batch.locationId);

    const mortalityBatchTypeBySpecies: Record<string, string> = {
      pollo: "lote_pollos",
      codorniz: "lote_codornices",
      pato: "lote_patos",
      conejo: "lote_conejos",
      cuy: "lote_cuyes",
    };

    return {
      args: {
        date,
        locationId: location.id,
        birdType: mortalityBatchTypeBySpecies[species] || "lote_pollos",
        quantity,
        cause,
        batchId: batch.id,
        description: args.descripcion ? String(args.descripcion) : `Registrado por asistente IA (lote ${batch.code})`,
      },
      summary: `Registrar muerte de ${quantity} ${speciesLabel(species, true).toLowerCase()} del lote ${batch.code} en ${location.name} por ${causeText} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/mortalidad", args);
  },
};

const registrarPeso: AgentTool = {
  name: "registrar_peso",
  description:
    "Registra un pesaje promedio de animales o de un lote. Se ejecuta automáticamente.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      peso_promedio_kg: { type: "number", minimum: 0.001, description: "Peso promedio en kilogramos." },
      especie: { type: "string", description: "Especie a la que corresponde el pesaje." },
      lote: { type: "string", description: "Código o id del lote, si aplica." },
      lugar: { type: "string", description: "Lugar del pesaje; si se indica un lote, puede inferirse de su ubicación actual." },
      raza: { type: "string" },
      semana: { type: "integer", minimum: 0, description: "Edad en semanas." },
      tamano_muestra: { type: "integer", minimum: 1, description: "Número de animales pesados." },
      notas: { type: "string" },
    },
    required: ["peso_promedio_kg"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const date = normalizeDate(args.fecha);
    const weight = asNumber(args.peso_promedio_kg, "peso_promedio_kg", { min: 0.001 });
    const requestedSpecies = args.especie ? normalizeSpecies(String(args.especie)) : null;
    let batch: BatchRow | undefined;

    if (args.lote) {
      const batches = await loadBatches(ctx);
      batch = findByIdOrCode(batches, String(args.lote));
      if (!batch) throw new Error(`No se encontró el lote ${args.lote}`);
      if (!isBatchPresent(batch.status, batch.currentQuantity)) throw new Error(`El lote ${batch.code} no tiene animales activos para pesar.`);
      if (requestedSpecies && requestedSpecies !== batch.species) throw new Error(`El lote ${batch.code} corresponde a ${batch.species}, no a ${requestedSpecies}.`);
    }
    const species = batch?.species || requestedSpecies || "gallina";
    if (!batch && species !== "gallina") throw new Error(`Selecciona el código del lote activo de ${speciesLabel(species, true).toLowerCase()} que vas a pesar.`);
    const location = await resolveFarmLocation(ctx, args.lugar, batch?.locationId);

    const weightText = weight.toLocaleString("es-CO", { maximumFractionDigits: 2 });
    return {
      args: {
        date,
        batchId: batch?.id || null,
        locationId: location.id,
        species,
        henGroup: species || args.especie || null,
        breed: args.raza ? String(args.raza) : null,
        weekNumber: args.semana !== undefined ? asNumber(args.semana, "semana", { min: 0, integer: true }) : null,
        avgWeightKg: weight,
        sampleSize: args.tamano_muestra
          ? asNumber(args.tamano_muestra, "tamano_muestra", { min: 1, integer: true })
          : 1,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Registrar peso promedio de ${weightText} kg${batch ? ` en el lote ${batch.code}` : ` de ${speciesLabel(species, true).toLowerCase()}`} en ${location.name} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/peso", args);
  },
};

const registrarConsumoAlimento: AgentTool = {
  name: "registrar_consumo_alimento",
  description:
    "Registra el consumo de alimento del inventario. Se ejecuta automáticamente. El alimento se identifica por nombre o id.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      alimento: { type: "string", description: "Nombre o id del alimento." },
      cantidad: { type: "number", minimum: 0.001, description: "Cantidad consumida en la unidad del alimento." },
      lugar: { type: "string", description: "Lugar donde se suministró el alimento. Si hay varios lugares, indica el nombre." },
      notas: { type: "string" },
    },
    required: ["alimento", "cantidad"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const date = normalizeDate(args.fecha);
    const quantity = asNumber(args.cantidad, "cantidad", { min: 0.001 });
    const rows = asArray<any>(await ctx.api.get("/api/produccion/alimentacion"));
    const needle = String(args.alimento || "").trim().toLowerCase();

    const feed =
      rows.find((row) => row.id === args.alimento) ||
      rows.find((row) => String(row.name || "").toLowerCase() === needle) ||
      rows.find((row) => String(row.name || "").toLowerCase().includes(needle));

    if (!feed) {
      const names = rows.slice(0, 15).map((row) => row.name).join(", ");
      throw new Error(`No se encontró el alimento "${args.alimento}". Alimentos disponibles: ${names || "ninguno"}`);
    }

    const stock = Number(feed.currentStock || 0);
    if (quantity > stock) {
      throw new Error(`Stock insuficiente de ${feed.name}: hay ${stock} ${feed.unit}`);
    }
    const location = await resolveFarmLocation(ctx, args.lugar);

    return {
      args: {
        date,
        feedId: feed.id,
        locationId: location.id,
        quantity,
        isEntry: false,
        movementType: "consumo_manual",
        notes: args.notas ? String(args.notas) : "Registrado por asistente IA",
      },
      summary: `Registrar consumo de ${quantity} ${feed.unit} de ${feed.name} en ${location.name} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/alimentacion/movimientos", args);
  },
};

const registrarAutoconsumo: AgentTool = {
  name: "registrar_autoconsumo",
  description:
    "Registra consumo familiar de huevos o carne (autoconsumo). Se ejecuta automáticamente.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      especie: { type: "string", description: "gallina, pollo, conejo, etc." },
      tipo_producto: { type: "string", enum: ["huevo", "carne_canal"], description: "huevo o carne_canal." },
      cantidad: { type: "number", minimum: 0.001 },
      precio_referencia: { type: "number", minimum: 0, description: "Precio de mercado de referencia por unidad o kg." },
      unidad: { type: "string", description: "unidades o kg. Se infiere si no se envía." },
      notas: { type: "string" },
    },
    required: ["especie", "tipo_producto", "cantidad"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args) {
    const date = normalizeDate(args.fecha);
    const species = normalizeSpecies(String(args.especie));
    if (!species) throw new Error("Especie no reconocida");
    const productType = String(args.tipo_producto);
    if (!["huevo", "carne_canal"].includes(productType)) {
      throw new Error("tipo_producto debe ser huevo o carne_canal");
    }
    const quantity = asNumber(args.cantidad, "cantidad", { min: 0.001 });
    const price = args.precio_referencia !== undefined && args.precio_referencia !== null
      ? asNumber(args.precio_referencia, "precio_referencia", { min: 0 })
      : 0;

    return {
      args: {
        date,
        species,
        productType,
        quantity,
        marketReferencePrice: price,
        unit: args.unidad ? String(args.unidad) : productType === "carne_canal" ? "kg" : "unidades",
        notes: args.notas ? String(args.notas) : "Registrado por asistente IA",
      },
      summary: `Registrar autoconsumo de ${quantity} ${productType === "carne_canal" ? "kg de carne" : "huevos"} de ${speciesLabel(species, true).toLowerCase()} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/soberania", args);
  },
};

// ─── Herramientas con confirmación (ventas, gastos, ingresos) ───

const registrarVentaHuevos: AgentTool = {
  name: "registrar_venta_huevos",
  description:
    "Propone una venta de huevos. Requiere confirmación del usuario antes de ejecutarse. " +
    "Cada ítem indica tamaño, cantidad de huevos, precio por presentación y presentación.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      items: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            tamano: { type: "string", description: "AA, A, B, etc." },
            cantidad: { type: "integer", minimum: 1, description: "Cantidad de huevos." },
            precio_unitario: { type: "number", minimum: 1, description: "Precio por presentación en COP." },
            presentacion: { type: "string", description: "docena, cubeta, unidad, etc." },
            presentaciones: { type: "integer", minimum: 1, description: "Número de presentaciones vendidas." },
          },
          required: ["tamano", "cantidad", "precio_unitario"],
        },
      },
      comprador: { type: "string" },
      credito: { type: "boolean", description: "Si la venta queda a crédito." },
      fecha_vencimiento: { type: "string", description: "AAAA-MM-DD, si es a crédito." },
      notas: { type: "string" },
    },
    required: ["items"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args) {
    const date = normalizeDate(args.fecha);
    const rawItems = Array.isArray(args.items) ? args.items : [];
    if (rawItems.length === 0) throw new Error("La venta debe tener al menos un ítem");

    const items = rawItems.map((item: any) => {
      const size = String(item.tamano || item.size || "").trim();
      const quantity = asNumber(item.cantidad, "cantidad", { min: 1, integer: true });
      const price = asNumber(item.precio_unitario, "precio_unitario", { min: 1 });
      const presentations = item.presentaciones
        ? asNumber(item.presentaciones, "presentaciones", { min: 1, integer: true })
        : quantity;
      return {
        size,
        quantity,
        pricePerUnit: price,
        presentations,
        presentation: item.presentacion ? String(item.presentacion) : null,
      };
    });

    if (items.some((item) => !item.size)) throw new Error("Cada ítem debe indicar el tamaño de huevo");

    const total = items.reduce((sum, item) => sum + item.presentations * item.pricePerUnit, 0);
    const detail = items.map((item) => `${item.quantity} ${item.size} a ${formatCop(item.pricePerUnit)}`).join("; ");

    return {
      args: {
        date,
        items,
        buyer: args.comprador ? String(args.comprador) : null,
        isCredit: args.credito === true,
        dueDate: args.fecha_vencimiento ? normalizeDate(args.fecha_vencimiento) : null,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Vender ${detail}${args.comprador ? ` a ${args.comprador}` : ""} por ${formatCop(total)} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/finanzas/finanzas/ventas", args);
  },
};

const registrarVentaAnimales: AgentTool = {
  name: "registrar_venta_animales",
  description:
    "Propone la venta de animales individuales o de un lote. Requiere confirmación. " +
    "Las gallinas y gallos se venden de a uno; los lotes admiten varios animales.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      tipo: {
        type: "string",
        enum: ["gallina", "gallo", "lote"],
        description: "Tipo de venta. Para pollos, codornices, patos, conejos o cuyes usa 'lote'.",
      },
      especie: {
        type: "string",
        description: "Si el tipo es 'lote', especie del lote: pollo, codorniz, pato, conejo o cuy.",
      },
      codigo: { type: "string", description: "Código o id del animal o lote." },
      cantidad: { type: "integer", minimum: 1, description: "Cantidad. Para gallina/gallo debe ser 1." },
      precio_unitario: { type: "number", minimum: 1, description: "Precio por animal o por kg según el modo." },
      modo_precio: { type: "string", enum: ["por_ave", "por_kg"], description: "Por defecto por_ave." },
      peso_kg: { type: "number", minimum: 0.001, description: "Peso vendido, si el modo es por_kg." },
      comprador: { type: "string" },
      presentacion: { type: "string", description: "canal, vivo, etc." },
      credito: { type: "boolean", description: "Si la venta queda a crédito." },
      fecha_vencimiento: { type: "string", description: "AAAA-MM-DD, si es a crédito." },
      notas: { type: "string" },
    },
    required: ["tipo", "precio_unitario"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args, ctx) {
    const date = normalizeDate(args.fecha);
    const type = String(args.tipo || "").toLowerCase();
    const quantity = args.cantidad ? asNumber(args.cantidad, "cantidad", { min: 1, integer: true }) : 1;
    const price = asNumber(args.precio_unitario, "precio_unitario", { min: 1 });
    const mode = args.modo_precio === "por_kg" ? "por_kg" : "por_ave";
    const creditFields = {
      isCredit: args.credito === true,
      dueDate: args.fecha_vencimiento ? normalizeDate(args.fecha_vencimiento) : null,
    };

    if (mode === "por_kg" && !args.peso_kg) {
      throw new Error("Indica el peso en kg para una venta por kg");
    }

    if (type === "gallina") {
      if (quantity !== 1) throw new Error("Las gallinas se venden de a una. Registra una venta por animal.");
      const hens = activeHens(await loadHens(ctx));
      const selected = findByIdOrCode(hens, args.codigo);
      if (args.codigo && !selected) throw new Error(`No se encontró la gallina ${args.codigo}`);
      const hen = selected || hens[0];
      if (!hen) throw new Error("No hay gallinas disponibles para venta");

      return {
        args: {
          date,
          birdType: "gallina",
          quantity: 1,
          pricePerUnit: price,
          priceMode: mode,
          weightKg: args.peso_kg ? Number(args.peso_kg) : null,
          buyer: args.comprador ? String(args.comprador) : null,
          presentation: args.presentacion ? String(args.presentacion) : null,
          henId: hen.id,
          ...creditFields,
          notes: args.notas ? String(args.notas) : null,
        },
        summary: `Vender la gallina ${hen.code} por ${formatCop(price)}${args.comprador ? ` a ${args.comprador}` : ""} el ${formatDateEs(date)}.`,
      };
    }

    if (type === "gallo") {
      if (quantity !== 1) throw new Error("Los gallos se venden de a uno. Registra una venta por animal.");
      const roosters = activeRoosters(await loadRoosters(ctx));
      const selected = findByIdOrCode(roosters, args.codigo);
      if (args.codigo && !selected) throw new Error(`No se encontró el gallo ${args.codigo}`);
      const rooster = selected || roosters[0];
      if (!rooster) throw new Error("No hay gallos disponibles para venta");

      return {
        args: {
          date,
          birdType: "gallo",
          quantity: 1,
          pricePerUnit: price,
          priceMode: mode,
          weightKg: args.peso_kg ? Number(args.peso_kg) : null,
          buyer: args.comprador ? String(args.comprador) : null,
          presentation: args.presentacion ? String(args.presentacion) : null,
          roosterId: rooster.id,
          ...creditFields,
          notes: args.notas ? String(args.notas) : null,
        },
        summary: `Vender el gallo ${rooster.code} por ${formatCop(price)}${args.comprador ? ` a ${args.comprador}` : ""} el ${formatDateEs(date)}.`,
      };
    }

    const rawSpecies = String((args as any).especie || "").toLowerCase();
    const batches = activeBatches(await loadBatches(ctx));
    const selected = findByIdOrCode(batches, args.codigo);
    const species = rawSpecies ? normalizeSpecies(rawSpecies) : null;
    const candidates = species ? batches.filter((batch) => batch.species === species) : batches;
    if (args.codigo && !selected) throw new Error(`No se encontró el lote ${args.codigo}`);
    const batch = selected || candidates[0];
    if (!batch) throw new Error("No hay lotes disponibles para venta");
    if (quantity > Number(batch.currentQuantity)) {
      throw new Error(`El lote ${batch.code} solo tiene ${batch.currentQuantity} animales`);
    }

    return {
      args: {
        date,
        birdType: batch.species || "pollo",
        quantity,
        pricePerUnit: price,
        priceMode: mode,
        weightKg: args.peso_kg ? Number(args.peso_kg) : null,
        buyer: args.comprador ? String(args.comprador) : null,
        presentation: args.presentacion ? String(args.presentacion) : null,
        batchId: batch.id,
        ...creditFields,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Vender ${quantity} ${speciesLabel(batch.species, true).toLowerCase()} del lote ${batch.code} a ${formatCop(price)} ${mode === "por_kg" ? "por kg" : "cada uno"}${args.comprador ? ` a ${args.comprador}` : ""} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/finanzas/finanzas/ventas-aves", args);
  },
};

const registrarVentaCarne: AgentTool = {
  name: "registrar_venta_carne",
  description:
    "Propone una venta de carne en canal o despiece por kilogramos (pollo, gallina, codorniz, pato, conejo o cuy). Requiere confirmación del usuario.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      especie: {
        type: "string",
        description: "Especie de carne: pollo, gallina, codorniz, pato, conejo o cuy. Por defecto pollo.",
      },
      cantidad_kg: { type: "number", minimum: 0.01, description: "Cantidad vendida en kg." },
      precio_kg: { type: "number", minimum: 1, description: "Precio por kg en COP." },
      presentacion: { type: "string", description: "canal entero, despiece, empacado, etc." },
      comprador: { type: "string" },
      credito: { type: "boolean", description: "Si la venta queda a crédito." },
      fecha_vencimiento: { type: "string", description: "AAAA-MM-DD, si es a crédito." },
      notas: { type: "string" },
    },
    required: ["cantidad_kg", "precio_kg"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args) {
    const date = normalizeDate(args.fecha);
    const quantityKg = asNumber(args.cantidad_kg, "cantidad_kg", { min: 0.01 });
    const pricePerKg = asNumber(args.precio_kg, "precio_kg", { min: 1 });
    const parsedSpecies = args.especie ? normalizeSpecies(String(args.especie)) : "pollo";
    if (args.especie && !parsedSpecies) {
      throw new Error(`Especie no reconocida: ${args.especie}`);
    }
    const species = parsedSpecies || "pollo";
    const total = quantityKg * pricePerKg;
    return {
      args: {
        date,
        species,
        quantityKg,
        pricePerKg,
        presentation: args.presentacion ? String(args.presentacion) : null,
        buyer: args.comprador ? String(args.comprador) : null,
        isCredit: args.credito === true,
        dueDate: args.fecha_vencimiento ? normalizeDate(args.fecha_vencimiento) : null,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Vender ${quantityKg} kg de carne de ${speciesLabel(species, false).toLowerCase()} por ${formatCop(total)}${args.comprador ? ` a ${args.comprador}` : ""} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/carne/ventas", args);
  },
};

const registrarVentaGallinaza: AgentTool = {
  name: "registrar_venta_gallinaza",
  description:
    "Propone una venta de gallinaza o abono orgánico en kilogramos. Requiere confirmación del usuario.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      cantidad_kg: { type: "number", minimum: 0.01, description: "Cantidad vendida en kg." },
      precio_kg: { type: "number", minimum: 1, description: "Precio por kg en COP." },
      especie: { type: "string", description: "Especie de origen o mixta (opcional)." },
      presentacion: { type: "string", description: "bulto 40kg, granel, saco, etc." },
      comprador: { type: "string" },
      credito: { type: "boolean", description: "Si la venta queda a crédito." },
      fecha_vencimiento: { type: "string", description: "AAAA-MM-DD, si es a crédito." },
      notas: { type: "string" },
    },
    required: ["cantidad_kg", "precio_kg"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args) {
    const date = normalizeDate(args.fecha);
    const quantityKg = asNumber(args.cantidad_kg, "cantidad_kg", { min: 0.01 });
    const pricePerKg = asNumber(args.precio_kg, "precio_kg", { min: 1 });
    const total = quantityKg * pricePerKg;
    return {
      args: {
        date,
        quantityKg,
        pricePerKg,
        species: args.especie ? normalizeSpecies(String(args.especie)) : null,
        presentation: args.presentacion ? String(args.presentacion) : null,
        buyer: args.comprador ? String(args.comprador) : null,
        isCredit: args.credito === true,
        dueDate: args.fecha_vencimiento ? normalizeDate(args.fecha_vencimiento) : null,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Vender ${quantityKg} kg de gallinaza/abono por ${formatCop(total)}${args.comprador ? ` a ${args.comprador}` : ""} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/gallinaza/ventas", args);
  },
};

function prepareFinanceTool(type: "ingreso" | "egreso") {
  return async (args: Record<string, any>): Promise<PreparedWrite> => {
    const date = normalizeDate(args.fecha);
    const category = String(args.categoria || (type === "egreso" ? "Otros gastos" : "Otros ingresos")).trim();
    const description = String(args.descripcion || "").trim();
    if (!description) throw new Error("Indica la descripción del movimiento");

    let amount: number;
    if (args.monto !== undefined && args.monto !== null && args.monto !== "") {
      amount = asNumber(args.monto, "monto", { min: 0.01 });
    } else {
      const quantity = asNumber(args.cantidad, "cantidad", { min: 0.01 });
      const unitPrice = asNumber(args.precio_unitario, "precio_unitario", { min: 0.01 });
      amount = quantity * unitPrice;
    }

    return {
      args: {
        date,
        type,
        category,
        description,
        amount: amount.toFixed(2),
        quantity: args.cantidad ? Number(args.cantidad) : null,
        unitPrice: args.precio_unitario ? Number(args.precio_unitario) : null,
        unit: args.unidad ? String(args.unidad) : null,
        counterparty: args.contraparte ? String(args.contraparte) : null,
        notes: args.notas ? String(args.notas) : null,
        isCredit: args.credito === true,
        dueDate: args.fecha_vencimiento ? normalizeDate(args.fecha_vencimiento) : null,
      },
      summary: `Registrar ${type === "egreso" ? "gasto" : "ingreso"} de ${formatCop(amount)} en ${category}: ${description}${args.contraparte ? ` (${args.contraparte})` : ""} el ${formatDateEs(date)}.`,
    };
  };
}

const financeParameters = {
  type: "object",
  properties: {
    fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
    categoria: { type: "string", description: "Categoría del movimiento." },
    descripcion: { type: "string", description: "Descripción del movimiento." },
    monto: { type: "number", minimum: 0.01, description: "Monto total en COP. Alternativa a cantidad × precio_unitario." },
    cantidad: { type: "number", minimum: 0.01 },
    precio_unitario: { type: "number", minimum: 0.01 },
    unidad: { type: "string" },
    contraparte: { type: "string", description: "Proveedor, cliente o entidad." },
    notas: { type: "string" },
    credito: { type: "boolean" },
    fecha_vencimiento: { type: "string", description: "AAAA-MM-DD, si es a crédito." },
  },
  required: ["descripcion"],
  additionalProperties: false,
};

const registrarGasto: AgentTool = {
  name: "registrar_gasto",
  description: "Propone registrar un gasto o compra. Requiere confirmación del usuario.",
  parameters: financeParameters,
  kind: "write",
  requiresConfirmation: true,
  prepare: prepareFinanceTool("egreso"),
  async execute(args, ctx) {
    return ctx.api.post("/api/finanzas/finanzas", args);
  },
};

const registrarIngreso: AgentTool = {
  name: "registrar_ingreso",
  description:
    "Propone registrar un ingreso o venta de otro producto o subproducto que no sea huevo, carne, animal en pie ni gallinaza (esos tienen herramientas propias). " +
    "Requiere confirmación del usuario.",
  parameters: financeParameters,
  kind: "write",
  requiresConfirmation: true,
  prepare: prepareFinanceTool("ingreso"),
  async execute(args, ctx) {
    return ctx.api.post("/api/finanzas/finanzas", args);
  },
};

const consultarReproduccion: AgentTool = {
  name: "consultar_reproduccion",
  description:
    "Consulta el historial de reproducción de mamíferos (conejos F1 y cuyes): empadres activos, palpaciones, nidales, partos, " +
    "destetes con lotes sexados, ganancia diaria, alertas de descarte por paridad y madres élite.",
  parameters: {
    type: "object",
    properties: {
      especie: { type: "string", description: "Opcional: conejo o cuy." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const sp = args.especie ? normalizeSpecies(String(args.especie)) : null;
    if (sp && sp !== "conejo" && sp !== "cuy") {
      throw new Error("La reproducción mamífera aplica solo a conejo o cuy. Para aves usa consultar_incubacion.");
    }
    const path = sp ? `/api/produccion/reproduccion?species=${encodeURIComponent(sp)}` : "/api/produccion/reproduccion";
    const rows = asArray<any>(await ctx.api.get(path));
    const gestacionesActivas = rows.filter((r) => r.eventType === "empadre" && r.status === "activo").length;
    const camadasPorDestetar = rows.filter((r) => r.eventType === "parto" && r.status === "lactancia").length;
    const madresElite = Array.from(
      new Set(rows.filter((r) => r.isEliteDam).map((r) => `${r.damCode} (${r.species}${r.litterDailyGainG ? `, ${r.litterDailyGainG} g/día` : ""})`)),
    );
    const alertasDescarte = Array.from(
      new Set(rows.filter((r) => r.cullRecommended).map((r) => `${r.damCode} (${r.species}, parto #${r.parityNumber ?? "?"})`)),
    );
    return {
      resumen: {
        totalEventos: rows.length,
        gestacionesActivas,
        camadasPorDestetar,
        madresElite,
        alertasDescarte,
      },
      eventosRecientes: rows.slice(0, 25).map((r) => ({
        fecha: r.eventDate,
        especie: r.species,
        tipo: r.eventType,
        estado: r.status,
        madre: r.damCode,
        padre: r.sireCode || null,
        lugar: r.locationName || null,
        paridad: r.parityNumber ?? null,
        resultadoPalpacion: r.palpationResult || null,
        fechaPalpacion: r.expectedPalpationDate || null,
        fechaNidal: r.expectedNestboxDate || null,
        fechaEstimadaParto: r.expectedBirthDate || null,
        nacidosVivos: r.bornAlive ?? null,
        nacidosMuertos: r.bornDead ?? null,
        destetadosTotal: r.weanedTotal ?? null,
        destetadosMachos: r.weanedMales ?? null,
        destetadosHembras: r.weanedFemales ?? null,
        gananciaDiariaG: r.litterDailyGainG ?? null,
        loteDestetado: r.weanedBatchCode || null,
        madreElite: Boolean(r.isEliteDam),
        descarteRecomendado: Boolean(r.cullRecommended),
      })),
    };
  },
};

const consultarBioseguridad: AgentTool = {
  name: "consultar_bioseguridad",
  description:
    "Consulta cumplimiento POE GAB (ICA 3651/3652), puntaje de bienestar Resolución 8452/2025, " +
    "puntaje bioseguridad granja mixta y vencimientos de capacitaciones (vigencia 5 años).",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  kind: "read",
  requiresConfirmation: false,
  async execute(_args, ctx) {
    const data = await ctx.api.get<any>("/api/sanidad/bioseguridad");
    return {
      resumen: data.summary ?? null,
      alertasCapacitacion: data.certificateAlerts ?? [],
      ultimasBitacoras: (data.logs || []).slice(0, 20).map((l: any) => ({
        fecha: l.date,
        tipo: l.logType,
        lugar: l.locationName || "General",
        puntajeBienestar: l.welfareScore,
        cumplimiento: l.complianceStatus,
        personal: l.staffName || l.inspectorName || null,
        tema: l.trainingTopic || l.disinfectantUsed || null,
        venceCertificado: l.trainingCertificateUntil || null,
      })),
    };
  },
};

const consultarCompostaje: AgentTool = {
  name: "consultar_compostaje",
  description:
    "Consulta pilas activas y cosechadas de compostaje (fórmulas 3:1:1 y 7:2:2), fechas de volteo/cosecha y alertas (>70 °C o humedad > 20%).",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  kind: "read",
  requiresConfirmation: false,
  async execute(_args, ctx) {
    const data = await ctx.api.get<any>("/api/operaciones/compostaje");
    return {
      resumen: data.summary ?? null,
      pilas: (data.piles || []).slice(0, 20).map((p: any) => ({
        codigo: p.code,
        nombre: p.name,
        lugar: p.locationName || null,
        especie: p.species || null,
        formula: p.formulaRatio,
        estado: p.status,
        fechaInicio: p.startDate,
        gallinazaKg: p.manureKg,
        mortalidadKg: p.mortalityKg,
        materialCarbonoKg: p.carbonMaterialKg,
        ultimoVolteo: p.lastTurnDate || null,
        proximoVolteo: p.nextTurnDueDate || null,
        cosechaEstimada: p.expectedHarvestDate || null,
        cosechadoKg: p.harvestedKg ?? null,
        temperaturaC: p.currentTempC,
        humedadPct: p.moisturePct,
        volteos: p.turnCount ?? 0,
        alertas: p.alerts || [],
      })),
    };
  },
};

function describeSensorAlert(r: any): string {
  const ith = r.ithIndex != null ? Number(r.ithIndex) : r.metricType === "ith" ? Number(r.value) : null;
  if (ith != null && Number.isFinite(ith) && ith >= 72) {
    return ith >= 78 ? `Estrés calórico severo (ITH ${ith} ≥ 78)` : `Alerta estrés calórico moderado (ITH ${ith} ≥ 72)`;
  }
  const val = Number(r.value);
  if (r.metricType === "amoniaco_ppm" && Number.isFinite(val) && val >= 20) {
    return `Nivel crítico de NH3 (${val} ppm ≥ 20 ppm)`;
  }
  if (r.metricType === "temperatura" && Number.isFinite(val) && (val > 32 || val < 10)) {
    return `Temperatura fuera de rango (${val} °C)`;
  }
  return "Lectura en alerta";
}

const consultarCierreYSensores: AgentTool = {
  name: "consultar_cierre_y_sensores",
  description:
    "Consulta el estado de cierre diario auditable (snapshot del día y cierres recientes) y lecturas ambientales IoT " +
    "(temperatura, humedad, índice ITH de estrés calórico, amoníaco NH3 ppm, báscula automática y consumo de agua).",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Opcional AAAA-MM-DD para consultar el pre-cierre de ese día." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const dateParam = args.fecha ? `?date=${encodeURIComponent(normalizeDate(args.fecha))}` : "";
    const [closureData, sensorData] = await Promise.all([
      ctx.api.get<any>(`/api/operaciones/cierre-diario${dateParam}`),
      ctx.api.get<any>("/api/operaciones/sensores"),
    ]);
    const readings = Array.isArray(sensorData.readings) ? sensorData.readings : [];
    return {
      cierreDelDia: {
        fechaObjetivo: closureData.targetDate,
        resumenDia: closureData.preview,
        cierresRecientes: (closureData.closures || []).slice(0, 10).map((c: any) => ({
          fecha: c.closureDate,
          estado: c.status,
          motivoReapertura: c.reopenReason || null,
        })),
      },
      sensores: {
        resumen: sensorData.summary ?? null,
        alertasActivas: readings
          .filter((r: any) => r.alertTriggered)
          .slice(0, 15)
          .map((r: any) => ({
            dispositivo: r.deviceId,
            lugar: r.locationName || "General",
            metrica: r.metricType,
            valor: r.value,
            unidad: r.unit,
            ith: r.ithIndex,
            motivo: describeSensorAlert(r),
            registrado: r.recordedAt,
          })),
        lecturasRecientes: readings.slice(0, 15).map((r: any) => ({
          dispositivo: r.deviceId,
          lugar: r.locationName || "General",
          metrica: r.metricType,
          valor: r.value,
          unidad: r.unit,
          ith: r.ithIndex,
          alerta: Boolean(r.alertTriggered),
          registrado: r.recordedAt,
        })),
      },
    };
  },
};

const consultarIncubacion: AgentTool = {
  name: "consultar_incubacion",
  description:
    "Consulta las tandas de incubación de huevos (gallina, codorniz y pato): huevos incubados, fértiles, fertilidad %, " +
    "natalidad %, fecha de parada de volteo y fecha estimada de eclosión.",
  parameters: {
    type: "object",
    properties: {
      solo_activas: { type: "boolean", description: "Si es true, muestra solo tandas sin eclosionar. Opcional." },
      especie: { type: "string", description: "Opcional: gallina, codorniz o pato." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const rows = asArray<any>(await ctx.api.get("/api/produccion/incubacion"));
    const sp = args.especie ? normalizeSpecies(String(args.especie)) : null;
    const filtered = rows.filter((row) => {
      if (args.solo_activas === true && row.isComplete) return false;
      if (sp && row.species !== sp) return false;
      return true;
    });
    return {
      total: filtered.length,
      activas: filtered.filter((r) => !r.isComplete).length,
      completadas: filtered.filter((r) => r.isComplete).length,
      tandas: filtered.slice(0, 25).map((r) => ({
        id: r.id,
        especie: r.species || "gallina",
        incubadora: r.incubatorName || null,
        bandeja: r.trayCode || null,
        madre: r.henCode || null,
        padre: r.roosterCode || null,
        lote: r.batchCode || null,
        lugar: r.locationName || null,
        fechaInicio: r.startDate,
        pararVolteo: r.turnStopDate || null,
        eclosionEstimada: r.expectedHatchDate || null,
        huevosIncubados: r.eggsSet,
        fertiles: r.fertileEggs,
        descartados: r.discardedEggs,
        nacidos: r.eggsHatched,
        fertilidadPct: r.fertilityPct,
        natalidadFertilesPct: r.hatchOfFertilePct,
        natalidadTotalPct: r.hatchTotalPct,
        tempObjetivoC: r.tempTargetC,
        humedadObjetivoPct: r.humidityTargetPct,
        completa: Boolean(r.isComplete),
      })),
    };
  },
};

const consultarCalendarioRutinas: AgentTool = {
  name: "consultar_calendario_rutinas",
  description:
    "Consulta la agenda unificada, las tareas de la rutina diaria de hoy, los incumplimientos/vencimientos recientes y los próximos hitos (7, 30 y 90 días).",
  parameters: {
    type: "object",
    properties: {
      modulo: { type: "string", description: "Filtro opcional: huevos, alimentacion, rutina, sanidad, incubacion, reproduccion, mantenimiento, compostaje, bioseguridad, finanzas." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const data = await ctx.api.get<any>("/api/planeacion/calendario");
    const mod = args.modulo ? normalizeLookup(args.modulo) : null;
    const matchModule = (ev: any) => !mod || normalizeLookup(ev.module) === mod;
    const mapEv = (ev: any) => ({
      id: ev.routineTaskId || ev.id,
      fecha: ev.date,
      titulo: ev.title,
      modulo: ev.module,
      estado: ev.status,
      prioridad: ev.priority,
      esRutina: Boolean(ev.isRoutine),
      detalle: ev.subtitle || null,
    });
    return {
      fechaHoy: data.today,
      metricas: data.metrics || null,
      tareasHoy: asArray<any>(data.todayRoutineTasks).filter(matchModule).slice(0, 30).map(mapEv),
      vencidas: asArray<any>(data.overdueItems).filter(matchModule).slice(0, 20).map(mapEv),
      proximas7Dias: asArray<any>(data.upcomingMediumLongTerm?.next7Days).filter(matchModule).slice(0, 20).map(mapEv),
    };
  },
};

async function findAnyLocationByName(ctx: ToolContext, requestedName?: unknown): Promise<FarmLocationRow | null> {
  const requested = normalizeLookup(requestedName);
  if (!requested) return null;
  const locations = asArray<FarmLocationRow>(await ctx.api.get("/api/ubicaciones"));
  const exact = locations.filter((loc) => normalizeLookup(loc.name) === requested);
  const matches = exact.length > 0 ? exact : locations.filter((loc) => normalizeLookup(loc.name).includes(requested));
  if (matches.length === 0) {
    throw new Error(`No encontré el lugar "${String(requestedName).trim()}". Lugares disponibles: ${locations.map((l) => l.name).join(", ") || "ninguno"}`);
  }
  if (matches.length > 1) {
    throw new Error(`El lugar "${String(requestedName).trim()}" coincide con varios: ${matches.map((l) => l.name).join(", ")}. Indica el nombre completo.`);
  }
  return matches[0];
}

const consultarContabilidadAnalitica: AgentTool = {
  name: "consultar_contabilidad_analitica",
  description:
    "Consulta la contabilidad analítica: ingresos, costos directos, costos indirectos prorrateados y utilidad neta desglosados por especie y por lugar, " +
    "costos unitarios por huevo y kg de carne, margen por calibre NTC 1240 y ROI del CAPEX en activos.",
  parameters: {
    type: "object",
    properties: {
      dias: { type: "integer", minimum: 1, maximum: 3650, description: "Días hacia atrás desde hoy si no se pasan desde/hasta. Por defecto 30." },
      desde: { type: "string", description: "Fecha inicial AAAA-MM-DD (opcional)." },
      hasta: { type: "string", description: "Fecha final AAAA-MM-DD (opcional)." },
      especie: { type: "string", description: "Filtro opcional por especie." },
      lugar: { type: "string", description: "Filtro opcional por nombre de lugar." },
      incluir_prorrateo: { type: "boolean", description: "Si es true, incluye costos indirectos prorrateados. Por defecto true." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const to = args.hasta ? normalizeDate(args.hasta) : todayISO();
    let from: string;
    if (args.desde) {
      from = normalizeDate(args.desde);
    } else {
      const days = args.dias ? asNumber(args.dias, "dias", { min: 1, integer: true }) : 30;
      const d = new Date(`${to}T12:00:00`);
      d.setDate(d.getDate() - days);
      from = d.toISOString().split("T")[0];
    }
    const sp = args.especie ? normalizeSpecies(String(args.especie)) : null;
    const loc = args.lugar ? await findAnyLocationByName(ctx, args.lugar) : null;
    const includeProrated = args.incluir_prorrateo !== false;
    const params = new URLSearchParams({ from, to, includeProrated: String(includeProrated) });
    if (sp) params.set("species", sp);
    if (loc) params.set("locationId", loc.id);
    const data = await ctx.api.get<any>(`/api/analisis/contabilidad-analitica?${params.toString()}`);
    return {
      periodo: { desde: data.from, hasta: data.to, incluyeProrrateo: data.includeProrated },
      totales: data.totals || null,
      porEspecie: data.bySpecies || [],
      porLugar: data.byLocation || [],
      economiaUnitaria: data.unitEconomics || null,
      roiCapex: data.capexRoi || null,
      reglasProrrateo: data.proratedRulesCount ?? 0,
    };
  },
};

const consultarKpisYAlimentacion: AgentTool = {
  name: "consultar_kpis_y_alimentacion",
  description:
    "Consulta indicadores zootécnicos y productivos (EPEF, CV%, uniformidad, ganancia diaria, HAA, ventanas de sacrificio), " +
    "el comparativo nutricional y conversión alimenticia (FCR, costo/kg ganado, alertas de forraje o vitamina C) " +
    "y la predicción de días de alimento restantes por producto.",
  parameters: {
    type: "object",
    properties: {
      dias: { type: "integer", minimum: 1, maximum: 365, description: "Período de análisis en días. Por defecto 30." },
      especie: { type: "string", description: "Filtro opcional de especie para KPIs." },
      lugar: { type: "string", description: "Filtro opcional de lugar para KPIs." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const days = args.dias ? asNumber(args.dias, "dias", { min: 1, integer: true }) : 30;
    const sp = args.especie ? normalizeSpecies(String(args.especie)) : null;
    const loc = args.lugar ? await findAnyLocationByName(ctx, args.lugar) : null;
    const params = new URLSearchParams({ days: String(days) });
    if (sp) params.set("species", sp);
    if (loc) params.set("locationId", loc.id);

    const [kpis, comp, pred] = await Promise.all([
      ctx.api.get<any>(`/api/analisis/kpis?${params.toString()}`),
      ctx.api.get<any>(`/api/produccion/alimentacion/comparativo?days=${days}`).catch(() => null),
      ctx.api.post<any>("/api/produccion/alimentacion/prediccion", { days: Math.min(days, 60) }).catch(() => null),
    ]);

    return {
      periodoDias: days,
      kpis: {
        mortalidad: kpis.mortality ?? null,
        postura: kpis.laying ?? null,
        costoUnitario: kpis.costPerUnit ?? null,
        zootecnia: kpis.zootechnical ?? null,
        roiCapex: kpis.capexRoi ?? null,
      },
      alimentacionYConversion: {
        desempenoPorEspecie: comp?.dietPerformance || [],
        comparativoProgramas: (comp?.comparativo || []).slice(0, 20),
        alertasNutricionales: comp?.nutritionAlerts || null,
      },
      prediccionInventarioAlimento: {
        resumen: pred?.summary || null,
        alertasYProyeccion: (pred?.predictions || []).slice(0, 20),
      },
    };
  },
};

const consultarContactos: AgentTool = {
  name: "consultar_contactos",
  description:
    "Consulta el directorio de clientes y proveedores activos con teléfono, WhatsApp, ubicación, plazo de crédito, saldo pendiente por cobrar/pagar y volumen comercial.",
  parameters: {
    type: "object",
    properties: {
      rol: { type: "string", enum: ["cliente", "proveedor", "ambos", "all"], description: "Filtrar por rol comercial. Por defecto all." },
      buscar: { type: "string", description: "Texto para buscar por nombre, ciudad, documento o categoría." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const role = args.rol ? String(args.rol) : "all";
    const rows = asArray<any>(await ctx.api.get(`/api/contactos?role=${encodeURIComponent(role)}&activeOnly=1&includeStats=1`));
    const needle = normalizeLookup(args.buscar);
    const filtered = needle
      ? rows.filter((c) =>
          [c.name, c.contactName, c.city, c.zone, c.documentNumber, c.categoryTag, c.phone].some((v) =>
            normalizeLookup(v).includes(needle),
          ),
        )
      : rows;
    return {
      total: filtered.length,
      contactos: filtered.slice(0, 30).map((c) => ({
        nombre: c.name,
        rol: c.role,
        contacto: c.contactName || null,
        telefono: c.phone || null,
        whatsapp: c.whatsapp || null,
        ciudad: c.city || null,
        zona: c.zone || null,
        diasCredito: c.creditDays ?? 0,
        formaPago: c.paymentMethod || null,
        porCobrarCOP: c.stats?.receivablePending ?? 0,
        porPagarCOP: c.stats?.payablePending ?? 0,
        ventasTotalesCOP: c.stats?.totalSalesAmount ?? 0,
        comprasTotalesCOP: c.stats?.totalPurchasesAmount ?? 0,
      })),
    };
  },
};

const registrarLecturaSensor: AgentTool = {
  name: "registrar_lectura_sensor",
  description:
    "Registra una lectura manual o de sensor IoT: temperatura °C, humedad %, ITH calculado automáticamente, amoníaco NH3 ppm, peso de báscula en kg o consumo de agua en litros. " +
    "Dispara alerta si ITH >= 72 o NH3 >= 20 ppm. Se ejecuta automáticamente.",
  parameters: {
    type: "object",
    properties: {
      lugar: { type: "string", description: "Nombre del galpón, corral o área. Opcional si solo hay un lugar." },
      dispositivo: { type: "string", description: "Identificador del sensor o báscula (opcional)." },
      temperatura_c: { type: "number", description: "Temperatura ambiente en °C." },
      humedad_pct: { type: "number", minimum: 0, maximum: 100, description: "Humedad relativa en %." },
      amoniaco_ppm: { type: "number", minimum: 0, description: "Concentración de amoníaco NH3 en ppm (alerta >= 20)." },
      peso_bascula_kg: { type: "number", minimum: 0.01, description: "Peso capturado por báscula en kg." },
      consumo_agua_l: { type: "number", minimum: 0.01, description: "Consumo de agua en litros." },
      notas: { type: "string" },
    },
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const location = args.lugar ? await resolveFarmLocation(ctx, args.lugar) : null;
    const hasNh3 = args.amoniaco_ppm !== undefined && args.amoniaco_ppm !== null;
    const hasScale = args.peso_bascula_kg !== undefined && args.peso_bascula_kg !== null;
    const hasWater = args.consumo_agua_l !== undefined && args.consumo_agua_l !== null;
    const hasTemp = args.temperatura_c !== undefined && args.temperatura_c !== null;
    const hasHum = args.humedad_pct !== undefined && args.humedad_pct !== null;
    if (!hasNh3 && !hasScale && !hasWater && !hasTemp && !hasHum) {
      throw new Error("Indica al menos temperatura_c, humedad_pct, amoniaco_ppm, peso_bascula_kg o consumo_agua_l.");
    }

    const base = {
      locationId: location?.id || null,
      deviceId: args.dispositivo ? String(args.dispositivo).trim() : undefined,
      notes: args.notas ? String(args.notas) : "Registrado por asistente IA",
    };

    let payload: Record<string, unknown>;
    let desc: string;
    if (hasNh3) {
      const val = asNumber(args.amoniaco_ppm, "amoniaco_ppm", { min: 0 });
      payload = { ...base, metricType: "amoniaco_ppm", value: val };
      desc = `NH3 ${val} ppm`;
    } else if (hasScale) {
      const val = asNumber(args.peso_bascula_kg, "peso_bascula_kg", { min: 0.01 });
      payload = { ...base, metricType: "peso_bascula", value: val };
      desc = `Báscula ${val} kg`;
    } else if (hasWater) {
      const val = asNumber(args.consumo_agua_l, "consumo_agua_l", { min: 0.01 });
      payload = { ...base, metricType: "consumo_agua", value: val };
      desc = `Consumo de agua ${val} L`;
    } else {
      const hum = hasHum
        ? (() => {
            const h = asNumber(args.humedad_pct, "humedad_pct", { min: 0 });
            if (h > 100) throw new Error("La humedad debe estar entre 0 y 100%");
            return h;
          })()
        : null;
      payload = {
        ...base,
        metricType: hasTemp && hasHum ? "ith" : hasTemp ? "temperatura" : "humedad",
        temperatureC: hasTemp ? asNumber(args.temperatura_c, "temperatura_c") : null,
        humidityPct: hum,
      };
      desc = [hasTemp ? `${args.temperatura_c}°C` : null, hasHum ? `${args.humedad_pct}% HR` : null].filter(Boolean).join(" / ");
    }

    return {
      args: payload,
      summary: `Registrar lectura ambiental/IoT (${desc})${location ? ` en ${location.name}` : ""}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/operaciones/sensores", args);
  },
};

const registrarReproduccion: AgentTool = {
  name: "registrar_reproduccion",
  description:
    "Registra eventos reproductivos de conejos o cuyes: empadre/monta (con bloqueo anti-consanguinidad y agenda automática de palpación/nidal/parto), " +
    "palpación, nidal, parto, diagnóstico o destete (con creación opcional de lote destetado sexado). Se ejecuta automáticamente.",
  parameters: {
    type: "object",
    properties: {
      especie: { type: "string", enum: ["conejo", "cuy"], description: "Especie mamífera: conejo o cuy." },
      tipo_evento: { type: "string", enum: ["empadre", "palpacion", "nidal", "parto", "destete", "diagnostico"] },
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      codigo_madre: { type: "string", description: "Código identificador de la madre." },
      codigo_padre: { type: "string", description: "Código identificador del macho reproductor (opcional o requerido en empadre)." },
      lugar: { type: "string", description: "Nombre del corral/jaula; necesario en destete si se crea lote nuevo." },
      resultado_palpacion: { type: "string", enum: ["positiva", "negativa", "dudosa"] },
      nacidos_vivos: { type: "integer", minimum: 0 },
      nacidos_muertos: { type: "integer", minimum: 0 },
      peso_camada_nacimiento_g: { type: "number", minimum: 0 },
      destetados_machos: { type: "integer", minimum: 0 },
      destetados_hembras: { type: "integer", minimum: 0 },
      destetados_total: { type: "integer", minimum: 0 },
      peso_camada_destete_g: { type: "number", minimum: 0 },
      proposito_lote_destete: { type: "string", enum: ["engorde_carne", "pie_cria"] },
      crear_lote_destete: { type: "boolean", description: "En destete, crea lote activo automáticamente si es true (por defecto true)." },
      numero_parto: { type: "integer", minimum: 1 },
      notas: { type: "string" },
    },
    required: ["especie", "tipo_evento", "codigo_madre"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const species = normalizeSpecies(String(args.especie));
    if (species !== "conejo" && species !== "cuy") {
      throw new Error("El evento reproductivo solo aplica para conejo o cuy.");
    }
    const eventType = String(args.tipo_evento || "").trim().toLowerCase();
    const eventDate = normalizeDate(args.fecha);
    const damCode = String(args.codigo_madre || "").trim().toUpperCase();
    if (!damCode) throw new Error("Indica el código de la madre.");
    const sireCode = args.codigo_padre ? String(args.codigo_padre).trim().toUpperCase() : null;

    const existing = asArray<any>(await ctx.api.get(`/api/produccion/reproduccion?species=${species}`));
    const matchingParent = existing.find(
      (r) => String(r.damCode || "").toUpperCase() === damCode &&
        ((eventType === "destete" && r.eventType === "parto") || (eventType !== "empadre" && r.eventType === "empadre")),
    );

    const createBatch = eventType === "destete" ? args.crear_lote_destete !== false : false;
    let locationId: string | null = null;
    let locationName: string | null = null;
    if (args.lugar || (eventType === "destete" && createBatch && !matchingParent?.locationId)) {
      const loc = await resolveFarmLocation(ctx, args.lugar, matchingParent?.locationId || null);
      locationId = loc.id;
      locationName = loc.name;
    } else if (matchingParent?.locationId) {
      locationId = matchingParent.locationId;
    }

    const body: Record<string, unknown> = {
      species,
      eventType,
      eventDate,
      damCode,
      sireCode: sireCode || matchingParent?.sireCode || null,
      locationId,
      parentEventId: matchingParent?.id || null,
      palpationResult: args.resultado_palpacion || null,
      bornAlive: args.nacidos_vivos !== undefined ? asNumber(args.nacidos_vivos, "nacidos_vivos", { min: 0, integer: true }) : null,
      bornDead: args.nacidos_muertos !== undefined ? asNumber(args.nacidos_muertos, "nacidos_muertos", { min: 0, integer: true }) : 0,
      litterBirthWeightG: args.peso_camada_nacimiento_g !== undefined ? asNumber(args.peso_camada_nacimiento_g, "peso_camada_nacimiento_g", { min: 0 }) : null,
      weanedMales: args.destetados_machos !== undefined ? asNumber(args.destetados_machos, "destetados_machos", { min: 0, integer: true }) : null,
      weanedFemales: args.destetados_hembras !== undefined ? asNumber(args.destetados_hembras, "destetados_hembras", { min: 0, integer: true }) : null,
      weanedTotal: args.destetados_total !== undefined ? asNumber(args.destetados_total, "destetados_total", { min: 0, integer: true }) : null,
      litterWeanWeightG: args.peso_camada_destete_g !== undefined ? asNumber(args.peso_camada_destete_g, "peso_camada_destete_g", { min: 0 }) : null,
      weanPurpose: args.proposito_lote_destete || "engorde_carne",
      createWeanedBatch: eventType === "destete" ? createBatch : false,
      parityNumber: args.numero_parto !== undefined ? asNumber(args.numero_parto, "numero_parto", { min: 1, integer: true }) : undefined,
      notes: args.notas ? String(args.notas) : null,
    };

    return {
      args: body,
      summary: `Registrar ${eventType} de ${species} (madre ${damCode}${sireCode ? `, padre ${sireCode}` : ""})${locationName ? ` en ${locationName}` : ""} el ${formatDateEs(eventDate)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/reproduccion", args);
  },
};

const registrarBioseguridad: AgentTool = {
  name: "registrar_bioseguridad",
  description:
    "Registra bitácora de bioseguridad y cumplimiento: POE GAB (ICA 3651/3652), bienestar animal Resolución 8452/2025 (puntaje 0/20/55/100), " +
    "capacitación del personal (vigencia 5 años), ingreso de visitantes o desinfección. Se ejecuta automáticamente.",
  parameters: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["poe_gab", "bienestar_animal", "capacitacion", "ingreso_visitante", "desinfeccion"] },
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      lugar: { type: "string", description: "Nombre del galpón/corral o vacío si aplica a toda la granja." },
      especie: { type: "string" },
      puntaje_bienestar: { type: "integer", enum: [0, 20, 55, 100], description: "Puntaje Resolución 8452/2025 cuando aplique." },
      cumplimiento: { type: "string", enum: ["cumple", "parcial", "no_cumple"] },
      inspector: { type: "string" },
      personal: { type: "string", description: "Nombre de la persona capacitada o visitante." },
      tema_capacitacion: { type: "string" },
      vigencia_certificado: { type: "string", description: "AAAA-MM-DD (por defecto +5 años en capacitaciones)." },
      desinfectante: { type: "string" },
      notas: { type: "string" },
    },
    required: ["tipo"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const date = normalizeDate(args.fecha);
    const location = args.lugar ? await resolveFarmLocation(ctx, args.lugar) : null;
    const species = args.especie ? normalizeSpecies(String(args.especie)) : null;
    const body = {
      date,
      logType: String(args.tipo),
      locationId: location?.id || null,
      species,
      welfareScore: args.puntaje_bienestar !== undefined ? Number(args.puntaje_bienestar) : null,
      complianceStatus: args.cumplimiento || undefined,
      inspectorName: args.inspector ? String(args.inspector) : null,
      staffName: args.personal ? String(args.personal) : null,
      trainingTopic: args.tema_capacitacion ? String(args.tema_capacitacion) : null,
      trainingCertificateUntil: args.vigencia_certificado ? normalizeDate(args.vigencia_certificado) : null,
      disinfectantUsed: args.desinfectante ? String(args.desinfectante) : null,
      notes: args.notas ? String(args.notas) : null,
    };
    return {
      args: body,
      summary: `Registrar bitácora de bioseguridad (${args.tipo})${location ? ` en ${location.name}` : ""} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/sanidad/bioseguridad", args);
  },
};

const registrarCompostaje: AgentTool = {
  name: "registrar_compostaje",
  description:
    "Crea una nueva pila de compostaje (fórmula 3:1:1 o 7:2:2 con cálculo automático de carbono) o registra volteo, actualización térmica/humedad " +
    "o cosecha sobre una pila existente. Se ejecuta automáticamente.",
  parameters: {
    type: "object",
    properties: {
      accion: { type: "string", enum: ["crear", "volteo", "cosecha", "actualizar"], description: "Acción a realizar. Por defecto crear." },
      pila: { type: "string", description: "Código o nombre de pila existente (requerido para volteo, cosecha o actualizar)." },
      nombre: { type: "string", description: "Nombre de la nueva pila cuando accion=crear." },
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      lugar: { type: "string", description: "Lugar asociado al compostaje (opcional)." },
      especie: { type: "string" },
      formula: { type: "string", enum: ["3:1:1", "7:2:2", "otra"] },
      gallinaza_kg: { type: "number", minimum: 0 },
      mortalidad_kg: { type: "number", minimum: 0 },
      material_carbono_kg: { type: "number", minimum: 0 },
      tipo_material_carbono: { type: "string" },
      temperatura_c: { type: "number" },
      humedad_pct: { type: "number", minimum: 0, maximum: 100 },
      cosechado_kg: { type: "number", minimum: 0.01, description: "Kg cosechados cuando accion=cosecha." },
      notas: { type: "string" },
    },
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const action = String(args.accion || "crear").toLowerCase();
    const date = normalizeDate(args.fecha);

    if (action === "crear") {
      const name = String(args.nombre || args.pila || "").trim();
      if (!name) throw new Error("Indica un nombre para la nueva pila de compostaje.");
      const manureKg = args.gallinaza_kg !== undefined ? asNumber(args.gallinaza_kg, "gallinaza_kg", { min: 0 }) : 0;
      const mortalityKg = args.mortalidad_kg !== undefined ? asNumber(args.mortalidad_kg, "mortalidad_kg", { min: 0 }) : 0;
      if (manureKg + mortalityKg <= 0) {
        throw new Error("Indica al menos gallinaza_kg o mortalidad_kg mayor a 0.");
      }
      const location = args.lugar ? await resolveFarmLocation(ctx, args.lugar) : null;
      const species = args.especie ? normalizeSpecies(String(args.especie)) : null;
      return {
        args: {
          method: "POST",
          payload: {
            name,
            startDate: date,
            locationId: location?.id || null,
            species,
            formulaRatio: args.formula || "3:1:1",
            manureKg,
            mortalityKg,
            carbonMaterialKg: args.material_carbono_kg !== undefined ? asNumber(args.material_carbono_kg, "material_carbono_kg", { min: 0 }) : undefined,
            carbonMaterialType: args.tipo_material_carbono ? String(args.tipo_material_carbono) : undefined,
            currentTempC: args.temperatura_c !== undefined ? asNumber(args.temperatura_c, "temperatura_c") : undefined,
            moisturePct: args.humedad_pct !== undefined ? asNumber(args.humedad_pct, "humedad_pct", { min: 0 }) : undefined,
            notes: args.notas ? String(args.notas) : null,
          },
        },
        summary: `Crear pila de compostaje "${name}" (${args.formula || "3:1:1"}, ${manureKg} kg cama + ${mortalityKg} kg mortalidad) el ${formatDateEs(date)}.`,
      };
    }

    const needle = normalizeLookup(args.pila || args.nombre);
    if (!needle) throw new Error("Indica el código o nombre de la pila de compostaje.");
    const data = await ctx.api.get<any>("/api/operaciones/compostaje");
    const piles = asArray<any>(data.piles);
    const exact = piles.filter((p) => normalizeLookup(p.code) === needle || normalizeLookup(p.name) === needle || p.id === args.pila);
    const matches = exact.length > 0 ? exact : piles.filter((p) => normalizeLookup(p.name).includes(needle) || normalizeLookup(p.code).includes(needle));
    if (matches.length === 0) {
      throw new Error(`No encontré la pila "${String(args.pila || args.nombre)}".`);
    }
    if (matches.length > 1) {
      throw new Error(`Varias pilas coinciden: ${matches.map((m) => `${m.code} (${m.name})`).join(", ")}. Indica el código exacto.`);
    }
    const pile = matches[0];
    const putAction = action === "volteo" ? "turn" : action === "cosecha" ? "harvest" : "update";
    const payload: Record<string, unknown> = {
      id: pile.id,
      action: putAction,
      actionDate: date,
      currentTempC: args.temperatura_c !== undefined ? asNumber(args.temperatura_c, "temperatura_c") : undefined,
      moisturePct: args.humedad_pct !== undefined ? asNumber(args.humedad_pct, "humedad_pct", { min: 0 }) : undefined,
      notes: args.notas ? String(args.notas) : undefined,
    };
    if (putAction === "harvest") {
      payload.harvestedKg = asNumber(args.cosechado_kg, "cosechado_kg", { min: 0.01 });
    }
    return {
      args: { method: "PUT", payload },
      summary: `Registrar ${action} en pila de compostaje ${pile.code} (${pile.name}) el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    if (args.method === "PUT") return ctx.api.put("/api/operaciones/compostaje", args.payload);
    return ctx.api.post("/api/operaciones/compostaje", args.payload);
  },
};

const registrarIncubacion: AgentTool = {
  name: "registrar_incubacion",
  description:
    "Inicia una tanda de incubación para huevos de gallina (con o sin gallina clueca/gallo), codorniz o pato, calculando parada de volteo y fecha de eclosión. Se ejecuta automáticamente.",
  parameters: {
    type: "object",
    properties: {
      especie: { type: "string", enum: ["gallina", "codorniz", "pato"], description: "Por defecto gallina." },
      huevos_incubados: { type: "integer", minimum: 1 },
      fecha_inicio: { type: "string", description: "AAAA-MM-DD. Por defecto hoy." },
      gallina: { type: "string", description: "Código de gallina empollando (solo gallina, opcional)." },
      gallo: { type: "string", description: "Código de gallo padre (opcional)." },
      lote: { type: "string", description: "Código del lote origen (opcional)." },
      lugar: { type: "string", description: "Nombre del lugar donde está la incubadora o nidal (opcional)." },
      incubadora: { type: "string", description: "Nombre o código de incubadora." },
      bandeja: { type: "string", description: "Código de bandeja." },
      huevos_fertiles: { type: "integer", minimum: 0 },
      huevos_descartados: { type: "integer", minimum: 0 },
      temperatura_c: { type: "number" },
      humedad_pct: { type: "number", minimum: 0, maximum: 100 },
      notas: { type: "string" },
    },
    required: ["huevos_incubados"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const species = args.especie ? normalizeSpecies(String(args.especie)) || "gallina" : "gallina";
    if (!["gallina", "codorniz", "pato"].includes(species)) {
      throw new Error("Solo se pueden incubar huevos de gallina, codorniz o pato.");
    }
    const eggsSet = asNumber(args.huevos_incubados, "huevos_incubados", { min: 1, integer: true });
    const startDate = normalizeDate(args.fecha_inicio);

    let henId: string | null = null;
    let roosterId: string | null = null;
    let batchId: string | null = null;
    let preferredLocId: string | null = null;

    if (args.gallina) {
      if (species !== "gallina") throw new Error("Solo se asigna gallina individual en incubación de gallina.");
      const hens = activeHens(await loadHens(ctx));
      const hen = findByIdOrCode(hens, String(args.gallina));
      if (!hen) throw new Error(`No encontré la gallina activa ${args.gallina}.`);
      henId = hen.id;
      preferredLocId = hen.locationId || null;
    }
    if (args.gallo) {
      const roosters = activeRoosters(await loadRoosters(ctx));
      const rooster = findByIdOrCode(roosters, String(args.gallo));
      if (!rooster) throw new Error(`No encontré el gallo activo ${args.gallo}.`);
      roosterId = rooster.id;
    }
    if (args.lote) {
      const batches = activeBatches(await loadBatches(ctx));
      const batch = findByIdOrCode(batches, String(args.lote));
      if (!batch || batch.species !== species) throw new Error(`No encontré el lote activo de ${species} con código ${args.lote}.`);
      batchId = batch.id;
      preferredLocId = preferredLocId || batch.locationId || null;
    }
    const location = args.lugar || preferredLocId ? await resolveFarmLocation(ctx, args.lugar, preferredLocId) : null;

    const body: Record<string, unknown> = {
      species,
      eggsSet,
      startDate,
      henId,
      roosterId,
      batchId,
      locationId: location?.id || null,
      incubatorName: args.incubadora ? String(args.incubadora) : null,
      trayCode: args.bandeja ? String(args.bandeja) : null,
      fertileEggs: args.huevos_fertiles !== undefined ? asNumber(args.huevos_fertiles, "huevos_fertiles", { min: 0, integer: true }) : null,
      discardedEggs: args.huevos_descartados !== undefined ? asNumber(args.huevos_descartados, "huevos_descartados", { min: 0, integer: true }) : 0,
      tempTargetC: args.temperatura_c !== undefined ? asNumber(args.temperatura_c, "temperatura_c") : undefined,
      humidityTargetPct: args.humedad_pct !== undefined ? asNumber(args.humedad_pct, "humedad_pct", { min: 0 }) : undefined,
      notes: args.notas ? String(args.notas) : null,
    };

    return {
      args: body,
      summary: `Iniciar incubación de ${eggsSet} huevos de ${species}${location ? ` en ${location.name}` : ""} desde el ${formatDateEs(startDate)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/incubacion", args);
  },
};

const completarRutinaCalendario: AgentTool = {
  name: "completar_rutina_calendario",
  description:
    "Confirma con evidencia de campo (observación obligatoria de al menos 5 caracteres) una tarea manual o de verificación sin novedad del calendario unificado (ej. '0 bajas hoy', 'Recarga física'). NO sirve para tareas que requieren registro real en BD (huevos, alimento, pesaje, bioseguridad, cierre): para esas debes usar la herramienta del módulo correspondiente.",
  parameters: {
    type: "object",
    properties: {
      tarea: { type: "string", description: "Nombre o ID de la tarea del día." },
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      completada: { type: "boolean", description: "true para completar (por defecto), false para desmarcar." },
      nota: { type: "string", description: "Evidencia u observación real en campo (obligatoria al confirmar, mínimo 5 caracteres; ej. '0 bajas · aves activas, agua y cama OK')." },
    },
    required: ["tarea"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const date = normalizeDate(args.fecha);
    const data = await ctx.api.get<any>("/api/planeacion/calendario");
    const needle = normalizeLookup(args.tarea);
    const candidates = asArray<any>(data.allEvents).filter((ev) => ev.date === date);
    const exact = candidates.filter(
      (ev) => normalizeLookup(ev.title) === needle || ev.id === args.tarea || ev.routineTaskId === args.tarea,
    );
    const matches = exact.length > 0
      ? exact
      : candidates.filter((ev) => normalizeLookup(ev.title).includes(needle));
    if (matches.length === 0) {
      throw new Error(`No encontré la tarea "${String(args.tarea)}" para el ${date}. Usa consultar_calendario_rutinas para ver las tareas del día.`);
    }
    if (matches.length > 1) {
      throw new Error(`Varias tareas coinciden: ${matches.map((m) => m.title).join(", ")}. Indica el nombre completo.`);
    }
    const target = matches[0];
    if (target.verificationMode === "record_required") {
      throw new Error(
        `La tarea "${target.title}" requiere un registro real en su módulo (${target.actionLabel}). Registra primero el dato en el sistema en lugar de marcarla manualmente.`,
      );
    }
    const taskId = String(target.routineTaskId || target.id);
    const completed = args.completada !== false;
    const note = args.nota ? String(args.nota).trim() : "";
    if (completed && note.length < 5) {
      throw new Error(
        `Debes incluir una observación/evidencia de campo real (mínimo 5 caracteres) en "nota" para confirmar "${target.title}".`,
      );
    }
    return {
      args: { date, taskId, completed, note: note || undefined },
      summary: `${completed ? "Confirmar con evidencia" : "Desmarcar"} tarea "${target.title}" del ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/planeacion/calendario", args);
  },
};

const registrarControlSanitario: AgentTool = {
  name: "registrar_control_sanitario",
  description:
    "Registra una vacunación (con lote, laboratorio, vencimiento, vía y temperatura de cadena de frío), tratamiento, desparasitación, revisión o brote sanitario. Se ejecuta automáticamente.",
  parameters: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["vacunacion", "tratamiento", "desparasitacion", "revision", "brote"] },
      descripcion: { type: "string", description: "Descripción de la vacuna, tratamiento o revisión." },
      lugar: { type: "string", description: "Nombre del galpón/corral donde se aplicó (si hay varios lugares, es obligatorio)." },
      especie: { type: "string" },
      lote: { type: "string", description: "Código del lote tratado (opcional)." },
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      producto: { type: "string", description: "Nombre comercial de vacuna o medicamento." },
      dias_retiro: { type: "integer", minimum: 0, description: "Días de retiro en carne o huevo." },
      lote_vacuna: { type: "string" },
      laboratorio_vacuna: { type: "string" },
      vencimiento_vacuna: { type: "string", description: "AAAA-MM-DD." },
      temperatura_frio_c: { type: "number", description: "Temperatura de cadena de frío en °C (ideal 2 a 8 °C)." },
      via_administracion: { type: "string", description: "Ej. ocular, agua_bebida, subcutanea, muscular." },
      proxima_fecha: { type: "string", description: "Próxima dosis AAAA-MM-DD." },
      aves_afectadas: { type: "string", description: "Códigos de gallinas afectadas si tipo=tratamiento." },
      notas: { type: "string" },
    },
    required: ["tipo", "descripcion"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args, ctx) {
    const date = normalizeDate(args.fecha);
    const description = String(args.descripcion || "").trim();
    if (!description) throw new Error("Indica la descripción del control sanitario.");
    let batch: BatchRow | undefined;
    if (args.lote) {
      const batches = activeBatches(await loadBatches(ctx));
      batch = findByIdOrCode(batches, String(args.lote));
      if (!batch) throw new Error(`No encontré el lote activo ${args.lote}.`);
    }
    const location = await resolveFarmLocation(ctx, args.lugar, batch?.locationId || null);
    const species = args.especie ? normalizeSpecies(String(args.especie)) : batch?.species || null;

    const body: Record<string, unknown> = {
      date,
      locationId: location.id,
      species,
      batchId: batch?.id || null,
      type: String(args.tipo),
      description,
      product: args.producto ? String(args.producto) : null,
      withdrawalDays: args.dias_retiro !== undefined ? asNumber(args.dias_retiro, "dias_retiro", { min: 0, integer: true }) : 0,
      vaccineLot: args.lote_vacuna ? String(args.lote_vacuna) : null,
      vaccineLab: args.laboratorio_vacuna ? String(args.laboratorio_vacuna) : null,
      vaccineExpiryDate: args.vencimiento_vacuna ? normalizeDate(args.vencimiento_vacuna) : null,
      coldChainTempC: args.temperatura_frio_c !== undefined ? asNumber(args.temperatura_frio_c, "temperatura_frio_c") : null,
      administrationRoute: args.via_administracion ? String(args.via_administracion) : null,
      nextScheduled: args.proxima_fecha ? normalizeDate(args.proxima_fecha) : null,
      affectedHens: args.aves_afectadas ? String(args.aves_afectadas) : null,
      notes: args.notas ? String(args.notas) : null,
    };

    return {
      args: body,
      summary: `Registrar ${args.tipo} sanitario "${description}" en ${location.name}${batch ? ` (lote ${batch.code})` : ""} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/sanidad/control", args);
  },
};

const registrarContacto: AgentTool = {
  name: "registrar_contacto",
  description:
    "Registra o actualiza en el directorio un cliente, proveedor o contacto mixto con teléfono, WhatsApp, ubicación y días de crédito. Se ejecuta automáticamente.",
  parameters: {
    type: "object",
    properties: {
      nombre: { type: "string", description: "Nombre completo o razón social." },
      rol: { type: "string", enum: ["cliente", "proveedor", "ambos"], description: "Por defecto cliente." },
      telefono: { type: "string" },
      whatsapp: { type: "string" },
      correo: { type: "string" },
      direccion: { type: "string" },
      ciudad: { type: "string" },
      zona: { type: "string" },
      dias_credito: { type: "integer", minimum: 0 },
      forma_pago: { type: "string" },
      fusionar_si_existe: { type: "boolean", description: "Si ya existe el nombre, actualiza/fusiona rol si es true." },
      notas: { type: "string" },
    },
    required: ["nombre"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async prepare(args) {
    const name = String(args.nombre || "").trim();
    if (!name) throw new Error("Indica el nombre o razón social del contacto.");
    const role = args.rol ? String(args.rol) : "cliente";
    const body = {
      name,
      role,
      phone: args.telefono ? String(args.telefono) : null,
      whatsapp: args.whatsapp ? String(args.whatsapp) : null,
      email: args.correo ? String(args.correo) : null,
      address: args.direccion ? String(args.direccion) : null,
      city: args.ciudad ? String(args.ciudad) : null,
      zone: args.zona ? String(args.zona) : null,
      creditDays: args.dias_credito !== undefined ? asNumber(args.dias_credito, "dias_credito", { min: 0, integer: true }) : 0,
      paymentMethod: args.forma_pago ? String(args.forma_pago) : null,
      mergeIfExists: args.fusionar_si_existe === true,
      notes: args.notas ? String(args.notas) : null,
    };
    return {
      args: body,
      summary: `Registrar ${role} "${name}"${args.telefono ? ` (${args.telefono})` : ""}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/contactos", args);
  },
};

const registrarProrrateo: AgentTool = {
  name: "registrar_prorrateo",
  description:
    "Propone prorratear un costo indirecto o gasto compartido entre especies y lugares según cabezas vivas, biomasa, consumo de alimento o área (m²). Requiere confirmación del usuario.",
  parameters: {
    type: "object",
    properties: {
      titulo: { type: "string", description: "Concepto del gasto compartido (ej. 'Energía eléctrica octubre')." },
      monto_total: { type: "number", minimum: 1, description: "Monto total en COP a repartir." },
      criterio: { type: "string", enum: ["head_count", "biomass", "feed_kg", "area_m2", "manual"], description: "Criterio de distribución automática. Por defecto head_count." },
      categoria: { type: "string", description: "Ej. 'Energía / Servicios', 'Mano de obra', 'Mantenimiento general'." },
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      periodo_desde: { type: "string", description: "AAAA-MM-DD opcional." },
      periodo_hasta: { type: "string", description: "AAAA-MM-DD opcional." },
      notas: { type: "string" },
    },
    required: ["titulo", "monto_total"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args) {
    const title = String(args.titulo || "").trim();
    if (!title) throw new Error("Indica el título o concepto del prorrateo.");
    const totalAmount = asNumber(args.monto_total, "monto_total", { min: 1 });
    const basis = String(args.criterio || "head_count");
    const date = normalizeDate(args.fecha);
    const basisLabel: Record<string, string> = {
      head_count: "animales vivos",
      biomass: "biomasa (kg)",
      feed_kg: "consumo de alimento (kg)",
      area_m2: "área de instalaciones (m²)",
      manual: "asignación manual",
    };
    return {
      args: {
        title,
        totalAmount,
        basis,
        expenseCategory: args.categoria ? String(args.categoria) : "Costos indirectos",
        date,
        periodFrom: args.periodo_desde ? normalizeDate(args.periodo_desde) : undefined,
        periodTo: args.periodo_hasta ? normalizeDate(args.periodo_hasta) : undefined,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Prorratear ${formatCop(totalAmount)} ("${title}") por ${basisLabel[basis] || basis} con fecha ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/finanzas/prorrateo", args);
  },
};

const registrarCierreDiario: AgentTool = {
  name: "registrar_cierre_diario",
  description:
    "Propone ejecutar el cierre diario auditable de una fecha (bloquea ediciones de esa jornada hasta reapertura por Propietario/Admin). Requiere confirmación del usuario.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD a cerrar. Por defecto hoy." },
      notas: { type: "string" },
    },
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args, ctx) {
    const date = normalizeDate(args.fecha);
    const data = await ctx.api.get<any>(`/api/operaciones/cierre-diario?date=${encodeURIComponent(date)}`);
    const existing = asArray<any>(data.closures).find((c) => c.closureDate === date);
    if (existing?.status === "cerrado") {
      throw new Error(`El día ${formatDateEs(date)} ya se encuentra cerrado.`);
    }
    const p = data.preview || {};
    const detail = [
      p.eggsCollected != null ? `${p.eggsCollected} huevos` : null,
      p.feedKg != null ? `${p.feedKg} kg alimento` : null,
      p.mortalityCount != null ? `${p.mortalityCount} bajas` : null,
      p.salesIncomeCOP != null ? `ventas ${formatCop(Number(p.salesIncomeCOP))}` : null,
    ].filter(Boolean).join(", ");
    return {
      args: { closureDate: date, notes: args.notas ? String(args.notas) : null },
      summary: `Ejecutar cierre diario auditable del ${formatDateEs(date)}${detail ? ` (${detail})` : ""}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/operaciones/cierre-diario", args);
  },
};


// ─── Conocimiento, memoria persistente y consultas avanzadas ───

const consultarConocimiento: AgentTool = {
  name: "consultar_conocimiento",
  description:
    "Busca en el manual operativo completo de El Gallinero (43 guías reales de pantallas/flujos) y normas técnicas " +
    "colombianas (NTC 1240, Res. ICA 3651/8452, retiro vacunal, ITH/NH3, compostaje AGROSAVIA 3:1:1/7:2:2, ciclos cuy/conejo).",
  parameters: {
    type: "object",
    properties: {
      pregunta: { type: "string", description: "Tema, duda operativa, norma técnica o flujo a consultar." },
      modulo: { type: "string", description: "Filtro opcional de módulo (sanidad, produccion, finanzas, compostaje, etc.)." },
      limite: { type: "integer", minimum: 1, maximum: 6, description: "Cantidad máxima de guías a devolver (por defecto 3)." },
    },
    required: ["pregunta"],
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args) {
    const query = String(args.pregunta || "").trim();
    if (!query) throw new Error("Indica qué tema o procedimiento deseas consultar.");
    return searchFarmKnowledge(query, {
      modulo: args.modulo ? String(args.modulo) : undefined,
      limit: args.limite != null ? Number(args.limite) : 3,
      rerankFn: (q, cands) => jevRerankCandidates({ query: q, candidates: cands }),
    });
  },
};

const consultarMemoriaGranja: AgentTool = {
  name: "consultar_memoria_granja",
  description:
    "Consulta hechos duraderos, preferencias del usuario, reglas internas de la granja, proveedores habituales " +
    "o notas guardadas en memoria persistente entre conversaciones.",
  parameters: {
    type: "object",
    properties: {
      consulta: { type: "string", description: "Texto o entidad a buscar en la memoria persistente." },
      categoria: {
        type: "string",
        enum: ["preferencia", "protocolo", "proveedor", "comprador", "instalacion", "lote", "restriccion", "hecho"],
      },
      limite: { type: "integer", minimum: 1, maximum: 30 },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const mem = await import("./memory");
    const limit = args.limite != null ? Number(args.limite) : 10;
    const records = args.consulta
      ? await mem.recallRelevantMemories(ctx.userId, String(args.consulta), limit)
      : await mem.listFarmMemories(ctx.userId, args.categoria ? String(args.categoria) : undefined, limit);
    return {
      total: records.length,
      memorias: records.map((r) => ({
        id: r.id,
        categoria: r.category,
        clave: r.subjectKey,
        contenido: r.content,
        entidades: r.entities,
        importancia: r.importance,
        actualizado: r.updatedAt,
      })),
    };
  },
};

const recordarDatoGranja: AgentTool = {
  name: "recordar_dato_granja",
  description:
    "Guarda o actualiza un hecho duradero en la memoria persistente de la granja (preferencias de respuesta, reglas " +
    "internas, acuerdos con compradores/proveedores, peculiaridades de un galpón o lote).",
  parameters: {
    type: "object",
    properties: {
      contenido: { type: "string", description: "Hecho, regla o preferencia clara a recordar en el futuro." },
      categoria: {
        type: "string",
        enum: ["preferencia", "protocolo", "proveedor", "comprador", "instalacion", "lote", "restriccion", "hecho"],
      },
      clave: { type: "string", description: "Identificador corto único (ej: 'comprador_laura', 'formato_reporte')." },
      importancia: { type: "integer", minimum: 1, maximum: 5, description: "1=baja, 3=normal, 5=crítica." },
    },
    required: ["contenido"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const mem = await import("./memory");
    const content = String(args.contenido || "").trim();
    const saved = await mem.saveFarmMemory({
      userId: ctx.userId,
      category: args.categoria ? String(args.categoria) : mem.normalizeMemoryCategory(content),
      subjectKey: args.clave ? String(args.clave) : content.split(/\s+/).slice(0, 6).join("_"),
      content,
      importance: args.importancia != null ? Number(args.importancia) : 4,
      sourceConversationId: ctx.conversationId || null,
    });
    return { ok: true, id: saved.id, categoria: saved.category, clave: saved.subjectKey, contenido: saved.content };
  },
};

const consultarProgramasNutricion: AgentTool = {
  name: "consultar_programas_nutricion",
  description:
    "Consulta las etapas de crecimiento configuradas, conteo de animales por etapa, raciones diarias, materia seca, " +
    "proteína cruda y necesidad proyectada de alimento y postura.",
  parameters: {
    type: "object",
    properties: {
      dias: { type: "integer", minimum: 1, maximum: 90, description: "Horizonte en días para proyectar stock necesario (por defecto 7)." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const days = args.dias != null ? Number(args.dias) : 7;
    const [etapas, resumen] = await Promise.all([
      ctx.api.get<any>("/api/produccion/etapas"),
      ctx.api.get<any>(`/api/produccion/etapas/resumen?days=${days}`).catch(() => null),
    ]);
    return { etapas, resumen };
  },
};

const consultarPresupuestos: AgentTool = {
  name: "consultar_presupuestos",
  description:
    "Consulta presupuestos configurados y su comparativo real vs meta por categoría financiera (variación en COP y %).",
  parameters: {
    type: "object",
    properties: {
      presupuesto: { type: "string", description: "Nombre o ID opcional de un presupuesto para ver su detalle comparativo." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const budgets = asArray<any>(await ctx.api.get("/api/presupuestos"));
    let selected = budgets[0] || null;
    if (args.presupuesto) {
      const needle = normalizeLookup(args.presupuesto);
      selected =
        budgets.find((b) => b.id === args.presupuesto || normalizeLookup(b.name).includes(needle)) || selected;
    }
    const comparativo = selected
      ? await ctx.api.get<any>(`/api/presupuestos/comparativo?budgetId=${encodeURIComponent(selected.id)}`).catch(() => null)
      : null;
    return { total: budgets.length, presupuestos: budgets, comparativo };
  },
};

const consultarCuentasPendientes: AgentTool = {
  name: "consultar_cuentas_pendientes",
  description:
    "Consulta cartera por cobrar (clientes) y cuentas por pagar (proveedores) con saldos pendientes, vencimientos y días de mora.",
  parameters: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["ambas", "cobrar", "pagar"], description: "Por defecto 'ambas'." },
      solo_pendientes: { type: "boolean", description: "Si es true (por defecto), filtra solo cuentas no pagadas." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const tipo = String(args.tipo || "ambas");
    const onlyOpen = args.solo_pendientes !== false;
    const [cobrarRaw, pagarRaw] = await Promise.all([
      tipo === "pagar" ? Promise.resolve([]) : ctx.api.get<any>("/api/cuentas-cobrar"),
      tipo === "cobrar" ? Promise.resolve([]) : ctx.api.get<any>("/api/cuentas-pagar"),
    ]);
    const cobrar = asArray<any>(cobrarRaw).filter((a) => !onlyOpen || a.status !== "pagado");
    const pagar = asArray<any>(pagarRaw).filter((a) => !onlyOpen || a.status !== "pagado");
    return {
      resumen: {
        porCobrarCop: cobrar.reduce((s, r) => s + Number(r.pendingAmount || 0), 0),
        porCobrarVencidas: cobrar.filter((r) => r.isOverdue).length,
        porPagarCop: pagar.reduce((s, r) => s + Number(r.pendingAmount || 0), 0),
        porPagarVencidas: pagar.filter((r) => r.isOverdue).length,
      },
      cuentasPorCobrar: cobrar.slice(0, 30),
      cuentasPorPagar: pagar.slice(0, 30),
    };
  },
};


const gestionarLugar: AgentTool = {
  name: "gestionar_lugar",
  description:
    "Crea o actualiza un lugar de manejo (corral, jaula, galpón, potrero, bodega, cuarentena, compostaje), su capacidad, estado sanitario o especies permitidas. Requiere confirmación.",
  parameters: {
    type: "object",
    properties: {
      accion: { type: "string", enum: ["crear", "actualizar"], description: "'crear' o 'actualizar'." },
      lugar_actual: { type: "string", description: "Nombre o código del lugar existente cuando accion='actualizar'." },
      nombre: { type: "string", description: "Nombre del lugar." },
      tipo: {
        type: "string",
        enum: ["corral", "jaula", "galpon", "potrero", "jardin", "patio", "compostaje", "bodega", "cuarentena", "otro"],
      },
      capacidad: { type: "integer", minimum: 0 },
      area_m2: { type: "number", minimum: 0 },
      zona: { type: "string", enum: ["limpia", "sucia", "produccion", "cuarentena", "almacen", "forraje"] },
      estado_operativo: { type: "string", enum: ["operativa", "mantenimiento", "restringida", "fuera_servicio"] },
      estado_sanitario: { type: "string", enum: ["pendiente_revision", "cumple", "requiere_atencion", "no_cumple"] },
      especies_permitidas: { type: "array", items: { type: "string" } },
      piso: { type: "string", enum: ["tierra", "cemento", "cama_profunda", "jaula_elevada", "pasto", "mixto"] },
      vacio_sanitario_hasta: { type: "string", description: "YYYY-MM-DD" },
      notas: { type: "string" },
    },
    required: ["accion"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args, ctx) {
    const accion = args.accion === "actualizar" ? "actualizar" : "crear";
    if (accion === "actualizar") {
      const all = asArray<any>(await ctx.api.get("/api/ubicaciones"));
      const needle = normalizeLookup(args.lugar_actual || args.nombre);
      const found = all.find(
        (l) => l.id === args.lugar_actual || normalizeLookup(l.code) === needle || normalizeLookup(l.name) === needle || normalizeLookup(l.name).includes(needle),
      );
      if (!found) throw new Error(`No encontré el lugar "${args.lugar_actual || args.nombre}" para actualizar.`);
      const payload = {
        id: found.id,
        name: args.nombre ? String(args.nombre).trim() : found.name,
        type: args.tipo || found.type,
        capacity: args.capacidad !== undefined ? Number(args.capacidad) : found.capacity,
        areaM2: args.area_m2 !== undefined ? Number(args.area_m2) : found.areaM2,
        zoneType: args.zona || found.zoneType,
        operationalStatus: args.estado_operativo || found.operationalStatus,
        sanitaryStatus: args.estado_sanitario || found.sanitaryStatus,
        allowedSpecies: Array.isArray(args.especies_permitidas) ? args.especies_permitidas : found.allowedSpecies,
        floorType: args.piso || found.floorType,
        sanitaryEmptyUntil: args.vacio_sanitario_hasta !== undefined ? args.vacio_sanitario_hasta : found.sanitaryEmptyUntil,
        notes: args.notas !== undefined ? String(args.notas) : found.notes,
        status: found.status || "activa",
      };
      return {
        args: { _method: "PUT", payload },
        summary: `Actualizar lugar ${found.name} (${found.code}) -> estado operativo ${payload.operationalStatus}, sanitario ${payload.sanitaryStatus}${payload.capacity != null ? `, capacidad ${payload.capacity}` : ""}.`,
      };
    }

    if (!args.nombre || !args.tipo) {
      throw new Error("Para crear un lugar indica al menos nombre y tipo (galpon, corral, jaula, etc.).");
    }
    const payload = {
      name: String(args.nombre).trim(),
      type: String(args.tipo),
      capacity: args.capacidad !== undefined ? Number(args.capacidad) : undefined,
      areaM2: args.area_m2 !== undefined ? Number(args.area_m2) : undefined,
      zoneType: args.zona || undefined,
      operationalStatus: args.estado_operativo || "operativa",
      sanitaryStatus: args.estado_sanitario || "pendiente_revision",
      allowedSpecies: Array.isArray(args.especies_permitidas) ? args.especies_permitidas : [],
      floorType: args.piso || undefined,
      sanitaryEmptyUntil: args.vacio_sanitario_hasta || undefined,
      notes: args.notas ? String(args.notas) : undefined,
    };
    return {
      args: { _method: "POST", payload },
      summary: `Crear nuevo lugar "${payload.name}" (${payload.type})${payload.capacity != null ? ` con capacidad para ${payload.capacity} animales` : ""}.`,
    };
  },
  async execute(args, ctx) {
    return args._method === "PUT"
      ? ctx.api.put("/api/ubicaciones", args.payload)
      : ctx.api.post("/api/ubicaciones", args.payload);
  },
};

const trasladarAnimales: AgentTool = {
  name: "trasladar_animales",
  description:
    "Traslada una gallina, un gallo o un lote completo a otro lugar de manejo respetando capacidad, especies permitidas y bloqueos por retiro/vacío sanitario. Requiere confirmación.",
  parameters: {
    type: "object",
    properties: {
      tipo_animal: { type: "string", enum: ["gallina", "gallo", "lote"] },
      codigo_o_id: { type: "string", description: "Código o ID de la gallina, gallo o lote." },
      lugar_destino: { type: "string", description: "Nombre del lugar de destino activo." },
      motivo: { type: "string", description: "Motivo del traslado (máx 100 caracteres)." },
      fecha: { type: "string", description: "YYYY-MM-DD (por defecto hoy)." },
      notas: { type: "string" },
    },
    required: ["tipo_animal", "codigo_o_id", "lugar_destino", "motivo"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args, ctx) {
    const tipo = String(args.tipo_animal);
    const date = normalizeDate(args.fecha);
    const reason = String(args.motivo || "").trim();
    if (!reason || reason.length > 100) throw new Error("Indica un motivo de traslado (1–100 caracteres).");
    const destination = await resolveFarmLocation(ctx, args.lugar_destino);

    let animalId = "";
    let animalLabel = "";
    if (tipo === "gallina") {
      const list = activeHens(await loadHens(ctx));
      const hen = findByIdOrCode(list, args.codigo_o_id);
      if (!hen) throw new Error(`No encontré la gallina activa "${args.codigo_o_id}".`);
      animalId = hen.id;
      animalLabel = `Gallina ${hen.code}`;
    } else if (tipo === "gallo") {
      const list = activeRoosters(await loadRoosters(ctx));
      const rooster = findByIdOrCode(list, args.codigo_o_id);
      if (!rooster) throw new Error(`No encontré el gallo activo "${args.codigo_o_id}".`);
      animalId = rooster.id;
      animalLabel = `Gallo ${rooster.code}`;
    } else if (tipo === "lote") {
      const list = activeBatches(await loadBatches(ctx));
      const batch = findByIdOrCode(list, args.codigo_o_id);
      if (!batch) throw new Error(`No encontré el lote activo "${args.codigo_o_id}".`);
      animalId = batch.id;
      animalLabel = `Lote ${batch.code} (${batch.currentQuantity} ${batch.species})`;
    } else {
      throw new Error("tipo_animal debe ser gallina, gallo o lote.");
    }

    return {
      args: {
        animalType: tipo,
        animalId,
        toLocationId: destination.id,
        date,
        reason,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Trasladar ${animalLabel} hacia ${destination.name} el ${formatDateEs(date)} (motivo: ${reason}).`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/ubicaciones/movimientos", args);
  },
};

const registrarAdquisicion: AgentTool = {
  name: "registrar_adquisicion",
  description:
    "Registra un ingreso o adquisición de animales (compra, pollito_comprado, cria_propia o donacion) en un lugar de destino creando fichas o lote con trazabilidad. Requiere confirmación.",
  parameters: {
    type: "object",
    properties: {
      tipo_adquisicion: { type: "string", enum: ["compra", "pollito_comprado", "cria_propia", "donacion"] },
      tipo_animal: { type: "string", enum: ["gallina", "gallo", "lote_pollos", "codorniz", "pato", "conejo", "cuy"] },
      cantidad: { type: "integer", minimum: 1 },
      lugar_destino: { type: "string", description: "Nombre del lugar donde ingresan los animales." },
      costo_unitario: { type: "number", minimum: 0 },
      fecha: { type: "string", description: "YYYY-MM-DD." },
      proveedor: { type: "string" },
      raza: { type: "string" },
      proposito: { type: "string", enum: ["engorde_carne", "postura_huevo", "pie_cria", "mixto"] },
      notas: { type: "string" },
    },
    required: ["tipo_adquisicion", "tipo_animal", "cantidad", "lugar_destino"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args, ctx) {
    const qty = asNumber(args.cantidad, "cantidad", { min: 1, integer: true });
    const date = normalizeDate(args.fecha);
    const rawBird = normalizeLookup(args.tipo_animal);
    const birdType = rawBird === "pollo" || rawBird === "pollos" ? "lote_pollos" : String(args.tipo_animal);
    const rawType = normalizeLookup(args.tipo_adquisicion);
    const acqType =
      rawType === "nacimiento_propio" || rawType === "incubacion_propia" ? "cria_propia" : String(args.tipo_adquisicion);
    const noCost = acqType === "donacion" || acqType === "cria_propia";
    const unitCost = args.costo_unitario != null ? Number(args.costo_unitario) : null;
    if (!noCost && (unitCost == null || !Number.isFinite(unitCost) || unitCost <= 0)) {
      throw new Error("En compras debes indicar un costo_unitario en COP mayor que cero.");
    }
    const destination = await resolveFarmLocation(ctx, args.lugar_destino);
    const rawPurpose = normalizeLookup(args.proposito);
    const purpose = rawPurpose === "reproduccion" ? "pie_cria" : args.proposito || "engorde_carne";
    const total = !noCost && unitCost != null ? unitCost * qty : 0;

    return {
      args: {
        date,
        acquisitionType: acqType,
        birdType,
        quantity: qty,
        unitCost: noCost ? null : unitCost,
        supplier: args.proveedor ? String(args.proveedor) : null,
        breed: args.raza ? String(args.raza) : null,
        destinationLocationId: destination.id,
        purpose,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Registrar adquisición (${acqType}) de ${qty} ${birdType}${args.raza ? ` raza ${args.raza}` : ""} hacia ${destination.name}${total > 0 ? ` por total ${formatCop(total)}` : ""} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/adquisiciones", args);
  },
};

const registrarSacrificioCarne: AgentTool = {
  name: "registrar_sacrificio_carne",
  description:
    "Registra sacrificio/faena de una gallina, gallo o unidades de un lote hacia inventario de carne (consumo propio o venta), validando retiro sanitario activo y cierre diario. Requiere confirmación.",
  parameters: {
    type: "object",
    properties: {
      tipo_animal: { type: "string", enum: ["gallina", "gallo", "lote"] },
      codigo_o_id: { type: "string", description: "Código o ID del animal o lote." },
      peso_canal_kg: { type: "number", minimum: 0.1, description: "Peso total en canal (kg)." },
      cantidad: { type: "integer", minimum: 1, description: "Cantidad (1 para gallina/gallo; N para lote)." },
      destino: { type: "string", enum: ["consumo_propio", "venta"] },
      peso_vivo_kg: { type: "number", minimum: 0.1 },
      precio_referencia_kg: { type: "number", minimum: 0 },
      fecha: { type: "string", description: "YYYY-MM-DD" },
      notas: { type: "string" },
    },
    required: ["tipo_animal", "codigo_o_id", "peso_canal_kg"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args, ctx) {
    const tipo = String(args.tipo_animal);
    const date = normalizeDate(args.fecha);
    const weightKg = asNumber(args.peso_canal_kg, "peso_canal_kg", { min: 0.1 });
    const destination = args.destino === "venta" ? "venta" : "consumo_propio";

    let species = "pollo";
    let birdType = "Pollo de Engorde";
    let locationId = "";
    let qty = args.cantidad != null ? asNumber(args.cantidad, "cantidad", { min: 1, integer: true }) : 1;
    let label = "";
    const ref: Record<string, string> = {};

    if (tipo === "gallina") {
      const hen = findByIdOrCode(activeHens(await loadHens(ctx)), args.codigo_o_id);
      if (!hen || !hen.locationId) throw new Error(`Gallina "${args.codigo_o_id}" no encontrada o sin ubicación.`);
      qty = 1;
      species = "gallina";
      birdType = "Gallina";
      locationId = hen.locationId;
      ref.henId = hen.id;
      label = `gallina ${hen.code}`;
    } else if (tipo === "gallo") {
      const rooster = findByIdOrCode(activeRoosters(await loadRoosters(ctx)), args.codigo_o_id);
      if (!rooster || !rooster.locationId) throw new Error(`Gallo "${args.codigo_o_id}" no encontrado o sin ubicación.`);
      qty = 1;
      species = "gallina";
      birdType = "Gallo";
      locationId = rooster.locationId;
      ref.roosterId = rooster.id;
      label = `gallo ${rooster.code}`;
    } else {
      const batch = findByIdOrCode(activeBatches(await loadBatches(ctx)), args.codigo_o_id);
      if (!batch || !batch.locationId) throw new Error(`Lote "${args.codigo_o_id}" no encontrado o sin ubicación.`);
      if (qty > batch.currentQuantity) {
        throw new Error(`El lote ${batch.code} solo tiene ${batch.currentQuantity} animales disponibles.`);
      }
      species = batch.species || "pollo";
      birdType = species === "cuy" ? "Cuy" : species === "conejo" ? "Conejo" : species === "pato" ? "Pato" : "Pollo de Engorde";
      locationId = batch.locationId;
      ref.batchId = batch.id;
      label = `${qty} unidades de lote ${batch.code}`;
    }

    return {
      args: {
        date,
        birdType,
        species,
        quantity: qty,
        weightKg,
        locationId,
        destination,
        liveWeightKg: args.peso_vivo_kg != null ? Number(args.peso_vivo_kg) : null,
        marketReferencePricePerKg: args.precio_referencia_kg != null ? Number(args.precio_referencia_kg) : null,
        notes: args.notas ? String(args.notas) : null,
        ...ref,
      },
      summary: `Registrar sacrificio de ${label} (${weightKg} kg en canal, destino: ${destination}) el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/sacrificio", args);
  },
};


const ajustarGallinaza: AgentTool = {
  name: "ajustar_gallinaza",
  description:
    "Registra un ajuste manual de inventario de gallinaza/abono en kg (positivo por entrada/ajuste o negativo por merma). Requiere confirmación.",
  parameters: {
    type: "object",
    properties: {
      delta_kg: { type: "number", description: "Variación en kg (distinto de cero; negativo resta, positivo suma)." },
      motivo: { type: "string", description: "Justificación técnica del ajuste." },
      fecha: { type: "string", description: "YYYY-MM-DD (no futura)." },
    },
    required: ["delta_kg", "motivo"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args) {
    const deltaKg = Number(Number(args.delta_kg).toFixed(2));
    if (!Number.isFinite(deltaKg) || deltaKg === 0) throw new Error("delta_kg debe ser distinto de cero.");
    const reason = String(args.motivo || "").trim();
    if (!reason) throw new Error("Indica el motivo del ajuste de gallinaza.");
    const date = normalizeDate(args.fecha);
    return {
      args: { date, deltaKg, reason },
      summary: `Ajustar inventario de gallinaza en ${deltaKg > 0 ? `+${deltaKg}` : deltaKg} kg el ${formatDateEs(date)} (${reason}).`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/produccion/gallinaza/ajustes", args);
  },
};

const gestionarAlimento: AgentTool = {
  name: "gestionar_alimento",
  description:
    "Crea o actualiza un alimento en el catálogo/inventario (nombre, categoría, tipo, unidad, stock mínimo, costo unitario, materia seca y proteína cruda). Requiere confirmación.",
  parameters: {
    type: "object",
    properties: {
      accion: { type: "string", enum: ["crear", "actualizar"] },
      nombre: { type: "string" },
      categoria: { type: "string", enum: ["Concentrado", "En Fresco", "Preparados"] },
      tipo_alimento: {
        type: "string",
        enum: [
          "Concentrado Aves",
          "Concentrado Codorniz",
          "Concentrado Conejos",
          "Forraje Verde",
          "Maiz en Grano",
          "Maíz Germinado",
          "Bore o Raices",
          "Mosca Soldado",
          "Pastos y gramíneas",
          "Purinas",
          "Otro",
        ],
      },
      unidad: { type: "string", description: "kg, lb o litros (por defecto kg)." },
      stock_actual: { type: "number", minimum: 0 },
      stock_minimo: { type: "number", minimum: 0 },
      costo_unitario: { type: "number", minimum: 0 },
      proveedor: { type: "string" },
      materia_seca_pct: { type: "number", minimum: 1, maximum: 100 },
      proteina_cruda_pct: { type: "number", minimum: 0, maximum: 100 },
    },
    required: ["nombre"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args, ctx) {
    const existingList = asArray<any>(await ctx.api.get("/api/produccion/alimentacion?days=30"));
    const needle = normalizeLookup(args.nombre);
    const existing = existingList.find((item) => normalizeLookup(item.name) === needle);
    const isUpdate = args.accion === "actualizar" || (args.accion !== "crear" && Boolean(existing));

    if (isUpdate && !existing) {
      throw new Error(`No encontré un alimento llamado "${args.nombre}" para actualizar.`);
    }

    if (isUpdate && existing) {
      const payload = {
        id: existing.id,
        name: String(args.nombre).trim(),
        category: args.categoria || existing.category,
        feedType: args.tipo_alimento || existing.feedType,
        unit: args.unidad || existing.unit,
        currentStock: args.stock_actual !== undefined ? Number(args.stock_actual) : Number(existing.currentStock),
        minStock: args.stock_minimo !== undefined ? String(args.stock_minimo) : existing.minStock,
        costPerUnit: args.costo_unitario !== undefined ? String(args.costo_unitario) : existing.costPerUnit,
        supplier: args.proveedor !== undefined ? args.proveedor : existing.supplier,
        dryMatterPct: args.materia_seca_pct !== undefined ? Number(args.materia_seca_pct) : existing.dryMatterPct,
        crudeProteinPct: args.proteina_cruda_pct !== undefined ? Number(args.proteina_cruda_pct) : existing.crudeProteinPct,
      };
      return {
        args: { _method: "PUT", payload },
        summary: `Actualizar alimento "${payload.name}" (stock ${payload.currentStock} ${payload.unit}, costo ${formatCop(Number(payload.costPerUnit))}/${payload.unit}).`,
      };
    }

    const payload = {
      name: String(args.nombre).trim(),
      category: args.categoria || "Concentrado",
      feedType: args.tipo_alimento || "Concentrado Aves",
      unit: args.unidad || "kg",
      currentStock: args.stock_actual !== undefined ? Number(args.stock_actual) : 0,
      minStock: args.stock_minimo !== undefined ? String(args.stock_minimo) : "0",
      costPerUnit: args.costo_unitario !== undefined ? String(args.costo_unitario) : "0",
      supplier: args.proveedor || null,
      dryMatterPct: args.materia_seca_pct !== undefined ? Number(args.materia_seca_pct) : undefined,
      crudeProteinPct: args.proteina_cruda_pct !== undefined ? Number(args.proteina_cruda_pct) : undefined,
    };
    return {
      args: { _method: "POST", payload },
      summary: `Crear alimento "${payload.name}" (${payload.category} / ${payload.feedType}, stock inicial ${payload.currentStock} ${payload.unit}).`,
    };
  },
  async execute(args, ctx) {
    return args._method === "PUT"
      ? ctx.api.put("/api/produccion/alimentacion", args.payload)
      : ctx.api.post("/api/produccion/alimentacion", args.payload);
  },
};

const registrarMovimientoInsumo: AgentTool = {
  name: "registrar_movimiento_insumo",
  description:
    "Registra entrada o salida de inventario de un insumo veterinario o de operación (desinfectante, vitamina, vacuna, empaque, cal, etc.).",
  parameters: {
    type: "object",
    properties: {
      insumo: { type: "string", description: "Nombre o ID del insumo." },
      tipo: { type: "string", enum: ["entrada", "salida"] },
      cantidad: { type: "number", minimum: 0.01 },
      motivo: { type: "string", description: "compra, consumo, ajuste, vencimiento, etc." },
      fecha: { type: "string", description: "YYYY-MM-DD" },
      notas: { type: "string" },
    },
    required: ["insumo", "tipo", "cantidad"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const supplies = asArray<any>(await ctx.api.get("/api/inventarios/insumos"));
    const needle = normalizeLookup(args.insumo);
    const exact = supplies.filter((s) => s.id === args.insumo || normalizeLookup(s.name) === needle);
    const matches = exact.length > 0 ? exact : supplies.filter((s) => normalizeLookup(s.name).includes(needle));
    if (matches.length === 0) {
      throw new Error(`No encontré el insumo "${args.insumo}". Disponibles: ${supplies.slice(0, 12).map((s) => s.name).join(", ") || "ninguno"}`);
    }
    if (matches.length > 1) {
      throw new Error(`"${args.insumo}" coincide con varios insumos: ${matches.map((s) => s.name).join(", ")}. Especifica el nombre exacto.`);
    }
    const supply = matches[0];
    const qty = asNumber(args.cantidad, "cantidad", { min: 0.01 });
    const isEntry = args.tipo === "entrada";
    return ctx.api.post("/api/inventarios/insumos/movimientos", {
      supplyId: supply.id,
      quantity: qty,
      isEntry,
      movementType: String(args.motivo || (isEntry ? "entrada" : "uso_diario")),
      date: normalizeDate(args.fecha),
      notes: args.notas ? String(args.notas) : null,
    });
  },
};

const gestionarMantenimiento: AgentTool = {
  name: "gestionar_mantenimiento",
  description:
    "Crea una orden de mantenimiento para un lugar o equipo o actualiza/marca como completado un mantenimiento existente.",
  parameters: {
    type: "object",
    properties: {
      accion: { type: "string", enum: ["crear", "actualizar", "completar"] },
      id_o_titulo: { type: "string", description: "ID o título aproximado de una tarea existente si accion='actualizar'|'completar'." },
      titulo: { type: "string" },
      fecha_programada: { type: "string", description: "YYYY-MM-DD" },
      fecha_completada: { type: "string", description: "YYYY-MM-DD" },
      estado: { type: "string", enum: ["pendiente", "en_progreso", "completado"] },
      costo: { type: "number", minimum: 0 },
      lugar: { type: "string" },
      equipo: { type: "string", description: "Código o nombre del activo/equipo." },
      especie: { type: "string" },
      repeticion_dias: { type: "integer", minimum: 1, maximum: 3650 },
      descripcion: { type: "string" },
    },
    required: ["accion"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const accion = args.accion === "actualizar" || args.accion === "completar" ? args.accion : "crear";
    let locationId: string | null = null;
    if (args.lugar) {
      locationId = (await resolveFarmLocation(ctx, args.lugar)).id;
    }
    let assetId: string | null = null;
    if (args.equipo) {
      const assets = asArray<any>(await ctx.api.get("/api/operaciones/activos"));
      const needle = normalizeLookup(args.equipo);
      const foundAsset = assets.find((a) => a.id === args.equipo || normalizeLookup(a.code) === needle || normalizeLookup(a.name).includes(needle));
      if (!foundAsset) throw new Error(`No encontré el activo/equipo "${args.equipo}".`);
      assetId = foundAsset.id;
    }

    if (accion !== "crear") {
      const tasks = asArray<any>(await ctx.api.get("/api/operaciones/mantenimiento"));
      const needle = normalizeLookup(args.id_o_titulo || args.titulo);
      const existing = tasks.find((t) => t.id === args.id_o_titulo || normalizeLookup(t.title).includes(needle));
      if (!existing) throw new Error(`No encontré la orden de mantenimiento "${args.id_o_titulo || args.titulo}".`);
      const nextStatus = accion === "completar" ? "completado" : args.estado || existing.status;
      return ctx.api.put("/api/operaciones/mantenimiento", {
        id: existing.id,
        title: args.titulo ? String(args.titulo).trim() : existing.title,
        description: args.descripcion !== undefined ? String(args.descripcion) : existing.description,
        scheduledDate: args.fecha_programada ? normalizeDate(args.fecha_programada) : existing.scheduledDate,
        completedDate:
          nextStatus === "completado"
            ? normalizeDate(args.fecha_completada || todayISO())
            : args.fecha_completada || existing.completedDate || null,
        status: nextStatus,
        cost: args.costo !== undefined ? Number(args.costo) : Number(existing.cost || 0),
        locationId: locationId || existing.locationId || null,
        assetId: assetId || existing.assetId || null,
        species: args.especie !== undefined ? normalizeSpecies(String(args.especie)) : existing.species,
        recurrenceIntervalDays:
          args.repeticion_dias !== undefined ? Number(args.repeticion_dias) : existing.recurrenceIntervalDays,
      });
    }

    if (!args.titulo) throw new Error("Indica un título para crear la orden de mantenimiento.");
    return ctx.api.post("/api/operaciones/mantenimiento", {
      title: String(args.titulo).trim(),
      description: args.descripcion ? String(args.descripcion) : null,
      scheduledDate: normalizeDate(args.fecha_programada),
      completedDate: args.estado === "completado" ? normalizeDate(args.fecha_completada || todayISO()) : null,
      status: args.estado || "pendiente",
      cost: args.costo !== undefined ? Number(args.costo) : 0,
      locationId,
      assetId,
      species: args.especie ? normalizeSpecies(String(args.especie)) : null,
      recurrenceIntervalDays: args.repeticion_dias != null ? Number(args.repeticion_dias) : null,
    });
  },
};

const registrarPagoCuenta: AgentTool = {
  name: "registrar_pago_cuenta",
  description:
    "Registra un cobro (abono de cliente a cuenta por cobrar) o un pago (abono a proveedor de cuenta por pagar). Requiere confirmación.",
  parameters: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["cobro", "pago"] },
      cuenta_id: { type: "string", description: "UUID opcional de la cuenta específica." },
      tercero: { type: "string", description: "Nombre del cliente (para cobro) o proveedor (para pago)." },
      monto: { type: "number", minimum: 1 },
      metodo: { type: "string", enum: ["efectivo", "transferencia", "nequi", "daviplata", "credito", "otro"] },
      referencia: { type: "string" },
      fecha: { type: "string", description: "YYYY-MM-DD" },
      notas: { type: "string" },
    },
    required: ["tipo", "monto"],
    additionalProperties: false,
  },
  kind: "write",
  requiresConfirmation: true,
  async prepare(args, ctx) {
    const tipo = args.tipo === "cobro" ? "cobro" : "pago";
    const amount = asNumber(args.monto, "monto", { min: 1 });
    const date = normalizeDate(args.fecha);
    const endpoint = tipo === "cobro" ? "/api/cuentas-cobrar" : "/api/cuentas-pagar";
    const list = asArray<any>(await ctx.api.get(endpoint)).filter((a) => a.status !== "pagado");
    const needle = normalizeLookup(args.tercero);

    let account: any;
    if (args.cuenta_id) {
      account = list.find((a) => a.id === args.cuenta_id);
    } else if (needle) {
      const matches = list.filter((a) => {
        const name = tipo === "cobro" ? a.buyer : a.supplier;
        return normalizeLookup(name).includes(needle);
      });
      if (matches.length === 1) {
        account = matches[0];
      } else if (matches.length > 1) {
        const sorted = matches.sort((a, b) => Number(a.pendingAmount || 0) - Number(b.pendingAmount || 0));
        const exactAmt = sorted.find((a) => Number(a.pendingAmount) >= amount);
        if (exactAmt && sorted.filter((a) => Number(a.pendingAmount) >= amount).length === 1) {
          account = exactAmt;
        } else {
          throw new Error(
            `Hay ${matches.length} cuentas pendientes de "${args.tercero}". Indica el cuenta_id o primero usa consultar_cuentas_pendientes.`,
          );
        }
      }
    }

    if (!account) {
      throw new Error(`No encontré una cuenta pendiente de ${tipo} ${args.tercero ? `para "${args.tercero}"` : "con ese ID"}.`);
    }
    const pending = Number(account.pendingAmount || 0);
    if (amount > pending) {
      throw new Error(`El monto (${formatCop(amount)}) supera el saldo pendiente de la cuenta (${formatCop(pending)}).`);
    }
    const party = tipo === "cobro" ? account.buyer : account.supplier;
    return {
      args: {
        date,
        type: tipo,
        receivableId: tipo === "cobro" ? account.id : undefined,
        payableId: tipo === "pago" ? account.id : undefined,
        amount,
        method: args.metodo || "efectivo",
        reference: args.referencia ? String(args.referencia) : null,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Registrar ${tipo} de ${formatCop(amount)} a "${party}" (saldo actual ${formatCop(pending)}, método ${args.metodo || "efectivo"}) el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/pagos", args);
  },
};

// ─── Registro de herramientas ───


export const AGENT_TOOLS: AgentTool[] = [
  consultarResumenGranja,
  consultarInventario,
  consultarAves,
  consultarUbicaciones,
  consultarTrazabilidadGenetica,
  consultarMantenimiento,
  consultarActivos,
  consultarProduccion,
  consultarFinanzas,
  consultarLotes,
  consultarSanidad,
  consultarParametros,
  consultarAlimentos,
  consultarReproduccion,
  consultarBioseguridad,
  consultarCompostaje,
  consultarCierreYSensores,
  consultarIncubacion,
  consultarCalendarioRutinas,
  consultarContabilidadAnalitica,
  consultarKpisYAlimentacion,
  consultarContactos,
  registrarProduccionHuevos,
  registrarMortalidad,
  registrarPeso,
  registrarConsumoAlimento,
  registrarAutoconsumo,
  registrarLecturaSensor,
  registrarReproduccion,
  registrarBioseguridad,
  registrarCompostaje,
  registrarIncubacion,
  completarRutinaCalendario,
  registrarControlSanitario,
  registrarContacto,
  registrarVentaHuevos,
  registrarVentaAnimales,
  registrarVentaCarne,
  registrarVentaGallinaza,
  registrarGasto,
  registrarIngreso,
  registrarProrrateo,
  registrarCierreDiario,
  consultarConocimiento,
  consultarMemoriaGranja,
  recordarDatoGranja,
  consultarProgramasNutricion,
  consultarPresupuestos,
  consultarCuentasPendientes,
  gestionarLugar,
  trasladarAnimales,
  registrarAdquisicion,
  registrarSacrificioCarne,
  ajustarGallinaza,
  gestionarAlimento,
  registrarMovimientoInsumo,
  gestionarMantenimiento,
  registrarPagoCuenta,
];

const TOOL_MAP = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]));

export function getAgentTool(name: string): AgentTool | undefined {
  return TOOL_MAP.get(name);
}

export function llmToolDefinitions(): LlmToolDefinition[] {
  return AGENT_TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/** Clasificación legible para la UI de auditoría. */
export function toolModeLabel(tool: AgentTool): string {
  if (tool.kind === "read") return "Consulta";
  return tool.requiresConfirmation ? "Requiere confirmación" : "Ejecución automática";
}

export { formatCop, formatDateEs, todayISO, truncate };
