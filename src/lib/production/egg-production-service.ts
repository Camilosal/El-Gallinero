import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  autoconsumoLogs,
  broilerBatches,
  catalogos,
  eggProduction,
  eggProductionDetails,
  farmLocations,
  hens,
} from "@/db/schema";
import { ApiHttpError } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { isDateOnly } from "@/lib/date-validation";
import { computeEggInventory, eggInventoryBookBalance } from "@/lib/inventory";
import { lockEggInventory } from "@/lib/inventory-locks";
import { checkEggStorageTelemetry, generateEggLotCode } from "@/lib/ntc1240";
import { canPerformAction } from "@/lib/rbac";
import { assertDateNotClosed } from "@/lib/sanitary-locks";
import { getEggStorageThresholds, getEggValidationThreshold } from "@/lib/settings";
import { loadSpeciesParams } from "@/lib/species-db";

export interface RegisterEggProductionOptions {
  id?: string;
  isUpdate?: boolean;
  sessionRole?: string | null;
  isOfflineSync?: boolean;
}

export interface EggProductionNormalizedInput {
  id?: string;
  date: string;
  species: "gallina" | "codorniz" | "pato";
  batchId: string | null;
  locationId: string;
  totalCollected: number;
  broken: number;
  discarded: number;
  forIncubation: number;
  qtyAutoconsumo: number;
  qtyExcedente: number;
  refPrice: string | null;
  storageTempC: string | null;
  storageHumidityPct: string | null;
  requestedLotCode: string | null;
  notes: string | null;
  sizes: { size: string; quantity: number }[];
}

/**
 * Calcula la producción diaria esperada de gallinas según las gallinas activas
 * y sus etapas de crecimiento configuradas en catálogo.
 */
export async function getExpectedDailyProduction(
  referenceDate: string,
  locationId?: string | null,
): Promise<number> {
  const day = new Date(`${referenceDate}T12:00:00`);

  const stages = await db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)));

  let totalExpected = 0;

  for (const stage of stages) {
    const eggsPerHen = Number(stage.expectedEggsPerHen || 0);
    if (eggsPerHen <= 0) continue;

    const minWeeks = stage.minWeeks ?? 0;
    const maxWeeks = stage.maxWeeks;
    const minDate = new Date(day);
    minDate.setDate(minDate.getDate() - minWeeks * 7);

    let countResult;
    if (maxWeeks === null) {
      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            eq(hens.status, "activa"),
            ...(locationId ? [eq(hens.locationId, locationId)] : []),
          ),
        );
    } else {
      const maxDate = new Date(day);
      maxDate.setDate(maxDate.getDate() - maxWeeks * 7);
      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            sql`${hens.birthDate}::date > ${maxDate.toISOString().split("T")[0]}::date`,
            eq(hens.status, "activa"),
            ...(locationId ? [eq(hens.locationId, locationId)] : []),
          ),
        );
    }

    const henCount = countResult?.[0]?.count ?? 0;
    totalExpected += eggsPerHen * henCount;
  }

  return Math.round(totalExpected * 10) / 10;
}

/**
 * Valida y normaliza una recolección de huevos con las mismas reglas para la
 * ruta online (`/api/produccion/huevos`) y la sincronización batch (`/api/sync/batch`).
 */
