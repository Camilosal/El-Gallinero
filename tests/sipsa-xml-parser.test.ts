import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSipsaCityPricesWithTimeout, parseSipsaCityPriceXml } from "@/lib/external-sources/snapshot-store";

afterEach(() => vi.unstubAllGlobals());

describe("DANE SIPSA SOAP response parser", () => {
  it("preserves product, city, capture date and average price", () => {
    const xml = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body>
      <ns2:promediosSipsaCiudadResponse xmlns:ns2="http://servicios.sipsa.co.gov.dane/"><return>
        <ciudad>Bogotá</ciudad><codProducto>12</codProducto><fechaCaptura>2026-11-16T00:00:00-05:00</fechaCaptura>
        <fechaCreacion>2026-11-16T14:00:00-05:00</fechaCreacion><precioPromedio>1250</precioPromedio>
        <producto>Huevo rojo</producto><regId>778899</regId>
      </return></ns2:promediosSipsaCiudadResponse></soap:Body></soap:Envelope>`;

    expect(parseSipsaCityPriceXml(xml)).toEqual([{
      city: "Bogotá",
      productCode: "12",
      capturedAt: "2026-11-16T00:00:00-05:00",
      createdAt: "2026-11-16T14:00:00-05:00",
      averagePriceCop: 1250,
      product: "Huevo rojo",
      recordId: "778899",
    }]);
  });

  it("rejects SOAP bodies that contain no usable observations", () => {
    const xml = "<soap:Envelope xmlns:soap=\"http://www.w3.org/2003/05/soap-envelope\"><soap:Body/></soap:Envelope>";
    expect(() => parseSipsaCityPriceXml(xml)).toThrow("no contiene observaciones");
  });

  it("surfaces SOAP faults as connector errors", () => {
    const xml = "<soap:Envelope xmlns:soap=\"http://www.w3.org/2003/05/soap-envelope\"><soap:Body><soap:Fault/></soap:Body></soap:Envelope>";
    expect(() => parseSipsaCityPriceXml(xml)).toThrow("error SOAP");
  });

  it("rejects oversized responses before loading the entire SOAP body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", {
      headers: { "content-length": "12000001" },
    })));

    const result = await fetchSipsaCityPricesWithTimeout("https://dane.example/sipsa");

    expect(result).toEqual({ ok: false, error: "Respuesta SIPSA supera el tamaño máximo permitido" });
  });

  it("stops streaming as soon as a response exceeds the body limit", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(12_000_001));
      },
      cancel,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));

    const result = await fetchSipsaCityPricesWithTimeout("https://dane.example/sipsa");

    expect(result).toEqual({ ok: false, error: "Respuesta SIPSA supera el tamaño máximo permitido" });
    expect(cancel).toHaveBeenCalled();
  });
});
