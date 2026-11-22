import { syncDivipolaSnapshot, syncMarketPricesSnapshot, syncWeatherSnapshot } from "./wave1-territory-weather-market";
import { syncColombianTaxAndHolidaysSnapshot } from "./wave3-tax-holidays-iot";
import { syncBanrepMacroSnapshot } from "./wave4-official-economic";
import { syncIdeamHydroAlertsSnapshot } from "./wave5-official-alerts";
import { syncOfficialDaneIndicesSnapshots } from "./wave6-dane-files";
import { syncOfficialGeihSnapshot, syncOfficialSipsaISnapshot } from "./wave7-dane-market-labor";
import { getSettings } from "@/lib/settings";

const DUE_SYNCERS = [
  ["divipola_dane", syncDivipolaSnapshot],
  ["open_meteo", syncWeatherSnapshot],
  ["dane_sipsa_trm", syncMarketPricesSnapshot],
  ["dane_price_indices", syncOfficialDaneIndicesSnapshots],
  ["dane_sipsa_i", syncOfficialSipsaISnapshot],
  ["dane_labor_geih", syncOfficialGeihSnapshot],
  ["banrep_sdmx", syncBanrepMacroSnapshot],
  ["ideam_hydro_alerts", syncIdeamHydroAlertsSnapshot],
  ["colombia_tax_holidays", syncColombianTaxAndHolidaysSnapshot],
] as const;

export interface ExternalSourceSyncResult {
  sourceKey: string;
  status: string;
  providerName: string;
  fetchedAt: string;
  expiresAt: string | null;
  summary: string | null;
  lastError: string | null;
}

export async function syncExternalSourcesDue(): Promise<{
  checked: string[];
  failed: string[];
  results: ExternalSourceSyncResult[];
}> {
  const settings = await getSettings();
  if (settings["external.sync_enabled"] !== "true") {
    return { checked: [], failed: [], results: [] };
  }
  const results = await Promise.allSettled(DUE_SYNCERS.map(([, sync]) => sync()));
  const checked: string[] = [];
  const failed: string[] = [];
  const sourceResults: ExternalSourceSyncResult[] = [];
  results.forEach((result, index) => {
    const [key] = DUE_SYNCERS[index];
    if (result.status === "fulfilled") {
      checked.push(key);
      if (
        result.value.status === "error" ||
        (result.value.status === "fallback" && Boolean(result.value.lastError))
      ) {
        failed.push(key);
      }
      sourceResults.push({
        sourceKey: key,
        status: result.value.status,
        providerName: result.value.providerName,
        fetchedAt: result.value.fetchedAt.toISOString(),
        expiresAt: result.value.expiresAt?.toISOString() ?? null,
        summary: result.value.summary,
        lastError: result.value.lastError,
      });
    } else {
      failed.push(key);
      sourceResults.push({
        sourceKey: key,
        status: "error",
        providerName: "",
        fetchedAt: new Date().toISOString(),
        expiresAt: null,
        summary: null,
        lastError: result.reason instanceof Error ? result.reason.message : "Error desconocido al sincronizar",
      });
    }
  });
  return { checked, failed, results: sourceResults };
}
