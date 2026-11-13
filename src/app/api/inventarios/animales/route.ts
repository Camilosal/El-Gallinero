import { NextResponse } from "next/server";
import { computeAnimalInventory } from "@/lib/animal-inventory";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventarios/animales
 * Inventario consolidado de animales: gallinas, gallos, pollos, codornices,
 * patos, conejos y cuyes. La unidad es "animal"; el subtotal "aves" excluye conejos y cuyes.
 */
export const GET = withApiHandler(async () => {
  const inventory = await computeAnimalInventory();
  return NextResponse.json(inventory);
});
