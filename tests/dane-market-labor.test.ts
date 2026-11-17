import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readXlsxSheets: vi.fn(),
  fetchLatestOfficialDaneXlsx: vi.fn(),
}));

vi.mock("@/lib/external-sources/wave6-dane-files", () => ({
  readXlsxSheets: mocks.readXlsxSheets,
  fetchLatestOfficialDaneXlsx: mocks.fetchLatestOfficialDaneXlsx,
}));

import { parseGeihWorkbook } from "@/lib/external-sources/wave7-dane-market-labor";

describe("Anexo mensual DANE GEIH", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lee solo la sección Total Nacional y no cuenta Total Cabeceras como filas nacionales", () => {
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const indicators = [
      "Tasa Global de Participación (TGP)",
      "Tasa de Ocupación (TO)",
      "Tasa de Desocupación (TD)",
      "Tasa de Subocupación (TS)",
    ];
    const rows: string[][] = Array.from({ length: 40 }, () => []);
    rows[9] = ["Total Nacional"];
    rows[11] = ["Concepto", "2026", ...Array(11).fill("")];
    rows[12] = ["", ...months];
    indicators.forEach((label, indicatorIndex) => {
      rows[13 + indicatorIndex] = [label, ...months.map((_, monthIndex) => String(60 + indicatorIndex + monthIndex / 10))];
    });
    rows[27] = ["Total Cabeceras"];
    rows[29] = ["Concepto", "2026", ...Array(11).fill("")];
    rows[30] = ["", ...months];
    indicators.forEach((label, indicatorIndex) => {
      rows[31 + indicatorIndex] = [label, ...months.map((_, monthIndex) => String(90 + indicatorIndex + monthIndex / 10))];
    });
    mocks.readXlsxSheets.mockReturnValue([{ name: "Total nacional", rows }]);

    const parsed = parseGeihWorkbook(new Uint8Array([1, 2, 3]), "https://www.dane.gov.co/files/operaciones/GEIH/anex-GEIH-dic2026.xlsx");

    expect(parsed.latestPeriod).toBe("2026-12");
    expect(parsed.observations).toHaveLength(48);
    expect(new Set(parsed.observations.map((row) => row.observationKey)).size).toBe(48);
    expect(parsed.metadata.sourceRowCount).toBe(48);
    expect(parsed.observations.every((row) => row.dimensions?.geography === "Total nacional")).toBe(true);
    expect(parsed.observations.find((row) =>
      row.dimensions?.indicator === "Tasa Global de Participación (TGP)" && row.dimensions?.period === "2026-12",
    )?.value).toBeCloseTo(61.1);
  });
});
