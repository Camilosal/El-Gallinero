import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  eggProduction,
  eggProductionDetails,
  autoconsumoLogs,
  farmLocations,
  mortalityRecords,
  hens,
  roosters,
  broilerBatches,
  feedMovements,
  feedInventory,
  transactions,
  offlineMutationReceipts,
  weightLogs,
  healthControl,
  reproductionEvents,
  biosecurityLogs,
  dailyClosures,
  eggSales,
  chickenSales,
  meatSales,
} from "@/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockEggInventory } from "@/lib/inventory-locks";
import { runFeedProgramCatchup } from "@/lib/feeding/runProgram";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";
import { isPurchasedFeedCategory } from "@/lib/feed-classification";
import { addDaysIso, isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { computeDailyGainG, computeUniformityStats, parseIndividualWeightsInput } from "@/lib/zootechnics";
import { resolveDimensions } from "@/lib/analytics-dimensions";
import { assertDateNotClosed } from "@/lib/sanitary-locks";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type BatchEntity =
  | "huevos"
  | "mortalidad"
  | "alimentacion"
  | "pesaje"
  | "sanidad"
  | "reproduccion"
  | "bioseguridad"
  | "cierre_diario"
  | "general";

interface MutationItem {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  entity: BatchEntity;
  payload: Record<string, any>;
  clientTimestamp: string;
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || !Array.isArray(body.mutations)) {
    return NextResponse.json({ error: "Lista de mutaciones inválida" }, { status: 400 });
  }

  const mutations: MutationItem[] = body.mutations;
  const results: Array<{ id: string; status: "synced" | "error"; error?: string; deduplicated?: boolean }> = [];

  for (const item of mutations) {
    try {
      if (!item.id || !item.entity) {
        results.push({ id: item.id || "unknown", status: "error", error: "Datos de mutación incompletos" });
        continue;
      }

      const [receipt] = await db
        .select({ mutationId: offlineMutationReceipts.mutationId, statusCode: offlineMutationReceipts.statusCode })
        .from(offlineMutationReceipts)
        .where(eq(offlineMutationReceipts.mutationId, item.id))
        .limit(1);

      if (receipt && receipt.statusCode >= 200 && receipt.statusCode < 300) {
        results.push({ id: item.id, status: "synced", deduplicated: true });
        continue;
      }

      if (item.entity === "huevos") {
        await processHuevosMutation(item);
      } else if (item.entity === "mortalidad") {
        await processMortalidadMutation(item);
      } else if (item.entity === "alimentacion") {
        await processAlimentacionMutation(item);
      } else if (item.entity === "pesaje") {
        await processPesajeMutation(item);
      } else if (item.entity === "sanidad") {
        await processSanidadMutation(item);
      } else if (item.entity === "reproduccion") {
        await processReproduccionMutation(item);
      } else if (item.entity === "bioseguridad") {
        await processBioseguridadMutation(item);
      } else if (item.entity === "cierre_diario") {
        await processCierreDiarioMutation(item);
      } else {
        results.push({ id: item.id, status: "error", error: `Entidad no soportada para batch: ${item.entity}` });
        continue;
      }

      await db
        .insert(offlineMutationReceipts)
        .values({
          mutationId: item.id,
          method: item.method || "POST",
          path: item.endpoint || `/api/sync/batch:${item.entity}`,
          statusCode: 201,
          responseBody: { ok: true, entity: item.entity },
        })
        .onConflictDoNothing();

      results.push({ id: item.id, status: "synced" });
    } catch (err: any) {
      console.error(`Error procesando mutación ${item.id} (${item.entity}):`, err);
      results.push({ id: item.id, status: "error", error: err.message || "Error procesando registro" });
    }
  }

  return NextResponse.json({ ok: true, results });
});

