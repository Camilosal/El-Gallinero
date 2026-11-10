import { db } from "@/db";
import { sql } from "drizzle-orm";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockEggInventory(tx: DbTransaction): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(41827412)`);
}

export async function lockMeatInventory(tx: DbTransaction): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(41827413)`);
}
