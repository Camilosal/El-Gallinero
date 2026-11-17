import {
  fetchTextWithTimeout,
  getExternalSnapshot,
  isSnapshotExpired,
  saveExternalObservations,
  saveExternalSnapshot,
  type ExternalObservationInput,
  type StoredExternalSnapshot,
} from "./snapshot-store";
import { getSettings } from "@/lib/settings";

const BANREP_REST = "https://totoro.banrep.gov.co/sdmx/rest/data/BANREP.CIE";

export interface BanrepObservation {
  period: string;
  value: number;
  measure: string;
  unitMeasure: string;
  frequency: string;
}

export interface BanrepSeriesSnapshot {
  flowId: string;
  label: string;
  unitLabel: string;
  status: "ok" | "fallback" | "error";
  sourceUrl: string;
  observations: BanrepObservation[];
  lastError: string | null;
}

export interface BanrepMacroSnapshotPayload extends Record<string, unknown> {
  schemaVersion: 1;
  series: BanrepSeriesSnapshot[];
  note: string;
}

export const BANREP_SERIES = [
  { flowId: "DF_IBR", label: "Indicador Bancario de Referencia (IBR)", unitLabel: "Tasa porcentual; conservar la unidad reportada" },
  { flowId: "DF_DTF", label: "DTF a 90 días", unitLabel: "Tasa porcentual; conservar la unidad reportada" },
  { flowId: "DF_TPM", label: "Tasa de política monetaria", unitLabel: "Tasa porcentual; conservar la unidad reportada" },
  { flowId: "DF_TIB", label: "Tasa interbancaria", unitLabel: "Tasa porcentual; conservar la unidad reportada" },
  { flowId: "DF_UVR", label: "Unidad de Valor Real (UVR)", unitLabel: "Unidad de valor; conservar la unidad reportada" },
] as const;
export const DEFAULT_BANREP_FLOW_IDS = BANREP_SERIES.map((series) => series.flowId);

export function parseBanrepFlowSelection(raw: unknown): string[] {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (!Array.isArray(parsed)) return [...DEFAULT_BANREP_FLOW_IDS];
  const allowed = new Set<string>(DEFAULT_BANREP_FLOW_IDS);
  const selected = [...new Set(parsed.filter((value): value is string => typeof value === "string"))]
    .filter((flowId) => allowed.has(flowId));
  return selected.length > 0 ? selected : [...DEFAULT_BANREP_FLOW_IDS];
}

type CsvRow = Record<string, string>;

function parseCsvRows(csv: string): CsvRow[] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = csv.replace(/^\uFEFF/, "");

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
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) records.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) records.push(row);
  if (records.length < 2) throw new Error("La respuesta SDMX no contiene filas de datos");

  const headers = records[0].map((header) => normalizeField(header));
  return records.slice(1).map((record) => Object.fromEntries(
    headers.map((header, index) => [header, String(record[index] ?? "").trim()]),
  ));
}

