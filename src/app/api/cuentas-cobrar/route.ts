import { db } from "@/db";
import { accountsReceivable, transactions, payments } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const accounts = await db
    .select({
      id: accountsReceivable.id,
      transactionId: accountsReceivable.transactionId,
      buyer: accountsReceivable.buyer,
      totalAmount: accountsReceivable.totalAmount,
      paidAmount: accountsReceivable.paidAmount,
      pendingAmount: accountsReceivable.pendingAmount,
      dueDate: accountsReceivable.dueDate,
      status: accountsReceivable.status,
      createdAt: accountsReceivable.createdAt,
      updatedAt: accountsReceivable.updatedAt,
      transactionDate: transactions.date,
      transactionCategory: transactions.category,
      transactionDescription: transactions.description,
    })
    .from(accountsReceivable)
    .leftJoin(transactions, eq(accountsReceivable.transactionId, transactions.id))
    .orderBy(desc(accountsReceivable.createdAt));

  // Add aging calculation
  const today = new Date();
  const enriched = accounts.map((a) => {
    const dueDate = a.dueDate ? new Date(a.dueDate + "T12:00:00") : null;
    const agingDays = dueDate
      ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      ...a,
      agingDays: Math.max(0, agingDays),
      isOverdue: dueDate ? today > dueDate && a.status !== "pagado" : false,
    };
  });

  return NextResponse.json(enriched);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { transactionId, buyer, totalAmount, dueDate } = body;

  if (!transactionId || !buyer || !totalAmount) {
    return NextResponse.json({ error: "transactionId, buyer y totalAmount son requeridos" }, { status: 400 });
  }

  // Verify transaction exists
  const [txExists] = await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!txExists) {
    return NextResponse.json({ error: "Transacción no encontrada" }, { status: 400 });
  }

  const [created] = await db
    .insert(accountsReceivable)
    .values({
      transactionId,
      buyer,
      totalAmount: String(totalAmount),
      paidAmount: "0",
      pendingAmount: String(totalAmount),
      dueDate: dueDate || null,
      status: "pendiente",
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(accountsReceivable)
    .where(eq(accountsReceivable.id, body.id));

  if (!existing) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const [updated] = await db
    .update(accountsReceivable)
    .set({
      buyer: body.buyer ?? existing.buyer,
      dueDate: body.dueDate !== undefined ? body.dueDate : existing.dueDate,
      status: body.status ?? existing.status,
      updatedAt: new Date(),
    })
    .where(eq(accountsReceivable.id, body.id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(payments).where(eq(payments.receivableId, id));
    await tx.delete(accountsReceivable).where(eq(accountsReceivable.id, id));
  });
  return NextResponse.json({ ok: true });
});
