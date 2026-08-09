import { NextResponse } from "next/server";
import { db } from "@/db";
import { maintenance } from "@/db/schema";
import { sql, eq, and, gte, desc, lt } from "drizzle-orm";

export async function GET() {
  try {
    const [totalTareas] = await db
      .select({ count: sql<number>`count(*)` })
      .from(maintenance);

    const [tareasPendientes] = await db
      .select({ count: sql<number>`count(*)` })
      .from(maintenance)
      .where(eq(maintenance.status, "pendiente"));

    const [tareasCompletadas] = await db
      .select({ count: sql<number>`count(*)` })
      .from(maintenance)
      .where(eq(maintenance.status, "completado"));

    const [costoTotal] = await db
      .select({ total: sql<number>`sum(${maintenance.cost})` })
      .from(maintenance);

    return NextResponse.json({
      totalTareas: Number(totalTareas?.count || 0),
      tareasPendientes: Number(tareasPendientes?.count || 0),
      tareasCompletadas: Number(tareasCompletadas?.count || 0),
      costoTotal: Number(costoTotal?.total || 0),
    });
  } catch (error) {
    console.error("Error en resumen operaciones:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen de operaciones" },
      { status: 500 }
    );
  }
}
