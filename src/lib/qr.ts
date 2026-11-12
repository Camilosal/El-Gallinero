const QR_PREFIX = "GALLINERO:";
const LOC_PREFIX = "GALLINERO:LOC:";
const LOTE_PREFIX = "GALLINERO:LOTE:";
const ACTIVO_PREFIX = "GALLINERO:ACTIVO:";
const GALLINA_PREFIX = "GALLINERO:GALLINA:";

export type QrEntityType = "gallina" | "ubicacion" | "lote" | "activo";

export interface ParsedQrTarget {
  type: QrEntityType;
  id: string;
  raw: string;
}

/** Generate the legacy QR payload for a hen */
export function generateQrPayload(henId: string): string {
  return `${QR_PREFIX}${henId}`;
}

/** Generate the typed QR payload for any farm entity */
export function generateEntityQrPayload(type: QrEntityType, id: string): string {
  if (type === "ubicacion") return `${LOC_PREFIX}${id}`;
  if (type === "lote") return `${LOTE_PREFIX}${id}`;
  if (type === "activo") return `${ACTIVO_PREFIX}${id}`;
  return generateQrPayload(id);
}

/** Build an in-app scanner deep-link URL for a farm entity */
export function generateEntityQrUrl(type: QrEntityType, id: string, origin = ""): string {
  const payload = generateEntityQrPayload(type, id);
  const path = `/dashboard/escanear?qr=${encodeURIComponent(payload)}`;
  return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
}

/** Parse a QR payload or URL into its typed farm entity target */
export function parseQrTarget(rawData: string): ParsedQrTarget | null {
  const data = (rawData || "").trim();
  if (!data) return null;

  if (data.startsWith(LOC_PREFIX)) {
    const id = data.slice(LOC_PREFIX.length).trim();
    return id ? { type: "ubicacion", id, raw: data } : null;
  }
  if (data.startsWith(LOTE_PREFIX)) {
    const id = data.slice(LOTE_PREFIX.length).trim();
    return id ? { type: "lote", id, raw: data } : null;
  }
  if (data.startsWith(ACTIVO_PREFIX)) {
    const id = data.slice(ACTIVO_PREFIX.length).trim();
    return id ? { type: "activo", id, raw: data } : null;
  }
  if (data.startsWith(GALLINA_PREFIX)) {
    const id = data.slice(GALLINA_PREFIX.length).trim();
    return id ? { type: "gallina", id, raw: data } : null;
  }
  if (data.startsWith(QR_PREFIX)) {
    const id = data.slice(QR_PREFIX.length).trim();
    return id ? { type: "gallina", id, raw: data } : null;
  }

  // Handle URLs like https://.../dashboard/escanear?qr=GALLINERO:LOC:... or https://.../lote/<uuid>
  if (/^https?:\/\//i.test(data) || data.startsWith("/")) {
    try {
      const url = new URL(data, "https://gallinero.local");
      const qrParam = url.searchParams.get("qr");
      if (qrParam && qrParam !== data) {
        return parseQrTarget(qrParam);
      }
      const loteMatch = url.pathname.match(/\/lote\/([^/]+)/i);
      if (loteMatch?.[1]) {
        return { type: "lote", id: decodeURIComponent(loteMatch[1]), raw: data };
      }
      const ubicacionMatch = url.pathname.match(/\/dashboard\/ubicaciones\/([^/]+)/i);
      if (ubicacionMatch?.[1]) {
        return { type: "ubicacion", id: decodeURIComponent(ubicacionMatch[1]), raw: data };
      }
      const gallinaMatch = url.pathname.match(/\/dashboard\/produccion\/gallinas\/([^/]+)/i);
      if (gallinaMatch?.[1]) {
        return { type: "gallina", id: decodeURIComponent(gallinaMatch[1]), raw: data };
      }
    } catch {
      return null;
    }
  }

  return null;
}

/** Parse a legacy QR payload and extract the henId, or null if invalid or non-hen */
export function parseQrPayload(data: string): string | null {
  const parsed = parseQrTarget(data);
  if (!parsed || parsed.type !== "gallina") return null;
  return parsed.id;
}
