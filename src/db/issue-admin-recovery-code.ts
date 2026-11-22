import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "./index";
import { users } from "./schema";
import { resolveFarmByCodeOrId } from "@/lib/farm-code.server";

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const farmIdentifier = process.env.FARM_CODE?.trim() || process.env.ADMIN_FARM_CODE?.trim();
  if (!username) throw new Error("Define ADMIN_USERNAME para emitir un código de recuperación.");

  let farmFilterId: string | null = null;
  if (farmIdentifier) {
    const farm = await resolveFarmByCodeOrId(farmIdentifier);
    if (!farm) throw new Error(`No existe una granja con código o ID "${farmIdentifier}".`);
    farmFilterId = farm.id;
  }

  const code = randomBytes(32).toString("base64url");
  const recoveryCodeHash = createHash("sha256").update(code).digest("hex");
  const matches = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(
      farmFilterId
        ? and(eq(users.farmId, farmFilterId), sql`lower(${users.username}) = ${username}`)
        : sql`lower(${users.username}) = ${username}`,
    )
    .limit(2);
  if (matches.length > 1) {
    throw new Error("Hay más de una cuenta con ese usuario. Define FARM_CODE (ej. 7K4M2P) para identificar la granja.");
  }
  const [user] = matches;
  if (!user || user.role !== "admin") throw new Error("No existe un administrador con ese nombre de usuario.");

  await db.update(users).set({ recoveryCodeHash, recoveryCodeIssuedAt: new Date() }).where(eq(users.id, user.id));
  console.log("Código de recuperación de un solo uso, válido por 30 días (guárdalo en un lugar seguro; no se volverá a mostrar):");
  console.log(code);
}

main()
  .catch((error) => {
    console.error("No se pudo emitir el código:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => { await pool.end(); });
