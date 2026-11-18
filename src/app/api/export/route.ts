import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { runWithFarmContext } from "@/db/tenant-context";
import { hasIntegrationScope } from "@/lib/export/auth";
import { buildXlsxBytes, rowsToCsv } from "@/lib/export/xlsx";
import type { CellValue } from "@/lib/export/xlsx";
import {
  EXPORT_DATASETS,
  EXPORT_BACKUP_ID,
  EXPORT_TABLE_PREFIX,
  EXPORT_MAX_RANGE_DAYS,
  EXPORT_MAX_ROWS,
  EXPORT_PACKAGE_DATASETS,
  EXPORT_PACKAGE_ID,
  getExportDataset,
  getExportRequiredScopes,
  getBackupExportTableCatalog,
  loadBackupTableExport,
  loadCompleteFarmBackup,
  loadExportDataset,
  loadExportPackage,
  resolveExportRange,
  type ExportFormat,
  type ExportRange,
  type ExportSheetData,
} from "@/lib/export/datasets";
import { readExportTokenFromRequest, resolveExportToken } from "@/lib/export/auth";

export const dynamic = "force-dynamic";

interface ExportActor {
  farmId: string;
  via: "session" | "token";
  scopes: string[];
}

/**
 * Resuelve quién descarga: token de solo lectura o cookie de sesión.
 * El token se valida antes de abrir el contexto de granja porque necesita
 * descubrir el `farm_id` al que pertenece.
 */
async function resolveActor(req: NextRequest): Promise<ExportActor | NextResponse> {
  const rawToken = readExportTokenFromRequest(req);
  if (rawToken) {
    const resolved = await resolveExportToken(rawToken);
    if (!resolved) {
      return NextResponse.json(
        { error: "Token de exportación inválido, expirado o revocado" },
        { status: 401 },
      );
    }
    return { farmId: resolved.farmId, via: "token", scopes: resolved.scopes };
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return { farmId: user.farmId, via: "session", scopes: [] };
}

function catalogResponse() {
  return NextResponse.json({
    object: "export_catalog",
    version: 1,
    maxRowsPerDataset: EXPORT_MAX_ROWS,
    maxRangeDays: EXPORT_MAX_RANGE_DAYS,
    package: {
      id: EXPORT_PACKAGE_ID,
      label: "Libro de análisis operativo (XLSX)",
      description: "Libro Excel con resumen y hojas analíticas operativas seleccionadas.",
      datasets: EXPORT_PACKAGE_DATASETS,
      formats: ["xlsx"],
    },
    backup: {
      id: EXPORT_BACKUP_ID,
      label: "Respaldo de datos de la granja (JSON)",
      description: "Incluye todas las tablas actuales asociadas a la granja, módulos nuevos, configuración, nómina, adjuntos y datos de Gina/Telegram, además de plantillas sanitarias y estándares de peso compartidos. Omite credenciales, sesiones, tokens de conector, facturación del servicio y recibos técnicos de sincronización.",
      format: "json",
      requiredScope: "read:backup",
      tables: getBackupExportTableCatalog(),
    },
    datasets: EXPORT_DATASETS.map((dataset) => ({
      id: dataset.id,
      label: dataset.label,
      description: dataset.description,
      category: dataset.category,
      granularity: dataset.granularity,
      usesRange: dataset.usesRange,
      formats: [...dataset.formats, "json"],
      columns: dataset.headers,
      requiredScopes: getExportRequiredScopes(dataset.id),
    })),
  });
}

function sheetToCsv(sheet: ExportSheetData): string {
  return rowsToCsv(sheet.headers, sheet.rows);
}

function sheetToXlsxRows(sheet: ExportSheetData): CellValue[][] {
  return [sheet.headers, ...sheet.rows];
}

function extractRowDateIso(row: CellValue[]): string | null {
  for (const cell of row) {
    if (typeof cell === "string") {
      const isoMatch = cell.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) return isoMatch[1];
    }
  }
  return null;
}