async function processHuevosMutation(item: MutationItem) {
  const { id, payload } = item;
  const body = payload;

  // 1. Idempotencia: Verificar si ya fue insertado previamente
  const [existing] = await db
    .select({ id: eggProduction.id })
    .from(eggProduction)
    .where(eq(eggProduction.id, id));

  if (existing) {
    // Ya existe, se considera sincronizado con éxito
    return;
  }

  const species = body.species || "gallina";
  const totalCollected = Number(body.totalCollected) || 0;
  const broken = Number(body.broken) || 0;
  const forIncubation = Number(body.forIncubation) || 0;
  const qtyAutoconsumo = Number(body.quantityAutoconsumo) || 0;
  const qtyExcedente = Number(body.quantityExcedente) || 0;
  const refPrice = body.referenceUnitPrice || null;
  const rawSizes = Array.isArray(body.details)
    ? body.details
    : Array.isArray(body.sizes)
      ? body.sizes
      : body.sizes && typeof body.sizes === "object"
        ? Object.entries(body.sizes).map(([size, quantity]) => ({ size, quantity }))
        : [];
  const sizes: { size: string; quantity: number }[] = rawSizes
    .map((x: any) => ({ size: String(x.size), quantity: Number(x.quantity) || 0 }))
    .filter((x: { size: string; quantity: number }) => x.quantity > 0);

  if (typeof body.locationId !== "string" || !body.locationId.trim()) {
    throw new Error("Falta el lugar (locationId) para registrar huevos");
  }

  await db.transaction(async (tx) => {
    await lockEggInventory(tx);

    const [loc] = await tx
      .select({ id: farmLocations.id })
      .from(farmLocations)
      .where(eq(farmLocations.id, body.locationId));
    if (!loc) {
      throw new Error("El lugar seleccionado para los huevos no existe");
    }

    const [row] = await tx
      .insert(eggProduction)
      .values({
        id,
        date: body.date,
        species,
        batchId: body.batchId || null,
        locationId: body.locationId,
        totalCollected,
        broken,
        forIncubation,
        quantityAutoconsumo: qtyAutoconsumo,
        quantityExcedente: qtyExcedente,
        referenceUnitPrice: refPrice,
        notes: body.notes || null,
      })
      .returning();

    if (sizes.length) {
      await tx.insert(eggProductionDetails).values(
        sizes.map((x) => ({ productionId: row.id, size: x.size, quantity: x.quantity }))
      );
    }

    if (qtyAutoconsumo > 0 && refPrice) {
      const unitPriceNum = Number(refPrice) || 0;
      const savings = (qtyAutoconsumo * unitPriceNum).toFixed(2);
      await tx.insert(autoconsumoLogs).values({
        date: body.date,
        species,
        productType: "huevo",
        quantity: String(qtyAutoconsumo),
        unit: "unidades",
        marketReferencePrice: refPrice,
        savingsAmount: savings,
        destinationHousehold: "Familia Granja",
        batchId: body.batchId || null,
        eggProductionId: row.id,
        notes: `Cosecha de huevos (${species}) - autoconsumo (offline sync)`,
      });
    }
  });
}

async function processMortalidadMutation(item: MutationItem) {
  const { id, payload } = item;
  const body = payload;

  // 1. Idempotencia
  const [existing] = await db
    .select({ id: mortalityRecords.id })
    .from(mortalityRecords)
    .where(eq(mortalityRecords.id, id));

  if (existing) {
    return;
  }

  const { date, birdType, cause, henId, roosterId, batchId, quantity, description, locationId } = body;
  const isBatch = birdType && birdType.startsWith("lote_");
  const qty = isBatch ? Number(quantity ?? 1) : 1;

  await db.transaction(async (tx) => {
    if (birdType === "gallina" && henId) {
      const [hen] = await tx.select().from(hens).where(eq(hens.id, henId)).for("update");
      if (hen && HEN_PRESENT_STATUSES.includes(hen.status)) {
        await tx.update(hens).set({ status: "muerta" }).where(eq(hens.id, henId));
      }
    }

    if (birdType === "gallo" && roosterId) {
      const [rooster] = await tx.select().from(roosters).where(eq(roosters.id, roosterId)).for("update");
      if (rooster && rooster.status === "activo") {
        await tx.update(roosters).set({ status: "muerto" }).where(eq(roosters.id, roosterId));
      }
    }

    if (isBatch && batchId) {
      const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, batchId)).for("update");
      if (batch) {
        const newQty = Math.max(0, batch.currentQuantity - qty);
        await tx
          .update(broilerBatches)
          .set({
            currentQuantity: newQty,
            status: newQty === 0 ? "faena" : batch.status,
            updatedAt: new Date(),
          })
          .where(eq(broilerBatches.id, batchId));
      }
    }

    const species =
      birdType === "gallina" || birdType === "gallo"
        ? "gallina"
        : birdType === "lote_pollos"
        ? "pollo"
        : birdType === "lote_codornices"
        ? "codorniz"
        : birdType === "lote_patos"
        ? "pato"
        : birdType === "lote_conejos"
        ? "conejo"
        : birdType === "lote_cuyes"
        ? "cuy"
        : "pollo";

    await tx.insert(mortalityRecords).values({
      id,
      date,
      species,
      birdType,
      quantity: qty,
      cause,
      henId: henId || null,
      roosterId: roosterId || null,
      batchId: batchId || null,
      locationId: locationId || null,
      description: description || null,
    });
  });
}

