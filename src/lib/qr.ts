import { isValidFarmCodeFormat, normalizeFarmCode } from "./farm-code";

const LEGACY_QR_PREFIX = "GALLINERO:";
const LEGACY_LOC_PREFIX = "GALLINERO:LOC:";
const LEGACY_LOTE_PREFIX = "GALLINERO:LOTE:";
const LEGACY_ACTIVO_PREFIX = "GALLINERO:ACTIVO:";
const LEGACY_GALLINA_PREFIX = "GALLINERO:GALLINA:";

const COMPACT_LOC_PREFIX = "LOC:";
const COMPACT_LOTE_PREFIX = "LOTE:";
const COMPACT_ACTIVO_PREFIX = "ACT:";
const COMPACT_GALLINA_PREFIX = "AVE:";

const SCOPED_PREFIX = "IWG:";

export type QrEntityType = "gallina" | "ubicacion" | "lote" | "activo";

export interface ParsedQrTarget {
  type: QrEntityType;
  id: string;
  farmCode?: string;
  raw: string;
}

/** Generate compact entity token (`LOC:<id>`, `LOTE:<id>`, `ACT:<id>`, `AVE:<id>`). */
export function generateCompactEntityToken(type: QrEntityType, id: string): string {
  if (type === "ubicacion") return `${COMPACT_LOC_PREFIX}${id}`;
  if (type === "lote") return `${COMPACT_LOTE_PREFIX}${id}`;
  if (type === "activo") return `${COMPACT_ACTIVO_PREFIX}${id}`;
  return `${COMPACT_GALLINA_PREFIX}${id}`;
}

/** Generate an entity QR payload (scoped with `IWG:<farmCode>:<TYPE>:<id>` when farmCode is given, or compact `<TYPE>:<id>`). */
export function generateQrPayload(henId: string, farmCode?: string | null): string {
  return generateEntityQrPayload("gallina", henId, farmCode);
}

/** Generate typed QR payload for any farm entity. */
export function generateEntityQrPayload(
  type: QrEntityType,
  id: string,
  farmCode?: string | null,
): string {
  const token = generateCompactEntityToken(type, id);
  const normalizedFarmCode = normalizeFarmCode(farmCode);
  if (normalizedFarmCode && isValidFarmCodeFormat(normalizedFarmCode)) {
    return `${SCOPED_PREFIX}${normalizedFarmCode}:${token}`;
  }
  return token;
}

export interface GenerateQrUrlOptions {
  origin?: string;
  farmCode?: string | null;
}

/**
 * Build a native-camera scanner URL (`/escanear?f=7K4M2P&qr=ACT%3A<id>`)
 * so mobile cameras open the app directly with farm namespace context.
 */
export function generateEntityQrUrl(
  type: QrEntityType,
  id: string,
  originOrOptions: string | GenerateQrUrlOptions = "",
  farmCodeArg?: string | null,
): string {
  const origin =
    typeof originOrOptions === "string"
      ? originOrOptions
      : originOrOptions.origin || "";
  const rawFarmCode =
    typeof originOrOptions === "string"
      ? farmCodeArg
      : (originOrOptions.farmCode ?? farmCodeArg);
  const normalizedFarmCode = normalizeFarmCode(rawFarmCode);
  const params = new URLSearchParams();
  if (normalizedFarmCode) {
    params.set("f", normalizedFarmCode);
  }
  params.set("qr", generateCompactEntityToken(type, id));
  const path = `/escanear?${params.toString()}`;
  return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
}

function mapScopedKindToEntityType(kind: string): QrEntityType | null {
  const upper = kind.trim().toUpperCase();
  if (upper === "LOC" || upper === "UBICACION") return "ubicacion";
  if (upper === "LOTE") return "lote";
  if (upper === "ACT" || upper === "ACTIVO") return "activo";
  if (upper === "AVE" || upper === "GALLINA") return "gallina";
  return null;
}

