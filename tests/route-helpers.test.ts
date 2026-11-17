import { describe, expect, it } from "vitest";
import { DEFAULT_FARM_ID } from "@/db/tenant-context";
import { resolveMaxUsersFromPlan } from "@/lib/subscription";
import { canManagePlatformTenants } from "@/lib/superadmin-tenants";
import { computeIth, evaluateSensorAlert } from "@/lib/sensor-metrics";
import { suggestCarbonKg } from "@/lib/manure-operations";

describe("Lógica compartida por rutas API", () => {
  it("resuelve cupos explícitos, planes vigentes, heredados y desconocidos", () => {
    expect(resolveMaxUsersFromPlan("MEDIANO_MENSUAL", 20)).toBe(20);
    expect(resolveMaxUsersFromPlan("CICLO_60D", null)).toBe(3);
    expect(resolveMaxUsersFromPlan("COMERCIAL_MEDIANO", null)).toBe(15);
    expect(resolveMaxUsersFromPlan("PLAN_DESCONOCIDO", null)).toBe(2);
  });

  it("limita la gestión global de granjas al tenant base", () => {
    expect(canManagePlatformTenants(null)).toBe(false);
    expect(canManagePlatformTenants({ role: "admin", farmId: "farm-client" })).toBe(false);
    expect(canManagePlatformTenants({ role: "admin", farmId: DEFAULT_FARM_ID })).toBe(true);
    expect(canManagePlatformTenants({ role: "propietario", farmId: DEFAULT_FARM_ID })).toBe(true);
  });

  it("conserva la fórmula ITH y sus alertas", () => {
    expect(computeIth(30, 75)).toBe(82.15);
    expect(evaluateSensorAlert("ith", 80, null)).toEqual({
      triggered: true,
      reason: "Estrés calórico detectado (ITH 80 ≥ 72)",
    });
    expect(evaluateSensorAlert("temperatura", 25, null)).toEqual({ triggered: false, reason: null });
  });

  it("sugiere carbono según las relaciones de compostaje configuradas", () => {
    expect(suggestCarbonKg("3:1:1", 300, 20)).toBe(100);
    expect(suggestCarbonKg("7:2:2", 700, 50)).toBe(200);
    expect(suggestCarbonKg("otra", 100, 50)).toBe(45);
  });
});
