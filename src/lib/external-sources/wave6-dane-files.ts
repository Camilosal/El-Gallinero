import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import {
  fetchBytesWithTimeout,
  fetchTextWithTimeout,
  getExternalSnapshot,
  isSnapshotExpired,
  saveExternalObservations,
  saveExternalSnapshot,
  type ExternalObservationInput,
  type StoredExternalSnapshot,
} from "./snapshot-store";

const SIPSA_DAILY_PAGE = "https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-precios-mayoristas";
const IPC_PAGE = "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc/ipc-informacion-tecnica";
const IPP_PAGE = "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-del-productor-ipp/ipp-historicos";
const PARSER_VERSION = "dane-openxml-v1";
const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4,
  may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10,
  nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

export interface XlsxSheet {
  name: string;
  rows: string[][];
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function xmlText(fragment: string): string {
  return [...fragment.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function xmlAttributes(source: string): Record<string, string> {
  return Object.fromEntries(
    [...source.matchAll(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1], decodeXml(match[3])]),
  );
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "";
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function unzipEntries(input: Uint8Array): Map<string, Uint8Array> {
  const zip = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const minimum = Math.max(0, zip.length - 65_557);
  let eocd = -1;
  for (let offset = zip.length - 22; offset >= minimum; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no contiene una estructura XLSX/ZIP válida");
  const count = zip.readUInt16LE(eocd + 10);
  const directoryOffset = zip.readUInt32LE(eocd + 16);
  if (count > 2000 || directoryOffset === 0xffffffff) throw new Error("Estructura ZIP no admitida o demasiado grande");

  const entries = new Map<string, Uint8Array>();
  let cursor = directoryOffset;
  let totalInflated = 0;
  for (let index = 0; index < count; index += 1) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Directorio XLSX dañado");
    const method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const uncompressedSize = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name || name.endsWith("/")) continue;
    if (uncompressedSize > 60_000_000 || totalInflated + uncompressedSize > 120_000_000) {
      throw new Error("El XLSX excede el tamaño descomprimido permitido");
    }
    if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Entrada XLSX dañada");
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    let data: Buffer;
    if (method === 0) data = compressed;
    else if (method === 8) data = inflateRawSync(compressed, { maxOutputLength: 60_000_000 });
    else throw new Error(`Método de compresión XLSX no admitido: ${method}`);
    if (data.length !== uncompressedSize) throw new Error("El XLSX contiene una entrada incompleta");
    totalInflated += data.length;
    entries.set(name, new Uint8Array(data));
  }
  return entries;
}

export function readXlsxSheets(input: Uint8Array): XlsxSheet[] {
  const entries = unzipEntries(input);
  const readText = (name: string): string => {
    const data = entries.get(name);
    if (!data) throw new Error(`El XLSX no contiene ${name}`);
    return Buffer.from(data).toString("utf8");
  };
  const workbook = readText("xl/workbook.xml");
  const relationships = readText("xl/_rels/workbook.xml.rels");
  const relationshipTargets = new Map<string, string>();
  for (const match of relationships.matchAll(/<Relationship\b([^>]*?)\/?\s*>/gi)) {
    const attrs = xmlAttributes(match[1]);
    if (attrs.Id && attrs.Target) relationshipTargets.set(attrs.Id, attrs.Target);
  }
  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? [...readText("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map((match) => xmlText(match[1]))
    : [];
  const sheets: XlsxSheet[] = [];
  for (const match of workbook.matchAll(/<sheet\b([^>]*?)\/?\s*>/gi)) {
    const attrs = xmlAttributes(match[1]);
    const target = relationshipTargets.get(attrs["r:id"]);
    if (!attrs.name || !target) continue;
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    const sheetXml = readText(path.replace(/\/\.\//g, "/"));
    const rows: string[][] = [];
    for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gi)) {
      const rowAttrs = xmlAttributes(rowMatch[1]);
      const rowNumber = Math.max(1, Math.min(100_000, Number(rowAttrs.r) || rows.length + 1));
      const row: string[] = [];
      for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi)) {
        const cellAttrs = xmlAttributes(cellMatch[1]);
        const col = columnIndex(cellAttrs.r || "");
        if (col < 0 || col > 20_000) continue;
        const body = cellMatch[2] || "";
        const value = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1];
        let cellValue = "";
        if (cellAttrs.t === "s" && value != null) cellValue = sharedStrings[Number(value)] || "";
        else if (cellAttrs.t === "inlineStr") cellValue = xmlText(body);
        else if (value != null) cellValue = decodeXml(value);
        row[col] = cellValue;
      }
      rows[rowNumber - 1] = row;
    }
    sheets.push({ name: attrs.name, rows });
  }
  if (sheets.length === 0) throw new Error("El XLSX no contiene hojas legibles");
  return sheets;
}

function parseNumeric(value: string | undefined): number | null {
  if (value == null || !value.trim()) return null;
  const normalized = value.trim().replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && Math.abs(parsed) < 1_000_000_000_000 ? parsed : null;
}

function parseSpanishMonthYear(value: string): { year: number; month: number } | null {
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = normalized.match(/([a-z]+)\s*(?:de\s*)?(20\d{2})/i);
  if (!match) return null;
  const month = MONTHS[match[1].slice(0, 4)] || MONTHS[match[1].slice(0, 3)];
  return month ? { year: Number(match[2]), month } : null;
}

function dateFromYearMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

export interface ParsedSipsaDailyObservation {
  period: string;
  product: string;
  category: string;
  market: string;
  priceCopKg: number;
  variationRatio: number | null;
}

export function parseSipsaDailyWorkbook(input: Uint8Array): ParsedSipsaDailyObservation[] {
  const sheets = readXlsxSheets(input);
  const sheet = sheets.find((candidate) => /bolet[ií]n diario/i.test(candidate.name)) || sheets[0];
  const title = sheet.rows[1]?.[0] || "";
  const dateMatch = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(20\d{2})/);
  if (!dateMatch) throw new Error("No se encontró la fecha de publicación en el anexo SIPSA-P");
  const month = MONTHS[dateMatch[2]];
  if (!month) throw new Error("El anexo SIPSA-P usa un mes no reconocido");
  const periodDate = dateFromYearMonth(Number(dateMatch[3]), month);
  periodDate.setUTCDate(Number(dateMatch[1]));
  const period = periodDate.toISOString().slice(0, 10);
  const marketHeaders = sheet.rows[2] || [];
  const metricHeaders = sheet.rows[3] || [];
  const markets: Array<{ column: number; name: string }> = [];
  for (let column = 1; column < marketHeaders.length; column += 2) {
    const name = (marketHeaders[column] || "").replace(/\s+/g, " ").trim();
    if (name && /precio/i.test(metricHeaders[column] || "")) markets.push({ column, name });
  }
  if (markets.length < 5) throw new Error("No se reconocieron los mercados del anexo SIPSA-P");

