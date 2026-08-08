import { db } from "@/db";
import { accountsPayable, transactions, payments } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = await db
    .select({
      id: accountsPayable.id,
      transactionId: accountsPayable.transactionId,
      supplier: accountsPayable.supplier,
      totalAmount: accountsPayable.totalAmount,
      paidAmount: accountsPayable.paidAmount,
      pendingAmount: accountsPayable.pendingAmount,
      dueDate: accountsPayable.dueDate,
      status: accountsPayable.status,
      createdAt: accountsPayable.createdAt,
      updatedAt: accountsPayable.updatedAt,
      transactionDate: transactions.date,
      transactionCategory: transactions.category,
      transactionDescription: transactions.description,
    })
    .from(accountsPayable)
    .leftJoin(transactions, eq(accountsPayable.transactionId, transactions.id))
    .orderBy(desc(accountsPayable.createdAt));

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
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { transactionId, supplier, totalAmount, dueDate } = body;

  if (!transactionId || !supplier || !totalAmount) {
    return NextResponse.json({ error: "transactionId, supplier y totalAmount son requeridos" }, { status: 400 });
  }

  const [created] = await db
    .insert(accountsPayable)
    .values({
      transactionId,
      supplier,
      totalAmount: String(totalAmount),
      paidAmount: "0",
      pendingAmount: String(totalAmount),
      dueDate: dueDate || null,
      status: "pendiente",
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(accountsPayable)
    .where(eq(accountsPayable.id, body.id));

  if (!existing) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const [updated] = await db
    .update(accountsPayable)
    .set({
      supplier: body.supplier ?? existing.supplier,
      dueDate: body.dueDate !== undefined ? body.dueDate : existing.dueDate,
      status: body.status ?? existing.status,
      updatedAt: new Date(),
    })
    .where(eq(accountsPayable.id, body.id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(payments).where(eq(payments.payableId, id));
    await tx.delete(accountsPayable).where(eq(accountsPayable.id, id));
  });
  return NextResponse.json({ ok: true });
}
