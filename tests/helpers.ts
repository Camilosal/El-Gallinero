import { db, pool } from "@/db";
import {
  hens, feedInventory, feedMovements, feedPrograms,
  eggProduction, eggProductionDetails, eggSales, eggSalesItems,
  transactions, catalogos, roosters, broilerBatches, incubation,
  chickenSales, slaughter,
} from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

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
  henIds: string[];
  catalogoIds: string[];
  programIds: string[];
  roosterIds: string[];
  batchIds: string[];
  incubationIds: string[];
  chickenSaleIds: string[];
  slaughterIds: string[];
}

export function createCleanup(): TestCleanup {
  return {
    transactionIds: [],
    saleIds: [],
    movementIds: [],
    productionIds: [],
    productionDetailIds: [],
    feedIds: [],
    henIds: [],
    catalogoIds: [],
    programIds: [],
    roosterIds: [],
    batchIds: [],
    incubationIds: [],
    chickenSaleIds: [],
    slaughterIds: [],
  } as TestCleanup & { productionDetailIds: string[] };
}

/** Clean up all test data by tracked IDs */
export async function cleanup(c: TestCleanup & { productionDetailIds?: string[] }) {
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
  if (c.movementIds.length) await db.delete(feedMovements).where(inArray(feedMovements.id, c.movementIds));
  if (c.productionIds.length) await db.delete(eggProduction).where(inArray(eggProduction.id, c.productionIds));
  if (c.feedIds.length) await db.delete(feedInventory).where(inArray(feedInventory.id, c.feedIds));
  if (c.henIds.length) await db.delete(hens).where(inArray(hens.id, c.henIds));
  if (c.roosterIds.length) await db.delete(roosters).where(inArray(roosters.id, c.roosterIds));
  if (c.batchIds.length) await db.delete(broilerBatches).where(inArray(broilerBatches.id, c.batchIds));
  if (c.catalogoIds.length) await db.delete(catalogos).where(inArray(catalogos.id, c.catalogoIds));
  if (c.programIds.length) await db.delete(feedPrograms).where(inArray(feedPrograms.id, c.programIds));
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
