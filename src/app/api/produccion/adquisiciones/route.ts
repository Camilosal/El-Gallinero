import { db } from "@/db";
import {
  birdAcquisitions, hens, roosters, broilerBatches, transactions,
  incubation, chickenSales, slaughter, mortalityRecords, eggProduction, autoconsumoLogs, weightLogs,
  farmLocations, animalLocationMovements,
} from "@/db/schema";
import { eq, desc, sql, and, inArray, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { deleteTransactionsAndUnpaidAccounts, upsertExpenseTransaction } from "@/lib/financial-records";
import { speciesLabel } from "@/lib/species-db";
import { validateBreedAssociation } from "@/lib/animal-breed-validation";
import { assertLocationEntryAllowed } from "@/lib/sanitary-locks";
import { assertCanCreateActiveBatch } from "@/lib/subscription";
import type { ManagedAnimalSpecies } from "@/lib/animal-breeds";

export const dynamic = "force-dynamic";

const TRACE_TEXT_LIMITS = {
  geneticLine: 150,
  generation: 50,
  originFarm: 200,
  originLocation: 200,
  sourceBatchCode: 100,
  motherIdentifier: 100,
  fatherIdentifier: 100,
} as const;

function optionalTraceText(value: unknown, field: keyof typeof TRACE_TEXT_LIMITS): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (text.length > TRACE_TEXT_LIMITS[field]) throw new Error(`${field} supera ${TRACE_TEXT_LIMITS[field]} caracteres`);
  return text || null;
}

function optionalEvidenceReference(value: unknown): string | null {
  if (value == null) return null;
  const reference = String(value).trim();
  if (reference.length > 2000) throw new Error("La referencia documental supera 2000 caracteres");
  return reference || null;
}

