import { db } from "@/db";
import { eggProduction, eggProductionDetails, eggSales, eggSalesItems, eggLosses, catalogos, slaughter, meatSales, meatLosses, manureProduction, manureSales, manureAdjustments } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { loadSpeciesPriceMap } from "./species-db";
import { lockAndReadManureStock } from "./manure-stock";
import { buildManureEstimate } from "./manure-estimate";
import { checkEggStorageTelemetry } from "./ntc1240";

type InventoryReader = Pick<typeof db, "select">;

export interface EggLot {
  id: string;
  date: string;
  size: string;
  initial: number;
  sold: number;
  lost: number;
  remaining: number;
  ageDays: number;
  lotCode?: string | null;
  species?: string | null;
  storageTempC?: number | null;
  storageHumidityPct?: number | null;
  storageWarnings?: string[];
}

export interface SizeSummary {
  size: string;
  price: number | null;
  produced: number;
  saleableProduced: number;
  sold: number;
  lost: number;
  available: number;
  value: number;
}

export interface AgingBucket {
  label: string;
  count: number;
}

export interface EggInventory {
  summary: {
    produced: number;
    saleableProduced: number;
    sold: number;
    lost: number;
    recordedLost: number;
    available: number;
    sizes: SizeSummary[];
  };
  lots: EggLot[];
  aging: AgingBucket[];
  oldestLot: EggLot | null;
  estimatedValue: number;
  storageAlerts: Array<{
    id: string;
    lotCode: string | null;
    date: string;
    tempC: number | null;
    humidityPct: number | null;
    warnings: string[];
  }>;
}

export function eggInventoryBookBalance(inventory: EggInventory): number {
  return inventory.summary.saleableProduced - inventory.summary.sold - inventory.summary.recordedLost;
}

