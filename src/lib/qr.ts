const QR_PREFIX = "GALLINERO:";

/** Generate the QR payload for a hen */
export function generateQrPayload(henId: string): string {
  return `${QR_PREFIX}${henId}`;
}

/** Parse a QR payload and extract the henId, or null if invalid */
export function parseQrPayload(data: string): string | null {
  if (!data || !data.startsWith(QR_PREFIX)) return null;
  return data.slice(QR_PREFIX.length) || null;
}
