import { NextResponse } from "next/server";
import { db } from "@/db";
import { feedInventory, eggProduction } from "@/db/schema";
import { sql, lt } from "drizzle-orm";
import { computeManureInventory } from "@/lib/inventory";
import { computeAnimalInventory } from "@/lib/animal-inventory";
import { withApiHandler } from "@/lib/api-handler";

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

    const [manureInventory, animalInventory] = await Promise.all([
      computeManureInventory(),
      computeAnimalInventory(),
    ]);

    return NextResponse.json({
      totalHuevos: Number(totalHuevos?.count || 0),
      huevosPorVencer: Number(huevosPorVencer?.count || 0),
      totalAlimento: Number(totalAlimento?.quantity || 0),
      totalGallinaza: Math.round(manureInventory.summary.available * 100) / 100,
      // Inventario vigente: el mismo número que inicio y balance.
      totalAves: animalInventory.summary.totalAnimals,
      totalBirds: animalInventory.summary.totalBirds,
      totalHens: animalInventory.summary.activeHens,
      totalRoosters: animalInventory.summary.activeRoosters,
      totalBatches: animalInventory.summary.activeBatches,
      species: animalInventory.species,
    });
  } catch (error) {
    console.error("Error en resumen inventarios:", error);
    return NextResponse.json(
      { error: "Error al obtener resumen de inventarios" },
      { status: 500 }
    );
  }
});
