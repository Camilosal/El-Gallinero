import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { sessions, users } from "./schema";
import { hashPassword } from "@/lib/auth";

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("Define ADMIN_USERNAME y ADMIN_PASSWORD para cambiar la clave del administrador.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  }

  await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

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
