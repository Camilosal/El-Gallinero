import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { slaughter, hens, roosters, broilerBatches, chickenSales, mortalityRecords, autoconsumoLogs } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import {
  captureAnimalExitSnapshots,
  validateRoosterForExit, validateBatchForExit,
  applyRoosterExit, restoreHenExit, restoreRoosterExit, applyBatchExit, restoreBatchExit,
} from "@/lib/birdExit";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockMeatInventory } from "@/lib/inventory-locks";
import { computeMeatInventory, meatInventoryBookBalance } from "@/lib/inventory";

export const dynamic = "force-dynamic";


function normalizeExitReferences(body: Record<string, any>, quantity: number): string | null {
  for (const key of ["henId", "roosterId", "batchId"]) {
    const value = body[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string" || !value.trim()) return "Referencia de ave inválida";
    body[key] = value.trim();
  }
  const references = [body.henId, body.roosterId, body.batchId].filter(Boolean);
  if (references.length !== 1) return "Seleccione exactamente una gallina, un gallo o un lote";
  if ((body.henId || body.roosterId) && quantity !== 1) return "La faena de una gallina o un gallo debe tener cantidad 1";
  return null;
}

// GET /api/produccion/sacrificio — lista de registros de sacrificio (producción de carne)
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const speciesFilter = searchParams.get("species");

  let query = db.select().from(slaughter);
  const data = speciesFilter && speciesFilter !== "all"
    ? await query.where(eq(slaughter.species, speciesFilter as any)).orderBy(desc(slaughter.date)).limit(100)
    : await query.orderBy(desc(slaughter.date)).limit(100);

  const enriched = await Promise.all(
    data.map(async (record) => {
      const [hen] = record.henId
        ? await db.select().from(hens).where(eq(hens.id, record.henId))
        : [undefined];
      const [rooster] = record.roosterId
        ? await db.select().from(roosters).where(eq(roosters.id, record.roosterId))
        : [undefined];
      const [batch] = record.batchId
        ? await db.select().from(broilerBatches).where(eq(broilerBatches.id, record.batchId))
        : [undefined];
      return { ...record, hen: hen || null, rooster: rooster || null, batch: batch || null };
    })
  );

  return NextResponse.json(enriched);
});

