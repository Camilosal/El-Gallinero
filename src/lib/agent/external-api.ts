// D1: soporte del canal externo (API v1 de herramientas del agente y MCP).
//
// - Rate limit por token: 60 solicitudes/minuto (mismo patrón en memoria del
//   canal Telegram; suficiente para una sola instancia de despliegue).
// - Auth de integración para confirmar/cancelar acciones pendientes: el token
//   debe tener agent:write y usuario delegante vigente en su granja. La
//   ejecución usa una sesión efímera de ESE usuario (nunca superusuario).

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import {
  hasIntegrationScope,
  readExportTokenFromRequest,
  resolveExportToken,
} from "@/lib/export/auth";
import { withEphemeralSession } from "./ephemeral-session";

export const EXTERNAL_RATE_LIMIT_PER_MINUTE = 60;

const rateBuckets = new Map<string, { count: number; windowStart: number }>();

/** true si la solicitud cabe en el cupo; false si excedió 60 req/min. */
export function checkExternalRateLimit(bucketKey: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(bucketKey);
  if (!bucket || now - bucket.windowStart >= 60_000) {
    rateBuckets.set(bucketKey, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= EXTERNAL_RATE_LIMIT_PER_MINUTE) return false;
  bucket.count += 1;
  return true;
}

export function __resetExternalRateLimitsForTests() {
  rateBuckets.clear();
}

export interface ExternalDelegatingUser {
  id: string;
  username: string;
  name: string | null;
  role: string;
  farmId: string;
  tokenId: string;
}

/**
 * Resuelve el token de integración de la solicitud y entra al contexto de su
 * granja con una sesión efímera del usuario delegante. Cubre 401 (token
 * inválido/revocado/expirado), 403 (sin agent:write, sin usuario delegante o
 * usuario eliminado) y 429 (rate limit).
 */
export async function withExternalAgentAuth(
  req: Request,
  handler: (user: ExternalDelegatingUser, cookie: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  const rawToken = readExportTokenFromRequest(req);
  const resolved = await resolveExportToken(rawToken);
  if (!resolved) {
    return NextResponse.json(
      { error: "Token de integración inválido, expirado o revocado" },
      { status: 401 },
    );
  }
  if (!hasIntegrationScope(resolved.scopes, "agent:write")) {
    return NextResponse.json(
      { error: "El token necesita el alcance agent:write para confirmar o cancelar acciones" },
      { status: 403 },
    );
  }
  if (!checkExternalRateLimit(resolved.tokenId)) {
    return NextResponse.json(
      { error: `Límite de ${EXTERNAL_RATE_LIMIT_PER_MINUTE} solicitudes por minuto excedido. Intenta en un minuto.` },
      { status: 429 },
    );
  }
  if (!resolved.userId) {
    return NextResponse.json(
      { error: "El token no tiene usuario delegante. Genera uno nuevo desde /exportar?tab=conectores." },
      { status: 403 },
    );
  }

  return runWithFarmContext(resolved.farmId, async () => {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, resolved.userId!), eq(users.farmId, resolved.farmId)))
      .limit(1);
    if (!user) {
      return NextResponse.json(
        { error: "El usuario delegante del token ya no existe en esta granja" },
        { status: 403 },
      );
    }
    return withEphemeralSession(user.id, resolved.farmId, (cookie) =>
      handler(
        {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          farmId: resolved.farmId,
          tokenId: resolved.tokenId,
        },
        cookie,
      ),
    );
  });
}