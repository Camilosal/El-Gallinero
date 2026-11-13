import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { getCurrentFarmId, hasActiveFarmContext } from "./tenant-context";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const TENANT_PATCHED = Symbol.for("gallinero.pool.tenantPatched");

type PatchedPool = Pool & { [TENANT_PATCHED]?: boolean };

function instrumentPoolForRls(targetPool: PatchedPool): PatchedPool {
  if (targetPool[TENANT_PATCHED]) return targetPool;
  targetPool[TENANT_PATCHED] = true;

  const rawConnect = targetPool.connect.bind(targetPool) as (...args: any[]) => any;
  const rawQuery = targetPool.query.bind(targetPool) as (...args: any[]) => Promise<any>;

  const applyTenantToClient = async (client: PoolClient, farmId: string) => {
    await client.query("SELECT set_config('app.current_farm_id', $1, false)", [farmId]);
    await client.query("SET ROLE gallinero_tenant_role");

    const rawRelease = client.release.bind(client);
    let released = false;
    client.release = ((err?: Error | boolean) => {
      if (released) return;
      released = true;
      if (err) {
        rawRelease(err);
        return;
      }
      client
        .query("RESET ROLE; SELECT set_config('app.current_farm_id', '', false);")
        .then(() => rawRelease())
        .catch((resetErr) => rawRelease(resetErr));
    }) as typeof client.release;
  };

  const connectWithTenant = async (): Promise<PoolClient> => {
    const client: PoolClient = await rawConnect();
    if (!hasActiveFarmContext()) {
      return client;
    }

    const farmId = getCurrentFarmId();
    try {
      await applyTenantToClient(client, farmId);
    } catch (err) {
      client.release(err instanceof Error ? err : true);
      throw err;
    }
    return client;
  };

  targetPool.connect = ((cb?: any) => {
    // Mantener firma callback usada internamente por pg.Pool.prototype.query
    if (typeof cb === "function") {
      return rawConnect(cb);
    }
    return connectWithTenant();
  }) as unknown as typeof targetPool.connect;

  targetPool.query = (async (...args: any[]) => {
    if (!hasActiveFarmContext()) {
      return rawQuery(...args);
    }
    const client = await connectWithTenant();
    try {
      return await (client.query as (...qArgs: any[]) => Promise<any>)(...args);
    } finally {
      client.release();
    }
  }) as unknown as typeof targetPool.query;

  return targetPool;
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: PatchedPool;
};

export const pool = instrumentPoolForRls(
  globalForDb.__arenaNextJsPostgresqlPool ??
  (new Pool({
    connectionString: databaseUrl,
  }) as PatchedPool),
);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
