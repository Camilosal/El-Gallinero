// Autenticación de exportaciones para dashboards externos.
//
// Dos caminos válidos:
//   1. Cookie de sesión `galli_session` (personas desde el navegador).
//   2. Token de solo lectura `glli_exp_...` (sistemas externos).
//
// Los tokens se guardan como SHA-256 y viven en `export_tokens`, una tabla sin
// RLS porque el token debe resolver la granja ANTES de abrir el contexto
// tenant. Por eso toda consulta a esa tabla filtra `farm_id` explícitamente.

import crypto from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentFarmId } from "@/db/tenant-context";
import { exportTokens } from "@/db/schema";

export const EXPORT_TOKEN_PREFIX = "glli_exp_";
export const EXPORT_TOKEN_HEADER = "x-export-token";

export interface ExportTokenSummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface IssuedExportToken extends ExportTokenSummary {
  token: string;
}

export function hashExportToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function looksLikeExportToken(value: string): boolean {
  if (!value.startsWith(EXPORT_TOKEN_PREFIX)) return false;
  const secret = value.slice(EXPORT_TOKEN_PREFIX.length);
  return secret.length >= 20 && secret.length <= 80 && /^[A-Za-z0-9_-]+$/.test(secret);
}

export async function listExportTokens(): Promise<ExportTokenSummary[]> {
  const rows = await db
    .select()
    .from(exportTokens)
    .where(and(eq(exportTokens.farmId, getCurrentFarmId()), isNull(exportTokens.revokedAt)))
    .orderBy(desc(exportTokens.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.tokenPrefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  }));
}

export async function issueExportToken(options: {
  createdBy?: string | null;
  name?: string | null;
}): Promise<IssuedExportToken> {
  const farmId = getCurrentFarmId();
  const secret = crypto.randomBytes(24).toString("base64url");
  const token = `${EXPORT_TOKEN_PREFIX}${secret}`;
  const tokenHash = hashExportToken(token);
  const tokenPrefix = token.slice(0, EXPORT_TOKEN_PREFIX.length + 6);
  const name = (options.name || "Dashboard externo").trim().slice(0, 120) || "Dashboard externo";

  // Un solo token activo por granja: rotar es revocar + emitir.
  await db
    .update(exportTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(exportTokens.farmId, farmId), isNull(exportTokens.revokedAt)));

  const [created] = await db
    .insert(exportTokens)
    .values({
      farmId,
      name,
      tokenHash,
      tokenPrefix,
      createdBy: options.createdBy ?? null,
    })
    .returning();

  return {
    id: created.id,
    name: created.name,
    prefix: created.tokenPrefix,
    createdAt: created.createdAt.toISOString(),
    lastUsedAt: null,
    token,
  };
}

export async function revokeExportTokens(): Promise<number> {
  const revoked = await db
    .update(exportTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(exportTokens.farmId, getCurrentFarmId()), isNull(exportTokens.revokedAt)))
    .returning({ id: exportTokens.id });
  return revoked.length;
}

export async function resolveExportToken(token: string): Promise<{ farmId: string; tokenId: string } | null> {
  const clean = token.trim();
  if (!looksLikeExportToken(clean)) return null;

  const [row] = await db
    .select({ id: exportTokens.id, farmId: exportTokens.farmId })
    .from(exportTokens)
    .where(and(eq(exportTokens.tokenHash, hashExportToken(clean)), isNull(exportTokens.revokedAt)))
    .limit(1);

  if (!row) return null;

  // Marcar uso sin bloquear la descarga.
  db.update(exportTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(exportTokens.id, row.id))
    .catch((error) => console.warn("No se pudo registrar el uso del token de exportación:", error));

  return { farmId: row.farmId, tokenId: row.id };
}

/** Extrae el token del header `X-Export-Token` o de `Authorization: Bearer`. */
export function readExportTokenFromRequest(req: Request): string {
  const headerToken = req.headers.get(EXPORT_TOKEN_HEADER)?.trim();
  if (headerToken) return headerToken;

  const authorization = req.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}
