import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFormHabits,
  computeHabitEntryScore,
  predictEggCaptureDefaults,
  predictExpenseShortcuts,
  predictFeedForLocation,
  predictMortalityDefaults,
  predictSaleShortcuts,
  recordEggCaptureHabit,
  recordExpenseCaptureHabit,
  recordFeedCaptureHabit,
  recordMortalityCaptureHabit,
  recordSaleCaptureHabit,
  resolveTimeBucket,
  type FormHabitStorage,
} from "@/lib/form-habit-learner";

function createMemoryStorage(): FormHabitStorage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
}

describe("form-habit-learner (Capacidad 2)", () => {
  let storage: FormHabitStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
    clearFormHabits(storage);
  });

  it("resuelve franja horaria y favorece eventos recientes en la misma franja", () => {
    const morningDate = new Date(2026, 10, 22, 7, 30, 0);
    const afternoonDate = new Date(2026, 10, 22, 15, 0, 0);
    const nightDate = new Date(2026, 10, 22, 21, 0, 0);

    expect(resolveTimeBucket(morningDate)).toBe("manana");
    expect(resolveTimeBucket(afternoonDate)).toBe("tarde");
    expect(resolveTimeBucket(nightDate)).toBe("noche");

    const nowMs = afternoonDate.getTime();
    const recentSameBucket = computeHabitEntryScore(nowMs - 60_000, "tarde", nowMs, "tarde");
    const recentOtherBucket = computeHabitEntryScore(nowMs - 60_000, "manana", nowMs, "tarde");
    const oldSameBucket = computeHabitEntryScore(nowMs - 20 * 86_400_000, "tarde", nowMs, "tarde");

    expect(recentSameBucket).toBeGreaterThan(recentOtherBucket);
    expect(recentSameBucket).toBeGreaterThan(oldSameBucket);
  });

  it("predice ubicación y cantidades frecuentes de huevos respetando la franja horaria", () => {
    const morningMs = new Date(2026, 10, 22, 7, 15, 0).getTime();
    const afternoonMs = new Date(2026, 10, 22, 16, 0, 0).getTime();

    recordEggCaptureHabit({ locationId: "loc-norte", species: "gallina", trays: 4, looseEggs: 12, timestampMs: morningMs }, storage);
    recordEggCaptureHabit({ locationId: "loc-norte", species: "gallina", trays: 4, looseEggs: 12, timestampMs: morningMs - 86_400_000 }, storage);
    recordEggCaptureHabit({ locationId: "loc-sur", species: "codorniz", batchId: "lote-c1", trays: 2, looseEggs: 0, timestampMs: afternoonMs }, storage);

    const predMorning = predictEggCaptureDefaults({ currentBucket: "manana", nowMs: morningMs + 300_000 }, storage);
    expect(predMorning.locationId).toBe("loc-norte");
    expect(predMorning.species).toBe("gallina");
    expect(predMorning.topQuantities[0]).toMatchObject({ trays: 4, looseEggs: 12, total: 132 });
  });

  it("aprende afinidad ubicación -> alimento y ración en alimentación", () => {
    const nowMs = Date.now();
    recordFeedCaptureHabit({ locationId: "galpon-1", feedId: "feed-postura", quantity: "40", timestampMs: nowMs }, storage);
    recordFeedCaptureHabit({ locationId: "galpon-1", feedId: "feed-postura", quantity: "40", timestampMs: nowMs - 86_400_000 }, storage);
    recordFeedCaptureHabit({ locationId: "galpon-2", feedId: "feed-engorde", quantity: "25", timestampMs: nowMs }, storage);

    const predG1 = predictFeedForLocation({ locationId: "galpon-1", nowMs }, storage);
    expect(predG1.feedId).toBe("feed-postura");
    expect(predG1.quantity).toBe("40");

    const predG2 = predictFeedForLocation({ locationId: "galpon-2", nowMs }, storage);
    expect(predG2.feedId).toBe("feed-engorde");
    expect(predG2.quantity).toBe("25");
  });

  it("rankea proveedores frecuentes, compradores frecuentes y causas de mortalidad", () => {
    const nowMs = Date.now();

    recordMortalityCaptureHabit({ locationId: "galpon-1", birdType: "lote_pollos", cause: "accidente", timestampMs: nowMs }, storage);
    const mortPred = predictMortalityDefaults({ nowMs }, storage);
    expect(mortPred).toEqual({ locationId: "galpon-1", birdType: "lote_pollos", cause: "accidente" });

    recordExpenseCaptureHabit({
      category: "Compra de insumos",
      counterparty: "Agropecuaria El Campo",
      species: "gallina",
      locationId: "galpon-1",
      amount: 145000,
      description: "Vitaminas AD3E",
      timestampMs: nowMs,
    }, storage);
    recordExpenseCaptureHabit({
      category: "Compra de insumos",
      counterparty: "Agropecuaria El Campo",
      species: "gallina",
      locationId: "galpon-1",
      amount: 160000,
      description: "Calcio granulado",
      timestampMs: nowMs + 1000,
    }, storage);
    recordExpenseCaptureHabit({
      category: "Transporte",
      counterparty: "Fletes Tolima",
      amount: 35000,
      description: "Flete bultos",
      timestampMs: nowMs - 10 * 86_400_000,
    }, storage);

    const expPred = predictExpenseShortcuts({ nowMs: nowMs + 2000 }, storage);
    expect(expPred.preferredCategory).toBe("Compra de insumos");
    expect(expPred.frequentSuppliers[0]).toMatchObject({
      counterparty: "Agropecuaria El Campo",
      lastAmount: 160000,
      lastDescription: "Calcio granulado",
    });

    recordSaleCaptureHabit({
      saleType: "huevos",
      buyer: "Tienda La Vereda",
      species: "gallina",
      locationId: "galpon-1",
      size: "AAA",
      presentation: "Cubeta x30",
      unitPrice: "700",
      quantity: "120",
      isCredit: true,
      creditDays: 15,
      timestampMs: nowMs,
    }, storage);
    recordSaleCaptureHabit({
      saleType: "carne",
      buyer: "Asadero Central",
      species: "pollo",
      unitPrice: "15500",
      quantity: "12",
      isCredit: false,
      timestampMs: nowMs,
    }, storage);

    const eggSalesPred = predictSaleShortcuts({ saleType: "huevos", nowMs }, storage);
    expect(eggSalesPred.frequentBuyers).toHaveLength(1);
    expect(eggSalesPred.frequentBuyers[0]).toMatchObject({
      buyer: "Tienda La Vereda",
      size: "AAA",
      unitPrice: "700",
      quantity: "120",
      isCredit: true,
    });
  });
});
