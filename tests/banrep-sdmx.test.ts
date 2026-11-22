import { describe, expect, it } from "vitest";
import {
  buildBanrepSeriesUrl,
  DEFAULT_BANREP_FLOW_IDS,
  parseBanrepFlowSelection,
  parseBanrepSeriesCsv,
} from "@/lib/external-sources/wave4-official-economic";

describe("Banco de la República SDMX CSV", () => {
  it("retains period, value, indicator dimensions and unit", () => {
    const csv = [
      "DATAFLOW,REF_AREA,FREQ,MEASURE,UNIT_MEASURE,ACTIVITY,ADJUSTMENT,TRANSFORMATION,TIME_HORIZ,METHODOLOGY,Fecha,Valor,OBS_STATUS,UNIT_MULT,DECIMALS",
      "BANREP.CIE:DF_IBR(1.0),COL,D,IRIBRM00,ER,_Z,_Z,_Z,_Z,_Z,2026-11-16,11.927,A,0,3",
      "BANREP.CIE:DF_IBR(1.0),COL,D,IRIBRM00,NR,_Z,_Z,_Z,_Z,_Z,2026-11-17,11.899,A,0,3",
    ].join("\r\n");

    expect(parseBanrepSeriesCsv(csv)).toEqual([
      { period: "2026-11-16", value: 11.927, measure: "IRIBRM00", unitMeasure: "ER", frequency: "D" },
      { period: "2026-11-17", value: 11.899, measure: "IRIBRM00", unitMeasure: "NR", frequency: "D" },
    ]);
  });

  it("builds an allowlisted query for the current REST SDMX service", () => {
    const url = new URL(buildBanrepSeriesUrl("DF_IBR", 30));
    expect(url.origin).toBe("https://totoro.banrep.gov.co");
    expect(url.pathname).toBe("/sdmx/rest/data/BANREP.CIE,DF_IBR,1.0/");
    expect(url.searchParams.get("lastNObservations")).toBe("30");
    expect(url.searchParams.get("dimensionAtObservation")).toBe("TIME_PERIOD");
    expect(url.searchParams.get("format")).toBe("csv");
    expect(() => buildBanrepSeriesUrl("DF_NOT_APPROVED")).toThrow("no permitido");
  });

  it("rejects a response without recognizable period/value columns", () => {
    expect(() => parseBanrepSeriesCsv("foo,bar\none,two")).toThrow("periodos y valores");
  });

  it("loads only distinct allowlisted series and keeps a safe default", () => {
    expect(parseBanrepFlowSelection(["DF_IBR", "DF_UVR", "DF_IBR", "DF_UNKNOWN"])).toEqual([
      "DF_IBR",
      "DF_UVR",
    ]);
    expect(parseBanrepFlowSelection("[\"DF_DTF\"]")).toEqual(["DF_DTF"]);
    expect(parseBanrepFlowSelection(["DF_UNKNOWN"])).toEqual(DEFAULT_BANREP_FLOW_IDS);
  });
});
