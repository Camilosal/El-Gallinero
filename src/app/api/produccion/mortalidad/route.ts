import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { mortalityRecords, hens, roosters, broilerBatches, slaughter, chickenSales, farmLocations } from "@/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";
import { computeAnimalInventory } from "@/lib/animal-inventory";
import {
  captureAnimalExitSnapshots,
  restoreBatchExit,
  restoreHenExit,
  restoreRoosterExit,
  validateBatchForExit,
  validateRoosterForExit,
} from "@/lib/birdExit";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const BATCH_MORTALITY_SPECIES: Record<string, "pollo" | "codorniz" | "pato" | "conejo" | "cuy"> = {
  lote_pollos: "pollo",
  lote_codornices: "codorniz",
  lote_patos: "pato",
  lote_conejos: "conejo",
  lote_cuyes: "cuy",
};
const MORTALITY_TYPES = new Set(["gallina", "gallo", ...Object.keys(BATCH_MORTALITY_SPECIES)]);
const MORTALITY_CAUSES = new Set(["enfermedad", "depredador", "accidente", "sacrificio_sanitario", "causa_natural", "otro"]);

function isBatchMortalityType(birdType: string): boolean {
  return Object.hasOwn(BATCH_MORTALITY_SPECIES, birdType);
}


async function lockMortalityTarget(client: any, record: { henId: string | null; roosterId: string | null; batchId: string | null }) {
  if (record.henId) await client.select({ id: hens.id }).from(hens).where(eq(hens.id, record.henId)).for("update");
  if (record.roosterId) await client.select({ id: roosters.id }).from(roosters).where(eq(roosters.id, record.roosterId)).for("update");
  if (record.batchId) await client.select({ id: broilerBatches.id }).from(broilerBatches).where(eq(broilerBatches.id, record.batchId)).for("update");
}

