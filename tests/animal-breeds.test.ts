import { describe, expect, it } from "vitest";
import {
  canonicalBreedType,
  getBreedsForSpecies,
  normalizeManagedSpecies,
  speciesForAcquisitionType,
} from "@/lib/animal-breeds";

describe("clasificador de razas por especie", () => {
  it("muestra sólo las razas asociadas a la especie seleccionada", () => {
    const catalog = [
      { value: "Leghorn", tipo: "gallina" },
      { value: "Coturnix de catálogo", tipo: "codorniz" },
      { value: "Pato de catálogo", tipo: "pato" },
    ];

    const duckBreeds = getBreedsForSpecies(catalog, "pato");

    expect(duckBreeds).toContain("Pato de catálogo");
    expect(duckBreeds).not.toContain("Leghorn");
    expect(duckBreeds).not.toContain("Coturnix de catálogo");
  });

  it("clasifica razas antiguas sin especie usando sus alias conocidos", () => {
    const catalog = [
      { value: "Pato Muscovy / Criollo", tipo: null },
      { value: "Leghorn", tipo: null },
    ];

    expect(getBreedsForSpecies(catalog, "pato")).toContain("Pato Muscovy / Criollo");
    expect(getBreedsForSpecies(catalog, "pato")).not.toContain("Leghorn");
    expect(canonicalBreedType("Pato Muscovy / Criollo")).toBe("pato");
  });

  it("asocia gallos con gallinas y distingue los tipos de lote", () => {
    expect(speciesForAcquisitionType("gallo")).toBe("gallina");
    expect(speciesForAcquisitionType("lote_pollos")).toBe("pollo");
    expect(speciesForAcquisitionType("codorniz")).toBe("codorniz");
    expect(normalizeManagedSpecies("conejos")).toBe("conejo");
  });
});
