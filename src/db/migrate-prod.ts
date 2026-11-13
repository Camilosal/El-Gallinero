import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Pool } from "pg";

export const ORDERED_MIGRATION_SCRIPTS = [
  "scripts/add_animal_exit_snapshots.sql",
  "scripts/add_animal_genetic_traceability.sql",
  "scripts/add_farm_locations.sql",
  "scripts/add_farm_assets_and_recurring_maintenance.sql",
  "scripts/add_admin_recovery_code.sql",
  "scripts/align_feed_enums_with_catalogs.sql",
  "scripts/add_offline_mutation_receipts.sql",
  "scripts/add_analytics_dimensions.sql",
  "scripts/add_contacts_table.sql",
  "scripts/add_study_improvements.sql",
  "scripts/add_attachments_table.sql",
  "scripts/add_sales_schema_fields.sql",
  "scripts/add_multi_tenancy_farms.sql",
  "scripts/add_saas_subscriptions.sql",
  "scripts/scope_agent_memory_by_farm.sql",
] as const;

const MIGRATION_LOCK_KEY = 74820913;

function stripOuterTransaction(sqlText: string): string {
  return sqlText
    .replace(/^\s*BEGIN\s*;\s*$/gim, "")
    .replace(/^\s*COMMIT\s*;\s*$/gim, "")
    .trim();
}

export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
}

export async function runPendingMigrations(externalPool?: Pool): Promise<MigrationRunResult> {
  const ownsPool = !externalPool;
  const targetPool =
    externalPool ||
    new Pool({
      connectionString: process.env.DATABASE_URL,
    });

  const client = await targetPool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await client.query(`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename varchar(255) PRIMARY KEY,
        checksum varchar(64) NOT NULL,
        applied_at timestamp DEFAULT now() NOT NULL
      )
    `);

    const rootDir = process.cwd();

    for (const relPath of ORDERED_MIGRATION_SCRIPTS) {
      const fullPath = path.resolve(rootDir, relPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Script de migración no encontrado: ${relPath}`);
      }

      const rawSql = fs.readFileSync(fullPath, "utf8");
      const checksum = crypto.createHash("sha256").update(rawSql, "utf8").digest("hex");

      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE filename = $1 LIMIT 1",
        [relPath],
      );

      if (existing.rows[0]?.checksum === checksum) {
        skipped.push(relPath);
        continue;
      }

      const hasAlterTypeAddValue = /\bALTER\s+TYPE\b[\s\S]*?\bADD\s+VALUE\b/i.test(rawSql);

      if (hasAlterTypeAddValue) {
        // ALTER TYPE ... ADD VALUE debe ejecutarse fuera de una transacción explícita cuando se combina con otras sentencias
        const cleaned = stripOuterTransaction(rawSql);
        if (cleaned) {
          await client.query(cleaned);
        }
        await client.query(
          `INSERT INTO schema_migrations (filename, checksum, applied_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
          [relPath, checksum],
        );
      } else {
        const cleaned = stripOuterTransaction(rawSql);
        await client.query("BEGIN");
        try {
          if (cleaned) {
            await client.query(cleaned);
          }
          await client.query(
            `INSERT INTO schema_migrations (filename, checksum, applied_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
            [relPath, checksum],
          );
          await client.query("COMMIT");
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`Error aplicando ${relPath}: ${(err as Error).message}`);
        }
      }

      applied.push(relPath);
    }

    return { applied, skipped };
  } finally {
    await client.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`).catch(() => undefined);
    client.release();
    if (ownsPool) {
      await targetPool.end();
    }
  }
}

const isCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  path.basename(process.argv[1] || "") === "migrate-prod.ts";

if (isCli) {
  runPendingMigrations()
    .then((res) => {
      console.log(
        `[db:migrate] Completado. Aplicadas: ${res.applied.length}, Omitidas (sin cambios): ${res.skipped.length}.`,
      );
      if (res.applied.length > 0) {
        console.log(`[db:migrate] Archivos aplicados: ${res.applied.join(", ")}`);
      }
    })
    .catch((err) => {
      console.error("[db:migrate] Fallo aplicando migraciones:", err);
      process.exit(1);
    });
}
