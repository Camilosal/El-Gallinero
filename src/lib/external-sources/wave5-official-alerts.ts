import { createHash } from "node:crypto";
import {
  fetchTextWithTimeout,
  getExternalSnapshot,
  isSnapshotExpired,
  saveExternalSnapshot,
  type StoredExternalSnapshot,
} from "./snapshot-store";

const IDEAM_DATASET_ID = "h4gs-wsmg";
const IDEAM_CSV_URL = "https://bart.ideam.gov.co/ospa/DatosAbiertos/Alertas_Hidrologicas/alertas_hidrologicas.csv";

interface SocrataColumn {
  fieldName?: string;
  name?: string;
  dataTypeName?: string;
}

export interface IdeamHydroAlert {
  id: string;
  title: string;
  description: string;
  department: string;
  municipality: string;
  waterbody: string;
  publishedAt: string | null;
  observedAt?: string | null;
  statusLabel: string;
}

export interface IdeamHydroSnapshotPayload extends Record<string, unknown> {
  datasetId: string;
  datasetName: string;
  coverageScope: "nacional";
  coverageLabel: string;
  metadataUpdatedAt: string | null;
  alerts: IdeamHydroAlert[];
  note: string;
}

function normalizeField(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function chooseColumn(columns: SocrataColumn[], pattern: RegExp): string {
  const column = columns.find((item) => pattern.test(normalizeField((item.fieldName || "") + " " + (item.name || ""))));
  return column?.fieldName || "";
}

function chooseAlertColumn(columns: SocrataColumn[]): string {
  const column = columns.find((item) => {
    const field = normalizeField((item.fieldName || "") + " " + (item.name || ""));
    return /(nivel|alerta|amenaza|fenomeno|evento|categoria|titulo|tipo)/.test(field) &&
      !/(codigo|consecutivo|numero|identificador|^id$)/.test(field);
  });
  return column?.fieldName || "";
}

function readValue(row: Record<string, unknown>, fieldName: string): string {
  const raw = fieldName ? row[fieldName] : undefined;
  return raw === null || raw === undefined ? "" : String(raw).trim();
}

export function parseIdeamHydroAlerts(
  rows: Array<Record<string, unknown>>,
  columns: SocrataColumn[],
): IdeamHydroAlert[] {
  const alertField = chooseAlertColumn(columns);
  const descriptionField = chooseColumn(columns, /(descripcion|detalle|observacion|recomendacion|mensaje|riesgo|comentario)/);
  const dateField = chooseColumn(columns, /(fecha|date|publicacion|vigencia|emision|actualizacion|registro)/);
  const departmentField = chooseColumn(columns, /(departamento|depto|dpto)/);
  const municipalityField = chooseColumn(columns, /(municipio|mpio)/);
  const waterbodyField = chooseColumn(columns, /(rio|cuerpo_de_agua|cuenca|estacion|corriente)/);
  const statusField = chooseColumn(columns, /(estado|status|vigencia_alerta)/);
  const idField = chooseColumn(columns, /(^id$|codigo|consecutivo|numero_alerta)/);
  if ((!alertField && !descriptionField) || !dateField) {
    throw new Error("El catálogo de Alertas Hidrológicas cambió sus columnas y requiere revisión");
  }

  const parsed: IdeamHydroAlert[] = [];
  for (const row of rows) {
    const title = readValue(row, alertField) || readValue(row, descriptionField);
    const description = readValue(row, descriptionField) || title;
    const rawDate = readValue(row, dateField);
    const parsedDate = new Date(rawDate);
    const publishedAt = Number.isFinite(parsedDate.getTime()) &&
      parsedDate.getTime() <= Date.now() + 24 * 60 * 60 * 1000
      ? parsedDate.toISOString()
      : null;
    if (!title || !publishedAt) continue;
    const department = readValue(row, departmentField);
    const municipality = readValue(row, municipalityField);
    const waterbody = readValue(row, waterbodyField);
    const sourceId = readValue(row, idField);
    const id = sourceId || [publishedAt, department, municipality, waterbody, title].join("|");
    parsed.push({
      id: id.slice(0, 200),
      title: title.slice(0, 300),
      description: description.slice(0, 1000),
      department,
      municipality,
      waterbody,
      publishedAt,
      statusLabel: readValue(row, statusField) || "Estado no indicado; confirmar boletín IDEAM",
    });
  }
  return parsed;
}

const IDEAM_ACTIVE_ALERT_LEVELS = new Set([
  "ALERTA AMARILLA",
  "ALERTA NARANJA",
  "ALERTA ROJA",
]);

interface ParsedIdeamCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
}