export async function validateAndNormalizeEggProductionInput(
  body: Record<string, any>,
  options: RegisterEggProductionOptions = {},
): Promise<EggProductionNormalizedInput> {
  const isUpdate = Boolean(options.isUpdate);
  const recordId =
    typeof options.id === "string" && options.id.trim()
      ? options.id.trim()
      : typeof body.id === "string" && body.id.trim()
        ? body.id.trim()
        : undefined;

  if (isUpdate && !recordId) {
    throw new ApiHttpError(400, "ID requerido");
  }

  if (!isDateOnly(body.date)) {
    throw new ApiHttpError(400, "Fecha inválida");
  }

  const speciesRaw = body.species || "gallina";
  if (!["gallina", "codorniz", "pato"].includes(speciesRaw)) {
    throw new ApiHttpError(400, "Especie de postura no válida");
  }
  const species = speciesRaw as "gallina" | "codorniz" | "pato";

  if (typeof body.locationId !== "string" || !body.locationId.trim()) {
    throw new ApiHttpError(400, "Selecciona el lugar donde se recogieron los huevos");
  }
  const locationId = body.locationId.trim();

  const [eggLocation] = await db
    .select()
    .from(farmLocations)
    .where(eq(farmLocations.id, locationId));
  if (
    !eggLocation ||
    eggLocation.status !== "activa" ||
    ["fuera_servicio", "restringida"].includes(eggLocation.operationalStatus)
  ) {
    throw new ApiHttpError(400, "El lugar de recolección debe estar activo y disponible");
  }

  if (species !== "gallina") {
    if (
      typeof body.batchId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.batchId)
    ) {
      throw new ApiHttpError(400, "Asigna la recolección a un lote de procedencia");
    }
    const [batch] = await db
      .select({
        species: broilerBatches.species,
        purpose: broilerBatches.purpose,
        status: broilerBatches.status,
        currentQuantity: broilerBatches.currentQuantity,
        startDate: broilerBatches.startDate,
        breed: broilerBatches.breed,
        locationId: broilerBatches.locationId,
      })
      .from(broilerBatches)
      .where(eq(broilerBatches.id, body.batchId))
      .limit(1);

    if (
      !batch ||
      batch.species !== species ||
      batch.purpose !== "postura_huevo" ||
      batch.currentQuantity <= 0 ||
      !["activo", "listo_sacrificio"].includes(batch.status)
    ) {
      throw new ApiHttpError(
        400,
        "El lote debe ser de la misma especie, seguir activo y tener destino de postura",
      );
    }
    if (batch.locationId && batch.locationId !== locationId) {
      throw new ApiHttpError(400, "El lugar debe coincidir con el alojamiento actual del lote");
    }

    const speciesParams = await loadSpeciesParams(species);
    const breedText = String(batch.breed || "").toLowerCase();
    const maturity =
      speciesParams.find((param) => breedText && param.breed.toLowerCase().includes(breedText)) ||
      speciesParams[0];
    const start = new Date(`${batch.startDate}T12:00:00`);
    const collected = new Date(`${body.date}T12:00:00`);
    const ageDays = Math.floor((collected.getTime() - start.getTime()) / 86400000);
    if (maturity && ageDays < maturity.cycleWeeks * 7) {
      throw new ApiHttpError(
        400,
        `Este lote aún no llega a la edad de postura (${maturity.cycleWeeks} semanas)`,
      );
    }
  }

  const broken = Number(body.broken ?? 0);
  const discarded = Number(body.discarded ?? 0);
  const forIncubation = Number(body.forIncubation ?? 0);
  if (
    !Number.isSafeInteger(broken) ||
    broken < 0 ||
    !Number.isSafeInteger(discarded) ||
    discarded < 0 ||
    !Number.isSafeInteger(forIncubation) ||
    forIncubation < 0
  ) {
    throw new ApiHttpError(
      400,
      "Rotos, descartados e incubación deben ser cantidades enteras no negativas",
    );
  }

  let storageTempC: string | null = null;
  if (body.storageTempC !== undefined && body.storageTempC !== null && body.storageTempC !== "") {
    const t = Number(body.storageTempC);
    if (!Number.isFinite(t) || t < -10 || t > 50) {
      throw new ApiHttpError(400, "Temperatura de almacenamiento inválida (-10 a 50 °C)");
    }
    storageTempC = t.toFixed(1);
  }

  let storageHumidityPct: string | null = null;
  if (
    body.storageHumidityPct !== undefined &&
    body.storageHumidityPct !== null &&
    body.storageHumidityPct !== ""
  ) {
    const h = Number(body.storageHumidityPct);
    if (!Number.isFinite(h) || h < 0 || h > 100) {
      throw new ApiHttpError(400, "Humedad de almacenamiento inválida (0 a 100 %)");
    }
    storageHumidityPct = h.toFixed(1);
  }

  const requestedLotCode =
    typeof body.lotCode === "string" && body.lotCode.trim()
      ? body.lotCode.trim().slice(0, 60)
      : null;

  if (body.sizes !== undefined && !Array.isArray(body.sizes)) {
    throw new ApiHttpError(400, "El detalle por tamaño debe ser una lista");
  }
  const rawSizes = Array.isArray(body.sizes)
    ? body.sizes
    : Array.isArray(body.details)
      ? body.details
      : [];

  const sizes: { size: string; quantity: number }[] = [];
  const seenSizes = new Set<string>();
  for (const row of rawSizes) {
    const size = typeof row?.size === "string" ? row.size.trim() : "";
    const quantity = Number(row?.quantity);
    if (!size || !Number.isSafeInteger(quantity) || quantity < 0) {
      throw new ApiHttpError(400, "Cada tamaño debe tener una cantidad entera no negativa");
    }
    if (seenSizes.has(size)) {
      throw new ApiHttpError(400, `El tamaño ${size} está repetido`);
    }
    seenSizes.add(size);
    if (quantity > 0) sizes.push({ size, quantity });
  }

  const totalCollected =
    sizes.length > 0
      ? sizes.reduce((s, x) => s + x.quantity, 0) + broken + discarded + forIncubation
      : Number(body.totalCollected);
  if (!Number.isSafeInteger(totalCollected) || totalCollected < 0) {
    throw new ApiHttpError(400, "Total recolectado inválido");
  }

  const goodTotal = sizes.reduce((sum, row) => sum + row.quantity, 0);
  if (goodTotal === 0 && totalCollected > broken + discarded + forIncubation) {
    throw new ApiHttpError(400, "Clasifica por tamaño los huevos buenos antes de guardar");
  }

  const qtyAutoconsumo = Number(body.quantityAutoconsumo ?? 0);
  const qtyExcedente =
    body.quantityExcedente !== undefined
      ? Number(body.quantityExcedente)
      : Math.max(0, goodTotal - qtyAutoconsumo);
  if (
    !Number.isSafeInteger(qtyAutoconsumo) ||
    qtyAutoconsumo < 0 ||
    !Number.isSafeInteger(qtyExcedente) ||
    qtyExcedente < 0
  ) {
    throw new ApiHttpError(
      400,
      "La asignación al hogar y a la venta debe usar cantidades enteras no negativas",
    );
  }
  if (qtyAutoconsumo + qtyExcedente > goodTotal) {
    throw new ApiHttpError(
      400,
      "La asignación al hogar y a la venta supera los huevos buenos disponibles",
    );
  }

  const effectiveRole =
    options.sessionRole !== undefined ? options.sessionRole : (await getSessionUser())?.role;
  const canSetReferencePrice = canPerformAction(effectiveRole, "sales:write");
  const configuredEggPrice = (await loadSpeciesParams(species)).find(
    (params) => params.species === species,
  )?.marketPriceEggUnitCOP;
  const requestedReferencePrice =
    body.referenceUnitPrice == null || body.referenceUnitPrice === ""
      ? null
      : String(body.referenceUnitPrice);
  const refPrice =
    canSetReferencePrice && requestedReferencePrice !== null
      ? requestedReferencePrice
      : configuredEggPrice && configuredEggPrice > 0
        ? String(configuredEggPrice)
        : null;
  if (refPrice !== null && (!Number.isFinite(Number(refPrice)) || Number(refPrice) < 0)) {
    throw new ApiHttpError(400, "Precio de referencia inválido");
  }

  // Las gallinas fuera de las etapas productivas no pueden recibir registro de postura.
  if (species === "gallina" && totalCollected > 0) {
    const expected = await getExpectedDailyProduction(body.date, locationId);
    if (expected <= 0) {
      throw new ApiHttpError(
        400,
        "Solo se pueden registrar huevos cuando hay gallinas activas en etapa productiva",
      );
    }
    if (!body.overrideValidation) {
      const threshold = await getEggValidationThreshold();
      const limit = Math.ceil(expected * threshold);
      if (totalCollected > limit) {
        throw new ApiHttpError(
          409,
          `La producción registrada (${totalCollected}) supera el ${Math.round(threshold * 100)}% de la producción esperada (${expected} huevos/día). Límite: ${limit}. Si es correcto, confirme para guardar.`,
          {
            warning: true,
            expected,
            actual: totalCollected,
            limit,
          },
        );
      }
    }
  }

  return {
    id: recordId,
    date: body.date,
    species,
    batchId: body.batchId || null,
    locationId,
    totalCollected,
    broken,
    discarded,
    forIncubation,
    qtyAutoconsumo,
    qtyExcedente,
    refPrice,
    storageTempC,
    storageHumidityPct,
    requestedLotCode,
    notes: body.notes || null,
    sizes,
  };
}

