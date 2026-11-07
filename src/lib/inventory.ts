import { db } from "@/db";
import { eggProduction, eggProductionDetails, eggSales, eggSalesItems, eggLosses, catalogos, slaughter, meatSales, meatLosses, manureProduction, manureSales, manureAdjustments } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { loadSpeciesPriceMap } from "./species-db";

export interface EggLot {
  id: string;
  date: string;
  size: string;
  initial: number;
  sold: number;
  lost: number;
  remaining: number;
  ageDays: number;
}

export interface SizeSummary {
  size: string;
  price: number | null;
  produced: number;
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
    sold: number;
    lost: number;
    available: number;
    sizes: SizeSummary[];
  };
  lots: EggLot[];
  aging: AgingBucket[];
  oldestLot: EggLot | null;
  estimatedValue: number;
}

// Inventario de huevos con consumo PEPS (FIFO): se vende primero el lote más antiguo
export async function computeEggInventory(): Promise<EggInventory> {
  const [productions, details, sales, saleItems, losses, sizeCatalog] = await Promise.all([
    db.select().from(eggProduction).orderBy(asc(eggProduction.date)),
    db.select().from(eggProductionDetails),
    db.select().from(eggSales).orderBy(asc(eggSales.date)),
    db.select().from(eggSalesItems),
    db.select().from(eggLosses),
    db.select().from(catalogos).where(eq(catalogos.category, "tamano_huevo")),
  ]);

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
  const producedByKey = new Map<string, number>();
  for (const d of details) {
    producedBySize.set(d.size, (producedBySize.get(d.size) || 0) + d.quantity);
    producedByKey.set(`${d.productionId}::${d.size}`, (producedByKey.get(`${d.productionId}::${d.size}`) || 0) + d.quantity);
  }

  const soldBySize = new Map<string, number>();
  for (const s of effectiveSales) soldBySize.set(s.size, (soldBySize.get(s.size) || 0) + s.quantity);

  const lostBySize = new Map<string, number>();
  for (const l of losses) {
    if (l.size) lostBySize.set(l.size, (lostBySize.get(l.size) || 0) + l.quantity);
  }

  const lots: EggLot[] = [];
  for (const size of sizeOrder) {
    // Colas FIFO para ventas y pérdidas (independientes de la fecha)
    const salesQueue = effectiveSales.filter((s) => s.size === size).map((s) => s.quantity);
    const lossesQueue = losses.filter((l) => l.size === size).map((l) => l.quantity);

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

      // Consumir este lote con las pérdidas más antiguas en cola
      let lostThisLot = 0;
      while (lossesQueue.length && lostThisLot < initial - soldThisLot) {
        const take = Math.min(lossesQueue[0], initial - soldThisLot - lostThisLot);
        lostThisLot += take;
        lossesQueue[0] -= take;
        if (lossesQueue[0] === 0) lossesQueue.shift();
      }

      const lotDate = new Date(p.date + "T12:00:00");
      lotDate.setHours(0, 0, 0, 0);
      const ageDays = Math.max(0, Math.floor((today.getTime() - lotDate.getTime()) / 86400000));

      lots.push({
        id: p.id,
        date: p.date,
        size,
        initial,
        sold: soldThisLot,
        lost: lostThisLot,
        remaining: initial - soldThisLot - lostThisLot,
        ageDays,
      });
    }
  }

  lots.sort((a, b) =>
    a.date === b.date ? sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size) : a.date.localeCompare(b.date)
  );

  const sizes: SizeSummary[] = sizeOrder.map((size) => {
    const produced = producedBySize.get(size) || 0;
    const sold = soldBySize.get(size) || 0;
    const lost = lostBySize.get(size) || 0;
    const available = produced - sold - lost;
    const price = priceBySize.get(size) ?? null;
    return { size, price, produced, sold, lost, available, value: price != null ? available * price : 0 };
  });

  const totalProduced = sizes.reduce((s, x) => s + x.produced, 0);
  const totalSold = sizes.reduce((s, x) => s + x.sold, 0);
  const totalLost = sizes.reduce((s, x) => s + x.lost, 0);
  const totalAvailable = sizes.reduce((s, x) => s + x.available, 0);
  const estimatedValue = sizes.reduce((s, x) => s + x.value, 0);

  const availableLots = lots.filter((l) => l.remaining > 0);

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
    summary: { produced: totalProduced, sold: totalSold, lost: totalLost, available: totalAvailable, sizes },
    lots,
    aging,
    oldestLot,
    estimatedValue,
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

export async function computeMeatInventory(): Promise<MeatInventory> {
  const [productions, sales, losses, speciesPrices] = await Promise.all([
    db.select().from(slaughter).orderBy(asc(slaughter.date)),
    db.select().from(meatSales).orderBy(asc(meatSales.date)),
    db.select().from(meatLosses).orderBy(asc(meatLosses.date)),
    loadSpeciesPriceMap(),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalProducedKg = productions.reduce((s, p) => s + Number(p.weightKg), 0);
  const totalSoldKg = sales.reduce((s, v) => s + Number(v.quantityKg), 0);
  const totalLostKg = losses.reduce((s, l) => s + Number(l.quantityKg), 0);

  // Distribuir ventas y pérdidas FIFO sobre los lotes de sacrificio
  let remainingSales = sales.map((v) => Number(v.quantityKg));
  let remainingLosses = losses.map((l) => Number(l.quantityKg));

  const lots: MeatLot[] = [];
  for (const p of productions) {
    const initialKg = Number(p.weightKg);
    let soldThisLot = 0;
    let lostThisLot = 0;

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
    const sp = p.species || (p.birdType === "gallina_descarte" ? "gallina" : "pollo");

    lots.push({
      id: p.id,
      date: p.date,
      species: sp,
      birdType: p.birdType,
      destination: p.destination,
      weightKgAutoconsumo: p.weightKgAutoconsumo ? Number(p.weightKgAutoconsumo) : null,
      weightKgExcedente: p.weightKgExcedente ? Number(p.weightKgExcedente) : null,
      quantityKg: initialKg,
      soldKg: soldThisLot,
      lostKg: lostThisLot,
      remainingKg: Math.max(0, initialKg - soldThisLot - lostThisLot),
      ageDays,
    });
  }

  const availableLots = lots.filter((l) => l.remainingKg > 0);
  const oldestLot = availableLots.length > 0
    ? availableLots.reduce((a, b) => (b.ageDays > a.ageDays ? b : a))
    : null;

  const totalAvailable = Math.max(0, totalProducedKg - totalSoldKg - totalLostKg);

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

export async function computeManureInventory(estimatedDailyKg: number = 0): Promise<ManureInventory> {
  const [productions, sales, adjustments] = await Promise.all([
    db.select().from(manureProduction).orderBy(asc(manureProduction.date)),
    db.select().from(manureSales).orderBy(asc(manureSales.date)),
    db.select().from(manureAdjustments).orderBy(asc(manureAdjustments.date)),
  ]);

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
    estimatedDailyKg,
  };
}