/** Parse a QR payload or native-camera URL into its typed farm entity target and optional `farmCode`. */
export function parseQrTarget(rawData: string): ParsedQrTarget | null {
  const data = (rawData || "").trim();
  if (!data) return null;

  // Scoped payload format: IWG:<FARM_CODE>:<TYPE>:<id>
  if (data.toUpperCase().startsWith(SCOPED_PREFIX)) {
    const rest = data.slice(SCOPED_PREFIX.length);
    const firstSep = rest.indexOf(":");
    const secondSep = firstSep > 0 ? rest.indexOf(":", firstSep + 1) : -1;
    if (firstSep > 0 && secondSep > firstSep + 1) {
      const candidateFarmCode = normalizeFarmCode(rest.slice(0, firstSep));
      const kind = rest.slice(firstSep + 1, secondSep);
      const id = rest.slice(secondSep + 1).trim();
      const entityType = mapScopedKindToEntityType(kind);
      if (entityType && id) {
        return isValidFarmCodeFormat(candidateFarmCode)
          ? { type: entityType, id, farmCode: candidateFarmCode, raw: data }
          : { type: entityType, id, raw: data };
      }
    }
  }

  // New compact tokens
  if (data.startsWith(COMPACT_LOC_PREFIX)) {
    const id = data.slice(COMPACT_LOC_PREFIX.length).trim();
    return id ? { type: "ubicacion", id, raw: data } : null;
  }
  if (data.startsWith(COMPACT_LOTE_PREFIX)) {
    const id = data.slice(COMPACT_LOTE_PREFIX.length).trim();
    return id ? { type: "lote", id, raw: data } : null;
  }
  if (data.startsWith(COMPACT_ACTIVO_PREFIX)) {
    const id = data.slice(COMPACT_ACTIVO_PREFIX.length).trim();
    return id ? { type: "activo", id, raw: data } : null;
  }
  if (data.startsWith(COMPACT_GALLINA_PREFIX)) {
    const id = data.slice(COMPACT_GALLINA_PREFIX.length).trim();
    return id ? { type: "gallina", id, raw: data } : null;
  }

  // Legacy GALLINERO:* tokens (backward compatible)
  if (data.startsWith(LEGACY_LOC_PREFIX)) {
    const id = data.slice(LEGACY_LOC_PREFIX.length).trim();
    return id ? { type: "ubicacion", id, raw: data } : null;
  }
  if (data.startsWith(LEGACY_LOTE_PREFIX)) {
    const id = data.slice(LEGACY_LOTE_PREFIX.length).trim();
    return id ? { type: "lote", id, raw: data } : null;
  }
  if (data.startsWith(LEGACY_ACTIVO_PREFIX)) {
    const id = data.slice(LEGACY_ACTIVO_PREFIX.length).trim();
    return id ? { type: "activo", id, raw: data } : null;
  }
  if (data.startsWith(LEGACY_GALLINA_PREFIX)) {
    const id = data.slice(LEGACY_GALLINA_PREFIX.length).trim();
    return id ? { type: "gallina", id, raw: data } : null;
  }
  if (data.startsWith(LEGACY_QR_PREFIX)) {
    const id = data.slice(LEGACY_QR_PREFIX.length).trim();
    return id ? { type: "gallina", id, raw: data } : null;
  }

  // Handle native-camera URLs like https://app.iwage.co/escanear?f=7K4M2P&qr=ACT%3A<id>
  // or legacy /lote/<uuid>, /ubicaciones/<id>, /produccion/gallinas/<id>
  if (/^https?:\/\//i.test(data) || data.startsWith("/")) {
    try {
      const url = new URL(data, "https://gallinero.local");
      const rawFarmParam =
        url.searchParams.get("f") ||
        url.searchParams.get("granja") ||
        url.searchParams.get("farm") ||
        "";
      const normalizedFarmCode = normalizeFarmCode(rawFarmParam);
      const validFarmCode = isValidFarmCodeFormat(normalizedFarmCode)
        ? normalizedFarmCode
        : undefined;

      const qrParam = url.searchParams.get("qr");
      if (qrParam && qrParam !== data) {
        const inner = parseQrTarget(qrParam);
        if (!inner) return null;
        const resolvedFarmCode = inner.farmCode || validFarmCode;
        return resolvedFarmCode
          ? { type: inner.type, id: inner.id, farmCode: resolvedFarmCode, raw: data }
          : { type: inner.type, id: inner.id, raw: data };
      }

      const loteMatch = url.pathname.match(/\/lote\/([^/]+)/i);
      if (loteMatch?.[1]) {
        const base: ParsedQrTarget = { type: "lote", id: decodeURIComponent(loteMatch[1]), raw: data };
        return validFarmCode ? { ...base, farmCode: validFarmCode } : base;
      }
      const ubicacionMatch = url.pathname.match(/(?:\/dashboard)?\/ubicaciones\/([^/]+)/i);
      if (ubicacionMatch?.[1]) {
        const base: ParsedQrTarget = { type: "ubicacion", id: decodeURIComponent(ubicacionMatch[1]), raw: data };
        return validFarmCode ? { ...base, farmCode: validFarmCode } : base;
      }
      const gallinaMatch = url.pathname.match(/(?:\/dashboard)?\/produccion\/gallinas\/([^/]+)/i);
      if (gallinaMatch?.[1]) {
        const base: ParsedQrTarget = { type: "gallina", id: decodeURIComponent(gallinaMatch[1]), raw: data };
        return validFarmCode ? { ...base, farmCode: validFarmCode } : base;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/** Detecta un QR de acceso rápido a granja (`/login?granja=7K4M2P`). */
export function parseFarmLoginQr(rawData: string): string | null {
  const data = (rawData || "").trim();
  if (!data) return null;
  if (/^https?:\/\//i.test(data) || data.startsWith("/")) {
    try {
      const url = new URL(data, "https://gallinero.local");
      if (!/\/login$/i.test(url.pathname)) return null;
      const rawFarm = url.searchParams.get("granja") || url.searchParams.get("f") || "";
      const code = normalizeFarmCode(rawFarm);
      return isValidFarmCodeFormat(code) ? code : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Parse a legacy or compact QR payload and extract the henId, or null if invalid or non-hen */
export function parseQrPayload(data: string): string | null {
  const parsed = parseQrTarget(data);
  if (!parsed || parsed.type !== "gallina") return null;
  return parsed.id;
}
