import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { chickenSales, transactions, hens, roosters, broilerBatches, slaughter, mortalityRecords, accountsReceivable, payments } from "@/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import {
  captureAnimalExitSnapshots,
  validateRoosterForExit, validateBatchForExit,
  applyRoosterExit, restoreHenExit, restoreRoosterExit, applyBatchExit, restoreBatchExit,
} from "@/lib/birdExit";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { deleteTransactionsAndUnpaidAccounts } from "@/lib/financial-records";

export const dynamic = "force-dynamic";


function normalizeSaleReferences(body: Record<string, any>): string | null {
  for (const key of ["henId", "roosterId", "batchId"]) {
    const value = body[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string" || !value.trim()) return "Referencia de ave inválida";
    body[key] = value.trim();
  }

  const references = [body.henId, body.roosterId, body.batchId].filter(Boolean);
  if (references.length !== 1) {
    return "Seleccione exactamente una gallina, un gallo o un lote";
  }
  return null;
}

function validateSaleValues(body: Record<string, any>, qty: number, priceMode: string, weightKg: number | null): string | null {
  if (!Number.isSafeInteger(qty) || qty < 1) return "Cantidad inválida";
  if ((body.henId || body.roosterId) && qty !== 1) {
    return "La venta de una gallina o un gallo debe tener cantidad 1";
  }
  if (priceMode !== "por_ave" && priceMode !== "por_kg") return "Modo de precio inválido";
  if (body.weightKg !== undefined && body.weightKg !== null && body.weightKg !== "" && (!Number.isFinite(weightKg) || Number(weightKg) <= 0)) {
    return "Peso inválido";
  }
  if (priceMode === "por_kg" && (!weightKg || weightKg <= 0)) {
    return "El peso es obligatorio para ventas por kilogramo";
  }
  if (body.henId && body.birdType !== "gallina_descarte") return "El tipo de ave debe ser gallina descarte";
  if (body.roosterId && body.birdType !== "gallo") return "El tipo de ave debe ser gallo";
  if (body.batchId && body.birdType !== "pollo" && body.birdType !== "pollito") return "El tipo de ave debe ser pollo o pollito";
  return null;
}

// GET /api/finanzas/finanzas/ventas-aves
export const GET = withApiHandler(async () => {
  const data = await db.select().from(chickenSales).orderBy(desc(chickenSales.date)).limit(100);
  if (data.length === 0) return NextResponse.json([]);
  const linkedTransactions = await db.select().from(transactions).where(and(
    eq(transactions.sourceType, "venta_ave"),
    inArray(transactions.sourceId, data.map((sale) => sale.id)),
  ));
  const transactionsBySale = new Map(linkedTransactions.map((transaction) => [transaction.sourceId, transaction]));
  const txIds = linkedTransactions.map((transaction) => transaction.id);
  const receivables = txIds.length
    ? await db.select().from(accountsReceivable).where(inArray(accountsReceivable.transactionId, txIds))
    : [];
  const receivableByTransaction = new Map(receivables.map((account) => [account.transactionId, account]));

  const enriched = await Promise.all(
    data.map(async (record) => {
      const transaction = transactionsBySale.get(record.id);
      const receivable = transaction ? receivableByTransaction.get(transaction.id) : undefined;
      const [hen] = record.henId
        ? await db.select().from(hens).where(eq(hens.id, record.henId))
        : [undefined];
      const [rooster] = record.roosterId
        ? await db.select().from(roosters).where(eq(roosters.id, record.roosterId))
        : [undefined];
      const [batch] = record.batchId
        ? await db.select().from(broilerBatches).where(eq(broilerBatches.id, record.batchId))
        : [undefined];
      return {
        ...record,
        isCredit: Boolean(transaction?.isCredit),
        dueDate: receivable?.dueDate || null,
        hen: hen || null,
        rooster: rooster || null,
        batch: batch || null,
      };
    })
  );

  return NextResponse.json(enriched);
});

// POST /api/finanzas/finanzas/ventas-aves
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const qty = Number(body.quantity);
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (typeof body.birdType !== "string" || !body.birdType.trim()) return NextResponse.json({ error: "Tipo de ave requerido" }, { status: 400 });
  body.birdType = body.birdType.trim();
  const referenceError = normalizeSaleReferences(body);
  if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });

  const pricePerUnit = Number(body.pricePerUnit);
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  if (body.isCredit && body.dueDate && !isDateOnly(body.dueDate)) return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
  const priceMode = body.priceMode || "por_ave";
  const weightKg = body.weightKg !== undefined && body.weightKg !== null && body.weightKg !== "" ? Number(body.weightKg) : null;
  const valuesError = validateSaleValues(body, qty, priceMode, weightKg);
  if (valuesError) return NextResponse.json({ error: valuesError }, { status: 400 });

  if (body.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para venta (estado: ${hen.status})` }, { status: 400 });
    }
  }

  if (body.roosterId) {
    const err = await validateRoosterForExit(body.roosterId);
    if (err) return NextResponse.json({ error: err }, { status: err === "Gallo no encontrado" ? 404 : 400 });
  }

  if (body.batchId) {
    const err = await validateBatchForExit(body.batchId, qty);
    if (err) return NextResponse.json({ error: err }, { status: err === "Lote no encontrado" ? 404 : 400 });
  }

  const totalAmount = priceMode === "por_kg" && weightKg
    ? (pricePerUnit * weightKg).toFixed(2)
    : (pricePerUnit * qty).toFixed(2);

  const created = await db.transaction(async (tx) => {
    if (body.henId) {
      const [hen] = await tx.select().from(hens).where(eq(hens.id, body.henId)).for("update");
      if (!hen) throw new Error("Gallina no encontrada");
      if (!isAvailableForExit(hen.status)) throw new Error(`La gallina no está disponible para venta (estado: ${hen.status})`);
    }
    if (body.roosterId) {
      const error = await validateRoosterForExit(body.roosterId, tx);
      if (error) throw new Error(error);
    }
    if (body.batchId) {
      const error = await validateBatchForExit(body.batchId, qty, tx);
      if (error) throw new Error(error);
    }

    const previousAnimalStates = await captureAnimalExitSnapshots(tx, {
      henId: body.henId,
      roosterId: body.roosterId,
      batchId: body.batchId,
    });

    const [inserted] = await tx.insert(chickenSales).values({
      date: body.date,
      birdType: body.birdType,
      quantity: qty,
      weightKg: weightKg ? String(weightKg) : null,
      pricePerUnit: String(pricePerUnit),
      priceMode,
      totalAmount,
      buyer: body.buyer || null,
      presentation: body.presentation || null,
      henId: body.henId || null,
      roosterId: body.roosterId || null,
      batchId: body.batchId || null,
      previousAnimalStates,
      notes: body.notes || null,
    }).returning();

    if (body.henId) {
      await tx.update(hens).set({ status: "vendida" }).where(eq(hens.id, body.henId));
    }

    const birdLabel = body.birdType.replace(/_/g, " ");
    const weightDesc = weightKg ? ` (${weightKg} kg)` : "";
    const [transaction] = await tx.insert(transactions).values({
      date: body.date,
      type: "ingreso",
      category: "Venta de aves",
      description: `Venta de ${qty} ${birdLabel}${weightDesc}${body.buyer ? ` a ${body.buyer}` : ""}`,
      amount: totalAmount,
      quantity: String(qty),
      unitPrice: String(pricePerUnit),
      unit: priceMode === "por_kg" ? "kg" : "aves",
      counterparty: body.buyer || null,
      sourceType: "venta_ave",
      sourceId: inserted.id,
    }).returning();

    if (body.isCredit) {
      await tx.update(transactions).set({ isCredit: true }).where(eq(transactions.id, transaction.id));
      await tx.insert(accountsReceivable).values({
        transactionId: transaction.id,
        buyer: body.buyer || "Sin nombre",
        totalAmount,
        paidAmount: "0",
        pendingAmount: totalAmount,
        dueDate: body.dueDate || null,
        status: "pendiente",
      });
    }

    if (body.roosterId) {
      await applyRoosterExit(body.roosterId, "venta", tx);
    }
    if (body.batchId) {
      await applyBatchExit(body.batchId, qty, "venta", tx);
    }

    return inserted;
  });

  return NextResponse.json(created, { status: 201 });
});

// PUT /api/finanzas/finanzas/ventas-aves
export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const qty = Number(body.quantity);
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (typeof body.birdType !== "string" || !body.birdType.trim()) return NextResponse.json({ error: "Tipo de ave requerido" }, { status: 400 });
  body.birdType = body.birdType.trim();
  const referenceError = normalizeSaleReferences(body);
  if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });

  const pricePerUnit = Number(body.pricePerUnit);
  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  if (body.isCredit && body.dueDate && !isDateOnly(body.dueDate)) return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
  const priceMode = body.priceMode || "por_ave";
  const weightKg = body.weightKg !== undefined && body.weightKg !== null && body.weightKg !== "" ? Number(body.weightKg) : null;
  const valuesError = validateSaleValues(body, qty, priceMode, weightKg);
  if (valuesError) return NextResponse.json({ error: valuesError }, { status: 400 });

  const [existing] = await db.select().from(chickenSales).where(eq(chickenSales.id, body.id));
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (body.henId && body.henId !== existing.henId) {
    const [hen] = await db.select().from(hens).where(eq(hens.id, body.henId));
    if (!hen) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });
    if (!isAvailableForExit(hen.status)) {
      return NextResponse.json({ error: `La gallina no está disponible para venta (estado: ${hen.status})` }, { status: 400 });
    }
  }

  const totalAmount = priceMode === "por_kg" && weightKg
    ? (pricePerUnit * weightKg).toFixed(2)
    : (pricePerUnit * qty).toFixed(2);

  let updated;
  try {
    updated = await db.transaction(async (tx) => {
      const [currentSale] = await tx.select().from(chickenSales).where(eq(chickenSales.id, body.id)).for("update");
      if (!currentSale) throw new Error("No encontrado");
      const previousAnimalStates = { ...(currentSale.previousAnimalStates || {}) };
      if (body.henId && body.henId !== currentSale.henId) {
        const [hen] = await tx.select().from(hens).where(eq(hens.id, body.henId)).for("update");
        if (!hen) throw new Error("Gallina no encontrada");
        if (!isAvailableForExit(hen.status)) throw new Error(`La gallina no está disponible para venta (estado: ${hen.status})`);
      }
      if (currentSale.batchId) {
        await restoreBatchExit(
          currentSale.batchId,
          currentSale.quantity,
          tx,
          previousAnimalStates[`batch:${currentSale.batchId}`],
        );
        if (currentSale.batchId !== body.batchId) delete previousAnimalStates[`batch:${currentSale.batchId}`];
      }
      if (currentSale.henId && currentSale.henId !== body.henId) {
        await tx.select({ id: hens.id }).from(hens).where(eq(hens.id, currentSale.henId)).for("update");
        const [otherSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(eq(slaughter.henId, currentSale.henId)).limit(1);
        const [otherSale] = await tx.select({ id: chickenSales.id })
          .from(chickenSales).where(and(eq(chickenSales.henId, currentSale.henId), sql`${chickenSales.id} != ${currentSale.id}`)).limit(1);
        const [otherMortality] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(eq(mortalityRecords.henId, currentSale.henId)).limit(1);
        if (!otherSlaughter && !otherSale && !otherMortality) {
          const previousStatus = previousAnimalStates[`hen:${currentSale.henId}`]?.status || "activa";
          await restoreHenExit(currentSale.henId, previousStatus, tx);
        }
        delete previousAnimalStates[`hen:${currentSale.henId}`];
      }
      if (currentSale.roosterId && currentSale.roosterId !== body.roosterId) {
        await tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.id, currentSale.roosterId)).for("update");
        const [otherSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(eq(slaughter.roosterId, currentSale.roosterId)).limit(1);
        const [otherSale] = await tx.select({ id: chickenSales.id })
          .from(chickenSales).where(and(eq(chickenSales.roosterId, currentSale.roosterId), sql`${chickenSales.id} != ${currentSale.id}`)).limit(1);
        const [otherMortality] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(eq(mortalityRecords.roosterId, currentSale.roosterId)).limit(1);
        if (!otherSlaughter && !otherSale && !otherMortality) {
          const previousStatus = previousAnimalStates[`rooster:${currentSale.roosterId}`]?.status || "activo";
          await restoreRoosterExit(currentSale.roosterId, tx, previousStatus);
        }
        delete previousAnimalStates[`rooster:${currentSale.roosterId}`];
      }
      if (body.roosterId && body.roosterId !== currentSale.roosterId) {
        const err = await validateRoosterForExit(body.roosterId, tx);
        if (err) throw new Error(err);
      }
      if (body.batchId) {
        const err = await validateBatchForExit(body.batchId, qty, tx);
        if (err) throw new Error(err);
      }
      Object.assign(previousAnimalStates, await captureAnimalExitSnapshots(tx, {
        henId: body.henId && body.henId !== currentSale.henId ? body.henId : null,
        roosterId: body.roosterId && body.roosterId !== currentSale.roosterId ? body.roosterId : null,
        batchId: body.batchId || null,
      }));

      const [sale] = await tx.update(chickenSales).set({
        date: body.date,
        birdType: body.birdType,
        quantity: qty,
        weightKg: weightKg ? String(weightKg) : null,
        pricePerUnit: String(pricePerUnit),
        priceMode,
        totalAmount,
        buyer: body.buyer || null,
        presentation: body.presentation || null,
        henId: body.henId || null,
        roosterId: body.roosterId || null,
        batchId: body.batchId || null,
        previousAnimalStates,
        notes: body.notes || null,
      }).where(eq(chickenSales.id, body.id)).returning();

      if (body.henId && body.henId !== currentSale.henId) {
        await tx.update(hens).set({ status: "vendida" }).where(eq(hens.id, body.henId));
      }

      if (body.roosterId && body.roosterId !== currentSale.roosterId) {
        await applyRoosterExit(body.roosterId, "venta", tx);
      }
      if (body.batchId) {
        await applyBatchExit(body.batchId, qty, "venta", tx);
      }

      const [existingTx] = await tx.select().from(transactions).where(and(
        eq(transactions.sourceType, "venta_ave"),
        eq(transactions.sourceId, body.id),
      ));
      const birdLabel = body.birdType.replace(/_/g, " ");
      const weightDesc = weightKg ? ` (${weightKg} kg)` : "";
      const transactionValues = {
        date: body.date,
        type: "ingreso" as const,
        category: "Venta de aves",
        description: `Venta de ${qty} ${birdLabel}${weightDesc}${body.buyer ? ` a ${body.buyer}` : ""}`,
        counterparty: body.buyer || null,
        amount: totalAmount,
        quantity: String(qty),
        unitPrice: String(pricePerUnit),
        unit: priceMode === "por_kg" ? "kg" : "aves",
        presentation: body.presentation || null,
        sourceType: "venta_ave",
        sourceId: body.id,
        notes: body.notes || null,
      };
      const [transaction] = existingTx
        ? await tx.update(transactions).set(transactionValues).where(eq(transactions.id, existingTx.id)).returning()
        : await tx.insert(transactions).values(transactionValues).returning();
      const [receivable] = await tx.select().from(accountsReceivable).where(eq(accountsReceivable.transactionId, transaction.id)).for("update");

      if (body.isCredit) {
        const paidAmount = Number(receivable?.paidAmount || 0);
        if (Number(totalAmount) < paidAmount) throw new Error("El total no puede quedar por debajo de los pagos ya recibidos");
        await tx.update(transactions).set({ isCredit: true }).where(eq(transactions.id, transaction.id));
        if (receivable) {
          const pendingAmount = Math.max(0, Number(totalAmount) - paidAmount);
          await tx.update(accountsReceivable).set({
            buyer: body.buyer || receivable.buyer,
            totalAmount,
            paidAmount: String(paidAmount),
            pendingAmount: pendingAmount.toFixed(2),
            dueDate: body.dueDate !== undefined ? body.dueDate || null : receivable.dueDate,
            status: pendingAmount === 0 ? "pagado" : paidAmount > 0 ? "parcial" : "pendiente",
            updatedAt: new Date(),
          }).where(eq(accountsReceivable.id, receivable.id));
        } else {
          await tx.insert(accountsReceivable).values({
            transactionId: transaction.id,
            buyer: body.buyer || "Sin nombre",
            totalAmount,
            paidAmount: "0",
            pendingAmount: totalAmount,
            dueDate: body.dueDate || null,
            status: "pendiente",
          });
        }
      } else {
        if (receivable) {
          const linkedPayments = await tx.select({ id: payments.id }).from(payments).where(eq(payments.receivableId, receivable.id));
          if (Number(receivable.paidAmount) > 0 || linkedPayments.length > 0) {
            throw new Error("No se puede convertir a contado una venta que ya tiene cobros recibidos");
          }
          await tx.delete(accountsReceivable).where(eq(accountsReceivable.id, receivable.id));
        }
        await tx.update(transactions).set({ isCredit: false }).where(eq(transactions.id, transaction.id));
      }

      return sale;
    });
  } catch (e: any) {
    const msg = e.message || "";
    if (msg === "Gallo no encontrado") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "Lote no encontrado" || msg.startsWith("Stock insuficiente")) return NextResponse.json({ error: msg }, { status: 400 });
    throw e;
  }

  return NextResponse.json(updated);
});

// DELETE /api/finanzas/finanzas/ventas-aves
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [record] = await db.select().from(chickenSales).where(eq(chickenSales.id, id));
  if (!record) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.transaction(async (tx) => {
    const [currentSale] = await tx.select().from(chickenSales).where(eq(chickenSales.id, id)).for("update");
    if (!currentSale) throw new Error("No encontrado");
    if (currentSale.henId) {
      await tx.select({ id: hens.id }).from(hens).where(eq(hens.id, currentSale.henId)).for("update");
      // Check no subsequent exit before restoring
      const [otherSlaughter] = await tx.select({ id: slaughter.id })
        .from(slaughter)
        .where(eq(slaughter.henId, currentSale.henId))
        .limit(1);
      const [otherSale] = await tx.select({ id: chickenSales.id })
        .from(chickenSales)
        .where(and(eq(chickenSales.henId, currentSale.henId), sql`${chickenSales.id} != ${currentSale.id}`))
        .limit(1);
      const [hasMortality] = await tx.select({ id: mortalityRecords.id })
        .from(mortalityRecords)
        .where(eq(mortalityRecords.henId, currentSale.henId))
        .limit(1);
      if (!otherSlaughter && !otherSale && !hasMortality) {
        const previousStatus = currentSale.previousAnimalStates?.[`hen:${currentSale.henId}`]?.status || "activa";
        await restoreHenExit(currentSale.henId, previousStatus, tx);
      }
    }
    if (currentSale.roosterId) {
      await tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.id, currentSale.roosterId)).for("update");
      const [otherSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(eq(slaughter.roosterId, currentSale.roosterId)).limit(1);
      const [otherSale] = await tx.select({ id: chickenSales.id })
        .from(chickenSales).where(and(eq(chickenSales.roosterId, currentSale.roosterId), sql`${chickenSales.id} != ${currentSale.id}`)).limit(1);
      const [otherMortality] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(eq(mortalityRecords.roosterId, currentSale.roosterId)).limit(1);
      if (!otherSlaughter && !otherSale && !otherMortality) {
        const previousStatus = currentSale.previousAnimalStates?.[`rooster:${currentSale.roosterId}`]?.status || "activo";
        await restoreRoosterExit(currentSale.roosterId, tx, previousStatus);
      }
    }
    if (currentSale.batchId) {
      await restoreBatchExit(
        currentSale.batchId,
        currentSale.quantity,
        tx,
        currentSale.previousAnimalStates?.[`batch:${currentSale.batchId}`],
      );
    }

    await deleteTransactionsAndUnpaidAccounts(
      tx,
      and(eq(transactions.sourceType, "venta_ave"), eq(transactions.sourceId, id)),
    );
    await tx.delete(chickenSales).where(eq(chickenSales.id, id));
  });

  return NextResponse.json({ ok: true });
});
