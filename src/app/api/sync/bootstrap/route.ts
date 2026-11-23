import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  broilerBatches,
  farmLocations,
  feedInventory,
  healthControl,
  hens,
  roosters,
  supplyInventory,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { withApiHandler } from "@/lib/api-handler";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";
import { todayColombiaIso } from "@/lib/date-validation";
import { getProgressiveOnboardingState } from "@/lib/onboarding-server";
import { loadSpeciesParams } from "@/lib/species-db";
import { getStandardCurves, type CurveSpecies } from "@/lib/standard-curves";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction } from "@/lib/rbac";
import { inferFeedCatalogGroup, normalizeFeedCatalogGroup } from "@/lib/feed-classification";
import { resolveEffectiveFeedProfile } from "@/lib/feeding/standard-feed-catalog";

export const dynamic = "force-dynamic";

const CURVE_SPECIES: CurveSpecies[] = ["gallina", "pollo", "codorniz", "pato", "conejo", "cuy"];

export const GET = withApiHandler(async () => {
  const user = await getSessionUser();
  const canSeeCosts = canPerformAction(user?.role, "finance:read");
  const canUseFarmOperations =
    canPerformAction(user?.role, "production:write") ||
    canPerformAction(user?.role, "animal_metrics:write") ||
    canPerformAction(user?.role, "sanitary:write");
  const today = todayColombiaIso();

  const [
    locations,
    activeBatches,
    henCountRows,
    roosterCountRows,
    feeds,
    supplies,
    activeWithdrawals,
    onboardingState,
    speciesParams,
  ] = await Promise.all([
    db
      .select()
      .from(farmLocations)
      .where(eq(farmLocations.status, "activa"))
      .orderBy(farmLocations.name),
    db
      .select()
      .from(broilerBatches)
      .where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"]))
      .orderBy(desc(broilerBatches.startDate)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(hens)
      .where(inArray(hens.status, [...HEN_PRESENT_STATUSES] as (typeof hens.status.enumValues)[number][])),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(roosters)
      .where(eq(roosters.status, "activo")),
    db.select().from(feedInventory).orderBy(feedInventory.name),
    db.select().from(supplyInventory).orderBy(supplyInventory.name),
    db
      .select({
        id: healthControl.id,
        date: healthControl.date,
        species: healthControl.species,
        locationId: healthControl.locationId,
        batchId: healthControl.batchId,
        type: healthControl.type,
        product: healthControl.product,
        withdrawalDays: healthControl.withdrawalDays,
        withdrawalUntilDate: healthControl.withdrawalUntilDate,
      })
      .from(healthControl)
      .where(
        and(
          isNotNull(healthControl.withdrawalUntilDate),
          gte(healthControl.withdrawalUntilDate, today),
        ),
      )
      .orderBy(desc(healthControl.withdrawalUntilDate)),
    getProgressiveOnboardingState(),
    loadSpeciesParams(),
  ]);

  const standardCurves = Object.fromEntries(
    CURVE_SPECIES.map((sp) => [sp, getStandardCurves(sp)]),
  );
  const enrichedFeeds = feeds.map((feed) => {
    const resolvedGroup =
      normalizeFeedCatalogGroup(feed.catalogGroup) ??
      inferFeedCatalogGroup(feed.feedType, feed.name, feed.category);
    const profile = resolveEffectiveFeedProfile({
      name: feed.name,
      feedType: feed.feedType,
      category: feed.category,
      catalogGroup: resolvedGroup,
      standardCatalogId: feed.standardCatalogId,
      sanitaryStatus: feed.sanitaryStatus,
      dryMatterPct: feed.dryMatterPct,
      crudeProteinPct: feed.crudeProteinPct,
      energyKcalKgDm: feed.energyKcalKgDm,
      calciumDmPct: feed.calciumDmPct,
      availablePhosphorusDmPct: feed.availablePhosphorusDmPct,
      lysineDigDmPct: feed.lysineDigDmPct,
      metCysDigDmPct: feed.metCysDigDmPct,
      crudeFiberDmPct: feed.crudeFiberDmPct,
      nutritionProfile: (feed.nutritionProfile ?? null) as Record<string, unknown> | null,
      allowedSpecies: feed.allowedSpecies,
      regionalNames: feed.regionalNames,
      description: feed.description,
      imageUrl: feed.imageUrl,
    });
    return {
      ...feed,
      catalogGroup: resolvedGroup,
      allowedSpecies: profile.allowedSpecies,
      regionalNames: profile.regionalNames,
      description: profile.description,
      imageUrl: profile.imageUrl,
    };
  });
  const visibleFeeds = canSeeCosts
    ? enrichedFeeds
    : enrichedFeeds.map((feed) => ({ ...feed, costPerUnit: null, supplier: null }));
  const visibleSupplies = canSeeCosts
    ? supplies
    : supplies.map((supply) => ({ ...supply, costPerUnit: null, supplier: null }));

  return NextResponse.json({
    locations,
    activeBatches: canUseFarmOperations ? activeBatches : [],
    henCount: canUseFarmOperations ? henCountRows[0]?.count ?? 0 : 0,
    roosterCount: canUseFarmOperations ? roosterCountRows[0]?.count ?? 0 : 0,
    feedInventory: visibleFeeds,
    supplyInventory: visibleSupplies,
    activeWithdrawals: canUseFarmOperations ? activeWithdrawals : [],
    standardCurves: canUseFarmOperations ? standardCurves : {},
    speciesParams,
    onboardingState,
    syncedAt: new Date().toISOString(),
  });
});

