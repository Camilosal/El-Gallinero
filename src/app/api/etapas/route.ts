import { db } from "@/db";
import { catalogos, hens, feedPrograms, feedInventory } from "@/db/schema";
import { eq, and, sql, isNull, gte, lt, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lista todas las etapas de crecimiento con conteo de gallinas por etapa */
export async function GET() {
  const stages = await db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
    .orderBy(sql`${catalogos.sortOrder}`);

  // Contar gallinas activas por etapa usando su fecha de nacimiento
  const today = new Date();
  const result = [];

  for (const stage of stages) {
    const minWeeks = stage.minWeeks ?? 0;
    const maxWeeks = stage.maxWeeks;

    // Calcular la fecha de nacimiento límite para esta etapa
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - minWeeks * 7);

    // Contar gallinas cuya edad en semanas está en el rango [minWeeks, maxWeeks)
    let countResult;
    if (maxWeeks === null) {
      // Etapa abierta (ej: Postura 20+ semanas)
      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            or(eq(hens.status, "activa"), eq(hens.status, "empollando"), eq(hens.status, "recomendada_sacrificio"))
          )
        );
    } else {
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() - maxWeeks * 7);

      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            sql`${hens.birthDate}::date > ${maxDate.toISOString().split("T")[0]}::date`,
            or(eq(hens.status, "activa"), eq(hens.status, "empollando"), eq(hens.status, "recomendada_sacrificio"))
          )
        );
    }

    const henCount = countResult?.[0]?.count ?? 0;

    // Obtener el programa alimenticio de esta etapa
    const programs = await db
      .select({
        id: feedPrograms.id,
        feedId: feedPrograms.feedId,
        feedName: feedInventory.name,
        feedUnit: feedInventory.unit,
        percentage: feedPrograms.percentage,
        dailyAmountPerHen: feedPrograms.dailyAmountPerHen,
      })
      .from(feedPrograms)
      .leftJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id))
      .where(eq(feedPrograms.stageCatalogoId, stage.id));

    result.push({
      ...stage,
      henCount,
      programs,
    });
  }

  return NextResponse.json(result);
}