  const observations: ParsedSipsaDailyObservation[] = [];
  let category = "";
  for (let rowIndex = 4; rowIndex < sheet.rows.length; rowIndex += 1) {
    const row = sheet.rows[rowIndex] || [];
    const product = (row[0] || "").replace(/\s+/g, " ").trim();
    if (!product) continue;
    const rowHasPrice = markets.some(({ column }) => parseNumeric(row[column]) != null);
    if (!rowHasPrice) {
      if (!/^(?:fuente|nota|convenciones|precio)/i.test(product)) category = product;
      continue;
    }
    for (const { column, name: market } of markets) {
      const priceCopKg = parseNumeric(row[column]);
      if (priceCopKg == null || priceCopKg <= 0) continue;
      observations.push({
        period,
        product,
        category,
        market,
        priceCopKg,
        variationRatio: parseNumeric(row[column + 1]),
      });
    }
  }
  if (observations.length < 20) throw new Error("El anexo SIPSA-P no contiene suficientes precios válidos");
  return observations;
}

function linksToOfficialXlsx(html: string, pageUrl: string, filePattern: RegExp): string[] {
  const links = new Set<string>();
  for (const anchor of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = xmlAttributes(anchor[0].replace(/^<a\b/i, "").replace(/>$/, "")).href;
    if (!href) continue;
    try {
      const url = new URL(href.replace(/&amp;/g, "&"), pageUrl);
      if (url.protocol !== "https:" || url.hostname !== "www.dane.gov.co" || !filePattern.test(url.pathname)) continue;
      links.add(url.toString());
    } catch {
      // Ignore malformed or non-URL links from the publication page.
    }
  }
  return [...links];
}

