import { describe, it, expect } from "vitest";
import {
  SPECIES_PARAMS,
  getSpeciesParams,
  calcularRentabilidadLote,
  MARKET_PRICE_PER_KG,
} from "@/lib/species-params";
import { batchReadiness } from "@/lib/flock";
import { GET } from "@/app/api/especies/params/route";
import { mockRequest } from "./helpers";

describe("Parámetros Zootécnicos Multiespecie y Calculadoras", () => {
  it("debe contener parámetros para las 4 especies principales (pollo, codorniz, pato, conejo)", () => {
    const speciesList = SPECIES_PARAMS.map((p) => p.species);
    expect(speciesList).toContain("pollo");
    expect(speciesList).toContain("codorniz");
    expect(speciesList).toContain("pato");
    expect(speciesList).toContain("conejo");
  });

  it("getSpeciesParams debe retornar los valores esperados por especie", () => {
    const codorniz = getSpeciesParams("codorniz");
    expect(codorniz).toBeDefined();
    expect(codorniz?.cycleWeeks).toBe(6);
    expect(codorniz?.targetWeightKg).toBe(0.16);
    expect(codorniz?.carcassYieldPercent).toBe(65);

    const conejo = getSpeciesParams("conejo");
    expect(conejo).toBeDefined();
    expect(conejo?.cycleDays).toBe(77);
    expect(conejo?.targetWeightKg).toBe(2.4);
    expect(conejo?.carcassYieldPercent).toBe(55);
  });

  it("calcularRentabilidadLote debe calcular correctamente costo de alimento, canal, ahorro e ingresos", () => {
    const polloParams = getSpeciesParams("pollo")!;
    // Lote de 20 pollos, 5 para hogar (autoconsumo), 15 para venta
    const calc = calcularRentabilidadLote(polloParams, 20, 40000, 5, 15);

    // 20 pollos * 2.5 kg * 72% rendimiento = 36 kg canal total
    expect(calc.kgCanalTotal).toBeCloseTo(36, 1);
    // 5 para hogar = 9 kg canal
    expect(calc.kgCanalAutoconsumo).toBeCloseTo(9, 1);
    // 15 para venta = 27 kg canal
    expect(calc.kgCanalExcedente).toBeCloseTo(27, 1);

    // Ahorro familiar: 9 kg * $14.000 = $126.000
    expect(calc.ahorroAutoconsumo).toBeCloseTo(126000, 0);
    // Ingreso excedente: 27 kg * $14.000 = $378.000
    expect(calc.ingresoExcedentes).toBeCloseTo(378000, 0);

    expect(calc.costoTotal).toBeGreaterThan(40000);
    expect(calc.margenNeto).toBe(calc.ingresoExcedentes + calc.ahorroAutoconsumo - calc.costoTotal);
  });

  it("batchReadiness debe evaluar correctamente la edad en días para conejos", () => {
    // Lote de conejos iniciado hace 80 días con targetDays = 77
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 80);
    const startDateStr = pastDate.toISOString().split("T")[0];

    const readiness = batchReadiness({
      startDate: startDateStr,
      targetWeeks: 11,
      targetDays: 77,
      targetWeightKg: "2.4",
      avgWeightKg: "2.5",
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.ageDays).toBeGreaterThanOrEqual(77);
    expect(readiness.reasons.some((r) => r.includes("días"))).toBe(true);
  });

  it("GET /api/especies/params debe retornar la lista de especies o calcular proyección con searchParams", async () => {
    // 1. Todas las especies
    const resAll = await GET(mockRequest("http://localhost/api/especies/params"));
    const dataAll = await resAll.json();
    expect(Array.isArray(dataAll)).toBe(true);
    expect(dataAll.length).toBeGreaterThanOrEqual(4);

    // 2. Filtrado por especie con proyección
    const resFiltered = await GET(
      mockRequest("http://localhost/api/especies/params?species=pato&quantity=10&autoconsumo=2&excedente=8")
    );
    const dataFiltered = await resFiltered.json();
    const patoItem = Array.isArray(dataFiltered) ? dataFiltered[0] : dataFiltered;
    expect(patoItem.species).toBe("pato");
    expect(patoItem.proyeccion).toBeDefined();
    expect(patoItem.proyeccion.kgCanalTotal).toBeGreaterThan(0);
  });
});

