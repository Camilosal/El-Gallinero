import { NextResponse } from "next/server";
import { computeManureInventory } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  const inventory = await computeManureInventory();
  return NextResponse.json(inventory);
}
