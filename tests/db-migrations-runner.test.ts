import { describe, expect, it } from "vitest";
import { pool } from "@/db";
import { ORDERED_MIGRATION_SCRIPTS, runPendingMigrations } from "@/db/migrate-prod";
import { NORMATIVE_PACK_VERSION } from "@/db/seed-config";

describe("Automated Migration Runner & Normative Pack Version", () => {
  it("aplica migraciones idempotentemente y la segunda ejecución aplica 0 pendientes", async () => {
    const firstRun = await runPendingMigrations(pool);
    expect(firstRun.applied.length + firstRun.skipped.length).toBe(ORDERED_MIGRATION_SCRIPTS.length);

    const secondRun = await runPendingMigrations(pool);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toEqual([...ORDERED_MIGRATION_SCRIPTS]);

    const schemaCheck = await pool.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('schema_migrations', 'farms', 'farm_subscriptions', 'billing_payments')
    `);
    expect(schemaCheck.rows.map((r) => r.table_name).sort()).toEqual([
      "billing_payments",
      "farm_subscriptions",
      "farms",
      "schema_migrations",
    ]);

    const salesCols = await pool.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'chicken_sales'
        AND column_name IN ('species', 'location_id')
    `);
    expect(salesCols.rows.map((r) => r.column_name).sort()).toEqual(["location_id", "species"]);
  });

  it("expone NORMATIVE_PACK_VERSION actualizado para paquete ICA / NTC 1240", () => {
    expect(NORMATIVE_PACK_VERSION).toBe("2026.11-ICA-NTC1240");
  });
});

