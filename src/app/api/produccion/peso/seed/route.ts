import { db } from "@/db";
import { breedWeightStandards } from "@/db/schema";
import { ALL_BREED_STANDARD_DEFS, inferSpeciesForBreed } from "@/lib/breed-standards";
import { requirePermission } from "@/lib/rbac-server";
import { withApiHandler } from "@/lib/api-handler";
import { eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async () => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;

  const missingSpecies = await db
    .select({ id: breedWeightStandards.id, breed: breedWeightStandards.breed })
    .from(breedWeightStandards)
    .where(isNull(breedWeightStandards.species));

  for (const row of missingSpecies) {
    await db
      .update(breedWeightStandards)
      .set({ species: inferSpeciesForBreed(row.breed) })
      .where(eq(breedWeightStandards.id, row.id));
  }

  let seeded = 0;
  let total = 0;

  for (const def of ALL_BREED_STANDARD_DEFS) {
    const rows = def.points.map((p) => ({
      species: def.species,
      breed: def.breed,
      gender: def.gender,
      weekNumber: p.week,
      targetWeightG: String(p.targetG),
      minWeightG: p.minG != null ? String(p.minG) : null,
      maxWeightG: p.maxG != null ? String(p.maxG) : null,
    }));
    total += rows.length;

    const inserted = await db
      .insert(breedWeightStandards)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: breedWeightStandards.id });
    seeded += inserted.length;
  }

  return NextResponse.json({ seeded, total });
});
