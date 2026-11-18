import { NextResponse } from "next/server";
import { computeEggInventory } from "@/lib/inventory";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const inventory = await computeEggInventory();
  const user = await getSessionUser();
  const canSeePrices = canPerformAction(user?.role, "sales:read");
  const canSeeValues = canPerformAction(user?.role, "finance:read");
  if (canSeePrices && canSeeValues) return NextResponse.json(inventory);

  return NextResponse.json({
    ...inventory,
    estimatedValue: canSeeValues ? inventory.estimatedValue : null,
    summary: {
      ...inventory.summary,
      sizes: inventory.summary.sizes.map((size) => ({
        ...size,
        price: canSeePrices ? size.price : null,
        value: canSeeValues ? size.value : null,
      })),
    },
  });
});
