import { describe, expect, it } from "vitest";
import {
  generateEntityQrPayload,
  generateEntityQrUrl,
  generateQrPayload,
  parseQrPayload,
  parseQrTarget,
} from "@/lib/qr";

describe("QR multi-entidad de granja", () => {
  it("mantiene compatibilidad hacia atrás con QR de gallinas", () => {
    const payload = generateQrPayload("hen-uuid-123");
    expect(payload).toBe("GALLINERO:hen-uuid-123");
    expect(parseQrPayload(payload)).toBe("hen-uuid-123");
    expect(parseQrTarget(payload)).toEqual({
      type: "gallina",
      id: "hen-uuid-123",
      raw: "GALLINERO:hen-uuid-123",
    });
  });

  it("genera e interpreta QR de ubicaciones, lotes y activos sin confundirlos con gallinas", () => {
    const loc = generateEntityQrPayload("ubicacion", "loc-1");
    const lote = generateEntityQrPayload("lote", "lote-2");
    const activo = generateEntityQrPayload("activo", "act-3");

    expect(parseQrTarget(loc)).toEqual({ type: "ubicacion", id: "loc-1", raw: loc });
    expect(parseQrTarget(lote)).toEqual({ type: "lote", id: "lote-2", raw: lote });
    expect(parseQrTarget(activo)).toEqual({ type: "activo", id: "act-3", raw: activo });

    // parseQrPayload legado solo debe aceptar gallinas
    expect(parseQrPayload(loc)).toBeNull();
    expect(parseQrPayload(lote)).toBeNull();
    expect(parseQrPayload(activo)).toBeNull();
  });

  it("interpreta URLs de escáner (?qr=...) y rutas de trazabilidad /lote/<id>", () => {
    const deepUrl = generateEntityQrUrl("ubicacion", "galpon-norte", "https://mi-granja.local");
    expect(deepUrl).toBe("https://mi-granja.local/dashboard/escanear?qr=GALLINERO%3ALOC%3Agalpon-norte");
    expect(parseQrTarget(deepUrl)).toEqual({
      type: "ubicacion",
      id: "galpon-norte",
      raw: "GALLINERO:LOC:galpon-norte",
    });

    expect(parseQrTarget("https://mi-granja.local/lote/abc-123-def")).toEqual({
      type: "lote",
      id: "abc-123-def",
      raw: "https://mi-granja.local/lote/abc-123-def",
    });

    expect(parseQrTarget("")).toBeNull();
    expect(parseQrTarget("OTRO:123")).toBeNull();
  });
});