// Inventario de huevos con consumo PEPS (FIFO): se vende primero el lote más antiguo
export async function computeEggInventory(
  client: InventoryReader = db,
  options: { excludeSaleId?: string } = {},
): Promise<EggInventory> {
  const [productions, details, allSales, allSaleItems, sizeCatalog, losses] = await Promise.all([
    client.select().from(eggProduction).orderBy(asc(eggProduction.date)),
    client.select().from(eggProductionDetails),
    client.select().from(eggSales).orderBy(asc(eggSales.date)),
    client.select().from(eggSalesItems),
    client.select().from(catalogos).where(eq(catalogos.category, "tamano_huevo")),
    client.select().from(eggLosses),
  ]);

  // Keep the sales/items paired when a sale is being edited so its own stock
  // can be evaluated as if the old sale had already been removed.
  const sales = allSales.filter((sale) => sale.id !== options.excludeSaleId);
  const saleIds = new Set(sales.map((sale) => sale.id));
  const saleItems = allSaleItems.filter((item) => saleIds.has(item.saleId));

  // Ventas efectivas por tamaño: las ventas multi-tamaño tienen egg_sales.size = NULL,
  // el detalle real vive en egg_sales_items. Construir lista unificada (con fecha de la venta).
  const saleDateById = new Map(sales.map((s) => [s.id, s.date]));
  const effectiveSales: { id: string; date: string; size: string; quantity: number }[] = saleItems.map((i) => ({
    id: i.saleId,
    date: saleDateById.get(i.saleId) || "",
    size: i.size,
    quantity: i.quantity,
  }));
  for (const s of sales) {
    if (!s.size) continue;
    const hasItem = saleItems.some((i) => i.saleId === s.id);
    if (hasItem) continue;
    effectiveSales.push({ id: s.id, date: s.date, size: s.size, quantity: s.quantity });
  }
  effectiveSales.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Orden y precios de tamaños según el catálogo (activos y por sortOrder)
  const activeSizes = sizeCatalog.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const priceBySize = new Map<string, number>();
  for (const c of activeSizes) if (c.price != null) priceBySize.set(c.value, Number(c.price));

  const sizeOrder: string[] = [...activeSizes.map((c) => c.value)];
  const seen = new Set(sizeOrder);
  for (const d of details) if (!seen.has(d.size)) { seen.add(d.size); sizeOrder.push(d.size); }
  for (const s of effectiveSales) if (!seen.has(s.size)) { seen.add(s.size); sizeOrder.push(s.size); }

  const producedBySize = new Map<string, number>();
  const saleableProducedBySize = new Map<string, number>();
  const producedByKey = new Map<string, number>();
  const detailsByProduction = new Map<string, { size: string; quantity: number }[]>();
  for (const d of details) {
    const arr = detailsByProduction.get(d.productionId) || [];
    arr.push({ size: d.size, quantity: Math.max(0, Number(d.quantity) || 0) });
    detailsByProduction.set(d.productionId, arr);
    producedBySize.set(d.size, (producedBySize.get(d.size) || 0) + Math.max(0, Number(d.quantity) || 0));
  }

  // Only the explicitly saleable share enters inventory. Autoconsumption,
  // incubation, broken eggs, and any unassigned remainder must not be sold.
  // Allocate aggregate household/sale quantities across sizes proportionally;
  // largest remainders preserve the exact recorded integer total.
  const allocateBySize = (rows: { size: string; quantity: number }[], target: number) => {
    const total = rows.reduce((sum, row) => sum + row.quantity, 0);
    const boundedTarget = Math.min(total, Math.max(0, Math.floor(target)));
    if (total <= 0 || boundedTarget <= 0) return new Map<string, number>();

    const allocations = rows.map((row) => {
      const exact = (row.quantity * boundedTarget) / total;
      const whole = Math.floor(exact);
      return { size: row.size, quantity: whole, remainder: exact - whole };
    });
    let remainder = boundedTarget - allocations.reduce((sum, row) => sum + row.quantity, 0);
    allocations.sort((a, b) => b.remainder - a.remainder || a.size.localeCompare(b.size));
    for (const allocation of allocations) {
      if (remainder <= 0) break;
      if (allocation.quantity < (rows.find((r) => r.size === allocation.size)?.quantity || 0)) {
        allocation.quantity += 1;
        remainder -= 1;
      }
    }
    return new Map(allocations.map((row) => [row.size, row.quantity]));
  };

  for (const production of productions) {
    const productionDetails = detailsByProduction.get(production.id) || [];
    const classifiedTotal = productionDetails.reduce((sum, row) => sum + row.quantity, 0);
    const autoconsumed = Math.min(classifiedTotal, Math.max(0, Number(production.quantityAutoconsumo) || 0));
    const rawExcess = Math.max(0, Number(production.quantityExcedente) || 0);
    // Before quantityExcedente was maintained consistently, a zero with no
    // autoconsumption meant all classified eggs were saleable. Keep those rows
    // usable while honoring an explicit zero when autoconsumption is recorded.
    const requestedSaleable = rawExcess === 0 && autoconsumed === 0 ? classifiedTotal : rawExcess;
    const saleableTotal = Math.min(classifiedTotal - autoconsumed, requestedSaleable);
    const saleableBySize = allocateBySize(productionDetails, saleableTotal);
    for (const [size, quantity] of saleableBySize) {
      const previous = saleableProducedBySize.get(size) || 0;
      saleableProducedBySize.set(size, previous + quantity);
      producedByKey.set(`${production.id}::${size}`, quantity);
    }
  }

  const soldBySize = new Map<string, number>();
  for (const s of effectiveSales) soldBySize.set(s.size, (soldBySize.get(s.size) || 0) + s.quantity);

  const lots: EggLot[] = [];
  for (const size of sizeOrder) {
    // Colas FIFO para ventas por tamaño.
    const salesQueue = effectiveSales.filter((s) => s.size === size).map((s) => s.quantity);

    for (const p of productions) {
      const initial = producedByKey.get(`${p.id}::${size}`) || 0;
      if (initial <= 0) continue;

      // Consumir este lote con las ventas más antiguas en cola
      let soldThisLot = 0;
      while (salesQueue.length && soldThisLot < initial) {
        const take = Math.min(salesQueue[0], initial - soldThisLot);
        soldThisLot += take;
        salesQueue[0] -= take;
        if (salesQueue[0] === 0) salesQueue.shift();
      }

      const lotDate = new Date(p.date + "T12:00:00");
      lotDate.setHours(0, 0, 0, 0);
      const ageDays = Math.max(0, Math.floor((today.getTime() - lotDate.getTime()) / 86400000));

      const tempC = p.storageTempC != null ? Number(p.storageTempC) : null;
      const humidityPct = p.storageHumidityPct != null ? Number(p.storageHumidityPct) : null;
      const warnings = checkEggStorageTelemetry(tempC, humidityPct);

      lots.push({
        id: p.id,
        date: p.date,
        size,
        initial,
        sold: soldThisLot,
        lost: 0,
        remaining: initial - soldThisLot,
        ageDays,
        lotCode: p.lotCode ?? null,
        species: p.species ?? null,
        storageTempC: tempC,
        storageHumidityPct: humidityPct,
        storageWarnings: warnings,
      });
    }
  }

  lots.sort((a, b) =>
    a.date === b.date ? sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size) : a.date.localeCompare(b.date)
  );

  // Apply losses in date order. A specified size consumes that size's oldest
  // stock; an unspecified size consumes the oldest stock across all sizes.
  const orderedLosses = [...losses].sort((a, b) => a.date.localeCompare(b.date));
  for (const loss of orderedLosses) {
    let remainingLoss = Math.max(0, Number(loss.quantity) || 0);
    const specifiedSize = loss.size && sizeOrder.includes(loss.size) ? loss.size : null;
    for (const lot of lots) {
      if (remainingLoss <= 0) break;
      if (specifiedSize && lot.size !== specifiedSize) continue;
      const take = Math.min(remainingLoss, lot.remaining);
      lot.lost += take;
      lot.remaining -= take;
      remainingLoss -= take;
    }
  }

  const lostBySize = new Map<string, number>();
  for (const lot of lots) {
    lostBySize.set(lot.size, (lostBySize.get(lot.size) || 0) + lot.lost);
  }

  const sizes: SizeSummary[] = sizeOrder.map((size) => {
    const produced = producedBySize.get(size) || 0;
    const saleableProduced = saleableProducedBySize.get(size) || 0;
    const sold = soldBySize.get(size) || 0;
    const lost = lostBySize.get(size) || 0;
    const available = Math.max(0, saleableProduced - sold - lost);
    const price = priceBySize.get(size) ?? null;
    return { size, price, produced, saleableProduced, sold, lost, available, value: price != null ? available * price : 0 };
  });

  const totalProduced = sizes.reduce((s, x) => s + x.produced, 0);
  const totalSaleableProduced = sizes.reduce((s, x) => s + x.saleableProduced, 0);
  const totalSold = sizes.reduce((s, x) => s + x.sold, 0);
  const totalLost = sizes.reduce((s, x) => s + x.lost, 0);
  const recordedLost = losses.reduce((sum, loss) => sum + Math.max(0, Number(loss.quantity) || 0), 0);
  const totalAvailable = sizes.reduce((s, x) => s + x.available, 0);
  const estimatedValue = sizes.reduce((s, x) => s + x.value, 0);

  const availableLots = lots.filter((l) => l.remaining > 0);
  const storageAlertMap = new Map<string, { id: string; lotCode: string | null; date: string; tempC: number | null; humidityPct: number | null; warnings: string[] }>();
  for (const lot of availableLots) {
    if (lot.storageWarnings && lot.storageWarnings.length > 0 && !storageAlertMap.has(lot.id)) {
      storageAlertMap.set(lot.id, {
        id: lot.id,
        lotCode: lot.lotCode ?? null,
        date: lot.date,
        tempC: lot.storageTempC ?? null,
        humidityPct: lot.storageHumidityPct ?? null,
        warnings: lot.storageWarnings,
      });
    }
  }

  const ranges: { label: string; min: number; max: number }[] = [
    { label: "0-3 días", min: 0, max: 3 },
    { label: "4-7 días", min: 4, max: 7 },
    { label: "8-14 días", min: 8, max: 14 },
    { label: "15-21 días", min: 15, max: 21 },
    { label: ">21 días", min: 22, max: Infinity },
  ];
  const aging: AgingBucket[] = ranges.map((r) => ({
    label: r.label,
    count: availableLots.filter((l) => l.ageDays >= r.min && l.ageDays <= r.max).reduce((s, l) => s + l.remaining, 0),
  }));

  const oldestLot = availableLots.length > 0
    ? availableLots.reduce((a, b) => (b.ageDays > a.ageDays ? b : a))
    : null;

  return {
    summary: { produced: totalProduced, saleableProduced: totalSaleableProduced, sold: totalSold, lost: totalLost, recordedLost, available: totalAvailable, sizes },
    lots,
    aging,
    oldestLot,
    estimatedValue,
    storageAlerts: Array.from(storageAlertMap.values()),
  };
}

