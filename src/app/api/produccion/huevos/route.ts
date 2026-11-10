import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { eggProduction, eggProductionDetails, catalogos, hens, autoconsumoLogs } from "@/db/schema";
import { eq, desc, inArray, and, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getEggValidationThreshold } from "@/lib/settings";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockEggInventory } from "@/lib/inventory-locks";
import { computeEggInventory, eggInventoryBookBalance } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/**
 * Calculate expected daily egg production based on active hens and their growth stages.
 * Returns the total expected eggs per day.
 */
async function getExpectedDailyProduction(): Promise<number> {
  const today = new Date();

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
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - minWeeks * 7);

    let countResult;
    if (maxWeeks === null) {
      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            or(eq(hens.status, "activa"), eq(hens.status, "empollando"))
          )
        );
    } else {
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() - maxWeeks * 7);
      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            sql`${hens.birthDate}::date > ${maxDate.toISOString().split("T")[0]}::date`,
            or(eq(hens.status, "activa"), eq(hens.status, "empollando"))
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
  return NextResponse.json(records.map((r) => ({ ...r, details: byProd.get(r.id) || [] })));
});


async function handleSave(req: NextRequest, isUpdate: boolean) {
  const body = await safeParseJson(req);
  if (isUpdate && !body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const species = body.species || "gallina";
  if (!["gallina", "codorniz", "pato"].includes(species)) {
    return NextResponse.json({ error: "Especie de postura no válida" }, { status: 400 });
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

  // Validate against expected production only for chicken eggs (unless override is set)
  if (species === "gallina" && totalCollected > 0 && !body.overrideValidation) {
    const expected = await getExpectedDailyProduction();
    if (expected > 0) {
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
