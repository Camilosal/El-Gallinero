import { createHash } from "node:crypto";
import { getSettings } from "@/lib/settings";
import {
  fetchLatestOfficialDaneXlsx,
  readXlsxSheets,
  type XlsxSheet,
} from "./wave6-dane-files";
import {
  getExternalSnapshot,
  isSnapshotExpired,
  saveExternalObservations,
  saveExternalSnapshot,
  type ExternalObservationInput,
  type StoredExternalSnapshot,
} from "./snapshot-store";

const SIPSA_I_HISTORY_PAGE = "https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-insumos-1/componente-insumos-historicos";
const GEIH_HISTORY_PAGE = "https://www.dane.gov.co/index.php/estadisticas-por-tema/mercado-laboral/empleo-y-desempleo/geih-historicos";
const PARSER_VERSION = "dane-sipsa-i-geih-openxml-v2";
const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

function normalizeText(value: string | undefined): string {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function parsePeriod(value: string): { label: string; year: number; month: number } | null {
  const normalized = normalizeText(value);
  const match = normalized.match(/(?:^|_)([a-z]+)_(?:de_)?(20\d{2})(?:_|$)/);
  if (!match) return null;
  const month = MONTHS[match[1]] || MONTHS[match[1].slice(0, 4)] || MONTHS[match[1].slice(0, 3)];
  const year = Number(match[2]);
  if (!month || year < 2000 || year > 2100) return null;
  return { label: `${year}-${String(month).padStart(2, "0")}`, year, month };
}

function parseNumeric(value: string | undefined): number | null {
  if (value == null || !value.trim()) return null;
  let normalized = value.trim().replace(/\s/g, "");
  if (!/^-?[\d.,]+$/.test(normalized)) return null;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(normalized)
      ? normalized.replace(/,/g, "")
      : normalized.replace(",", ".");
  } else if ((normalized.match(/\./g) || []).length > 1 && /^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  const valueNumber = Number(normalized);
  return Number.isFinite(valueNumber) && Math.abs(valueNumber) < 1_000_000_000_000 ? valueNumber : null;
}

function columnIndex(headers: string[], pattern: RegExp): number {
  return headers.findIndex((header) => pattern.test(normalizeText(header)));
}

function getWorkbookMetadata(sourceUrl: string, bytes: Uint8Array) {
  return {
    sourceFile: decodeURIComponent(new URL(sourceUrl).pathname.split("/").at(-1) || "anexo.xlsx"),
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    parserVersion: PARSER_VERSION,
  };
}

function makeObservationKey(parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts), "utf8").digest("hex");
}

function monthDate(period: string): Date {
  return new Date(`${period}-01T00:00:00.000Z`);
}

export interface ParsedSipsaIWorkbook {
  period: string;
  departmentCodes: string[];
  observations: ExternalObservationInput[];
  metadata: Record<string, unknown>;
}

function normalizeDivipolaCode(value: string, expectedLength: 2 | 5): string {
  const digits = value.trim().replace(/\D/g, "");
  return digits ? digits.padStart(expectedLength, "0").slice(-expectedLength) : "";
}

