import { NextResponse } from "next/server";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { sql, eq, and, gte, desc, lt } from "drizzle-orm";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const GET = withApiHandler(async () => {
  try {
    const hoy = new Date();
    const hace30Dias = new Date(hoy);
    hace30Dias.setDate(hoy.getDate() - 30);
    const hace30DiasStr = hace30Dias.toISOString().split("T")[0];

    const [ingresosMes] = await db
      .select({ total: sql<number>`sum(${transactions.amount})` })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, "ingreso"),
          gte(transactions.date, hace30DiasStr)
        )
      );

    const [egresosMes] = await db
      .select({ total: sql<number>`sum(${transactions.amount})` })
      .from(transactions)
      .where(
        and(
          eq(transactions.type, "egreso"),
          gte(transactions.date, hace30DiasStr)
        )
      );

    const [balanceMes] = await db
      .select({
        total: sql<number>`sum(case when ${transactions.type} = 'ingreso' then ${transactions.amount} else -${transactions.amount} end)`
      })
      .from(transactions)
      .where(gte(transactions.date, hace30DiasStr));

    const [totalTransacciones] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(gte(transactions.date, hace30DiasStr));

    return NextResponse.json({
      ingresosMes: Number(ingresosMes?.total || 0),
      egresosMes: Number(egresosMes?.total || 0),
      balanceMes: Number(balanceMes?.total || 0),
      totalTransacciones: Number(totalTransacciones?.count || 0),
    });
  } catch (error) {
    console.error("Error en resumen finanzas:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen financiero" },
      { status: 500 }
    );
  }
});
