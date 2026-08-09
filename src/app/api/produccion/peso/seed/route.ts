import { db } from "@/db";
import { breedWeightStandards } from "@/db/schema";
import { ALL_BREED_STANDARDS } from "@/lib/breed-standards";
import { NextResponse } from "next/server";

export async function POST() {
  let seeded = 0;

  for (const [key, points] of Object.entries(ALL_BREED_STANDARDS)) {
    const [breed, gender] = key.split("_");
    const rows = points.map((p) => ({
      breed,
      gender,
      weekNumber: p.week,
      targetWeightG: String(p.targetG),
      minWeightG: p.minG != null ? String(p.minG) : null,
      maxWeightG: p.maxG != null ? String(p.maxG) : null,
    }));

    await db.insert(breedWeightStandards).values(rows).onConflictDoNothing();
    seeded += rows.length;
  }

  return NextResponse.json({ seeded });
}
