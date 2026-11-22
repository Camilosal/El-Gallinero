import { createHash } from "node:crypto";
import type { ExternalObservationInput } from "./snapshot-store";

export type OfficialCsvImportType = "sipsa_i" | "ipc" | "ipp";

export interface OfficialCsvImportResult {
  sourceType: OfficialCsvImportType;
  observations: ExternalObservationInput[];
  rejectedRows: number;
  rejectionReasons: Record<string, number>;
  periodStart: string | null;
  periodEnd: string | null;
}

interface ParsedSourceRow extends Record<string, string> {
  __csvShapeMismatch: string;
}

const SOURCE_URLS: Record<OfficialCsvImportType, string> = {
  sipsa_i: "https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-insumos-1/componente-insumos-historicos",
  ipc: "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc/ipc-informacion-tecnica",
  ipp: "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-del-productor-ipp",
};

function normalizeField(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function detectDelimiter(source: string): string {
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (let index = 0; index < firstLine.length; index += 1) {
    const char = firstLine[index];
    if (char === '"') {
      if (quoted && firstLine[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && counts.has(char)) {
      counts.set(char, (counts.get(char) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ",";
}

function parseCsv(sourceText: string): ParsedSourceRow[] {
  const source = sourceText.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source);
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field.length === 0) quoted = true;
    else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some((cell) => cell.trim())) records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("El archivo CSV contiene una comilla sin cerrar");
  record.push(field);
  if (record.some((cell) => cell.trim())) records.push(record);
  if (records.length < 2) throw new Error("El archivo debe incluir encabezados y al menos una fila");

  const headers = records[0].map(normalizeField);
  if (headers.some((header) => !header)) throw new Error("Hay encabezados vacíos en el archivo");
  if (new Set(headers).size !== headers.length) throw new Error("Hay encabezados duplicados después de normalizar nombres y tildes");
  if (headers.includes("__csv_shape_mismatch")) throw new Error("El archivo usa un encabezado reservado por el importador");
  return records.slice(1).map((cells) => ({
    ...Object.fromEntries(headers.map((header, index) => [header, String(cells[index] ?? "").trim()])),
    __csvShapeMismatch: cells.length === headers.length ? "" : "Número de campos no coincide con encabezados",
  }));
}

function field(row: Record<string, string>, names: string[]): string {
  for (const name of names) {
    const value = row[normalizeField(name)];
    if (value) return value;
  }
  return "";
}

function parsePeriod(raw: string): { label: string; date: Date } | null {
  const value = raw.trim().toLowerCase().replace(/\s+/g, " ");
  let year = 0;
  let month = 0;
  let match = value.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
  } else {
    match = value.match(/^(\d{1,2})[-/.](\d{4})$/);
    if (match) {
      month = Number(match[1]);
      year = Number(match[2]);
    } else {
      match = value.match(/^(\d{4})(\d{2})$/);
      if (match) {
        year = Number(match[1]);
        month = Number(match[2]);
      } else {
        const spanishMonths: Record<string, number> = {
          enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
          mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
          septiembre: 9, setiembre: 9, sep: 9, set: 9, octubre: 10, oct: 10,
          noviembre: 11, nov: 11, diciembre: 12, dic: 12,
        };
        match = value.match(/^([a-z]+)[ -](\d{4})$/);
        if (!match || !spanishMonths[match[1]]) return null;
        month = spanishMonths[match[1]];
        year = Number(match[2]);
      }
    }
  }
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  if (year < 1900 || year > currentYear || (year === currentYear && month > currentMonth) || month < 1 || month > 12) return null;
  const label = year + "-" + String(month).padStart(2, "0");
  return { label, date: new Date(Date.UTC(year, month - 1, 1)) };
}

function parseNumeric(raw: string): number | null {
  let value = raw.trim().replace(/[\s$]/g, "");
  if (!value) return null;
  if (!/^-?[\d.,]+$/.test(value)) return null;
  if (value.includes(",") && value.includes(".")) {
    const commaIsDecimal = value.lastIndexOf(",") > value.lastIndexOf(".");
    value = commaIsDecimal
      ? value.replace(/\./g, "").replace(",", ".")
      : value.replace(/,/g, "");
  } else if (value.includes(",")) {
    value = /^-?\d{1,3}(,\d{3})+$/.test(value)
      ? value.replace(/,/g, "")
      : value.replace(",", ".");
  } else if ((value.match(/\./g) || []).length > 1 && /^-?\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, "");
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) < 1_000_000_000_000 ? parsed : null;
}

function hashObservationKey(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function addRejectedReason(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] || 0) + 1;
}

export function parseOfficialSourceCsv(
  csv: string,
  sourceType: OfficialCsvImportType,
  sourceFile: string,
  groupLabel = "",
): OfficialCsvImportResult {
  const sourceRows = parseCsv(csv);
  const observationsByKey = new Map<string, ExternalObservationInput>();
  const conflictingKeys = new Set<string>();
  const rejectionReasons: Record<string, number> = {};

  for (const row of sourceRows) {
    if (row.__csvShapeMismatch) {
      addRejectedReason(rejectionReasons, row.__csvShapeMismatch);
      continue;
    }
    const rawPeriod = sourceType === "sipsa_i"
      ? field(row, ["MES_AÑO", "MES_AO", "MES_ANO", "PERIODO", "MES"])
      : field(row, ["periodo", "mes", "fecha", "date"]);
    const period = parsePeriod(rawPeriod);
    if (!period) {
      addRejectedReason(rejectionReasons, "Periodo mensual ausente o inválido");
      continue;
    }

    const rawValue = sourceType === "sipsa_i"
      ? field(row, ["PRECIO", "VALOR", "PRICE"])
      : field(row, ["valor", "value", "indice", "index", "variacion", "variation"]);
    const value = parseNumeric(rawValue);
    if (value === null || (sourceType === "sipsa_i" && value <= 0)) {
      addRejectedReason(
        rejectionReasons,
        sourceType === "sipsa_i" ? "Precio no positivo/no numérico" : "Valor no numérico",
      );
      continue;
    }

    const indicator = sourceType === "sipsa_i"
      ? field(row, ["ARTICULO", "ARTÍCULO", "ARTCULO", "PRODUCTO", "SERVICIO", "FACTOR"])
      : field(row, ["indicador", "serie", "clasificacion", "producto", "componente"]);
    if (!indicator) {
      addRejectedReason(rejectionReasons, "Indicador o artículo ausente");
      continue;
    }

    let dimensions: Record<string, unknown>;
    let sourceKey: "dane_sipsa_i" | "dane_price_indices";
    let providerName: string;
    let unit: string | null;
    let uniqueKey: string;

    if (sourceType === "sipsa_i") {
      const daneCode = field(row, ["CDIGODIVIPOLA", "CODIGO_DIVIPOLA", "DIVIPOLA", "COD_MUNICIPIO"]);
      if (!/^(?:\d{2}|\d{5})$/.test(daneCode)) {
        addRejectedReason(rejectionReasons, "Código DIVIPOLA distinto de dos o cinco dígitos");
        continue;
      }
      const cpcCode = field(row, ["CDIGOCPC", "CODIGO_CPC", "CPC", "COD_PRODUCTO"]);
      const characteristics = field(row, ["CARACTERSTICAS", "CARACTERISTICAS", "CARACTERISTICA", "PRESENTACION", "ESPECIFICACION"]);
      const reportedUnit = field(row, ["UNIDAD", "UNIDAD_MEDIDA", "UNIDAD_DE_MEDIDA"]);
      if (reportedUnit.length > 60) {
        addRejectedReason(rejectionReasons, "Unidad supera 60 caracteres");
        continue;
      }
      sourceKey = "dane_sipsa_i";
      providerName = "DANE SIPSA-I · base anonimizada importada por la granja";
      unit = reportedUnit || null;
      dimensions = {
        period: period.label,
        divipolaCode: daneCode,
        coverageLevel: daneCode.length === 5 ? "municipio" : "departamento",
        cpcCode,
        article: indicator,
        characteristics,
        group: groupLabel.slice(0, 100),
        sourceFile: sourceFile.slice(0, 180),
      };
      uniqueKey = JSON.stringify([period.label, daneCode, cpcCode, indicator, characteristics, reportedUnit]);
    } else {
      const measure = field(row, ["medida", "tipo_indicador", "tipo_valor", "measure"]) || "valor publicado";
      const coverage = field(row, ["cobertura", "territorio", "ciudad", "area_geografica"]);
      const base = field(row, ["base", "periodo_base", "base_del_indice"]);
      const reportedUnit = field(row, ["unidad", "unit", "medida_unidad"]);
      if (reportedUnit.length > 60) {
        addRejectedReason(rejectionReasons, "Unidad supera 60 caracteres");
        continue;
      }
      sourceKey = "dane_price_indices";
      providerName = sourceType === "ipc" ? "DANE IPC · serie oficial importada" : "DANE IPP · serie oficial importada";
      unit = reportedUnit || (measure.toLowerCase().includes("variacion") ? "%" : null);
      dimensions = {
        period: period.label,
        indicator,
        measure,
        coverage,
        base,
        sourceType: sourceType.toUpperCase(),
        sourceFile: sourceFile.slice(0, 180),
      };
      uniqueKey = JSON.stringify([sourceType, period.label, indicator, measure, coverage, base, reportedUnit]);
    }

    const observation: ExternalObservationInput = {
      sourceKey,
      observationKey: hashObservationKey(uniqueKey),
      observedAt: period.date,
      value,
      unit,
      providerName,
      sourceUrl: SOURCE_URLS[sourceType],
      dimensions,
      metadata: {
        sourceType,
        sourceFile: sourceFile.slice(0, 180),
        importedFromOfficialPublication: true,
        rawPeriod,
        rawValue,
        rawUnit: unit,
      },
    };
    const observationKey = observation.observationKey;
    if (conflictingKeys.has(observationKey)) {
      addRejectedReason(rejectionReasons, "Clave repetida con valores distintos; grupo puesto en cuarentena");
      continue;
    }
    const previous = observationsByKey.get(observationKey);
    if (previous) {
      if (
        previous.value === observation.value &&
        previous.unit === observation.unit &&
        previous.observedAt.getTime() === observation.observedAt.getTime()
      ) {
        addRejectedReason(rejectionReasons, "Fila duplicada exacta dentro del archivo");
        continue;
      }
      observationsByKey.delete(observationKey);
      conflictingKeys.add(observationKey);
      addRejectedReason(rejectionReasons, "Clave repetida con valores distintos; grupo puesto en cuarentena");
      addRejectedReason(rejectionReasons, "Clave repetida con valores distintos; grupo puesto en cuarentena");
      continue;
    }
    observationsByKey.set(observationKey, observation);
  }

  const observations = [...observationsByKey.values()];
  const sortedPeriods = observations
    .map((observation) => String(observation.dimensions?.period || ""))
    .filter(Boolean)
    .sort();
  return {
    sourceType,
    observations,
    rejectedRows: sourceRows.length - observations.length,
    rejectionReasons,
    periodStart: sortedPeriods[0] || null,
    periodEnd: sortedPeriods.at(-1) || null,
  };
}

export function officialSourceUrl(sourceType: OfficialCsvImportType): string {
  return SOURCE_URLS[sourceType];
}
