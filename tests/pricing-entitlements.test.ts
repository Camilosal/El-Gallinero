import { describe, expect, it } from "vitest";
import { getPlanEntitlements, resolveCommercialPlan } from "@/lib/pricing/entitlements";
import { canConsumeGinaQuota } from "@/lib/pricing/gina-quota";

describe("entitlements comerciales separadas del RBAC", () => {
  it("mantiene el plan Gratis y sus límites base", () => {
    const plan = getPlanEntitlements(resolveCommercialPlan("FREEMIUM_SEMILLA", false));

    expect(plan).toMatchObject({
      plan: "free",
      maxUserSeats: 1,
      maxBeneficiaries: null,
      maxActiveBatchesPerSpecies: 1,
      maxActiveLocations: 1,
      farmModulesAvailable: true,
      aggregatorControlAvailable: false,
    });
    expect(plan.gina).toMatchObject({
      messagesPerMonth: 10,
      audiosPerMonth: 2,
      attachmentsPerMonth: 2,
      maxAudioSeconds: 60,
      rollover: false,
    });
  });

  it("mapea los códigos históricos pagados a Productor solo mientras conservan acceso", () => {
    expect(resolveCommercialPlan("CICLO_60D", true)).toBe("producer");
    expect(resolveCommercialPlan("SEMESTRAL_PONEDORA", true)).toBe("producer");
    expect(resolveCommercialPlan("ANUAL_20", false)).toBe("free");
    expect(resolveCommercialPlan("FREEMIUM_SEMILLA", true)).toBe("free");
  });

  it("usa los cupos de Productor sin convertir roles en permisos de plan", () => {
    const plan = getPlanEntitlements("producer", 40);

    expect(plan).toMatchObject({
      maxUserSeats: 25,
      maxBeneficiaries: null,
      maxActiveBatchesPerSpecies: null,
      maxActiveLocations: null,
      farmModulesAvailable: true,
    });
    expect(plan.gina).toMatchObject({ messagesPerMonth: 100, audiosPerMonth: 15, attachmentsPerMonth: 10, maxAudioSeconds: 90 });
  });

  it("no inventa cupos de beneficiarios ni habilita controles Agregador inexistentes", () => {
    const activeAggregator = resolveCommercialPlan("AGREGADOR", true);
    const expiredAggregator = resolveCommercialPlan("AGREGADOR", false);

    expect(activeAggregator).toBe("aggregator");
    expect(expiredAggregator).toBe("free");
    expect(getPlanEntitlements(activeAggregator, 5)).toMatchObject({
      maxUserSeats: 5,
      maxBeneficiaries: null,
      aggregatorControlAvailable: false,
    });
  });
});

describe("cupos de Gina por modalidad", () => {
  it("cada audio y adjunto consume también una consulta", () => {
    const limits = { messages: 10, audios: 2, attachments: 2 };

    expect(canConsumeGinaQuota({ messages: 9, audios: 1, attachments: 0 }, limits, "audio")).toBe(true);
    expect(canConsumeGinaQuota({ messages: 10, audios: 1, attachments: 0 }, limits, "audio")).toBe(false);
    expect(canConsumeGinaQuota({ messages: 9, audios: 0, attachments: 1 }, limits, "attachment")).toBe(true);
    expect(canConsumeGinaQuota({ messages: 10, audios: 0, attachments: 1 }, limits, "attachment")).toBe(false);
    expect(canConsumeGinaQuota({ messages: 9, audios: 2, attachments: 0 }, limits, "audio")).toBe(false);
  });
});
