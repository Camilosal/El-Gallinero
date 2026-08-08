import { scrypt, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const SESSION_COOKIE = "galli_session";
const SESSION_DAYS = 7;
const MAX_SESSIONS_PER_USER = 5;

// ─── Password hashing (scrypt) ───
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ─── Sessions ───
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  // Limit active sessions per user (rotate oldest)
  const active = await db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.createdAt));
  if (active.length >= MAX_SESSIONS_PER_USER) {
    const toDelete = active.slice(MAX_SESSIONS_PER_USER - 1).map((s) => s.id);
    for (const sid of toDelete) {
      await db.delete(sessions).where(eq(sessions.id, sid));
    }
  }

  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
  });

  return token;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [session] = await db
    .select({
      id: sessions.id,
      expiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!session) return null;
  return session.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
}

export const sessionCookieName = SESSION_COOKIE;
