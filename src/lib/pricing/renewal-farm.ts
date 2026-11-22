import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { farms } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import { ApiHttpError } from "@/lib/api-handler";
import { isUuidString, isValidFarmCode, normalizeFarmCode } from "@/lib/farm-code";
import { getFarmSubscriptionStatus } from "@/lib/subscription";

export interface VerifiedRenewalFarm {
  id: string;
  code: string;
  name: string;
  planName: "Productor" | "Organización";
}

export type RenewalPlanSegment = "producer" | "aggregator";

/** Confirms the Code (`7K4M2P`) or FarmID (UUID) belongs to the signed-in tenant and has an active matching plan. */
export async function verifyRenewalFarmId(
  value: unknown,
  segment: RenewalPlanSegment,
): Promise<VerifiedRenewalFarm> {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiHttpError(
      400,
      "Escribe un Código de Granja (6 caracteres, ej. 7K4M2P) o tu FarmID para comprobar la granja.",
      { code: "RENEWAL_FARM_ID_INVALID" },
    );
  }

  const trimmed = value.trim();
  const currentFarmId = getCurrentFarmId();
  let farm: { id: string; code: string; name: string } | undefined;

  if (isUuidString(trimmed)) {
    const requestedId = trimmed.toLowerCase();
    if (requestedId !== currentFarmId.toLowerCase()) {
      throw new ApiHttpError(
        404,
        "No encontramos una granja asociada a este Código o FarmID en la cuenta actual.",
        { code: "RENEWAL_FARM_NOT_FOUND" },
      );
    }

    const [found] = await db
      .select({ id: farms.id, code: farms.code, name: farms.name })
      .from(farms)
      .where(eq(farms.id, requestedId))
      .limit(1);
    farm = found;
  } else {
    const normalizedCode = normalizeFarmCode(trimmed);
    if (!isValidFarmCode(normalizedCode)) {
      throw new ApiHttpError(
        400,
        "Escribe un Código de Granja válido (6 caracteres, ej. 7K4M2P) o un FarmID válido.",
        { code: "RENEWAL_FARM_ID_INVALID" },
      );
    }

    const [found] = await db
      .select({ id: farms.id, code: farms.code, name: farms.name })
      .from(farms)
      .where(and(eq(farms.id, currentFarmId), eq(farms.code, normalizedCode)))
      .limit(1);
    farm = found;
  }

  if (!farm) {
    throw new ApiHttpError(
      404,
      "No encontramos una granja asociada a este Código o FarmID en la cuenta actual.",
      { code: "RENEWAL_FARM_NOT_FOUND" },
    );
  }

  const subscription = await getFarmSubscriptionStatus(farm.id);
  const expectedPlan = segment === "producer" ? "producer" : "aggregator";
  const planName = segment === "producer" ? "Productor" : "Organización";
  if (subscription.planKey !== expectedPlan || !subscription.isPaidActive) {
    throw new ApiHttpError(
      409,
      `La granja existe, pero no tiene una suscripción ${planName} activa para renovar.`,
      { code: "RENEWAL_SUBSCRIPTION_NOT_ACTIVE" },
    );
  }

  return { id: farm.id, code: farm.code, name: farm.name, planName };
}

/** Backwards-compatible wrapper used by the Producer payment flow. */
export async function verifyProducerRenewalFarmId(value: unknown): Promise<VerifiedRenewalFarm> {
  return verifyRenewalFarmId(value, "producer");
}
