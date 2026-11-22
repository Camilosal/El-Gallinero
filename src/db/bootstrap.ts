import path from "path";
import { hashPassword } from "@/lib/auth";
import { pool } from "./index";
import { runPendingMigrations } from "./migrate-prod";
import { runCoreSeed, type CoreSeedResult } from "./seed-config";
import { DEFAULT_FARM_ID } from "./tenant-context";

export interface BootstrapOptions {
  includeStarterFeeding?: boolean;
  adminUsername?: string;
  adminPassword?: string;
  adminName?: string;
}

export interface InitialAdminResult {
  created: boolean;
  reason: "created" | "users_already_exist" | "env_not_configured";
  username?: string;
}

export interface BootstrapResult {
  migrations: {
    applied: string[];
    skipped: string[];
    adoptedBaseline: boolean;
  };
  seed: CoreSeedResult;
  admin: InitialAdminResult;
}

/**
 * Crea el primer usuario administrador de la granja por defecto si la tabla `users`
 * está vacía y se proporcionaron credenciales válidas (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
 */
export async function ensureInitialAdmin(options: BootstrapOptions = {}): Promise<InitialAdminResult> {
  const username = (options.adminUsername ?? process.env.ADMIN_USERNAME ?? "").trim();
  const password = options.adminPassword ?? process.env.ADMIN_PASSWORD ?? "";
  const name = (options.adminName ?? process.env.ADMIN_NAME ?? "Administrador Principal").trim() || "Administrador Principal";

  if (!username || !password) {
    return { created: false, reason: "env_not_configured" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE users IN EXCLUSIVE MODE");
    const countRes = await client.query<{ cnt: number }>("SELECT count(*)::int AS cnt FROM users");
    const existingCount = countRes.rows[0]?.cnt ?? 0;

    if (existingCount > 0) {
      await client.query("COMMIT");
      return { created: false, reason: "users_already_exist" };
    }

    if (password.length < 12) {
      throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
    }

    const passwordHash = await hashPassword(password);
    await client.query(
      `INSERT INTO users (farm_id, username, password_hash, name, role)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [DEFAULT_FARM_ID, username, passwordHash, name]
    );

    await client.query("COMMIT");
    return { created: true, reason: "created", username };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Inicializa o actualiza la base de datos en un único flujo idempotente:
 * 1. Aplica migraciones pendientes (baseline + roles/constraints/RLS + evoluciones).
 * 2. Ejecuta el Core Seed obligatorio (granja base, catálogos, estándares, planes de alimentación).
 * 3. Crea opcionalmente el admin inicial si `ADMIN_USERNAME` + `ADMIN_PASSWORD` están configurados.
 */
export async function runDatabaseBootstrap(options: BootstrapOptions = {}): Promise<BootstrapResult> {
  const migrations = await runPendingMigrations(pool);
  const seed = await runCoreSeed({
    includeStarterFeeding: options.includeStarterFeeding,
  });
  const admin = await ensureInitialAdmin(options);
  return { migrations, seed, admin };
}

const isDirectExecution =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  path.basename(process.argv[1] || "") === "bootstrap.ts";

if (isDirectExecution) {
  runDatabaseBootstrap()
    .then((result) => {
      console.log(
        `[db:bootstrap] Listo. Migraciones aplicadas=${result.migrations.applied.length} (adoptado_baseline=${result.migrations.adoptedBaseline}), ` +
          `omitidas=${result.migrations.skipped.length}, catálogos_nuevos=${result.seed.masterCatalogsAdded}, ` +
          `razas_nuevas=${result.seed.breedsAdded}, estándares_nuevos=${result.seed.weightStandardsAdded}, ` +
          `vacunas_nuevas=${result.seed.vaccinationTemplatesCreated}, ` +
          `admin=${result.admin.reason}${result.admin.username ? `(${result.admin.username})` : ""}.`
      );
    })
    .catch((err) => {
      console.error("[db:bootstrap] Error inicializando base de datos:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
