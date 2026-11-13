import { db } from "@/db";
import {
  animalLocationMovements,
  appSettings,
  birdAcquisitions,
  broilerBatches,
  farmLocations,
  feedInventory,
  feedMovements,
  hens,
  roosters,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { computeAnimalInventory } from "@/lib/animal-inventory";
import { getSettings, invalidateSettingsCache } from "@/lib/settings";
import { speciesLabel } from "@/lib/species-db";
import { todayColombiaIso } from "@/lib/date-validation";
import { seedBiologicalPreloadInTx } from "@/lib/biological-preload";
import {
  ACTIVATION_HISTORY_SETTING_KEY,
  DAY1_ONBOARDING_RULES,
  FEATURE_FLAG_CATALOG,
  PROGRESSIVE_CONFIG_SETTING_KEY,
  PROGRESSIVE_UNLOCKABLE_KEYS,
  applyScalePreset,
  createDefaultProgressiveConfig,
  evaluateProgressiveTriggers,
  getEffectiveFlags,
  inferLegacyFarmConfig,
  normalizeDay1LocationType,
  normalizeDay1Species,
  sanitizeProgressiveConfig,
  type ActivationHistoryEntry,
  type ActivationOrigin,
  type AutoTriggerEvaluation,
  type Day1StarterRow,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
  type LiveFarmMetrics,
  type ProducerScale,
  type ProgressiveConfig,
  type ProgressiveUnlockableFlagKey,
} from "@/lib/onboarding";

export interface OnboardingStatePayload {
  config: ProgressiveConfig;
  flags: Record<FeatureFlagKey, boolean>;
  metrics: LiveFarmMetrics;
  evaluation: AutoTriggerEvaluation;
  history: ActivationHistoryEntry[];
  farmProfile: {
    name: string;
    city: string;
    altitudeMeters: string;
    adminName: string;
    operationStartDate: string;
  };
  day1Rules: typeof DAY1_ONBOARDING_RULES;
  catalog: FeatureFlagDefinition[];
}

export interface Day1SetupUnitInput {
  nombreInstalacion: string;
  tipoInstalacion?: string;
  especie: string;
  codigoLote?: string;
  lineaGenetica?: string;
  edadActualDias?: number;
  cantidadVivaHoy: number;
  saldoConcentradoBultos40kg?: number;
  proposito?: "engorde_carne" | "postura_huevo" | "pie_cria" | "mixto";
}

export interface Day1SetupPayload {
  nombrePredio: string;
  ciudad?: string;
  altitudMsnm?: number | null;
  administrador?: string;
  escala?: ProducerScale;
  especies?: string[];
  fechaInicioOperacion?: string;
  solicitaReporteFormal?: boolean;
  unidades: Day1SetupUnitInput[];
  bultosConcentrado40kg?: number;
  kgConcentradoAdicional?: number;
  costoPorBulto40kg?: number;
  nombreAlimentoInicial?: string;
}

const MAX_HISTORY_ITEMS = 120;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeUuid(value?: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

async function upsertRawAppSetting(
  txOrDb: Pick<typeof db, "insert">,
  key: string,
  value: string,
  userId?: string | null,
) {
  const updatedBy = safeUuid(userId);
  await txOrDb
    .insert(appSettings)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({
      target: [appSettings.farmId, appSettings.key],
      set: {
        value,
        updatedBy,
        updatedAt: new Date(),
      },
    });
}

function parseHistoryJson(raw: string | undefined): ActivationHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ActivationHistoryEntry => Boolean(item && typeof item === "object" && "featureKey" in item))
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function makeHistoryEntry(
  featureKey: FeatureFlagKey,
  estadoAnterior: boolean,
  estadoNuevo: boolean,
  origin: ActivationOrigin,
  triggerReason: string,
): ActivationHistoryEntry {
  return {
    id: crypto.randomUUID(),
    featureKey,
    estadoAnterior,
    estadoNuevo,
    origin,
    triggerReason,
    activatedAt: new Date().toISOString(),
  };
}

function subtractDaysIso(baseIso: string, days: number): string {
  const safeDays = Math.max(0, Math.min(3650, Math.round(days)));
  const dt = new Date(`${baseIso}T12:00:00Z`);
  if (Number.isNaN(dt.getTime())) return baseIso;
  dt.setUTCDate(dt.getUTCDate() - safeDays);
  return dt.toISOString().slice(0, 10);
}

function feedStockToKg(unit: string, rawStock: string | number): number {
  const qty = Number(rawStock || 0);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const normalized = unit.trim().toLowerCase();
  if (normalized.includes("bulto")) return qty * 40;
  if (normalized === "lb" || normalized === "libras") return qty * 0.453592;
  return qty;
}

export async function computeLiveFarmMetrics(): Promise<LiveFarmMetrics> {
  const [inventory, locCountRows, feedRows] = await Promise.all([
    computeAnimalInventory(),
    db.select({ total: sql<number>`count(*)::int` }).from(farmLocations),
    db.select({ unit: feedInventory.unit, currentStock: feedInventory.currentStock }).from(feedInventory),
  ]);

  const distinctSpecies = new Set<string>();
  for (const row of inventory.species) {
    if (row.count <= 0) continue;
    distinctSpecies.add(row.species === "gallo" ? "gallina" : row.species);
  }

  const gallinaEntry = inventory.species.find((s) => s.species === "gallina");
  const gallinasPonedorasActivas = Math.max(
    inventory.summary.activeHens,
    gallinaEntry?.count ?? 0,
  );

  const feedStockKg = Math.round(
    feedRows.reduce((sum, item) => sum + feedStockToKg(item.unit, item.currentStock), 0) * 100,
  ) / 100;

  const locationsCount = Number(locCountRows[0]?.total ?? 0);
  const feedInventoryCount = feedRows.length;
  const hasExistingOperation =
    inventory.summary.totalAnimals > 0 || (locationsCount > 0 && feedInventoryCount > 0);

  return {
    avesActivasTotales: inventory.summary.totalBirds,
    gallinasPonedorasActivas,
    reproductoresMamiferos: inventory.summary.totalNonBirds,
    especiesActivas: distinctSpecies.size,
    especiesList: Array.from(distinctSpecies),
    locationsCount,
    animalsTotal: inventory.summary.totalAnimals,
    feedInventoryCount,
    feedStockKg,
    hasExistingOperation,
  };
}

export async function getProgressiveOnboardingState(options?: {
  evaluateTriggers?: boolean;
  userId?: string | null;
}): Promise<OnboardingStatePayload> {
  const evaluateTriggers = options?.evaluateTriggers !== false;
  const [settingsRows, globalSettings, metrics] = await Promise.all([
    db.select().from(appSettings),
    getSettings(),
    computeLiveFarmMetrics(),
  ]);

  const rawByKey = new Map(settingsRows.map((row) => [row.key, row.value]));
  const rawConfigText = rawByKey.get(PROGRESSIVE_CONFIG_SETTING_KEY);
  let history = parseHistoryJson(rawByKey.get(ACTIVATION_HISTORY_SETTING_KEY));
  let config: ProgressiveConfig;
  let dirty = false;

  if (!rawConfigText) {
    config = metrics.hasExistingOperation
      ? inferLegacyFarmConfig(metrics)
      : createDefaultProgressiveConfig("PEQUENO");
    const initialFlags = getEffectiveFlags(config);
    for (const key of PROGRESSIVE_UNLOCKABLE_KEYS) {
      if (initialFlags[key]) {
        history = [
          makeHistoryEntry(
            key,
            false,
            true,
            "PERFIL_INICIAL",
            metrics.hasExistingOperation
              ? `Detección inicial automática en escala ${config.scale}`
              : `Perfil inicial ${config.scale}`,
          ),
          ...history,
        ];
      }
    }
    dirty = true;
  } else {
    try {
      config = sanitizeProgressiveConfig(JSON.parse(rawConfigText));
    } catch {
      config = createDefaultProgressiveConfig("PEQUENO");
      dirty = true;
    }
  }

  let evaluation = evaluateProgressiveTriggers(config, metrics);

  if (evaluateTriggers && evaluation.newlyActivatedFlags.length > 0) {
    const nextFlags = { ...config.flags };
    for (const key of evaluation.newlyActivatedFlags) {
      const prevVal = Boolean(nextFlags[key]);
      if (!prevVal) {
        nextFlags[key] = true;
        const progressRow = evaluation.progress.find((p) => p.key === key);
        const reason = progressRow
          ? `Auto-trigger de crecimiento (${progressRow.autoTriggerExpr}: ${progressRow.currentValue})`
          : `Auto-trigger de crecimiento (${key})`;
        history = [
          makeHistoryEntry(key, false, true, "AUTO_TRIGGER_CRECIMIENTO", reason),
          ...history,
        ];
      }
    }
    config = {
      ...config,
      flags: nextFlags,
      updatedAt: new Date().toISOString(),
    };
    dirty = true;
    evaluation = evaluateProgressiveTriggers(config, metrics);
  }

  if (dirty) {
    const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);
    await Promise.all([
      upsertRawAppSetting(db, PROGRESSIVE_CONFIG_SETTING_KEY, JSON.stringify(config), options?.userId),
      upsertRawAppSetting(db, ACTIVATION_HISTORY_SETTING_KEY, JSON.stringify(trimmedHistory), options?.userId),
    ]);
    history = trimmedHistory;
  }

  return {
    config,
    flags: getEffectiveFlags(config),
    metrics,
    evaluation,
    history,
    farmProfile: {
      name: globalSettings["farm.name"] || "",
      city: globalSettings["farm.city"] || "",
      altitudeMeters: globalSettings["farm.altitude_meters"] || "",
      adminName: globalSettings["farm.admin_name"] || "",
      operationStartDate: globalSettings["farm.operation_start_date"] || config.operationStartDate,
    },
    day1Rules: DAY1_ONBOARDING_RULES,
    catalog: FEATURE_FLAG_CATALOG,
  };
}

