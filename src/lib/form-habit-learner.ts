/**
 * Motor de aprendizaje implícito de hábitos de captura (Capacidad 2).
 *
 * Opera 100% en cliente (offline-first, localStorage) combinando frecuencia,
 * decaimiento exponencial por antigüedad y afinidad por franja horaria / ubicación.
 */

export type TimeBucket = "manana" | "tarde" | "noche";
export type HabitSaleType = "huevos" | "carne" | "animales" | "gallinaza" | "otros";

export const FORM_HABITS_STORAGE_KEY = "gallinero:form-habits:v1";
const MAX_ENTRIES_PER_LIST = 60;
const HALF_LIFE_DECAY_PER_DAY = 0.08;
const TIME_BUCKET_BONUS = 0.35;

export interface EggHabitEvent {
  locationId: string;
  species: string;
  batchId: string;
  trays: number;
  looseEggs: number;
  bucket: TimeBucket;
  timestampMs: number;
}

export interface FeedHabitEvent {
  locationId: string;
  feedId: string;
  quantity: string;
  bucket: TimeBucket;
  timestampMs: number;
}

export interface MortalityHabitEvent {
  locationId: string;
  birdType: string;
  cause: string;
  bucket: TimeBucket;
  timestampMs: number;
}

export interface ExpenseHabitEvent {
  category: string;
  counterparty: string;
  species: string;
  locationId: string;
  amount: number;
  description: string;
  bucket: TimeBucket;
  timestampMs: number;
}

export interface SaleHabitEvent {
  saleType: HabitSaleType;
  buyer: string;
  species: string;
  locationId: string;
  size: string;
  presentation: string;
  unitPrice: string;
  quantity: string;
  isCredit: boolean;
  creditDays: number | null;
  bucket: TimeBucket;
  timestampMs: number;
}

interface StoredFormHabits {
  eggs: EggHabitEvent[];
  feed: FeedHabitEvent[];
  mortality: MortalityHabitEvent[];
  expenses: ExpenseHabitEvent[];
  sales: SaleHabitEvent[];
}

export interface FormHabitStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let memoryFallbackStore: Record<string, string> = {};

function defaultStorage(): FormHabitStorage {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return window.localStorage;
  }
  return {
    getItem: (k) => (k in memoryFallbackStore ? memoryFallbackStore[k] : null),
    setItem: (k, v) => {
      memoryFallbackStore[k] = v;
    },
    removeItem: (k) => {
      delete memoryFallbackStore[k];
    },
  };
}

function emptyHabits(): StoredFormHabits {
  return { eggs: [], feed: [], mortality: [], expenses: [], sales: [] };
}

function readHabits(storage: FormHabitStorage = defaultStorage()): StoredFormHabits {
  try {
    const raw = storage.getItem(FORM_HABITS_STORAGE_KEY);
    if (!raw) return emptyHabits();
    const parsed = JSON.parse(raw) as Partial<StoredFormHabits>;
    return {
      eggs: Array.isArray(parsed.eggs) ? parsed.eggs : [],
      feed: Array.isArray(parsed.feed) ? parsed.feed : [],
      mortality: Array.isArray(parsed.mortality) ? parsed.mortality : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
    };
  } catch {
    return emptyHabits();
  }
}