// POST /api/produccion/sacrificio — registrar sacrificio (producción pura, siempre va a inventario)
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const qty = Number(body.quantity);
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (typeof body.birdType !== "string" || !body.birdType.trim()) return NextResponse.json({ error: "Tipo de ave/animal requerido" }, { status: 400 });
  if (!Number.isSafeInteger(qty) || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  const referenceError = normalizeExitReferences(body, qty);
  if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });

  const weightKg = Number(body.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) return NextResponse.json({ error: "Peso requerido" }, { status: 400 });

  if (body.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para sacrificio (estado: ${hen.status})` }, { status: 400 });
    }
  }

  if (body.roosterId) {
    const err = await validateRoosterForExit(body.roosterId);
    if (err) return NextResponse.json({ error: err }, { status: err === "Gallo no encontrado" ? 404 : 400 });
  }

  if (body.batchId) {
    const err = await validateBatchForExit(body.batchId, qty);
    if (err) return NextResponse.json({ error: err }, { status: err === "Lote no encontrado" ? 404 : 400 });
  }

  const destination = body.destination || "consumo_propio";
  const species = body.species || "pollo";
  const liveWeightKg = body.liveWeightKg ? String(body.liveWeightKg) : null;
  const carcassYieldPercent = body.carcassYieldPercent ? String(body.carcassYieldPercent) : null;

  // Manejo de la partición dual:
  let headsAutoconsumo = Number(body.headsAutoconsumo) || 0;
  let weightKgAutoconsumo = Number(body.weightKgAutoconsumo) || 0;
  let headsExcedente = Number(body.headsExcedente) || 0;
  let weightKgExcedente = Number(body.weightKgExcedente) || 0;

  if (destination === "consumo_propio" && headsAutoconsumo === 0 && weightKgAutoconsumo === 0) {
    headsAutoconsumo = qty;
    weightKgAutoconsumo = weightKg;
  } else if (destination === "venta" && headsExcedente === 0 && weightKgExcedente === 0) {
    headsExcedente = qty;
    weightKgExcedente = weightKg;
  }

  const refPricePerKg = body.marketReferencePricePerKg ? Number(body.marketReferencePricePerKg) : 0;
  const savingsAmount = refPricePerKg > 0 && weightKgAutoconsumo > 0
    ? (weightKgAutoconsumo * refPricePerKg).toFixed(2)
    : (body.estimatedSavingsAmount ? String(body.estimatedSavingsAmount) : null);

  const created = await db.transaction(async (tx) => {
    await lockMeatInventory(tx);
    if (body.henId) {
      const [hen] = await tx.select().from(hens).where(eq(hens.id, body.henId)).for("update");
      if (!hen) throw new Error("Gallina no encontrada");
      if (!isAvailableForExit(hen.status)) throw new Error(`La gallina no está disponible para sacrificio (estado: ${hen.status})`);
    }
    if (body.roosterId) {
      const error = await validateRoosterForExit(body.roosterId, tx);
      if (error) throw new Error(error);
    }
    if (body.batchId) {
      const error = await validateBatchForExit(body.batchId, qty, tx);
      if (error) throw new Error(error);
    }
    const previousAnimalStates = await captureAnimalExitSnapshots(tx, {
      henId: body.henId,
      roosterId: body.roosterId,
      batchId: body.batchId,
    });
    const [inserted] = await tx.insert(slaughter).values({
      date: body.date,
      species,
      birdType: body.birdType,
      quantity: qty,
      liveWeightKg,
      weightKg: String(weightKg),
      carcassYieldPercent,
      destination,
      headsAutoconsumo,
      weightKgAutoconsumo: String(weightKgAutoconsumo),
      headsExcedente,
      weightKgExcedente: String(weightKgExcedente),
      pricePerKg: body.pricePerKg ? String(body.pricePerKg) : null,
      totalAmount: body.totalAmount ? String(body.totalAmount) : null,
      marketReferencePricePerKg: refPricePerKg > 0 ? String(refPricePerKg) : null,
      estimatedSavingsAmount: savingsAmount,
      henId: body.henId || null,
      roosterId: body.roosterId || null,
      batchId: body.batchId || null,
      previousAnimalStates,
      notes: body.notes || null,
    }).returning();

    if (body.henId) {
      await tx.update(hens).set({ status: "faena" }).where(eq(hens.id, body.henId));
    }
    if (body.roosterId) {
      await applyRoosterExit(body.roosterId, "sacrificio", tx);
    }
    if (body.batchId) {
      await applyBatchExit(body.batchId, qty, "sacrificio", tx);
    }

    // Auto-registrar en Soberanía Alimentaria si hay carne para el hogar
    if (weightKgAutoconsumo > 0 && refPricePerKg > 0) {
      await tx.insert(autoconsumoLogs).values({
        date: body.date,
        species,
        productType: "carne_canal",
        quantity: String(weightKgAutoconsumo),
        unit: "kg",
        marketReferencePrice: String(refPricePerKg),
        savingsAmount: String(savingsAmount || "0"),
        destinationHousehold: "Familia Granja",
        batchId: body.batchId || null,
        slaughterId: inserted.id,
        notes: `Faena (${species}) - ${headsAutoconsumo} unidades para consumo familiar`,
      });
    }

    return inserted;
  });

  return NextResponse.json(created, { status: 201 });
});

// PUT /api/produccion/sacrificio — actualizar registro
export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const qty = Number(body.quantity);
  const weightKg = Number(body.weightKg);
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (typeof body.birdType !== "string" || !body.birdType.trim()) return NextResponse.json({ error: "Tipo de ave/animal requerido" }, { status: 400 });
  if (!Number.isSafeInteger(qty) || qty < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  if (!Number.isFinite(weightKg) || weightKg <= 0) return NextResponse.json({ error: "Peso requerido" }, { status: 400 });
  const referenceError = normalizeExitReferences(body, qty);
  if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });

  const [existing] = await db.select().from(slaughter).where(eq(slaughter.id, body.id));
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (body.henId && body.henId !== existing.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para sacrificio (estado: ${hen.status})` }, { status: 400 });
    }
  }

  const destination = body.destination || "consumo_propio";
  const species = body.species || existing.species || "pollo";
  const liveWeightKg = body.liveWeightKg ? String(body.liveWeightKg) : null;
  const carcassYieldPercent = body.carcassYieldPercent ? String(body.carcassYieldPercent) : null;

  let headsAutoconsumo = Number(body.headsAutoconsumo) || 0;
  let weightKgAutoconsumo = Number(body.weightKgAutoconsumo) || 0;
  let headsExcedente = Number(body.headsExcedente) || 0;
  let weightKgExcedente = Number(body.weightKgExcedente) || 0;

  if (destination === "consumo_propio" && headsAutoconsumo === 0 && weightKgAutoconsumo === 0) {
    headsAutoconsumo = qty;
    weightKgAutoconsumo = weightKg;
  } else if (destination === "venta" && headsExcedente === 0 && weightKgExcedente === 0) {
    headsExcedente = qty;
    weightKgExcedente = weightKg;
  }

  const refPricePerKg = body.marketReferencePricePerKg ? Number(body.marketReferencePricePerKg) : 0;
  const savingsAmount = refPricePerKg > 0 && weightKgAutoconsumo > 0
    ? (weightKgAutoconsumo * refPricePerKg).toFixed(2)
    : (body.estimatedSavingsAmount ? String(body.estimatedSavingsAmount) : null);

  let updated;
  try {
    updated = await db.transaction(async (tx) => {
      await lockMeatInventory(tx);
      const inventoryBefore = await computeMeatInventory(tx);
      const [currentRecord] = await tx.select().from(slaughter).where(eq(slaughter.id, body.id)).for("update");
      if (!currentRecord) throw new Error("No encontrado");
      const previousAnimalStates = { ...(currentRecord.previousAnimalStates || {}) };
      if (body.henId && body.henId !== currentRecord.henId) {
        const [hen] = await tx.select().from(hens).where(eq(hens.id, body.henId)).for("update");
        if (!hen) throw new Error("Gallina no encontrada");
        if (!isAvailableForExit(hen.status)) throw new Error(`La gallina no está disponible para sacrificio (estado: ${hen.status})`);
      }
      if (currentRecord.batchId) {
        await restoreBatchExit(
          currentRecord.batchId,
          currentRecord.quantity,
          tx,
          previousAnimalStates[`batch:${currentRecord.batchId}`],
        );
        if (currentRecord.batchId !== body.batchId) delete previousAnimalStates[`batch:${currentRecord.batchId}`];
      }
      if (currentRecord.henId && currentRecord.henId !== body.henId) {
        await tx.select({ id: hens.id }).from(hens).where(eq(hens.id, currentRecord.henId)).for("update");
        const [otherSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(and(
          eq(slaughter.henId, currentRecord.henId), sql`${slaughter.id} != ${currentRecord.id}`,
        )).limit(1);
        const [otherSale] = await tx.select({ id: chickenSales.id }).from(chickenSales).where(eq(chickenSales.henId, currentRecord.henId)).limit(1);
        const [otherMortality] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(eq(mortalityRecords.henId, currentRecord.henId)).limit(1);
        if (!otherSlaughter && !otherSale && !otherMortality) {
          const previousStatus = previousAnimalStates[`hen:${currentRecord.henId}`]?.status || "activa";
          await restoreHenExit(currentRecord.henId, previousStatus, tx);
        }
        delete previousAnimalStates[`hen:${currentRecord.henId}`];
      }
      if (currentRecord.roosterId && currentRecord.roosterId !== body.roosterId) {
        await tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.id, currentRecord.roosterId)).for("update");
        const [otherSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(and(
          eq(slaughter.roosterId, currentRecord.roosterId), sql`${slaughter.id} != ${currentRecord.id}`,
        )).limit(1);
        const [otherSale] = await tx.select({ id: chickenSales.id }).from(chickenSales).where(eq(chickenSales.roosterId, currentRecord.roosterId)).limit(1);
        const [otherMortality] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(eq(mortalityRecords.roosterId, currentRecord.roosterId)).limit(1);
        if (!otherSlaughter && !otherSale && !otherMortality) {
          const previousStatus = previousAnimalStates[`rooster:${currentRecord.roosterId}`]?.status || "activo";
          await restoreRoosterExit(currentRecord.roosterId, tx, previousStatus);
        }
        delete previousAnimalStates[`rooster:${currentRecord.roosterId}`];
      }
      if (body.roosterId && body.roosterId !== currentRecord.roosterId) {
        const err = await validateRoosterForExit(body.roosterId, tx);
        if (err) throw new Error(err);
      }
      if (body.batchId) {
        const err = await validateBatchForExit(body.batchId, qty, tx);
        if (err) throw new Error(err);
      }
      Object.assign(previousAnimalStates, await captureAnimalExitSnapshots(tx, {
        henId: body.henId && body.henId !== currentRecord.henId ? body.henId : null,
        roosterId: body.roosterId && body.roosterId !== currentRecord.roosterId ? body.roosterId : null,
        batchId: body.batchId || null,
      }));

      const [upd] = await tx.update(slaughter).set({
        date: body.date,
        species,
        birdType: body.birdType,
        quantity: qty,
        liveWeightKg,
        weightKg: String(weightKg),
        carcassYieldPercent,
        destination,
        headsAutoconsumo,
        weightKgAutoconsumo: String(weightKgAutoconsumo),
        headsExcedente,
        weightKgExcedente: String(weightKgExcedente),
        pricePerKg: body.pricePerKg ? String(body.pricePerKg) : null,
        totalAmount: body.totalAmount ? String(body.totalAmount) : null,
        marketReferencePricePerKg: refPricePerKg > 0 ? String(refPricePerKg) : null,
        estimatedSavingsAmount: savingsAmount,
        henId: body.henId || null,
        roosterId: body.roosterId || null,
        batchId: body.batchId || null,
        previousAnimalStates,
        notes: body.notes || null,
      }).where(eq(slaughter.id, body.id)).returning();
      if (!upd) throw new Error("No encontrado");

      if (body.henId && body.henId !== currentRecord.henId) {
        await tx.update(hens).set({ status: "faena" }).where(eq(hens.id, body.henId));
      }

      if (body.roosterId && body.roosterId !== currentRecord.roosterId) {
        await applyRoosterExit(body.roosterId, "sacrificio", tx);
      }
      if (body.batchId) {
        await applyBatchExit(body.batchId, qty, "sacrificio", tx);
      }

      // Sync autoconsumo log
      await tx.delete(autoconsumoLogs).where(eq(autoconsumoLogs.slaughterId, body.id));
      if (weightKgAutoconsumo > 0 && refPricePerKg > 0) {
        await tx.insert(autoconsumoLogs).values({
          date: body.date,
          species,
          productType: "carne_canal",
          quantity: String(weightKgAutoconsumo),
          unit: "kg",
          marketReferencePrice: String(refPricePerKg),
          savingsAmount: String(savingsAmount || "0"),
          destinationHousehold: "Familia Granja",
          batchId: body.batchId || null,
          slaughterId: upd.id,
          notes: `Faena (${species}) - ${headsAutoconsumo} unidades para consumo familiar`,
        });
      }

      const inventoryAfter = await computeMeatInventory(tx);
      if (meatInventoryBookBalance(inventoryAfter) < Math.min(0, meatInventoryBookBalance(inventoryBefore)) - 0.01) {
        throw new Error("No se puede reducir la faena por debajo de la carne ya vendida o perdida");
      }

      return upd;
    });
  } catch (e: any) {
    const msg = e.message || "";
    if (msg === "Gallo no encontrado") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "Lote no encontrado" || msg.startsWith("Stock insuficiente")) return NextResponse.json({ error: msg }, { status: 400 });
    throw e;
  }

  return NextResponse.json(updated);
});

