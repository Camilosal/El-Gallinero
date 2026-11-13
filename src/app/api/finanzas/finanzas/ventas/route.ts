import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { eggSales, eggSalesItems, transactions } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac-server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { computeEggInventory } from "@/lib/inventory";
import { lockEggInventory } from "@/lib/inventory-locks";
import {
  deleteTransactionsAndUnpaidAccounts,
  getCreditMetaBySourceIds,
  syncCreditReceivable,
} from "@/lib/financial-records";
import { resolveDimensions } from "@/lib/analytics-dimensions";
import { assertDateNotClosed, assertNoActiveWithdrawal } from "@/lib/sanitary-locks";

export const dynamic = "force-dynamic";

function aggregateItems(items: { size: string; quantity: number }[]) {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.size, (totals.get(item.size) || 0) + item.quantity);
  return totals;
}

type InventoryClient = NonNullable<Parameters<typeof computeEggInventory>[0]>;

async function getAvailableEggsBySize(
  client: InventoryClient = db,
  options: { excludeSaleId?: string } = {},
) {
  const inventory = await computeEggInventory(client, options);
  return new Map(inventory.summary.sizes.map((size) => [size.size, size.available]));
}

function validateAvailability(items: { size: string; quantity: number }[], available: Map<string, number>) {
  for (const [size, quantity] of aggregateItems(items)) {
    const amountAvailable = available.get(size) || 0;
    if (quantity > amountAvailable) {
      return `No hay suficientes huevos tamaño ${size}. Disponibles: ${amountAvailable}`;
    }
  }
  return null;
}


function validateItems(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) return "La venta debe tener al menos un tamaño";
  for (const item of items) {
    if (!item || typeof item.size !== "string" || !item.size.trim()) return "Selecciona el tamaño del huevo";
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return `Cantidad inválida para tamaño ${item.size}`;
    if (item.presentations !== undefined && (!Number.isSafeInteger(item.presentations) || item.presentations < 1)) {
      return `Presentaciones inválidas para tamaño ${item.size}`;
    }
    if (!Number.isFinite(Number(item.pricePerUnit)) || Number(item.pricePerUnit) <= 0) {
      return `Precio inválido para tamaño ${item.size}`;
    }
  }
  return null;
}

// GET /api/finanzas/finanzas/ventas
export const GET = withApiHandler(async () => {
  const data = await db.select().from(eggSales).orderBy(desc(eggSales.date)).limit(100);
  if (data.length === 0) return NextResponse.json([]);
  const saleIds = data.map((sale) => sale.id);
  const [items, creditMetaMap] = await Promise.all([
    db.select().from(eggSalesItems).where(inArray(eggSalesItems.saleId, saleIds)),
    getCreditMetaBySourceIds("venta", saleIds),
  ]);
  const itemsBySale = new Map<string, typeof items>();
  for (const item of items) {
    const saleItems = itemsBySale.get(item.saleId) || [];
    saleItems.push(item);
    itemsBySale.set(item.saleId, saleItems);
  }
  return NextResponse.json(
    data.map((sale) => {
      const creditMeta = creditMetaMap.get(sale.id);
      return {
        ...sale,
        transactionId: creditMeta?.transactionId || null,
        isCredit: creditMeta?.isCredit ?? false,
        dueDate: creditMeta?.dueDate || null,
        items: itemsBySale.get(sale.id) || [],
      };
    }),
  );
});

