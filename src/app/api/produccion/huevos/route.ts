import { db } from "@/db";
import { eggProduction, eggProductionDetails, catalogos, hens, autoconsumoLogs } from "@/db/schema";
import { eq, desc, inArray, and, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getEggValidationThreshold } from "@/lib/settings";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

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

const toDetails = (sizes: unknown): { size: string; quantity: number }[] =>
  (Array.isArray(sizes) ? sizes : [])
    .map((x: { size?: string; quantity?: number }) => ({
      size: String(x.size ?? ""),
      quantity: Number(x.quantity) || 0,
    }))
    .filter((x) => x.size.length > 0);

async function handleSave(req: NextRequest, isUpdate: boolean) {
  const body = await safeParseJson(req);
  const sizes = toDetails(body.sizes);
  const broken = Number(body.broken) || 0;
  const forIncubation = Number(body.forIncubation) || 0;
  const totalCollected = sizes.length > 0
    ? sizes.reduce((s, x) => s + x.quantity, 0) + broken + forIncubation
    : Number(body.totalCollected) || 0;

  const species = body.species || "gallina";
  const qtyAutoconsumo = Number(body.quantityAutoconsumo) || 0;
  const qtyExcedente = body.quantityExcedente !== undefined
    ? Number(body.quantityExcedente)
    : Math.max(0, totalCollected - broken - forIncubation - qtyAutoconsumo);
  const refPrice = body.referenceUnitPrice ? String(body.referenceUnitPrice) : null;

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

      // Sync autoconsumo log
      if (qtyAutoconsumo > 0 && refPrice) {
        const unitPriceNum = Number(refPrice) || 0;
        const savings = (qtyAutoconsumo * unitPriceNum).toFixed(2);
        const [existingLog] = await tx.select().from(autoconsumoLogs).where(
          and(
            eq(autoconsumoLogs.date, body.date),
            eq(autoconsumoLogs.species, species),
            eq(autoconsumoLogs.productType, "huevo")
          )
        );
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
            notes: `Cosecha de huevos (${species}) - autoconsumo`,
          });
        }
      }

      return row;
    });

    return NextResponse.json(updated);
  }

  const created = await db.transaction(async (tx) => {
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
    await tx.delete(eggProductionDetails).where(eq(eggProductionDetails.productionId, id));
    await tx.delete(eggProduction).where(eq(eggProduction.id, id));
  });
  return NextResponse.json({ ok: true });
});
