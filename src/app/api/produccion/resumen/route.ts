import { NextResponse } from "next/server";
import { db } from "@/db";
import { eggProduction, hens, feedMovements, mortalityRecords } from "@/db/schema";
import { sql, eq, and, gte, desc } from "drizzle-orm";

export async function GET() {
  try {
    const hoy = new Date();
    const hace7Dias = new Date(hoy);
    hace7Dias.setDate(hoy.getDate() - 7);

    const hoyStr = hoy.toISOString().split("T")[0];
    const hace7DiasStr = hace7Dias.toISOString().split("T")[0];

    const [huevosHoy] = await db
      .select({ count: sql<number>`sum(${eggProduction.totalCollected})` })
      .from(eggProduction)
      .where(eq(eggProduction.date, hoyStr));

    const [huevosSemana] = await db
      .select({ count: sql<number>`sum(${eggProduction.totalCollected})` })
      .from(eggProduction)
      .where(gte(eggProduction.date, hace7DiasStr));

    const [totalGallinas] = await db
      .select({ count: sql<number>`count(*)` })
      .from(hens)
      .where(eq(hens.status, "activa"));

    const [mortalidadSemana] = await db
      .select({ count: sql<number>`sum(${mortalityRecords.quantity})` })
      .from(mortalityRecords)
      .where(gte(mortalityRecords.date, hace7DiasStr));

    const [consumoAlimentoSemanal] = await db
      .select({ total: sql<number>`sum(${feedMovements.quantity})` })
      .from(feedMovements)
      .where(gte(feedMovements.date, hace7DiasStr));

    return NextResponse.json({
      huevosHoy: Number(huevosHoy?.count || 0),
      huevosSemana: Number(huevosSemana?.count || 0),
      totalGallinas: Number(totalGallinas?.count || 0),
      mortalidadSemana: Number(mortalidadSemana?.count || 0),
      consumoAlimentoSemanal: Number(consumoAlimentoSemanal?.total || 0),
    });
  } catch (error) {
    console.error("Error en resumen produccion:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen de producción" },
      { status: 500 }
    );
  }
}