// DELETE /api/produccion/sacrificio — eliminar registro
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [record] = await db.select().from(slaughter).where(eq(slaughter.id, id));
  if (!record) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.transaction(async (tx) => {
    await lockMeatInventory(tx);
    const [record] = await tx.select().from(slaughter).where(eq(slaughter.id, id)).for("update");
    if (!record) throw new Error("No encontrado");
    const inventoryBefore = await computeMeatInventory(tx);
    // Delete linked autoconsumo log first
    await tx.delete(autoconsumoLogs).where(eq(autoconsumoLogs.slaughterId, id));

    if (record.henId) {
      await tx.select({ id: hens.id }).from(hens).where(eq(hens.id, record.henId)).for("update");
      // Check no subsequent exit before restoring
      const [otherSlaughter] = await tx.select({ id: slaughter.id })
        .from(slaughter)
        .where(and(eq(slaughter.henId, record.henId), sql`${slaughter.id} != ${record.id}`))
        .limit(1);
      const [otherSale] = await tx.select({ id: chickenSales.id })
        .from(chickenSales)
        .where(eq(chickenSales.henId, record.henId))
        .limit(1);
      const [hasMortality] = await tx.select({ id: mortalityRecords.id })
        .from(mortalityRecords)
        .where(eq(mortalityRecords.henId, record.henId))
        .limit(1);
      if (!otherSlaughter && !otherSale && !hasMortality) {
        const previousStatus = record.previousAnimalStates?.[`hen:${record.henId}`]?.status || "activa";
        await restoreHenExit(record.henId, previousStatus, tx);
      }
    }
    if (record.roosterId) {
      await tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.id, record.roosterId)).for("update");
      const [otherSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(and(
        eq(slaughter.roosterId, record.roosterId), sql`${slaughter.id} != ${record.id}`,
      )).limit(1);
      const [otherSale] = await tx.select({ id: chickenSales.id }).from(chickenSales).where(eq(chickenSales.roosterId, record.roosterId)).limit(1);
      const [hasMortality] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(eq(mortalityRecords.roosterId, record.roosterId)).limit(1);
      if (!otherSlaughter && !otherSale && !hasMortality) {
        const previousStatus = record.previousAnimalStates?.[`rooster:${record.roosterId}`]?.status || "activo";
        await restoreRoosterExit(record.roosterId, tx, previousStatus);
      }
    }
    if (record.batchId) {
      await restoreBatchExit(
        record.batchId,
        record.quantity,
        tx,
        record.previousAnimalStates?.[`batch:${record.batchId}`],
      );
    }

    await tx.delete(slaughter).where(eq(slaughter.id, id));
    const inventoryAfter = await computeMeatInventory(tx);
    if (meatInventoryBookBalance(inventoryAfter) < Math.min(0, meatInventoryBookBalance(inventoryBefore)) - 0.01) {
      throw new Error("No se puede eliminar la faena porque tiene carne ya vendida o perdida");
    }
  });

  return NextResponse.json({ ok: true });
});
