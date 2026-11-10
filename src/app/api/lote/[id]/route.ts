import { db } from "@/db";
import { broilerBatches, mortalityRecords, weightLogs, eggProduction, eggProductionDetails } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { isUuid } from "@/lib/ids";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  const [batch] = await db
    .select()
    .from(broilerBatches)
    .where(eq(broilerBatches.id, id))
    .limit(1);

  if (batch) {
    const mortality = await db
      .select()
      .from(mortalityRecords)
      .where(eq(mortalityRecords.batchId, id))
      .orderBy(desc(mortalityRecords.date));

    const weights = await db
      .select()
      .from(weightLogs)
      .where(eq(weightLogs.batchId, id))
      .orderBy(desc(weightLogs.date));

    return NextResponse.json({
      type: "lote_engorde",
      id: batch.id,
      code: batch.code,
      breed: batch.breed,
      startDate: batch.startDate,
      initialQuantity: batch.initialQuantity,
      currentQuantity: batch.currentQuantity,
      avgWeightKg: batch.avgWeightKg,
      status: batch.status,
      mortalityRecords: mortality.map((m) => ({
        date: m.date,
        quantity: m.quantity,
        cause: m.cause,
      })),
      weightLogs: weights.map((w) => ({
        date: w.date,
        avgWeightKg: w.avgWeightKg,
        weekNumber: w.weekNumber,
        sampleSize: w.sampleSize,
      })),
    });
  }

  const [egg] = await db
    .select()
    .from(eggProduction)
    .where(eq(eggProduction.id, id))
    .limit(1);

  if (egg) {
    const details = await db
      .select()
      .from(eggProductionDetails)
      .where(eq(eggProductionDetails.productionId, id));

    return NextResponse.json({
      type: "produccion_huevos",
      id: egg.id,
      date: egg.date,
      totalCollected: egg.totalCollected,
      broken: egg.broken,
      forIncubation: egg.forIncubation,
      sizeBreakdown: details.map((d) => ({ size: d.size, quantity: d.quantity })),
    });
  }

  return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
});
