import { NextResponse } from "next/server";
import { computeManureInventory } from "@/lib/inventory";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const inventory = await computeManureInventory();
  return NextResponse.json(inventory);
});