async function processAlimentacionMutation(item: MutationItem) {
  const { id, payload } = item;
  const body = payload;

  // 1. Idempotencia
  const [existing] = await db
    .select({ id: feedMovements.id })
    .from(feedMovements)
    .where(eq(feedMovements.id, id));

  if (existing) {
    return;
  }

  const qty = Number(body.quantity);
  await runFeedProgramCatchup();

  await db.transaction(async (tx) => {
    const [feed] = await tx.select().from(feedInventory).where(eq(feedInventory.id, body.feedId)).for("update");
    if (!feed) {
      throw new Error("Alimento no encontrado en inventario");
    }

    await tx.insert(feedMovements).values({
      id,
      feedId: body.feedId,
      quantity: body.quantity,
      isEntry: Boolean(body.isEntry),
      movementType: body.movementType || (body.isEntry ? "compra" : "consumo_manual"),
      autoGenerated: false,
      species: body.species || null,
      stageCatalogoId: body.stageCatalogoId || null,
      henCount: body.henCount || null,
      locationId: body.locationId || null,
      date: body.date,
      notes: body.notes || null,
    });

    await tx
      .update(feedInventory)
      .set({
        currentStock: body.isEntry
          ? sql`(${feedInventory.currentStock}::numeric + ${qty})`
          : sql`(${feedInventory.currentStock}::numeric - ${qty})`,
        updatedAt: new Date(),
      })
      .where(eq(feedInventory.id, body.feedId));

    if (body.isEntry && isPurchasedFeedCategory(feed.category) && Number(feed.costPerUnit) > 0) {
      const amount = (qty * Number(feed.costPerUnit)).toFixed(2);
      await tx.insert(transactions).values({
        date: body.date,
        type: "egreso",
        category: "Compra de alimento",
        description: `Compra de ${body.quantity} ${feed.unit} de ${feed.name} (offline sync)`,
        amount,
        quantity: body.quantity,
        unitPrice: feed.costPerUnit,
        unit: feed.unit,
        counterparty: feed.supplier || null,
        sourceType: "alimento",
        sourceId: id,
        species: body.species || null,
        locationId: body.locationId || null,
        batchId: body.batchId || null,
      });
    }
  });
}

