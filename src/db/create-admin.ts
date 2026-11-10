import { db, pool } from "./index";
import { users } from "./schema";
import { hashPassword } from "@/lib/auth";
import { sql } from "drizzle-orm";

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("Define ADMIN_USERNAME y ADMIN_PASSWORD para crear el administrador inicial.");
  }
  const name = process.env.ADMIN_NAME?.trim() || username;
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`LOCK TABLE ${users} IN EXCLUSIVE MODE`);
    const [existingUser] = await tx.select({ id: users.id }).from(users).limit(1);
    if (existingUser) {
      throw new Error("Ya existe un usuario. Este comando solo crea el primer administrador y no cambia cuentas existentes.");
    }

    await tx.insert(users).values({
      username,
      passwordHash: await hashPassword(password),
      name,
      role: "admin",
    });
  });

  console.log(`Administrador inicial creado para el usuario "${username}".`);
}

main()
  .catch((error) => {
    console.error("No se pudo crear el administrador:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
