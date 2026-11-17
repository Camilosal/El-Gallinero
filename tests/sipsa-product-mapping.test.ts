import { describe, expect, it } from "vitest";
import { getSipsaIProductMappingKey, parseSipsaIProductMappings } from "@/lib/external-sources/sipsa-product-mapping";

describe("equivalencias de productos SIPSA-I", () => {
  it("construye una clave estable sin distinguir tildes, mayúsculas o espacios", () => {
    expect(getSipsaIProductMappingKey({
      cpcCode: " 0114 ",
      article: "Concentrado PARA POSTURA",
      presentation: " Bulto de 40 kg ",
    })).toBe(getSipsaIProductMappingKey({
      cpcCode: "0114",
      article: "concentrado para postura",
      presentation: "bulto de 40 kg",
    }));
  });

  it("lee presentaciones importadas por CSV y descarta observaciones incompletas", () => {
    expect(getSipsaIProductMappingKey({ cpcCode: "0114", article: "Alimento", characteristics: "Bulto" })).toBeTruthy();
    expect(getSipsaIProductMappingKey({ cpcCode: "0114", article: "Alimento" })).toBeNull();
  });

  it("tolera ajustes guardados corruptos y solo conserva pares de texto acotados", () => {
    expect(parseSipsaIProductMappings("no es json")).toEqual({});
    expect(parseSipsaIProductMappings(JSON.stringify({
      "[\"0114\",\"alimento\",\"bulto\"]": "producto-1",
      ignoredNumber: 7,
      ["x".repeat(1001)]: "producto-2",
    }))).toEqual({ "[\"0114\",\"alimento\",\"bulto\"]": "producto-1" });
  });
});
