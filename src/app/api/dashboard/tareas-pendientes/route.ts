import { db } from "@/db";
import {
  eggProduction, eggProductionDetails, feedMovements, sanitaryCalendar, maintenance, farmLocations, farmAssets,
  hens, roosters, broilerBatches, catalogos, contacts, feedPrograms, feedInventory, supplyInventory, appSettings, budgets,
} from "@/db/schema";
import { eq, and, sql, inArray, asc, desc, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { ageInWeeks, stageForAge } from "@/lib/lifecycle";
import { isHenPresent, isRoosterPresent, isBatchPresent } from "@/lib/animal-status";
import { loadSpeciesParams } from "@/lib/species-db";
import { SANITARY_CALENDAR_REVIEW_KEY } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [stages, henRows, roosterRows, batchRows, speciesParams, programRows, eggRows, feedRows,
    pendingSanitary, maintenanceDue, maintenanceDueCount, assetsNeedAttention,
    locationsCount, feedStockCount, supplyStockCount, registeredAssetsCount, sanitaryCount, sanitaryReview,
    clientCount, supplierCount, contactClientCount, contactSupplierCount, farmProfileValues, budgetCount, lastEggRows, lastFeedRows] = await Promise.all([
    db.select().from(catalogos).where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true))),
    db.select({ birthDate: hens.birthDate, status: hens.status }).from(hens),
    db.select({ birthDate: roosters.birthDate, status: roosters.status }).from(roosters),
    db.select({ id: broilerBatches.id, species: broilerBatches.species, purpose: broilerBatches.purpose, status: broilerBatches.status,
      currentQuantity: broilerBatches.currentQuantity, startDate: broilerBatches.startDate, breed: broilerBatches.breed }).from(broilerBatches),
    loadSpeciesParams(),
    db.select({ stageId: feedPrograms.stageCatalogoId }).from(feedPrograms)
      .innerJoin(catalogos, and(eq(feedPrograms.stageCatalogoId, catalogos.id), eq(catalogos.isActive, true)))
      .innerJoin(feedInventory, eq(feedPrograms.feedId, feedInventory.id)),
    db.select({
      species: eggProduction.species,
      batchId: eggProduction.batchId,
      totalCollected: eggProduction.totalCollected,
    }).from(eggProduction).where(eq(eggProduction.date, today)),
    // Una compra o entrada de inventario no significa que hoy se haya alimentado.
    db.select({ id: feedMovements.id }).from(feedMovements)
      .where(and(eq(feedMovements.date, today), eq(feedMovements.isEntry, false), inArray(feedMovements.movementType, ["consumo_programa", "consumo_manual", "uso_interno"]))).limit(1),
    db.select({
      id: sanitaryCalendar.id,
      name: sanitaryCalendar.name,
      type: sanitaryCalendar.type,
      description: sanitaryCalendar.description,
      targetBirds: sanitaryCalendar.targetBirds,
      frequencyDays: sanitaryCalendar.frequencyDays,
      nextDueDate: sanitaryCalendar.nextDueDate,
    })
      .from(sanitaryCalendar).where(and(eq(sanitaryCalendar.isActive, true), sql`${sanitaryCalendar.nextDueDate} <= ${today}::date + interval '7 days'`))
      .orderBy(sanitaryCalendar.nextDueDate).limit(3),
    db.select({
      id: maintenance.id,
      title: maintenance.title,
      description: maintenance.description,
      scheduledDate: maintenance.scheduledDate,
      cost: maintenance.cost,
      status: maintenance.status,
      locationId: maintenance.locationId,
      assetId: maintenance.assetId,
      recurrenceIntervalDays: maintenance.recurrenceIntervalDays,
      locationName: farmLocations.name,
      assetName: farmAssets.name,
    })
      .from(maintenance).leftJoin(farmLocations, eq(maintenance.locationId, farmLocations.id)).leftJoin(farmAssets, eq(maintenance.assetId, farmAssets.id))
      .where(and(ne(maintenance.status, "completado"), sql`${maintenance.scheduledDate} <= ${today}::date + interval '7 days'`))
      .orderBy(asc(maintenance.scheduledDate)).limit(5),
    db.select({ total: sql<number>`count(*)::int` }).from(maintenance)
      .where(and(ne(maintenance.status, "completado"), sql`${maintenance.scheduledDate} <= ${today}::date + interval '7 days'`)),
    db.select({ total: sql<number>`count(*)::int` }).from(farmAssets).where(inArray(farmAssets.status, ["requiere_mantenimiento", "fuera_servicio"])),
    db.select({ total: sql<number>`count(*)::int` }).from(farmLocations).where(eq(farmLocations.status, "activa")),
    db.select({ total: sql<number>`count(*)::int` }).from(feedInventory)
      .where(sql`${feedInventory.currentStock}::numeric > 0`),
    db.select({ total: sql<number>`count(*)::int` }).from(supplyInventory)
      .where(sql`${supplyInventory.currentStock}::numeric > 0`),
    db.select({ total: sql<number>`count(*)::int` }).from(farmAssets)
      .where(ne(farmAssets.status, "retirado")),
    db.select({ total: sql<number>`count(*)::int` }).from(sanitaryCalendar)
      .where(eq(sanitaryCalendar.isActive, true)),
    db.select({ value: appSettings.value }).from(appSettings)
      .where(eq(appSettings.key, SANITARY_CALENDAR_REVIEW_KEY)).limit(1),
    db.select({ total: sql<number>`count(*)::int` }).from(catalogos)
      .where(and(eq(catalogos.category, "comprador"), eq(catalogos.isActive, true))),
    db.select({ total: sql<number>`count(*)::int` }).from(catalogos)
      .where(and(eq(catalogos.category, "proveedor"), eq(catalogos.isActive, true))),
    db.select({ total: sql<number>`count(*)::int` }).from(contacts)
      .where(and(inArray(contacts.role, ["cliente", "ambos"]), eq(contacts.isActive, true))),
    db.select({ total: sql<number>`count(*)::int` }).from(contacts)
      .where(and(inArray(contacts.role, ["proveedor", "ambos"]), eq(contacts.isActive, true))),
    db.select({ key: appSettings.key, value: appSettings.value }).from(appSettings)
      .where(inArray(appSettings.key, ["farm.name", "farm.city", "farm.admin_name"])),
    db.select({ total: sql<number>`count(*)::int` }).from(budgets),
    db.select({
      id: eggProduction.id,
      date: eggProduction.date,
      species: eggProduction.species,
      batchId: eggProduction.batchId,
      locationId: eggProduction.locationId,
      totalCollected: eggProduction.totalCollected,
      broken: eggProduction.broken,
      forIncubation: eggProduction.forIncubation,
      referenceUnitPrice: eggProduction.referenceUnitPrice,
    })
      .from(eggProduction)
      .orderBy(desc(eggProduction.date), desc(eggProduction.createdAt))
      .limit(1),
    db.select({
      feedId: feedMovements.feedId,
      feedName: feedInventory.name,
      feedUnit: feedInventory.unit,
      quantity: feedMovements.quantity,
      locationId: feedMovements.locationId,
      date: feedMovements.date,
    })
      .from(feedMovements)
      .leftJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
      .where(and(eq(feedMovements.isEntry, false), inArray(feedMovements.movementType, ["consumo_programa", "consumo_manual", "uso_interno"])))
      .orderBy(desc(feedMovements.date), desc(feedMovements.createdAt))
      .limit(1),
  ]);

  const lastEgg = lastEggRows[0] || null;
  const lastEggDetails = lastEgg
    ? await db.select({ size: eggProductionDetails.size, quantity: eggProductionDetails.quantity })
      .from(eggProductionDetails)
      .where(eq(eggProductionDetails.productionId, lastEgg.id))
    : [];

  const productiveStages = stages.filter((stage) => Number(stage.expectedEggsPerHen || 0) > 0);
  const presentHens = henRows.filter((hen) => isHenPresent(hen.status));
  const referenceDate = new Date(`${today}T12:00:00`);
  const eligibleHens = henRows.filter((hen) => hen.status === "activa"
    && !!stageForAge(productiveStages, ageInWeeks(hen.birthDate, referenceDate)));
  const presentRoosters = roosterRows.filter((row) => isRoosterPresent(row.status));
  const presentBatches = batchRows.filter((batch) => isBatchPresent(batch.status, batch.currentQuantity));
  const presentAnimals = presentHens.length + presentRoosters.length
    + presentBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
  const eligibleBatches = batchRows.filter((batch) => {
    if (!(["codorniz", "pato"].includes(batch.species) && batch.purpose === "postura_huevo" && isBatchPresent(batch.status, batch.currentQuantity))) return false;
    const breed = String(batch.breed || "").toLowerCase();
    const params = speciesParams.find((item) => item.species === batch.species && breed && item.breed.toLowerCase().includes(breed))
      || speciesParams.find((item) => item.species === batch.species);
    return !!params && ageInWeeks(batch.startDate, referenceDate) >= params.cycleWeeks;
  });
  const productiveBatchSpecies = new Map(eligibleBatches.map((batch) => [batch.id, batch.species]));
  const eggApplicable = eligibleHens.length + eligibleBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0) > 0;
  const eggCollectedToday = (eligibleHens.length > 0 && eggRows.some((row) => row.species === "gallina" && !row.batchId))
    || eggRows.some((row) => !!row.batchId && productiveBatchSpecies.get(row.batchId) === row.species);
  const eggCollectedCountToday = eggRows.reduce((sum, row) => sum + Number(row.totalCollected || 0), 0);

  const programmedStageIds = new Set(programRows.map((program) => program.stageId));
  const hasFeedingProgram = (species: string, ageWeeks: number) => {
    const applicableStages = stages.filter((stage) => !stage.tipo || stage.tipo === species || (species === "gallo" && stage.tipo === "gallina"));
    const stage = stageForAge(applicableStages, ageWeeks);
    return !!stage && programmedStageIds.has(stage.id);
  };
  const feedApplicable = presentHens.some((hen) => hasFeedingProgram("gallina", ageInWeeks(hen.birthDate, referenceDate)))
    || presentRoosters.some((rooster) => hasFeedingProgram("gallo", ageInWeeks(rooster.birthDate, referenceDate)))
    || presentBatches.some((batch) => hasFeedingProgram(batch.species, ageInWeeks(batch.startDate, referenceDate)));
  const sanitaryEvent = pendingSanitary[0] || null;
  const lastFeed = lastFeedRows[0] || null;

  return NextResponse.json({
    eggApplicable,
    eggCollectedToday,
    eggCollectedCountToday,
    feedApplicable,
    feedMovedToday: feedRows.length > 0,
    setup: {
      farmProfileConfigured: ["farm.name", "farm.city", "farm.admin_name"].every((key) =>
        Boolean(farmProfileValues.find((item) => item.key === key)?.value.trim())),
      locationsConfigured: (locationsCount[0]?.total || 0) > 0,
      animalsRegistered: presentAnimals > 0,
      starterInventoryConfigured: (feedStockCount[0]?.total || 0) > 0 && (supplyStockCount[0]?.total || 0) > 0,
      contactsConfigured:
        ((clientCount[0]?.total || 0) > 0 || (contactClientCount[0]?.total || 0) > 0) &&
        ((supplierCount[0]?.total || 0) > 0 || (contactSupplierCount[0]?.total || 0) > 0),
      budgetConfigured: (budgetCount[0]?.total || 0) > 0,
      assetsRegistered: (registeredAssetsCount[0]?.total || 0) > 0,
      sanitaryConfigured: (sanitaryCount[0]?.total || 0) > 0 && Boolean(sanitaryReview[0]?.value),
    },
    pendingSanitary: sanitaryEvent ? {
      id: sanitaryEvent.id,
      name: sanitaryEvent.name,
      type: sanitaryEvent.type,
      description: sanitaryEvent.description,
      targetBirds: sanitaryEvent.targetBirds,
      frequencyDays: sanitaryEvent.frequencyDays,
      dueDate: sanitaryEvent.nextDueDate,
      isOverdue: sanitaryEvent.nextDueDate < today,
    } : null,
    pendingSanitaryList: pendingSanitary.map((ev) => ({
      id: ev.id,
      name: ev.name,
      type: ev.type,
      description: ev.description,
      targetBirds: ev.targetBirds,
      frequencyDays: ev.frequencyDays,
      dueDate: ev.nextDueDate,
      isOverdue: ev.nextDueDate < today,
    })),
    maintenanceDue: maintenanceDue.map((task) => ({ ...task, isOverdue: task.scheduledDate < today })),
    maintenanceDueCount: maintenanceDueCount[0]?.total || 0,
    assetsNeedAttention: assetsNeedAttention[0]?.total || 0,
    lastEggRecord: lastEgg ? {
      species: lastEgg.species,
      batchId: lastEgg.batchId,
      locationId: lastEgg.locationId,
      totalCollected: lastEgg.totalCollected,
      broken: lastEgg.broken,
      forIncubation: lastEgg.forIncubation,
      referenceUnitPrice: lastEgg.referenceUnitPrice,
      details: lastEggDetails,
    } : null,
    lastFeedRecord: lastFeed ? {
      feedId: lastFeed.feedId,
      feedName: lastFeed.feedName,
      feedUnit: lastFeed.feedUnit,
      quantity: lastFeed.quantity,
      locationId: lastFeed.locationId,
      date: lastFeed.date,
    } : null,
  });
});

