import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { farms } from "@/db/schema";
import {
  generateFarmCodeCandidate,
  isUuidString,
  isValidFarmCode,
  normalizeFarmCode,
} from "./farm-code";

export * from "./farm-code";

type FarmQueryExecutor = Pick<typeof db, "select">;

/**
 * Genera un Código Corto Mod-31 único contra la tabla `farms` dentro de la
 * transacción o conexión recibida.
 */
export async function generateUniqueFarmCode(executor: FarmQueryExecutor = db): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = generateFarmCodeCandidate();
    const [existing] = await executor
      .select({ id: farms.id })
      .from(farms)
      .where(eq(farms.code, candidate))
      .limit(1);
    if (!existing) {
      return candidate;
    }
  }
  throw new Error("No se pudo asignar un código corto único para la granja tras múltiples intentos.");
}

/** Resuelve una granja a partir de su código corto Mod-31 (`7K4M2P`) o su UUID interno. */
export async function resolveFarmByCodeOrId(rawIdentifier: unknown, executor: FarmQueryExecutor = db) {
  if (typeof rawIdentifier !== "string") return null;
  const trimmed = rawIdentifier.trim();
  if (!trimmed) return null;

  if (isUuidString(trimmed)) {
    const [farm] = await executor
      .select({
        id: farms.id,
        code: farms.code,
        slug: farms.slug,
        name: farms.name,
        deploymentMode: farms.deploymentMode,
        planCode: farms.planCode,
      })
      .from(farms)
      .where(eq(farms.id, trimmed.toLowerCase()))
      .limit(1);
    return farm || null;
  }

  const normalized = normalizeFarmCode(trimmed);
  if (!isValidFarmCode(normalized)) return null;

  const [farm] = await executor
    .select({
      id: farms.id,
      code: farms.code,
      slug: farms.slug,
      name: farms.name,
      deploymentMode: farms.deploymentMode,
      planCode: farms.planCode,
    })
    .from(farms)
    .where(eq(farms.code, normalized))
    .limit(1);
  return farm || null;
}

/** Resume hash SHA-256 hex para almacenar credenciales IoT sin guardar secretos planos. */
export function hashSensorToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

/** Genera un nuevo token de ingesta IoT para una granja (`iwg_iot_...`). */
export function generateSensorIngestToken(): {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const rawToken = `iwg_iot_${crypto.randomBytes(24).toString("base64url")}`;
  return {
    rawToken,
    tokenHash: hashSensorToken(rawToken),
    tokenPrefix: rawToken.slice(0, 14),
  };
}

/** Compara en tiempo constante el token enviado por hardware contra `farms.sensor_token_hash`. */
export function verifySensorIngestToken(
  rawToken: string,
  expectedHash: string | null | undefined,
): boolean {
  const trimmed = rawToken.trim();
  if (!trimmed || !expectedHash) return false;
  const providedHash = hashSensorToken(trimmed);
  if (providedHash.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(providedHash, "utf8"),
    Buffer.from(expectedHash, "utf8"),
  );
}