function publicationSortKey(url: string): number {
  const file = decodeURIComponent(new URL(url).pathname).toLowerCase();
  const daily = file.match(/(\d{1,2})([a-z]{3})(20\d{2})\.xlsx$/);
  if (daily) return Number(daily[3]) * 10000 + (MONTHS[daily[2]] || 0) * 100 + Number(daily[1]);
  const monthly = file.match(/-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)(20\d{2})\.xlsx$/);
  if (!monthly) return 0;
  const year = Number(monthly[2]);
  return year * 100 + (MONTHS[monthly[1]] || 0);
}

async function latestOfficialFile(pageUrl: string, filePattern: RegExp): Promise<{ url: string; bytes: Uint8Array }> {
  const page = await fetchTextWithTimeout(pageUrl, 15000, 5_000_000);
  if (!page.ok) throw new Error(`No se pudo consultar la página DANE: ${page.error}`);
  const links = linksToOfficialXlsx(page.data, pageUrl, filePattern).sort((a, b) => publicationSortKey(b) - publicationSortKey(a));
  if (links.length === 0) throw new Error("La página oficial DANE no publicó un anexo XLSX reconocible");
  const url = links[0];
  const downloaded = await fetchBytesWithTimeout(url, 30000, 20_000_000);
  if (!downloaded.ok) throw new Error(`No se pudo descargar el anexo DANE: ${downloaded.error}`);
  if (downloaded.data.byteLength < 1000) throw new Error("El anexo DANE está vacío o incompleto");
  return { url, bytes: downloaded.data };
}

export async function fetchLatestOfficialDaneXlsx(
  pageUrl: string,
  filePattern: RegExp,
): Promise<{ url: string; bytes: Uint8Array }> {
  return latestOfficialFile(pageUrl, filePattern);
}

export async function fetchLatestSipsaDailyWorkbook(): Promise<{ url: string; bytes: Uint8Array }> {
  return latestOfficialFile(SIPSA_DAILY_PAGE, /\/files\/operaciones\/SIPSA\/anex-SIPSADiario-\d{1,2}[a-z]{3}20\d{2}\.xlsx$/i);
}

function fileMetadata(url: string, bytes: Uint8Array) {
  return {
    sourceFile: decodeURIComponent(new URL(url).pathname.split("/").at(-1) || "anexo.xlsx"),
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    parserVersion: PARSER_VERSION,
  };
}

function indexObservation(input: {
  sourceType: "ipc" | "ipp";
  period: string;
  indicator: string;
  measure: string;
  value: number;
  unit: string;
  coverage: string;
  base: string;
  sourceUrl: string;
  sourceFile: string;
  checksumSha256: string;
  revisionStatus?: string;
}): ExternalObservationInput {
  const keyDimensions = [input.sourceType, input.period, input.indicator, input.measure, input.coverage, input.base, input.unit];
  const observationKey = createHash("sha256").update(JSON.stringify(keyDimensions), "utf8").digest("hex");
  return {
    sourceKey: "dane_price_indices",
    observationKey,
    observedAt: new Date(`${input.period}-01T00:00:00.000Z`),
    value: input.value,
    unit: input.unit,
    providerName: `DANE ${input.sourceType.toUpperCase()} · anexo oficial XLSX`,
    sourceUrl: input.sourceUrl,
    dimensions: {
      period: input.period,
      indicator: input.indicator,
      measure: input.measure,
      coverage: input.coverage,
      base: input.base,
      sourceType: input.sourceType.toUpperCase(),
    },
    metadata: {
      sourceType: input.sourceType,
      sourceFile: input.sourceFile,
      checksumSha256: input.checksumSha256,
      parserVersion: PARSER_VERSION,
      importedFromOfficialPublication: true,
      ...(input.revisionStatus ? { revisionStatus: input.revisionStatus } : {}),
    },
  };
}

