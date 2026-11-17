import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { requirePermission } from "@/lib/rbac-server";
import { saveExternalObservations, saveExternalSnapshot } from "@/lib/external-sources/snapshot-store";
import {
  officialSourceUrl,
  parseOfficialSourceCsv,
  type OfficialCsvImportType,
} from "@/lib/external-sources/official-csv-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 12_000_000;
const SAVE_BATCH_SIZE = 5_000;
const MAX_ROWS_PER_IMPORT = 50_000;
const ALLOWED_IMPORT_TYPES: OfficialCsvImportType[] = ["sipsa_i", "ipc", "ipp"];

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  const action = String(body.action || "preview");
  const sourceType = String(body.sourceType || "") as OfficialCsvImportType;
  const fileName = String(body.fileName || "").trim();
  const content = typeof body.csv === "string" ? body.csv : "";
  const groupLabel = String(body.group || "").trim();

  if (!ALLOWED_IMPORT_TYPES.includes(sourceType)) {
    return NextResponse.json({ error: "Tipo de archivo oficial no reconocido." }, { status: 400 });
  }
  if (action !== "preview" && action !== "import") {
    return NextResponse.json({ error: "Acción de importación no válida." }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "Seleccione un archivo CSV exportado de la publicación oficial." }, { status: 400 });
  }
  if (Buffer.byteLength(content, "utf8") > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "El archivo supera el límite de 12 MB. Filtre la exportación por grupo o periodo." }, { status: 413 });
  }
  if (!fileName.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "El importador recibe CSV. Extraiga o exporte el archivo de la publicación DANE como CSV UTF-8." }, { status: 415 });
  }

  let parsed;
  try {
    parsed = parseOfficialSourceCsv(content, sourceType, fileName, groupLabel);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer el CSV." }, { status: 400 });
  }

  const preview = parsed.observations.slice(0, 10).map((row) => ({
    period: String(row.dimensions?.period || ""),
    indicator: String(row.dimensions?.article || row.dimensions?.indicator || ""),
    territory: String(row.dimensions?.divipolaCode || row.dimensions?.coverage || ""),
    value: row.value,
    unit: row.unit,
  }));
  if (action === "preview") {
    return NextResponse.json({
      ok: true,
      sourceType,
      fileName: fileName.slice(0, 180),
      validRows: parsed.observations.length,
      rejectedRows: parsed.rejectedRows,
      rejectionReasons: parsed.rejectionReasons,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      preview,
    });
  }
  if (parsed.observations.length === 0) {
    return NextResponse.json({ error: "El archivo no contiene filas válidas para importar.", rejectedRows: parsed.rejectedRows, rejectionReasons: parsed.rejectionReasons }, { status: 400 });
  }
  if (parsed.observations.length > MAX_ROWS_PER_IMPORT) {
    return NextResponse.json({ error: "El archivo supera 50.000 filas válidas. Sepárelo por periodo o grupo e impórtelo en lotes." }, { status: 413 });
  }

  let saved = 0;
  for (let start = 0; start < parsed.observations.length; start += SAVE_BATCH_SIZE) {
    saved += await saveExternalObservations(parsed.observations.slice(start, start + SAVE_BATCH_SIZE));
  }
  const groupName = sourceType === "sipsa_i" ? "SIPSA-I" : "DANE " + sourceType.toUpperCase();
  const summary = groupName + ": " + saved + " observaciones importadas desde " + fileName.slice(0, 100) + " · " + parsed.rejectedRows + " filas omitidas";
  const snapshot = await saveExternalSnapshot({
    sourceKey: sourceType === "sipsa_i" ? "dane_sipsa_i" : "dane_price_indices",
    wave: 6,
    status: "manual",
    syncMode: "manual",
    providerName: "DANE · archivo oficial importado y validado por la granja",
    sourceUrl: officialSourceUrl(sourceType),
    scopeKey: sourceType === "sipsa_i" ? "manual-import" : "manual-import-" + sourceType,
    payload: {
      schemaVersion: 1,
      sourceType,
      fileName: fileName.slice(0, 180),
      importedRows: saved,
      rejectedRows: parsed.rejectedRows,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      rejectionReasons: parsed.rejectionReasons,
      note: "Importación manual de un archivo publicado por DANE; no es una sincronización automática. Los datos son referencias y no actualizan precios maestros.",
    },
    summary,
    ttlHours: 24 * 365,
  });

  return NextResponse.json({
    ok: true,
    sourceType,
    importedRows: saved,
    rejectedRows: parsed.rejectedRows,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    summary,
    snapshotStatus: snapshot.status,
  });
});