async function processPesajeMutation(item: MutationItem) {
  const { id, payload: body } = item;
  const [existing] = await db
    .select({ id: weightLogs.id })
    .from(weightLogs)
    .where(eq(weightLogs.id, id))
    .limit(1);
  if (existing) return;

  const parsedWeightsG = parseIndividualWeightsInput(body.individualWeightsG);
  const uniformity = parsedWeightsG.length > 0 ? computeUniformityStats(parsedWeightsG, 10) : null;
  const resolvedWeightKg =
    body.avgWeightKg != null && body.avgWeightKg !== ""
      ? Number(body.avgWeightKg)
      : uniformity
        ? Number((uniformity.meanG / 1000).toFixed(4))
        : NaN;

  if (!isDateOnly(body.date) || !Number.isFinite(resolvedWeightKg) || resolvedWeightKg <= 0) {
    throw new Error("Fecha y peso válidos son requeridos para pesaje");
  }
  if (typeof body.locationId !== "string" || !body.locationId.trim()) {
    throw new Error("Falta locationId para registrar pesaje");
  }

  const [location] = await db
    .select({ id: farmLocations.id, status: farmLocations.status })
    .from(farmLocations)
    .where(eq(farmLocations.id, body.locationId))
    .limit(1);
  if (!location || location.status !== "activa") {
    throw new Error("La ubicación del pesaje no existe o no está activa");
  }

  const species = String(body.species || "gallina");
  const sample = uniformity ? uniformity.sampleCount : Math.max(1, Number(body.sampleSize || 1) || 1);
  let resolvedBreed = typeof body.breed === "string" ? body.breed.trim() : "";
  let resolvedWeek = body.weekNumber === "" || body.weekNumber == null ? null : Number(body.weekNumber);

  if (body.batchId) {
    const [batch] = await db
      .select()
      .from(broilerBatches)
      .where(eq(broilerBatches.id, String(body.batchId)))
      .limit(1);
    if (!batch) throw new Error("Lote no encontrado para pesaje");
    resolvedBreed ||= batch.breed;
    if (resolvedWeek == null) {
      resolvedWeek = Math.max(
        0,
        Math.floor(
          (new Date(`${body.date}T12:00:00`).getTime() - new Date(`${batch.startDate}T12:00:00`).getTime()) /
            (7 * 86400000),
        ),
      );
    }
  }

  const prevRows = body.batchId
    ? await db
        .select({ date: weightLogs.date, avgWeightKg: weightLogs.avgWeightKg })
        .from(weightLogs)
        .where(and(eq(weightLogs.batchId, String(body.batchId)), sql`${weightLogs.date} < ${body.date}`))
        .orderBy(desc(weightLogs.date))
        .limit(1)
    : await db
        .select({ date: weightLogs.date, avgWeightKg: weightLogs.avgWeightKg })
        .from(weightLogs)
        .where(
          and(
            eq(weightLogs.locationId, body.locationId),
            eq(weightLogs.species, species),
            sql`${weightLogs.date} < ${body.date}`,
          ),
        )
        .orderBy(desc(weightLogs.date))
        .limit(1);

  let computedDailyGainG: number | null = null;
  if (prevRows[0]?.avgWeightKg) {
    const daysElapsed = Math.round(
      (new Date(`${body.date}T12:00:00`).getTime() - new Date(`${prevRows[0].date}T12:00:00`).getTime()) /
        86400000,
    );
    computedDailyGainG = computeDailyGainG(Number(prevRows[0].avgWeightKg) * 1000, resolvedWeightKg * 1000, daysElapsed);
  }

  await db.insert(weightLogs).values({
    id,
    date: String(body.date),
    species,
    batchId: body.batchId || null,
    locationId: body.locationId,
    henGroup: body.henGroup || null,
    breed: resolvedBreed || null,
    weekNumber: resolvedWeek,
    avgWeightKg: String(resolvedWeightKg),
    sampleSize: sample,
    individualWeightsG: parsedWeightsG.length > 0 ? parsedWeightsG : null,
    cvPercent: uniformity ? String(uniformity.cvPercent) : null,
    uniformityPct: uniformity ? String(uniformity.uniformityPct) : null,
    dailyGainG: computedDailyGainG != null ? String(computedDailyGainG) : null,
    notes: body.notes || null,
  });
}

