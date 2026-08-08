import { db } from "@/db";
import { feedInventory, feedMovements, transactions } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runFeedProgramCatchup } from "@/lib/feeding/runProgram";

export const dynamic = "force-dynamic";

export async function GET() {
  await runFeedProgramCatchup();
  const inventory = await db.select().from(feedInventory).orderBy(desc(feedInventory.createdAt));
  return NextResponse.json(inventory);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const [created] = await db.insert(feedInventory).values({
    name: body.name,
    category: body.category,
    feedType: body.feedType,
    unit: body.unit,
    currentStock: body.currentStock || "0",
    minStock: body.minStock || "0",
    costPerUnit: body.costPerUnit || "0",
    supplier: body.supplier || null,
  }).returning();
  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const [updated] = await db.update(feedInventory).set({
    name: body.name,
    category: body.category,
    feedType: body.feedType,
    unit: body.unit,
    currentStock: body.currentStock,
    minStock: body.minStock,
    costPerUnit: body.costPerUnit,
    supplier: body.supplier,
    updatedAt: new Date(),
  }).where(eq(feedInventory.id, body.id)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // Remove linked expense transactions of its movements
  const movs = await db.select({ id: feedMovements.id }).from(feedMovements).where(eq(feedMovements.feedId, id));
  const movIds = movs.map((m) => m.id);
  if (movIds.length > 0) {
    await db.delete(transactions).where(inArray(transactions.sourceId, movIds));
  }

  await db.delete(feedMovements).where(eq(feedMovements.feedId, id));
  await db.delete(feedInventory).where(eq(feedInventory.id, id));
  return NextResponse.json({ ok: true });
}
