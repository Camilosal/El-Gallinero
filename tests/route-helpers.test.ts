import { describe, expect, it } from "vitest";
import { DEFAULT_FARM_ID } from "@/db/tenant-context";
import { getPlanEntitlements, resolveCommercialPlan } from "@/lib/pricing/entitlements";
import { canManagePlatformTenants } from "@/lib/superadmin-tenants";
import { computeIth, evaluateSensorAlert } from "@/lib/sensor-metrics";
import { suggestCarbonKg } from "@/lib/manure-operations";

describe("Lógica compartida por rutas API", () => {
  it("resuelve cupos de plan por separado de los roles", () => {
    expect(getPlanEntitlements(resolveCommercialPlan("MEDIANO_MENSUAL", true), 20).maxUserSeats).toBe(20);
    expect(getPlanEntitlements(resolveCommercialPlan("CICLO_60D", true), 3).maxUserSeats).toBe(3);
    expect(getPlanEntitlements(resolveCommercialPlan("COMERCIAL_MEDIANO", true), 15).maxUserSeats).toBe(15);
    expect(getPlanEntitlements(resolveCommercialPlan("PLAN_DESCONOCIDO", false)).maxUserSeats).toBe(1);
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