async function processSanidadMutation(item: MutationItem) {
  const { id, payload: body } = item;
  const [existing] = await db
    .select({ id: healthControl.id })
    .from(healthControl)
    .where(eq(healthControl.id, id))
    .limit(1);
  if (existing) return;

  if (!isDateOnly(body.date)) {
    throw new Error("Fecha inválida en control sanitario");
  }
  if (typeof body.locationId !== "string" || !body.locationId.trim()) {
    throw new Error("Falta locationId para control sanitario");
  }
  if (typeof body.type !== "string" || !body.type.trim() || typeof body.description !== "string" || !body.description.trim()) {
    throw new Error("Tipo y descripción son requeridos para control sanitario");
  }

  const withdrawalDays = Math.max(0, Math.round(Number(body.withdrawalDays ?? 0) || 0));
  const withdrawalUntilDate = isDateOnly(body.withdrawalUntilDate)
    ? String(body.withdrawalUntilDate)
    : withdrawalDays > 0
      ? addDaysIso(String(body.date), withdrawalDays)
      : null;

  await db.transaction(async (tx) => {
    const dimRes = await resolveDimensions(tx, {
      species: body.species,
      locationId: body.locationId,
      batchId: body.batchId,
    });
    if ("error" in dimRes) throw new Error(dimRes.error);
    const dims = dimRes.dimensions;

    const [record] = await tx
      .insert(healthControl)
      .values({
        id,
        date: String(body.date),
        species: dims.species,
        locationId: dims.locationId ?? body.locationId,
        batchId: dims.batchId,
        type: String(body.type).trim(),
        description: String(body.description).trim(),
        affectedHens: body.affectedHens || null,
        product: body.product || null,
        withdrawalDays,
        withdrawalUntilDate,
        vaccineLot: typeof body.vaccineLot === "string" && body.vaccineLot.trim() ? body.vaccineLot.trim() : null,
        vaccineLab: typeof body.vaccineLab === "string" && body.vaccineLab.trim() ? body.vaccineLab.trim() : null,
        vaccineExpiryDate: isDateOnly(body.vaccineExpiryDate) ? String(body.vaccineExpiryDate) : null,
        coldChainTempC:
          body.coldChainTempC != null && String(body.coldChainTempC).trim() !== ""
            ? String(Number(body.coldChainTempC))
            : null,
        administrationRoute: typeof body.administrationRoute === "string" ? body.administrationRoute.trim() || null : null,
        cost: body.cost != null ? String(body.cost) : "0",
        nextScheduled: isDateOnly(body.nextScheduled) ? String(body.nextScheduled) : null,
        notes: body.notes || null,
      })
      .returning();

    if (Number(body.cost) > 0) {
      await tx.insert(transactions).values({
        date: String(body.date),
        type: "egreso",
        category: "Control sanitario",
        description: `${body.type}: ${body.description} (offline sync)`,
        amount: String(body.cost),
        sourceType: "sanidad",
        sourceId: record.id,
        species: record.species,
        locationId: record.locationId,
        batchId: record.batchId,
      });
    }
  });
}

function normCode(value: unknown): string | null {
  if (value == null) return null;
  const clean = String(value).trim().toUpperCase();
  return clean || null;
}

const REPRO_SPECIES_DEFAULTS = {
  conejo: { gestationDays: 31, palpationDay: 14, nestboxDay: 26, weaningDays: 32 },
  cuy: { gestationDays: 67, palpationDay: 18, nestboxDay: 58, weaningDays: 18 },
} as const;

