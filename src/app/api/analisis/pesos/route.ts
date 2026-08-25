import { db } from "@/db";
import { weightLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
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

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating weight log:", error);
    return NextResponse.json(
      { error: "Error creating weight log" },
      { status: 500 }
    );
  }
});