function detectCsvDelimiter(line: string): string {
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && counts.has(char)) {
      counts.set(char, (counts.get(char) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ",";
}

function parseIdeamCsvRows(csv: string): ParsedIdeamCsv {
  const source = csv.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const delimiter = detectCsvDelimiter(firstLine);
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
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("El CSV oficial de IDEAM contiene una comilla sin cerrar");
  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  if (!records.length) throw new Error("El CSV oficial de IDEAM está vacío");

  const headers = records[0].map(normalizeField);
  if (headers.some((header) => !header)) throw new Error("El CSV oficial de IDEAM contiene un encabezado vacío");
  if (new Set(headers).size !== headers.length) throw new Error("El CSV oficial de IDEAM contiene encabezados duplicados");
  const rows = records.slice(1).map((cells) => {
    if (cells.length !== headers.length) {
      throw new Error("El CSV oficial de IDEAM cambió la cantidad de columnas de sus filas");
    }
    return Object.fromEntries(headers.map((header, index) => [header, String(cells[index] ?? "").trim()]));
  });
  return { headers, rows };
}

function findCsvHeader(headers: string[], aliases: string[]): string {
  const normalizedAliases = new Set(aliases.map(normalizeField));
  return headers.find((header) => normalizedAliases.has(header)) || "";
}

function readCsvValue(row: Record<string, string>, header: string): string {
  return header ? String(row[header] || "").trim() : "";
}

function uniqueCsvValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function parseIdeamHydroCsv(csv: string, observedAt = new Date().toISOString()): IdeamHydroAlert[] {
  const { headers, rows } = parseIdeamCsvRows(csv);
  const levelField = findCsvHeader(headers, ["NIVEL_A", "NIVEL_ALERTA", "NIVEL_DE_ALERTA", "CATEGORIA_ALERTA", "NOMBRE_ALERTA"]);
  const idField = findCsvHeader(headers, ["OBJECTID", "ID", "CODIGO_ALERTA", "ID_ALERTA"]);
  const municipalityField = findCsvHeader(headers, ["MUNICIPIO", "MUNICIPALIDAD"]);
  const areaFields = [
    findCsvHeader(headers, ["NOMAH", "AREA_HIDROGRAFICA", "NOMBRE_AREA_HIDROGRAFICA"]),
    findCsvHeader(headers, ["NOMZH", "ZONA_HIDROGRAFICA", "NOMBRE_ZONA_HIDROGRAFICA"]),
    findCsvHeader(headers, ["NOMSZH", "SUBZONA_HIDROGRAFICA", "NOMBRE_SUBZONA_HIDROGRAFICA"]),
    findCsvHeader(headers, ["CUENCA", "CUERPO_DE_AGUA", "RIO"]),
  ].filter(Boolean);
  const departmentFields = headers.filter((header) => /^(dep|dep_\d+|departamento(_\d+)?|depto|dpto)$/.test(header));
  if (!levelField || !areaFields.length) {
    throw new Error("El CSV oficial de IDEAM cambió: faltan nivel de alerta o cobertura hidrográfica");
  }

  const alerts: IdeamHydroAlert[] = [];
  for (const row of rows) {
    const level = readCsvValue(row, levelField)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ");
    if (!level || level === "CONDICIONES NORMALES") continue;
    if (!IDEAM_ACTIVE_ALERT_LEVELS.has(level)) {
      throw new Error("El CSV oficial de IDEAM contiene una categoría de alerta desconocida");
    }

    const hydrographicCoverage = uniqueCsvValues(areaFields.map((header) => readCsvValue(row, header))).join(" / ");
    const department = uniqueCsvValues(departmentFields.map((header) => readCsvValue(row, header))).join(", ");
    const municipality = readCsvValue(row, municipalityField);
    const sourceId = readCsvValue(row, idField);
    const identity = [
      sourceId,
      level,
      ...areaFields.map((header) => readCsvValue(row, header)),
      ...departmentFields.map((header) => readCsvValue(row, header)),
      municipality,
    ].filter(Boolean).join("|");
    const id = sourceId || "ideam:" + createHash("sha256").update(identity || level).digest("hex").slice(0, 40);

    alerts.push({
      id: id.slice(0, 200),
      title: level,
      description: hydrographicCoverage
        ? "Cobertura hidrográfica reportada por IDEAM: " + hydrographicCoverage + "."
        : "IDEAM reporta esta categoría como vigente; el archivo no incluye más detalle textual.",
      department,
      municipality,
      waterbody: hydrographicCoverage,
      publishedAt: null,
      observedAt,
      statusLabel: "Vigente en el archivo oficial IDEAM",
    });
  }
  return alerts;
}

export async function syncIdeamHydroAlertsSnapshot(
  options?: { forceRefresh?: boolean },
): Promise<StoredExternalSnapshot<IdeamHydroSnapshotPayload>> {
  const existing = await getExternalSnapshot<IdeamHydroSnapshotPayload>("ideam_hydro_alerts");
  if (!options?.forceRefresh && existing && !isSnapshotExpired(existing)) return existing;

  const fileResult = await fetchTextWithTimeout(IDEAM_CSV_URL, 15000, 8_000_000);
  const errors: string[] = fileResult.ok ? [] : ["CSV IDEAM: " + fileResult.error];
  let alerts: IdeamHydroAlert[] = [];
  let datasetName = "Alertas hidrológicas vigentes · IDEAM";
  let metadataUpdatedAt: string | null = null;
  let validFeed = false;
  if (fileResult.ok) {
    try {
      alerts = parseIdeamHydroCsv(fileResult.data, new Date().toISOString());
      validFeed = true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "El CSV oficial de IDEAM es inválido");
    }
  }

  if (!validFeed && existing) {
    alerts = existing.payload.alerts || [];
    datasetName = existing.payload.datasetName || datasetName;
    metadataUpdatedAt = existing.payload.metadataUpdatedAt || null;
  }
  const status = validFeed ? "ok" : existing ? "fallback" : "error";
  const payload: IdeamHydroSnapshotPayload = {
    datasetId: IDEAM_DATASET_ID,
    datasetName,
    coverageScope: "nacional",
    coverageLabel: "Nacional · Alertas hidrológicas IDEAM",
    metadataUpdatedAt,
    alerts,
    note: "Archivo CSV oficial de alertas vigentes del IDEAM. Reporta nivel y cobertura territorial; la fecha de consulta corresponde a la descarga. Confirme el boletín oficial antes de actuar.",
  };

  return saveExternalSnapshot({
    sourceKey: "ideam_hydro_alerts",
    wave: 5,
    status,
    providerName: validFeed ? "IDEAM · CSV oficial de alertas hidrológicas" : "IDEAM · último dato válido guardado",
    sourceUrl: IDEAM_CSV_URL,
    payload,
    summary: validFeed
      ? alerts.length + " alertas hidrológicas leídas del CSV oficial"
      : alerts.length + " registros conservados; la descarga requiere revisión",
    ttlHours: validFeed ? 3 : 1,
    lastError: errors.length ? errors.join(" | ").slice(0, 2000) : null,
  });
}
