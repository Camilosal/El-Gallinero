import { eq } from "drizzle-orm";
import { db } from "@/db";
import { farms } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import { ApiHttpError } from "@/lib/api-handler";
import { getFarmSubscriptionStatus } from "@/lib/subscription";

const FARM_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface VerifiedRenewalFarm {
  id: string;
  name: string;
  planName: "Productor" | "Organización";
}

export type RenewalPlanSegment = "producer" | "aggregator";

/** Confirms the ID belongs to the signed-in tenant and has an active matching plan. */
export async function verifyRenewalFarmId(
  value: unknown,
  segment: RenewalPlanSegment,
): Promise<VerifiedRenewalFarm> {
  if (typeof value !== "string" || !FARM_ID_PATTERN.test(value.trim())) {
    throw new ApiHttpError(400, "Escribe un FarmID válido para comprobar la granja.", {
      code: "RENEWAL_FARM_ID_INVALID",
    });
  }

  const farmId = value.trim().toLowerCase();
  if (farmId !== getCurrentFarmId().toLowerCase()) {
    throw new ApiHttpError(404, "No encontramos una granja asociada a este FarmID en la cuenta actual.", {
      code: "RENEWAL_FARM_NOT_FOUND",
    });
  }

  const [farm] = await db
    .select({ id: farms.id, name: farms.name })
    .from(farms)
    .where(eq(farms.id, farmId))
    .limit(1);

  if (!farm) {
    throw new ApiHttpError(404, "No encontramos una granja asociada a este FarmID en la cuenta actual.", {
      code: "RENEWAL_FARM_NOT_FOUND",
    });
  }

  const subscription = await getFarmSubscriptionStatus(farm.id);
  const expectedPlan = segment === "producer" ? "producer" : "aggregator";
  const planName = segment === "producer" ? "Productor" : "Organización";
  if (subscription.planKey !== expectedPlan || !subscription.isPaidActive) {
    throw new ApiHttpError(409, `La granja existe, pero no tiene una suscripción ${planName} activa para renovar.`, {
      code: "RENEWAL_SUBSCRIPTION_NOT_ACTIVE",
    });
  }

  return { ...farm, planName };
}

/** Backwards-compatible wrapper used by the Producer payment flow. */
export async function verifyProducerRenewalFarmId(value: unknown): Promise<VerifiedRenewalFarm> {
  return verifyRenewalFarmId(value, "producer");
}
