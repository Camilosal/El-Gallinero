import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { getCurrentFarmId } from "@/db/tenant-context";
import { getFarmSubscriptionStatus } from "@/lib/subscription";
import { getGinaQuotaSnapshot } from "@/lib/pricing/gina-quota";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const farmId = (user as { farmId?: string | null }).farmId || getCurrentFarmId();
  const subscription = await getFarmSubscriptionStatus(farmId);
  const quota = await getGinaQuotaSnapshot({
    farmId,
    userId: user.id,
    entitlements: subscription.entitlements,
  });
  return NextResponse.json({ planName: subscription.planName, quota });
});
