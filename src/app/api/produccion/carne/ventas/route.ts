import { db } from "@/db";
import { meatSales, transactions } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await db.select().from(meatSales).orderBy(desc(meatSales.date));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const quantityKg = Number(body.quantityKg);
  const pricePerKg = Number(body.pricePerKg);
  if (!body.date) return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
  if (isNaN(quantityKg) || quantityKg <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });
  if (isNaN(pricePerKg) || pricePerKg < 0) return NextResponse.json({ error: "Precio/kg inválido" }, { status: 400 });

  const totalAmount = (quantityKg * pricePerKg).toFixed(2);

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(meatSales).values({
      date: body.date,
      quantityKg: quantityKg.toFixed(2),
      pricePerKg: pricePerKg.toFixed(2),
      totalAmount,
      presentation: body.presentation || null,
      buyer: body.buyer || null,
      notes: body.notes || null,
    }).returning();

    await tx.insert(transactions).values({
      date: body.date,
      type: "ingreso",
      category: "Venta de carne",
      description: `Venta de ${quantityKg} kg de carne${body.buyer ? ` a ${body.buyer}` : ""}`,
      counterparty: body.buyer || null,
      amount: totalAmount,
      quantity: quantityKg.toFixed(2),
      unitPrice: pricePerKg.toFixed(2),
      unit: "kg",
      presentation: body.presentation || null,
      sourceType: "venta_carne",
      sourceId: inserted.id,
      notes: body.notes || null,
    });

    return inserted;
  });

  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const quantityKg = Number(body.quantityKg);
  const pricePerKg = Number(body.pricePerKg);
  if (isNaN(quantityKg) || quantityKg <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });
  if (isNaN(pricePerKg) || pricePerKg < 0) return NextResponse.json({ error: "Precio/kg inválido" }, { status: 400 });

  const totalAmount = (quantityKg * pricePerKg).toFixed(2);

  const updated = await db.transaction(async (tx) => {
    const [upd] = await tx.update(meatSales).set({
      date: body.date,
      quantityKg: quantityKg.toFixed(2),
      pricePerKg: pricePerKg.toFixed(2),
      totalAmount,
      presentation: body.presentation || null,
      buyer: body.buyer || null,
      notes: body.notes || null,
    }).where(eq(meatSales.id, body.id)).returning();

    const [existingTx] = await tx.select().from(transactions)
      .where(and(eq(transactions.sourceType, "venta_carne"), eq(transactions.sourceId, body.id)));

    const values = {
      date: body.date,
      description: `Venta de ${quantityKg} kg de carne${body.buyer ? ` a ${body.buyer}` : ""}`,
      amount: totalAmount,
      quantity: quantityKg.toFixed(2),
      unitPrice: pricePerKg.toFixed(2),
      unit: "kg",
      counterparty: body.buyer || null,
      presentation: body.presentation || null,
      notes: body.notes || null,
    };

    if (existingTx) {
      await tx.update(transactions).set(values).where(eq(transactions.id, existingTx.id));
    } else {
      await tx.insert(transactions).values({
        ...values,
        type: "ingreso",
        category: "Venta de carne",
        sourceType: "venta_carne",
        sourceId: body.id,
      });
    }

    return upd;
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(and(eq(transactions.sourceType, "venta_carne"), eq(transactions.sourceId, id)));
    await tx.delete(meatSales).where(eq(meatSales.id, id));
  });

  return NextResponse.json({ ok: true });
}