export function parseSipsaIWorkbook(input: Uint8Array, sourceUrl: string): ParsedSipsaIWorkbook {
  const sheets = readXlsxSheets(input);
  const metadata = getWorkbookMetadata(sourceUrl, input);
  const fileName = String(metadata.sourceFile || "");
  const publication = parsePeriod(fileName);
  const period = publication?.label || sheets
    .flatMap((sheet) => sheet.rows.slice(0, 8).map((row) => row?.[0] || ""))
    .map(parsePeriod)
    .find((candidate) => candidate !== null)?.label;
  if (!period) throw new Error("No se encontró el periodo mensual del anexo SIPSA-I");

  const observationsByKey = new Map<string, ExternalObservationInput>();
  const departmentCodes = new Set<string>();
  let dataSheets = 0;

  for (const sheet of sheets) {
    const headers = sheet.rows[5] || [];
    const headerNames = headers.map((value) => value || "");
    const productColumn = columnIndex(headerNames, /nombre_del_producto|nombre_producto/);
    const cpcColumn = columnIndex(headerNames, /codigo_cpc/);
    const municipalityColumn = columnIndex(headerNames, /codigo_municipio/);
    const municipalityNameColumn = columnIndex(headerNames, /nombre_municipio/);
    const departmentColumn = columnIndex(headerNames, /codigo_departamento/);
    const departmentNameColumn = columnIndex(headerNames, /nombre_departamento/);
    const presentationColumn = columnIndex(headerNames, /presentacion_del_producto|presentacion_producto/);
    const variationColumn = columnIndex(headerNames, /variacion_porcentual/);
    const priceColumn = headerNames.findIndex((header) => {
      if (!/precio_promedio/.test(normalizeText(header))) return false;
      return parsePeriod(header)?.label === period;
    });
    if ([productColumn, cpcColumn, municipalityColumn, municipalityNameColumn, departmentColumn,
      departmentNameColumn, presentationColumn, priceColumn].some((column) => column < 0)) continue;
    dataSheets += 1;

    const groupLabel = (sheet.rows[4]?.find(Boolean) || sheet.name).replace(/\s+/g, " ").trim();
    for (let rowIndex = 7; rowIndex < sheet.rows.length; rowIndex += 1) {
      const row = sheet.rows[rowIndex] || [];
      const product = (row[productColumn] || "").replace(/\s+/g, " ").trim();
      const currentPrice = parseNumeric(row[priceColumn]);
      if (!product || currentPrice == null || currentPrice <= 0) continue;

      const departmentCode = normalizeDivipolaCode(row[departmentColumn] || "", 2);
      const municipalityCode = normalizeDivipolaCode(row[municipalityColumn] || "", 5);
      const cpcCode = (row[cpcColumn] || "").trim();
      const department = (row[departmentNameColumn] || "").replace(/\s+/g, " ").trim();
      const municipality = (row[municipalityNameColumn] || "").replace(/\s+/g, " ").trim();
      const presentation = (row[presentationColumn] || "").replace(/\s+/g, " ").trim();
      if (!departmentCode || !municipalityCode || !cpcCode || !department || !municipality || !presentation) continue;
      departmentCodes.add(departmentCode);
      const variationPct = variationColumn >= 0 ? parseNumeric(row[variationColumn]) : null;
      const observationKey = makeObservationKey([
        period, groupLabel, departmentCode, municipalityCode, cpcCode, product, presentation,
      ]);
      const observation: ExternalObservationInput = {
        sourceKey: "dane_sipsa_i",
        observationKey,
        observedAt: monthDate(period),
        value: currentPrice,
        unit: "COP",
        providerName: "DANE SIPSA-I · anexo oficial XLSX por municipio",
        sourceUrl,
        dimensions: {
          period,
          departmentCode,
          department,
          municipalityCode,
          municipality,
          cpcCode,
          article: product,
          presentation,
          group: groupLabel,
          variationPct,
          coverageLevel: "municipio",
        },
        metadata: {
          sourceType: "sipsa_i",
          importedFromOfficialPublication: true,
          sourceFile: metadata.sourceFile,
          checksumSha256: metadata.checksumSha256,
          parserVersion: PARSER_VERSION,
        },
      };
      const previous = observationsByKey.get(observationKey);
      if (previous && previous.value !== observation.value) {
        throw new Error("El anexo SIPSA-I contiene una observación repetida con precios distintos");
      }
      if (!previous) observationsByKey.set(observationKey, observation);
    }
  }

  const observations = [...observationsByKey.values()];
  if (dataSheets < 1 || observations.length < 20) {
    throw new Error("El anexo SIPSA-I no contiene suficientes precios municipales reconocibles");
  }
  return {
    period,
    departmentCodes: [...departmentCodes].sort(),
    observations,
    metadata: { ...metadata, dataSheets, sourceRowCount: observations.length },
  };
}

