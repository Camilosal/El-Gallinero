import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { manureSales, transactions } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockAndReadManureStock } from "@/lib/manure-stock";
import { isTodayOrEarlierManureDate } from "@/lib/manure";
import { createManureSale, deleteManureSale } from "@/lib/manure-operations";

export const dynamic = "force-dynamic";


export const GET = withApiHandler(async () => {
  const data = await db.select().from(manureSales).orderBy(desc(manureSales.date));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const quantityKg = Number(Number(body.quantityKg).toFixed(2));
  const pricePerKg = Number(Number(body.pricePerKg).toFixed(2));
  if (!isDateOnly(body.date) || !isTodayOrEarlierManureDate(body.date)) return NextResponse.json({ error: "Fecha inválida o futura" }, { status: 400 });
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });
  if (!Number.isFinite(pricePerKg) || pricePerKg < 0) return NextResponse.json({ error: "Precio/kg inválido" }, { status: 400 });

  const created = await db.transaction((tx) => createManureSale(tx, {
      date: body.date,
      quantityKg,
      pricePerKg,
      presentation: body.presentation,
      buyer: body.buyer,
      notes: body.notes,
  }));

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const quantityKg = Number(Number(body.quantityKg).toFixed(2));
  const pricePerKg = Number(Number(body.pricePerKg).toFixed(2));
  if (!isDateOnly(body.date) || !isTodayOrEarlierManureDate(body.date)) return NextResponse.json({ error: "Fecha inválida o futura" }, { status: 400 });
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });
  if (!Number.isFinite(pricePerKg) || pricePerKg < 0) return NextResponse.json({ error: "Precio/kg inválido" }, { status: 400 });

  const totalAmount = (quantityKg * pricePerKg).toFixed(2);

  const updated = await db.transaction(async (tx) => {
    const stock = await lockAndReadManureStock(tx);
    const [currentSale] = await tx.select().from(manureSales).where(eq(manureSales.id, body.id));
    if (!currentSale) throw new Error("No encontrado");
    const availableKg = stock + Number(currentSale.quantityKg);
    if (quantityKg > availableKg) {
      throw new Error(`Stock insuficiente: disponibles ${Math.max(0, availableKg).toFixed(2)} kg`);
    }

    const [upd] = await tx.update(manureSales).set({
      date: body.date,
      quantityKg: quantityKg.toFixed(2),
      pricePerKg: pricePerKg.toFixed(2),
      totalAmount,
      presentation: body.presentation || null,
      buyer: body.buyer || null,
      notes: body.notes || null,
    }).where(eq(manureSales.id, body.id)).returning();

    const [existingTx] = await tx.select().from(transactions)
      .where(and(eq(transactions.sourceType, "gallinaza"), eq(transactions.sourceId, body.id)));

    const values = {
      date: body.date,
      description: `Venta de gallinaza (${quantityKg} kg)${body.buyer ? ` a ${body.buyer}` : ""}`,
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
        category: "Venta de abono/gallinaza",
        sourceType: "gallinaza",
        sourceId: body.id,
      });
    }

    return upd;
  });

  if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const deleted = await db.transaction((tx) => deleteManureSale(tx, id));
  if (!deleted) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });

  return NextResponse.json({ ok: true });
});
