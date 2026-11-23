import { eq } from "drizzle-orm";
import { db } from "@/db";
import { feedInventory } from "@/db/schema";
import { currentFeedCategory, currentFeedType, inferFeedCatalogGroup, normalizeFeedCatalogGroup } from "@/lib/feed-classification";
import { STARTER_FEED_DEFINITIONS } from "@/lib/feeding/default-tenant-seed";
import { findStandardFeedById } from "@/lib/feeding/standard-feed-catalog";
import { inferDefaultImageByFeed, inferDefaultSpeciesByFeed } from "@/lib/feeding/feed-catalog-metadata";

type DbClient = Pick<typeof db, "select" | "update" | "insert">;

export interface FeedAlignmentMatch {
  standardCatalogId: string | null;
  feedType?: typeof feedInventory.$inferSelect["feedType"];
  sanitaryStatus?: string | null;
  dryMatterPct?: string;
  crudeProteinPct?: string;
  energyKcalKgDm?: string;
  calciumDmPct?: string;
  availablePhosphorusDmPct?: string;
  lysineDigDmPct?: string;
  metCysDigDmPct?: string;
  crudeFiberDmPct?: string;
}

const normalizeName = (value: string) =>
  value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

/**
 * Resuelve el alimento estandarizado equivalente para nombres históricos o legados en `feed_inventory`.
 * Nunca modifica precios, stock ni proveedor existente; solo propone vínculo `IG-xxx` y datos faltantes.
 */
