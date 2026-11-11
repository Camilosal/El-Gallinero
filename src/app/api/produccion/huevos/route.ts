import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { eggProduction, eggProductionDetails, catalogos, hens, autoconsumoLogs, broilerBatches, farmLocations } from "@/db/schema";
import { eq, desc, inArray, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getEggValidationThreshold } from "@/lib/settings";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockEggInventory } from "@/lib/inventory-locks";
import { computeEggInventory, eggInventoryBookBalance } from "@/lib/inventory";
import { loadSpeciesParams } from "@/lib/species-db";

export const dynamic = "force-dynamic";

/**
 * Calculate expected daily egg production based on active hens and their growth stages.
 * Returns the total expected eggs per day.
 */
async function getExpectedDailyProduction(referenceDate: string, locationId?: string | null): Promise<number> {
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
            eq(hens.status, "activa")
            , ...(locationId ? [eq(hens.locationId, locationId)] : [])
          )
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
            eq(hens.status, "activa")
            , ...(locationId ? [eq(hens.locationId, locationId)] : [])
          )
        );
    }

    const henCount = countResult?.[0]?.count ?? 0;
    totalExpected += eggsPerHen * henCount;
  }

  return Math.round(totalExpected * 10) / 10;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const speciesFilter = searchParams.get("species");

  let query = db.select().from(eggProduction);
  const records = speciesFilter && speciesFilter !== "all"
    ? await query.where(eq(eggProduction.species, speciesFilter as any)).orderBy(desc(eggProduction.date)).limit(100)
    : await query.orderBy(desc(eggProduction.date)).limit(100);

  const ids = records.map((r) => r.id);
  const details = ids.length
    ? await db.select().from(eggProductionDetails).where(inArray(eggProductionDetails.productionId, ids))
    : [];
  const byProd = new Map<string, { size: string; quantity: number }[]>();
  for (const d of details) {
    const arr = byProd.get(d.productionId) || [];
    arr.push({ size: d.size, quantity: d.quantity });
    byProd.set(d.productionId, arr);
  }
  const locations = await db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations);
  const locationNames = new Map(locations.map((item) => [item.id, item.name]));
  return NextResponse.json(records.map((r) => ({ ...r, locationName: r.locationId ? locationNames.get(r.locationId) || null : null, details: byProd.get(r.id) || [] })));
});


