import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { pool } from "@/db";
import { runPendingMigrations } from "@/db/migrate-prod";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import {
  EXPORT_DATASETS,
  EXPORT_MAX_RANGE_DAYS,
  EXPORT_PACKAGE_DATASETS,
  EXPORT_PACKAGE_ID,
  getExportDataset,
  loadExportDataset,
  resolveExportRange,
} from "@/lib/export/datasets";
import {
  EXPORT_TOKEN_PREFIX,
  hashExportToken,
  issueExportToken,
  listExportTokens,
  resolveExportToken,
  revokeExportTokens,
} from "@/lib/export/auth";
import { buildXlsxBytes, rowsToCsv } from "@/lib/export/xlsx";
import { GET as exportGet } from "@/app/api/export/route";

const TEST_RANGE = { from: "2026-01-01", to: "2026-01-31" };

describe("exportación CSV/XLSX del modelo de operación", () => {
  beforeAll(async () => {
    await runPendingMigrations(pool);
  });

  it("expone un catálogo de datasets único, documentado y sin columnas repetidas", () => {
    const ids = EXPORT_DATASETS.map((dataset) => dataset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("resumen-diario");
    expect(ids).toContain("huevos");
    expect(ids).toContain("finanzas");
    expect(ids).toContain("sensores");

    for (const dataset of EXPORT_DATASETS) {
      expect(dataset.label.length).toBeGreaterThan(3);
      expect(dataset.description.length).toBeGreaterThan(10);
      expect(dataset.headers.length).toBeGreaterThan(2);
      expect(new Set(dataset.headers).size).toBe(dataset.headers.length);
      expect(dataset.formats).toContain("csv");
      expect(dataset.formats).toContain("xlsx");
    }
  });

  it("incluye todos los datasets en el paquete operativo y solo admite Excel", () => {
    const catalogIds = EXPORT_DATASETS.map((dataset) => dataset.id).sort();
    expect([...EXPORT_PACKAGE_DATASETS].sort()).toEqual(catalogIds);
    expect(getExportDataset(EXPORT_PACKAGE_ID)).toBeNull();
  });

  it("valida el rango de fechas con topes claros", () => {
    expect(resolveExportRange(null, null).ok).toBe(true);

    const invalidFormat = resolveExportRange("2026-13-01", "2026-12-31");
    expect(invalidFormat.ok).toBe(false);

    const reversed = resolveExportRange("2026-05-01", "2026-04-01");
    expect(reversed.ok).toBe(false);

    const tooLong = resolveExportRange("2024-01-01", "2026-12-31");
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.error).toContain(String(EXPORT_MAX_RANGE_DAYS));
    }
  });

  it("genera CSV con BOM y XLSX con firma ZIP válida", () => {
    const csv = rowsToCsv(["Fecha", "Huevos"], [["2026-11-14", 120]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Fecha,Huevos");
    expect(csv).toContain("2026-11-14,120");

    const bytes = buildXlsxBytes([
      { name: "Resumen diario", rows: [["Fecha", "Huevos"], ["2026-11-14", 120]] },
    ]);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("carga el resumen diario y respeta el ancho de columnas declarado", async () => {
    const sheet = await runWithFarmContext(DEFAULT_FARM_ID, () =>
      loadExportDataset("resumen-diario", TEST_RANGE),
    );
    expect(sheet.headers.length).toBe(23);
    expect(sheet.rows.length).toBe(31);
    for (const row of sheet.rows) {
      expect(row.length).toBe(sheet.headers.length);
    }
    expect(sheet.rows[0][0]).toBe("2026-01-01");
    expect(sheet.rows[30][0]).toBe("2026-01-31");
  });

  it("emite, valida, lista y revoca tokens de solo lectura", async () => {
    const issued = await runWithFarmContext(DEFAULT_FARM_ID, () =>
      issueExportToken({ name: "Prueba dashboard", createdBy: null }),
    );
    expect(issued.token.startsWith(EXPORT_TOKEN_PREFIX)).toBe(true);
    expect(issued.token.length).toBeGreaterThan(30);
    expect(issued.prefix).toBe(issued.token.slice(0, EXPORT_TOKEN_PREFIX.length + 6));

    const resolved = await resolveExportToken(issued.token);
    expect(resolved?.farmId).toBe(DEFAULT_FARM_ID);

    const active = await runWithFarmContext(DEFAULT_FARM_ID, () => listExportTokens());
    expect(active.map((token) => token.id)).toContain(issued.id);

    const invalid = await resolveExportToken("glli_exp_token_inventado_1234567890");
    expect(invalid).toBeNull();

    // El token se guarda hasheado, nunca en claro.
    const stored = await pool.query<{ token_hash: string }>(
      "SELECT token_hash FROM export_tokens WHERE id = $1",
      [issued.id],
    );
    expect(stored.rows[0]?.token_hash).toBe(hashExportToken(issued.token));
    expect(stored.rows[0]?.token_hash).not.toContain(issued.token);
  });

  it("sirve CSV y XLSX con token y rechaza tokens inválidos", async () => {
    const issued = await runWithFarmContext(DEFAULT_FARM_ID, () =>
      issueExportToken({ name: "Prueba endpoint", createdBy: null }),
    );

    const csvRes = await exportGet(
      new NextRequest(
        `http://localhost/api/export?dataset=resumen-diario&format=csv&from=${TEST_RANGE.from}&to=${TEST_RANGE.to}`,
        { headers: { "x-export-token": issued.token } },
      ),
    );
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    expect(csvRes.headers.get("x-export-auth")).toBe("token");
    expect(csvRes.headers.get("content-disposition")).toContain("gallinero-resumen-diario");
    const csvBytes = new Uint8Array(await csvRes.arrayBuffer());
    expect(Array.from(csvBytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(csvBytes);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n").length).toBeGreaterThanOrEqual(32);

    const xlsxRes = await exportGet(
      new NextRequest(
        `http://localhost/api/export?dataset=resumen-diario&format=xlsx&from=${TEST_RANGE.from}&to=${TEST_RANGE.to}`,
        { headers: { authorization: `Bearer ${issued.token}` } },
      ),
    );
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers.get("content-type")).toContain("spreadsheetml");
    const bytes = new Uint8Array(await xlsxRes.arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const packageCsv = await exportGet(
      new NextRequest(
        `http://localhost/api/export?dataset=${EXPORT_PACKAGE_ID}&format=csv`,
        { headers: { "x-export-token": issued.token } },
      ),
    );
    expect(packageCsv.status).toBe(400);

    const packageXlsx = await exportGet(
      new NextRequest(
        `http://localhost/api/export?dataset=${EXPORT_PACKAGE_ID}&format=xlsx`,
        { headers: { "x-export-token": issued.token } },
      ),
    );
    expect(packageXlsx.status).toBe(200);
    const packageBytes = new Uint8Array(await packageXlsx.arrayBuffer());
    expect(Array.from(packageBytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const noAuth = await exportGet(
      new NextRequest("http://localhost/api/export?dataset=huevos&format=csv"),
    );
    // El setup de pruebas simula una sesión; sin token ni sesión real sería 401.
    expect([200, 401]).toContain(noAuth.status);

    const invalid = await exportGet(
      new NextRequest("http://localhost/api/export?dataset=huevos&format=csv", {
        headers: { "x-export-token": "glli_exp_no_existe_1234567890" },
      }),
    );
    expect(invalid.status).toBe(401);

    const unknown = await exportGet(
      new NextRequest("http://localhost/api/export?dataset=no-existe&format=csv", {
        headers: { "x-export-token": issued.token },
      }),
    );
    expect(unknown.status).toBe(400);

    await runWithFarmContext(DEFAULT_FARM_ID, () => revokeExportTokens());
    const revoked = await resolveExportToken(issued.token);
    expect(revoked).toBeNull();
  });

  it("mantiene la tabla de tokens fuera de RLS y con el hash indexado", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "scripts/add_export_tokens.sql"),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS export_tokens");
    expect(migration).toContain("token_hash varchar(64) NOT NULL UNIQUE");
    expect(migration).not.toContain("ENABLE ROW LEVEL SECURITY");

    const runner = fs.readFileSync(path.join(process.cwd(), "src/db/migrate-prod.ts"), "utf8");
    expect(runner).toContain("scripts/add_export_tokens.sql");

    const proxy = fs.readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");
    expect(proxy).toContain('"/api/export"');
  });
});