async function processReproduccionMutation(item: MutationItem) {
  const { id, payload: body } = item;
  const [existing] = await db
    .select({ id: reproductionEvents.id })
    .from(reproductionEvents)
    .where(eq(reproductionEvents.id, id))
    .limit(1);
  if (existing) return;

  const speciesRaw = String(body.species || "").trim().toLowerCase();
  if (speciesRaw !== "conejo" && speciesRaw !== "cuy") {
    throw new Error("Especie reproductiva inválida (usa conejo o cuy)");
  }
  const species = speciesRaw as "conejo" | "cuy";
  const cfg = REPRO_SPECIES_DEFAULTS[species];
  const eventType = String(body.eventType || "empadre").trim().toLowerCase();
  if (!isDateOnly(body.eventDate)) throw new Error("Fecha de evento inválida en reproducción");
  const damCode = normCode(body.damCode);
  if (!damCode) throw new Error("El código de la hembra (damCode) es requerido");

  const sireCode = normCode(body.sireCode);
  const damMotherCode = normCode(body.damMotherCode);
  const damFatherCode = normCode(body.damFatherCode);
  const sireMotherCode = normCode(body.sireMotherCode);
  const sireFatherCode = normCode(body.sireFatherCode);

  await db.transaction(async (tx) => {
    if (eventType === "empadre" && sireCode) {
      if (damCode === sireCode) {
        throw new Error(`Auto-empadre bloqueado: ${damCode}`);
      }
      const history = await tx
        .select({
          damCode: reproductionEvents.damCode,
          sireCode: reproductionEvents.sireCode,
          damMotherCode: reproductionEvents.damMotherCode,
          damFatherCode: reproductionEvents.damFatherCode,
          sireMotherCode: reproductionEvents.sireMotherCode,
          sireFatherCode: reproductionEvents.sireFatherCode,
        })
        .from(reproductionEvents)
        .where(
          and(
            eq(reproductionEvents.species, species),
            or(eq(reproductionEvents.damCode, damCode), eq(reproductionEvents.sireCode, sireCode)),
          ),
        );

      const damAncestors = new Set<string>([damCode]);
      if (damMotherCode) damAncestors.add(damMotherCode);
      if (damFatherCode) damAncestors.add(damFatherCode);
      const sireAncestors = new Set<string>([sireCode]);
      if (sireMotherCode) sireAncestors.add(sireMotherCode);
      if (sireFatherCode) sireAncestors.add(sireFatherCode);

      for (const row of history) {
        if (normCode(row.damCode) === damCode) {
          if (normCode(row.damMotherCode)) damAncestors.add(normCode(row.damMotherCode)!);
          if (normCode(row.damFatherCode)) damAncestors.add(normCode(row.damFatherCode)!);
        }
        if (normCode(row.sireCode) === sireCode) {
          if (normCode(row.sireMotherCode)) sireAncestors.add(normCode(row.sireMotherCode)!);
          if (normCode(row.sireFatherCode)) sireAncestors.add(normCode(row.sireFatherCode)!);
        }
      }
      for (const ancestor of damAncestors) {
        if (sireAncestors.has(ancestor)) {
          throw new Error(`Riesgo de consanguinidad detectado: ancestro compartido (${ancestor})`);
        }
      }
    }

    const priorPartos = await tx
      .select({ id: reproductionEvents.id })
      .from(reproductionEvents)
      .where(
        and(
          eq(reproductionEvents.species, species),
          eq(reproductionEvents.damCode, damCode),
          eq(reproductionEvents.eventType, "parto"),
        ),
      );
    const parityNumber =
      body.parityNumber != null && Number.isSafeInteger(Number(body.parityNumber)) && Number(body.parityNumber) >= 1
        ? Number(body.parityNumber)
        : Math.max(1, priorPartos.length + (eventType === "parto" || eventType === "empadre" ? 1 : 0));

    const expectedPalpationDate =
      body.expectedPalpationDate || (eventType === "empadre" ? addDaysIso(String(body.eventDate), cfg.palpationDay) : null);
    const expectedNestboxDate =
      body.expectedNestboxDate || (eventType === "empadre" ? addDaysIso(String(body.eventDate), cfg.nestboxDay) : null);
    const expectedBirthDate =
      body.expectedBirthDate || (eventType === "empadre" ? addDaysIso(String(body.eventDate), cfg.gestationDays) : null);

    await tx.insert(reproductionEvents).values({
      id,
      species,
      eventType,
      eventDate: String(body.eventDate),
      damCode,
      sireCode,
      damMotherCode,
      damFatherCode,
      sireMotherCode,
      sireFatherCode,
      batchId: body.batchId || null,
      locationId: body.locationId || null,
      parentEventId: body.parentEventId || null,
      parityNumber,
      expectedPalpationDate,
      expectedNestboxDate,
      expectedBirthDate,
      palpationResult: body.palpationResult || null,
      bornAlive: body.bornAlive != null ? Number(body.bornAlive) : null,
      bornDead: body.bornDead != null ? Number(body.bornDead) : 0,
      litterBirthWeightG: body.litterBirthWeightG != null ? String(body.litterBirthWeightG) : null,
      weanedTotal: body.weanedTotal != null ? Number(body.weanedTotal) : null,
      weanedMales: body.weanedMales != null ? Number(body.weanedMales) : null,
      weanedFemales: body.weanedFemales != null ? Number(body.weanedFemales) : null,
      litterWeanWeightG: body.litterWeanWeightG != null ? String(body.litterWeanWeightG) : null,
      litterDailyGainG: body.litterDailyGainG != null ? String(body.litterDailyGainG) : null,
      status: String(body.status || (eventType === "destete" ? "destetada" : eventType === "parto" ? "lactancia" : "activo")),
      notes: body.notes || null,
    });
  });
}

