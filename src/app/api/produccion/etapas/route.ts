import { db } from "@/db";
import { catalogos, hens, feedPrograms, feedInventory } from "@/db/schema";
import { eq, and, sql, isNull, gte, lt, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/** Lista todas las etapas de crecimiento con conteo de gallinas por etapa */
export const GET = withApiHandler(async () => {
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
});

/** Crea un nuevo plan o etapa de alimentación con su programa nutricional */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value) return NextResponse.json({ error: "Nombre del plan o etapa requerido" }, { status: 400 });

  const minWeeks = body.minWeeks !== undefined && body.minWeeks !== "" ? Number(body.minWeeks) : 0;
  const maxWeeks = body.maxWeeks !== undefined && body.maxWeeks !== "" && body.maxWeeks !== null ? Number(body.maxWeeks) : null;
  const sortOrder = body.sortOrder !== undefined && body.sortOrder !== "" ? Number(body.sortOrder) : 20;
  if (!Number.isSafeInteger(minWeeks) || minWeeks < 0 || (maxWeeks !== null && (!Number.isSafeInteger(maxWeeks) || maxWeeks < minWeeks)) || !Number.isSafeInteger(sortOrder) || sortOrder < 0) {
    return NextResponse.json({ error: "Rango de semanas inválido" }, { status: 400 });
  }

  if (!Array.isArray(body.programs) || body.programs.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un alimento al programa" }, { status: 400 });
  }
  const programs: { feedId: string; percentage: string; dailyAmountPerHen: string }[] = [];
  for (const program of body.programs) {
    const feedId = typeof program?.feedId === "string" ? program.feedId.trim() : "";
    const percentage = Number(program?.percentage ?? 100);
    const dailyAmount = Number(program?.dailyAmountPerHen);
    if (!feedId || !Number.isFinite(percentage) || percentage < 0 || percentage > 100 || !Number.isFinite(dailyAmount) || dailyAmount <= 0) {
      return NextResponse.json({ error: "Cada alimento requiere una dosis mayor a 0 y un porcentaje entre 0 y 100" }, { status: 400 });
    }
    if (programs.some((entry) => entry.feedId === feedId)) {
      return NextResponse.json({ error: "No repitas un alimento en el mismo programa" }, { status: 400 });
    }
    programs.push({ feedId, percentage: percentage.toFixed(2), dailyAmountPerHen: dailyAmount.toFixed(2) });
  }

  const createdStage = await db.transaction(async (tx) => {
    const [stage] = await tx.insert(catalogos).values({
      category: "etapa_crecimiento",
      value,
      minWeeks,
      maxWeeks,
      sortOrder,
      isActive: true,
    }).returning();

    await tx.insert(feedPrograms).values(programs.map((program) => ({
      ...program,
      stageCatalogoId: stage.id,
    })));
    return stage;
  });

  return NextResponse.json(createdStage, { status: 201 });
});
