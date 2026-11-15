// Autenticación de exportaciones y conectores ERP/API para sistemas externos.
//
// Dos caminos válidos:
//   1. Cookie de sesión `galli_session` (personas desde el navegador).
//   2. Token de solo lectura `glli_exp_...` (sistemas externos: SIIGO, Alegra, Odoo, Zoho, Power BI, n8n).
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

export const INTEGRATION_SCOPES = [
  "read:finance",
  "read:inventory",
  "read:contacts",
  "read:production",
] as const;
export type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

export const ERP_PROFILES = ["generic", "siigo", "alegra", "odoo", "zoho"] as const;
export type ErpProfile = (typeof ERP_PROFILES)[number];

export interface ExportTokenSummary {
  id: string;
  name: string;
  prefix: string;
  scopes: IntegrationScope[];
  profile: ErpProfile;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface IssuedExportToken extends ExportTokenSummary {
  token: string;
}

export interface ResolvedExportToken {
  farmId: string;
  tokenId: string;
  scopes: IntegrationScope[];
  profile: ErpProfile;
  expiresAt: string | null;
}

export function normalizeTokenScopes(input: unknown): IntegrationScope[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [...INTEGRATION_SCOPES];
  }
  const valid = input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is IntegrationScope =>
      (INTEGRATION_SCOPES as readonly string[]).includes(item),
    );
  return valid.length > 0 ? Array.from(new Set(valid)) : [...INTEGRATION_SCOPES];
}

export function normalizeErpProfile(input: unknown): ErpProfile {
  const clean = typeof input === "string" ? input.trim().toLowerCase() : "";
  if ((ERP_PROFILES as readonly string[]).includes(clean)) {
    return clean as ErpProfile;
  }
  return "generic";
}

export function hasIntegrationScope(
  grantedScopes: readonly string[],
  requiredScope: IntegrationScope,
): boolean {
  return grantedScopes.includes(requiredScope);
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
    scopes: normalizeTokenScopes(row.scopes),
    profile: normalizeErpProfile(row.profile),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  }));
}

export async function issueExportToken(options: {
  createdBy?: string | null;
  name?: string | null;
  scopes?: IntegrationScope[] | string[];
  profile?: ErpProfile | string | null;
  expiresAt?: Date | string | null;
  replacePrevious?: boolean;
}): Promise<IssuedExportToken> {
  const farmId = getCurrentFarmId();
  const secret = crypto.randomBytes(24).toString("base64url");
  const token = `${EXPORT_TOKEN_PREFIX}${secret}`;
  const tokenHash = hashExportToken(token);
  const tokenPrefix = token.slice(0, EXPORT_TOKEN_PREFIX.length + 6);
  const name = (options.name || "Dashboard externo").trim().slice(0, 120) || "Dashboard externo";
  const scopes = normalizeTokenScopes(options.scopes);
  const profile = normalizeErpProfile(options.profile);

  let expiresAt: Date | null = null;
  if (options.expiresAt instanceof Date && !Number.isNaN(options.expiresAt.getTime())) {
    expiresAt = options.expiresAt;
  } else if (typeof options.expiresAt === "string" && options.expiresAt.trim()) {
    const parsed = new Date(options.expiresAt);
    if (!Number.isNaN(parsed.getTime())) {
      expiresAt = parsed;
    }
  }

  // Por defecto mantiene el comportamiento de un único token activo (rotar = revocar + emitir),
  // salvo que el usuario cree un conector adicional explícitamente con `replacePrevious: false`.
  if (options.replacePrevious !== false) {
    await db
      .update(exportTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(exportTokens.farmId, farmId), isNull(exportTokens.revokedAt)));
  }

  const [created] = await db
    .insert(exportTokens)
    .values({
      farmId,
      name,
      tokenHash,
      tokenPrefix,
      scopes,
      profile,
      expiresAt,
      createdBy: options.createdBy ?? null,
    })
    .returning();

  return {
    id: created.id,
    name: created.name,
    prefix: created.tokenPrefix,
    scopes: normalizeTokenScopes(created.scopes),
    profile: normalizeErpProfile(created.profile),
    expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
    createdAt: created.createdAt.toISOString(),
    lastUsedAt: null,
    token,
  };
}

export async function revokeExportTokens(tokenId?: string): Promise<number> {
  const filters = [eq(exportTokens.farmId, getCurrentFarmId()), isNull(exportTokens.revokedAt)];
  if (tokenId) {
    filters.push(eq(exportTokens.id, tokenId));
  }
  const revoked = await db
    .update(exportTokens)
    .set({ revokedAt: new Date() })
    .where(and(...filters))
    .returning({ id: exportTokens.id });
  return revoked.length;
}

export async function resolveExportToken(token: string): Promise<ResolvedExportToken | null> {
  const clean = token.trim();
  if (!looksLikeExportToken(clean)) return null;

  const [row] = await db
    .select({
      id: exportTokens.id,
      farmId: exportTokens.farmId,
      scopes: exportTokens.scopes,
      profile: exportTokens.profile,
      expiresAt: exportTokens.expiresAt,
    })
    .from(exportTokens)
    .where(and(eq(exportTokens.tokenHash, hashExportToken(clean)), isNull(exportTokens.revokedAt)))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  // Marcar uso sin bloquear la descarga.
  db.update(exportTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(exportTokens.id, row.id))
    .catch((error) => console.warn("No se pudo registrar el uso del token de exportación:", error));

  return {
    farmId: row.farmId,
    tokenId: row.id,
    scopes: normalizeTokenScopes(row.scopes),
    profile: normalizeErpProfile(row.profile),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}

/** Extrae el token del header `X-Export-Token` o de `Authorization: Bearer`. */
export function readExportTokenFromRequest(req: Request): string {
  const headerToken = req.headers.get(EXPORT_TOKEN_HEADER)?.trim();
  if (headerToken) return headerToken;

  const authorization = req.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}