/** Generate next sequential codes inside a transaction */
async function nextCodesInTx(tx: any, table: any, prefix: string, count: number): Promise<string[]> {
  const existingCodes = (await tx.select({ code: table.code }).from(table)).map((r: any) => r.code);
  let max = 0;
  const re = new RegExp(`^${prefix.replace("-", "\\-")}-(\\d+)$`);
  for (const code of existingCodes) {
    const m = code.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + i + 1).padStart(3, "0")}`);
}

const BATCH_TYPES = ["lote_pollos", "codorniz", "pato", "conejo", "cuy"] as const;
const VALID_BIRD_TYPES = ["gallina", "gallo", ...BATCH_TYPES] as const;
const ACQUISITION_TYPES = ["compra", "donacion", "pollito_comprado", "cria_propia"] as const;
const BATCH_PURPOSES = ["engorde_carne", "postura_huevo", "pie_cria", "mixto"] as const;

function acquisitionSpecies(birdType: string): string {
  if (birdType === "gallina" || birdType === "gallo") return "gallina";
  if (birdType === "lote_pollos") return "pollo";
  return birdType;
}

function acquisitionLabel(birdType: string): string {
  if (birdType === "gallina") return "gallinas";
  if (birdType === "gallo") return "gallos";
  if (birdType === "lote_pollos") return "pollos";
  return speciesLabel(birdType, true).toLowerCase();
}

function isNoCostAcquisition(acquisitionType: string): boolean {
  return acquisitionType === "donacion" || acquisitionType === "cria_propia";
}

async function nextBatchCodeInTx(tx: any, species: string): Promise<string> {
  const prefix = species === "codorniz" ? "L-COD-"
    : species === "pato" ? "L-PAT-"
    : species === "conejo" ? "L-CON-"
    : species === "cuy" ? "L-CUY-"
    : "L-";
  const rows = await tx.select({ code: broilerBatches.code })
    .from(broilerBatches)
    .where(sql`${broilerBatches.code} LIKE ${prefix + "%"}`);
  const re = new RegExp(`^${prefix.replaceAll("-", "\\-")}(\\d+)$`);
  const max = rows.reduce((current: number, row: { code: string }) => {
    const match = String(row.code).match(re);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export const GET = withApiHandler(async () => {
  const [data, batchRows, henRows, roosterRows, flockRows, locationRows] = await Promise.all([
    db.select().from(birdAcquisitions).orderBy(desc(birdAcquisitions.createdAt)),
    db.select({ acquisitionId: broilerBatches.acquisitionId, purpose: broilerBatches.purpose })
      .from(broilerBatches)
      .where(sql`${broilerBatches.acquisitionId} IS NOT NULL`),
    db.select({ acquisitionId: hens.acquisitionId, code: hens.code }).from(hens)
      .where(sql`${hens.acquisitionId} IS NOT NULL`),
    db.select({ acquisitionId: roosters.acquisitionId, code: roosters.code }).from(roosters)
      .where(sql`${roosters.acquisitionId} IS NOT NULL`),
    db.select({ acquisitionId: broilerBatches.acquisitionId, code: broilerBatches.code }).from(broilerBatches)
      .where(sql`${broilerBatches.acquisitionId} IS NOT NULL`),
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
  ]);
  const purposeByAcquisition = new Map(batchRows.map((row) => [row.acquisitionId, row.purpose]));
  const codesByAcquisition = new Map<string, string[]>();
  const locationNameById = new Map(locationRows.map((row) => [row.id, row.name]));
  for (const row of [...henRows, ...roosterRows, ...flockRows]) {
    if (!row.acquisitionId) continue;
    const codes = codesByAcquisition.get(row.acquisitionId) || [];
    codes.push(row.code);
    codesByAcquisition.set(row.acquisitionId, codes);
  }
  return NextResponse.json(data.map((row) => ({
    ...row,
    destinationLocationName: row.destinationLocationId ? locationNameById.get(row.destinationLocationId) || null : null,
    purpose: purposeByAcquisition.get(row.id) || null,
    registeredCodes: codesByAcquisition.get(row.id) || [],
  })));
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { date, acquisitionType, birdType, quantity, unitCost, supplier, breed, birthDate, notes } = body;
  const quantityNumber = Number(quantity);

  if (!date || !acquisitionType || !birdType || !Number.isInteger(quantityNumber) || quantityNumber < 1) {
    return NextResponse.json({ error: "Fecha, tipo, especie y cantidad son requeridos" }, { status: 400 });
  }
  if (!(ACQUISITION_TYPES as readonly string[]).includes(acquisitionType)) {
    return NextResponse.json({ error: "Tipo de adquisición inválido" }, { status: 400 });
  }
  if (!(VALID_BIRD_TYPES as readonly string[]).includes(birdType)) {
    return NextResponse.json({ error: "Especie o tipo de animal inválido" }, { status: 400 });
  }
  if (!Number.isFinite(new Date(date).getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  if (!body.destinationLocationId) return NextResponse.json({ error: "Selecciona el lugar de destino antes de registrar los animales" }, { status: 400 });
  const unitCostNumber = unitCost == null || unitCost === "" ? null : Number(unitCost);
  if (!isNoCostAcquisition(acquisitionType) && (!Number.isFinite(unitCostNumber) || unitCostNumber! <= 0)) {
    return NextResponse.json({ error: "El costo unitario debe ser mayor que cero" }, { status: 400 });
  }
  if (unitCostNumber != null && (!Number.isFinite(unitCostNumber) || unitCostNumber < 0)) {
    return NextResponse.json({ error: "Costo unitario inválido" }, { status: 400 });
  }

  const totalCost = !isNoCostAcquisition(acquisitionType) ? unitCostNumber! * quantityNumber : null;
  const species = acquisitionSpecies(birdType);
  const breedError = await validateBreedAssociation(db, String(breed || ""), species as ManagedAnimalSpecies);
  if (breedError) return NextResponse.json({ error: breedError }, { status: 400 });
  const purpose = body.purpose || "engorde_carne";
  const isBatchCreation = (BATCH_TYPES as readonly string[]).includes(birdType);
  if (isBatchCreation && !(BATCH_PURPOSES as readonly string[]).includes(purpose)) {
    return NextResponse.json({ error: "Destino del lote inválido" }, { status: 400 });
  }
  if (isBatchCreation) {
    const quotaCheck = await assertCanCreateActiveBatch();
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: quotaCheck.error,
          code: quotaCheck.code || "UPGRADE_REQUIRED",
          subscription: quotaCheck.status,
        },
        { status: 402 },
      );
    }
  }
  if (purpose === "postura_huevo" && !["codorniz", "pato"].includes(species)) {
    return NextResponse.json({ error: "Los lotes para postura deben ser de codornices o patos; las gallinas se registran individualmente" }, { status: 400 });
  }
  if ((body.motherHenId || body.fatherRoosterId) && !["gallina", "pollo"].includes(species)) {
    return NextResponse.json({ error: "Solo se pueden enlazar fichas de gallinas y gallos como padres de aves de corral" }, { status: 400 });
  }
  let traceFields: Record<string, string | null>;
  try {
    traceFields = Object.fromEntries(
      Object.keys(TRACE_TEXT_LIMITS).map((key) => [key, optionalTraceText(body[key], key as keyof typeof TRACE_TEXT_LIMITS)]),
    );
    optionalEvidenceReference(body.geneticEvidenceReference);
    optionalEvidenceReference(body.healthEvidenceReference);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Dato de trazabilidad inválido" }, { status: 400 });
  }
  const today = birthDate || new Date().toISOString().split("T")[0];

  const result = await db.transaction(async (tx) => {
    const destination = await assertLocationEntryAllowed(tx, {
      locationId: String(body.destinationLocationId),
      species,
      date,
      lock: true,
    });
    const [capacity] = await tx.select({ capacity: farmLocations.capacity }).from(farmLocations).where(eq(farmLocations.id, destination.id));
    if (capacity?.capacity != null) {
      const [[henCount], [roosterCount], [batchCount]] = await Promise.all([
        tx.select({ total: sql<number>`count(*)::int` }).from(hens)
          .where(and(eq(hens.locationId, destination.id), or(eq(hens.status, "activa"), eq(hens.status, "empollando"), eq(hens.status, "enferma"), eq(hens.status, "recomendada_sacrificio")))),
        tx.select({ total: sql<number>`count(*)::int` }).from(roosters)
          .where(and(eq(roosters.locationId, destination.id), or(eq(roosters.status, "activo"), eq(roosters.status, "enfermo")))),
        tx.select({ total: sql<number>`coalesce(sum(${broilerBatches.currentQuantity}),0)::int` }).from(broilerBatches)
          .where(and(eq(broilerBatches.locationId, destination.id), inArray(broilerBatches.status, ["activo", "listo_sacrificio"]))),
      ]);
      const occupied = Number(henCount?.total || 0) + Number(roosterCount?.total || 0) + Number(batchCount?.total || 0);
      if (occupied + quantityNumber > capacity.capacity) throw new Error(`La capacidad del lugar es de ${capacity.capacity} animales y no alcanza para este ingreso`);
    }
    const motherHenId = body.motherHenId ? String(body.motherHenId) : null;
    const fatherRoosterId = body.fatherRoosterId ? String(body.fatherRoosterId) : null;
    const mother = motherHenId
      ? (await tx.select({ id: hens.id, code: hens.code }).from(hens).where(eq(hens.id, motherHenId)))[0]
      : undefined;
    const father = fatherRoosterId
      ? (await tx.select({ id: roosters.id, code: roosters.code }).from(roosters).where(eq(roosters.id, fatherRoosterId)))[0]
      : undefined;
    if (motherHenId && !mother) throw new Error("Madre no encontrada");
    if (fatherRoosterId && !father) throw new Error("Padre no encontrado");
    const [acquisition] = await tx.insert(birdAcquisitions).values({
      date,
      acquisitionType,
      species: species as any,
      birdType,
      quantity: quantityNumber,
      unitCost: isNoCostAcquisition(acquisitionType) || unitCostNumber == null ? null : String(unitCostNumber),
      totalCost: totalCost == null ? null : String(totalCost),
      supplier: supplier || null,
      breed: breed || null,
      geneticLine: traceFields.geneticLine,
      generation: traceFields.generation,
      originFarm: traceFields.originFarm,
      originLocation: traceFields.originLocation,
      sourceBatchCode: traceFields.sourceBatchCode,
      motherHenId,
      fatherRoosterId,
      destinationLocationId: destination.id,
      motherIdentifier: mother?.code || traceFields.motherIdentifier,
      fatherIdentifier: father?.code || traceFields.fatherIdentifier,
      geneticEvidenceReference: optionalEvidenceReference(body.geneticEvidenceReference),
      healthEvidenceReference: optionalEvidenceReference(body.healthEvidenceReference),
      birthDate: today,
      notes: notes || null,
    }).returning();

    let createdBirdIds: string[] = [];

    if (birdType === "gallina") {
      await tx.execute(sql`LOCK TABLE ${hens} IN EXCLUSIVE MODE`);
      const codes = await nextCodesInTx(tx, hens, "G", quantityNumber);
      const inserted = await tx.insert(hens).values(
        codes.map((code) => ({
          code,
          breed: breed || "Criolla",
          birthDate: today,
          status: "activa" as const,
          isBroody: false,
          acquisitionId: acquisition.id,
          locationId: destination.id,
          acquisitionCost: isNoCostAcquisition(acquisitionType) || unitCostNumber == null ? null : String(unitCostNumber),
        }))
      ).returning();
      createdBirdIds = inserted.map((h) => h.id);
      await tx.insert(animalLocationMovements).values(inserted.map((hen) => ({
        henId: hen.id,
        fromLocationId: null,
        toLocationId: destination.id,
        quantity: 1,
        date,
        reason: `Ingreso por ${acquisitionType}`,
        notes: `Adquisición ${acquisition.id}`,
      })));
    } else if (birdType === "gallo") {
      await tx.execute(sql`LOCK TABLE ${roosters} IN EXCLUSIVE MODE`);
      const codes = await nextCodesInTx(tx, roosters, "GA", quantityNumber);
      const inserted = await tx.insert(roosters).values(
        codes.map((code) => ({
          code,
          breed: breed || "Criolla",
          birthDate: today,
          status: "activo" as const,
          acquisitionId: acquisition.id,
          locationId: destination.id,
          acquisitionCost: isNoCostAcquisition(acquisitionType) || unitCostNumber == null ? null : String(unitCostNumber),
        }))
      ).returning();
      createdBirdIds = inserted.map((r) => r.id);
      await tx.insert(animalLocationMovements).values(inserted.map((rooster) => ({
        roosterId: rooster.id,
        fromLocationId: null,
        toLocationId: destination.id,
        quantity: 1,
        date,
        reason: `Ingreso por ${acquisitionType}`,
        notes: `Adquisición ${acquisition.id}`,
      })));
    } else {
      await tx.execute(sql`LOCK TABLE ${broilerBatches} IN EXCLUSIVE MODE`);
      const code = await nextBatchCodeInTx(tx, species);
      const targetWeeks = species === "codorniz" ? 5
        : species === "pato" ? 9
        : species === "conejo" ? 11
        : species === "cuy" ? 13
        : 7;
      const targetWeightKg = species === "codorniz" ? "0.15"
        : species === "pato" ? "3.2"
        : species === "conejo" ? "2.4"
        : species === "cuy" ? "1.10"
        : "2.5";
      const [batch] = await tx.insert(broilerBatches).values({
        code,
        species: species as any,
        purpose: purpose as any,
        breed: breed || speciesLabel(species),
        startDate: today,
        initialQuantity: quantityNumber,
        currentQuantity: quantityNumber,
        targetWeeks,
        targetDays: targetWeeks * 7,
        targetWeightKg,
        acquisitionId: acquisition.id,
        locationId: destination.id,
        notes: notes || `Lote ingresado por ${acquisitionType}`,
      }).returning();
      createdBirdIds = [batch.id];
      await tx.insert(animalLocationMovements).values({
        batchId: batch.id,
        fromLocationId: null,
        toLocationId: destination.id,
        quantity: quantityNumber,
        date,
        reason: `Ingreso por ${acquisitionType}`,
        notes: `Adquisición ${acquisition.id}`,
      });
    }

    if (!isNoCostAcquisition(acquisitionType) && totalCost != null) {
      await tx.insert(transactions).values({
        date,
        type: "egreso",
        category: "Compra de animales",
        description: `Compra de ${quantity} ${acquisitionLabel(birdType)}${breed ? ` (${breed})` : ""}${supplier ? ` a ${supplier}` : ""}`,
        counterparty: supplier || null,
        amount: String(totalCost),
        quantity: String(quantityNumber),
        unitPrice: unitCostNumber == null ? null : String(unitCostNumber),
        unit: "animales",
        sourceType: "adquisicion",
        sourceId: acquisition.id,
        species: acquisition.species ?? null,
        locationId: destination.id,
        notes: notes || null,
      });
    }

    return { ...acquisition, createdBirdIds };
  });

  return NextResponse.json(result, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  if (body.breed !== undefined) {
    const [current] = await db.select({ birdType: birdAcquisitions.birdType, breed: birdAcquisitions.breed })
      .from(birdAcquisitions).where(eq(birdAcquisitions.id, body.id));
    if (current && body.breed !== current.breed) {
      const species = acquisitionSpecies(current.birdType) as ManagedAnimalSpecies;
      const breedError = await validateBreedAssociation(db, String(body.breed || ""), species);
      if (breedError) return NextResponse.json({ error: breedError }, { status: 400 });
    }
  }

  let updated;
  try {
    updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(birdAcquisitions).where(eq(birdAcquisitions.id, body.id)).for("update");
    if (!existing) throw new Error("No encontrado");

    const date = body.date ?? existing.date;
    const acquisitionType = body.acquisitionType ?? existing.acquisitionType;
    const unitCost = body.unitCost !== undefined
      ? (body.unitCost === "" || body.unitCost == null ? null : Number(body.unitCost))
      : (existing.unitCost == null ? null : Number(existing.unitCost));
    if (!Number.isFinite(new Date(date).getTime())) throw new Error("Fecha inválida");
    if (!(ACQUISITION_TYPES as readonly string[]).includes(acquisitionType)) throw new Error("Tipo de adquisición inválido");
    if (!isNoCostAcquisition(acquisitionType) && (!Number.isFinite(unitCost) || unitCost! <= 0)) {
      throw new Error("El costo unitario debe ser mayor que cero");
    }
    if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) throw new Error("Costo unitario inválido");

    const totalCost = isNoCostAcquisition(acquisitionType) ? null : unitCost! * existing.quantity;
    const nextBreed = body.breed !== undefined ? body.breed : existing.breed;
    const nextBirthDate = body.birthDate !== undefined ? body.birthDate : existing.birthDate;
    const species = acquisitionSpecies(existing.birdType);
    const motherHenId = body.motherHenId !== undefined ? (body.motherHenId ? String(body.motherHenId) : null) : existing.motherHenId;
    const fatherRoosterId = body.fatherRoosterId !== undefined ? (body.fatherRoosterId ? String(body.fatherRoosterId) : null) : existing.fatherRoosterId;
    if ((motherHenId || fatherRoosterId) && !["gallina", "pollo"].includes(species)) {
      throw new Error("Solo se pueden enlazar fichas de gallinas y gallos como padres de aves de corral");
    }
    let traceFields: Record<string, string | null> = {};
    for (const key of Object.keys(TRACE_TEXT_LIMITS) as (keyof typeof TRACE_TEXT_LIMITS)[]) {
      if (body[key] !== undefined) traceFields[key] = optionalTraceText(body[key], key);
    }
    const mother = motherHenId
      ? (await tx.select({ id: hens.id, code: hens.code }).from(hens).where(eq(hens.id, motherHenId)))[0]
      : undefined;
    const father = fatherRoosterId
      ? (await tx.select({ id: roosters.id, code: roosters.code }).from(roosters).where(eq(roosters.id, fatherRoosterId)))[0]
      : undefined;
    if (motherHenId && !mother) throw new Error("Madre no encontrada");
    if (fatherRoosterId && !father) throw new Error("Padre no encontrado");
    const motherIdentifier = mother?.code || (body.motherIdentifier !== undefined
      ? optionalTraceText(body.motherIdentifier, "motherIdentifier")
      : existing.motherIdentifier);
    const fatherIdentifier = father?.code || (body.fatherIdentifier !== undefined
      ? optionalTraceText(body.fatherIdentifier, "fatherIdentifier")
      : existing.fatherIdentifier);
    const geneticEvidenceReference = body.geneticEvidenceReference !== undefined
      ? optionalEvidenceReference(body.geneticEvidenceReference)
      : existing.geneticEvidenceReference;
    const healthEvidenceReference = body.healthEvidenceReference !== undefined
      ? optionalEvidenceReference(body.healthEvidenceReference)
      : existing.healthEvidenceReference;
    if (nextBirthDate && !Number.isFinite(new Date(nextBirthDate).getTime())) throw new Error("Fecha de nacimiento inválida");
    if (body.purpose !== undefined && !(BATCH_PURPOSES as readonly string[]).includes(body.purpose)) {
      throw new Error("Destino del lote inválido");
    }
    if (body.purpose === "postura_huevo" && !["codorniz", "pato"].includes(acquisitionSpecies(existing.birdType))) {
      throw new Error("Los lotes para postura deben ser de codornices o patos; las gallinas se registran individualmente");
    }
    const [row] = await tx.update(birdAcquisitions).set({
      date,
      acquisitionType,
      unitCost: isNoCostAcquisition(acquisitionType) || unitCost == null ? null : String(unitCost),
      totalCost: totalCost == null ? null : String(totalCost),
      supplier: body.supplier !== undefined ? body.supplier : existing.supplier,
      breed: nextBreed,
      ...traceFields,
      motherHenId,
      fatherRoosterId,
      motherIdentifier,
      fatherIdentifier,
      geneticEvidenceReference,
      healthEvidenceReference,
      birthDate: nextBirthDate,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    }).where(eq(birdAcquisitions.id, body.id)).returning();

    const acquisitionCostChanged = body.unitCost !== undefined || body.acquisitionType !== undefined;
    if (body.breed !== undefined || body.birthDate !== undefined || body.purpose !== undefined || acquisitionCostChanged) {
      const birdValues = {
        ...(body.breed !== undefined ? { breed: body.breed } : {}),
        ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
        updatedAt: new Date(),
      };
      const acquisitionCost = isNoCostAcquisition(acquisitionType) || unitCost == null ? null : String(unitCost);
      if (existing.birdType === "gallina") await tx.update(hens).set({
        ...birdValues,
        ...(acquisitionCostChanged ? { acquisitionCost } : {}),
      }).where(eq(hens.acquisitionId, body.id));
      else if (existing.birdType === "gallo") await tx.update(roosters).set({
        ...birdValues,
        ...(acquisitionCostChanged ? { acquisitionCost } : {}),
      }).where(eq(roosters.acquisitionId, body.id));
      else await tx.update(broilerBatches).set({
        ...birdValues,
        ...(body.purpose !== undefined ? { purpose: body.purpose } : {}),
      }).where(eq(broilerBatches.acquisitionId, body.id));
    }

    const transactionCondition = and(eq(transactions.sourceType, "adquisicion"), eq(transactions.sourceId, body.id));
    if (isNoCostAcquisition(acquisitionType)) {
      await deleteTransactionsAndUnpaidAccounts(tx, transactionCondition);
    } else {
      await upsertExpenseTransaction(tx, {
        condition: transactionCondition,
        date,
        category: "Compra de animales",
        description: `Compra de ${existing.quantity} ${acquisitionLabel(existing.birdType)}${row.breed ? ` (${row.breed})` : ""}${row.supplier ? ` a ${row.supplier}` : ""}`,
        amount: String(totalCost),
        sourceType: "adquisicion",
        sourceId: body.id,
        counterparty: row.supplier,
        species: row.species ?? null,
        locationId: row.destinationLocationId ?? null,
      });
    }

    return row;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de trazabilidad";
    if (message.includes("caracteres") || message.includes("Solo se pueden enlazar")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [acquisition] = await tx.select().from(birdAcquisitions).where(eq(birdAcquisitions.id, id)).for("update");
    if (!acquisition) throw new Error("No encontrada");

    const acquisitionBirds = acquisition.birdType === "gallina"
      ? await tx.select({ id: hens.id, status: hens.status }).from(hens).where(eq(hens.acquisitionId, id)).for("update")
      : acquisition.birdType === "gallo"
        ? await tx.select({ id: roosters.id, status: roosters.status }).from(roosters).where(eq(roosters.acquisitionId, id)).for("update")
        : await tx.select({ id: broilerBatches.id, status: broilerBatches.status, currentQuantity: broilerBatches.currentQuantity, initialQuantity: broilerBatches.initialQuantity }).from(broilerBatches).where(eq(broilerBatches.acquisitionId, id)).for("update");
    const birdIds = acquisitionBirds.map((bird) => bird.id);
    if (birdIds.length > 0) {
      const hasExited = acquisitionBirds.some((bird) => ["vendida", "vendido", "faena", "muerta", "muerto"].includes(String(bird.status))) ||
        acquisitionBirds.some((bird) => "currentQuantity" in bird && "initialQuantity" in bird && Number(bird.currentQuantity) !== Number(bird.initialQuantity));
      if (hasExited) throw new Error("No se puede eliminar la adquisición porque las aves asociadas ya salieron del inventario");

      let hasLinkedActivity = false;
      hasLinkedActivity = (await tx.select({ id: animalLocationMovements.id }).from(animalLocationMovements)
        .where(or(inArray(animalLocationMovements.henId, birdIds), inArray(animalLocationMovements.roosterId, birdIds), inArray(animalLocationMovements.batchId, birdIds))).limit(1)).length > 0;
      if (acquisition.birdType === "gallina") {
        hasLinkedActivity = hasLinkedActivity || (await tx.select({ id: incubation.id }).from(incubation).where(inArray(incubation.henId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: chickenSales.id }).from(chickenSales).where(inArray(chickenSales.henId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: slaughter.id }).from(slaughter).where(inArray(slaughter.henId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(inArray(mortalityRecords.henId, birdIds)).limit(1)).length > 0;
      } else if (acquisition.birdType === "gallo") {
        hasLinkedActivity = hasLinkedActivity || (await tx.select({ id: chickenSales.id }).from(chickenSales).where(inArray(chickenSales.roosterId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: slaughter.id }).from(slaughter).where(inArray(slaughter.roosterId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(inArray(mortalityRecords.roosterId, birdIds)).limit(1)).length > 0;
      } else {
        hasLinkedActivity = hasLinkedActivity || (await tx.select({ id: chickenSales.id }).from(chickenSales).where(inArray(chickenSales.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: slaughter.id }).from(slaughter).where(inArray(slaughter.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(inArray(mortalityRecords.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: eggProduction.id }).from(eggProduction).where(inArray(eggProduction.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: autoconsumoLogs.id }).from(autoconsumoLogs).where(inArray(autoconsumoLogs.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: weightLogs.id }).from(weightLogs).where(inArray(weightLogs.batchId, birdIds)).limit(1)).length > 0;
      }
      if (hasLinkedActivity) throw new Error("No se puede eliminar la adquisición porque las aves asociadas tienen movimientos registrados");
    }

    if (acquisition.birdType === "gallina") {
      await tx.delete(hens).where(eq(hens.acquisitionId, id));
    } else if (acquisition.birdType === "gallo") {
      await tx.delete(roosters).where(eq(roosters.acquisitionId, id));
    } else {
      await tx.delete(broilerBatches).where(eq(broilerBatches.acquisitionId, id));
    }

    if (!isNoCostAcquisition(acquisition.acquisitionType)) {
      await deleteTransactionsAndUnpaidAccounts(
        tx,
        and(eq(transactions.sourceType, "adquisicion"), eq(transactions.sourceId, id)),
      );
    }

    await tx.delete(birdAcquisitions).where(eq(birdAcquisitions.id, id));
  });

  return NextResponse.json({ ok: true });
});