function writeHabits(data: StoredFormHabits, storage: FormHabitStorage = defaultStorage()): void {
  try {
    const trimmed: StoredFormHabits = {
      eggs: data.eggs.slice(-MAX_ENTRIES_PER_LIST),
      feed: data.feed.slice(-MAX_ENTRIES_PER_LIST),
      mortality: data.mortality.slice(-MAX_ENTRIES_PER_LIST),
      expenses: data.expenses.slice(-MAX_ENTRIES_PER_LIST),
      sales: data.sales.slice(-MAX_ENTRIES_PER_LIST),
    };
    storage.setItem(FORM_HABITS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignorar errores de cuota de almacenamiento en modo offline estricto
  }
}

export function clearFormHabits(storage: FormHabitStorage = defaultStorage()): void {
  memoryFallbackStore = {};
  try {
    storage.removeItem(FORM_HABITS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function resolveTimeBucket(dateOrMs?: Date | number): TimeBucket {
  const date =
    dateOrMs instanceof Date
      ? dateOrMs
      : typeof dateOrMs === "number"
        ? new Date(dateOrMs)
        : new Date();
  const hour = date.getHours();
  if (hour >= 4 && hour < 12) return "manana";
  if (hour >= 12 && hour < 18) return "tarde";
  return "noche";
}

export function computeHabitEntryScore(
  entryTimestampMs: number,
  entryBucket: TimeBucket,
  nowMs: number = Date.now(),
  currentBucket: TimeBucket = resolveTimeBucket(nowMs),
): number {
  const deltaDays = Math.max(0, (nowMs - entryTimestampMs) / (1000 * 60 * 60 * 24));
  const recencyDecay = Math.exp(-HALF_LIFE_DECAY_PER_DAY * deltaDays);
  const bucketMultiplier = entryBucket === currentBucket ? 1 + TIME_BUCKET_BONUS : 1;
  return recencyDecay * bucketMultiplier;
}

function topKeyByScore<T>(
  events: T[],
  keyFn: (e: T) => string,
  scoreFn: (e: T) => number,
): { key: string; score: number } | null {
  const scores = new Map<string, number>();
  for (const ev of events) {
    const k = keyFn(ev);
    if (!k) continue;
    scores.set(k, (scores.get(k) || 0) + scoreFn(ev));
  }
  let best: { key: string; score: number } | null = null;
  for (const [key, score] of scores) {
    if (!best || score > best.score) best = { key, score };
  }
  return best;
}

// ─── Huevos ───

export function recordEggCaptureHabit(
  input: {
    locationId: string;
    species?: string;
    batchId?: string;
    trays: number;
    looseEggs: number;
    timestampMs?: number;
  },
  storage?: FormHabitStorage,
): void {
  if (!input.locationId && input.trays <= 0 && input.looseEggs <= 0) return;
  const nowMs = input.timestampMs ?? Date.now();
  const habits = readHabits(storage);
  habits.eggs.push({
    locationId: String(input.locationId || ""),
    species: String(input.species || "gallina"),
    batchId: String(input.batchId || ""),
    trays: Math.max(0, Math.round(input.trays || 0)),
    looseEggs: Math.max(0, Math.round(input.looseEggs || 0)),
    bucket: resolveTimeBucket(nowMs),
    timestampMs: nowMs,
  });
  writeHabits(habits, storage);
}

export function predictEggCaptureDefaults(
  options: {
    locationId?: string;
    currentBucket?: TimeBucket;
    nowMs?: number;
    limit?: number;
  } = {},
  storage?: FormHabitStorage,
): {
  locationId: string | null;
  species: string | null;
  batchId: string | null;
  topQuantities: Array<{ trays: number; looseEggs: number; total: number; score: number }>;
} {
  const nowMs = options.nowMs ?? Date.now();
  const bucket = options.currentBucket ?? resolveTimeBucket(nowMs);
  const events = readHabits(storage).eggs;
  if (events.length === 0) {
    return { locationId: null, species: null, batchId: null, topQuantities: [] };
  }

  const bestLoc =
    options.locationId ||
    topKeyByScore(events, (e) => e.locationId, (e) => computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket))
      ?.key ||
    null;

  const scoped = bestLoc ? events.filter((e) => !e.locationId || e.locationId === bestLoc) : events;
  const targetList = scoped.length > 0 ? scoped : events;

  const bestSpecies =
    topKeyByScore(targetList, (e) => e.species, (e) => computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket))
      ?.key || null;
  const bestBatch =
    topKeyByScore(
      targetList.filter((e) => (!bestSpecies || e.species === bestSpecies) && Boolean(e.batchId)),
      (e) => e.batchId,
      (e) => computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket),
    )?.key || null;

  const qtyMap = new Map<string, { trays: number; looseEggs: number; total: number; score: number }>();
  for (const e of targetList) {
    const total = e.trays * 30 + e.looseEggs;
    if (total <= 0) continue;
    const key = `${e.trays}:${e.looseEggs}`;
    const s = computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket);
    const cur = qtyMap.get(key);
    if (cur) {
      cur.score += s;
    } else {
      qtyMap.set(key, { trays: e.trays, looseEggs: e.looseEggs, total, score: s });
    }
  }

  const topQuantities = Array.from(qtyMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 2);

  return { locationId: bestLoc, species: bestSpecies, batchId: bestBatch, topQuantities };
}

