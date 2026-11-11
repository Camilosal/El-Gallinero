import { describe, expect, it } from "vitest";
import { nextMaintenanceDate } from "@/lib/maintenance-schedule";

describe("programación de mantenimiento", () => {
  it("calcula la próxima fecha conservando el día calendario", () => {
    expect(nextMaintenanceDate("2026-01-31", 30)).toBe("2026-03-02");
    expect(nextMaintenanceDate("2026-02-28", 7)).toBe("2026-03-07");
  });

  it("rechaza fechas o intervalos fuera de rango", () => {
    expect(() => nextMaintenanceDate("2026-02-30", 7)).toThrow();
    expect(() => nextMaintenanceDate("2026-02-01", 0)).toThrow();
    expect(() => nextMaintenanceDate("2026-02-01", 3651)).toThrow();
  });
});
