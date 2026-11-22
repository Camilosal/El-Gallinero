import { NextResponse } from "next/server";
import { computeMeatInventory } from "@/lib/inventory";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const inventory = await computeMeatInventory();
  const user = await getSessionUser();
  const canSeePrices = canPerformAction(user?.role, "sales:read");
  const canSeeValues = canPerformAction(user?.role, "finance:read");
  if (canSeePrices && canSeeValues) return NextResponse.json(inventory);

  return NextResponse.json({
    ...inventory,
    estimatedValue: canSeeValues ? inventory.estimatedValue : null,
    summary: {
      ...inventory.summary,
      value: canSeeValues ? inventory.summary.value : null,
      bySpecies: inventory.summary.bySpecies?.map((species) => ({
        ...species,
        estimatedPriceKg: canSeePrices ? species.estimatedPriceKg : null,
        estimatedValue: canSeeValues ? species.estimatedValue : null,
      })),
    },
    lots: inventory.lots.map((lot) => ({
      ...lot,
      estimatedPriceKg: canSeePrices ? lot.estimatedPriceKg : null,
      estimatedValue: canSeeValues ? lot.estimatedValue : null,
    })),
  });
});
