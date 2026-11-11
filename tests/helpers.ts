import { db, pool } from "@/db";
import {
  hens, feedInventory, feedMovements, feedPrograms,
  eggProduction, eggProductionDetails, eggSales, eggSalesItems,
  transactions, catalogos, roosters, broilerBatches, incubation,
  chickenSales, slaughter, manureSales, manureAdjustments, manureProduction,
  birdAcquisitions,
  farmLocations, animalLocationMovements,
} from "@/db/schema";
import { eq, inArray, and, or } from "drizzle-orm";

/** Build a Next.js-compatible Request object for API route testing */
export function mockRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): any {
  const { method = "GET", body } = options;
  return new Request(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Parse JSON from a route handler response */
export async function parseJson(res: Response): Promise<any> {
  return res.json();
}

/** Track created IDs for cleanup */
export interface TestCleanup {
  transactionIds: string[];
  saleIds: string[];
  movementIds: string[];
  productionIds: string[];
  feedIds: string[];
  acquisitionIds: string[];
  henIds: string[];
  catalogoIds: string[];
  programIds: string[];
  roosterIds: string[];
  batchIds: string[];
  incubationIds: string[];
  chickenSaleIds: string[];
  slaughterIds: string[];
  locationIds: string[];
}

export function createCleanup(): TestCleanup {
  return {
    transactionIds: [],
    saleIds: [],
    movementIds: [],
    productionIds: [],
    productionDetailIds: [],
    feedIds: [],
    acquisitionIds: [],
    henIds: [],
    catalogoIds: [],
    programIds: [],
    roosterIds: [],
    batchIds: [],
    incubationIds: [],
    chickenSaleIds: [],
    slaughterIds: [],
    locationIds: [],
  } as TestCleanup & { productionDetailIds: string[] };
}

/** Clean up all test data by tracked IDs */
export async function cleanup(c: TestCleanup & { productionDetailIds?: string[] }) {
  if (c.locationIds.length) {
    await db.delete(animalLocationMovements).where(or(
      inArray(animalLocationMovements.fromLocationId, c.locationIds),
      inArray(animalLocationMovements.toLocationId, c.locationIds),
    ));
  }
  if (c.productionDetailIds?.length) {
    await db.delete(eggProductionDetails).where(inArray(eggProductionDetails.productionId, c.productionIds));
  }
  if (c.transactionIds.length) await db.delete(transactions).where(inArray(transactions.id, c.transactionIds));
  // Transacciones vinculadas a ventas/sacrificios de prueba
  if (c.chickenSaleIds.length) {
    await db.delete(transactions).where(and(eq(transactions.sourceType, "venta_ave"), inArray(transactions.sourceId, c.chickenSaleIds)));
  }
  if (c.slaughterIds.length) {
    await db.delete(transactions).where(and(eq(transactions.sourceType, "sacrificio"), inArray(transactions.sourceId, c.slaughterIds)));
  }
  if (c.chickenSaleIds.length) await db.delete(chickenSales).where(inArray(chickenSales.id, c.chickenSaleIds));
  if (c.slaughterIds.length) await db.delete(slaughter).where(inArray(slaughter.id, c.slaughterIds));
  if (c.incubationIds.length) await db.delete(incubation).where(inArray(incubation.id, c.incubationIds));
  if (c.saleIds.length) {
    await db.delete(eggSalesItems).where(inArray(eggSalesItems.saleId, c.saleIds));
    await db.delete(eggSales).where(inArray(eggSales.id, c.saleIds));
  }
  const feedMovementRows = c.feedIds.length
    ? await db.select({ id: feedMovements.id }).from(feedMovements).where(inArray(feedMovements.feedId, c.feedIds))
    : [];
  const allTestMovementIds = [...new Set([...c.movementIds, ...feedMovementRows.map((row) => row.id)])];
  if (allTestMovementIds.length) {
    await db.delete(transactions).where(and(
      eq(transactions.sourceType, "alimento"),
      inArray(transactions.sourceId, allTestMovementIds),
    ));
    await db.delete(feedMovements).where(inArray(feedMovements.id, allTestMovementIds));
  }
  if (c.productionIds.length) await db.delete(eggProduction).where(inArray(eggProduction.id, c.productionIds));
  if (c.feedIds.length) await db.delete(feedInventory).where(inArray(feedInventory.id, c.feedIds));
  if (c.henIds.length) await db.delete(hens).where(inArray(hens.id, c.henIds));
  if (c.roosterIds.length) await db.delete(roosters).where(inArray(roosters.id, c.roosterIds));
  if (c.batchIds.length) await db.delete(broilerBatches).where(inArray(broilerBatches.id, c.batchIds));
  if (c.acquisitionIds.length) await db.delete(birdAcquisitions).where(inArray(birdAcquisitions.id, c.acquisitionIds));
  if (c.locationIds.length) await db.delete(farmLocations).where(inArray(farmLocations.id, c.locationIds));
  if (c.catalogoIds.length) await db.delete(catalogos).where(inArray(catalogos.id, c.catalogoIds));
  if (c.programIds.length) await db.delete(feedPrograms).where(inArray(feedPrograms.id, c.programIds));
}

/** Create an isolated place used by API tests that require a known destination. */
export async function createTestFarmLocation() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [location] = await db.insert(farmLocations).values({
    code: `TEST-${suffix}`,
    name: `Lugar de prueba ${suffix}`,
    type: "galpon",
  }).returning();
  return location;
}

/** Purge all manure transactional data (sales, adjustments, production) to ensure clean state */
export async function purgeManureData() {
  await db.delete(manureSales);
  await db.delete(manureAdjustments);
  await db.delete(manureProduction);
}

/** Get a reference feed from the seed data (doesn't need cleanup) */
export async function getSeedFeed(feedType: string) {
  const feeds = await db.select().from(feedInventory);
  return feeds.find((f) => f.feedType === feedType);
}

/** Get a reference stage from the seed data */
export async function getSeedStage(value: string) {
  const stages = await db.select().from(catalogos).where(eq(catalogos.category, "etapa_crecimiento"));
  return stages.find((s) => s.value === value);
}

/** Get a seed size catalog entry */
export async function getSeedSize(value: string) {
  const sizes = await db.select().from(catalogos).where(eq(catalogos.category, "tamano_huevo"));
  return sizes.find((s) => s.value === value);
}

/** Create a test feed in the database */
export async function createTestFeed(overrides: Partial<{
  name: string; category: string; feedType: string; unit: string;
  currentStock: string; minStock: string; costPerUnit: string; supplier: string | null;
}> = {}) {
  const defaults = {
    name: "Test Feed " + Date.now(),
    category: "suplementario" as const,
    feedType: "otro" as const,
    unit: "kg",
    currentStock: "100",
    minStock: "10",
    costPerUnit: "5000",
    supplier: null as string | null,
  };
  const values = { ...defaults, ...overrides };
  const [created] = await db.insert(feedInventory).values(values as typeof defaults).returning();
  return created;
}

/** Create a test catalogue entry */
export async function createTestCatalogo(overrides: Partial<{
  category: string; value: string; minWeeks: number; maxWeeks: number | null;
  expectedEggsPerHen: string; sortOrder: number;
}> = {}) {
  const defaults = {
    category: "test_category",
    value: "test_" + Date.now(),
    sortOrder: 99,
  };
  const values = { ...defaults, ...overrides };
  const [created] = await db.insert(catalogos).values(values).returning();
  return created;
}

export { db, pool };
