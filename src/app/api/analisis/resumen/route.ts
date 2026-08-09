import { NextResponse } from "next/server";
import { db } from "@/db";
import { eggProduction, mortalityRecords, feedMovements, hens } from "@/db/schema";
import { sql, eq, and, gte, desc, lt } from "drizzle-orm";

export async function GET() {
  try {
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const hace30DiasStr = hace30Dias.toISOString().split("T")[0];

    const [produccionMes] = await db
      .select({ total: sql<number>`sum(${eggProduction.totalCollected})` })
      .from(eggProduction)
      .where(gte(eggProduction.date, hace30DiasStr));

    const [mortalidadMes] = await db
      .select({ total: sql<number>`sum(${mortalityRecords.quantity})` })
      .from(mortalityRecords)
      .where(gte(mortalityRecords.date, hace30DiasStr));

    const [consumoAlimentoMes] = await db
      .select({ total: sql<number>`sum(${feedMovements.quantity})` })
      .from(feedMovements)
      .where(gte(feedMovements.date, hace30DiasStr));

    const [totalGallinas] = await db
      .select({ count: sql<number>`count(*)` })
      .from(hens)
      .where(eq(hens.status, "activa"));

    const productividad = totalGallinas?.count ? 
      Number(produccionMes?.total || 0) / Number(totalGallinas?.count || 1) : 0;

    return NextResponse.json({
      produccionMes: Number(produccionMes?.total || 0),
      mortalidadMes: Number(mortalidadMes?.total || 0),
      consumoAlimentoMes: Number(consumoAlimentoMes?.total || 0),
      totalGallinas: Number(totalGallinas?.count || 0),
      productividad: productividad.toFixed(2),
    });
  } catch (error) {
    console.error("Error en resumen analisis:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen de análisis" },
      { status: 500 }
    );
  }
}
