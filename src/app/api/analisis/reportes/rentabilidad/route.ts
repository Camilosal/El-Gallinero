import { db } from "@/db";
import { farmLocations, feedInventory, feedMovements, transactions } from "@/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { isReadOnlyRole } from "@/lib/rbac";
import { isDateOnly } from "@/lib/date-validation";
import { normalizeFeedingSpecies } from "@/lib/species";
import { computeThreeLayerFinancials } from "@/lib/analytics/biological-valuation";
import {
  computeAssetsDepreciationSummary,
  computeFeedWarehouseValuation,
  evaluateBiologicalPortfolio,
  loadFarmBiologicalContext,
} from "@/lib/analytics/biological-db";
import { computeSupplyWarehouseValuation } from "@/lib/analytics/payroll-tax-supplies";
import { loadPeriodPayrollAndSupplies } from "@/lib/analytics/payroll-tax-supplies-db";

export const dynamic = "force-dynamic";

interface ProductLine {
  line: string;
  revenue: number;
  cost: number;
  profit: number;
}

interface DimensionLine {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number | null;
}

const UNASSIGNED = "sin_asignar";

function classifyTransaction(t: { category: string; type: string; sourceType: string | null; amount: number }): string {
  const cat = t.category.toLowerCase();
  // Costos operativos primero: "Compra de alimento para gallinas" no es una venta de aves.
  if (cat.includes("alimento")) return "alimento";
  if (cat.includes("sanidad") || cat.includes("vacun") || cat.includes("medic") || cat.includes("tratamiento")) return "sanidad";
  // Eggs
  if (cat.includes("huevo")) return "huevos";
  // Meat
  if (cat.includes("carne") || cat.includes("sacrificio") || t.sourceType === "sacrificio") return "carne";
  // Manure
  if (cat.includes("gallinaza") || cat.includes("abono")) return "gallinaza";
  // Birds
  if (cat.includes("aves") || cat.includes("gallina") || cat.includes("gallo") || cat.includes("pollo") || t.sourceType === "venta_aves" || t.sourceType === "venta_ave") return "aves";
  return "otros";
}

const money = (n: number) => parseFloat(n.toFixed(2));

function toDimensionLines(map: Map<string, { label: string; revenue: number; cost: number }>): DimensionLine[] {
  return Array.from(map, ([key, v]) => ({
    key,
    label: v.label,
    revenue: money(v.revenue),
    cost: money(v.cost),
    profit: money(v.revenue - v.cost),
    marginPct: v.revenue > 0 ? money(((v.revenue - v.cost) / v.revenue) * 100) : null,
  })).sort((a, b) => b.revenue - a.revenue || a.key.localeCompare(b.key));
}

