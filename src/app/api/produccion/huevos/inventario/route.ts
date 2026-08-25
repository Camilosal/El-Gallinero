import { NextResponse } from "next/server";
import { computeEggInventory } from "@/lib/inventory";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const inventory = await computeEggInventory();
  return NextResponse.json(inventory);
});
