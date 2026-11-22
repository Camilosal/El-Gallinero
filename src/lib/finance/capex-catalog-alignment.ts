import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { catalogos, farmAssets } from "@/db/schema";
import {
  findStandardCapexFamily,
  PRODUCTIVE_CAPEX_FAMILIES,
  resolveCapexClassification,
} from "./standard-capex-catalog";

type DbClient = Pick<typeof db, "select" | "update" | "insert">;

export interface AlignCapexCatalogResult {
  updatedAssets: number;
  addedCatalogEntries: number;
}

/**
 * Estandariza idempotentemente los activos históricos de una finca (`farm_assets`)
 * y opcionalmente sincroniza las 20 familias productivas de CAPEX en la lista
 * `categoria_capex` de `catalogos`.
 * Nunca modifica costos de adquisición, valores residuales, fechas ni estados operativos.
 */
export async function alignFarmCapexCatalog(
  farmId: string,
  client: DbClient = db,
  options: { syncCatalogosList?: boolean } = {},
): Promise<AlignCapexCatalogResult> {
  const assetRows = await client
    .select()
    .from(farmAssets)
    .where(eq(farmAssets.farmId, farmId));

  let updatedAssets = 0;
  for (const asset of assetRows) {
    const resolved = resolveCapexClassification({
      capexCatalogId: asset.capexCatalogId,
      capexFamily: asset.capexFamily,
      capexSubfamily: asset.capexSubfamily,
      capexClassification: asset.capexClassification,
      capexDestination: asset.capexDestination,
      capexDriver: asset.capexDriver,
      name: asset.name,
      category: asset.category,
      description: asset.description,
      usefulLifeMonths: asset.usefulLifeMonths,
    });

    const nextCatalogId = asset.capexCatalogId ?? resolved.capexCatalogId ?? null;
    const nextFamily = asset.capexFamily ?? resolved.capexFamily ?? null;
    const nextSubfamily = asset.capexSubfamily ?? resolved.capexSubfamily ?? null;
    const nextClassification = asset.capexClassification ?? resolved.capexClassification ?? null;
    const nextDestination = asset.capexDestination ?? resolved.capexDestination ?? null;
    const nextDriver = asset.capexDriver ?? resolved.capexDriver ?? null;

    if (
      nextCatalogId !== asset.capexCatalogId ||
      nextFamily !== asset.capexFamily ||
      nextSubfamily !== asset.capexSubfamily ||
      nextClassification !== asset.capexClassification ||
      nextDestination !== asset.capexDestination ||
      nextDriver !== asset.capexDriver
    ) {
      await client
        .update(farmAssets)
        .set({
          capexCatalogId: nextCatalogId,
          capexFamily: nextFamily,
          capexSubfamily: nextSubfamily,
          capexClassification: nextClassification,
          capexDestination: nextDestination,
          capexDriver: nextDriver,
          updatedAt: new Date(),
        })
        .where(eq(farmAssets.id, asset.id));
      updatedAssets++;
    }
  }

  let addedCatalogEntries = 0;
  if (options.syncCatalogosList !== false) {
    const existing = await client
      .select({ value: catalogos.value })
      .from(catalogos)
      .where(and(eq(catalogos.farmId, farmId), eq(catalogos.category, "categoria_capex")));

    const existingSet = new Set(existing.map((e) => e.value.trim()));
    for (let idx = 0; idx < PRODUCTIVE_CAPEX_FAMILIES.length; idx++) {
      const fam = PRODUCTIVE_CAPEX_FAMILIES[idx];
      const metaFam = findStandardCapexFamily(fam.name) ?? fam;
      if (existingSet.has(metaFam.name)) continue;
      await client
        .insert(catalogos)
        .values({
          farmId,
          category: "categoria_capex",
          value: metaFam.name,
          tipo: metaFam.defaultClassification,
          description: `${metaFam.conceptsCount} conceptos (${metaFam.p1Count} P1) del Catálogo Maestro de CapEx e Inversiones`,
          sortOrder: idx,
          isActive: true,
        })
        .onConflictDoNothing();
      addedCatalogEntries++;
    }
  }

  return {
    updatedAssets,
    addedCatalogEntries,
  };
}
