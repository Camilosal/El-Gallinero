import { db } from "@/db";
import {
  dailyClosures,
  eggProduction,
  eggSales,
  chickenSales,
  meatSales,
  mortalityRecords,
  transactions,
  healthControl,
} from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { requirePermission } from "@/lib/rbac-server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function buildDailySnapshot(dateStr: string) {
  const [eggs, eSales, bSales, mSales, deaths, txs, health] = await Promise.all([
    db.select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int`,
    }).from(eggProduction).where(eq(eggProduction.date, dateStr)),
    db.select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${eggSales.totalAmount}), 0)::text`,
    }).from(eggSales).where(eq(eggSales.date, dateStr)),
    db.select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${chickenSales.totalAmount}), 0)::text`,
    }).from(chickenSales).where(eq(chickenSales.date, dateStr)),
    db.select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${meatSales.totalAmount}), 0)::text`,
    }).from(meatSales).where(eq(meatSales.date, dateStr)),
    db.select({
      total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int`,
    }).from(mortalityRecords).where(eq(mortalityRecords.date, dateStr)),
    db.select({
      income: sql<string>`coalesce(sum(case when ${transactions.type} = 'ingreso' then ${transactions.amount} else 0 end), 0)::text`,
      expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'egreso' then ${transactions.amount} else 0 end), 0)::text`,
    }).from(transactions).where(eq(transactions.date, dateStr)),
    db.select({
      count: sql<number>`count(*)::int`,
    }).from(healthControl).where(eq(healthControl.date, dateStr)),
  ]);

  return {
    closureDate: dateStr,
    eggsCollected: eggs[0]?.total || 0,
    eggRecords: eggs[0]?.count || 0,
    mortalityUnits: deaths[0]?.total || 0,
    sanitaryEvents: health[0]?.count || 0,
    salesCount: (eSales[0]?.count || 0) + (bSales[0]?.count || 0) + (mSales[0]?.count || 0),
    salesTotalCop: Math.round(
      Number(eSales[0]?.total || 0) + Number(bSales[0]?.total || 0) + Number(mSales[0]?.total || 0),
    ),
    incomeCop: Math.round(Number(txs[0]?.income || 0)),
    expenseCop: Math.round(Number(txs[0]?.expense || 0)),
    capturedAt: new Date().toISOString(),
  };
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const targetDate = isDateOnly(dateParam) ? String(dateParam) : todayColombiaIso();

  const [closures, preview] = await Promise.all([
    db.select().from(dailyClosures).orderBy(desc(dailyClosures.closureDate)).limit(60),
    buildDailySnapshot(targetDate),
  ]);

  return NextResponse.json({
    targetDate,
    preview,
    closures,
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("closure:close", "Solo gerencia o administración puede ejecutar el cierre diario");
  if (denied) return denied;

  const user = await getSessionUser();
  const body = await safeParseJson(req);
  const closureDate = isDateOnly(body?.closureDate) ? String(body.closureDate) : todayColombiaIso();

  const snapshot = await buildDailySnapshot(closureDate);
  const validUserId = user?.id && user.id !== "test-user" ? user.id : null;

  const [existing] = await db
    .select()
    .from(dailyClosures)
    .where(eq(dailyClosures.closureDate, closureDate))
    .limit(1);

  if (existing && existing.status === "cerrado") {
    return NextResponse.json({ error: `La fecha ${closureDate} ya se encuentra cerrada` }, { status: 409 });
  }

  if (existing) {
    const [reclosed] = await db
      .update(dailyClosures)
      .set({
        status: "cerrado",
        closedBy: validUserId,
        closedAt: new Date(),
        summarySnapshot: snapshot,
        notes: typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : existing.notes,
      })
      .where(eq(dailyClosures.id, existing.id))
      .returning();
    return NextResponse.json(reclosed);
  }

  const [created] = await db
    .insert(dailyClosures)
    .values({
      closureDate,
      status: "cerrado",
      closedBy: validUserId,
      closedAt: new Date(),
      summarySnapshot: snapshot,
      notes: typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const action = String(body.action || "reopen");
  const closureDate = isDateOnly(body.closureDate) ? String(body.closureDate) : null;
  if (!body.id && !closureDate) {
    return NextResponse.json({ error: "Indica el ID o la fecha de cierre" }, { status: 400 });
  }

  const user = await getSessionUser();
  const validUserId = user?.id && user.id !== "test-user" ? user.id : null;

  if (action === "reopen") {
    const denied = await requirePermission(
      "closure:reopen",
      "Solo propietario o administrador puede reabrir un cierre diario",
    );
    if (denied) return denied;

    const reason = typeof body.reopenReason === "string" ? body.reopenReason.trim() : "";
    if (reason.length < 5) {
      return NextResponse.json({ error: "Indica el motivo de reapertura (mínimo 5 caracteres)" }, { status: 400 });
    }

    const whereCond = body.id
      ? eq(dailyClosures.id, String(body.id))
      : eq(dailyClosures.closureDate, String(closureDate));

    const [updated] = await db
      .update(dailyClosures)
      .set({
        status: "reabierto",
        reopenedBy: validUserId,
        reopenedAt: new Date(),
        reopenReason: reason,
      })
      .where(whereCond)
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Cierre diario no encontrado" }, { status: 404 });
    }
    return NextResponse.json(updated);
  }

  const deniedClose = await requirePermission("closure:close");
  if (deniedClose) return deniedClose;
  if (!closureDate) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const snapshot = await buildDailySnapshot(closureDate);
  const whereCond = body.id
    ? eq(dailyClosures.id, String(body.id))
    : eq(dailyClosures.closureDate, closureDate);
  const [updated] = await db
    .update(dailyClosures)
    .set({
      status: "cerrado",
      closedBy: validUserId,
      closedAt: new Date(),
      summarySnapshot: snapshot,
    })
    .where(whereCond)
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Cierre diario no encontrado" }, { status: 404 });
  }
  return NextResponse.json(updated);
});