async function handleSave(req: NextRequest, isUpdate: boolean) {
  const body = await safeParseJson(req);
  if (isUpdate && !body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const species = body.species || "gallina";
  if (!["gallina", "codorniz", "pato"].includes(species)) {
    return NextResponse.json({ error: "Especie de postura no válida" }, { status: 400 });
  }
  if (typeof body.locationId !== "string" || !body.locationId) {
    return NextResponse.json({ error: "Selecciona el lugar donde se recogieron los huevos" }, { status: 400 });
  }
  const [eggLocation] = await db.select().from(farmLocations).where(eq(farmLocations.id, body.locationId));
  if (!eggLocation || eggLocation.status !== "activa" || ["fuera_servicio", "restringida"].includes(eggLocation.operationalStatus)) {
    return NextResponse.json({ error: "El lugar de recolección debe estar activo y disponible" }, { status: 400 });
  }
  if (species !== "gallina") {
    if (typeof body.batchId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.batchId)) {
      return NextResponse.json({ error: "Asigna la recolección a un lote de procedencia" }, { status: 400 });
    }
    const [batch] = await db.select({ species: broilerBatches.species, purpose: broilerBatches.purpose, status: broilerBatches.status, currentQuantity: broilerBatches.currentQuantity, startDate: broilerBatches.startDate, breed: broilerBatches.breed, locationId: broilerBatches.locationId })
      .from(broilerBatches)
      .where(eq(broilerBatches.id, body.batchId))
      .limit(1);
    if (!batch || batch.species !== species || batch.purpose !== "postura_huevo" || batch.currentQuantity <= 0 || !["activo", "listo_sacrificio"].includes(batch.status)) {
      return NextResponse.json({ error: "El lote debe ser de la misma especie, seguir activo y tener destino de postura" }, { status: 400 });
    }
    if (batch.locationId && batch.locationId !== body.locationId) return NextResponse.json({ error: "El lugar debe coincidir con el alojamiento actual del lote" }, { status: 400 });
    const speciesParams = await loadSpeciesParams(species);
    const breedText = String(batch.breed || "").toLowerCase();
    const maturity = speciesParams.find((param) => breedText && param.breed.toLowerCase().includes(breedText))
      || speciesParams[0];
    const start = new Date(`${batch.startDate}T12:00:00`);
    const collected = new Date(`${body.date}T12:00:00`);
    const ageDays = Math.floor((collected.getTime() - start.getTime()) / 86400000);
    if (maturity && ageDays < maturity.cycleWeeks * 7) {
      return NextResponse.json({ error: `Este lote aún no llega a la edad de postura (${maturity.cycleWeeks} semanas)` }, { status: 400 });
    }
  }

  const broken = Number(body.broken ?? 0);
  const forIncubation = Number(body.forIncubation ?? 0);
  if (!Number.isSafeInteger(broken) || broken < 0 || !Number.isSafeInteger(forIncubation) || forIncubation < 0) {
    return NextResponse.json({ error: "Rotos e incubación deben ser cantidades enteras no negativas" }, { status: 400 });
  }

  if (body.sizes !== undefined && !Array.isArray(body.sizes)) {
    return NextResponse.json({ error: "El detalle por tamaño debe ser una lista" }, { status: 400 });
  }
  const rawSizes = Array.isArray(body.sizes) ? body.sizes : [];
  const sizes: { size: string; quantity: number }[] = [];
  const seenSizes = new Set<string>();
  for (const row of rawSizes) {
    const size = typeof row?.size === "string" ? row.size.trim() : "";
    const quantity = Number(row?.quantity);
    if (!size || !Number.isSafeInteger(quantity) || quantity < 0) {
      return NextResponse.json({ error: "Cada tamaño debe tener una cantidad entera no negativa" }, { status: 400 });
    }
    if (seenSizes.has(size)) return NextResponse.json({ error: `El tamaño ${size} está repetido` }, { status: 400 });
    seenSizes.add(size);
    if (quantity > 0) sizes.push({ size, quantity });
  }

  const totalCollected = sizes.length > 0
    ? sizes.reduce((s, x) => s + x.quantity, 0) + broken + forIncubation
    : Number(body.totalCollected);
  if (!Number.isSafeInteger(totalCollected) || totalCollected < 0) {
    return NextResponse.json({ error: "Total recolectado inválido" }, { status: 400 });
  }

  const goodTotal = sizes.reduce((sum, row) => sum + row.quantity, 0);
  if (goodTotal === 0 && totalCollected > broken + forIncubation) {
    return NextResponse.json({ error: "Clasifica por tamaño los huevos buenos antes de guardar" }, { status: 400 });
  }

  const qtyAutoconsumo = Number(body.quantityAutoconsumo ?? 0);
  const qtyExcedente = body.quantityExcedente !== undefined
    ? Number(body.quantityExcedente)
    : Math.max(0, goodTotal - qtyAutoconsumo);
  if (!Number.isSafeInteger(qtyAutoconsumo) || qtyAutoconsumo < 0 || !Number.isSafeInteger(qtyExcedente) || qtyExcedente < 0) {
    return NextResponse.json({ error: "La asignación al hogar y a la venta debe usar cantidades enteras no negativas" }, { status: 400 });
  }
  if (qtyAutoconsumo + qtyExcedente > goodTotal) {
    return NextResponse.json({ error: "La asignación al hogar y a la venta supera los huevos buenos disponibles" }, { status: 400 });
  }
  const refPrice = body.referenceUnitPrice ? String(body.referenceUnitPrice) : null;
  if (refPrice !== null && (!Number.isFinite(Number(refPrice)) || Number(refPrice) < 0)) {
    return NextResponse.json({ error: "Precio de referencia inválido" }, { status: 400 });
  }

  // Las gallinas fuera de las etapas productivas no pueden recibir registro de postura.
  if (species === "gallina" && totalCollected > 0) {
    const expected = await getExpectedDailyProduction(body.date, body.locationId);
    if (expected <= 0) {
      return NextResponse.json({ error: "Solo se pueden registrar huevos cuando hay gallinas activas en etapa productiva" }, { status: 400 });
    }
    if (!body.overrideValidation) {
      const threshold = await getEggValidationThreshold();
      const limit = Math.ceil(expected * threshold);
      if (totalCollected > limit) {
        return NextResponse.json(
          {
            warning: true,
            expected,
            actual: totalCollected,
            limit,
            error: `La producción registrada (${totalCollected}) supera el ${Math.round(threshold * 100)}% de la producción esperada (${expected} huevos/día). Límite: ${limit}. Si es correcto, confirme para guardar.`,
          },
          { status: 409 }
        );
      }
    }
  }

  if (isUpdate) {
    const updated = await db.transaction(async (tx) => {
      await lockEggInventory(tx);
      const inventoryBefore = await computeEggInventory(tx);
      const [row] = await tx.update(eggProduction).set({
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
      }).where(eq(eggProduction.id, body.id)).returning();

      if (!row) throw new Error("No encontrado");

      await tx.delete(eggProductionDetails).where(eq(eggProductionDetails.productionId, body.id));
      if (sizes.length) {
        await tx.insert(eggProductionDetails).values(
          sizes.map((x) => ({ productionId: row.id, size: x.size, quantity: x.quantity }))
        );
      }

      // Sync only this production's autoconsumption log. Date/species matching
      // could overwrite a different same-day record and leave stale entries.
      const [existingLog] = await tx.select().from(autoconsumoLogs).where(
        eq(autoconsumoLogs.eggProductionId, row.id)
      );
      if (qtyAutoconsumo > 0 && refPrice) {
        const unitPriceNum = Number(refPrice) || 0;
        const savings = (qtyAutoconsumo * unitPriceNum).toFixed(2);
        if (existingLog) {
          await tx.update(autoconsumoLogs).set({
            quantity: String(qtyAutoconsumo),
            marketReferencePrice: refPrice,
            savingsAmount: savings,
            batchId: body.batchId || null,
            notes: `Cosecha de huevos (${species}) - autoconsumo`,
          }).where(eq(autoconsumoLogs.id, existingLog.id));
        } else {
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
            notes: `Cosecha de huevos (${species}) - autoconsumo`,
          });
        }
      } else if (existingLog) {
        await tx.delete(autoconsumoLogs).where(eq(autoconsumoLogs.id, existingLog.id));
      }

      const inventoryAfter = await computeEggInventory(tx);
      if (eggInventoryBookBalance(inventoryAfter) < Math.min(0, eggInventoryBookBalance(inventoryBefore)) - 0.0001) {
        throw new Error("No se puede reducir la producción por debajo de los huevos ya vendidos o perdidos");
      }

      return row;
    });

    return NextResponse.json(updated);
  }

  const created = await db.transaction(async (tx) => {
    await lockEggInventory(tx);
    const [row] = await tx.insert(eggProduction).values({
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
    }).returning();

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
        notes: `Cosecha de huevos (${species}) - autoconsumo`,
      });
    }

    return row;
  });

  return NextResponse.json(created, { status: 201 });
}

export const POST = withApiHandler(async (req: NextRequest) => {
  return handleSave(req, false);
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  return handleSave(req, true);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    await lockEggInventory(tx);
    const inventoryBefore = await computeEggInventory(tx);
    const [production] = await tx.select({ id: eggProduction.id }).from(eggProduction).where(eq(eggProduction.id, id));
    if (!production) throw new Error("No encontrado");
    await tx.delete(autoconsumoLogs).where(eq(autoconsumoLogs.eggProductionId, id));
    await tx.delete(eggProductionDetails).where(eq(eggProductionDetails.productionId, id));
    await tx.delete(eggProduction).where(eq(eggProduction.id, id));
    const inventoryAfter = await computeEggInventory(tx);
    if (eggInventoryBookBalance(inventoryAfter) < Math.min(0, eggInventoryBookBalance(inventoryBefore)) - 0.0001) {
      throw new Error("No se puede eliminar una producción con huevos ya vendidos o perdidos");
    }
  });
  return NextResponse.json({ ok: true });
});
