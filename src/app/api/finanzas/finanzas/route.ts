import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { transactions, feedInventory, feedMovements, accountsPayable, payments, purchaseProducts } from "@/db/schema";
import { eq, desc, sql, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { deleteTransactionsAndUnpaidAccounts } from "@/lib/financial-records";

export const dynamic = "force-dynamic";


export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "30";

  const periodDays = Number(period);
  if (!Number.isSafeInteger(periodDays) || periodDays < 1 || periodDays > 3660) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  }

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - (periodDays - 1));
  const dateStr = daysAgo.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];
  const periodFilter = and(gte(transactions.date, dateStr), lte(transactions.date, todayStr));

  const [data, summary, byCategory, paymentRows] = await Promise.all([
    db.select().from(transactions).where(periodFilter).orderBy(desc(transactions.date)),
    db.select({
      type: transactions.type,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
      count: sql<number>`count(*)::int`,
    }).from(transactions).where(periodFilter).groupBy(transactions.type),
    db.select({
      type: transactions.type,
      category: transactions.category,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
    }).from(transactions).where(periodFilter).groupBy(transactions.type, transactions.category).orderBy(sql`sum(${transactions.amount}) desc`),
    db.select().from(payments).where(and(gte(payments.date, dateStr), lte(payments.date, todayStr))),
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

  const series = buildSeries(data, periodDays);
  const kpis = computeKpis(data, periodDays);
  const cashflowRows = [
    ...data.filter((transaction) => !transaction.isCredit),
    ...paymentRows.filter((payment) => payment.type === "cobro" || payment.type === "pago").map((payment) => ({
      date: payment.date,
      type: payment.type === "cobro" ? "ingreso" : "egreso",
      amount: payment.amount,
    })),
  ];
  const cashflow = {
    series: buildSeries(cashflowRows, periodDays),
    kpis: computeKpis(cashflowRows, periodDays),
  };

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
    cashflow,
  });
});