async function processBioseguridadMutation(item: MutationItem) {
  const { id, payload: body } = item;
  const [existing] = await db
    .select({ id: biosecurityLogs.id })
    .from(biosecurityLogs)
    .where(eq(biosecurityLogs.id, id))
    .limit(1);
  if (existing) return;

  if (!isDateOnly(body.date)) throw new Error("Fecha inválida en bioseguridad");
  const logType = String(body.logType || "").trim();
  if (!logType) throw new Error("logType es requerido en bioseguridad");

  const user = await getSessionUser();
  const checklist =
    body.checklistItems && typeof body.checklistItems === "object" && !Array.isArray(body.checklistItems)
      ? body.checklistItems
      : {};
  const welfareScore = body.welfareScore != null && body.welfareScore !== "" ? Number(body.welfareScore) : null;

  await db.transaction(async (tx) => {
    await assertDateNotClosed(tx, { date: String(body.date) });
    await tx.insert(biosecurityLogs).values({
      id,
      date: String(body.date),
      logType,
      locationId: body.locationId || null,
      species: body.species || null,
      checklistItems: checklist,
      welfareScore,
      complianceStatus: String(body.complianceStatus || "cumple"),
      inspectorName: body.inspectorName || null,
      staffName: body.staffName || null,
      trainingTopic: body.trainingTopic || null,
      trainingCertificateUntil: isDateOnly(body.trainingCertificateUntil) ? String(body.trainingCertificateUntil) : null,
      disinfectantUsed: body.disinfectantUsed || null,
      notes: body.notes || null,
      createdBy: user?.id && user.id !== "test-user" ? user.id : null,
    });
  });
}

async function processCierreDiarioMutation(item: MutationItem) {
  const { id, payload: body } = item;
  const closureDate = isDateOnly(body?.closureDate) ? String(body.closureDate) : todayColombiaIso();
  const [existingById] = await db
    .select({ id: dailyClosures.id })
    .from(dailyClosures)
    .where(eq(dailyClosures.id, id))
    .limit(1);
  if (existingById) return;

  const [existingByDate] = await db
    .select()
    .from(dailyClosures)
    .where(eq(dailyClosures.closureDate, closureDate))
    .limit(1);

  if (existingByDate && existingByDate.status === "cerrado") {
    // Ya cerrado para la fecha: idempotente para sincronización offline
    return;
  }

  const [eggs, eSales, bSales, mSales, deaths, txs, health] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int` }).from(eggProduction).where(eq(eggProduction.date, closureDate)),
    db.select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${eggSales.totalAmount}), 0)::text` }).from(eggSales).where(eq(eggSales.date, closureDate)),
    db.select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${chickenSales.totalAmount}), 0)::text` }).from(chickenSales).where(eq(chickenSales.date, closureDate)),
    db.select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${meatSales.totalAmount}), 0)::text` }).from(meatSales).where(eq(meatSales.date, closureDate)),
    db.select({ total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int` }).from(mortalityRecords).where(eq(mortalityRecords.date, closureDate)),
    db.select({
      income: sql<string>`coalesce(sum(case when ${transactions.type} = 'ingreso' then ${transactions.amount} else 0 end), 0)::text`,
      expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'egreso' then ${transactions.amount} else 0 end), 0)::text`,
    }).from(transactions).where(eq(transactions.date, closureDate)),
    db.select({ count: sql<number>`count(*)::int` }).from(healthControl).where(eq(healthControl.date, closureDate)),
  ]);

  const snapshot = {
    closureDate,
    eggsCollected: eggs[0]?.total || 0,
    eggRecords: eggs[0]?.count || 0,
    mortalityUnits: deaths[0]?.total || 0,
    sanitaryEvents: health[0]?.count || 0,
    salesCount: (eSales[0]?.count || 0) + (bSales[0]?.count || 0) + (mSales[0]?.count || 0),
    salesTotalCop: Math.round(Number(eSales[0]?.total || 0) + Number(bSales[0]?.total || 0) + Number(mSales[0]?.total || 0)),
    incomeCop: Math.round(Number(txs[0]?.income || 0)),
    expenseCop: Math.round(Number(txs[0]?.expense || 0)),
    capturedAt: new Date().toISOString(),
  };

  const user = await getSessionUser();
  const validUserId = user?.id && user.id !== "test-user" ? user.id : null;

  if (existingByDate) {
    await db
      .update(dailyClosures)
      .set({
        status: "cerrado",
        closedBy: validUserId,
        closedAt: new Date(),
        summarySnapshot: snapshot,
        notes: typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : existingByDate.notes,
      })
      .where(eq(dailyClosures.id, existingByDate.id));
    return;
  }

  await db.insert(dailyClosures).values({
    id,
    closureDate,
    status: "cerrado",
    closedBy: validUserId,
    closedAt: new Date(),
    summarySnapshot: snapshot,
    notes: typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
  });
}
