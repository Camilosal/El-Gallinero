import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { meatSales, transactions } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { computeMeatInventory } from "@/lib/inventory";
import { lockMeatInventory } from "@/lib/inventory-locks";
import { deleteTransactionsAndUnpaidAccounts } from "@/lib/financial-records";

export const dynamic = "force-dynamic";


export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const species = searchParams.get("species");
  let query = db.select().from(meatSales);
  const data = species && species !== "all"
    ? await query.where(eq(meatSales.species, species as any)).orderBy(desc(meatSales.date))
    : await query.orderBy(desc(meatSales.date));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const quantityKg = Number(Number(body.quantityKg).toFixed(2));
  const pricePerKg = Number(Number(body.pricePerKg).toFixed(2));
  const species = body.species || "pollo";
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });
  if (!Number.isFinite(pricePerKg) || pricePerKg < 0) return NextResponse.json({ error: "Precio/kg inválido" }, { status: 400 });

  const totalAmount = (quantityKg * pricePerKg).toFixed(2);
  const speciesLabel = species.charAt(0).toUpperCase() + species.slice(1);

  const created = await db.transaction(async (tx) => {
    await lockMeatInventory(tx);
    const inventory = await computeMeatInventory(tx);
    const availableKg = inventory.summary.bySpecies?.find((entry) => entry.species === species)?.availableKg || 0;
    if (quantityKg > availableKg) {
      throw new Error(`Stock insuficiente de ${species}: disponibles ${availableKg.toFixed(2)} kg`);
    }

    const [inserted] = await tx.insert(meatSales).values({
      date: body.date,
      species,
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
      description: `Venta de ${quantityKg} kg de carne de ${speciesLabel}${body.buyer ? ` a ${body.buyer}` : ""}`,
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
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const quantityKg = Number(Number(body.quantityKg).toFixed(2));
  const pricePerKg = Number(Number(body.pricePerKg).toFixed(2));
  const species = body.species || "pollo";
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) return NextResponse.json({ error: "Cantidad kg inválida" }, { status: 400 });
  if (!Number.isFinite(pricePerKg) || pricePerKg < 0) return NextResponse.json({ error: "Precio/kg inválido" }, { status: 400 });

  const totalAmount = (quantityKg * pricePerKg).toFixed(2);
  const speciesLabel = species.charAt(0).toUpperCase() + species.slice(1);

  const updated = await db.transaction(async (tx) => {
    await lockMeatInventory(tx);
    const [currentSale] = await tx.select().from(meatSales).where(eq(meatSales.id, body.id));
    if (!currentSale) throw new Error("No encontrado");
    const inventory = await computeMeatInventory(tx, { excludeSaleId: body.id });
    const availableBySpecies = new Map(inventory.summary.bySpecies?.map((entry) => [entry.species, entry.availableKg]) || []);
    const availableKg = availableBySpecies.get(species) || 0;
    if (quantityKg > availableKg) {
      throw new Error(`Stock insuficiente de ${species}: disponibles ${availableKg.toFixed(2)} kg`);
    }

    const [upd] = await tx.update(meatSales).set({
      date: body.date,
      species,
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
      description: `Venta de ${quantityKg} kg de carne de ${speciesLabel}${body.buyer ? ` a ${body.buyer}` : ""}`,
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

  if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await lockMeatInventory(tx);
    const [sale] = await tx.select().from(meatSales).where(eq(meatSales.id, id));
    if (!sale) throw new Error("No encontrado");
    await deleteTransactionsAndUnpaidAccounts(
      tx,
      and(eq(transactions.sourceType, "venta_carne"), eq(transactions.sourceId, id)),
    );
    await tx.delete(meatSales).where(eq(meatSales.id, id));
  });

  return NextResponse.json({ ok: true });
});
