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
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockEggInventory } from "@/lib/inventory-locks";
import { computeEggInventory, eggInventoryBookBalance } from "@/lib/inventory";
import { runFeedProgramCatchup } from "@/lib/feeding/runProgram";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";
import { isPurchasedFeedCategory } from "@/lib/feed-classification";

export const dynamic = "force-dynamic";

interface MutationItem {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  entity: "huevos" | "mortalidad" | "alimentacion" | "pesaje" | "general";
  payload: Record<string, any>;
  clientTimestamp: string;
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || !Array.isArray(body.mutations)) {
    return NextResponse.json({ error: "Lista de mutaciones inválida" }, { status: 400 });
  }

  const mutations: MutationItem[] = body.mutations;
  const results: Array<{ id: string; status: "synced" | "error"; error?: string }> = [];

  for (const item of mutations) {
    try {
      if (!item.id || !item.entity) {
        results.push({ id: item.id || "unknown", status: "error", error: "Datos de mutación incompletos" });
        continue;
      }

      if (item.entity === "huevos") {
        await processHuevosMutation(item);
        results.push({ id: item.id, status: "synced" });
      } else if (item.entity === "mortalidad") {
        await processMortalidadMutation(item);
        results.push({ id: item.id, status: "synced" });
      } else if (item.entity === "alimentacion") {
        await processAlimentacionMutation(item);
        results.push({ id: item.id, status: "synced" });
      } else {
        // Fallback genérico para otras entidades
        results.push({ id: item.id, status: "error", error: `Entidad no soportada para batch: ${item.entity}` });
      }
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
      });
    }
  });
}