function resolveAmount(body: any): string {
  if (body.amount !== undefined && body.amount !== null && body.amount !== "") {
    const amount = Number(body.amount);
    return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : "";
  }
  // Presentation-based: presentations × pricePerPresentation
  if (body.presentations !== undefined || body.pricePerPresentation !== undefined) {
    const presentations = Number(body.presentations);
    const price = Number(body.pricePerPresentation);
    const amount = presentations * price;
    return Number.isFinite(amount) && presentations > 0 && price > 0 && amount > 0 ? amount.toFixed(2) : "";
  }
  const quantity = Number(body.quantity);
  const unitPrice = Number(body.unitPrice);
  const amount = quantity * unitPrice;
  if (Number.isFinite(amount) && quantity > 0 && unitPrice > 0 && amount > 0) {
    return amount.toFixed(2);
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

  // The selected period is the denominator; using only movement days inflated
  // daily averages and monthly projections whenever activity was sparse.
  const avgDailyIncome = periodDays > 0 ? totalIncome / periodDays : 0;
  const avgDailyExpense = periodDays > 0 ? totalExpense / periodDays : 0;
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

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (body.type !== undefined && body.type !== "ingreso" && body.type !== "egreso") {
    return NextResponse.json({ error: "Tipo de transacción inválido" }, { status: 400 });
  }
  if (body.isCredit !== undefined && typeof body.isCredit !== "boolean") {
    return NextResponse.json({ error: "Indicador de crédito inválido" }, { status: 400 });
  }
  if (body.isCredit && body.dueDate && !isDateOnly(body.dueDate)) {
    return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
  }
  const amount = resolveAmount(body);
  if (!amount) {
    return NextResponse.json({ error: "Defina el monto o cantidad y valor unitario" }, { status: 400 });
  }

  // Determine if this is a purchase with presentation data
  const hasPresentationInputs = [body.presentations, body.pricePerPresentation]
    .some((value) => value !== undefined && value !== null && value !== "");
  const isPresentationPurchase = hasPresentationInputs;
  const isFeedPurchaseCategory = body.category === "Compra de alimento";
  if (isFeedPurchaseCategory && !body.feedId) {
    return NextResponse.json({ error: "Selecciona el alimento que se compró" }, { status: 400 });
  }
  const isFeedPurchase = isFeedPurchaseCategory && Boolean(body.feedId);
  if (isFeedPurchase && (body.type || "egreso") !== "egreso") {
    return NextResponse.json({ error: "La compra de alimento debe registrarse como egreso" }, { status: 400 });
  }
  if (isFeedPurchase && body.date > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "No se pueden registrar compras de alimento con fecha futura" }, { status: 400 });
  }

  if (isPresentationPurchase) {
    const presentations = Number(body.presentations);
    const factor = Number(body.factor);
    const pricePerPresentation = Number(body.pricePerPresentation);
    if (!Number.isFinite(presentations) || presentations <= 0 || !Number.isFinite(factor) || factor <= 0 || !Number.isFinite(pricePerPresentation) || pricePerPresentation <= 0) {
      return NextResponse.json({ error: "Presentaciones, contenido y precio deben ser mayores a 0" }, { status: 400 });
    }
    const quantityInBaseUnit = presentations * factor; // ej: 2 bultos × 25 kg = 50 kg
    if (!Number.isFinite(quantityInBaseUnit)) {
      return NextResponse.json({ error: "Cantidad total inválida" }, { status: 400 });
    }
    const unitPricePerBaseUnit = pricePerPresentation / factor; // ej: $95,000 / 25 = $3,800/kg
    const presentationAmount = (presentations * pricePerPresentation).toFixed(2);
    if (Math.abs(Number(amount) - Number(presentationAmount)) > 0.01) {
      return NextResponse.json({ error: "El monto no coincide con las presentaciones y su precio" }, { status: 400 });
    }

    if (isFeedPurchase) {
      // Use DB transaction for atomicity
      const result = await db.transaction(async (tx) => {
        // 1. Validate feed exists inside transaction
        const [feed] = await tx.select().from(feedInventory).where(eq(feedInventory.id, body.feedId)).for("update");
        if (!feed) {
          throw new Error("Alimento no encontrado");
        }

        // 2. Insert financial transaction
        const [created] = await tx.insert(transactions).values({
          date: body.date,
          type: body.type || "egreso",
          category: body.category,
          description: body.description,
          counterparty: body.counterparty || null,
          amount: presentationAmount,
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

        // 4. Update stock and recalculate average cost using relative SQL
        const oldStock = Number(feed.currentStock);
        const oldCostPerUnit = Number(feed.costPerUnit);
        const oldTotalValue = oldStock * oldCostPerUnit;
        const newTotalValue = quantityInBaseUnit * unitPricePerBaseUnit;
        const avgCostPerUnit = (oldTotalValue + newTotalValue) / (oldStock + quantityInBaseUnit);

        await tx.update(feedInventory).set({
          currentStock: sql`(${feedInventory.currentStock}::numeric + ${quantityInBaseUnit})`,
          costPerUnit: avgCostPerUnit.toFixed(2),
          updatedAt: new Date(),
        }).where(eq(feedInventory.id, body.feedId));

        // 4. Link transaction to movement
        await tx.update(transactions).set({
          sourceId: movement.id,
        }).where(eq(transactions.id, created.id));

        // 5. If credit, mark transaction and create accounts payable
        if (body.isCredit && (body.type || "egreso") === "egreso") {
          await tx.update(transactions).set({ isCredit: true }).where(eq(transactions.id, created.id));
          await tx.insert(accountsPayable).values({
            transactionId: created.id,
            supplier: body.counterparty || body.description || "Sin nombre",
            totalAmount: presentationAmount,
            paidAmount: "0",
            pendingAmount: presentationAmount,
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
        amount: presentationAmount,
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
          totalAmount: presentationAmount,
          paidAmount: "0",
          pendingAmount: presentationAmount,
          dueDate: body.dueDate || null,
          status: "pendiente",
        });
      }

      if (body.purchaseProductId) {
        const [product] = await tx.select({ id: purchaseProducts.id }).from(purchaseProducts)
          .where(eq(purchaseProducts.id, body.purchaseProductId)).for("update");
        if (!product) throw new Error("Producto de compra no encontrado");
        await tx.update(purchaseProducts).set({
          lastPricePerPresentation: pricePerPresentation.toFixed(2),
          defaultSupplier: body.counterparty || null,
          updatedAt: new Date(),
        }).where(eq(purchaseProducts.id, product.id));
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
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }
  const amount = resolveAmount(body);
  if (!amount) {
    return NextResponse.json({ error: "Defina el monto o cantidad y valor unitario" }, { status: 400 });
  }
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (body.type !== undefined && body.type !== "ingreso" && body.type !== "egreso") {
    return NextResponse.json({ error: "Tipo de transacción inválido" }, { status: 400 });
  }
  if (body.dueDate && !isDateOnly(body.dueDate)) return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });

  const [existing] = await db.select().from(transactions).where(eq(transactions.id, body.id));
  if (!existing) {
    return NextResponse.json({ error: "Transacción no encontrada" }, { status: 404 });
  }
  if ((existing.sourceType || existing.sourceId) && !(existing.sourceType === "alimento" && existing.sourceId)) {
    return NextResponse.json({ error: "Esta transacción vinculada debe editarse desde el módulo que la creó" }, { status: 409 });
  }

  const isPresentationPurchase = [body.presentations, body.pricePerPresentation]
    .some((value) => value !== undefined && value !== null && value !== "");

  let quantityValue: string | null = body.quantity || null;
  let unitPriceValue: string | null = body.unitPrice || null;
  let unitValue: string | null = body.unit || null;

  if (isPresentationPurchase) {
    const presentations = Number(body.presentations);
    const factor = Number(body.factor);
    const pricePerPresentation = Number(body.pricePerPresentation);
    if (!Number.isFinite(presentations) || presentations <= 0 || !Number.isFinite(factor) || factor <= 0 || !Number.isFinite(pricePerPresentation) || pricePerPresentation <= 0) {
      return NextResponse.json({ error: "Presentaciones, contenido y precio deben ser mayores a 0" }, { status: 400 });
    }
    const quantityInBaseUnit = presentations * factor;
    if (!Number.isFinite(quantityInBaseUnit)) return NextResponse.json({ error: "Cantidad total inválida" }, { status: 400 });
    const unitPricePerBaseUnit = pricePerPresentation / factor;
    const presentationAmount = (presentations * pricePerPresentation).toFixed(2);
    if (Math.abs(Number(amount) - Number(presentationAmount)) > 0.01) {
      return NextResponse.json({ error: "El monto no coincide con las presentaciones y su precio" }, { status: 400 });
    }
    quantityValue = String(quantityInBaseUnit);
    unitPriceValue = String(unitPricePerBaseUnit);
  }

  if (existing.sourceType === "alimento" && existing.sourceId) {
    if ((body.type ?? existing.type) !== "egreso" || (body.category ?? existing.category) !== "Compra de alimento") {
      return NextResponse.json({ error: "Una compra de alimento debe conservar su tipo y categoría" }, { status: 400 });
    }
    if (unitValue && existing.unit && unitValue !== existing.unit) {
      return NextResponse.json({ error: "La unidad de una compra vinculada no se puede cambiar" }, { status: 400 });
    }
    unitValue = existing.unit;
    if (!Number.isFinite(Number(quantityValue)) || Number(quantityValue) <= 0 || !Number.isFinite(Number(unitPriceValue)) || Number(unitPriceValue) <= 0) {
      return NextResponse.json({ error: "La cantidad y el precio de una compra vinculada deben ser mayores que cero" }, { status: 400 });
    }
    const quantityChanged = Number(quantityValue) !== Number(existing.quantity);
    const unitPriceChanged = Number(unitPriceValue) !== Number(existing.unitPrice);
    if (!quantityChanged && !unitPriceChanged && Number(amount) !== Number(existing.amount)) {
      return NextResponse.json({ error: "El monto debe coincidir con la cantidad y el precio unitario" }, { status: 400 });
    }
    if (quantityChanged || unitPriceChanged) {
      const expectedAmount = (Number(quantityValue) * Number(unitPriceValue)).toFixed(2);
      if (Number(amount).toFixed(2) !== expectedAmount) {
        return NextResponse.json({ error: "El monto debe coincidir con la cantidad y el precio unitario" }, { status: 400 });
      }
    }
    if (body.date > new Date().toISOString().slice(0, 10)) {
      return NextResponse.json({ error: "No se pueden registrar compras de alimento en una fecha futura" }, { status: 400 });
    }
  }

  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(transactions).where(eq(transactions.id, body.id)).for("update");
    if (!current) throw new Error("Transacción no encontrada");
    if ((current.sourceType || current.sourceId) && !(current.sourceType === "alimento" && current.sourceId)) {
      throw new Error("Transacción vinculada: debe editarse desde el módulo que la creó");
    }
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
    if (!updated) throw new Error("Transacción no encontrada");

    if (current.sourceType === "alimento" && current.sourceId) {
      const newQty = Number(quantityValue);
      const [movement] = await tx.select().from(feedMovements)
        .where(eq(feedMovements.id, current.sourceId)).for("update");
      if (!movement || !movement.isEntry) throw new Error("Movimiento de compra de alimento no encontrado");
      const [feed] = await tx.select().from(feedInventory).where(eq(feedInventory.id, movement.feedId)).for("update");
      if (!feed) throw new Error("Alimento no encontrado");

      const delta = newQty - Number(movement.quantity);
      if (delta < 0 && Number(feed.currentStock) + 0.0001 < Math.abs(delta)) {
        throw new Error("No se puede reducir la compra de alimento por debajo de lo ya consumido");
      }
      await tx.update(feedInventory).set({
        currentStock: sql`(${feedInventory.currentStock}::numeric + ${delta})`,
        updatedAt: new Date(),
      }).where(eq(feedInventory.id, movement.feedId));
      await tx.update(feedMovements).set({ quantity: String(newQty), date: body.date })
        .where(eq(feedMovements.id, movement.id));
    }

    const wantsCredit = body.isCredit !== undefined
      ? Boolean(body.isCredit)
      : current.isCredit && updated.type === "egreso";
    if (wantsCredit && updated.type !== "egreso") {
      throw new Error("Una cuenta por pagar solo puede vincularse a un egreso");
    }
    const [payable] = await tx.select().from(accountsPayable).where(eq(accountsPayable.transactionId, updated.id)).for("update");
    if (wantsCredit) {
      const paidAmount = Number(payable?.paidAmount || 0);
      if (Number(amount) < paidAmount) throw new Error("El total no puede quedar por debajo de los pagos ya registrados");
      const pendingAmount = Number(amount) - paidAmount;
      await tx.update(transactions).set({ isCredit: true }).where(eq(transactions.id, updated.id));
      if (payable) {
        await tx.update(accountsPayable).set({
          supplier: body.counterparty || payable.supplier,
          totalAmount: amount,
          paidAmount: String(paidAmount),
          pendingAmount: pendingAmount.toFixed(2),
          dueDate: body.dueDate !== undefined ? body.dueDate || null : payable.dueDate,
          status: pendingAmount === 0 ? "pagado" : paidAmount > 0 ? "parcial" : "pendiente",
          updatedAt: new Date(),
        }).where(eq(accountsPayable.id, payable.id));
      } else {
        await tx.insert(accountsPayable).values({
          transactionId: updated.id,
          supplier: body.counterparty || body.description || "Sin nombre",
          totalAmount: amount,
          paidAmount: "0",
          pendingAmount: amount,
          dueDate: body.dueDate || null,
          status: "pendiente",
        });
      }
    } else {
      if (payable) {
        const linkedPayments = await tx.select({ id: payments.id }).from(payments).where(eq(payments.payableId, payable.id));
        if (Number(payable.paidAmount) > 0 || linkedPayments.length > 0) {
          throw new Error("No se puede eliminar una cuenta por pagar con pagos registrados");
        }
        await tx.delete(accountsPayable).where(eq(accountsPayable.id, payable.id));
      }
      await tx.update(transactions).set({ isCredit: false }).where(eq(transactions.id, updated.id));
    }

    return updated;
  });

  return NextResponse.json(result);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [existing] = await db.select().from(transactions).where(eq(transactions.id, id));
  if (!existing) return NextResponse.json({ error: "Transacción no encontrada" }, { status: 404 });
  if (existing.sourceType || existing.sourceId) {
    return NextResponse.json({ error: "Esta transacción vinculada debe eliminarse desde el módulo que la creó" }, { status: 409 });
  }

  await db.transaction(async (tx) => {
    const [record] = await tx.select().from(transactions).where(eq(transactions.id, id)).for("update");
    if (record && (record.sourceType || record.sourceId)) {
      throw new Error("Transacción vinculada: debe eliminarse desde el módulo que la creó");
    }
    await deleteTransactionsAndUnpaidAccounts(tx, eq(transactions.id, id));
  });

  return NextResponse.json({ ok: true });
});
