import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { users } from "./schema";

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim();
  if (!username) throw new Error("Define ADMIN_USERNAME para emitir un código de recuperación.");

  const code = randomBytes(32).toString("base64url");
  const recoveryCodeHash = createHash("sha256").update(code).digest("hex");
  const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.username, username)).limit(1);
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
