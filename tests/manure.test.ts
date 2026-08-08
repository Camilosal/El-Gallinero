import { describe, it, expect } from "vitest";
import { estimatedKgPerDay, totalEstimatedKgPerDay, daysSince } from "@/lib/manure";

describe("manure estimation", () => {
  it("estimatedKgPerDay multiplica aves × factor con 2 decimales", () => {
    expect(estimatedKgPerDay({ key: "x", label: "Postura", count: 12, kgPerBirdPerDay: 0.13 })).toBe(1.56);
  });

  it("estimatedKgPerDay con factor 0 aporta 0", () => {
    expect(estimatedKgPerDay({ key: "x", label: "Gallos", count: 3, kgPerBirdPerDay: 0 })).toBe(0);
  });

  it("totalEstimatedKgPerDay suma todos los grupos", () => {
    const groups = [
      { key: "a", label: "Postura", count: 10, kgPerBirdPerDay: 0.13 },
      { key: "b", label: "Gallos", count: 3, kgPerBirdPerDay: 0.15 },
    ];
    expect(totalEstimatedKgPerDay(groups)).toBe(1.75);
  });

  it("totalEstimatedKgPerDay lista vacía = 0", () => {
    expect(totalEstimatedKgPerDay([])).toBe(0);
  });

  it("daysSince calcula días entre fechas, nunca negativo", () => {
    expect(daysSince("2026-08-04", new Date("2026-08-07T12:00:00"))).toBe(3);
    expect(daysSince("2026-08-07", new Date("2026-08-07T12:00:00"))).toBe(0);
    expect(daysSince("2026-08-10", new Date("2026-08-07T12:00:00"))).toBe(0);
  });
});
