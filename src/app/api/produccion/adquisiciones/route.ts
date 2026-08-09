import { db } from "@/db";
import { birdAcquisitions, hens, roosters, broilerBatches, transactions } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function nextCodes(existingCodes: string[], prefix: string, count: number): string[] {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const code of existingCodes) {
    const m = code.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + i + 1).padStart(3, "0")}`);
}

export async function GET() {
  const data = await db.select().from(birdAcquisitions).orderBy(desc(birdAcquisitions.createdAt));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, acquisitionType, birdType, quantity, unitCost, supplier, breed, birthDate, notes } = body;

  if (!date || !acquisitionType || !birdType || !quantity || quantity < 1) {
    return NextResponse.json({ error: "Fecha, tipo, especie y cantidad son requeridos" }, { status: 400 });
  }

  const totalCost = acquisitionType === "compra" && unitCost ? Number(unitCost) * Number(quantity) : null;
  const today = birthDate || new Date().toISOString().split("T")[0];

  const result = await db.transaction(async (tx) => {
    const [acquisition] = await tx.insert(birdAcquisitions).values({
      date,
      acquisitionType,
      birdType,
      quantity: Number(quantity),
      unitCost: unitCost ? String(unitCost) : null,
      totalCost: totalCost ? String(totalCost) : null,
      supplier: supplier || null,
      breed: breed || null,
      birthDate: today,
      notes: notes || null,
    }).returning();

    let createdBirdIds: string[] = [];

    if (birdType === "gallina") {
      const existingCodes = (await tx.select({ code: hens.code }).from(hens)).map((h) => h.code);
      const codes = nextCodes(existingCodes, "G", Number(quantity));
      const inserted = await tx.insert(hens).values(
        codes.map((code) => ({
          code,
          breed: breed || "Criolla",
          birthDate: today,
          status: "activa" as const,
          isBroody: false,
          acquisitionId: acquisition.id,
        }))
      ).returning();
      createdBirdIds = inserted.map((h) => h.id);
    } else if (birdType === "gallo") {
      const existingCodes = (await tx.select({ code: roosters.code }).from(roosters)).map((r) => r.code);
      const codes = nextCodes(existingCodes, "GA", Number(quantity));
      const inserted = await tx.insert(roosters).values(
        codes.map((code) => ({
          code,
          breed: breed || "Criolla",
          birthDate: today,
          status: "activo" as const,
          acquisitionId: acquisition.id,
        }))
      ).returning();
      createdBirdIds = inserted.map((r) => r.id);
    } else if (birdType === "lote_pollos") {
      const [maxRow] = await tx.select({ maxCode: sql<string>`max(${broilerBatches.code})` }).from(broilerBatches);
      let max = 0;
      if (maxRow?.maxCode) {
        const m = String(maxRow.maxCode).match(/^L-(\d+)$/);
        if (m) max = Number(m[1]);
      }
      const code = `L-${String(max + 1).padStart(3, "0")}`;
      const [batch] = await tx.insert(broilerBatches).values({
        code,
        breed: breed || "Pollo de engorde",
        startDate: today,
        initialQuantity: Number(quantity),
        currentQuantity: Number(quantity),
        acquisitionId: acquisition.id,
        notes: notes || `Lote adquirido por ${acquisitionType}`,
      }).returning();
      createdBirdIds = [batch.id];
    }

    if (acquisitionType === "compra" && totalCost) {
      const birdLabel = birdType === "gallina" ? "gallinas" : birdType === "gallo" ? "gallos" : "pollos";
      await tx.insert(transactions).values({
        date,
        type: "egreso",
        category: "Compra de aves",
        description: `Compra de ${quantity} ${birdLabel}${breed ? ` (${breed})` : ""}${supplier ? ` a ${supplier}` : ""}`,
        counterparty: supplier || null,
        amount: String(totalCost),
        quantity: String(quantity),
        unitPrice: unitCost ? String(unitCost) : null,
        unit: "aves",
        sourceType: "adquisicion",
        sourceId: acquisition.id,
        notes: notes || null,
      });
    }

    return { ...acquisition, createdBirdIds };
  });

  return NextResponse.json(result, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [existing] = await db.select().from(birdAcquisitions).where(eq(birdAcquisitions.id, body.id));
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [updated] = await db.update(birdAcquisitions).set({
    date: body.date ?? existing.date,
    acquisitionType: body.acquisitionType ?? existing.acquisitionType,
    unitCost: body.unitCost ?? existing.unitCost,
    totalCost: body.totalCost ?? existing.totalCost,
    supplier: body.supplier !== undefined ? body.supplier : existing.supplier,
    notes: body.notes !== undefined ? body.notes : existing.notes,
  }).where(eq(birdAcquisitions.id, body.id)).returning();

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [acquisition] = await db.select().from(birdAcquisitions).where(eq(birdAcquisitions.id, id));
  if (!acquisition) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  await db.transaction(async (tx) => {
    if (acquisition.birdType === "gallina") {
      await tx.delete(hens).where(eq(hens.acquisitionId, id));
    } else if (acquisition.birdType === "gallo") {
      await tx.delete(roosters).where(eq(roosters.acquisitionId, id));
    } else if (acquisition.birdType === "lote_pollos") {
      await tx.delete(broilerBatches).where(eq(broilerBatches.acquisitionId, id));
    }

    if (acquisition.acquisitionType === "compra") {
      await tx.delete(transactions).where(
        sql`${transactions.sourceType} = 'adquisicion' AND ${transactions.sourceId} = ${id}`
      );
    }

    await tx.delete(birdAcquisitions).where(eq(birdAcquisitions.id, id));
  });

  return NextResponse.json({ ok: true });
}