// POST /api/finanzas/finanzas/ventas
export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  const items: { size: string; quantity: number; presentations?: number; pricePerUnit: number; presentation?: string }[] = body.items;

  const itemError = validateItems(items);
  if (itemError) return NextResponse.json({ error: itemError }, { status: 400 });
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (body.isCredit && body.dueDate && !isDateOnly(body.dueDate)) return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });

  const grandTotal = items.reduce((sum, item) => {
    const presentations = item.presentations || item.quantity;
    return sum + presentations * Number(item.pricePerUnit);
  }, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (!Number.isFinite(grandTotal) || grandTotal <= 0 || !Number.isSafeInteger(totalQuantity)) {
    return NextResponse.json({ error: "Total de venta inválido" }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    await lockEggInventory(tx);
    const dimRes = await resolveDimensions(tx, {
      species: body.species || "gallina",
      locationId: body.locationId,
      batchId: body.batchId,
    });
    if ("error" in dimRes) throw new Error(dimRes.error);
    const dims = dimRes.dimensions;
    const effectiveSpecies = (dims.species || "gallina") as typeof eggSales.$inferInsert.species;
    await assertDateNotClosed(tx, { date: body.date });
    await assertNoActiveWithdrawal(tx, {
      date: body.date,
      species: effectiveSpecies,
      locationId: dims.locationId,
      batchId: dims.batchId,
      operationLabel: "venta de huevos",
    });

    const available = await getAvailableEggsBySize(tx);
    const stockError = validateAvailability(items, available);
    if (stockError) throw new Error(stockError);

    const [created] = await tx.insert(eggSales).values({
      date: body.date,
      species: effectiveSpecies,
      locationId: dims.locationId,
      batchId: dims.batchId,
      lotCode: typeof body.lotCode === "string" && body.lotCode.trim() ? body.lotCode.trim() : null,
      quantity: totalQuantity,
      pricePerUnit: "0",
      totalAmount: grandTotal.toFixed(2),
      size: items.length === 1 ? items[0].size : null,
      presentation: items.length === 1 ? (items[0].presentation || null) : null,
      buyer: body.buyer || null,
      notes: body.notes || null,
    }).returning();

    const createdItems = await tx.insert(eggSalesItems).values(
      items.map((item) => {
        const presentations = item.presentations || item.quantity;
        return {
          saleId: created.id,
          size: item.size,
          quantity: item.quantity,
          pricePerUnit: String(item.pricePerUnit),
          totalAmount: (presentations * Number(item.pricePerUnit)).toFixed(2),
          presentation: item.presentation || null,
        };
      })
    ).returning();

    const sizeDesc = items.length === 1
      ? items[0].size
      : items.map((i) => `${i.quantity} ${i.size}`).join(", ");
    const [txRow] = await tx.insert(transactions).values({
      date: body.date,
      type: "ingreso",
      category: "Venta de huevos",
      description: `Venta de ${sizeDesc}${body.buyer ? ` a ${body.buyer}` : ""}`,
      amount: grandTotal.toFixed(2),
      quantity: String(totalQuantity),
      unitPrice: items.length === 1 ? String(items[0].pricePerUnit) : null,
      unit: "unidades",
      counterparty: body.buyer || null,
      sourceType: "venta",
      sourceId: created.id,
      species: effectiveSpecies,
      locationId: dims.locationId,
      batchId: dims.batchId,
    }).returning();

    if (body.isCredit) {
      await syncCreditReceivable(tx, {
        transactionId: txRow.id,
        totalAmount: grandTotal,
        isCredit: true,
        dueDate: body.dueDate || null,
        buyer: body.buyer || null,
      });
    }

    return { ...created, items: createdItems, transactionId: txRow.id };
  });
  return NextResponse.json(result, { status: 201 });
});

