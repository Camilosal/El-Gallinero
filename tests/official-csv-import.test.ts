import { describe, expect, it } from "vitest";
import { parseOfficialSourceCsv } from "@/lib/external-sources/official-csv-import";

describe("Importación de tablas oficiales DANE", () => {
  it("lee precios SIPSA-I con encabezados DANE, DIVIPOLA y decimal local", () => {
    const csv = [
      "MES_AO;CDIGODIVIPOLA;CDIGOCPC;ARTCULO;CARACTERSTICAS;PRECIO;UNIDAD",
      '2026-01;73001;012345;Alimento balanceado;Bulto 40 kg;"1.234,50";COP/bulto',
    ].join("\n");

    const result = parseOfficialSourceCsv(csv, "sipsa_i", "Insumospecuarios.csv", "Insumos pecuarios");
    expect(result.observations).toHaveLength(1);
    expect(result.rejectedRows).toBe(0);
    expect(result.observations[0]).toMatchObject({
      sourceKey: "dane_sipsa_i",
      observedAt: new Date("2026-01-01T00:00:00.000Z"),
      value: 1234.5,
      unit: "COP/bulto",
      dimensions: {
        period: "2026-01",
        divipolaCode: "73001",
        coverageLevel: "municipio",
        cpcCode: "012345",
        article: "Alimento balanceado",
        characteristics: "Bulto 40 kg",
        group: "Insumos pecuarios",
      },
    });
  });

  it("omite filas con DIVIPOLA inválido o precio no válido", () => {
    const csv = [
      "MES_AÑO,CDIGODIVIPOLA,CDIGOCPC,ARTICULO,CARACTERISTICAS,PRECIO",
      "2026-01,7,123,Alimento,Bulto,90000",
      "2026-02,73001,123,Alimento,Bulto,no disponible",
    ].join("\n");
    const result = parseOfficialSourceCsv(csv, "sipsa_i", "SIPSA.csv");
    expect(result.observations).toHaveLength(0);
    expect(result.rejectedRows).toBe(2);
    expect(result.rejectionReasons["Código DIVIPOLA distinto de dos o cinco dígitos"]).toBe(1);
    expect(result.rejectionReasons["Precio no positivo/no numérico"]).toBe(1);
  });

  it("importa series IPC/IPP con periodo, medida, cobertura y base", () => {
    const csv = [
      "periodo;indicador;medida;valor;unidad;cobertura;base",
      "enero 2026;IPC total nacional;variacion_mensual;0,42;%;Nacional;2018=100",
    ].join("\n");
    const result = parseOfficialSourceCsv(csv, "ipc", "Anexo_IPC.csv");
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({
      sourceKey: "dane_price_indices",
      observedAt: new Date("2026-01-01T00:00:00.000Z"),
      value: 0.42,
      unit: "%",
      dimensions: {
        period: "2026-01",
        indicator: "IPC total nacional",
        measure: "variacion_mensual",
        coverage: "Nacional",
        base: "2018=100",
        sourceType: "IPC",
      },
    });
  });

  it("conserva variaciones IPP negativas publicadas por DANE", () => {
    const csv = [
      "periodo,indicador,medida,valor,unidad,cobertura,base",
      "2026-06,Agricultura,variacion_mensual,-3.49,%,Nacional,",
    ].join("\n");
    const result = parseOfficialSourceCsv(csv, "ipp", "Anexo_IPP.csv");
    expect(result.observations[0].value).toBe(-3.49);
  });

  it("deduplica filas idénticas y pone en cuarentena una clave con valores en conflicto", () => {
    const duplicateCsv = [
      "periodo;indicador;medida;valor;unidad;cobertura;base",
      "2026-06;IPC total;índice;145,2;puntos;Nacional;2018=100",
      "2026-06;IPC total;índice;145,2;puntos;Nacional;2018=100",
    ].join("\n");
    const exact = parseOfficialSourceCsv(duplicateCsv, "ipc", "IPC.csv");
    expect(exact.observations).toHaveLength(1);
    expect(exact.rejectedRows).toBe(1);
    expect(exact.rejectionReasons["Fila duplicada exacta dentro del archivo"]).toBe(1);

    const conflictingCsv = duplicateCsv.replace("145,2;puntos", "146,1;puntos");
    const conflict = parseOfficialSourceCsv(conflictingCsv, "ipc", "IPC.csv");
    expect(conflict.observations).toHaveLength(0);
    expect(conflict.rejectedRows).toBe(2);
    expect(conflict.rejectionReasons["Clave repetida con valores distintos; grupo puesto en cuarentena"]).toBe(2);
  });

  it("rechaza periodos futuros y filas que no coinciden con el número de columnas", () => {
    const csv = [
      "periodo,indicador,medida,valor,unidad,cobertura,base",
      "2099-01,IPC total,índice,145.2,puntos,Nacional,2018=100",
      "2026-06,IPC total,índice,145.2,puntos,Nacional,2018=100,extra",
    ].join("\n");
    const result = parseOfficialSourceCsv(csv, "ipc", "IPC.csv");
    expect(result.observations).toHaveLength(0);
    expect(result.rejectedRows).toBe(2);
    expect(result.rejectionReasons["Periodo mensual ausente o inválido"]).toBe(1);
    expect(result.rejectionReasons["Número de campos no coincide con encabezados"]).toBe(1);
  });

  it("preserva valor original y diferencia unidades al formar claves idempotentes", () => {
    const csv = [
      "MES_AO;CDIGODIVIPOLA;CDIGOCPC;ARTCULO;CARACTERSTICAS;PRECIO;UNIDAD",
      "2026-01;73001;012345;Alimento;Bulto 40 kg;90000;COP/bulto",
      "2026-01;73001;012345;Alimento;Bulto 40 kg;90000;COP/tonelada",
    ].join("\n");
    const result = parseOfficialSourceCsv(csv, "sipsa_i", "Insumos.csv");
    expect(result.observations).toHaveLength(2);
    expect(result.observations[0].metadata).toMatchObject({ rawPeriod: "2026-01", rawValue: "90000", rawUnit: "COP/bulto" });
    expect(result.observations.map((row) => row.observationKey)).toHaveLength(2);
  });
});