// ─── Alimentación ───

export function recordFeedCaptureHabit(
  input: {
    locationId: string;
    feedId: string;
    quantity: string | number;
    timestampMs?: number;
  },
  storage?: FormHabitStorage,
): void {
  if (!input.feedId) return;
  const nowMs = input.timestampMs ?? Date.now();
  const habits = readHabits(storage);
  habits.feed.push({
    locationId: String(input.locationId || ""),
    feedId: String(input.feedId),
    quantity: String(input.quantity || "1"),
    bucket: resolveTimeBucket(nowMs),
    timestampMs: nowMs,
  });
  writeHabits(habits, storage);
}

export function predictFeedForLocation(
  options: {
    locationId?: string;
    currentBucket?: TimeBucket;
    nowMs?: number;
    limit?: number;
  } = {},
  storage?: FormHabitStorage,
): {
  locationId: string | null;
  feedId: string | null;
  quantity: string | null;
  topRations: Array<{ feedId: string; quantity: string; locationId: string; score: number }>;
} {
  const nowMs = options.nowMs ?? Date.now();
  const bucket = options.currentBucket ?? resolveTimeBucket(nowMs);
  const events = readHabits(storage).feed;
  if (events.length === 0) {
    return { locationId: null, feedId: null, quantity: null, topRations: [] };
  }

  const preferredLoc =
    options.locationId ||
    topKeyByScore(events, (e) => e.locationId, (e) => computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket))
      ?.key ||
    null;

  const rationMap = new Map<string, { feedId: string; quantity: string; locationId: string; score: number }>();
  for (const e of events) {
    const baseScore = computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket);
    const locBonus = preferredLoc && e.locationId === preferredLoc ? 1.5 : preferredLoc && e.locationId ? 0.5 : 1;
    const score = baseScore * locBonus;
    const key = `${e.feedId}::${e.quantity}`;
    const cur = rationMap.get(key);
    if (cur) {
      cur.score += score;
      if (preferredLoc && e.locationId === preferredLoc) cur.locationId = preferredLoc;
    } else {
      rationMap.set(key, {
        feedId: e.feedId,
        quantity: e.quantity,
        locationId: e.locationId || preferredLoc || "",
        score,
      });
    }
  }

  const sorted = Array.from(rationMap.values()).sort((a, b) => b.score - a.score);
  const top = sorted[0] || null;
  return {
    locationId: preferredLoc,
    feedId: top?.feedId ?? null,
    quantity: top?.quantity ?? null,
    topRations: sorted.slice(0, options.limit ?? 3),
  };
}

// ─── Mortalidad ───

export function recordMortalityCaptureHabit(
  input: {
    locationId: string;
    birdType: string;
    cause: string;
    timestampMs?: number;
  },
  storage?: FormHabitStorage,
): void {
  if (!input.birdType) return;
  const nowMs = input.timestampMs ?? Date.now();
  const habits = readHabits(storage);
  habits.mortality.push({
    locationId: String(input.locationId || ""),
    birdType: String(input.birdType),
    cause: String(input.cause || "enfermedad"),
    bucket: resolveTimeBucket(nowMs),
    timestampMs: nowMs,
  });
  writeHabits(habits, storage);
}