function valueAt(row: string[] | undefined, column: number): number | null {
  return parseNumeric(row?.[column]);
}

function requireSheet(sheets: XlsxSheet[], name: string): XlsxSheet {
  const sheet = sheets.find((candidate) => candidate.name.trim() === name);
  if (!sheet) throw new Error(`El anexo DANE no contiene la hoja ${name}`);
  return sheet;
}

export function parseIpcWorkbook(input: Uint8Array, sourceUrl: string): {
  period: string;
  observations: ExternalObservationInput[];
  metadata: Record<string, unknown>;
} {
  const sheets = readXlsxSheets(input);
  const historical = requireSheet(sheets, "1");
  const divisions = requireSheet(sheets, "2");
  const publication = parseSpanishMonthYear(divisions.rows[6]?.[0] || "");
  if (!publication) throw new Error("No se pudo leer el periodo mensual del anexo IPC");
  const period = `${publication.year}-${String(publication.month).padStart(2, "0")}`;
  const metadata = fileMetadata(sourceUrl, input);
  const observations: ExternalObservationInput[] = [];

  for (let rowIndex = 9; rowIndex < divisions.rows.length; rowIndex += 1) {
    const row = divisions.rows[rowIndex] || [];
    const indicator = (row[0] || "").trim();
    if (!indicator) continue;
    const normalizedIndicator = /^total$/i.test(indicator) ? "Total IPC" : indicator;
    const measures = [
      ["variacion_mensual", 2],
      ["variacion_ano_corrido", 3],
      ["variacion_anual", 4],
    ] as const;
    for (const [measure, column] of measures) {
      const value = valueAt(row, column);
      if (value == null) continue;
      observations.push(indexObservation({
        sourceType: "ipc", period, indicator: normalizedIndicator, measure, value, unit: "%",
        coverage: "Nacional", base: "", sourceUrl, ...metadata,
      }));
    }
  }

  const historicalHeader = historical.rows[6]?.[0] || "";
  const historicalPublication = parseSpanishMonthYear(historicalHeader);
  const historicalMonth = historicalPublication?.month || publication.month;
  for (let rowIndex = 9; rowIndex < historical.rows.length; rowIndex += 1) {
    const row = historical.rows[rowIndex] || [];
    const year = Number(row[0]);
    if (!Number.isInteger(year) || year < 1900 || year > publication.year) continue;
    const yearPeriod = `${year}-${String(historicalMonth).padStart(2, "0")}`;
    const measures = [
      ["variacion_mensual", 1],
      ["variacion_ano_corrido", 2],
      ["variacion_anual", 3],
    ] as const;
    for (const [measure, column] of measures) {
      const value = valueAt(row, column);
      if (value == null) continue;
      observations.push(indexObservation({
        sourceType: "ipc", period: yearPeriod, indicator: "Total IPC", measure, value, unit: "%",
        coverage: "Nacional", base: "", sourceUrl, ...metadata,
      }));
    }
  }
  if (observations.length < 6) throw new Error("El anexo IPC no contiene suficientes variaciones reconocibles");
  return { period, observations, metadata };
}

