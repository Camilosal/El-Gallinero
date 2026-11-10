import { db } from "@/db";
import { broilerBatches, catalogos, hens, manureFactors, roosters } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ageInWeeks, isAvailableForExit, stageForAge, type StageRange } from "@/lib/lifecycle";
import { estimatedKgPerDay, totalEstimatedKgPerDay, type BirdGroupCount } from "@/lib/manure";

export interface ManureEstimationGroup extends BirdGroupCount {
  factorId: string | null;
  kgPerDay: number;
}

/** Calculates the daily estimate from the animals currently in the farm. */
export async function buildManureEstimate(): Promise<{
  groups: ManureEstimationGroup[];
  totalKgPerDay: number;
}> {
  const today = new Date();
  const [stages, allHens, factors] = await Promise.all([
    db.select().from(catalogos)
      .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
      .orderBy(sql`${catalogos.sortOrder}`),
    db.select({ birthDate: hens.birthDate, status: hens.status }).from(hens),
    db.select().from(manureFactors),
  ]);

  const [roosterCount, batchRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(roosters).where(eq(roosters.status, "activo")),
    db.select({ currentQuantity: broilerBatches.currentQuantity }).from(broilerBatches)
      .where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"])),
  ]);

  const stageRanges: StageRange[] = stages.map((stage) => ({
    id: stage.id,
    value: stage.value,
    minWeeks: stage.minWeeks,
    maxWeeks: stage.maxWeeks,
  }));

  const countByStage = new Map<string, number>();
  for (const hen of allHens) {
    if (!isAvailableForExit(hen.status)) continue;
    const weeks = ageInWeeks(hen.birthDate, today);
    const stage = stageForAge(stageRanges, weeks);
    if (stage) countByStage.set(stage.id, (countByStage.get(stage.id) || 0) + 1);
  }

  const groups: ManureEstimationGroup[] = [];
  for (const stage of stages) {
    let factor = factors.find((item) => item.stageCatalogoId === stage.id);
    if (!factor) {
      const [created] = await db.insert(manureFactors).values({
        stageCatalogoId: stage.id,
        birdGroup: "etapa",
        kgPerBirdPerDay: "0",
      }).onConflictDoNothing().returning();
      factor = created || (await db.select().from(manureFactors).where(and(
        eq(manureFactors.stageCatalogoId, stage.id),
        eq(manureFactors.birdGroup, "etapa"),
      )))[0];
    }
    if (!factor) continue;

    const group: BirdGroupCount = {
      key: stage.id,
      label: stage.value,
      count: countByStage.get(stage.id) || 0,
      kgPerBirdPerDay: Number(factor.kgPerBirdPerDay),
    };
    groups.push({ ...group, factorId: factor.id, kgPerDay: estimatedKgPerDay(group) });
  }

  const roosterFactor = factors.find((factor) => factor.birdGroup === "gallo");
  const roosterGroup: BirdGroupCount = {
    key: "gallo",
    label: "Gallos",
    count: roosterCount[0]?.count || 0,
    kgPerBirdPerDay: roosterFactor ? Number(roosterFactor.kgPerBirdPerDay) : 0,
  };
  groups.push({
    ...roosterGroup,
    factorId: roosterFactor?.id || null,
    kgPerDay: estimatedKgPerDay(roosterGroup),
  });

  const batchCount = batchRows.reduce((sum, batch) => sum + batch.currentQuantity, 0);
  const batchFactor = factors.find((factor) => factor.birdGroup === "lote");
  const batchGroup: BirdGroupCount = {
    key: "lote",
    label: "Lotes de engorde",
    count: batchCount,
    kgPerBirdPerDay: batchFactor ? Number(batchFactor.kgPerBirdPerDay) : 0,
  };
  groups.push({
    ...batchGroup,
    factorId: batchFactor?.id || null,
    kgPerDay: estimatedKgPerDay(batchGroup),
  });

  return { groups, totalKgPerDay: totalEstimatedKgPerDay(groups) };
}