export async function updateProgressiveOnboardingState(
  patch: {
    scale?: ProducerScale;
    toggleFlag?: { key: ProgressiveUnlockableFlagKey; enabled: boolean; reason?: string };
    solicitaReporteFormal?: boolean;
    onboardingCompleted?: boolean;
    wizardDismissed?: boolean;
    selectedSpecies?: string[];
  },
  userId?: string | null,
): Promise<OnboardingStatePayload> {
  const current = await getProgressiveOnboardingState({ evaluateTriggers: false, userId });
  let nextConfig = { ...current.config, flags: { ...current.config.flags }, manualOverrides: { ...current.config.manualOverrides } };
  let nextHistory = [...current.history];

  if (patch.scale === "PEQUENO" || patch.scale === "MEDIANO") {
    const scaled = applyScalePreset(nextConfig, patch.scale);
    nextConfig = scaled.config;
    for (const change of scaled.changes) {
      nextHistory.unshift(
        makeHistoryEntry(
          change.key,
          change.from,
          change.to,
          "MANUAL_USUARIO",
          `Cambio de escala de productor a ${patch.scale}`,
        ),
      );
    }
  }

  if (patch.toggleFlag) {
    const { key, enabled, reason } = patch.toggleFlag;
    if (!PROGRESSIVE_UNLOCKABLE_KEYS.includes(key)) {
      throw new Error("Solo los módulos progresivos permiten desbloqueo manual.");
    }
    const prevVal = Boolean(nextConfig.flags[key]);
    if (prevVal !== enabled || nextConfig.manualOverrides[key] !== enabled) {
      nextConfig.flags[key] = enabled;
      nextConfig.manualOverrides[key] = enabled;
      nextConfig.updatedAt = new Date().toISOString();
      nextHistory.unshift(
        makeHistoryEntry(
          key,
          prevVal,
          enabled,
          "MANUAL_USUARIO",
          reason || (enabled ? "Activación manual desde Configuración" : "Desactivación manual desde Configuración"),
        ),
      );
    }
  }

  if (typeof patch.solicitaReporteFormal === "boolean") {
    nextConfig.solicitaReporteFormal = patch.solicitaReporteFormal;
    if (!patch.solicitaReporteFormal && nextConfig.manualOverrides.reportes_dian_roi_credito !== true) {
      const prev = nextConfig.flags.reportes_dian_roi_credito;
      if (prev && nextConfig.scale === "PEQUENO") {
        nextConfig.flags.reportes_dian_roi_credito = false;
        nextHistory.unshift(
          makeHistoryEntry(
            "reportes_dian_roi_credito",
            true,
            false,
            "MANUAL_USUARIO",
            "Desactivación de solicitud de reportes formales DIAN/crédito",
          ),
        );
      }
    }
  }

  if (typeof patch.onboardingCompleted === "boolean") {
    nextConfig.onboardingCompleted = patch.onboardingCompleted;
  }
  if (typeof patch.wizardDismissed === "boolean") {
    nextConfig.wizardDismissed = patch.wizardDismissed;
  }
  if (Array.isArray(patch.selectedSpecies)) {
    nextConfig.selectedSpecies = patch.selectedSpecies
      .map((s) => normalizeDay1Species(String(s)))
      .filter(Boolean);
  }

  // Si el usuario eligió explícitamente Modo Pequeño, bloquear que los disparadores
  // ya cumplidos en la granja (p. ej. 2+ especies o lote previo) reactiven de inmediato
  // módulos avanzados por encima de su elección manual.
  if (patch.scale === "PEQUENO" && !patch.toggleFlag) {
    const preTriggerEval = evaluateProgressiveTriggers(nextConfig, current.metrics);
    for (const key of preTriggerEval.triggeredFlags) {
      if (key === "reportes_dian_roi_credito" && patch.solicitaReporteFormal === true) continue;
      nextConfig.manualOverrides[key] = false;
    }
  }

  // Evalúa inmediatamente auto-triggers tras los cambios (ej. solicitaReporteFormal = true)
  const evalResult = evaluateProgressiveTriggers(nextConfig, current.metrics);
  for (const key of evalResult.newlyActivatedFlags) {
    nextConfig.flags[key] = true;
    const progressRow = evalResult.progress.find((p) => p.key === key);
    nextHistory.unshift(
      makeHistoryEntry(
        key,
        false,
        true,
        "AUTO_TRIGGER_CRECIMIENTO",
        progressRow
          ? `Auto-trigger (${progressRow.autoTriggerExpr})`
          : `Auto-trigger (${key})`,
      ),
    );
  }

  nextConfig.updatedAt = new Date().toISOString();
  const trimmedHistory = nextHistory.slice(0, MAX_HISTORY_ITEMS);

  await Promise.all([
    upsertRawAppSetting(db, PROGRESSIVE_CONFIG_SETTING_KEY, JSON.stringify(nextConfig), userId),
    upsertRawAppSetting(db, ACTIVATION_HISTORY_SETTING_KEY, JSON.stringify(trimmedHistory), userId),
  ]);

  return getProgressiveOnboardingState({ evaluateTriggers: true, userId });
}