// ─── Inventario de carne: producido (sacrificio) - vendido - perdido ───

export interface MeatLot {
  id: string;
  date: string;
  species: string;
  birdType: string;
  destination?: string | null;
  weightKgAutoconsumo?: number | null;
  weightKgExcedente?: number | null;
  quantityKg: number;
  soldKg: number;
  lostKg: number;
  remainingKg: number;
  ageDays: number;
  estimatedPriceKg: number;
  estimatedValue: number;
}

export interface MeatSpeciesSummary {
  species: string;
  producedKg: number;
  availableKg: number;
  estimatedPriceKg: number;
  estimatedValue: number;
}

export interface MeatInventory {
  summary: {
    produced: number;
    sold: number;
    lost: number;
    available: number;
    value: number;
    bySpecies?: MeatSpeciesSummary[];
  };
  lots: MeatLot[];
  oldestLot: MeatLot | null;
  estimatedValue: number;
}

export function meatInventoryBookBalance(inventory: MeatInventory): number {
  return inventory.summary.produced - inventory.summary.sold - inventory.summary.lost;
}

export async function computeMeatInventory(
  client: InventoryReader = db,
  options: { excludeSaleId?: string } = {},
): Promise<MeatInventory> {
  const [productions, allSales, losses, speciesPrices] = await Promise.all([
    client.select().from(slaughter).orderBy(asc(slaughter.date)),
    client.select().from(meatSales).orderBy(asc(meatSales.date)),
    client.select().from(meatLosses).orderBy(asc(meatLosses.date)),
    loadSpeciesPriceMap(),
  ]);
  const sales = allSales.filter((sale) => sale.id !== options.excludeSaleId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const saleableWeightKg = (production: typeof productions[number]) => {
    const total = Math.max(0, Number(production.weightKg) || 0);
    const autoconsumo = Math.max(0, Number(production.weightKgAutoconsumo) || 0);
    const excedente = Math.max(0, Number(production.weightKgExcedente) || 0);
    if (production.destination === "venta") return Math.min(total, excedente || total);
    if (production.destination === "mixto") return Math.min(total, excedente || Math.max(0, total - autoconsumo));
    return 0;
  };
  const totalProducedKg = productions.reduce((s, p) => s + saleableWeightKg(p), 0);
  const totalSoldKg = sales.reduce((s, v) => s + Number(v.quantityKg), 0);
  const totalLostKg = losses.reduce((s, l) => s + Number(l.quantityKg), 0);

  // Distribuir ventas FIFO únicamente entre lotes del mismo tipo de carne.
  const remainingSalesBySpecies = new Map<string, number[]>();
  for (const sale of sales) {
    const queue = remainingSalesBySpecies.get(sale.species) || [];
    queue.push(Math.max(0, Number(sale.quantityKg) || 0));
    remainingSalesBySpecies.set(sale.species, queue);
  }
  // Las pérdidas no tienen especie en el modelo; se asignan FIFO al stock
  // vendible que permanezca después de las ventas.
  let remainingLosses = losses.map((l) => Number(l.quantityKg));

  const lots: MeatLot[] = [];
  for (const p of productions) {
    const initialKg = saleableWeightKg(p);
    const birdTypeSpecies = p.birdType === "gallina_descarte" || p.birdType === "gallo"
      ? "gallina"
      : ["pollo", "codorniz", "pato", "conejo", "cuy"].includes(p.birdType)
        ? p.birdType
        : null;
    const species = birdTypeSpecies || p.species || "pollo";
    let soldThisLot = 0;
    let lostThisLot = 0;
    const remainingSales = remainingSalesBySpecies.get(species) || [];

    // Consumir ventas FIFO
    for (let i = 0; i < remainingSales.length && soldThisLot < initialKg; i++) {
      const take = Math.min(remainingSales[i], initialKg - soldThisLot);
      soldThisLot += take;
      remainingSales[i] -= take;
    }

    // Consumir pérdidas FIFO
    for (let i = 0; i < remainingLosses.length && lostThisLot < initialKg - soldThisLot; i++) {
      const take = Math.min(remainingLosses[i], initialKg - soldThisLot - lostThisLot);
      lostThisLot += take;
      remainingLosses[i] -= take;
    }

    const lotDate = new Date(p.date + "T12:00:00");
    lotDate.setHours(0, 0, 0, 0);
    const ageDays = Math.max(0, Math.floor((today.getTime() - lotDate.getTime()) / 86400000));
    const estimatedPriceKg = speciesPrices[species] ?? 14000;
    const remainingKg = Math.max(0, initialKg - soldThisLot - lostThisLot);
    lots.push({
      id: p.id,
      date: p.date,
      species,
      birdType: p.birdType,
      destination: p.destination,
      weightKgAutoconsumo: p.weightKgAutoconsumo ? Number(p.weightKgAutoconsumo) : null,
      weightKgExcedente: p.weightKgExcedente ? Number(p.weightKgExcedente) : null,
      quantityKg: initialKg,
      soldKg: soldThisLot,
      lostKg: lostThisLot,
      remainingKg,
      ageDays,
      estimatedPriceKg,
      estimatedValue: Math.round(remainingKg * estimatedPriceKg),
    });
  }

  const availableLots = lots.filter((l) => l.remainingKg > 0);
  const oldestLot = availableLots.length > 0
    ? availableLots.reduce((a, b) => (b.ageDays > a.ageDays ? b : a))
    : null;

  const totalAvailable = lots.reduce((sum, lot) => sum + lot.remainingKg, 0);

  // Desglose y valor estimado por especie
  const speciesMap = new Map<string, { produced: number; available: number }>();
  lots.forEach((l) => {
    const cur = speciesMap.get(l.species) || { produced: 0, available: 0 };
    speciesMap.set(l.species, {
      produced: cur.produced + l.quantityKg,
      available: cur.available + l.remainingKg,
    });
  });

  let estimatedValue = 0;
  const bySpecies: MeatSpeciesSummary[] = [];
  for (const [sp, data] of speciesMap.entries()) {
    const price = speciesPrices[sp] ?? 14000;
    const val = data.available * price;
    estimatedValue += val;
    bySpecies.push({
      species: sp,
      producedKg: Math.round(data.produced * 100) / 100,
      availableKg: Math.round(data.available * 100) / 100,
      estimatedPriceKg: price,
      estimatedValue: Math.round(val),
    });
  }

  return {
    summary: {
      produced: Math.round(totalProducedKg * 100) / 100,
      sold: Math.round(totalSoldKg * 100) / 100,
      lost: Math.round(totalLostKg * 100) / 100,
      available: Math.round(totalAvailable * 100) / 100,
      value: Math.round(estimatedValue),
      bySpecies,
    },
    lots,
    oldestLot,
    estimatedValue: Math.round(estimatedValue),
  };
}

// ─── Inventario de gallinaza: producido + ajustes - vendido ───

export interface ManureInventory {
  summary: {
    produced: number;
    sold: number;
    adjusted: number;
    available: number;
    value: number;
  };
  productionHistory: { date: string; kgProduced: number; source: string }[];
  salesHistory: { date: string; quantityKg: number; totalAmount: number }[];
  estimatedDailyKg: number;
}

export async function computeManureInventory(estimatedDailyKg?: number): Promise<ManureInventory> {
  const currentDailyEstimate = estimatedDailyKg ?? (await buildManureEstimate()).totalKgPerDay;
  const { productions, sales, adjustments } = await db.transaction(async (tx) => {
    await lockAndReadManureStock(tx, currentDailyEstimate);
    const [productions, sales, adjustments] = await Promise.all([
      tx.select().from(manureProduction).orderBy(asc(manureProduction.date)),
      tx.select().from(manureSales).orderBy(asc(manureSales.date)),
      tx.select().from(manureAdjustments).orderBy(asc(manureAdjustments.date)),
    ]);
    return { productions, sales, adjustments };
  });

  const totalProduced = productions.reduce((s, p) => s + Number(p.kgProduced), 0);
  const totalSold = sales.reduce((s, v) => s + Number(v.quantityKg), 0);
  const totalAdjusted = adjustments.reduce((s, a) => s + Number(a.deltaKg), 0);
  const available = totalProduced + totalAdjusted - totalSold;

  return {
    summary: {
      produced: Math.round(totalProduced * 100) / 100,
      sold: Math.round(totalSold * 100) / 100,
      adjusted: Math.round(totalAdjusted * 100) / 100,
      available: Math.round(available * 100) / 100,
      value: 0,
    },
    productionHistory: productions.map((p) => ({
      date: p.date,
      kgProduced: Number(p.kgProduced),
      source: p.source,
    })),
    salesHistory: sales.map((v) => ({
      date: v.date,
      quantityKg: Number(v.quantityKg),
      totalAmount: Number(v.totalAmount),
    })),
    estimatedDailyKg: currentDailyEstimate,
  };
}