function rowToRecord(headers: string[], row: CellValue[]): Record<string, CellValue> {
  const record: Record<string, CellValue> = {};
  for (let i = 0; i < headers.length; i += 1) {
    record[headers[i]] = row[i] ?? null;
  }
  return record;
}

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveActor(req);
    if (actor instanceof NextResponse) return actor;

    const { searchParams } = new URL(req.url);
    const datasetId = (searchParams.get("dataset") || "").trim();
    const formatParam = (searchParams.get("format") || "csv").trim().toLowerCase();
    const format: ExportFormat | "json" =
      formatParam === "xlsx" || formatParam === "excel"
        ? "xlsx"
        : formatParam === "json"
          ? "json"
          : "csv";

    if (!datasetId) {
      return catalogResponse();
    }

    if (
      datasetId !== EXPORT_PACKAGE_ID &&
      datasetId !== EXPORT_BACKUP_ID &&
      !getExportDataset(datasetId) &&
      !getBackupExportTableCatalog().some((table) => table.id === datasetId)
    ) {
      return NextResponse.json(
        {
          error: `Dataset desconocido: ${datasetId}`,
          available: EXPORT_DATASETS.map((dataset) => dataset.id),
          package: EXPORT_PACKAGE_ID,
        },
        { status: 400 },
      );
    }

    if (
      formatParam !== "csv" &&
      formatParam !== "xlsx" &&
      formatParam !== "excel" &&
      formatParam !== "json"
    ) {
      return NextResponse.json(
        { error: "Formato inválido. Usa format=csv, format=xlsx o format=json." },
        { status: 400 },
      );
    }

    if (actor.via === "token") {
      const requiredScopes = getExportRequiredScopes(datasetId);
      const hasBackupScope = hasIntegrationScope(actor.scopes, "read:backup");
      const authorized = hasBackupScope || requiredScopes.every((scope) => actor.scopes.includes(scope));
      if (!authorized) {
        return NextResponse.json(
          {
            error: "El token no tiene los alcances necesarios para consultar este conjunto de datos.",
            requiredScopes,
            grantedScopes: actor.scopes,
          },
          { status: 403 },
        );
      }
    }

    if (datasetId === EXPORT_BACKUP_ID) {
      if (format !== "json") {
        return NextResponse.json(
          { error: "El respaldo completo solo está disponible en formato JSON (format=json)." },
          { status: 400 },
        );
      }
      const backup = await runWithFarmContext(actor.farmId, loadCompleteFarmBackup);
      const dateStamp = new Date().toISOString().slice(0, 10);
      return NextResponse.json(backup, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="iwagranja-respaldo-${dateStamp}.json"`,
          "X-Export-Dataset": EXPORT_BACKUP_ID,
          "X-Export-Auth": actor.via,
        },
      });
    }

    if (datasetId.startsWith(EXPORT_TABLE_PREFIX)) {
      if (format !== "json") {
        return NextResponse.json(
          { error: "La exportación de tablas del respaldo solo está disponible en formato JSON." },
          { status: 400 },
        );
      }
      const updatedSinceRaw = (searchParams.get("updated_since") || "").trim();
      const updatedSinceMatch = updatedSinceRaw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (updatedSinceRaw && !updatedSinceMatch) {
        return NextResponse.json(
          { error: "Parámetro updated_since inválido. Usa formato YYYY-MM-DD o ISO-8601." },
          { status: 400 },
        );
      }
      const limitRaw = Number(searchParams.get("limit") || "500");
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(1000, Math.floor(limitRaw)) : 500;
      const cursorRaw = Number(searchParams.get("cursor") || "0");
      const cursor = Number.isFinite(cursorRaw) && cursorRaw >= 0 ? Math.floor(cursorRaw) : 0;
      let tableExport;
      try {
        tableExport = await runWithFarmContext(actor.farmId, () =>
          loadBackupTableExport(datasetId, {
            limit,
            cursor,
            updatedSince: updatedSinceMatch?.[1] ?? null,
          }),
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("no tiene updatedAt")) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
      if (!tableExport) {
        return NextResponse.json({ error: `Tabla exportable desconocida: ${datasetId}` }, { status: 400 });
      }
      return NextResponse.json(tableExport, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Export-Dataset": datasetId,
          "X-Export-Auth": actor.via,
          "X-Export-Rows": String(tableExport.count),
        },
      });
    }

    const rangeResult = resolveExportRange(searchParams.get("from"), searchParams.get("to"));
    if (!rangeResult.ok) {
      return NextResponse.json({ error: rangeResult.error }, { status: 400 });
    }
    const range: ExportRange = rangeResult.range;

    if (datasetId === EXPORT_PACKAGE_ID && format !== "xlsx") {
      return NextResponse.json(
        {
          error:
            "El libro de análisis operativo solo está disponible en Excel (format=xlsx). Para CSV o JSON descarga cada dataset por separado.",
        },
        { status: 400 },
      );
    }

    const payload = await runWithFarmContext(actor.farmId, async () => {
      if (datasetId === EXPORT_PACKAGE_ID) {
        const sheets = await loadExportPackage(range);
        return { sheets, truncated: sheets.some((sheet) => sheet.truncated) };
      }
      const sheet = await loadExportDataset(datasetId, range);
      return { sheets: [sheet], truncated: sheet.truncated };
    });

    const suffix = `${range.from}-a-${range.to}`;
    const baseName =
      datasetId === EXPORT_PACKAGE_ID ? `gallinero-paquete-operativo-${suffix}` : `gallinero-${datasetId}-${suffix}`;

    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
      "X-Export-Dataset": datasetId,
      "X-Export-From": range.from,
      "X-Export-To": range.to,
      "X-Export-Auth": actor.via,
      "X-Export-Truncated": payload.truncated ? "1" : "0",
    };

    if (format === "json") {
      const sheet = payload.sheets[0];
      const updatedSinceRaw = (searchParams.get("updated_since") || "").trim();
      let updatedSinceDateOnly: string | null = null;
      if (updatedSinceRaw) {
        const match = updatedSinceRaw.match(/^(\d{4}-\d{2}-\d{2})/);
        if (!match) {
          return NextResponse.json(
            { error: "Parámetro updated_since inválido. Usa formato YYYY-MM-DD o ISO-8601." },
            { status: 400 },
          );
        }
        updatedSinceDateOnly = match[1];
      }

      const limitRaw = Number(searchParams.get("limit") || "500");
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(1000, Math.floor(limitRaw)) : 500;
      const cursorRaw = Number(searchParams.get("cursor") || "0");
      const offset = Number.isFinite(cursorRaw) && cursorRaw >= 0 ? Math.floor(cursorRaw) : 0;

      const filteredRows = updatedSinceDateOnly
        ? sheet.rows.filter((row) => {
            const rowDate = extractRowDateIso(row);
            return rowDate === null || rowDate >= updatedSinceDateOnly;
          })
        : sheet.rows;

      const pagedRows = filteredRows.slice(offset, offset + limit);
      const hasMore = offset + pagedRows.length < filteredRows.length;
      const nextCursor = hasMore ? String(offset + limit) : null;

      headers["X-Export-Rows"] = String(pagedRows.length);
      return NextResponse.json(
        {
          object: "export_records",
          version: 1,
          dataset: datasetId,
          label: sheet.label,
          farmId: actor.farmId,
          from: range.from,
          to: range.to,
          updatedSince: updatedSinceRaw || null,
          totalMatched: filteredRows.length,
          count: pagedRows.length,
          limit,
          cursor: String(offset),
          nextCursor,
          hasMore,
          truncated: payload.truncated,
          syncedAt: new Date().toISOString(),
          columns: sheet.headers,
          records: pagedRows.map((row) => rowToRecord(sheet.headers, row)),
        },
        { status: 200, headers },
      );
    }

    if (format === "csv") {
      const sheet = payload.sheets[0];
      headers["Content-Type"] = "text/csv; charset=utf-8";
      headers["Content-Disposition"] = `attachment; filename="${baseName}.csv"`;
      headers["X-Export-Rows"] = String(sheet.rows.length);
      return new NextResponse(sheetToCsv(sheet), { status: 200, headers });
    }

    const bytes = buildXlsxBytes(
      payload.sheets.map((sheet) => ({
        name: sheet.label,
        rows: sheetToXlsxRows(sheet),
      })),
    );
    headers["Content-Type"] =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    headers["Content-Disposition"] = `attachment; filename="${baseName}.xlsx"`;
    headers["X-Export-Rows"] = String(
      payload.sheets.reduce((total, sheet) => total + sheet.rows.length, 0),
    );
    return new NextResponse(Buffer.from(bytes), { status: 200, headers });
  } catch (error) {
    console.error("Export API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar la exportación" },
      { status: 500 },
    );
  }
}