export function predictMortalityDefaults(
  options: { currentBucket?: TimeBucket; nowMs?: number } = {},
  storage?: FormHabitStorage,
): { locationId: string | null; birdType: string | null; cause: string | null } {
  const nowMs = options.nowMs ?? Date.now();
  const bucket = options.currentBucket ?? resolveTimeBucket(nowMs);
  const events = readHabits(storage).mortality;
  if (events.length === 0) return { locationId: null, birdType: null, cause: null };

  return {
    locationId:
      topKeyByScore(events, (e) => e.locationId, (e) => computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket))
        ?.key || null,
    birdType:
      topKeyByScore(events, (e) => e.birdType, (e) => computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket))
        ?.key || null,
    cause:
      topKeyByScore(events, (e) => e.cause, (e) => computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket))
        ?.key || null,
  };
}

// ─── Gastos / Proveedores frecuentes ───

export function recordExpenseCaptureHabit(
  input: {
    category: string;
    counterparty?: string;
    species?: string;
    locationId?: string;
    amount: number;
    description: string;
    timestampMs?: number;
  },
  storage?: FormHabitStorage,
): void {
  if (!input.category) return;
  const nowMs = input.timestampMs ?? Date.now();
  const habits = readHabits(storage);
  habits.expenses.push({
    category: String(input.category),
    counterparty: String(input.counterparty || "").trim(),
    species: String(input.species || ""),
    locationId: String(input.locationId || ""),
    amount: Number(input.amount) || 0,
    description: String(input.description || "").trim(),
    bucket: resolveTimeBucket(nowMs),
    timestampMs: nowMs,
  });
  writeHabits(habits, storage);
}

export function predictExpenseShortcuts(
  options: { limit?: number; currentBucket?: TimeBucket; nowMs?: number } = {},
  storage?: FormHabitStorage,
): {
  preferredCategory: string | null;
  frequentSuppliers: Array<{
    counterparty: string;
    category: string;
    species: string;
    locationId: string;
    lastAmount: number;
    lastDescription: string;
    score: number;
  }>;
} {
  const nowMs = options.nowMs ?? Date.now();
  const bucket = options.currentBucket ?? resolveTimeBucket(nowMs);
  const events = readHabits(storage).expenses;
  if (events.length === 0) return { preferredCategory: null, frequentSuppliers: [] };

  const preferredCategory =
    topKeyByScore(events, (e) => e.category, (e) => computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket))
      ?.key || null;

  const supplierMap = new Map<
    string,
    {
      counterparty: string;
      category: string;
      species: string;
      locationId: string;
      lastAmount: number;
      lastDescription: string;
      lastTs: number;
      score: number;
    }
  >();

  for (const e of events) {
    if (!e.counterparty) continue;
    const key = e.counterparty.toLowerCase();
    const s = computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket);
    const cur = supplierMap.get(key);
    if (!cur) {
      supplierMap.set(key, {
        counterparty: e.counterparty,
        category: e.category,
        species: e.species,
        locationId: e.locationId,
        lastAmount: e.amount,
        lastDescription: e.description,
        lastTs: e.timestampMs,
        score: s,
      });
    } else {
      cur.score += s;
      if (e.timestampMs >= cur.lastTs) {
        cur.counterparty = e.counterparty;
        cur.category = e.category;
        cur.species = e.species;
        cur.locationId = e.locationId;
        cur.lastAmount = e.amount;
        cur.lastDescription = e.description;
        cur.lastTs = e.timestampMs;
      }
    }
  }

  const frequentSuppliers = Array.from(supplierMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 3)
    .map(({ lastTs: _discard, ...rest }) => rest);

  return { preferredCategory, frequentSuppliers };
}

// ─── Ventas / Clientes frecuentes ───

