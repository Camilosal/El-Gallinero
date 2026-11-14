import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { runWithFarmContext } from "@/db/tenant-context";
import { buildXlsxBytes, rowsToCsv } from "@/lib/export/xlsx";
import type { CellValue } from "@/lib/export/xlsx";
import {
  EXPORT_DATASETS,
  EXPORT_MAX_RANGE_DAYS,
  EXPORT_MAX_ROWS,
  EXPORT_PACKAGE_DATASETS,
  EXPORT_PACKAGE_ID,
  getExportDataset,
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
        { error: "Token de exportación inválido o revocado" },
        { status: 401 },
      );
    }
    return { farmId: resolved.farmId, via: "token" };
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return { farmId: user.farmId, via: "session" };
}

function catalogResponse() {
  return NextResponse.json({
    object: "export_catalog",
    version: 1,
    maxRowsPerDataset: EXPORT_MAX_ROWS,
    maxRangeDays: EXPORT_MAX_RANGE_DAYS,
    package: {
      id: EXPORT_PACKAGE_ID,
      label: "Paquete operativo completo (XLSX)",
      description: "Un libro Excel con una hoja por cada dataset del modelo de operación.",
      datasets: EXPORT_PACKAGE_DATASETS,
      formats: ["xlsx"],
    },
    datasets: EXPORT_DATASETS.map((dataset) => ({
      id: dataset.id,
      label: dataset.label,
      description: dataset.description,
      category: dataset.category,
      granularity: dataset.granularity,
      usesRange: dataset.usesRange,
      formats: dataset.formats,
      columns: dataset.headers,
    })),
  });
}

function sheetToCsv(sheet: ExportSheetData): string {
  return rowsToCsv(sheet.headers, sheet.rows);
}

function sheetToXlsxRows(sheet: ExportSheetData): CellValue[][] {
  return [sheet.headers, ...sheet.rows];
}

export async function GET(req: NextRequest) {
  try {
    const actor = await resolveActor(req);
    if (actor instanceof NextResponse) return actor;

    const { searchParams } = new URL(req.url);
    const datasetId = (searchParams.get("dataset") || "").trim();
    const formatParam = (searchParams.get("format") || "csv").trim().toLowerCase();
    const format: ExportFormat = formatParam === "xlsx" || formatParam === "excel" ? "xlsx" : "csv";

    if (!datasetId) {
      return catalogResponse();
    }

    if (datasetId !== EXPORT_PACKAGE_ID && !getExportDataset(datasetId)) {
      return NextResponse.json(
        {
          error: `Dataset desconocido: ${datasetId}`,
          available: EXPORT_DATASETS.map((dataset) => dataset.id),
          package: EXPORT_PACKAGE_ID,
        },
        { status: 400 },
      );
    }

    if (formatParam !== "csv" && formatParam !== "xlsx" && formatParam !== "excel") {
      return NextResponse.json(
        { error: "Formato inválido. Usa format=csv o format=xlsx." },
        { status: 400 },
      );
    }

    const rangeResult = resolveExportRange(searchParams.get("from"), searchParams.get("to"));
    if (!rangeResult.ok) {
      return NextResponse.json({ error: rangeResult.error }, { status: 400 });
    }
    const range: ExportRange = rangeResult.range;

    const payload = await runWithFarmContext(actor.farmId, async () => {
      if (datasetId === EXPORT_PACKAGE_ID) {
        const sheets = await loadExportPackage(range);
        return { sheets, truncated: sheets.some((sheet) => sheet.truncated) };
      }
      const sheet = await loadExportDataset(datasetId, range);
      return { sheets: [sheet], truncated: sheet.truncated };
    });

    if (datasetId === EXPORT_PACKAGE_ID && format !== "xlsx") {
      return NextResponse.json(
        {
          error:
            "El paquete operativo completo solo está disponible en Excel (format=xlsx). Para CSV descarga cada dataset por separado.",
        },
        { status: 400 },
      );
    }

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
