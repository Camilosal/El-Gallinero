import { db } from "@/db";
import { transactions, feedInventory, feedMovements, accountsPayable } from "@/db/schema";
import { eq, desc, sql, gte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "30";

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - parseInt(period));
  const dateStr = daysAgo.toISOString().split("T")[0];

  const [data, summary, byCategory] = await Promise.all([
    db.select().from(transactions).where(gte(transactions.date, dateStr)).orderBy(desc(transactions.date)),
    db.select({
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(transactions).where(gte(transactions.date, dateStr)).groupBy(transactions.type),
    db.select({
      type: transactions.type,
      category: transactions.category,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
    }).from(transactions).where(gte(transactions.date, dateStr)).groupBy(transactions.type, transactions.category).orderBy(sql`sum(${transactions.amount}) desc`),
  ]);

  // Enriquecer compras de alimento con el feedId del movimiento vinculado (para pre-llenar edición)
  const enriched = await Promise.all(
    data.map(async (t) => {
      if (t.sourceType === "alimento" && t.sourceId) {
        const [mov] = await db.select({ feedId: feedMovements.feedId }).from(feedMovements).where(eq(feedMovements.id, t.sourceId));
        if (mov) return { ...t, feedId: mov.feedId };
      }
      return t;
    })
  );

  const income = summary.find((s) => s.type === "ingreso")?.total || "0";
  const expenses = summary.find((s) => s.type === "egreso")?.total || "0";

  const series = buildSeries(data, parseInt(period));
  const kpis = computeKpis(data, parseInt(period));

  return NextResponse.json({
    transactions: enriched,
    summary: {
      income,
      expenses,
      profit: (parseFloat(income) - parseFloat(expenses)).toFixed(2),
    },
    byCategory,
    series,
    kpis,
  });
}

function resolveAmount(body: any): string {
  if (body.amount) return String(body.amount);
  // Presentation-based: presentations × pricePerPresentation
  if (body.presentations && Number(body.pricePerPresentation) >= 0) {
    return (Number(body.presentations) * Number(body.pricePerPresentation)).toFixed(2);
  }
  if (Number(body.quantity) > 0 && Number(body.unitPrice) > 0) {
    return (Number(body.quantity) * Number(body.unitPrice)).toFixed(2);
  }
  return "";
}

interface SeriesPoint {
  label: string;
  date: string;
  income: number;
  expense: number;
  profit: number;
  cumulative: number;
}

// Serie temporal agrupada por día (≤30 días), semana (≤90) o mes (365)
function buildSeries(txs: any[], periodDays: number): SeriesPoint[] {
  const daily = new Map<string, { income: number; expense: number }>();
  for (const t of txs) {
    const cur = daily.get(t.date) || { income: 0, expense: 0 };
    if (t.type === "ingreso") cur.income += Number(t.amount);
    else cur.expense += Number(t.amount);
    daily.set(t.date, cur);
  }

  const bucketKey = (dateStr: string): string => {
    if (periodDays <= 30) return dateStr;
    if (periodDays <= 90) {
      const d = new Date(dateStr + "T12:00:00");
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return monday.toISOString().split("T")[0];
    }
    return dateStr.slice(0, 7);
  };

  const buckets = new Map<string, { income: number; expense: number }>();
  for (const [date, v] of daily) {
    const key = bucketKey(date);
    const b = buckets.get(key) || { income: 0, expense: 0 };
    b.income += v.income;
    b.expense += v.expense;
    buckets.set(key, b);
  }

  const label = (k: string): string => {
    if (periodDays <= 30) return new Date(k + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" });
    if (periodDays <= 90) return `Sem ${new Date(k + "T12:00:00").toLocaleDateString("es", { day: "2-digit", month: "short" })}`;
    return new Date(k + "-01T12:00:00").toLocaleDateString("es", { month: "short", year: "2-digit" });
  };

  let cumulative = 0;
  return Array.from(buckets.keys()).sort().map((k) => {
    const b = buckets.get(k)!;
    const profit = b.income - b.expense;
    cumulative += profit;
    return { label: label(k), date: k, income: b.income, expense: b.expense, profit, cumulative };
  });
}

interface Kpis {
  totalIncome: number;
  totalExpense: number;
  profit: number;
  margin: number;
  expenseRatio: number;
  activeDays: number;
  avgDailyIncome: number;
  avgDailyExpense: number;
  avgDailyNet: number;
  projectedMonthly: number;
  bestDay: { date: string; profit: number } | null;
  worstDay: { date: string; profit: number } | null;
}

function computeKpis(txs: any[], periodDays: number): Kpis {
  const dailyNet = new Map<string, number>();
  for (const t of txs) {
    dailyNet.set(t.date, (dailyNet.get(t.date) || 0) + (t.type === "ingreso" ? Number(t.amount) : -Number(t.amount)));
  }

  const totalIncome = txs.filter((t) => t.type === "ingreso").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = txs.filter((t) => t.type === "egreso").reduce((s, t) => s + Number(t.amount), 0);
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? profit / totalIncome : 0;
  const activeDays = dailyNet.size;

  const avgDailyIncome = activeDays > 0 ? totalIncome / activeDays : 0;
  const avgDailyExpense = activeDays > 0 ? totalExpense / activeDays : 0;
  const avgDailyNet = avgDailyIncome - avgDailyExpense;
  const projectedMonthly = avgDailyNet * 30;

  let best = { date: "", profit: -Infinity };
  let worst = { date: "", profit: Infinity };
  for (const [date, net] of dailyNet) {
    if (net > best.profit) best = { date, profit: net };
    if (net < worst.profit) worst = { date, profit: net };
  }

  return {
    totalIncome,
    totalExpense,
    profit,
    margin,
    expenseRatio: totalIncome > 0 ? totalExpense / totalIncome : 0,
    activeDays,
    avgDailyIncome,
    avgDailyExpense,
    avgDailyNet,
    projectedMonthly,
    bestDay: best.profit === -Infinity ? null : best,
    worstDay: worst.profit === Infinity ? null : worst,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const amount = resolveAmount(body);
  if (!amount) {
    return NextResponse.json({ error: "Defina el monto o cantidad y valor unitario" }, { status: 400 });
  }

  // Determine if this is a purchase with presentation data
  const isPresentationPurchase = body.presentations && body.factor && body.pricePerPresentation != null;
  const isFeedPurchase = body.category === "Compra de alimento" && body.feedId;

  if (isPresentationPurchase) {
    const presentations = Number(body.presentations);
    const factor = Number(body.factor);
    const pricePerPresentation = Number(body.pricePerPresentation);
    const quantityInBaseUnit = presentations * factor; // ej: 2 bultos × 25 kg = 50 kg
    const unitPricePerBaseUnit = factor > 0 ? pricePerPresentation / factor : 0; // ej: $95,000 / 25 = $3,800/kg

    if (isFeedPurchase) {
      // Validate feed exists
      const [feed] = await db.select().from(feedInventory).where(eq(feedInventory.id, body.feedId));
      if (!feed) {
        return NextResponse.json({ error: "Alimento no encontrado" }, { status: 404 });
      }

      // Use DB transaction for atomicity
      const result = await db.transaction(async (tx) => {
        // 1. Insert financial transaction
        const [created] = await tx.insert(transactions).values({
          date: body.date,
          type: body.type || "egreso",
          category: body.category,
          description: body.description,
          counterparty: body.counterparty || null,
          amount,
          quantity: String(quantityInBaseUnit),
          unitPrice: String(unitPricePerBaseUnit),
          unit: feed.unit,
          presentation: body.presentation || null,
          notes: body.notes || null,
          sourceType: "alimento",
        }).returning();

        // 2. Insert feed movement (entry)
        const [movement] = await tx.insert(feedMovements).values({
          feedId: body.feedId,
          quantity: String(quantityInBaseUnit),
          isEntry: true,
          movementType: "compra",
          date: body.date,
          notes: body.notes || `Compra de ${body.description}`,
        }).returning();

        // 3. Update stock and recalculate average cost
        const oldStock = Number(feed.currentStock);
        const oldCostPerUnit = Number(feed.costPerUnit);
        const oldTotalValue = oldStock * oldCostPerUnit;
        const newTotalValue = quantityInBaseUnit * unitPricePerBaseUnit;
        const avgCostPerUnit = (oldTotalValue + newTotalValue) / (oldStock + quantityInBaseUnit);

        await tx.update(feedInventory).set({
          currentStock: String(oldStock + quantityInBaseUnit),
          costPerUnit: avgCostPerUnit.toFixed(2),
          updatedAt: new Date(),
        }).where(eq(feedInventory.id, body.feedId));

        // 4. Link transaction to movement
        await tx.update(transactions).set({
          sourceId: movement.id,
        }).where(eq(transactions.id, created.id));

        // 5. If credit, mark transaction and create accounts payable
        if (body.isCredit) {
          await tx.update(transactions).set({ isCredit: true }).where(eq(transactions.id, created.id));
          await tx.insert(accountsPayable).values({
            transactionId: created.id,
            supplier: body.counterparty || body.description || "Sin nombre",
            totalAmount: String(amount),
            paidAmount: "0",
            pendingAmount: String(amount),
            dueDate: body.dueDate || null,
            status: "pendiente",
          });
        }

        return created;
      });

      return NextResponse.json(result, { status: 201 });
    }

    // Non-feed purchase with presentation — just save the transaction
    const result = await db.transaction(async (tx) => {
      const [created] = await tx.insert(transactions).values({
        date: body.date,
        type: body.type || "egreso",
        category: body.category,
        description: body.description,
        counterparty: body.counterparty || null,
        amount,
        quantity: String(quantityInBaseUnit),
        unitPrice: String(unitPricePerBaseUnit),
        unit: body.unit || null,
        presentation: body.presentation || null,
        notes: body.notes || null,
      }).returning();

      if (body.isCredit && (body.type || "egreso") === "egreso") {
        await tx.update(transactions).set({ isCredit: true }).where(eq(transactions.id, created.id));
        await tx.insert(accountsPayable).values({
          transactionId: created.id,
          supplier: body.counterparty || body.description || "Sin nombre",
          totalAmount: String(amount),
          paidAmount: "0",
          pendingAmount: String(amount),
          dueDate: body.dueDate || null,
          status: "pendiente",
        });
      }

      return created;
    });

    return NextResponse.json(result, { status: 201 });
  }

  // Legacy path: no presentation data
  const result = await db.transaction(async (tx) => {
    const [created] = await tx.insert(transactions).values({
      date: body.date,
      type: body.type,
      category: body.category,
      description: body.description,
      counterparty: body.counterparty || null,
      amount,
      quantity: body.quantity || null,
      unitPrice: body.unitPrice || null,
      unit: body.unit || null,
      presentation: body.presentation || null,
      notes: body.notes || null,
    }).returning();

    if (body.isCredit && (body.type || "egreso") === "egreso") {
      await tx.update(transactions).set({ isCredit: true }).where(eq(transactions.id, created.id));
      await tx.insert(accountsPayable).values({
        transactionId: created.id,
        supplier: body.counterparty || body.description || "Sin nombre",
        totalAmount: String(amount),
        paidAmount: "0",
        pendingAmount: String(amount),
        dueDate: body.dueDate || null,
        status: "pendiente",
      });
    }

    return created;
  });

  return NextResponse.json(result, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }
  const amount = resolveAmount(body);
  if (!amount) {
    return NextResponse.json({ error: "Defina el monto o cantidad y valor unitario" }, { status: 400 });
  }

  const [existing] = await db.select().from(transactions).where(eq(transactions.id, body.id));
  if (!existing) {
    return NextResponse.json({ error: "Transacción no encontrada" }, { status: 404 });
  }

  const isPresentationPurchase = body.presentations && body.factor && body.pricePerPresentation != null;

  let quantityValue: string | null = body.quantity || null;
  let unitPriceValue: string | null = body.unitPrice || null;
  let unitValue: string | null = body.unit || null;

  if (isPresentationPurchase) {
    const presentations = Number(body.presentations);
    const factor = Number(body.factor);
    const pricePerPresentation = Number(body.pricePerPresentation);
    const quantityInBaseUnit = presentations * factor;
    const unitPricePerBaseUnit = factor > 0 ? pricePerPresentation / factor : 0;
    quantityValue = String(quantityInBaseUnit);
    unitPriceValue = String(unitPricePerBaseUnit);
  }

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx.update(transactions).set({
      date: body.date,
      type: body.type,
      category: body.category,
      description: body.description,
      counterparty: body.counterparty || null,
      amount,
      quantity: quantityValue,
      unitPrice: unitPriceValue,
      unit: unitValue,
      presentation: body.presentation || null,
      notes: body.notes || null,
    }).where(eq(transactions.id, body.id)).returning();

    // Si la transacción está vinculada a un movimiento de alimento, sincronizar el stock
    // con la nueva cantidad (el vínculo al alimento original se mantiene)
    if (existing.sourceType === "alimento" && existing.sourceId) {
      const newQty = Number(quantityValue);
      const oldQty = Number(existing.quantity);
      if (!isNaN(newQty) && !isNaN(oldQty) && newQty !== oldQty) {
        const [mov] = await tx.select().from(feedMovements).where(eq(feedMovements.id, existing.sourceId));
        if (mov) {
          const delta = newQty - oldQty;
          const modifier = delta >= 0 ? "+" : "-";
          await tx.update(feedInventory).set({
            currentStock: sql`greatest(0, (${feedInventory.currentStock}::numeric ${sql.raw(modifier)} ${Math.abs(delta)}))`,
            updatedAt: new Date(),
          }).where(eq(feedInventory.id, mov.feedId));
          await tx.update(feedMovements).set({ quantity: String(newQty), date: body.date }).where(eq(feedMovements.id, mov.id));
        }
      }
    }

    return updated;
  });

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // If this transaction is linked to a feed movement, reverse the stock change
  await db.transaction(async (tx) => {
    const [record] = await tx.select().from(transactions).where(eq(transactions.id, id));
    if (record && record.sourceType === "alimento" && record.sourceId) {
      const [mov] = await tx.select().from(feedMovements).where(eq(feedMovements.id, record.sourceId));
      if (mov) {
        const modifier = mov.isEntry ? "-" : "+";
        await tx.update(feedInventory).set({
          currentStock: sql`(${feedInventory.currentStock}::numeric ${sql.raw(modifier)} ${Number(mov.quantity)})`,
          updatedAt: new Date(),
        }).where(eq(feedInventory.id, mov.feedId));
        await tx.delete(feedMovements).where(eq(feedMovements.id, mov.id));
      }
    }

    await tx.delete(transactions).where(eq(transactions.id, id));
  });

  return NextResponse.json({ ok: true });
}
