import { db } from "@/db";
import { payments, accountsReceivable, accountsPayable } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const allPayments = await db
    .select()
    .from(payments)
    .orderBy(desc(payments.createdAt));

  return NextResponse.json(allPayments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, type, receivableId, payableId, amount, method, reference, notes } = body;

  if (!date || !type || !amount) {
    return NextResponse.json({ error: "Fecha, tipo y monto son requeridos" }, { status: 400 });
  }

  if (type === "cobro" && !receivableId) {
    return NextResponse.json({ error: "receivableId requerido para cobros" }, { status: 400 });
  }
  if (type === "pago" && !payableId) {
    return NextResponse.json({ error: "payableId requerido para pagos" }, { status: 400 });
  }
  if (type !== "cobro" && type !== "pago") {
    return NextResponse.json({ error: "Tipo inválido (debe ser 'cobro' o 'pago')" }, { status: 400 });
  }

  const paymentAmount = Number(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  }

  let result;
  try {
    result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(payments)
      .values({
        date,
        type,
        receivableId: receivableId || null,
        payableId: payableId || null,
        amount: String(paymentAmount),
        method: method || null,
        reference: reference || null,
        notes: notes || null,
      })
      .returning();

    if (type === "cobro" && receivableId) {
      const [account] = await tx
        .select()
        .from(accountsReceivable)
        .where(eq(accountsReceivable.id, receivableId));

      if (!account) {
        throw new Error("Cuenta por cobrar no encontrada");
      }

      if (paymentAmount > Number(account.pendingAmount)) {
        throw new Error(`Monto excede saldo pendiente ($${account.pendingAmount})`);
      }

      const newPaid = Number(account.paidAmount) + paymentAmount;
      const newPending = Number(account.totalAmount) - newPaid;
      const newStatus = newPending <= 0 ? "pagado" : "parcial";

      await tx
        .update(accountsReceivable)
        .set({
          paidAmount: String(newPaid),
          pendingAmount: String(Math.max(0, newPending)),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(accountsReceivable.id, receivableId));
    }

    if (type === "pago" && payableId) {
      const [account] = await tx
        .select()
        .from(accountsPayable)
        .where(eq(accountsPayable.id, payableId));

      if (!account) {
        throw new Error("Cuenta por pagar no encontrada");
      }

      if (paymentAmount > Number(account.pendingAmount)) {
        throw new Error(`Monto excede saldo pendiente ($${account.pendingAmount})`);
      }

      const newPaid = Number(account.paidAmount) + paymentAmount;
      const newPending = Number(account.totalAmount) - newPaid;
      const newStatus = newPending <= 0 ? "pagado" : "parcial";

      await tx
        .update(accountsPayable)
        .set({
          paidAmount: String(newPaid),
          pendingAmount: String(Math.max(0, newPending)),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(accountsPayable.id, payableId));
    }

    return payment;
    });
  } catch (e: any) {
    const msg = e.message || "";
    if (msg.includes("no encontrada")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("excede saldo")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    throw e;
  }

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [payment] = await db.select().from(payments).where(eq(payments.id, id));
  if (!payment) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    // Reverse the payment effect
    if (payment.type === "cobro" && payment.receivableId) {
      const [account] = await tx
        .select()
        .from(accountsReceivable)
        .where(eq(accountsReceivable.id, payment.receivableId));

      if (account) {
        const newPaid = Number(account.paidAmount) - Number(payment.amount);
        const newPending = Number(account.totalAmount) - newPaid;
        const newStatus = newPending >= Number(account.totalAmount) ? "pendiente" : "parcial";

        await tx
          .update(accountsReceivable)
          .set({
            paidAmount: String(Math.max(0, newPaid)),
            pendingAmount: String(Math.max(0, newPending)),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(accountsReceivable.id, payment.receivableId));
      }
    }

    if (payment.type === "pago" && payment.payableId) {
      const [account] = await tx
        .select()
        .from(accountsPayable)
        .where(eq(accountsPayable.id, payment.payableId));

      if (account) {
        const newPaid = Number(account.paidAmount) - Number(payment.amount);
        const newPending = Number(account.totalAmount) - newPaid;
        const newStatus = newPending >= Number(account.totalAmount) ? "pendiente" : "parcial";

        await tx
          .update(accountsPayable)
          .set({
            paidAmount: String(Math.max(0, newPaid)),
            pendingAmount: String(Math.max(0, newPending)),
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(accountsPayable.id, payment.payableId));
      }
    }

    await tx.delete(payments).where(eq(payments.id, id));
  });

  return NextResponse.json({ ok: true });
}