export function inferLegacyFeedAlignment(name: string, feedType?: string | null): FeedAlignmentMatch | null {
  const n = normalizeName(name);
  const starterExact = STARTER_FEED_DEFINITIONS.find((d) => normalizeName(d.name) === n);
  if (starterExact) {
    return {
      standardCatalogId: starterExact.standardCatalogId ?? null,
      feedType: starterExact.feedType,
      sanitaryStatus: starterExact.sanitaryStatus ?? "CONDICIONAL",
      dryMatterPct: starterExact.dryMatterPct,
      crudeProteinPct: starterExact.crudeProteinPct,
      energyKcalKgDm: starterExact.energyKcalKgDm,
      calciumDmPct: starterExact.calciumDmPct,
      availablePhosphorusDmPct: starterExact.availablePhosphorusDmPct,
      lysineDigDmPct: starterExact.lysineDigDmPct,
      metCysDigDmPct: starterExact.metCysDigDmPct,
      crudeFiberDmPct: starterExact.crudeFiberDmPct,
    };
  }

  if (n.includes("postura") && !n.includes("pre") && !n.includes("codorniz")) {
    return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "conc_postura")!, standardCatalogId: "IG-001" };
  }
  if (n.includes("pre-postura") || n.includes("prepostura")) {
    return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "conc_pre_postura")!, standardCatalogId: "IG-002" };
  }
  if (n.includes("levante") || n.includes("desarrollo") || n.includes("pollo engorde") || n.includes("finalizacion")) {
    const isPollo = n.includes("pollo");
    const def = STARTER_FEED_DEFINITIONS.find((d) => d.key === (isPollo ? "conc_pollo_engorde" : "conc_levante"))!;
    return { ...def, feedType: def.feedType, standardCatalogId: isPollo ? "IG-120" : "IG-003" };
  }
  if (n.includes("iniciacion") || n.includes("pre-iniciador") || n.includes("pollo inicio")) {
    const isCodorniz = n.includes("codorniz");
    const def = STARTER_FEED_DEFINITIONS.find((d) =>
      d.key === (isCodorniz ? "conc_codorniz_cria" : n.includes("pollo") ? "conc_pollo_inicio" : "conc_pollita_inicio"),
    )!;
    return { ...def, feedType: def.feedType, standardCatalogId: isCodorniz ? "IG-121" : "IG-004" };
  }
  if (n.includes("codorniz")) {
    const def = STARTER_FEED_DEFINITIONS.find((d) => d.key === "conc_codorniz")!;
    return { ...def, feedType: def.feedType, standardCatalogId: "IG-122" };
  }
  if (n.includes("conejo") && n.includes("cuy")) {
    const def = STARTER_FEED_DEFINITIONS.find((d) => d.key === "conc_conejo_cuy")!;
    return { ...def, feedType: def.feedType, standardCatalogId: "IG-126" };
  }
  if (n.includes("cuy") || n.includes("curi")) {
    if (n.includes("alfalfa") || n.includes("forraje")) {
      return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "forraje_oreado")!, standardCatalogId: "IG-058" };
    }
    const def = STARTER_FEED_DEFINITIONS.find((d) => d.key === "conc_cuy")!;
    return { ...def, feedType: def.feedType, standardCatalogId: "IG-125" };
  }
  if (n.includes("conejo")) {
    if (n.includes("alfalfa") || n.includes("forraje")) {
      return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "forraje_oreado")!, standardCatalogId: "IG-058" };
    }
    const def = STARTER_FEED_DEFINITIONS.find((d) => d.key === "conc_conejo")!;
    return { ...def, feedType: def.feedType, standardCatalogId: "IG-124" };
  }
  if (n.includes("pato")) {
    const def = STARTER_FEED_DEFINITIONS.find((d) => d.key === "conc_pato")!;
    return { ...def, feedType: def.feedType, standardCatalogId: "IG-123" };
  }
  if (n.includes("alfalfa")) {
    return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "forraje_oreado")!, standardCatalogId: "IG-058" };
  }
  if (n.includes("bore")) {
    return {
      standardCatalogId: "IG-042",
      sanitaryStatus: "RESTRINGIDO",
      dryMatterPct: "18.00",
      crudeProteinPct: "3.50",
      energyKcalKgDm: "2550.00",
      calciumDmPct: "0.35",
      availablePhosphorusDmPct: "0.18",
      crudeFiberDmPct: "8.50",
    };
  }
  if (n.includes("bsf") || n.includes("mosca") || feedType === "mosca_soldado" || feedType === "Mosca Soldado") {
    return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "larvas_bsf")!, standardCatalogId: "IG-007" };
  }
  if (n.includes("germinado") || feedType === "maiz_germinado" || feedType === "Maíz Germinado") {
    return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "maiz_germinado")!, standardCatalogId: "IG-031" };
  }
  if (n.includes("maiz") || feedType === "maiz_comprado" || feedType === "Maiz en Grano") {
    return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "maiz_grano")!, standardCatalogId: "IG-015" };
  }
  if (n.includes("pasto") || n.includes("graminea") || feedType === "pastos_gramineas") {
    return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "pastos_gramineas")!, standardCatalogId: "IG-071" };
  }
  if (n.includes("carbonato")) {
    return { ...STARTER_FEED_DEFINITIONS.find((d) => d.key === "carbonato_calcio")!, standardCatalogId: "IG-115" };
  }
  if (n.includes("conchilla")) {
    return {
      standardCatalogId: "IG-114",
      sanitaryStatus: "CONDICIONAL",
      dryMatterPct: "99.00",
      crudeProteinPct: "0.00",
      energyKcalKgDm: "0.00",
      calciumDmPct: "38.00",
      availablePhosphorusDmPct: "0.00",
      crudeFiberDmPct: "0.00",
    };
  }

  return null;
}

export interface AlignFarmCatalogResult {
  updatedFeeds: number;
  alignedStandardIds: string[];
  seededMissingStandards: number;
}

/**
 * Alinea idempotentemente los alimentos existentes de una finca con `Catalogo Alimentos.csv`:
 * normaliza categorías/tipos legados, asigna `standardCatalogId` cuando aplica y completa
 * únicamente campos nutricionales vacíos (`null`), sin perder stock, costos ni movimientos.
 */