function sameMortalityTarget(
  a: { birdType: string; quantity: number; henId: string | null; roosterId: string | null; batchId: string | null },
  b: { birdType: string; quantity: number; henId: string | null; roosterId: string | null; batchId: string | null },
) {
  return a.birdType === b.birdType && a.quantity === b.quantity && a.henId === b.henId && a.roosterId === b.roosterId && a.batchId === b.batchId;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const period = Number(searchParams.get("period")) || 30;

  const records = await db
    .select({
      id: mortalityRecords.id,
      date: mortalityRecords.date,
      locationId: mortalityRecords.locationId,
      locationName: farmLocations.name,
      birdType: mortalityRecords.birdType,
      species: mortalityRecords.species,
      quantity: mortalityRecords.quantity,
      cause: mortalityRecords.cause,
      henId: mortalityRecords.henId,
      roosterId: mortalityRecords.roosterId,
      batchId: mortalityRecords.batchId,
      healthControlId: mortalityRecords.healthControlId,
      description: mortalityRecords.description,
      createdAt: mortalityRecords.createdAt,
      henCode: hens.code,
      roosterCode: roosters.code,
      batchCode: broilerBatches.code,
      batchSpecies: broilerBatches.species,
    })
    .from(mortalityRecords)
    .leftJoin(hens, eq(mortalityRecords.henId, hens.id))
    .leftJoin(roosters, eq(mortalityRecords.roosterId, roosters.id))
    .leftJoin(broilerBatches, eq(mortalityRecords.batchId, broilerBatches.id))
    .leftJoin(farmLocations, eq(mortalityRecords.locationId, farmLocations.id))
    .orderBy(desc(mortalityRecords.createdAt));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const [periodRecords] = await db
    .select({ total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int` })
    .from(mortalityRecords)
    .where(gte(mortalityRecords.date, cutoffStr));

  const animalInventory = await computeAnimalInventory();
  const totalFlock = animalInventory.summary.totalAnimals;
  const totalDeaths = periodRecords?.total || 0;
  const mortalityRate = totalFlock > 0 ? ((totalDeaths / totalFlock) * 100).toFixed(2) : "0";

  const byCause = await db
    .select({ cause: mortalityRecords.cause, total: sql<number>`sum(${mortalityRecords.quantity})::int` })
    .from(mortalityRecords)
    .where(gte(mortalityRecords.date, cutoffStr))
    .groupBy(mortalityRecords.cause);

  return NextResponse.json({ records, mortalityRate: Number(mortalityRate), totalDeaths, totalFlock, byCause, periodDays: period });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  // Idempotencia para registros offline: si ya existe el ID, retornar el registro existente
  if (body.id) {
    const [existing] = await db.select().from(mortalityRecords).where(eq(mortalityRecords.id, body.id));
    if (existing) {
      return NextResponse.json(existing);
    }
  }

  const { date, birdType, cause, henId, roosterId, batchId, quantity, description } = body;

  if (!isDateOnly(date) || !MORTALITY_TYPES.has(birdType) || !MORTALITY_CAUSES.has(cause)) {
    return NextResponse.json({ error: "Fecha, tipo de ave y causa son requeridos" }, { status: 400 });
  }
  if (typeof body.locationId !== "string" || !body.locationId) return NextResponse.json({ error: "Selecciona el lugar donde ocurrió la mortalidad" }, { status: 400 });
  const [mortalityLocation] = await db.select().from(farmLocations).where(eq(farmLocations.id, body.locationId));
  if (!mortalityLocation || mortalityLocation.status !== "activa") return NextResponse.json({ error: "El lugar debe estar activo" }, { status: 400 });

  if (birdType === "gallina" && (!henId || roosterId || batchId)) return NextResponse.json({ error: "Seleccione una sola gallina" }, { status: 400 });
  if (birdType === "gallo" && (!roosterId || henId || batchId)) return NextResponse.json({ error: "Seleccione un solo gallo" }, { status: 400 });
  if (isBatchMortalityType(birdType) && (!batchId || henId || roosterId)) return NextResponse.json({ error: "Seleccione un solo lote" }, { status: 400 });

  const qty = isBatchMortalityType(birdType) ? Number(quantity ?? 1) : 1;
  if (!Number.isSafeInteger(qty) || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  try {
    const result = await db.transaction(async (tx) => {
      if (birdType === "gallina" && henId) {
        const [hen] = await tx.select().from(hens).where(eq(hens.id, henId)).for("update");
        if (!hen) throw new Error("Gallina no encontrada");
        if (hen.locationId && hen.locationId !== body.locationId) throw new Error("El lugar debe coincidir con el alojamiento actual de la gallina");
        if (!HEN_PRESENT_STATUSES.includes(hen.status)) {
          throw new Error(`La gallina no está disponible (status: ${hen.status})`);
        }
      }

      if (birdType === "gallo" && roosterId) {
        const roosterError = await validateRoosterForExit(roosterId, tx);
        if (roosterError) throw new Error(roosterError);
        const [rooster] = await tx.select({ locationId: roosters.locationId }).from(roosters).where(eq(roosters.id, roosterId));
        if (rooster?.locationId && rooster.locationId !== body.locationId) throw new Error("El lugar debe coincidir con el alojamiento actual del gallo");
      }

      if (isBatchMortalityType(birdType) && batchId) {
        const [batch] = await tx.select({ species: broilerBatches.species, locationId: broilerBatches.locationId }).from(broilerBatches).where(eq(broilerBatches.id, batchId)).for("update");
        if (!batch) throw new Error("Lote no encontrado");
        if (batch.locationId && batch.locationId !== body.locationId) throw new Error("El lugar debe coincidir con el alojamiento actual del lote");
        if (batch.species !== BATCH_MORTALITY_SPECIES[birdType]) throw new Error("El lote seleccionado no corresponde al tipo de animal");
        const batchError = await validateBatchForExit(batchId, qty, tx);
        if (batchError) throw new Error(batchError);
      }

      const previousAnimalStates = await captureAnimalExitSnapshots(tx, { henId, roosterId, batchId });

      if (henId) await tx.update(hens).set({ status: "muerta", updatedAt: new Date() }).where(eq(hens.id, henId));
      if (roosterId) await tx.update(roosters).set({ status: "muerto", updatedAt: new Date() }).where(eq(roosters.id, roosterId));
      if (batchId) {
        const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, batchId)).for("update");
        if (!batch) throw new Error("Lote no encontrado");
        const newQty = batch.currentQuantity - qty;
        await tx.update(broilerBatches).set({
          currentQuantity: newQty,
          status: newQty === 0 ? "faena" : batch.status,
          updatedAt: new Date(),
        }).where(eq(broilerBatches.id, batchId));
      }

      const [created] = await tx.insert(mortalityRecords).values({
        id: body.id || undefined,
        date,
        species: birdType === "gallina" || birdType === "gallo" ? "gallina" : BATCH_MORTALITY_SPECIES[birdType],
        birdType,
        quantity: qty,
        cause,
        henId: henId || null,
        roosterId: roosterId || null,
        batchId: batchId || null,
        locationId: body.locationId,
        description: description || null,
        previousAnimalStates,
      }).returning();

      return created;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    const msg = err.message || "Error al registrar mortalidad";
    if (msg.includes("no encontrad")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [record] = await db.select().from(mortalityRecords).where(eq(mortalityRecords.id, id));
  if (!record) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (record.healthControlId) {
    return NextResponse.json({ error: "Este registro pertenece a un control sanitario. Elimínalo desde Sanidad." }, { status: 409 });
  }

  const result = await db.transaction(async (tx) => {
    await lockMortalityTarget(tx, record);
    const [currentRecord] = await tx.select().from(mortalityRecords).where(eq(mortalityRecords.id, id)).for("update");
    if (!currentRecord) return "missing" as const;
    if (currentRecord.healthControlId) return "linked" as const;
    if (!sameMortalityTarget(currentRecord, record)) throw new Error("El registro cambió mientras se eliminaba; recarga e inténtalo de nuevo");
    if (currentRecord.henId) {
      await tx.select({ id: hens.id }).from(hens).where(eq(hens.id, currentRecord.henId)).for("update");
      // Only restore hen if no other exit records exist
      const [hasSlaughter] = await tx.select({ id: slaughter.id })
        .from(slaughter).where(eq(slaughter.henId, currentRecord.henId)).limit(1);
      const [hasSale] = await tx.select({ id: chickenSales.id })
        .from(chickenSales).where(eq(chickenSales.henId, currentRecord.henId)).limit(1);
      const [otherMortality] = await tx.select({ id: mortalityRecords.id })
        .from(mortalityRecords)
        .where(and(eq(mortalityRecords.henId, currentRecord.henId), sql`${mortalityRecords.id} != ${currentRecord.id}`))
        .limit(1);
      if (!hasSlaughter && !hasSale && !otherMortality) {
        const previousStatus = currentRecord.previousAnimalStates?.[`hen:${currentRecord.henId}`]?.status || "activa";
        await restoreHenExit(currentRecord.henId, previousStatus, tx);
      }
    }
    if (currentRecord.roosterId) {
      await tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.id, currentRecord.roosterId)).for("update");
      const [hasSlaughter] = await tx.select({ id: slaughter.id })
        .from(slaughter).where(eq(slaughter.roosterId, currentRecord.roosterId)).limit(1);
      const [hasSale] = await tx.select({ id: chickenSales.id })
        .from(chickenSales).where(eq(chickenSales.roosterId, currentRecord.roosterId)).limit(1);
      const [otherMortality] = await tx.select({ id: mortalityRecords.id })
        .from(mortalityRecords)
        .where(and(eq(mortalityRecords.roosterId, currentRecord.roosterId), sql`${mortalityRecords.id} != ${currentRecord.id}`))
        .limit(1);
      if (!hasSlaughter && !hasSale && !otherMortality) {
        const previousStatus = currentRecord.previousAnimalStates?.[`rooster:${currentRecord.roosterId}`]?.status || "activo";
        await restoreRoosterExit(currentRecord.roosterId, tx, previousStatus);
      }
    }
    if (currentRecord.batchId) {
      await restoreBatchExit(
        currentRecord.batchId,
        currentRecord.quantity,
        tx,
        currentRecord.previousAnimalStates?.[`batch:${currentRecord.batchId}`],
      );
    }
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.id, currentRecord.id));
    return "deleted" as const;
  });

  if (result === "missing") return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (result === "linked") {
    return NextResponse.json({ error: "Este registro pertenece a un control sanitario. Edítalo o elimínalo desde Sanidad." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const { date, birdType, cause, description } = body;
  if (!isDateOnly(date) || !MORTALITY_TYPES.has(birdType) || !MORTALITY_CAUSES.has(cause)) {
    return NextResponse.json({ error: "Fecha, tipo de ave y causa son requeridos" }, { status: 400 });
  }
  if (typeof body.locationId !== "string" || !body.locationId) return NextResponse.json({ error: "Selecciona el lugar donde ocurrió la mortalidad" }, { status: 400 });
  const [requestedLocation] = await db.select({ id: farmLocations.id }).from(farmLocations).where(eq(farmLocations.id, body.locationId));
  if (!requestedLocation) return NextResponse.json({ error: "El lugar seleccionado no existe" }, { status: 400 });

  const [existing] = await db.select().from(mortalityRecords).where(eq(mortalityRecords.id, body.id));
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (existing.healthControlId) {
    return NextResponse.json({ error: "Este registro pertenece a un control sanitario. Edítalo desde Sanidad." }, { status: 409 });
  }

  const henId = birdType === "gallina"
    ? (body.henId || (existing.birdType === birdType ? existing.henId : null))
    : null;
  const roosterId = birdType === "gallo"
    ? (body.roosterId || (existing.birdType === birdType ? existing.roosterId : null))
    : null;
  const batchId = isBatchMortalityType(birdType)
    ? (body.batchId || (existing.birdType === birdType ? existing.batchId : null))
    : null;
  const quantity = isBatchMortalityType(birdType)
    ? Number(body.quantity ?? existing.quantity)
    : 1;

  if (birdType === "gallina" && !henId) return NextResponse.json({ error: "Seleccione una gallina" }, { status: 400 });
  if (birdType === "gallo" && !roosterId) return NextResponse.json({ error: "Seleccione un gallo" }, { status: 400 });
  if (isBatchMortalityType(birdType) && !batchId) return NextResponse.json({ error: "Seleccione un lote" }, { status: 400 });
  if (!Number.isSafeInteger(quantity) || quantity < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  try {
    const result = await db.transaction(async (tx) => {
      await lockMortalityTarget(tx, existing);
      const [currentRecord] = await tx.select().from(mortalityRecords).where(eq(mortalityRecords.id, body.id)).for("update");
      if (!currentRecord) throw new Error("No encontrado");
      if (currentRecord.healthControlId) return "linked" as const;
      if (!sameMortalityTarget(currentRecord, existing)) {
        throw new Error("El registro cambió mientras se editaba; recarga e inténtalo de nuevo");
      }
      // Reverse the old mortality effect before validating/applying the edited target.
      if (currentRecord.henId) {
        await tx.select({ id: hens.id }).from(hens).where(eq(hens.id, currentRecord.henId)).for("update");
        const [hasSlaughter] = await tx.select({ id: slaughter.id })
          .from(slaughter).where(eq(slaughter.henId, currentRecord.henId)).limit(1);
        const [hasSale] = await tx.select({ id: chickenSales.id })
          .from(chickenSales).where(eq(chickenSales.henId, currentRecord.henId)).limit(1);
        const [otherMortality] = await tx.select({ id: mortalityRecords.id })
          .from(mortalityRecords)
          .where(and(eq(mortalityRecords.henId, currentRecord.henId), sql`${mortalityRecords.id} != ${body.id}`))
          .limit(1);
        if (!hasSlaughter && !hasSale && !otherMortality) {
          const previousStatus = currentRecord.previousAnimalStates?.[`hen:${currentRecord.henId}`]?.status || "activa";
          await restoreHenExit(currentRecord.henId, previousStatus, tx);
        }
      }
      if (currentRecord.roosterId) {
        await tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.id, currentRecord.roosterId)).for("update");
        const [hasSlaughter] = await tx.select({ id: slaughter.id })
          .from(slaughter).where(eq(slaughter.roosterId, currentRecord.roosterId)).limit(1);
        const [hasSale] = await tx.select({ id: chickenSales.id })
          .from(chickenSales).where(eq(chickenSales.roosterId, currentRecord.roosterId)).limit(1);
        const [otherMortality] = await tx.select({ id: mortalityRecords.id })
          .from(mortalityRecords)
          .where(and(eq(mortalityRecords.roosterId, currentRecord.roosterId), sql`${mortalityRecords.id} != ${body.id}`))
          .limit(1);
        if (!hasSlaughter && !hasSale && !otherMortality) {
          const previousStatus = currentRecord.previousAnimalStates?.[`rooster:${currentRecord.roosterId}`]?.status || "activo";
          await restoreRoosterExit(currentRecord.roosterId, tx, previousStatus);
        }
      }
      if (currentRecord.batchId) {
        await restoreBatchExit(
          currentRecord.batchId,
          currentRecord.quantity,
          tx,
          currentRecord.previousAnimalStates?.[`batch:${currentRecord.batchId}`],
        );
      }

      const previousAnimalStates = await captureAnimalExitSnapshots(tx, { henId, roosterId, batchId });

      if (henId) {
        const [hen] = await tx.select().from(hens).where(eq(hens.id, henId)).for("update");
        if (!hen) throw new Error("Gallina no encontrada");
        if (!HEN_PRESENT_STATUSES.includes(hen.status)) {
          throw new Error(`La gallina no está disponible (status: ${hen.status})`);
        }
        await tx.update(hens).set({ status: "muerta", updatedAt: new Date() }).where(eq(hens.id, henId));
      }
      if (roosterId) {
        const roosterError = await validateRoosterForExit(roosterId, tx);
        if (roosterError) throw new Error(roosterError);
        await tx.update(roosters).set({ status: "muerto", updatedAt: new Date() }).where(eq(roosters.id, roosterId));
      }
      if (batchId) {
        const [batchSpecies] = await tx.select({ species: broilerBatches.species }).from(broilerBatches).where(eq(broilerBatches.id, batchId)).for("update");
        if (!batchSpecies) throw new Error("Lote no encontrado");
        if (batchSpecies.species !== BATCH_MORTALITY_SPECIES[birdType]) throw new Error("El lote seleccionado no corresponde al tipo de animal");
        const batchError = await validateBatchForExit(batchId, quantity, tx);
        if (batchError) throw new Error(batchError);
        const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, batchId));
        if (batch) {
          const newQty = batch.currentQuantity - quantity;
          await tx.update(broilerBatches).set({
            currentQuantity: newQty,
            status: newQty === 0 ? "faena" : batch.status,
            updatedAt: new Date(),
          }).where(eq(broilerBatches.id, batchId));
        }
      }

      await tx.update(mortalityRecords).set({
        date,
        locationId: body.locationId,
        species: birdType === "gallina" || birdType === "gallo" ? "gallina" : BATCH_MORTALITY_SPECIES[birdType],
        birdType,
        quantity,
        cause,
        henId,
        roosterId,
        batchId,
        description: description || null,
        previousAnimalStates,
      }).where(eq(mortalityRecords.id, body.id));
      return "updated" as const;
    });
    if (result === "linked") {
      return NextResponse.json({ error: "Este registro pertenece a un control sanitario. Edítalo desde Sanidad." }, { status: 409 });
    }
  } catch (err: any) {
    if (err.message === "No encontrado") return NextResponse.json({ error: err.message }, { status: 404 });
    if (err.message?.includes("El registro cambió mientras se")) return NextResponse.json({ error: err.message }, { status: 409 });
    return NextResponse.json({ error: err.message || "Error al actualizar" }, { status: 400 });
  }

  const [updated] = await db.select().from(mortalityRecords).where(eq(mortalityRecords.id, body.id));
  return NextResponse.json(updated);
});
