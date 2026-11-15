import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { runDatabaseBootstrap } from "@/db/bootstrap";
import {
  BASELINE_MIGRATION_FILE,
  CORE_RLS_MIGRATION_FILE,
  getOrderedMigrationScripts,
} from "@/db/migrate-prod";
import { runCoreSeed } from "@/db/seed-config";
import {
  breedWeightStandards,
  catalogos,
  farms,
  farmSubscriptions,
  feedInventory,
  feedPrograms,
  manureFactors,
  vaccinationTemplates,
} from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";

describe("Cadena unificada de migración, semilla base y bootstrap", () => {
  it("expone únicamente la cadena unificada en drizzle/ sin scripts SQL heredados", () => {
    const scripts = getOrderedMigrationScripts();
    expect(scripts).toEqual([BASELINE_MIGRATION_FILE, CORE_RLS_MIGRATION_FILE]);

    for (const relPath of scripts) {
      expect(fs.existsSync(path.join(process.cwd(), relPath))).toBe(true);
    }

    const scriptsDir = path.join(process.cwd(), "scripts");
    const legacySql = fs.existsSync(scriptsDir)
      ? fs.readdirSync(scriptsDir).filter((name) => name.endsWith(".sql"))
      : [];
    expect(legacySql).toEqual([]);
    expect(fs.existsSync(path.join(process.cwd(), "src/db/seed-complemento.sql"))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), "src/db/seed-premium.sql"))).toBe(false);
  });

  it("ejecuta runCoreSeed y runDatabaseBootstrap de forma idempotente sin duplicar catálogos ni planes", async () => {
    await runCoreSeed();
    const second = await runCoreSeed();

    expect(second.settingsCreated).toBe(0);
    expect(second.masterCatalogsAdded).toBe(0);
    expect(second.breedsAdded).toBe(0);
    expect(second.weightStandardsAdded).toBe(0);
    expect(second.vaccinationTemplatesCreated).toBe(0);
    expect(second.manureFactorsAdded).toBe(0);

    await runWithFarmContext(DEFAULT_FARM_ID, async () => {
      const [farmRow] = await db
        .select({ id: farms.id })
        .from(farms)
        .where(eq(farms.id, DEFAULT_FARM_ID));
      expect(farmRow?.id).toBe(DEFAULT_FARM_ID);

      const [subRow] = await db
        .select({ farmId: farmSubscriptions.farmId })
        .from(farmSubscriptions)
        .where(eq(farmSubscriptions.farmId, DEFAULT_FARM_ID));
      expect(subRow?.farmId).toBe(DEFAULT_FARM_ID);

      const [{ cnt: catCount }] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(catalogos)
        .where(eq(catalogos.farmId, DEFAULT_FARM_ID));
      expect(catCount).toBeGreaterThanOrEqual(45);

      const [{ cnt: stdCount }] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(breedWeightStandards);
      expect(stdCount).toBeGreaterThan(0);

      const [{ cnt: vacCount }] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(vaccinationTemplates);
      expect(vacCount).toBeGreaterThan(0);

      const [{ cnt: manureCount }] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(manureFactors);
      expect(manureCount).toBeGreaterThan(0);

      const [{ cnt: feedCount }] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(feedInventory);
      expect(feedCount).toBeGreaterThan(0);

      const [{ cnt: progCount }] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(feedPrograms);
      expect(progCount).toBeGreaterThan(0);
    });

    const boot = await runDatabaseBootstrap();
    expect(boot.migrations.applied).toEqual([]);
    expect(boot.seed.masterCatalogsAdded).toBe(0);
    expect(boot.seed.breedsAdded).toBe(0);

    const roleCheck = await pool.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gallinero_tenant_role') AS exists"
    );
    expect(roleCheck.rows[0]?.exists).toBe(true);
  });
});
