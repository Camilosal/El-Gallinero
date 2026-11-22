import { describe, expect, it } from "vitest";
import { SETTING_DEFS } from "@/lib/settings";

describe("Valores maestros oficiales con vigencia y referencia", () => {
  it("usa los valores oficiales 2026 como referencia y permite revisar sus fuentes desde Catálogos", () => {
    const uvt = SETTING_DEFS.find((setting) => setting.key === "external.tax_uvt_cop");
    const minimumWage = SETTING_DEFS.find((setting) => setting.key === "payroll.smlmv_cop");
    const transport = SETTING_DEFS.find((setting) => setting.key === "payroll.transport_allowance_cop");
    const transportLimit = SETTING_DEFS.find((setting) => setting.key === "payroll.transport_allowance_max_smlmv");

    expect(uvt).toMatchObject({ default: "52374", group: "Impuestos y retenciones", effectiveFrom: "2026-01-01", reviewRequired: true });
    expect(uvt?.sourceUrl).toContain("dian.gov.co");
    expect(minimumWage).toMatchObject({ default: "1750905", group: "Costos laborales y nómina", effectiveFrom: "2026-01-01", reviewRequired: true });
    expect(minimumWage?.sourceUrl).toContain("funcionpublica.gov.co");
    expect(transport).toMatchObject({ default: "249095", group: "Costos laborales y nómina", effectiveFrom: "2026-01-01", reviewRequired: true });
    expect(transportLimit).toMatchObject({ default: "2", group: "Costos laborales y nómina", effectiveFrom: "2026-01-01", reviewRequired: true });
  });
});
