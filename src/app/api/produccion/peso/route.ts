import { db } from "@/db";
import { breedWeightStandards, weightLogs } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, batchId, henGroup, breed, weekNumber, avgWeightKg, sampleSize, notes } = body;

  if (!date || !avgWeightKg) {
    return NextResponse.json({ error: "date and avgWeightKg are required" }, { status: 400 });
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
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.delete(weightLogs).where(eq(weightLogs.id, id));
  return NextResponse.json({ ok: true });
}
