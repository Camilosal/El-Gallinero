import { NextResponse } from "next/server";
import { computeMeatInventory } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  const inventory = await computeMeatInventory();
  return NextResponse.json(inventory);
}
