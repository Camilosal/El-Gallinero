import { NextResponse } from "next/server";
import { db } from "@/db";
import { healthControl } from "@/db/schema";
import { sql, eq, and, gte, desc, lt } from "drizzle-orm";

export async function GET() {
  try {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split("T")[0];

    const [totalEventos] = await db
      .select({ count: sql<number>`count(*)` })
      .from(healthControl);

    const [eventosMes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(healthControl)
      .where(gte(healthControl.date, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]));

    const [proximosEventos] = await db
      .select({ count: sql<number>`count(*)` })
      .from(healthControl)
      .where(gte(healthControl.nextScheduled, hoyStr));

    const [costoTotal] = await db
      .select({ total: sql<number>`sum(${healthControl.cost})` })
      .from(healthControl);

    return NextResponse.json({
      totalEventos: Number(totalEventos?.count || 0),
      eventosMes: Number(eventosMes?.count || 0),
      proximosEventos: Number(proximosEventos?.count || 0),
      costoTotal: Number(costoTotal?.total || 0),
    });
  } catch (error) {
    console.error("Error en resumen sanidad:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen de sanidad" },
      { status: 500 }
    );
  }
}