// PUT /api/finanzas/finanzas/ventas
export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  const items: { size: string; quantity: number; presentations?: number; pricePerUnit: number; presentation?: string }[] = body.items;

  const itemError = validateItems(items);
  if (itemError) return NextResponse.json({ error: itemError }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (body.isCredit && body.dueDate && !isDateOnly(body.dueDate)) return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });

  const grandTotal = items.reduce((sum, item) => {
    const presentations = item.presentations || item.quantity;
    return sum + presentations * Number(item.pricePerUnit);
  }, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (!Number.isFinite(grandTotal) || grandTotal <= 0 || !Number.isSafeInteger(totalQuantity)) {
    return NextResponse.json({ error: "Total de venta inválido" }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    await lockEggInventory(tx);
    const [currentSale] = await tx.select({ id: eggSales.id }).from(eggSales).where(eq(eggSales.id, body.id));
    if (!currentSale) throw new Error("No encontrado");
    await assertDateNotClosed(tx, { date: body.date });
    const dimRes = await resolveDimensions(tx, {
      species: body.species || "gallina",
      locationId: body.locationId,
      batchId: body.batchId,
    });
    if ("error" in dimRes) throw new Error(dimRes.error);
    const dims = dimRes.dimensions;
    const effectiveSpecies = (dims.species || "gallina") as typeof eggSales.$inferInsert.species;

    await assertNoActiveWithdrawal(tx, {
      date: body.date,
      species: effectiveSpecies,
      locationId: dims.locationId,
      batchId: dims.batchId,
      operationLabel: "venta de huevos",
    });
    const available = await getAvailableEggsBySize(tx, { excludeSaleId: body.id });
    const stockError = validateAvailability(items, available);
    if (stockError) throw new Error(stockError);

    const [updated] = await tx.update(eggSales).set({
      date: body.date,
      species: effectiveSpecies,
      locationId: dims.locationId,
      batchId: dims.batchId,
      lotCode: body.lotCode !== undefined ? (body.lotCode ? String(body.lotCode).trim() : null) : undefined,
      quantity: totalQuantity,
      totalAmount: grandTotal.toFixed(2),
      size: items.length === 1 ? items[0].size : null,
      presentation: items.length === 1 ? (items[0].presentation || null) : null,
      buyer: body.buyer || null,
      notes: body.notes || null,
    }).where(eq(eggSales.id, body.id)).returning();
    if (!updated) throw new Error("No encontrado");

    await tx.delete(eggSalesItems).where(eq(eggSalesItems.saleId, body.id));
    const createdItems = await tx.insert(eggSalesItems).values(
      items.map((item) => {
        const presentations = item.presentations || item.quantity;
        return {
          saleId: body.id,
          size: item.size,
          quantity: item.quantity,
          pricePerUnit: String(item.pricePerUnit),
          totalAmount: (presentations * Number(item.pricePerUnit)).toFixed(2),
          presentation: item.presentation || null,
        };
      })
    ).returning();

    const [existing] = await tx.select().from(transactions)
      .where(and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, body.id)));

    const sizeDesc = items.length === 1
      ? items[0].size
      : items.map((i) => `${i.quantity} ${i.size}`).join(", ");
    const values = {
      date: body.date,
      description: `Venta de ${sizeDesc}${body.buyer ? ` a ${body.buyer}` : ""}`,
      amount: grandTotal.toFixed(2),
      quantity: String(totalQuantity),
      unitPrice: items.length === 1 ? String(items[0].pricePerUnit) : null,
      unit: "unidades",
      counterparty: body.buyer || null,
      species: effectiveSpecies,
      locationId: dims.locationId,
      batchId: dims.batchId,
    };

    if (existing) {
      await tx.update(transactions).set(values).where(eq(transactions.id, existing.id));
    } else {
      await tx.insert(transactions).values({ ...values, type: "ingreso", category: "Venta de huevos", sourceType: "venta", sourceId: body.id });
    }

    const [currentTx] = await tx.select().from(transactions)
      .where(and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, body.id)));

    if (currentTx) {
      await syncCreditReceivable(tx, {
        transactionId: currentTx.id,
        totalAmount: grandTotal,
        isCredit: Boolean(body.isCredit),
        dueDate: body.dueDate,
        buyer: body.buyer || null,
      });
    }

    return { ...updated, items: createdItems, transactionId: currentTx?.id || null };
  });
  return NextResponse.json(result);
});

// DELETE /api/finanzas/finanzas/ventas
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await lockEggInventory(tx);
    const [sale] = await tx.select({ id: eggSales.id }).from(eggSales).where(eq(eggSales.id, id));
    if (!sale) throw new Error("No encontrado");
    await deleteTransactionsAndUnpaidAccounts(
      tx,
      and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, id)),
    );
    await tx.delete(eggSalesItems).where(eq(eggSalesItems.saleId, id));
    await tx.delete(eggSales).where(eq(eggSales.id, id));
  });
  return NextResponse.json({ ok: true });
});
