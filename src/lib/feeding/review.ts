import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import { FEEDING_PROGRAMS_REVIEW_KEY } from "@/lib/onboarding";

export async function markFeedingProgramsReviewed(farmId = getCurrentFarmId()): Promise<string> {
  const reviewedAt = new Date().toISOString();
  await db
    .insert(appSettings)
    .values({ farmId, key: FEEDING_PROGRAMS_REVIEW_KEY, value: reviewedAt })
    .onConflictDoUpdate({
      target: [appSettings.farmId, appSettings.key],
      set: { value: reviewedAt, updatedAt: new Date() },
    });
  return reviewedAt;
}