function normalizeField(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function pickField(row: CsvRow, names: string[]): string {
  for (const name of names) {
    const value = row[normalizeField(name)];
    if (value) return value;
  }
  return "";
}

function parseNumericValue(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function parseBanrepSeriesCsv(csv: string): BanrepObservation[] {
  const observations: BanrepObservation[] = [];
  for (const row of parseCsvRows(csv)) {
    const period = pickField(row, ["fecha", "time_period", "periodo", "date"]);
    const value = parseNumericValue(pickField(row, ["valor", "obs_value", "value"]));
    const datePattern = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
    if (!datePattern.test(period) || !Number.isFinite(value)) continue;
    const periodDate = parsePeriodDate(period);
    if (!Number.isFinite(periodDate.getTime()) || periodDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) continue;
    const measure = pickField(row, ["measure"]);
    const unitMeasure = pickField(row, ["unit_measure", "unit", "unidad"]);
    const frequency = pickField(row, ["freq", "frequency", "frecuencia"]);
    observations.push({ period, value, measure, unitMeasure, frequency });
  }
  if (observations.length === 0) {
    throw new Error("La respuesta SDMX no contiene periodos y valores reconocibles");
  }
  return observations;
}

export function buildBanrepSeriesUrl(flowId: string, observationCount = 60): string {
  if (!BANREP_SERIES.some((series) => series.flowId === flowId)) {
    throw new Error("Flujo SDMX de Banco de la República no permitido");
  }
  const url = new URL(`${BANREP_REST},${flowId},1.0/`);
  url.searchParams.set("lastNObservations", String(Math.max(1, Math.min(365, Math.floor(observationCount)))));
  url.searchParams.set("dimensionAtObservation", "TIME_PERIOD");
  url.searchParams.set("detail", "full");
  url.searchParams.set("format", "csv");
  return url.toString();
}

async function fetchBanrepSeries(flowId: string): Promise<{
  sourceUrl: string;
  observations: BanrepObservation[];
}> {
  const sourceUrl = buildBanrepSeriesUrl(flowId);
  const response = await fetchTextWithTimeout(sourceUrl, 12000, 4_000_000);
  if (!response.ok) throw new Error(response.error);
  return { sourceUrl, observations: parseBanrepSeriesCsv(response.data) };
}

function parsePeriodDate(period: string): Date {
  if (/^\d{4}$/.test(period)) return new Date(`${period}-01-01T00:00:00.000Z`);
  if (/^\d{4}-\d{2}$/.test(period)) return new Date(`${period}-01T00:00:00.000Z`);
  return new Date(`${period}T00:00:00.000Z`);
}

export async function syncBanrepMacroSnapshot(
  options?: { forceRefresh?: boolean; selectedFlowIds?: string[] },
): Promise<StoredExternalSnapshot<BanrepMacroSnapshotPayload>> {
  const existing = await getExternalSnapshot<BanrepMacroSnapshotPayload>("banrep_sdmx");
  if (!options?.forceRefresh && existing && !isSnapshotExpired(existing)) return existing;

  const settings = options?.selectedFlowIds ? null : await getSettings();
  const flowIds = parseBanrepFlowSelection(
    options?.selectedFlowIds ?? settings?.["external.banrep_series_json"],
  );
  const selectedSeries = BANREP_SERIES.filter((series) => flowIds.includes(series.flowId));
  const fetched = await Promise.allSettled(selectedSeries.map((series) => fetchBanrepSeries(series.flowId)));
  const previousByFlow = new Map((existing?.payload.series || []).map((series) => [series.flowId, series]));
  const errors: string[] = [];
  const seriesResults: BanrepSeriesSnapshot[] = [];
  const observationInputs: ExternalObservationInput[] = [];

  for (let index = 0; index < selectedSeries.length; index += 1) {
    const definition = selectedSeries[index];
    const result = fetched[index];
    if (result.status === "fulfilled") {
      const current = result.value;
      const boundedObservations = current.observations.slice(-500);
      for (const observation of boundedObservations) {
        observationInputs.push({
          sourceKey: "banrep_sdmx",
          observationKey: `${definition.flowId}:${observation.period}:${observation.measure}:${observation.unitMeasure}`,
          observedAt: parsePeriodDate(observation.period),
          value: observation.value,
          unit: observation.unitMeasure || null,
          providerName: `Banco de la República SDMX · ${definition.label}`,
          sourceUrl: current.sourceUrl,
          dimensions: {
            flowId: definition.flowId,
            label: definition.label,
            measure: observation.measure,
            unitMeasure: observation.unitMeasure,
            frequency: observation.frequency,
          },
          metadata: { period: observation.period },
        });
      }
      seriesResults.push({
        flowId: definition.flowId,
        label: definition.label,
        unitLabel: definition.unitLabel,
        status: "ok",
        sourceUrl: current.sourceUrl,
        observations: boundedObservations,
        lastError: null,
      });
    } else {
      const error = result.reason instanceof Error ? result.reason.message : "Respuesta SDMX inválida";
      errors.push(`${definition.flowId}: ${error}`);
      const previous = previousByFlow.get(definition.flowId);
      seriesResults.push({
        flowId: definition.flowId,
        label: definition.label,
        unitLabel: definition.unitLabel,
        status: previous?.observations.length ? "fallback" : "error",
        sourceUrl: previous?.sourceUrl || `${BANREP_REST},${definition.flowId},1.0/`,
        observations: previous?.observations || [],
        lastError: error.slice(0, 300),
      });
    }
  }

  await saveExternalObservations(observationInputs);
  const successfulCount = fetched.filter((result) => result.status === "fulfilled").length;
  const status = successfulCount === selectedSeries.length ? "ok" : successfulCount === 0 ? "error" : "fallback";
  const payload: BanrepMacroSnapshotPayload = {
    schemaVersion: 1,
    series: seriesResults,
    note: "Series oficiales para consulta y análisis. No actualizan automáticamente tasas, impuestos ni costos de Datos Maestros.",
  };

  return saveExternalSnapshot({
    sourceKey: "banrep_sdmx",
    wave: 4,
    status,
    providerName: "Banco de la República · servicio SDMX REST",
    sourceUrl: "https://suameca.banrep.gov.co/estadisticas-economicas/",
    payload,
    summary: successfulCount + "/" + selectedSeries.length + " series SDMX válidas · " + observationInputs.length + " observaciones guardadas",
    ttlHours: status === "ok" ? 24 : successfulCount === 0 ? 1 : 3,
    lastError: errors.length ? errors.join(" | ").slice(0, 2000) : null,
  });
}
