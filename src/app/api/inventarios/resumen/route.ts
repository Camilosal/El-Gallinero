import { NextResponse } from "next/server";
import { db } from "@/db";
import { feedInventory, hens, eggProduction } from "@/db/schema";
import { sql, eq, and, gte, desc, lt } from "drizzle-orm";
import { computeManureInventory } from "@/lib/inventory";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const GET = withApiHandler(async () => {
  try {
    const hoy = new Date();
    const hace21Dias = new Date(hoy);
    hace21Dias.setDate(hoy.getDate() - 21);
    const hace21DiasStr = hace21Dias.toISOString().split("T")[0];

    const [totalHuevos] = await db
      .select({ count: sql<number>`sum(${eggProduction.totalCollected})` })
      .from(eggProduction);

    const [huevosPorVencer] = await db
      .select({ count: sql<number>`sum(${eggProduction.totalCollected})` })
      .from(eggProduction)
      .where(lt(eggProduction.date, hace21DiasStr));

    const [totalAlimento] = await db
      .select({ quantity: sql<number>`sum(${feedInventory.currentStock})` })
      .from(feedInventory);

    const manureInventory = await computeManureInventory();

    const [totalAves] = await db
      .select({ count: sql<number>`count(*)` })
      .from(hens)
      .where(eq(hens.status, "activa"));

    return NextResponse.json({
      totalHuevos: Number(totalHuevos?.count || 0),
      huevosPorVencer: Number(huevosPorVencer?.count || 0),
      totalAlimento: Number(totalAlimento?.quantity || 0),
      totalGallinaza: Math.round(manureInventory.summary.available * 100) / 100,
      totalAves: Number(totalAves?.count || 0),
    });
  } catch (error) {
    console.error("Error en resumen inventarios:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen de inventarios" },
      { status: 500 }
    );
  }
});
