import { describe, expect, it } from "vitest";
import {
  generateEntityQrPayload,
  generateEntityQrUrl,
  generateQrPayload,
  parseFarmLoginQr,
  parseQrPayload,
  parseQrTarget,
} from "@/lib/qr";

describe("QR multi-entidad de granja con URL nativa y namespace", () => {
  it("genera payloads compactos con o sin Código Corto y mantiene compatibilidad con QR legados", () => {
    const compactHen = generateQrPayload("hen-uuid-123");
    expect(compactHen).toBe("AVE:hen-uuid-123");
    expect(parseQrPayload(compactHen)).toBe("hen-uuid-123");
    expect(parseQrTarget(compactHen)).toEqual({
      type: "gallina",
      id: "hen-uuid-123",
      raw: "AVE:hen-uuid-123",
    });

    const scopedHen = generateQrPayload("hen-uuid-123", "7K4M2X");
    expect(scopedHen).toBe("IWG:7K4M2X:AVE:hen-uuid-123");
    expect(parseQrTarget(scopedHen)).toEqual({
      type: "gallina",
      id: "hen-uuid-123",
      farmCode: "7K4M2X",
      raw: "IWG:7K4M2X:AVE:hen-uuid-123",
    });

    // Compatibilidad hacia atrás con etiquetas GALLINERO:* antiguas
    expect(parseQrPayload("GALLINERO:hen-uuid-123")).toBe("hen-uuid-123");
    expect(parseQrTarget("GALLINERO:LOC:loc-old")).toEqual({
      type: "ubicacion",
      id: "loc-old",
      raw: "GALLINERO:LOC:loc-old",
    });
  });

  it("genera e interpreta QR de ubicaciones, lotes y activos con farmCode sin confundirlos con gallinas", () => {
    const loc = generateEntityQrPayload("ubicacion", "loc-1", "7K4M2X");
    const lote = generateEntityQrPayload("lote", "lote-2", "7K4M2X");
    const activo = generateEntityQrPayload("activo", "act-3", "7K4M2X");

    expect(loc).toBe("IWG:7K4M2X:LOC:loc-1");
    expect(lote).toBe("IWG:7K4M2X:LOTE:lote-2");
    expect(activo).toBe("IWG:7K4M2X:ACT:act-3");

    expect(parseQrTarget(loc)).toEqual({
      type: "ubicacion",
      id: "loc-1",
      farmCode: "7K4M2X",
      raw: loc,
    });
    expect(parseQrTarget(lote)).toEqual({
      type: "lote",
      id: "lote-2",
      farmCode: "7K4M2X",
      raw: lote,
    });
    expect(parseQrTarget(activo)).toEqual({
      type: "activo",
      id: "act-3",
      farmCode: "7K4M2X",
      raw: activo,
    });

    // parseQrPayload legado solo debe aceptar gallinas
    expect(parseQrPayload(loc)).toBeNull();
    expect(parseQrPayload(lote)).toBeNull();
    expect(parseQrPayload(activo)).toBeNull();
  });

  it("genera e interpreta URLs nativas de cámara (/escanear?f=7K4M2X&qr=...) y rutas de trazabilidad", () => {
    const deepUrl = generateEntityQrUrl("ubicacion", "galpon-norte", {
      origin: "https://mi-granja.local",
      farmCode: "7K4M2X",
    });
    expect(deepUrl).toBe(
      "https://mi-granja.local/escanear?f=7K4M2X&qr=LOC%3Agalpon-norte",
    );
    expect(parseQrTarget(deepUrl)).toEqual({
      type: "ubicacion",
      id: "galpon-norte",
      farmCode: "7K4M2X",
      raw: deepUrl,
    });

    expect(parseQrTarget("https://mi-granja.local/lote/abc-123-def")).toEqual({
      type: "lote",
      id: "abc-123-def",
      raw: "https://mi-granja.local/lote/abc-123-def",
    });

    expect(parseQrTarget("https://mi-granja.local/ubicaciones/loc-7")).toEqual({
      type: "ubicacion",
      id: "loc-7",
      raw: "https://mi-granja.local/ubicaciones/loc-7",
    });

    expect(parseQrTarget("https://mi-granja.local/dashboard/ubicaciones/loc-9")).toEqual({
      type: "ubicacion",
      id: "loc-9",
      raw: "https://mi-granja.local/dashboard/ubicaciones/loc-9",
    });

    expect(parseFarmLoginQr("https://app.iwage.co/login?granja=7k4m2x")).toBe("7K4M2X");
    expect(parseFarmLoginQr("https://app.iwage.co/escanear?f=7K4M2X&qr=LOC%3A1")).toBeNull();
    expect(parseQrTarget("")).toBeNull();
    expect(parseQrTarget("OTRO:123")).toBeNull();
  });
});
