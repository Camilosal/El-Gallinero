import { NextResponse } from "next/server";
import { computeAnimalInventory } from "@/lib/animal-inventory";
import { withApiHandler } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventarios/animales
 * Inventario consolidado de animales: gallinas, gallos, pollos, codornices,
 * patos, conejos y cuyes. La unidad es "animal"; el subtotal "aves" excluye conejos y cuyes.
 */
export const GET = withApiHandler(async () => {
  const inventory = await computeAnimalInventory();
  const user = await getSessionUser();
  if (canPerformAction(user?.role, "finance:read")) return NextResponse.json(inventory);

  return NextResponse.json({
    ...inventory,
    summary: { ...inventory.summary, totalValue: null },
    species: inventory.species.map((species) => ({
      ...species,
      estimatedValue: null,
    })),
    groups: inventory.groups.map((group) => ({
      ...group,
      pricePerKg: null,
      estimatedValue: null,
    })),
  });
});
