import { db } from "@/db";
import { eggProduction, eggProductionDetails, eggSales, catalogos } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export interface EggLot {
  id: string;
  date: string;
  size: string;
  initial: number;
  sold: number;
  remaining: number;
  ageDays: number;
}

export interface SizeSummary {
  size: string;
  price: number | null;
  produced: number;
  sold: number;
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
  const [productions, details, sales, sizeCatalog] = await Promise.all([
    db.select().from(eggProduction).orderBy(asc(eggProduction.date)),
    db.select().from(eggProductionDetails),
    db.select().from(eggSales).orderBy(asc(eggSales.date)),
    db.select().from(catalogos).where(eq(catalogos.category, "tamano_huevo")),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Orden y precios de tamaños según el catálogo (activos y por sortOrder)
  const activeSizes = sizeCatalog.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const priceBySize = new Map<string, number>();
  for (const c of activeSizes) if (c.price != null) priceBySize.set(c.value, Number(c.price));

  const sizeOrder: string[] = [...activeSizes.map((c) => c.value)];
  const seen = new Set(sizeOrder);
  for (const d of details) if (!seen.has(d.size)) { seen.add(d.size); sizeOrder.push(d.size); }
  for (const s of sales) if (s.size && !seen.has(s.size)) { seen.add(s.size); sizeOrder.push(s.size); }

  const producedBySize = new Map<string, number>();
  const producedByKey = new Map<string, number>();
  for (const d of details) {
    producedBySize.set(d.size, (producedBySize.get(d.size) || 0) + d.quantity);
    producedByKey.set(`${d.productionId}::${d.size}`, (producedByKey.get(`${d.productionId}::${d.size}`) || 0) + d.quantity);
  }

  const soldBySize = new Map<string, number>();
  for (const s of sales) if (s.size) soldBySize.set(s.size, (soldBySize.get(s.size) || 0) + s.quantity);

  const lots: EggLot[] = [];
  for (const size of sizeOrder) {
    // Cola de ventas para consumo FIFO (independiente de la fecha de venta)
    const salesQueue = sales.filter((s) => s.size === size).map((s) => s.quantity);

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

      lots.push({
        id: p.id,
        date: p.date,
        size,
        initial,
        sold: soldThisLot,
        remaining: initial - soldThisLot,
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
    const available = produced - sold;
    const price = priceBySize.get(size) ?? null;
    return { size, price, produced, sold, available, value: price != null ? available * price : 0 };
  });

  const totalProduced = sizes.reduce((s, x) => s + x.produced, 0);
  const totalSold = sizes.reduce((s, x) => s + x.sold, 0);
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
    summary: { produced: totalProduced, sold: totalSold, available: totalAvailable, sizes },
    lots,
    aging,
    oldestLot,
    estimatedValue,
  };
}