function laborIndicator(label: string): { indicator: string; unit: string } | null {
  const normalized = normalizeText(label);
  if (normalized.includes("tasa_global_de_participacion") || normalized === "tgp") {
    return { indicator: "Tasa Global de Participación (TGP)", unit: "%" };
  }
  if (normalized.includes("tasa_de_ocupacion") || normalized === "to") {
    return { indicator: "Tasa de Ocupación (TO)", unit: "%" };
  }
  if (normalized.includes("tasa_de_desocupacion") || normalized === "td") {
    return { indicator: "Tasa de Desocupación (TD)", unit: "%" };
  }
  if (normalized.includes("tasa_de_subocupacion") || normalized === "ts") {
    return { indicator: "Tasa de Subocupación (TS)", unit: "%" };
  }
  return null;
}

export interface ParsedGeihWorkbook {
  latestPeriod: string;
  observations: ExternalObservationInput[];
  metadata: Record<string, unknown>;
}

export function parseGeihWorkbook(input: Uint8Array, sourceUrl: string): ParsedGeihWorkbook {
  const sheets = readXlsxSheets(input);
  const national = sheets.find((sheet) => normalizeText(sheet.name) === "total_nacional");
  if (!national) throw new Error("El anexo GEIH no contiene la hoja Total nacional");

  const nationalSectionStart = national.rows.findIndex((row) => normalizeText(row?.[0]) === "total_nacional");
  if (nationalSectionStart < 0) throw new Error("La hoja GEIH no contiene la sección Total Nacional");
  const nextSection = national.rows.findIndex((row, index) =>
    index > nationalSectionStart && normalizeText(row?.[0]).startsWith("total_"));
  const nationalSectionEnd = nextSection < 0 ? national.rows.length : nextSection;
  const tableHeaderIndex = national.rows.findIndex((row, index) =>
    index > nationalSectionStart && index < nationalSectionEnd && normalizeText(row?.[0]) === "concepto");
  if (tableHeaderIndex < 0 || tableHeaderIndex + 1 >= nationalSectionEnd) {
    throw new Error("La sección Total Nacional no contiene sus encabezados mensuales");
  }

  const yearHeader = national.rows[tableHeaderIndex] || [];
  const monthHeader = national.rows[tableHeaderIndex + 1] || [];
  let year = 0;
  const periodsByColumn = new Map<number, string>();
  for (let column = 1; column < Math.max(yearHeader.length, monthHeader.length); column += 1) {
    const candidateYear = Number((yearHeader[column] || "").trim());
    if (Number.isInteger(candidateYear) && candidateYear >= 2000 && candidateYear <= 2100) year = candidateYear;
    const monthToken = normalizeText(monthHeader[column] || "");
    const month = MONTHS[monthToken] || MONTHS[monthToken.slice(0, 3)];
    if (year >= 2021 && month) periodsByColumn.set(column, `${year}-${String(month).padStart(2, "0")}`);
  }
  if (periodsByColumn.size < 12) throw new Error("El anexo GEIH no contiene una serie mensual desde el marco 2018");

  const metadata = getWorkbookMetadata(sourceUrl, input);
  const observations: ExternalObservationInput[] = [];
  for (let rowIndex = tableHeaderIndex + 2; rowIndex < nationalSectionEnd; rowIndex += 1) {
    const row = national.rows[rowIndex] || [];
    const label = (row[0] || "").replace(/\s+/g, " ").trim();
    const mapped = laborIndicator(label);
    if (!mapped) continue;
    for (const [column, period] of periodsByColumn) {
      const value = parseNumeric(row[column]);
      if (value == null || value <= 0 || value > 100) continue;
      observations.push({
        sourceKey: "dane_labor_geih",
        observationKey: makeObservationKey([period, mapped.indicator, "Total nacional", "GEIH marco 2018"]),
        observedAt: monthDate(period),
        value,
        unit: mapped.unit,
        providerName: "DANE GEIH · anexo mensual XLSX",
        sourceUrl,
        dimensions: {
          period,
          indicator: mapped.indicator,
          geography: "Total nacional",
          sampleFrame: "GEIH marco 2018",
        },
        metadata: {
          sourceType: "geih",
          importedFromOfficialPublication: true,
          sourceFile: metadata.sourceFile,
          checksumSha256: metadata.checksumSha256,
          parserVersion: PARSER_VERSION,
        },
      });
    }
  }
  if (observations.length < 12) throw new Error("El anexo GEIH no contiene indicadores laborales nacionales suficientes");
  const latestPeriod = observations.map((item) => String(item.dimensions?.period || "")).sort().at(-1) || "";
  if (!latestPeriod) throw new Error("No se pudo determinar el último periodo GEIH publicado");
  return { latestPeriod, observations, metadata: { ...metadata, sourceRowCount: observations.length } };
}

