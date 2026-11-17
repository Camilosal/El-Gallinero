// Sesión efímera para canales no-navegador (Telegram, API v1 de herramientas, MCP).
//
// Inserta una sesión real de corta vida (15 min) del usuario delegante y la
// elimina al terminar, sin pasar por createSession para no rotar ni expulsar
// las sesiones activas del navegador (límite de 5 por usuario).

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";

export async function withEphemeralSession<T>(
  userId: string,
  farmId: string,
  fn: (cookie: string) => Promise<T>,
): Promise<T> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const [row] = await db
    .insert(sessions)
    .values({ userId, farmId, tokenHash, expiresAt: new Date(Date.now() + 15 * 60 * 1000) })
    .returning({ id: sessions.id });
  try {
    return await fn(`galli_session=${token}`);
  } finally {
    await db.delete(sessions).where(eq(sessions.id, row.id)).catch(() => undefined);
  }
}