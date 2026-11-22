import { afterEach, describe, expect, it, vi } from "vitest";
import { parseIdeamHydroAlerts, parseIdeamHydroCsv } from "@/lib/external-sources/wave5-official-alerts";
import { fetchJsonWithTimeout } from "@/lib/external-sources/snapshot-store";

const columns = [
  { fieldName: "codigo_alerta", name: "Código alerta", dataTypeName: "text" },
  { fieldName: "nivel_alerta", name: "Nivel de alerta", dataTypeName: "text" },
  { fieldName: "descripcion", name: "Descripción", dataTypeName: "text" },
  { fieldName: "fecha_publicacion", name: "Fecha de publicación", dataTypeName: "calendar_date" },
  { fieldName: "departamento", name: "Departamento", dataTypeName: "text" },
  { fieldName: "municipio", name: "Municipio", dataTypeName: "text" },
  { fieldName: "cuenca", name: "Cuenca", dataTypeName: "text" },
  { fieldName: "estado", name: "Estado", dataTypeName: "text" },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Alertas hidrológicas IDEAM", () => {
  it("lee el CSV oficial, conserva la cobertura e ignora condiciones normales", () => {
    const csv = [
      "OBJECTID,ALERTA,NOMAH,NOMZH,NOMSZH,DEP,DEP_1,DEP_2,NIVEL_A",
      '17,"Creciente en el río, aguas abajo",Magdalena-Cauca,Alto Magdalena,Combeima,Tolima,,,ALERTA NARANJA',
      "18,Sin alertas,Magdalena-Cauca,Alto Magdalena,Combeima,Tolima,,,CONDICIONES NORMALES",
    ].join("\r\n");
    const observedAt = "2026-11-17T12:00:00.000Z";

    expect(parseIdeamHydroCsv(csv, observedAt)).toEqual([{
      id: "17",
      title: "ALERTA NARANJA",
      description: "Cobertura hidrográfica reportada por IDEAM: Magdalena-Cauca / Alto Magdalena / Combeima.",
      department: "Tolima",
      municipality: "",
      waterbody: "Magdalena-Cauca / Alto Magdalena / Combeima",
      publishedAt: null,
      observedAt,
      statusLabel: "Vigente en el archivo oficial IDEAM",
    }]);
  });

  it("rechaza cambios de esquema y categorías desconocidas sin reemplazar datos válidos", () => {
    expect(() => parseIdeamHydroCsv("OBJECTID,NIVEL_A\n1,ALERTA ROJA")).toThrow("faltan nivel de alerta o cobertura hidrográfica");
    expect(() => parseIdeamHydroCsv("OBJECTID,NOMAH,NIVEL_A\n1,Magdalena,ALERTA AZUL")).toThrow("categoría de alerta desconocida");
  });

  it("conserva identificador, fecha, cobertura, descripción y estado publicados", () => {
    const rows = [{
      codigo_alerta: "AL-2026-17",
      nivel_alerta: "Alerta naranja",
      descripcion: "Probabilidad de creciente súbita en la cuenca.",
      fecha_publicacion: "2026-11-16T18:00:00.000",
      departamento: "Tolima",
      municipio: "Ibagué",
      cuenca: "Río Combeima",
      estado: "Vigente según conjunto",
    }];

    expect(parseIdeamHydroAlerts(rows, columns)).toEqual([{
      id: "AL-2026-17",
      title: "Alerta naranja",
      description: "Probabilidad de creciente súbita en la cuenca.",
      department: "Tolima",
      municipality: "Ibagué",
      waterbody: "Río Combeima",
      publishedAt: new Date("2026-11-16T18:00:00.000").toISOString(),
      statusLabel: "Vigente según conjunto",
    }]);
  });

  it("omite filas sin fecha publicada válida y permite un conjunto válido sin filas", () => {
    const rows = [
      { codigo_alerta: "sin-fecha", nivel_alerta: "Amarilla", descripcion: "Sin fecha" },
      { codigo_alerta: "futura", nivel_alerta: "Naranja", descripcion: "Fecha futura", fecha_publicacion: "2099-01-01" },
    ];

    expect(parseIdeamHydroAlerts(rows, columns)).toEqual([]);
    expect(parseIdeamHydroAlerts([], columns)).toEqual([]);
  });

  it("exige columnas de fecha y alerta/descripción para detectar cambios de esquema", () => {
    expect(() => parseIdeamHydroAlerts([{ valor: "x" }], [
      { fieldName: "valor", name: "Valor", dataTypeName: "text" },
    ])).toThrow("cambió sus columnas");
  });

  it("limita el tamaño de respuestas JSON externas", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response('{"ok":true}', { headers: { "content-length": "11" } }),
    ));
    const response = await fetchJsonWithTimeout<{ ok: boolean }>("https://example.test", 100, 10);
    expect(response).toEqual({ ok: false, error: "Respuesta supera el límite de 10 bytes" });
  });

  it("lee JSON cuando la respuesta está dentro del límite", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response('{"ok":true}', { headers: { "content-length": "11" } }),
    ));
    const response = await fetchJsonWithTimeout<{ ok: boolean }>("https://example.test", 100, 11);
    expect(response).toEqual({ ok: true, data: { ok: true } });
  });
});
