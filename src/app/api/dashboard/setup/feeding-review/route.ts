import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { appSettings, catalogos, feedInventory, feedPrograms } from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import { FEEDING_PROGRAMS_REVIEW_KEY } from "@/lib/onboarding";
import { markFeedingProgramsReviewed } from "@/lib/feeding/review";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const [settingRows, programRows] = await Promise.all([
    db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, FEEDING_PROGRAMS_REVIEW_KEY))
      .limit(1),
    db
      .select({ id: feedPrograms.id })
      .from(feedPrograms)
      .innerJoin(
        catalogos,
        and(eq(feedPrograms.stageCatalogoId, catalogos.id), eq(catalogos.isActive, true)),
      )
      .innerJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id)),
  ]);

  const reviewedAt = settingRows[0]?.value || null;
  const totalPrograms = programRows.length;

  return NextResponse.json({
    reviewed: Boolean(reviewedAt && totalPrograms > 0),
    reviewedAt,
    totalPrograms,
  });
});

export const POST = withApiHandler(async () => {
  const [activeProgram] = await db
    .select({ id: feedPrograms.id })
    .from(feedPrograms)
    .innerJoin(
      catalogos,
      and(eq(feedPrograms.stageCatalogoId, catalogos.id), eq(catalogos.isActive, true)),
    )
    .innerJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id))
    .limit(1);

  if (!activeProgram) {
    return NextResponse.json(
      { error: "Agrega o inicializa al menos un plan de alimentación antes de validarlo." },
      { status: 400 },
    );
  }

  const reviewedAt = await markFeedingProgramsReviewed();
  return NextResponse.json({ reviewed: true, reviewedAt });
});
