import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  syncDivipolaSnapshot: vi.fn(),
  syncWeatherSnapshot: vi.fn(),
  syncMarketPricesSnapshot: vi.fn(),
  syncColombianTaxAndHolidaysSnapshot: vi.fn(),
  syncBanrepMacroSnapshot: vi.fn(),
  syncIdeamHydroAlertsSnapshot: vi.fn(),
  syncOfficialDaneIndicesSnapshots: vi.fn(),
  syncOfficialSipsaISnapshot: vi.fn(),
  syncOfficialGeihSnapshot: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@/lib/external-sources/wave1-territory-weather-market", () => ({
  syncDivipolaSnapshot: mocks.syncDivipolaSnapshot,
  syncMarketPricesSnapshot: mocks.syncMarketPricesSnapshot,
  syncWeatherSnapshot: mocks.syncWeatherSnapshot,
}));
vi.mock("@/lib/external-sources/wave3-tax-holidays-iot", () => ({
  syncColombianTaxAndHolidaysSnapshot: mocks.syncColombianTaxAndHolidaysSnapshot,
}));
vi.mock("@/lib/external-sources/wave4-official-economic", () => ({
  syncBanrepMacroSnapshot: mocks.syncBanrepMacroSnapshot,
}));
vi.mock("@/lib/external-sources/wave5-official-alerts", () => ({
  syncIdeamHydroAlertsSnapshot: mocks.syncIdeamHydroAlertsSnapshot,
}));
vi.mock("@/lib/external-sources/wave6-dane-files", () => ({
  syncOfficialDaneIndicesSnapshots: mocks.syncOfficialDaneIndicesSnapshots,
}));
vi.mock("@/lib/external-sources/wave7-dane-market-labor", () => ({
  syncOfficialSipsaISnapshot: mocks.syncOfficialSipsaISnapshot,
  syncOfficialGeihSnapshot: mocks.syncOfficialGeihSnapshot,
}));
vi.mock("@/lib/settings", () => ({ getSettings: mocks.getSettings }));

import { syncExternalSourcesDue } from "@/lib/external-sources/sync-orchestrator";

describe("Programación de fuentes externas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("respeta el interruptor de sincronización por granja", async () => {
    mocks.getSettings.mockResolvedValue({ "external.sync_enabled": "false" });

    await expect(syncExternalSourcesDue()).resolves.toEqual({ checked: [], failed: [], results: [] });
    expect(mocks.syncDivipolaSnapshot).not.toHaveBeenCalled();
    expect(mocks.syncWeatherSnapshot).not.toHaveBeenCalled();
    expect(mocks.syncMarketPricesSnapshot).not.toHaveBeenCalled();
    expect(mocks.syncBanrepMacroSnapshot).not.toHaveBeenCalled();
    expect(mocks.syncIdeamHydroAlertsSnapshot).not.toHaveBeenCalled();
    expect(mocks.syncOfficialDaneIndicesSnapshots).not.toHaveBeenCalled();
    expect(mocks.syncOfficialSipsaISnapshot).not.toHaveBeenCalled();
    expect(mocks.syncOfficialGeihSnapshot).not.toHaveBeenCalled();
    expect(mocks.syncColombianTaxAndHolidaysSnapshot).not.toHaveBeenCalled();
  });

  it("ejecuta IPC e IPP como fuente programada y conserva su resultado", async () => {
    mocks.getSettings.mockResolvedValue({ "external.sync_enabled": "true" });
    const now = new Date();
    const snapshot = {
      status: "ok",
      providerName: "DANE IPC e IPP · anexos oficiales XLSX",
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      summary: "IPC: 2026-10 · IPP: 2026-10",
      lastError: null,
    };
    mocks.syncDivipolaSnapshot.mockResolvedValue(snapshot);
    mocks.syncWeatherSnapshot.mockResolvedValue(snapshot);
    mocks.syncMarketPricesSnapshot.mockResolvedValue(snapshot);
    mocks.syncBanrepMacroSnapshot.mockResolvedValue(snapshot);
    mocks.syncIdeamHydroAlertsSnapshot.mockResolvedValue(snapshot);
    mocks.syncOfficialDaneIndicesSnapshots.mockResolvedValue(snapshot);
    mocks.syncOfficialSipsaISnapshot.mockResolvedValue(snapshot);
    mocks.syncOfficialGeihSnapshot.mockResolvedValue(snapshot);
    mocks.syncColombianTaxAndHolidaysSnapshot.mockResolvedValue(snapshot);

    const result = await syncExternalSourcesDue();

    expect(mocks.syncOfficialDaneIndicesSnapshots).toHaveBeenCalledOnce();
    expect(result.checked).toContain("dane_price_indices");
    expect(result.failed).not.toContain("dane_price_indices");
    expect(mocks.syncOfficialSipsaISnapshot).toHaveBeenCalledOnce();
    expect(mocks.syncOfficialGeihSnapshot).toHaveBeenCalledOnce();
    expect(result.checked).toContain("dane_sipsa_i");
    expect(result.checked).toContain("dane_labor_geih");
  });
});