interface DANEFileSnapshotPayload extends Record<string, unknown> {
  sourceType: "sipsa_i" | "geih";
  latestPeriod: string | null;
  observationCount: number;
  sourceFile: string | null;
  checksumSha256: string | null;
  coverageLabel: string;
  note: string;
}

type DANEFileResult = StoredExternalSnapshot<DANEFileSnapshotPayload>;

async function saveFailure(
  sourceKey: "dane_sipsa_i" | "dane_labor_geih",
  existing: DANEFileResult | null,
  sourceUrl: string,
  sourceType: "sipsa_i" | "geih",
  error: unknown,
): Promise<DANEFileResult> {
  const message = (error instanceof Error ? error.message : "Error desconocido al importar el anexo")
    .replace(/[\r\n]+/g, " ").slice(0, 300);
  const payload: DANEFileSnapshotPayload = existing?.payload || {
    sourceType,
    latestPeriod: null,
    observationCount: 0,
    sourceFile: null,
    checksumSha256: null,
    coverageLabel: sourceType === "geih" ? "Nacional" : "Sin cobertura importada",
    note: "Aún no se ha procesado un anexo oficial.",
  };
  return saveExternalSnapshot({
    sourceKey,
    scopeKey: "global",
    wave: 7,
    status: existing?.payload.observationCount ? "fallback" : "error",
    providerName: sourceType === "geih" ? "DANE GEIH · anexo oficial XLSX" : "DANE SIPSA-I · anexo oficial XLSX",
    sourceUrl: existing?.sourceUrl || sourceUrl,
    payload,
    summary: existing?.summary || "Aún no se importan observaciones del archivo oficial.",
    ttlHours: 6,
    lastError: message,
  });
}

function configuredFarmZone(settings: Record<string, string>) {
  return {
    country: settings["farm.country"] || "Colombia",
    department: settings["farm.department"] || "",
    city: settings["farm.city"] || "",
    daneCode: settings["farm.dane_municipality_code"] || "",
  };
}

async function syncSipsaI(forceRefresh: boolean): Promise<DANEFileResult> {
  const existing = await getExternalSnapshot<DANEFileSnapshotPayload>("dane_sipsa_i");
  if (!forceRefresh && existing && !isSnapshotExpired(existing)) return existing;
  try {
    const publication = await fetchLatestOfficialDaneXlsx(
      SIPSA_I_HISTORY_PAGE,
      /\/files\/operaciones\/SIPSA\/anex-SIPSAinsumosmunicipio-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)20\d{2}\.xlsx$/i,
    );
    const parsed = parseSipsaIWorkbook(publication.bytes, publication.url);
    const settings = await getSettings();
    const zone = configuredFarmZone(settings);
    const departmentCode = /^\d{5}$/.test(zone.daneCode)
      ? zone.daneCode.slice(0, 2)
      : "";
    const scoped = departmentCode
      ? parsed.observations.filter((item) => item.dimensions?.departmentCode === departmentCode)
      : parsed.observations;
    if (scoped.length < 10) throw new Error("El anexo no contiene suficientes precios para el departamento configurado");

    for (let offset = 0; offset < scoped.length; offset += 5000) {
      await saveExternalObservations(scoped.slice(offset, offset + 5000));
    }
    const provinceName = departmentCode
      ? String(scoped[0]?.dimensions?.department || zone.department || departmentCode)
      : "Nacional";
    const payload: DANEFileSnapshotPayload = {
      sourceType: "sipsa_i",
      latestPeriod: parsed.period,
      observationCount: scoped.length,
      sourceFile: String(parsed.metadata.sourceFile || ""),
      checksumSha256: String(parsed.metadata.checksumSha256 || ""),
      coverageLabel: departmentCode ? `Municipios de ${provinceName}` : "Nacional · municipios",
      configuredFarmZone: zone,
      note: "Precios promedio de referencia SIPSA-I por producto, presentación, municipio y mes. No actualiza precios maestros ni costos internos.",
    };
    return saveExternalSnapshot({
      sourceKey: "dane_sipsa_i",
      scopeKey: "global",
      wave: 7,
      status: "ok",
      providerName: "DANE SIPSA-I · anexo oficial XLSX por municipio",
      sourceUrl: publication.url,
      payload,
      summary: `${scoped.length.toLocaleString("es-CO")} precios · ${payload.coverageLabel} · periodo ${parsed.period}`,
      ttlHours: 24 * 5,
    });
  } catch (error) {
    return saveFailure("dane_sipsa_i", existing, SIPSA_I_HISTORY_PAGE, "sipsa_i", error);
  }
}

