import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "./index";
import { sessions, users } from "./schema";
import { hashPassword } from "@/lib/auth";
import { resolveFarmByCodeOrId } from "@/lib/farm-code.server";

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const farmIdentifier = process.env.FARM_CODE?.trim() || process.env.ADMIN_FARM_CODE?.trim();

  if (!username || !password) {
    throw new Error("Define ADMIN_USERNAME y ADMIN_PASSWORD para cambiar la clave del administrador.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  }

  await db.transaction(async (tx) => {
    let farmFilterId: string | null = null;
    if (farmIdentifier) {
      const farm = await resolveFarmByCodeOrId(farmIdentifier, tx);
      if (!farm) {
        throw new Error(`No existe una granja con código o ID "${farmIdentifier}".`);
      }
      farmFilterId = farm.id;
    }

    const matches = await tx
      .select({ id: users.id, role: users.role, farmId: users.farmId })
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
    if (!user || user.role !== "admin") {
      throw new Error("No existe un administrador con ese nombre de usuario.");
    }

    await tx.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });

  console.log(`Clave actualizada y sesiones revocadas para "${username}".`);
}

main()
  .catch((error) => {
    console.error("No se pudo actualizar la clave:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
