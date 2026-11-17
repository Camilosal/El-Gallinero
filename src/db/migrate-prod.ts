import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Pool, type PoolClient } from "pg";

export const BASELINE_MIGRATION_FILE = "drizzle/0000_baseline.sql";
export const CORE_RLS_MIGRATION_FILE = "drizzle/0001_roles_constraints_and_rls.sql";
export const PAYROLL_TAX_SUPPLIES_MIGRATION_FILE = "drizzle/0002_personal_impuestos_insumos.sql";
export const STAFF_DOCUMENT_UNIQUENESS_MIGRATION_FILE = "drizzle/0003_staff_document_unique.sql";
export const PAYROLL_MASTER_SNAPSHOTS_MIGRATION_FILE = "drizzle/0004_payroll_master_snapshots.sql";
export const SPECIES_VALUATION_PRICES_MIGRATION_FILE = "drizzle/0005_species_valuation_prices.sql";
export const EXTERNAL_SOURCE_OBSERVATIONS_MIGRATION_FILE = "drizzle/0006_external_source_observations.sql";
export const AI_ACTIONS_ORIGIN_MIGRATION_FILE = "drizzle/0007_ai_actions_origin.sql";
export const AGENT_BRIEFINGS_MIGRATION_FILE = "drizzle/0008_agent_briefings.sql";
export const TELEGRAM_CHATS_MIGRATION_FILE = "drizzle/0009_telegram_chats.sql";
export const AI_ACTIONS_CHAT_ID_MIGRATION_FILE = "drizzle/0010_ai_actions_chat_id.sql";
export const AI_ACTIONS_TOKEN_ID_MIGRATION_FILE = "drizzle/0011_ai_actions_token_id.sql";

export const ORDERED_MIGRATION_SCRIPTS = [
  BASELINE_MIGRATION_FILE,
  CORE_RLS_MIGRATION_FILE,
  PAYROLL_TAX_SUPPLIES_MIGRATION_FILE,
  STAFF_DOCUMENT_UNIQUENESS_MIGRATION_FILE,
  PAYROLL_MASTER_SNAPSHOTS_MIGRATION_FILE,
  SPECIES_VALUATION_PRICES_MIGRATION_FILE,
  EXTERNAL_SOURCE_OBSERVATIONS_MIGRATION_FILE,
  AI_ACTIONS_ORIGIN_MIGRATION_FILE,
  AGENT_BRIEFINGS_MIGRATION_FILE,
  TELEGRAM_CHATS_MIGRATION_FILE,
  AI_ACTIONS_CHAT_ID_MIGRATION_FILE,
  AI_ACTIONS_TOKEN_ID_MIGRATION_FILE,
] as const;

export function getOrderedMigrationScripts(rootDir = process.cwd()): string[] {
  const drizzleDir = path.resolve(rootDir, "drizzle");
  if (!fs.existsSync(drizzleDir)) {
    return [...ORDERED_MIGRATION_SCRIPTS];
  }
  const discovered = fs
    .readdirSync(drizzleDir)
    .filter((name) => /^\d{4}_.+\.sql$/i.test(name))
    .sort()
    .map((name) => `drizzle/${name}`);

  return discovered.length > 0 ? discovered : [...ORDERED_MIGRATION_SCRIPTS];
}

const MIGRATION_LOCK_KEY = 74820913;

function stripOuterTransaction(sqlText: string): string {
  return sqlText
    .replace(/^\s*BEGIN\s*;\s*$/gim, "")
    .replace(/^\s*COMMIT\s*;\s*$/gim, "")
    .trim();
}

function splitDrizzleStatements(sqlText: string): string[] {
  if (!sqlText.includes("--> statement-breakpoint")) {
    const cleaned = stripOuterTransaction(sqlText);
    return cleaned ? [cleaned] : [];
  }
  return sqlText
    .split("--> statement-breakpoint")
    .map((chunk) => stripOuterTransaction(chunk))
    .filter(Boolean);
}

async function hasExistingBaselineSchema(client: PoolClient): Promise<boolean> {
  const check = await client.query<{ has_tables: boolean }>(`
    SELECT (
      to_regclass('public.farms') IS NOT NULL
      AND to_regclass('public.users') IS NOT NULL
      AND to_regclass('public.catalogos') IS NOT NULL
      AND to_regclass('public.export_tokens') IS NOT NULL
      AND to_regclass('public.external_data_snapshots') IS NOT NULL
    ) AS has_tables
  `);
  return Boolean(check.rows[0]?.has_tables);
}

export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
  adoptedBaseline: boolean;
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
  let adoptedBaseline = false;

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
    const scripts = getOrderedMigrationScripts(rootDir);

    for (const relPath of scripts) {
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

      // Compatibilidad con instancias previas creadas antes de consolidar 0000_baseline.sql
      if (relPath === BASELINE_MIGRATION_FILE && (await hasExistingBaselineSchema(client))) {
        await client.query(
          `INSERT INTO schema_migrations (filename, checksum, applied_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
          [relPath, checksum],
        );
        adoptedBaseline = true;
        applied.push(relPath);
        continue;
      }

      const hasAlterTypeAddValue = /\bALTER\s+TYPE\b[\s\S]*?\bADD\s+VALUE\b/i.test(rawSql);
      const statements = splitDrizzleStatements(rawSql);

      if (hasAlterTypeAddValue) {
        for (const stmt of statements) {
          await client.query(stmt);
        }
        await client.query(
          `INSERT INTO schema_migrations (filename, checksum, applied_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
          [relPath, checksum],
        );
      } else {
        await client.query("BEGIN");
        try {
          for (const stmt of statements) {
            await client.query(stmt);
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

    return { applied, skipped, adoptedBaseline };
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
        `[db:migrate] Completado. Aplicadas: ${res.applied.length}, Omitidas (sin cambios): ${res.skipped.length}${res.adoptedBaseline ? " (baseline adoptado sobre esquema existente)" : ""}.`,
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