async function syncGeih(forceRefresh: boolean): Promise<DANEFileResult> {
  const existing = await getExternalSnapshot<DANEFileSnapshotPayload>("dane_labor_geih");
  if (!forceRefresh && existing && !isSnapshotExpired(existing)) return existing;
  try {
    const publication = await fetchLatestOfficialDaneXlsx(
      GEIH_HISTORY_PAGE,
      /\/files\/operaciones\/GEIH\/anex-GEIH-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)20\d{2}\.xlsx$/i,
    );
    const parsed = parseGeihWorkbook(publication.bytes, publication.url);
    for (let offset = 0; offset < parsed.observations.length; offset += 5000) {
      await saveExternalObservations(parsed.observations.slice(offset, offset + 5000));
    }
    const payload: DANEFileSnapshotPayload = {
      sourceType: "geih",
      latestPeriod: parsed.latestPeriod,
      observationCount: parsed.observations.length,
      sourceFile: String(parsed.metadata.sourceFile || ""),
      checksumSha256: String(parsed.metadata.checksumSha256 || ""),
      coverageLabel: "Nacional · GEIH marco 2018",
      note: "Indicadores laborales agregados para contexto económico. No representan salarios legales ni actualizan parámetros de nómina.",
    };
    return saveExternalSnapshot({
      sourceKey: "dane_labor_geih",
      scopeKey: "global",
      wave: 7,
      status: "ok",
      providerName: "DANE GEIH · anexo mensual XLSX",
      sourceUrl: publication.url,
      payload,
      summary: `${parsed.observations.length} observaciones nacionales · último periodo ${parsed.latestPeriod}`,
      ttlHours: 24 * 5,
    });
  } catch (error) {
    return saveFailure("dane_labor_geih", existing, GEIH_HISTORY_PAGE, "geih", error);
  }
}

export async function syncOfficialSipsaISnapshot(options?: { forceRefresh?: boolean }): Promise<DANEFileResult> {
  return syncSipsaI(Boolean(options?.forceRefresh));
}

export async function syncOfficialGeihSnapshot(options?: { forceRefresh?: boolean }): Promise<DANEFileResult> {
  return syncGeih(Boolean(options?.forceRefresh));
}

export async function syncOfficialDaneMarketAndLaborSources(): Promise<DANEFileResult> {
  const [sipsa, geih] = await Promise.all([syncSipsaI(false), syncGeih(false)]);
  const failed = [sipsa, geih].filter((item) => item.status !== "ok");
  const successful = [sipsa, geih].filter((item) => item.status === "ok");
  const newest = [sipsa, geih].sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())[0];
  return {
    ...newest,
    status: failed.length === 0 ? "ok" : successful.length === 0 ? "error" : "fallback",
    providerName: "DANE SIPSA-I y GEIH · anexos oficiales XLSX",
    summary: `SIPSA-I: ${sipsa.payload.latestPeriod || "sin periodo"} (${sipsa.status}) · GEIH: ${geih.payload.latestPeriod || "sin periodo"} (${geih.status})`,
    lastError: failed.length ? failed.map((item) => `${item.payload.sourceType}: ${item.lastError || item.status}`).join(" | ") : null,
  };
}