/**
 * DAT-01 y DAT-02: Mantiene sincronizado el log de autoconsumo vinculado al evento
 * fuente `eggProductionId`, registrando la cantidad familiar incluso sin precio.
 */
async function syncEggAutoconsumoLog(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    eggProductionId: string;
    date: string;
    species: "gallina" | "codorniz" | "pato";
    qtyAutoconsumo: number;
    refPrice: string | null;
    batchId: string | null;
    isOfflineSync?: boolean;
  },
) {
  const [existingLog] = await tx
    .select()
    .from(autoconsumoLogs)
    .where(eq(autoconsumoLogs.eggProductionId, params.eggProductionId));

  if (params.qtyAutoconsumo > 0) {
    const unitPriceNum = params.refPrice !== null ? Number(params.refPrice) || 0 : 0;
    const marketReferencePrice = unitPriceNum > 0 ? unitPriceNum.toFixed(2) : "0.00";
    const savings = (params.qtyAutoconsumo * unitPriceNum).toFixed(2);
    const notes = params.isOfflineSync
      ? `Cosecha de huevos (${params.species}) - autoconsumo (offline sync)`
      : `Cosecha de huevos (${params.species}) - autoconsumo`;

    if (existingLog) {
      await tx
        .update(autoconsumoLogs)
        .set({
          date: params.date,
          species: params.species,
          quantity: String(params.qtyAutoconsumo),
          marketReferencePrice,
          savingsAmount: savings,
          batchId: params.batchId,
          notes,
        })
        .where(eq(autoconsumoLogs.id, existingLog.id));
    } else {
      await tx.insert(autoconsumoLogs).values({
        date: params.date,
        species: params.species,
        productType: "huevo",
        quantity: String(params.qtyAutoconsumo),
        unit: "unidades",
        marketReferencePrice,
        savingsAmount: savings,
        destinationHousehold: "Familia Granja",
        batchId: params.batchId,
        eggProductionId: params.eggProductionId,
        notes,
      });
    }
  } else if (existingLog) {
    await tx.delete(autoconsumoLogs).where(eq(autoconsumoLogs.id, existingLog.id));
  }
}