export function recordSaleCaptureHabit(
  input: {
    saleType: HabitSaleType;
    buyer?: string;
    species?: string;
    locationId?: string;
    size?: string;
    presentation?: string;
    unitPrice?: string | number;
    quantity?: string | number;
    isCredit?: boolean;
    creditDays?: number | null;
    timestampMs?: number;
  },
  storage?: FormHabitStorage,
): void {
  const nowMs = input.timestampMs ?? Date.now();
  const habits = readHabits(storage);
  habits.sales.push({
    saleType: input.saleType,
    buyer: String(input.buyer || "").trim(),
    species: String(input.species || ""),
    locationId: String(input.locationId || ""),
    size: String(input.size || ""),
    presentation: String(input.presentation || ""),
    unitPrice: String(input.unitPrice || ""),
    quantity: String(input.quantity || ""),
    isCredit: Boolean(input.isCredit),
    creditDays: typeof input.creditDays === "number" ? input.creditDays : null,
    bucket: resolveTimeBucket(nowMs),
    timestampMs: nowMs,
  });
  writeHabits(habits, storage);
}

export function predictSaleShortcuts(
  options: {
    saleType?: HabitSaleType;
    limit?: number;
    currentBucket?: TimeBucket;
    nowMs?: number;
  } = {},
  storage?: FormHabitStorage,
): {
  preferredLocationId: string | null;
  frequentBuyers: Array<{
    buyer: string;
    saleType: HabitSaleType;
    species: string;
    locationId: string;
    size: string;
    presentation: string;
    unitPrice: string;
    quantity: string;
    isCredit: boolean;
    creditDays: number | null;
    score: number;
  }>;
} {
  const nowMs = options.nowMs ?? Date.now();
  const bucket = options.currentBucket ?? resolveTimeBucket(nowMs);
  const allSales = readHabits(storage).sales;
  const scoped = options.saleType
    ? allSales.filter((e) => e.saleType === options.saleType)
    : allSales;
  if (scoped.length === 0) return { preferredLocationId: null, frequentBuyers: [] };

  const preferredLocationId =
    topKeyByScore(scoped, (e) => e.locationId, (e) => computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket))
      ?.key || null;

  const buyerMap = new Map<
    string,
    {
      buyer: string;
      saleType: HabitSaleType;
      species: string;
      locationId: string;
      size: string;
      presentation: string;
      unitPrice: string;
      quantity: string;
      isCredit: boolean;
      creditDays: number | null;
      lastTs: number;
      score: number;
    }
  >();

  for (const e of scoped) {
    if (!e.buyer) continue;
    const key = `${e.saleType}::${e.buyer.toLowerCase()}`;
    const s = computeHabitEntryScore(e.timestampMs, e.bucket, nowMs, bucket);
    const cur = buyerMap.get(key);
    if (!cur) {
      buyerMap.set(key, {
        buyer: e.buyer,
        saleType: e.saleType,
        species: e.species,
        locationId: e.locationId,
        size: e.size,
        presentation: e.presentation,
        unitPrice: e.unitPrice,
        quantity: e.quantity,
        isCredit: e.isCredit,
        creditDays: e.creditDays,
        lastTs: e.timestampMs,
        score: s,
      });
    } else {
      cur.score += s;
      if (e.timestampMs >= cur.lastTs) {
        cur.buyer = e.buyer;
        cur.species = e.species;
        cur.locationId = e.locationId;
        cur.size = e.size;
        cur.presentation = e.presentation;
        cur.unitPrice = e.unitPrice;
        cur.quantity = e.quantity;
        cur.isCredit = e.isCredit;
        cur.creditDays = e.creditDays;
        cur.lastTs = e.timestampMs;
      }
    }
  }

  const frequentBuyers = Array.from(buyerMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 3)
    .map(({ lastTs: _discard, ...rest }) => rest);

  return { preferredLocationId, frequentBuyers };
}
