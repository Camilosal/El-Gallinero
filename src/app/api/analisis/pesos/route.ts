import { db } from "@/db";
import { weightLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { broilerBatches } from "@/db/schema";
import { getStandardCurve } from "@/lib/standard-curves";
import { computeEmpiricalCurveCalibration } from "@/lib/zootechnics";
import { learnFromBiologicalCalibrationAction } from "@/lib/agent/ui-memory-bridge";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const logs = await db
    .select()
    .from(weightLogs)
    .orderBy(desc(weightLogs.date))
    .limit(100);

  return NextResponse.json(logs);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  try {
    const body = await safeParseJson(req);
    const { date, batchId, henGroup, breed, weekNumber, avgWeightKg, sampleSize, notes } = body;

    if (!date || !avgWeightKg) {
      return NextResponse.json(
        { error: "date and avgWeightKg are required" },
        { status: 400 }
      );
    }

    const [log] = await db
      .insert(weightLogs)
      .values({
        date,
        batchId: batchId || null,
        henGroup: henGroup || null,
        breed: breed || null,
        weekNumber: weekNumber || null,
        avgWeightKg,
        sampleSize: sampleSize || 1,
        notes: notes || null,
      })
      .returning();

    // Sintetizar calibración biológica reciente hacia la memoria operativa de Gina
    let resolvedSpecies = typeof body.species === "string" && body.species.trim() ? body.species.trim() : "";
    let resolvedBreed = typeof breed === "string" && breed.trim() ? breed.trim() : "";
    if ((!resolvedSpecies || !resolvedBreed) && batchId) {
      const [batch] = await db
        .select({ species: broilerBatches.species, breed: broilerBatches.breed })
        .from(broilerBatches)
        .where(eq(broilerBatches.id, String(batchId)))
        .limit(1);
      if (batch) {
        if (!resolvedSpecies) resolvedSpecies = batch.species;
        if (!resolvedBreed && batch.breed) resolvedBreed = batch.breed;
      }
    }
    if (!resolvedSpecies) resolvedSpecies = "pollo";

    const refCurve = getStandardCurve(resolvedSpecies, resolvedBreed || undefined);
    let empiricalFactor: number | null = null;
    let confidencePct: number | null = null;
    if (refCurve && refCurve.metric === "peso") {
      const recentLogs = await db
        .select({ weekNumber: weightLogs.weekNumber, avgWeightKg: weightLogs.avgWeightKg, sampleSize: weightLogs.sampleSize, breed: weightLogs.breed })
        .from(weightLogs)
        .orderBy(desc(weightLogs.date))
        .limit(40);
      const matching = recentLogs.filter(
        (r) => r.weekNumber != null && (!resolvedBreed || !r.breed || r.breed === resolvedBreed),
      );
      const cal = computeEmpiricalCurveCalibration({
        points: refCurve.points,
        observations: matching.map((r) => ({
          week: Number(r.weekNumber),
          actualValue: Number(r.avgWeightKg) * 1000,
          sampleSize: r.sampleSize,
        })),
      });
      if (cal.observationCount > 0) {
        empiricalFactor = cal.empiricalFactor;
        confidencePct = cal.confidencePct;
      }
    }

    await learnFromBiologicalCalibrationAction({
      species: resolvedSpecies,
      breed: resolvedBreed || null,
      weekNumber: weekNumber != null ? Number(weekNumber) : null,
      avgWeightKg: Number(avgWeightKg),
      sampleSize: sampleSize != null ? Number(sampleSize) : null,
      empiricalFactor,
      confidencePct,
    }).catch(() => null);

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating weight log:", error);
    return NextResponse.json(
      { error: "Error creating weight log" },
      { status: 500 }
    );
  }
});
