import { db } from "@/db";
import { catalogos, feedPrograms, feedInventory } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { countAnimalsByStageForDate } from "@/lib/feeding/runProgram";
import { getStageSpecies } from "@/lib/feeding/stage-species";
import { ANIMAL_SPECIES } from "@/lib/species";
import { findMissingFeeds, normalizeProgramEntries } from "@/lib/feeding/program-validation";
import { summarizeRation } from "@/lib/feeding/ration";

export const dynamic = "force-dynamic";

/** Lista todas las etapas de crecimiento con conteo de animales por especie y etapa. */
export const GET = withApiHandler(async () => {
  const stages = await db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
    .orderBy(sql`${catalogos.sortOrder}`);

  const animalCounts = await countAnimalsByStageForDate(new Date());
  const result = [];

  for (const stage of stages) {
    const animalCount = animalCounts[stage.id] ?? 0;

    // Obtener el programa alimenticio de esta etapa
    const programs = await db
      .select({
        id: feedPrograms.id,
        feedId: feedPrograms.feedId,
        feedName: feedInventory.name,
        feedUnit: feedInventory.unit,
        percentage: feedPrograms.percentage,
        dailyAmountPerHen: feedPrograms.dailyAmountPerHen,
        feedCategory: feedInventory.category,
        dryMatterPct: feedInventory.dryMatterPct,
        crudeProteinPct: feedInventory.crudeProteinPct,
      })
      .from(feedPrograms)
      .leftJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id))
      .where(eq(feedPrograms.stageCatalogoId, stage.id));

    result.push({
      ...stage,
      animalCount,
      // Compatibility for older clients; this value now counts the stage's species.
      henCount: animalCount,
      programs,
      // Composición de la dieta combinada (materia seca, proteína y proporción de forraje fresco).
      ration: summarizeRation(programs.map((p) => ({
        grams: Number(p.dailyAmountPerHen),
        dryMatterPct: p.dryMatterPct === null ? null : Number(p.dryMatterPct),
        crudeProteinPct: p.crudeProteinPct === null ? null : Number(p.crudeProteinPct),
        category: p.feedCategory,
      }))),
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
  const supportedSpecies = ANIMAL_SPECIES;
  const requestedSpecies = typeof body.species === "string" ? body.species.trim().toLocaleLowerCase("es") : "";
  if (requestedSpecies && !supportedSpecies.includes(requestedSpecies as typeof supportedSpecies[number])) {
    return NextResponse.json({ error: "Especie del plan no válida" }, { status: 400 });
  }
  const species = requestedSpecies || getStageSpecies({ value });
  if (!supportedSpecies.includes(species as typeof supportedSpecies[number])) {
    return NextResponse.json({ error: "La especie del plan no está soportada" }, { status: 400 });
  }

  const minWeeks = body.minWeeks !== undefined && body.minWeeks !== "" ? Number(body.minWeeks) : 0;
  const maxWeeks = body.maxWeeks !== undefined && body.maxWeeks !== "" && body.maxWeeks !== null ? Number(body.maxWeeks) : null;
  const sortOrder = body.sortOrder !== undefined && body.sortOrder !== "" ? Number(body.sortOrder) : 20;
  if (!Number.isSafeInteger(minWeeks) || minWeeks < 0 || (maxWeeks !== null && (!Number.isSafeInteger(maxWeeks) || maxWeeks < minWeeks)) || !Number.isSafeInteger(sortOrder) || sortOrder < 0) {
    return NextResponse.json({ error: "Rango de semanas inválido" }, { status: 400 });
  }

  const normalized = normalizeProgramEntries(body.programs);
  if ("error" in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 });
  const programs = normalized.entries;
  const missingFeeds = await findMissingFeeds(db, programs.map((program) => program.feedId));
  if (missingFeeds.length > 0) return NextResponse.json({ error: "Alguno de los alimentos del programa no existe" }, { status: 400 });

  const createdStage = await db.transaction(async (tx) => {
    const [stage] = await tx.insert(catalogos).values({
      category: "etapa_crecimiento",
      value,
      tipo: species,
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