function parseIppHeader(value: string): { period: string; revisionStatus: string; rank: number } | null {
  const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = normalized.match(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[- ](\d{2,4})\b/);
  if (!match) return null;
  const month = MONTHS[match[1]];
  const rawYear = Number(match[2]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  if (!month || year < 2010 || year > 2100) return null;
  const revisionStatus = /definitiv/.test(normalized) ? "definitivo" : /pr\s*\*/.test(normalized) ? "provisional" : "publicado";
  const rank = revisionStatus === "definitivo" ? 2 : revisionStatus === "provisional" ? 1 : 0;
  return { period: `${year}-${String(month).padStart(2, "0")}`, revisionStatus, rank };
}

export function parseIppWorkbook(input: Uint8Array, sourceUrl: string): {
  period: string;
  observations: ExternalObservationInput[];
  metadata: Record<string, unknown>;
} {
  const sheets = readXlsxSheets(input);
  const indices = requireSheet(sheets, "7.1");
  const variations = requireSheet(sheets, "7.2");
  const periodInfo = parseSpanishMonthYear(indices.rows[3]?.[0] || variations.rows[3]?.[0] || "");
  if (!periodInfo) throw new Error("No se pudo leer el periodo mensual del anexo IPP");
  const period = `${periodInfo.year}-${String(periodInfo.month).padStart(2, "0")}`;
  const metadata = fileMetadata(sourceUrl, input);
  const observations: ExternalObservationInput[] = [];
  const header = indices.rows[5] || [];
  const selectedColumns = new Map<string, { column: number; revisionStatus: string; rank: number }>();
  for (let column = 3; column < header.length; column += 1) {
    const parsed = parseIppHeader(header[column] || "");
    if (!parsed) continue;
    const previous = selectedColumns.get(parsed.period);
    if (!previous || parsed.rank > previous.rank || (parsed.rank === previous.rank && column > previous.column)) {
      selectedColumns.set(parsed.period, { column, revisionStatus: parsed.revisionStatus, rank: parsed.rank });
    }
  }
  const baseMatch = (indices.rows[4]?.[0] || "").match(/base\s*:\s*(.+?)\s*\)/i);
  const base = baseMatch?.[1]?.trim() || "Diciembre 2014=100";
  const series = [
    { rowIndex: 6, indicator: "Total IPP BFPYC" },
    { rowIndex: 7, indicator: "Agricultura, ganadería, caza, silvicultura y pesca · IPP BFPYC" },
  ];
  for (const { rowIndex, indicator } of series) {
    const row = indices.rows[rowIndex] || [];
    for (const [samplePeriod, selection] of selectedColumns) {
      const value = valueAt(row, selection.column);
      if (value == null || value <= 0) continue;
      observations.push(indexObservation({
        sourceType: "ipp", period: samplePeriod, indicator, measure: "indice", value, unit: "puntos de índice",
        coverage: "Bienes finales producidos para consumo interno (BFPYC) · nacional", base,
        sourceUrl, ...metadata, revisionStatus: selection.revisionStatus,
      }));
    }
  }

  const variationMeasures = [
    ["variacion_mensual", 3],
    ["variacion_ano_corrido", 6],
    ["variacion_anual", 9],
  ] as const;
  for (const { rowIndex, indicator } of [
    { rowIndex: 7, indicator: "Total IPP BFPYC" },
    { rowIndex: 8, indicator: "Agricultura, ganadería, caza, silvicultura y pesca · IPP BFPYC" },
  ]) {
    const row = variations.rows[rowIndex] || [];
    for (const [measure, column] of variationMeasures) {
      const value = valueAt(row, column);
      if (value == null) continue;
      observations.push(indexObservation({
        sourceType: "ipp", period, indicator, measure, value, unit: "%",
        coverage: "Bienes finales producidos para consumo interno (BFPYC) · nacional", base: "",
        sourceUrl, ...metadata,
      }));
    }
  }
  if (selectedColumns.size < 20 || observations.length < 30) throw new Error("El anexo IPP no contiene suficientes periodos o series reconocibles");
  return { period, observations, metadata };
}

interface DaneIndexSnapshotPayload extends Record<string, unknown> {
  schemaVersion: number;
  sourceType: "ipc" | "ipp";
  latestPeriod: string | null;
  observationCount: number;
  sourceFile: string | null;
  checksumSha256: string | null;
  parserVersion: string;
  note: string;
}

type DaneIndexResult = StoredExternalSnapshot<DaneIndexSnapshotPayload>;