export async function alignFarmFeedsToStandardCatalog(
  farmId: string,
  client: DbClient = db,
  options: { seedStarterCalciumAndRoot?: boolean } = {},
): Promise<AlignFarmCatalogResult> {
  const existing = await client
    .select()
    .from(feedInventory)
    .where(eq(feedInventory.farmId, farmId));

  let updatedFeeds = 0;
  const alignedStandardIds = new Set<string>();

  for (const row of existing) {
    const LEGACY_GENERIC_POULTRY = new Set(["IG-001", "IG-002", "IG-003", "IG-004", "IG-005"]);
    const SPECIES_SPECIFIC_CATALOG_IDS = new Set(["IG-120", "IG-121", "IG-122", "IG-123", "IG-124", "IG-125", "IG-126"]);
    const inferred = inferLegacyFeedAlignment(row.name, row.feedType);
    const upgradedDedicatedConcentrate =
      Boolean(row.standardCatalogId && LEGACY_GENERIC_POULTRY.has(row.standardCatalogId)) &&
      Boolean(inferred?.standardCatalogId && SPECIES_SPECIFIC_CATALOG_IDS.has(inferred.standardCatalogId));
    const nextStdId = upgradedDedicatedConcentrate
      ? inferred!.standardCatalogId
      : row.standardCatalogId ?? inferred?.standardCatalogId ?? null;
    const std = findStandardFeedById(nextStdId);
    const nextCategory = currentFeedCategory(row.category) ?? row.category;
    const rawFeedType = upgradedDedicatedConcentrate && inferred?.feedType ? inferred.feedType : row.feedType;
    const nextFeedType = currentFeedType(rawFeedType) ?? rawFeedType;
    const nextCatalogGroup =
      std?.group ??
      normalizeFeedCatalogGroup(row.catalogGroup) ??
      inferFeedCatalogGroup(nextFeedType, row.name, nextCategory);
    const nextSanitary = row.sanitaryStatus ?? std?.sanitaryStatus ?? inferred?.sanitaryStatus ?? null;
    const nextDryMatter =
      row.dryMatterPct ??
      (std?.dryMatterPct != null ? std.dryMatterPct.toFixed(2) : inferred?.dryMatterPct ?? null);
    const nextCrudeProtein =
      row.crudeProteinPct ??
      (std?.crudeProteinAsFedPct != null ? std.crudeProteinAsFedPct.toFixed(2) : inferred?.crudeProteinPct ?? null);
    const nextEnergy =
      row.energyKcalKgDm ??
      (std?.energyKcalKgDm != null ? std.energyKcalKgDm.toFixed(2) : inferred?.energyKcalKgDm ?? null);
    const nextCalcium =
      row.calciumDmPct ??
      (std?.calciumDmPct != null ? std.calciumDmPct.toFixed(2) : inferred?.calciumDmPct ?? null);
    const nextPhosphorus =
      row.availablePhosphorusDmPct ??
      (std?.availablePhosphorusDmPct != null
        ? std.availablePhosphorusDmPct.toFixed(2)
        : inferred?.availablePhosphorusDmPct ?? null);
    const nextLysine =
      row.lysineDigDmPct ??
      (std?.lysineDigDmPct != null ? std.lysineDigDmPct.toFixed(2) : inferred?.lysineDigDmPct ?? null);
    const nextMetCys =
      row.metCysDigDmPct ??
      (std?.metCysDigDmPct != null ? std.metCysDigDmPct.toFixed(2) : inferred?.metCysDigDmPct ?? null);
    const nextFiber =
      row.crudeFiberDmPct ??
      (std?.crudeFiberDmPct != null ? std.crudeFiberDmPct.toFixed(2) : inferred?.crudeFiberDmPct ?? null);
    const nextProfile =
      row.nutritionProfile ??
      (std
        ? {
            group: std.group,
            botanicalName: std.botanicalName,
            presentation: std.presentation,
            origin: std.origin,
            preparation: std.preparation,
            evidenceQuality: std.evidenceQuality,
            risks: std.risks,
            sourceUrl: std.sourceUrl,
          }
        : null);

    const existingSpecies = Array.isArray(row.allowedSpecies) ? row.allowedSpecies : [];
    const nextAllowedSpecies =
      existingSpecies.length > 0 && !upgradedDedicatedConcentrate
        ? existingSpecies
        : std?.targetSpecies ??
          inferDefaultSpeciesByFeed({
            standardCatalogId: nextStdId,
            group: nextCatalogGroup,
            feedType: nextFeedType,
            name: row.name,
            sanitaryStatus: nextSanitary,
          });
    const nextImageUrl =
      (!upgradedDedicatedConcentrate ? row.imageUrl : null) ||
      std?.imageUrl ||
      inferDefaultImageByFeed({
        standardCatalogId: nextStdId,
        group: nextCatalogGroup,
        feedType: nextFeedType,
        name: row.name,
      });
    const nextDescription = row.description || std?.description || null;
    const existingRegional = Array.isArray(row.regionalNames) ? row.regionalNames : [];
    const nextRegionalNames =
      existingRegional.length > 0 ? existingRegional : std?.regionalNames ?? [];

    const changed =
      nextCategory !== row.category ||
      nextFeedType !== row.feedType ||
      nextStdId !== row.standardCatalogId ||
      nextCatalogGroup !== row.catalogGroup ||
      nextSanitary !== row.sanitaryStatus ||
      nextDryMatter !== row.dryMatterPct ||
      nextCrudeProtein !== row.crudeProteinPct ||
      nextEnergy !== row.energyKcalKgDm ||
      nextCalcium !== row.calciumDmPct ||
      nextPhosphorus !== row.availablePhosphorusDmPct ||
      nextLysine !== row.lysineDigDmPct ||
      nextMetCys !== row.metCysDigDmPct ||
      nextFiber !== row.crudeFiberDmPct ||
      (!row.nutritionProfile && nextProfile !== null) ||
      (JSON.stringify(existingSpecies) !== JSON.stringify(nextAllowedSpecies) && nextAllowedSpecies.length > 0) ||
      (nextImageUrl !== row.imageUrl && Boolean(nextImageUrl)) ||
      (!row.description && Boolean(nextDescription)) ||
      (existingRegional.length === 0 && nextRegionalNames.length > 0);

    if (changed) {
      await client
        .update(feedInventory)
        .set({
          category: nextCategory,
          feedType: nextFeedType,
          standardCatalogId: nextStdId,
          catalogGroup: nextCatalogGroup,
          sanitaryStatus: nextSanitary,
          dryMatterPct: nextDryMatter,
          crudeProteinPct: nextCrudeProtein,
          energyKcalKgDm: nextEnergy,
          calciumDmPct: nextCalcium,
          availablePhosphorusDmPct: nextPhosphorus,
          lysineDigDmPct: nextLysine,
          metCysDigDmPct: nextMetCys,
          crudeFiberDmPct: nextFiber,
          nutritionProfile: nextProfile,
          allowedSpecies: nextAllowedSpecies,
          imageUrl: nextImageUrl,
          description: nextDescription,
          regionalNames: nextRegionalNames,
          updatedAt: new Date(),
        })
        .where(eq(feedInventory.id, row.id));
      updatedFeeds++;
      if (nextStdId) alignedStandardIds.add(nextStdId);
    }
  }

  let seededMissingStandards = 0;
  if (options.seedStarterCalciumAndRoot) {
    const existingStdSet = new Set(existing.map((r) => r.standardCatalogId).filter(Boolean));
    for (const id of alignedStandardIds) {
      existingStdSet.add(id);
    }
    const essentialKeys = ["carbonato_calcio", "batata_fresca"];
    for (const key of essentialKeys) {
      const def = STARTER_FEED_DEFINITIONS.find((d) => d.key === key);
      if (!def || !def.standardCatalogId) continue;
      if (existingStdSet.has(def.standardCatalogId)) continue;
      const nameHit = existing.some((r) => normalizeName(r.name) === normalizeName(def.name));
      if (nameHit) continue;
      const stdSeed = findStandardFeedById(def.standardCatalogId);
      await client.insert(feedInventory).values({
        farmId,
        name: def.name,
        category: def.category,
        feedType: def.feedType,
        unit: def.unit,
        currentStock: "0",
        minStock: def.minStock,
        costPerUnit: "0",
        supplier: null,
        dryMatterPct: def.dryMatterPct,
        crudeProteinPct: def.crudeProteinPct,
        standardCatalogId: def.standardCatalogId,
        catalogGroup: stdSeed?.group ?? inferFeedCatalogGroup(def.feedType, def.name, def.category),
        sanitaryStatus: def.sanitaryStatus ?? "CONDICIONAL",
        energyKcalKgDm: def.energyKcalKgDm ?? null,
        calciumDmPct: def.calciumDmPct ?? null,
        availablePhosphorusDmPct: def.availablePhosphorusDmPct ?? null,
        crudeFiberDmPct: def.crudeFiberDmPct ?? null,
        allowedSpecies: stdSeed?.targetSpecies ?? inferDefaultSpeciesByFeed({ standardCatalogId: def.standardCatalogId, name: def.name }),
        imageUrl: stdSeed?.imageUrl ?? inferDefaultImageByFeed({ standardCatalogId: def.standardCatalogId, name: def.name }),
        description: stdSeed?.description ?? null,
        regionalNames: stdSeed?.regionalNames ?? [],
      });
      seededMissingStandards++;
    }
  }

  return {
    updatedFeeds,
    alignedStandardIds: Array.from(alignedStandardIds),
    seededMissingStandards,
  };
}
