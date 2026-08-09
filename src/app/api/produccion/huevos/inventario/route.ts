import { NextResponse } from "next/server";
import { computeEggInventory } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  const inventory = await computeEggInventory();
  return NextResponse.json(inventory);
}
