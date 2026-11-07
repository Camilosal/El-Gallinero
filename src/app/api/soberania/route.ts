import { db } from "@/db";
import { autoconsumoLogs, broilerBatches } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const speciesFilter = searchParams.get("species");
  const monthFilter = searchParams.get("month"); // YYYY-MM

  let baseQuery = db.select().from(autoconsumoLogs);
  const conditions = [];

  if (speciesFilter && speciesFilter !== "all") {
    conditions.push(eq(autoconsumoLogs.species, speciesFilter as any));
  }
  if (monthFilter) {
    conditions.push(sql`to_char(${autoconsumoLogs.date}, 'YYYY-MM') = ${monthFilter}`);
  }

  const logs = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).orderBy(desc(autoconsumoLogs.date))
    : await baseQuery.orderBy(desc(autoconsumoLogs.date));

  // ─── Enriquecer logs con código de lote si existe ───
  const batchIds = [...new Set(logs.map((l) => l.batchId).filter(Boolean))] as string[];
  const batches = batchIds.length
    ? await db.select({ id: broilerBatches.id, code: broilerBatches.code, breed: broilerBatches.breed })
        .from(broilerBatches)
    : [];
  const batchMap = new Map(batches.map((b) => [b.id, b]));

  const enrichedLogs = logs.map((l) => ({
    ...l,
    batch: l.batchId ? batchMap.get(l.batchId) || null : null,
  }));

  // ─── Métricas Generales ───
  let totalSavings = 0;
  let totalMeatKg = 0;
  let totalEggs = 0;

  const speciesSummary: Record<string, { meatKg: number; eggs: number; savings: number }> = {
    gallina: { meatKg: 0, eggs: 0, savings: 0 },
    pollo: { meatKg: 0, eggs: 0, savings: 0 },
    codorniz: { meatKg: 0, eggs: 0, savings: 0 },
    pato: { meatKg: 0, eggs: 0, savings: 0 },
    conejo: { meatKg: 0, eggs: 0, savings: 0 },
  };

  const monthlySummary: Record<string, { month: string; savings: number; meatKg: number; eggs: number }> = {};

  for (const log of logs) {
    const savings = Number(log.savingsAmount || 0);
    const qty = Number(log.quantity || 0);
    totalSavings += savings;

    const sp = log.species || "pollo";
    if (!speciesSummary[sp]) {
      speciesSummary[sp] = { meatKg: 0, eggs: 0, savings: 0 };
    }
    speciesSummary[sp].savings += savings;

    if (log.productType === "carne_canal") {
      totalMeatKg += qty;
      speciesSummary[sp].meatKg += qty;
    } else if (log.productType === "huevo") {
      totalEggs += qty;
      speciesSummary[sp].eggs += qty;
    }

    const monthKey = String(log.date).substring(0, 7); // YYYY-MM
    if (!monthlySummary[monthKey]) {
      monthlySummary[monthKey] = { month: monthKey, savings: 0, meatKg: 0, eggs: 0 };
    }
    monthlySummary[monthKey].savings += savings;
    if (log.productType === "carne_canal") monthlySummary[monthKey].meatKg += qty;
    if (log.productType === "huevo") monthlySummary[monthKey].eggs += qty;
  }

  const sortedMonths = Object.values(monthlySummary).sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({
    metrics: {
      totalSavings: Math.round(totalSavings),
      totalMeatKg: Math.round(totalMeatKg * 10) / 10,
      totalEggs,
      totalEntries: logs.length,
    },
    bySpecies: speciesSummary,
    monthlyTrends: sortedMonths,
    logs: enrichedLogs,
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

  if (!body.date) return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
  if (!body.species) return NextResponse.json({ error: "Especie requerida" }, { status: 400 });
  if (!body.productType) return NextResponse.json({ error: "Tipo de producto requerido" }, { status: 400 });

  const qty = Number(body.quantity);
  if (!qty || qty <= 0) return NextResponse.json({ error: "Cantidad debe ser mayor a 0" }, { status: 400 });

  const refPrice = Number(body.marketReferencePrice) || 0;
  if (refPrice < 0) return NextResponse.json({ error: "Precio de referencia no puede ser negativo" }, { status: 400 });

  const savingsAmount = body.savingsAmount !== undefined
    ? Number(body.savingsAmount)
    : qty * refPrice;

  const [created] = await db.insert(autoconsumoLogs).values({
    date: body.date,
    species: body.species,
    productType: body.productType,
    quantity: String(qty),
    unit: body.unit || (body.productType === "carne_canal" ? "kg" : "unidades"),
    marketReferencePrice: String(refPrice),
    savingsAmount: savingsAmount.toFixed(2),
    destinationHousehold: body.destinationHousehold || "Familia Granja",
    batchId: body.batchId || null,
    notes: body.notes || null,
  }).returning();

  return NextResponse.json(created, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.delete(autoconsumoLogs).where(eq(autoconsumoLogs.id, id));
  return NextResponse.json({ ok: true });
});

