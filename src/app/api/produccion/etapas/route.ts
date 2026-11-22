import { db } from "@/db";
import { catalogos, feedPrograms, feedInventory } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentFarmId } from "@/db/tenant-context";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { countAnimalsByStageForDate } from "@/lib/feeding/runProgram";
import { getStageSpecies } from "@/lib/feeding/stage-species";
import { ANIMAL_SPECIES, FEEDING_SPECIES } from "@/lib/species";
import { findBlockedFeeds, findMissingFeeds, normalizeProgramEntries } from "@/lib/feeding/program-validation";
import { validateFeedingProgram } from "@/lib/feeding/nutrition-validator";
import { resolveEffectiveFeedProfile } from "@/lib/feeding/standard-feed-catalog";
import { markFeedingProgramsReviewed } from "@/lib/feeding/review";

export const dynamic = "force-dynamic";

/** Lista todas las etapas de crecimiento con conteo de animales por especie y etapa. */
export const GET = withApiHandler(async () => {
  const currentFarmId = getCurrentFarmId();
  const allStages = await db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
    .orderBy(sql`${catalogos.sortOrder}`);

  // Evita mezclar las 4 etapas heredadas de DEFAULT_FARM_ID cuando la granja ya tiene su propio catálogo sembrado.
  const ownStages = allStages.filter((stage) => stage.farmId === currentFarmId);
  const stages = ownStages.length > 0 ? ownStages : allStages;

  const [animalCounts, allInventoryFeeds] = await Promise.all([
    countAnimalsByStageForDate(new Date()),
    db
      .select({
        id: feedInventory.id,
        name: feedInventory.name,
        category: feedInventory.category,
        standardCatalogId: feedInventory.standardCatalogId,
        sanitaryStatus: feedInventory.sanitaryStatus,
        dryMatterPct: feedInventory.dryMatterPct,
        crudeProteinPct: feedInventory.crudeProteinPct,
        energyKcalKgDm: feedInventory.energyKcalKgDm,
        calciumDmPct: feedInventory.calciumDmPct,
        availablePhosphorusDmPct: feedInventory.availablePhosphorusDmPct,
        lysineDigDmPct: feedInventory.lysineDigDmPct,
        metCysDigDmPct: feedInventory.metCysDigDmPct,
        crudeFiberDmPct: feedInventory.crudeFiberDmPct,
        nutritionProfile: feedInventory.nutritionProfile,
      })
      .from(feedInventory),
  ]);
  const availableFeeds = allInventoryFeeds.map((f) => ({
    ...f,
    nutritionProfile: (f.nutritionProfile ?? null) as Record<string, unknown> | null,
  }));
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
        standardCatalogId: feedInventory.standardCatalogId,
        sanitaryStatus: feedInventory.sanitaryStatus,
        energyKcalKgDm: feedInventory.energyKcalKgDm,
        calciumDmPct: feedInventory.calciumDmPct,
        availablePhosphorusDmPct: feedInventory.availablePhosphorusDmPct,
        lysineDigDmPct: feedInventory.lysineDigDmPct,
        metCysDigDmPct: feedInventory.metCysDigDmPct,
        crudeFiberDmPct: feedInventory.crudeFiberDmPct,
        nutritionProfile: feedInventory.nutritionProfile,
      })
      .from(feedPrograms)
      .leftJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id))
      .where(eq(feedPrograms.stageCatalogoId, stage.id));

    const rationLines = programs.map((p) => {
      const resolved = resolveEffectiveFeedProfile({
        name: p.feedName,
        standardCatalogId: p.standardCatalogId,
        sanitaryStatus: p.sanitaryStatus,
        dryMatterPct: p.dryMatterPct,
        crudeProteinPct: p.crudeProteinPct,
        energyKcalKgDm: p.energyKcalKgDm,
        calciumDmPct: p.calciumDmPct,
        availablePhosphorusDmPct: p.availablePhosphorusDmPct,
        lysineDigDmPct: p.lysineDigDmPct,
        metCysDigDmPct: p.metCysDigDmPct,
        crudeFiberDmPct: p.crudeFiberDmPct,
        nutritionProfile: p.nutritionProfile as Record<string, unknown> | null,
      });
      return {
        grams: Number(p.dailyAmountPerHen),
        dryMatterPct: resolved.dryMatterPct,
        crudeProteinPct: resolved.crudeProteinAsFedPct,
        category: p.feedCategory,
        energyKcalKgDm: resolved.energyKcalKgDm,
        calciumDmPct: resolved.calciumDmPct,
        availablePhosphorusDmPct: resolved.availablePhosphorusDmPct,
        lysineDigDmPct: resolved.lysineDigDmPct,
        metCysDigDmPct: resolved.metCysDigDmPct,
        crudeFiberDmPct: resolved.crudeFiberDmPct,
        sanitaryStatus: resolved.sanitaryStatus,
        standardCatalogId: resolved.standardCatalogId,
        feedName: p.feedName,
      };
    });

    const stageSpecies = getStageSpecies(stage);
    const nutritionValidation =
      programs.length > 0
        ? validateFeedingProgram({
            species: stageSpecies,
            stageName: stage.value,
            minWeeks: stage.minWeeks ?? 0,
            maxWeeks: stage.maxWeeks ?? null,
            lines: rationLines,
            availableFeeds,
          })
        : null;

    result.push({
      ...stage,
      animalCount,
      // Compatibility for older clients; this value now counts the stage's species.
      henCount: animalCount,
      programs,
      // Composición y validación nutricional de la dieta frente a requerimientos de especie y etapa.
      ration: nutritionValidation ? nutritionValidation.summary : null,
      nutritionValidation,
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
  const supportedSpecies = FEEDING_SPECIES;
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
  const blockedFeeds = await findBlockedFeeds(db, programs.map((program) => program.feedId));
  if (blockedFeeds.length > 0) {
    return NextResponse.json(
      { error: `No se puede formular con ingrediente bloqueado (NO USAR): ${blockedFeeds.map((b) => b.name).join(", ")}` },
      { status: 400 },
    );
  }

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

  await markFeedingProgramsReviewed();
  return NextResponse.json(createdStage, { status: 201 });
});