async function nextCodeInTx(
  tx: any,
  table: any,
  prefix: string,
  separator = "-",
): Promise<string> {
  const rows = await tx.select({ code: table.code }).from(table);
  const esc = `${prefix}${separator}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}(\\d+)$`);
  const max = rows.reduce((acc: number, row: { code: string }) => {
    const m = String(row.code || "").match(re);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `${prefix}${separator}${String(max + 1).padStart(3, "0")}`;
}

async function nextBatchSequentialCodes(
  tx: any,
  table: any,
  prefix: string,
  count: number,
): Promise<string[]> {
  const rows = await tx.select({ code: table.code }).from(table);
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc}-(\\d+)$`);
  const max = rows.reduce((acc: number, row: { code: string }) => {
    const m = String(row.code || "").match(re);
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return Array.from({ length: count }, (_, idx) => `${prefix}-${String(max + idx + 1).padStart(3, "0")}`);
}

function feedTypeForSpecies(speciesList: string[]): "Concentrado Aves" | "Concentrado Codorniz" | "Concentrado Conejos" {
  if (speciesList.length === 1 && speciesList[0] === "codorniz") return "Concentrado Codorniz";
  if (speciesList.length === 1 && (speciesList[0] === "conejo" || speciesList[0] === "cuy")) return "Concentrado Conejos";
  return "Concentrado Aves";
}

function defaultTargetDaysForSpecies(species: string): { weeks: number; weightKg: string } {
  if (species === "codorniz") return { weeks: 5, weightKg: "0.15" };
  if (species === "pato") return { weeks: 9, weightKg: "3.20" };
  if (species === "conejo") return { weeks: 11, weightKg: "2.40" };
  if (species === "cuy") return { weeks: 13, weightKg: "1.10" };
  if (species === "gallina") return { weeks: 80, weightKg: "1.90" };
  return { weeks: 7, weightKg: "2.50" };
}

/**
 * Protocolo "Día 1 sin Fricción":
 * Registra datos mínimos del predio, unidades vivas al día de hoy y saldo actual en bodega,
 * sin exigir histórico pasado, evaluando inmediatamente los disparadores inteligentes de escala.
 */
export async function executeDay1Setup(
  payload: Day1SetupPayload,
  userId?: string | null,
): Promise<{
  state: OnboardingStatePayload;
  created: {
    locationsCreated: number;
    animalsCreated: number;
    feedEntriesCreated: number;
    totalFeedKg: number;
    milestonesCreated: number;
    sanitaryEventsCreated: number;
  };
}> {
  const nombrePredio = String(payload.nombrePredio || "").trim();
  if (!nombrePredio) {
    throw new Error("El nombre del predio o granja es obligatorio.");
  }
  const ciudad = String(payload.ciudad || "").trim();
  const administrador = String(payload.administrador || "").trim();
  const altitudMsnm =
    payload.altitudMsnm == null || String(payload.altitudMsnm).trim() === ""
      ? null
      : Number(payload.altitudMsnm);
  if (altitudMsnm != null && (!Number.isInteger(altitudMsnm) || altitudMsnm < 0 || altitudMsnm > 5500)) {
    throw new Error("La altitud del predio debe estar entre 0 y 5500 msnm.");
  }

  const escala: ProducerScale = payload.escala === "MEDIANO" ? "MEDIANO" : "PEQUENO";
  const today = todayColombiaIso();
  const operationStartDate =
    payload.fechaInicioOperacion && /^\d{4}-\d{2}-\d{2}$/.test(payload.fechaInicioOperacion)
      ? payload.fechaInicioOperacion
      : today;

  const unidades = Array.isArray(payload.unidades) ? payload.unidades : [];
  for (const unit of unidades) {
    if (!String(unit.nombreInstalacion || "").trim()) {
      throw new Error("Cada unidad activa debe indicar el nombre de la instalación.");
    }
    if (!Number.isInteger(Number(unit.cantidadVivaHoy)) || Number(unit.cantidadVivaHoy) <= 0) {
      throw new Error(`La cantidad viva hoy en "${unit.nombreInstalacion}" debe ser un entero mayor a 0.`);
    }
    const ageDays = Number(unit.edadActualDias ?? 0);
    if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > 3650) {
      throw new Error(`Edad actual inválida en "${unit.nombreInstalacion}".`);
    }
  }

  const currentOnboarding = await getProgressiveOnboardingState({ evaluateTriggers: false, userId });
  const existingLocations = await db.select().from(farmLocations);
  const locationByName = new Map(existingLocations.map((loc) => [loc.name.trim().toLowerCase(), loc]));

  let locationsCreated = 0;
  let animalsCreated = 0;
  let feedEntriesCreated = 0;
  let totalFeedKg = 0;
  let milestonesCreated = 0;
  let sanitaryEventsCreated = 0;
  let primaryLocationId: string | null = existingLocations[0]?.id ?? null;

  const speciesSet = new Set<string>(
    Array.isArray(payload.especies) ? payload.especies.map((s) => normalizeDay1Species(String(s))) : [],
  );

  await db.transaction(async (tx) => {
    await upsertRawAppSetting(tx, "farm.name", nombrePredio, userId);
    if (ciudad) await upsertRawAppSetting(tx, "farm.city", ciudad, userId);
    if (altitudMsnm != null) await upsertRawAppSetting(tx, "farm.altitude_meters", String(altitudMsnm), userId);
    if (administrador) await upsertRawAppSetting(tx, "farm.admin_name", administrador, userId);
    await upsertRawAppSetting(tx, "farm.operation_start_date", operationStartDate, userId);

    let bultosFromUnits = 0;

    for (const unit of unidades) {
      const species = normalizeDay1Species(unit.especie);
      speciesSet.add(species);
      const locationName = unit.nombreInstalacion.trim();
      const locationKey = locationName.toLowerCase();
      const locationType = normalizeDay1LocationType(unit.tipoInstalacion || "corral");

      let location = locationByName.get(locationKey);
      if (!location) {
        const nextLocCode = await nextCodeInTx(tx, farmLocations, "LOC", "-");
        const [createdLoc] = await tx
          .insert(farmLocations)
          .values({
            code: nextLocCode,
            name: locationName,
            type: locationType,
            zoneType: "produccion",
            status: "activa",
            operationalStatus: "operativa",
            sanitaryStatus: "pendiente_revision",
            allowedSpecies: [species],
            altitudeMeters: altitudMsnm,
            notes: "Creada automáticamente durante arranque Día 1 sin historial.",
          })
          .returning();
        location = createdLoc;
        locationByName.set(locationKey, createdLoc);
        locationsCreated++;
      }
      if (!primaryLocationId) primaryLocationId = location.id;

      const qty = Math.round(Number(unit.cantidadVivaHoy));
      const ageDays = Math.round(Number(unit.edadActualDias ?? 0));
      const birthOrStartDate = subtractDaysIso(operationStartDate, ageDays);
      const breed = String(unit.lineaGenetica || "").trim() || speciesLabel(species);
      const birdType = species === "pollo" ? "lote_pollos" : species;
      const batchSpecies = species === "gallo" ? "gallina" : species;
      const defaultPurpose =
        unit.proposito ||
        (species === "gallina" || species === "codorniz"
          ? "postura_huevo"
          : "engorde_carne");

      const [acquisition] = await tx
        .insert(birdAcquisitions)
        .values({
          date: operationStartDate,
          species: batchSpecies as typeof birdAcquisitions.$inferInsert.species,
          acquisitionType: "cria_propia",
          birdType,
          quantity: qty,
          breed,
          geneticLine: unit.lineaGenetica ? unit.lineaGenetica.trim() : null,
          sourceBatchCode: unit.codigoLote ? unit.codigoLote.trim() : null,
          destinationLocationId: location.id,
          birthDate: birthOrStartDate,
          notes: "Saldo vivo inicial registrado en Onboarding Día 1 (sin histórico).",
        })
        .returning();

      if (species === "gallina" && qty <= 300) {
        await tx.execute(sql`LOCK TABLE ${hens} IN EXCLUSIVE MODE`);
        const codes = await nextBatchSequentialCodes(tx, hens, "G", qty);
        const insertedHens = await tx
          .insert(hens)
          .values(
            codes.map((code) => ({
              code,
              breed,
              birthDate: birthOrStartDate,
              status: "activa" as const,
              isBroody: false,
              acquisitionId: acquisition.id,
              locationId: location.id,
              notes: unit.codigoLote ? `Lote Día 1: ${unit.codigoLote}` : null,
            })),
          )
          .returning();
        await tx.insert(animalLocationMovements).values(
          insertedHens.map((h) => ({
            henId: h.id,
            fromLocationId: null,
            toLocationId: location.id,
            quantity: 1,
            date: operationStartDate,
            reason: "Inventario inicial Día 1",
            notes: `Onboarding ${acquisition.id}`,
          })),
        );
      } else if (species === "gallo" && qty <= 100) {
        await tx.execute(sql`LOCK TABLE ${roosters} IN EXCLUSIVE MODE`);
        const codes = await nextBatchSequentialCodes(tx, roosters, "GA", qty);
        const insertedRoosters = await tx
          .insert(roosters)
          .values(
            codes.map((code) => ({
              code,
              breed,
              birthDate: birthOrStartDate,
              status: "activo" as const,
              acquisitionId: acquisition.id,
              locationId: location.id,
            })),
          )
          .returning();
        await tx.insert(animalLocationMovements).values(
          insertedRoosters.map((r) => ({
            roosterId: r.id,
            fromLocationId: null,
            toLocationId: location.id,
            quantity: 1,
            date: operationStartDate,
            reason: "Inventario inicial Día 1",
            notes: `Onboarding ${acquisition.id}`,
          })),
        );
      } else {
        await tx.execute(sql`LOCK TABLE ${broilerBatches} IN EXCLUSIVE MODE`);
        const batchPrefix =
          species === "codorniz"
            ? "L-COD"
            : species === "pato"
              ? "L-PAT"
              : species === "conejo"
                ? "L-CON"
                : species === "cuy"
                  ? "L-CUY"
                  : species === "gallina"
                    ? "L-PON"
                    : "L";
        let batchCode = unit.codigoLote ? unit.codigoLote.trim().toUpperCase() : "";
        if (!batchCode) {
          batchCode = await nextCodeInTx(tx, broilerBatches, batchPrefix, "-");
        } else {
          const [dup] = await tx
            .select({ id: broilerBatches.id })
            .from(broilerBatches)
            .where(eq(broilerBatches.code, batchCode))
            .limit(1);
          if (dup) batchCode = await nextCodeInTx(tx, broilerBatches, batchPrefix, "-");
        }
        const defaults = defaultTargetDaysForSpecies(species);
        const [batch] = await tx
          .insert(broilerBatches)
          .values({
            code: batchCode,
            species: batchSpecies as typeof broilerBatches.$inferInsert.species,
            purpose: defaultPurpose,
            breed,
            startDate: birthOrStartDate,
            initialQuantity: qty,
            currentQuantity: qty,
            targetWeeks: defaults.weeks,
            targetDays: defaults.weeks * 7,
            targetWeightKg: defaults.weightKg,
            acquisitionId: acquisition.id,
            locationId: location.id,
            notes: "Lote vivo inicial registrado en Onboarding Día 1.",
          })
          .returning();
        await tx.insert(animalLocationMovements).values({
          batchId: batch.id,
          fromLocationId: null,
          toLocationId: location.id,
          quantity: qty,
          date: operationStartDate,
          reason: "Inventario inicial Día 1",
          notes: `Onboarding ${acquisition.id}`,
        });
      }

      animalsCreated += qty;
      bultosFromUnits += Math.max(0, Number(unit.saldoConcentradoBultos40kg || 0));
    }

    const bultosGlobal = Math.max(0, Number(payload.bultosConcentrado40kg || 0));
    const kgExtra = Math.max(0, Number(payload.kgConcentradoAdicional || 0));
    const effectiveBultos = bultosGlobal > 0 ? bultosGlobal : bultosFromUnits;
    totalFeedKg = Math.round((effectiveBultos * 40 + kgExtra) * 100) / 100;
    const rawBagCost = Number(payload.costoPorBulto40kg ?? 0);
    const validBagCost = Number.isFinite(rawBagCost) && rawBagCost > 0 ? rawBagCost : 0;
    const costPerKg = (validBagCost / 40).toFixed(2);

    if (totalFeedKg > 0) {
      const speciesList = Array.from(speciesSet);
      const feedName =
        String(payload.nombreAlimentoInicial || "").trim() ||
        `Concentrado Base (${speciesList.map((s) => speciesLabel(s)).join(" / ") || "Granja"})`;
      const [createdFeed] = await tx
        .insert(feedInventory)
        .values({
          name: feedName,
          category: "Concentrado",
          feedType: feedTypeForSpecies(speciesList),
          unit: "kg",
          currentStock: totalFeedKg.toFixed(2),
          minStock: Math.max(40, Math.round(totalFeedKg * 0.25)).toFixed(2),
          costPerUnit: costPerKg,
          supplier: "Inventario inicial en bodega",
        })
        .returning();
      await tx.insert(feedMovements).values({
        feedId: createdFeed.id,
        quantity: totalFeedKg.toFixed(2),
        isEntry: true,
        movementType: "ajuste",
        autoGenerated: false,
        locationId: primaryLocationId,
        date: operationStartDate,
        notes: `Saldo inicial en bodega (${effectiveBultos} bultos de 40 kg${kgExtra > 0 ? ` + ${kgExtra} kg` : ""}).`,
      });
      feedEntriesCreated = 1;
    }

    // Guarda configuración inicial de escala para este arranque Día 1
    const bioPreload = await seedBiologicalPreloadInTx(tx, unidades, operationStartDate);
    milestonesCreated = bioPreload.milestonesCreated;
    sanitaryEventsCreated = bioPreload.sanitaryEventsCreated;

    const baseScaled = applyScalePreset(
      {
        ...currentOnboarding.config,
        operationStartDate,
        selectedSpecies: Array.from(speciesSet),
        solicitaReporteFormal: Boolean(payload.solicitaReporteFormal ?? escala === "MEDIANO"),
        onboardingCompleted: true,
        wizardDismissed: true,
      },
      escala,
    );
    const nextHistory = [
      ...PROGRESSIVE_UNLOCKABLE_KEYS.filter((k) => baseScaled.config.flags[k]).map((k) =>
        makeHistoryEntry(k, false, true, "PERFIL_INICIAL", `Arranque Día 1 en escala ${escala}`),
      ),
      ...currentOnboarding.history,
    ].slice(0, MAX_HISTORY_ITEMS);

    await Promise.all([
      upsertRawAppSetting(tx, PROGRESSIVE_CONFIG_SETTING_KEY, JSON.stringify(baseScaled.config), userId),
      upsertRawAppSetting(tx, ACTIVATION_HISTORY_SETTING_KEY, JSON.stringify(nextHistory), userId),
    ]);
  });

  invalidateSettingsCache();
  const state = await getProgressiveOnboardingState({ evaluateTriggers: true, userId });

  return {
    state,
    created: {
      locationsCreated,
      animalsCreated,
      feedEntriesCreated,
      totalFeedKg,
      milestonesCreated,
      sanitaryEventsCreated,
    },
  };
}

/** Utilidad para validar e inyectar filas de plantilla CSV Día 1 desde endpoints o UI. */
export function normalizeStarterUnits(rows: Day1StarterRow[]): Day1SetupUnitInput[] {
  return rows.map((r) => ({
    nombreInstalacion: r.nombreInstalacion,
    tipoInstalacion: r.tipoInstalacion,
    especie: r.especie,
    codigoLote: r.codigoLote,
    lineaGenetica: r.lineaGenetica,
    edadActualDias: r.edadActualDias,
    cantidadVivaHoy: r.cantidadVivaHoy,
    saldoConcentradoBultos40kg: r.saldoConcentradoBultos40kg,
  }));
}