/**
 * GET /api/analisis/reportes/rentabilidad?from&to&species&locationId
 * Rentabilidad por línea de producto y, con las dimensiones analíticas de
 * `transactions`, por especie y por lugar. Las transacciones sin especie o
 * lugar se agrupan en "sin_asignar" para que el total siempre cuadre.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const directivo = isReadOnlyRole((await getSessionUser())?.role);
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0];
  if (!isDateOnly(from) || !isDateOnly(to) || from > to) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }
  const speciesParam = searchParams.get("species");
  const species = speciesParam ? normalizeFeedingSpecies(speciesParam) : null;
  if (speciesParam && !species) return NextResponse.json({ error: "Especie no válida" }, { status: 400 });
  const locationId = searchParams.get("locationId");

  const conditions = [gte(transactions.date, from), lte(transactions.date, to)];
  if (species) conditions.push(eq(transactions.species, species));
  if (locationId) conditions.push(eq(transactions.locationId, locationId));

  const [txs, locations, feedMovRows, bioCtx, payrollSuppliesCtx] = await Promise.all([
    db.select().from(transactions).where(and(...conditions)).orderBy(transactions.date),
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
    db
      .select({
        species: feedMovements.species,
        locationId: feedMovements.locationId,
        quantity: feedMovements.quantity,
        unitCost: feedMovements.unitCost,
        fallbackCost: feedInventory.costPerUnit,
      })
      .from(feedMovements)
      .innerJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
      .where(and(eq(feedMovements.isEntry, false), gte(feedMovements.date, from), lte(feedMovements.date, to))),
    loadFarmBiologicalContext({
      speciesFilter: species,
      locationIdFilter: locationId || null,
      referenceDate: to,
    }),
    loadPeriodPayrollAndSupplies({
      from,
      to,
      speciesFilter: species,
      locationIdFilter: locationId || null,
    }),
  ]);
  const locationNames = new Map(locations.map((l) => [l.id, l.name]));

  const lines: Record<string, { revenue: number; cost: number }> = {
    huevos: { revenue: 0, cost: 0 },
    carne: { revenue: 0, cost: 0 },
    gallinaza: { revenue: 0, cost: 0 },
    aves: { revenue: 0, cost: 0 },
    alimento: { revenue: 0, cost: 0 },
    sanidad: { revenue: 0, cost: 0 },
    otros: { revenue: 0, cost: 0 },
  };
  const bySpecies = new Map<string, { label: string; revenue: number; cost: number }>();
  const byLocation = new Map<string, { label: string; revenue: number; cost: number }>();
  const bump = (
    map: Map<string, { label: string; revenue: number; cost: number }>,
    key: string,
    label: string,
    type: string,
    amount: number,
  ) => {
    const entry = map.get(key) ?? { label, revenue: 0, cost: 0 };
    if (type === "ingreso") entry.revenue += amount; else entry.cost += amount;
    map.set(key, entry);
  };

  for (const t of txs) {
    const amount = Number(t.amount);
    const line = classifyTransaction({ category: t.category, type: t.type, sourceType: t.sourceType, amount });
    if (t.type === "ingreso") lines[line].revenue += amount; else lines[line].cost += amount;
    bump(bySpecies, t.species ?? UNASSIGNED, t.species ?? "Sin asignar", t.type, amount);
    bump(
      byLocation,
      t.locationId ?? UNASSIGNED,
      t.locationId ? locationNames.get(t.locationId) ?? "Lugar eliminado" : "Sin asignar",
      t.type,
      amount,
    );
  }

  const result: ProductLine[] = Object.entries(lines).map(([line, data]) => ({
    line,
    revenue: money(data.revenue),
    cost: money(data.cost),
    profit: money(data.revenue - data.cost),
  }));

  const totalRevenue = result.reduce((s, l) => s + l.revenue, 0);
  const totalCost = result.reduce((s, l) => s + l.cost, 0);

  const filteredFeedMovs = feedMovRows.filter((fc) => {
    if (species && fc.species !== species) return false;
    if (locationId && fc.locationId !== locationId) return false;
    return true;
  });
  const accruedFeedCost = filteredFeedMovs.reduce(
    (s, fc) => s + Number(fc.quantity || 0) * Number(fc.unitCost ?? fc.fallbackCost ?? 0),
    0,
  );
  const assetsSummary = computeAssetsDepreciationSummary(bioCtx.assets, { fromDate: from, toDate: to });
  const warehouseSummary = computeFeedWarehouseValuation(bioCtx.feedRows);
  const supplyWarehouseSummary = computeSupplyWarehouseValuation(bioCtx.supplyRows);
  const biologicalSummary = evaluateBiologicalPortfolio({
    flocks: bioCtx.flocks,
    broilerBatches: bioCtx.batches,
    locations: bioCtx.locations,
    marketPrices: bioCtx.marketOverrides,
    referenceDate: to,
  });
  const threeLayer = computeThreeLayerFinancials({
    transactions: txs.map((t) => ({
      type: t.type,
      category: t.category,
      description: t.description,
      sourceType: t.sourceType,
      amount: t.amount,
      date: t.date,
    })),
    accruedFeedConsumedCostCop: accruedFeedCost,
    hasFeedConsumptionRecords: filteredFeedMovs.length > 0 && accruedFeedCost > 0,
    accruedSupplyConsumedCostCop: payrollSuppliesCtx.accruedSupplyCostCop,
    hasSupplyConsumptionRecords: payrollSuppliesCtx.hasSupplyConsumptionRecords,
    imputedOwnerLaborCop: payrollSuppliesCtx.imputedOwnerLaborCop,
    warehouseSupplyAssetCop: supplyWarehouseSummary.totalValueCop,
    assetsSummary,
    warehouseSummary,
    biologicalSummary,
  });

  return NextResponse.json({
    from,
    to,
    filters: { species, locationId },
    productLines: result,
    bySpecies: toDimensionLines(bySpecies),
    byLocation: toDimensionLines(byLocation),
    totalRevenue: money(totalRevenue),
    totalCost: money(totalCost),
    totalProfit: money(totalRevenue - totalCost),
    ...(!directivo ? {
      operatingContext: {
        ...threeLayer,
        lifecycleMode: biologicalSummary.lifecycleMode,
        lifecycleLabel: biologicalSummary.lifecycleLabel,
        capexRecoveryPct: assetsSummary.capexRecoveryPct,
        alertsCount: biologicalSummary.alerts.length,
      },
    } : {}),
  });
});

