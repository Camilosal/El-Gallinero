import { NextResponse } from "next/server";
import { computeManureInventory } from "@/lib/inventory";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const inventory = await computeManureInventory();
  const user = await getSessionUser();
  if (canPerformAction(user?.role, "sales:read")) return NextResponse.json(inventory);
  return NextResponse.json({
    ...inventory,
    salesHistory: inventory.salesHistory.map((sale) => ({ ...sale, totalAmount: null })),
  });
});
