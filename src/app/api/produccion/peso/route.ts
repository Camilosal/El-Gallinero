import { db } from "@/db";
import { breedWeightStandards, weightLogs } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const breed = searchParams.get("breed");
  const gender = searchParams.get("gender") || "hembra";

  let standards: typeof breedWeightStandards.$inferSelect[] = [];
  if (breed) {
    standards = await db
      .select()
      .from(breedWeightStandards)
      .where(and(eq(breedWeightStandards.breed, breed), eq(breedWeightStandards.gender, gender)))
      .orderBy(breedWeightStandards.weekNumber);
  }

  const logs = await db
    .select()
    .from(weightLogs)
    .orderBy(desc(weightLogs.date))
    .limit(200);

  return NextResponse.json({ standards, logs });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { date, batchId, henGroup, breed, weekNumber, avgWeightKg, sampleSize, notes } = body;

  if (!date || !avgWeightKg) {
    return NextResponse.json({ error: "date and avgWeightKg are required" }, { status: 400 });
  }
  const weightNum = Number(avgWeightKg);
  if (isNaN(weightNum) || weightNum <= 0) {
    return NextResponse.json({ error: "avgWeightKg must be a positive number" }, { status: 400 });
  }

  const [row] = await db
    .insert(weightLogs)
    .values({
      date,
      batchId: batchId || null,
      henGroup: henGroup || null,
      breed: breed || null,
      weekNumber: weekNumber ?? null,
      avgWeightKg: String(avgWeightKg),
      sampleSize: sampleSize || 1,
      notes: notes || null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.delete(weightLogs).where(eq(weightLogs.id, id));
  return NextResponse.json({ ok: true });
});
