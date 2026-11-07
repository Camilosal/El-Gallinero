import { describe, it, expect } from "vitest";
import {
  isBatchPresent,
  isHenAvailableForExit,
  isHenLaying,
  isHenPresent,
  isRoosterPresent,
  summarizeHens,
  summarizeRoosters,
} from "@/lib/animal-status";

describe("animal-status", () => {
  it("considera presentes todas las gallinas no terminales", () => {
    for (const status of ["activa", "empollando", "enferma", "descarte", "recomendada_sacrificio"]) {
      expect(isHenPresent(status)).toBe(true);
    }
    for (const status of ["vendida", "faena", "muerta"]) {
      expect(isHenPresent(status)).toBe(false);
    }
  });

  it("considera presentes los gallos activos o enfermos", () => {
    expect(isRoosterPresent("activo")).toBe(true);
    expect(isRoosterPresent("enfermo")).toBe(true);
    expect(isRoosterPresent("vendido")).toBe(false);
    expect(isRoosterPresent("faena")).toBe(false);
    expect(isRoosterPresent("muerto")).toBe(false);
  });

  it("considera presentes los lotes activos con animales", () => {
    expect(isBatchPresent("activo", 7)).toBe(true);
    expect(isBatchPresent("listo_sacrificio", 7)).toBe(true);
    expect(isBatchPresent("activo", 0)).toBe(false);
    expect(isBatchPresent("vendido", 7)).toBe(false);
    expect(isBatchPresent("faena", 7)).toBe(false);
  });

  it("define postura y salida con los estados correctos", () => {
    expect(isHenLaying("activa")).toBe(true);
    expect(isHenLaying("empollando")).toBe(false);
    expect(isHenLaying("enferma")).toBe(false);

    expect(isHenAvailableForExit("activa")).toBe(true);
    expect(isHenAvailableForExit("empollando")).toBe(true);
    expect(isHenAvailableForExit("recomendada_sacrificio")).toBe(true);
    expect(isHenAvailableForExit("enferma")).toBe(false);
    expect(isHenAvailableForExit("descarte")).toBe(false);
    expect(isHenAvailableForExit("vendida")).toBe(false);
  });

  it("resume las gallinas con las cifras reales del inventario", () => {
    const summary = summarizeHens([
      { status: "activa", count: 22 },
      { status: "empollando", count: 1 },
      { status: "enferma", count: 1 },
      { status: "recomendada_sacrificio", count: 5 },
      { status: "vendida", count: 2 },
      { status: "faena", count: 1 },
    ]);

    expect(summary.registered).toBe(32);
    expect(summary.present).toBe(29);
    expect(summary.active).toBe(29);
    expect(summary.laying).toBe(22);
    expect(summary.broody).toBe(1);
    expect(summary.sick).toBe(1);
    expect(summary.recommendedForSlaughter).toBe(5);
    expect(summary.sold).toBe(2);
    expect(summary.slaughtered).toBe(1);
    expect(summary.dead).toBe(0);
  });

  it("resume los gallos incluyendo enfermos como presentes", () => {
    const summary = summarizeRoosters([
      { status: "activo", count: 2 },
      { status: "enfermo", count: 1 },
      { status: "vendido", count: 1 },
    ]);

    expect(summary.registered).toBe(4);
    expect(summary.present).toBe(3);
    expect(summary.active).toBe(3);
    expect(summary.sick).toBe(1);
    expect(summary.sold).toBe(1);
  });
});
