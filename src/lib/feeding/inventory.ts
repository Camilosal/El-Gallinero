import { db } from "@/db";
import { feedInventory, feedMovements } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { inferFeedCatalogGroup, normalizeFeedCatalogGroup } from "@/lib/feed-classification";
import { runFeedProgramCatchup } from "./runProgram";

export interface NormalizedMassResult {
  quantityKg: number | null;
  conversionFactor: number | null;
  canonicalUnit: "kg";
  isConvertible: boolean;
}

const MASS_UNIT_TO_KG_FACTOR: Readonly<Record<string, number>> = {
  kg: 1,
  kilogramo: 1,
  kilogramos: 1,
  kilo: 1,
  kilos: 1,
  g: 0.001,
  gr: 0.001,
  gramo: 0.001,
  gramos: 0.001,
  lb: 0.5,
  libra: 0.5,
  libras: 0.5,
  bulto: 40,
  bultos: 40,
  bulto_40kg: 40,
  bultos_40kg: 40,
  saco: 40,
  sacos: 40,
  ton: 1000,
  tonelada: 1000,
  toneladas: 1000,
};

/**
 * DAT-06: Normaliza cantidades de alimento hacia la unidad canónica kg mediante factores verificados.
 * Unidades no másicas (ej. litros o unidades) devuelven `isConvertible: false` y `quantityKg: null`.
 */
export function normalizeFeedQuantityToKg(
  quantity: number | string,
  unit: string | null | undefined,
): NormalizedMassResult {
  const num = Number(quantity);
  const normalizedUnit = String(unit || "kg")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  const factor = MASS_UNIT_TO_KG_FACTOR[normalizedUnit];
  if (!factor || !Number.isFinite(num)) {
    return {
      quantityKg: null,
      conversionFactor: factor ?? null,
      canonicalUnit: "kg",
      isConvertible: Boolean(factor),
    };
  }

  return {
    quantityKg: Math.round(num * factor * 1000) / 1000,
    conversionFactor: factor,
    canonicalUnit: "kg",
    isConvertible: true,
  };
}

export interface FeedInventoryProjection {
  id: string;
  name: string;
  category: string;
  feedType: string;
  unit: string;
  currentStock: string;
  minStock: string;
  costPerUnit: string;
  supplier: string | null;
  dryMatterPct: string | null;
  crudeProteinPct: string | null;
  standardCatalogId: string | null;
  catalogGroup: string | null;
  sanitaryStatus: string | null;
  energyKcalKgDm: string | null;
  calciumDmPct: string | null;
  availablePhosphorusDmPct: string | null;
  lysineDigDmPct: string | null;
  metCysDigDmPct: string | null;
  crudeFiberDmPct: string | null;
  nutritionProfile: unknown;
  estimatedValue: number;
  isLow: boolean;
  daysRemaining: number | null;
  currentStockKg: number | null;
  dailyConsumptionKg: number | null;
  unitConversionVerified: boolean;
}

/**
 * Devuelve el inventario de alimentos con su valor estimado, equivalente en kg canónicos
 * y proyección de días restantes según el consumo registrado en los últimos `days` días.
 *
 * DAT-09: Permite desactivar la materialización automática durante consultas de solo lectura
 * pasando `{ materializeProgramCatchup: false }`.
 */
export async function getFeedInventoryProjection(
  days: number = 30,
  options: { materializeProgramCatchup?: boolean } = {},
): Promise<FeedInventoryProjection[]> {
  const period = Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;

  if (options.materializeProgramCatchup !== false) {
    await runFeedProgramCatchup();
  }

  const inventory = await db
    .select()
    .from(feedInventory)
    .orderBy(desc(feedInventory.createdAt));

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - period);
  const sinceStr = sinceDate.toISOString().split("T")[0];

  const movements = await db
    .select()
    .from(feedMovements)
    .where(
      and(
        eq(feedMovements.isEntry, false),
        sql`${feedMovements.date} >= ${sinceStr}`,
      ),
    );

  // Consumo promedio diario por alimento en unidad original del ítem
  const consumptionByFeed = new Map<string, number>();
  for (const m of movements) {
    const daily = Number(m.quantity) / period;
    consumptionByFeed.set(
      m.feedId,
      (consumptionByFeed.get(m.feedId) || 0) + daily,
    );
  }

  return inventory.map((f) => {
    const dailyConsumption = consumptionByFeed.get(f.id) || 0;
    const currentStock = Number(f.currentStock);
    const estimatedValue = currentStock * Number(f.costPerUnit);
    const isLow = dailyConsumption > 0 && currentStock / dailyConsumption <= 7;
    const daysRemaining =
      dailyConsumption > 0 ? Math.floor(currentStock / dailyConsumption) : null;

    const stockNormalized = normalizeFeedQuantityToKg(currentStock, f.unit);
    const consumptionNormalized = normalizeFeedQuantityToKg(dailyConsumption, f.unit);

    return {
      id: f.id,
      name: f.name,
      category: f.category,
      feedType: f.feedType,
      unit: f.unit,
      currentStock: f.currentStock,
      minStock: f.minStock,
      costPerUnit: f.costPerUnit,
      supplier: f.supplier,
      dryMatterPct: f.dryMatterPct,
      crudeProteinPct: f.crudeProteinPct,
      standardCatalogId: f.standardCatalogId ?? null,
      catalogGroup:
        normalizeFeedCatalogGroup(f.catalogGroup) ??
        inferFeedCatalogGroup(f.feedType, f.name, f.category),
      sanitaryStatus: f.sanitaryStatus ?? null,
      energyKcalKgDm: f.energyKcalKgDm ?? null,
      calciumDmPct: f.calciumDmPct ?? null,
      availablePhosphorusDmPct: f.availablePhosphorusDmPct ?? null,
      lysineDigDmPct: f.lysineDigDmPct ?? null,
      metCysDigDmPct: f.metCysDigDmPct ?? null,
      crudeFiberDmPct: f.crudeFiberDmPct ?? null,
      nutritionProfile: f.nutritionProfile ?? null,
      estimatedValue,
      isLow,
      daysRemaining,
      currentStockKg: stockNormalized.quantityKg,
      dailyConsumptionKg: consumptionNormalized.quantityKg,
      unitConversionVerified: stockNormalized.isConvertible,
    };
  });
}
