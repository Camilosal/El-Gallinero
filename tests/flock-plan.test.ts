import { describe, it, expect } from "vitest";
import {
  buildFlockPlanLive,
  buildFlockPlanProjection,
  buildFlockPlanSummary,
  startOfWeek,
  toISODate,
  type BuildFlockPlanInput,
} from "@/lib/flock-plan";

const STAGES = [
  { id: "pollito", value: "Pollito", minWeeks: 0, maxWeeks: 6, expectedEggsPerHen: 0 },
  { id: "juvenil", value: "Juvenil", minWeeks: 6, maxWeeks: 18, expectedEggsPerHen: 0 },
  { id: "pre", value: "Pre-postura", minWeeks: 18, maxWeeks: 20, expectedEggsPerHen: 0.3 },
  { id: "postura", value: "Postura", minWeeks: 20, maxWeeks: null, expectedEggsPerHen: 0.85 },
];

function input(overrides: Partial<BuildFlockPlanInput> = {}): BuildFlockPlanInput {
  return {
    today: new Date("2026-11-07T12:00:00"),
    hens: [
      { code: "G-1", birthDate: "2026-04-11", status: "activa" }, // 30 semanas
      { code: "G-2", birthDate: "2026-04-11", status: "activa" }, // 30 semanas
      { code: "G-3", birthDate: "2026-06-27", status: "activa" }, // 19 semanas
      { code: "G-4", birthDate: "2025-02-08", status: "recomendada_sacrificio" }, // 91 semanas
    ],
    roosterStatuses: ["activo"],
    batchCount: 1,
    batchQuantity: 7,
    stages: STAGES,
    finPosturaWeeks: 80,
    hensPerRooster: 10,
    last7Eggs: 20,
    previous7Eggs: 18,
    eggWeeks: [{ weekStart: "2026-11-02", totalEggs: 20 }],
    ...overrides,
  };
}

describe("flock-plan", () => {
  it("calcula el diagnóstico con la edad real y excluye gallinas fuera de ciclo", () => {
    const live = buildFlockPlanLive(input());

    expect(live.animalsTotal).toBe(12); // 4 gallinas + 1 gallo + 7 pollos
    expect(live.hens.total).toBe(4);
    expect(live.hens.inCycle).toBe(3);
    expect(live.hens.laying).toBe(3); // G-4 está recomendada, no "activa"
    expect(live.hens.recommended).toBe(1);
    expect(live.hens.phase).toBe("Postura");
    expect(live.roosters.active).toBe(1);
    expect(live.roosters.required).toBe(1);
    expect(live.replacement.dueNow).toBe(1);
    expect(live.eggs.expectedPerDay).toBe(2); // 0.85 + 0.85 + 0.3
    expect(live.eggs.expectedPerWeek).toBe(14);
    expect(live.eggs.compliancePct).toBe(142.9);
    expect(live.alerts.some((alert) => alert.title.includes("fuera del ciclo"))).toBe(true);
    expect(live.alerts.some((alert) => alert.detail.includes("supera el estándar"))).toBe(true);
    expect(
      live.alerts.some((alert) => alert.action?.href.includes("estado=recomendada_sacrificio")),
    ).toBe(true);
    expect(live.alerts.some((alert) => alert.action?.href.includes("tab=pollos"))).toBe(false);
  });

  it("proyecta 17 semanas y compara el real solo en semanas pasadas o actuales", () => {
    const projection = buildFlockPlanProjection(input());
    const current = projection.weeks.find((week) => week.isCurrent);
    const future = projection.weeks.find((week) => week.offset === 4);

    expect(projection.weeks).toHaveLength(17);
    expect(projection.weeks[0].offset).toBe(-4);
    expect(projection.weeks[16].offset).toBe(12);
    expect(current).toBeTruthy();
    expect(current?.expectedHens).toBe(3);
    expect(current?.expectedEggs).toBe(14);
    expect(current?.actualEggs).toBe(20);
    expect(current?.compliancePct).toBeNull(); // en curso
    expect(future?.actualEggs).toBeNull();
    expect(future?.expectedEggs).toBeGreaterThan(0);
  });

  it("calcula el avance y la brecha del plan", () => {
    const live = buildFlockPlanLive(input());
    const summary = buildFlockPlanSummary(
      {
        startDate: "2026-01-01",
        targetHenCount: 5,
        targetRoosterCount: 1,
        replacementDate: "2027-01-01",
      },
      live,
      new Date("2026-11-07T12:00:00"),
    );

    expect(summary.currentHens).toBe(3);
    expect(summary.gapHens).toBe(-2);
    expect(summary.gapRoosters).toBe(0);
    expect(summary.progressPct).toBeGreaterThan(80);
    expect(summary.daysToReplacement).toBeGreaterThan(0);
  });

  it("calcula el lunes de la semana", () => {
    expect(toISODate(startOfWeek(new Date("2026-11-07T12:00:00")))).toBe("2026-11-02");
    expect(toISODate(startOfWeek(new Date("2026-11-08T12:00:00")))).toBe("2026-11-02");
    expect(toISODate(startOfWeek(new Date("2026-11-09T12:00:00")))).toBe("2026-11-09");
  });
});
