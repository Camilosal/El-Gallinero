import { InternalApiClient, InternalApiError } from "./internal-api";
import { normalizeSpecies, speciesLabel } from "@/lib/species-db";
import { isBatchPresent, isHenPresent, isRoosterPresent } from "@/lib/animal-status";
import type { LlmToolDefinition } from "./llm";

/**
 * Herramientas del asistente.
 *
 * - Lecturas: se ejecutan de inmediato.
 * - Escrituras de bajo riesgo (producción, mortalidad, peso, consumo,
 *   autoconsumo): se ejecutan automáticamente.
 * - Ventas, gastos e ingresos: quedan pendientes de confirmación humana.
 *
 * Ninguna herramienta recibe SQL. Todas reutilizan endpoints existentes.
 */

export interface ToolContext {
  api: InternalApiClient;
  userId: string;
  userName: string;
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
    "Consulta el inventario de animales (gallinas, gallos, pollos, codornices, patos y conejos), huevos disponibles, " +
    "valor del inventario y alertas de stock. La unidad es 'animal'; 'aves' excluye conejos.",
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
        description: "Filtra por especie: gallina, gallo, pollo, codorniz, pato o conejo.",
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
    let forIncubation = 0;
    let autoconsumo = 0;

    for (const row of filtered) {
      totalCollected += Number(row.totalCollected || 0);
      broken += Number(row.broken || 0);
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
      paraIncubacion: forIncubation,
      autoconsumo,
      porTamano: Array.from(bySize.entries()).map(([size, quantity]) => ({ tamano: size, cantidad: quantity })),
      ultimos: filtered.slice(0, 20).map((row) => ({
        fecha: row.date,
        especie: row.species,
        lugar: row.locationName || null,
        total: row.totalCollected,
        roto: row.broken,
        incubacion: row.forIncubation,
        autoconsumo: row.quantityAutoconsumo,
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
    "Lista los lotes de producción (pollos, codornices, patos, conejos) con especie, cantidad, edad, peso y estado de sacrificio.",
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
  description: "Consulta el calendario sanitario: vacunaciones, desparasitaciones y eventos vencidos o próximos.",
  parameters: {
    type: "object",
    properties: {
      solo_pendientes: { type: "boolean", description: "Si es true, excluye eventos ya aplicados. Por defecto true." },
    },
    additionalProperties: false,
  },
  kind: "read",
  requiresConfirmation: false,
  async execute(args, ctx) {
    const rows = asArray<any>(await ctx.api.get("/api/sanidad/calendario"));
    const pending = args.solo_pendientes === false ? rows : rows.filter((row) => row.isActive);
    return {
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
      para_incubacion: { type: "integer", minimum: 0 },
      autoconsumo: { type: "integer", minimum: 0 },
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
        description: "gallina, gallo, pollo, codorniz, pato o conejo.",
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
    if (!species) throw new Error("Especie no reconocida. Usa gallina, gallo, pollo, codorniz, pato o conejo.");
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

    return {
      args: {
        date,
        locationId: location.id,
        birdType: "lote_pollos",
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
    "Las gallinas y gallos se venden de a uno; los lotes admiten varias aves.",
  parameters: {
    type: "object",
    properties: {
      fecha: { type: "string", description: "Fecha AAAA-MM-DD. Por defecto hoy." },
      tipo: {
        type: "string",
        enum: ["gallina", "gallo", "lote"],
        description: "Tipo de venta. Para pollos, codornices, patos o conejos usa 'lote'.",
      },
      especie: {
        type: "string",
        description: "Si el tipo es 'lote', especie del lote: pollo, codorniz, pato o conejo.",
      },
      codigo: { type: "string", description: "Código o id del animal o lote." },
      cantidad: { type: "integer", minimum: 1, description: "Cantidad. Para gallina/gallo debe ser 1." },
      precio_unitario: { type: "number", minimum: 1, description: "Precio por animal o por kg según el modo." },
      modo_precio: { type: "string", enum: ["por_ave", "por_kg"], description: "Por defecto por_ave." },
      peso_kg: { type: "number", minimum: 0.001, description: "Peso vendido, si el modo es por_kg." },
      comprador: { type: "string" },
      presentacion: { type: "string", description: " canal, vivo, etc." },
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
        birdType: "lote_pollos",
        quantity,
        pricePerUnit: price,
        priceMode: mode,
        weightKg: args.peso_kg ? Number(args.peso_kg) : null,
        buyer: args.comprador ? String(args.comprador) : null,
        presentation: args.presentacion ? String(args.presentacion) : null,
        batchId: batch.id,
        notes: args.notas ? String(args.notas) : null,
      },
      summary: `Vender ${quantity} ${speciesLabel(batch.species, true).toLowerCase()} del lote ${batch.code} a ${formatCop(price)} ${mode === "por_kg" ? "por kg" : "cada uno"}${args.comprador ? ` a ${args.comprador}` : ""} el ${formatDateEs(date)}.`,
    };
  },
  async execute(args, ctx) {
    return ctx.api.post("/api/finanzas/finanzas/ventas-aves", args);
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
    "Propone registrar un ingreso que no sea venta de huevos ni de animales (esos tienen herramientas propias). " +
    "Requiere confirmación del usuario.",
  parameters: financeParameters,
  kind: "write",
  requiresConfirmation: true,
  prepare: prepareFinanceTool("ingreso"),
  async execute(args, ctx) {
    return ctx.api.post("/api/finanzas/finanzas", args);
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
  registrarProduccionHuevos,
  registrarMortalidad,
  registrarPeso,
  registrarConsumoAlimento,
  registrarAutoconsumo,
  registrarVentaHuevos,
  registrarVentaAnimales,
  registrarGasto,
  registrarIngreso,
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