/**
 * Servicio único transaccional para creación/actualización de recolección de huevos
 * usado por POST/PUT `/api/produccion/huevos` y `/api/sync/batch`.
 */
export async function registerEggProduction(
  body: Record<string, any>,
  options: RegisterEggProductionOptions = {},
) {
  const isUpdate = Boolean(options.isUpdate);
  const candidateId =
    typeof options.id === "string" && options.id.trim()
      ? options.id.trim()
      : typeof body.id === "string" && body.id.trim()
        ? body.id.trim()
        : undefined;

  if (!isUpdate && candidateId) {
    const [existing] = await db
      .select()
      .from(eggProduction)
      .where(eq(eggProduction.id, candidateId));
    if (existing) {
      return {
        record: existing,
        deduplicated: true,
        storageWarnings: checkEggStorageTelemetry(
          existing.storageTempC,
          existing.storageHumidityPct,
          await getEggStorageThresholds(),
        ),
      };
    }
  }

  const input = await validateAndNormalizeEggProductionInput(body, {
    ...options,
    id: candidateId,
  });

  if (isUpdate && input.id) {
    const updated = await db.transaction(async (tx) => {
      await assertDateNotClosed(tx, { date: input.date });
      await lockEggInventory(tx);
      const inventoryBefore = await computeEggInventory(tx);

      const [row] = await tx
        .update(eggProduction)
        .set({
          date: input.date,
          species: input.species,
          batchId: input.batchId,
          locationId: input.locationId,
          totalCollected: input.totalCollected,
          broken: input.broken,
          discarded: input.discarded,
          forIncubation: input.forIncubation,
          quantityAutoconsumo: input.qtyAutoconsumo,
          quantityExcedente: input.qtyExcedente,
          referenceUnitPrice: input.refPrice,
          lotCode: input.requestedLotCode ?? undefined,
          storageTempC: input.storageTempC,
          storageHumidityPct: input.storageHumidityPct,
          notes: input.notes,
        })
        .where(eq(eggProduction.id, input.id!))
        .returning();

      if (!row) {
        throw new ApiHttpError(404, "No encontrado");
      }

      await tx.delete(eggProductionDetails).where(eq(eggProductionDetails.productionId, input.id!));
      if (input.sizes.length) {
        await tx
          .insert(eggProductionDetails)
          .values(input.sizes.map((x) => ({ productionId: row.id, size: x.size, quantity: x.quantity })));
      }

      await syncEggAutoconsumoLog(tx, {
        eggProductionId: row.id,
        date: input.date,
        species: input.species,
        qtyAutoconsumo: input.qtyAutoconsumo,
        refPrice: input.refPrice,
        batchId: input.batchId,
        isOfflineSync: options.isOfflineSync,
      });

      const inventoryAfter = await computeEggInventory(tx);
      if (
        eggInventoryBookBalance(inventoryAfter) <
        Math.min(0, eggInventoryBookBalance(inventoryBefore)) - 0.0001
      ) {
        throw new ApiHttpError(
          400,
          "No se puede reducir la producción por debajo de los huevos ya vendidos o perdidos",
        );
      }

      return row;
    });

    return {
      record: updated,
      deduplicated: false,
      storageWarnings: checkEggStorageTelemetry(
        updated.storageTempC,
        updated.storageHumidityPct,
        await getEggStorageThresholds(),
      ),
    };
  }

  const created = await db.transaction(async (tx) => {
    await assertDateNotClosed(tx, { date: input.date });
    await lockEggInventory(tx);
    const lotCodeToSave =
      input.requestedLotCode ||
      generateEggLotCode(input.date, input.species, input.id ? input.id.slice(0, 4) : undefined);

    const [row] = await tx
      .insert(eggProduction)
      .values({
        id: input.id || undefined,
        date: input.date,
        species: input.species,
        batchId: input.batchId,
        locationId: input.locationId,
        totalCollected: input.totalCollected,
        broken: input.broken,
        discarded: input.discarded,
        forIncubation: input.forIncubation,
        quantityAutoconsumo: input.qtyAutoconsumo,
        quantityExcedente: input.qtyExcedente,
        referenceUnitPrice: input.refPrice,
        lotCode: lotCodeToSave,
        storageTempC: input.storageTempC,
        storageHumidityPct: input.storageHumidityPct,
        notes: input.notes,
      })
      .returning();

    if (input.sizes.length) {
      await tx
        .insert(eggProductionDetails)
        .values(input.sizes.map((x) => ({ productionId: row.id, size: x.size, quantity: x.quantity })));
    }

    await syncEggAutoconsumoLog(tx, {
      eggProductionId: row.id,
      date: input.date,
      species: input.species,
      qtyAutoconsumo: input.qtyAutoconsumo,
      refPrice: input.refPrice,
      batchId: input.batchId,
      isOfflineSync: options.isOfflineSync,
    });

    return row;
  });

  return {
    record: created,
    deduplicated: false,
    storageWarnings: checkEggStorageTelemetry(
      created.storageTempC,
      created.storageHumidityPct,
      await getEggStorageThresholds(),
    ),
  };
}