async function syncOneDaneIndex(type: "ipc" | "ipp", forceRefresh: boolean): Promise<DaneIndexResult> {
  const scope = type;
  const existing = await getExternalSnapshot<DaneIndexSnapshotPayload>("dane_price_indices", scope);
  if (!forceRefresh && existing && !isSnapshotExpired(existing)) return existing;
  const pageUrl = type === "ipc" ? IPC_PAGE : IPP_PAGE;
  const pattern = type === "ipc"
    ? /\/files\/operaciones\/IPC\/(?:[a-z]{3}\d{4}\/)?anex-IPC-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)20\d{2}\.xlsx$/i
    : /\/files\/operaciones\/IPP\/anex-IPP-(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)20\d{2}\.xlsx$/i;
  try {
    const publication = await latestOfficialFile(pageUrl, pattern);
    const parsed = type === "ipc"
      ? parseIpcWorkbook(publication.bytes, publication.url)
      : parseIppWorkbook(publication.bytes, publication.url);
    await saveExternalObservations(parsed.observations);
    const payload: DaneIndexSnapshotPayload = {
      schemaVersion: 1,
      sourceType: type,
      latestPeriod: parsed.period,
      observationCount: parsed.observations.length,
      sourceFile: parsed.metadata.sourceFile as string,
      checksumSha256: parsed.metadata.checksumSha256 as string,
      parserVersion: PARSER_VERSION,
      note: "Serie estadística oficial para consulta y escenarios. No modifica precios ni parámetros de Datos Maestros.",
    };
    return saveExternalSnapshot({
      sourceKey: "dane_price_indices",
      scopeKey: scope,
      wave: 6,
      status: "ok",
      providerName: `DANE ${type.toUpperCase()} · anexo oficial XLSX`,
      sourceUrl: publication.url,
      payload,
      summary: `${parsed.observations.length} observaciones · periodo publicado ${parsed.period}`,
      ttlHours: 24 * 5,
    });
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Error desconocido al importar el anexo")
      .replace(/[\r\n]+/g, " ").slice(0, 300);
    const payload: DaneIndexSnapshotPayload = existing?.payload || {
      schemaVersion: 1,
      sourceType: type,
      latestPeriod: null,
      observationCount: 0,
      sourceFile: null,
      checksumSha256: null,
      parserVersion: PARSER_VERSION,
      note: "Sin archivo oficial procesado todavía.",
    };
    return saveExternalSnapshot({
      sourceKey: "dane_price_indices",
      scopeKey: scope,
      wave: 6,
      status: existing?.payload.observationCount ? "fallback" : "error",
      providerName: `DANE ${type.toUpperCase()} · anexo oficial XLSX`,
      sourceUrl: existing?.sourceUrl || pageUrl,
      payload,
      summary: existing?.summary || "Aún no se importan observaciones oficiales.",
      ttlHours: 6,
      lastError: message,
    });
  }
}

export async function syncOfficialDaneIndicesSnapshots(options?: { forceRefresh?: boolean }): Promise<DaneIndexResult> {
  const [ipc, ipp] = await Promise.all([
    syncOneDaneIndex("ipc", Boolean(options?.forceRefresh)),
    syncOneDaneIndex("ipp", Boolean(options?.forceRefresh)),
  ]);
  const failures = [ipc, ipp].filter((snapshot) => snapshot.status !== "ok");
  const successCount = [ipc, ipp].filter((snapshot) => snapshot.status === "ok").length;
  const base = ipc.fetchedAt.getTime() >= ipp.fetchedAt.getTime() ? ipc : ipp;
  const status = failures.length === 0 ? "ok" : successCount === 0 && failures.every((snapshot) => snapshot.status === "error") ? "error" : "fallback";
  return {
    ...base,
    status,
    providerName: "DANE IPC e IPP · anexos oficiales XLSX",
    summary: `IPC: ${ipc.payload.latestPeriod || "sin periodo"} (${ipc.status}) · IPP: ${ipp.payload.latestPeriod || "sin periodo"} (${ipp.status})`,
    lastError: failures.length ? failures.map((snapshot) => `${snapshot.payload.sourceType}: ${snapshot.lastError || snapshot.status}`).join(" | ") : null,
  };
}
