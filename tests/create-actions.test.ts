import { describe, expect, it } from "vitest";
import { CREATE_ACTION_GROUPS } from "@/lib/create-actions";
import { searchNavigation, searchEntries } from "@/lib/navigation";

describe("catálogo compartido de acciones", () => {
  it("expone en el buscador todas las acciones del menú Crear", () => {
    const searchable = new Set(searchEntries.map((entry) => `${entry.label}|${entry.href}`));
    const actions = CREATE_ACTION_GROUPS.flatMap((group) => group.actions);
    expect(actions.length).toBeGreaterThan(20);
    for (const action of actions) {
      expect(searchable.has(`${action.label}|${action.href}`)).toBe(true);
      expect(action.href.includes("nuevo=") || action.href.includes("wizard=")).toBe(true);
    }
  });

  it("encuentra acciones por su nombre en el buscador global", () => {
    expect(searchNavigation("registrar mortalidad").some((entry) => entry.label === "Registrar mortalidad")).toBe(true);
    expect(searchNavigation("crear alimento").some((entry) => entry.label === "Crear alimento")).toBe(true);
    expect(searchNavigation("prorratear").some((entry) => entry.href === "/dashboard/analisis/reportes?tab=analitica&nuevo=prorrateo")).toBe(true);
    expect(searchNavigation("rutina").some((entry) => entry.href === "/dashboard/planeacion/calendario?tab=rutina&nuevo=rutina")).toBe(true);
    expect(searchNavigation("sensor iot").some((entry) => entry.href === "/dashboard/operaciones/cierre?nuevo=sensor")).toBe(true);
    expect(searchNavigation("agregar norma").some((entry) => entry.href === "/dashboard/analisis/normas?nuevo=1")).toBe(true);
    expect(searchNavigation("presentar falla").some((entry) => entry.href === "/dashboard/configuracion/fallas?nuevo=1")).toBe(true);
  });

  it("indexa nuevas subvistas de especies, nutrición, analítica y biometría en el buscador", () => {
    expect(searchNavigation("cuyes").some((entry) => entry.href === "/dashboard/produccion?tab=animales&subtab=cuyes")).toBe(true);
    expect(searchNavigation("prediccion").some((entry) => entry.href === "/dashboard/produccion?tab=alimentacion&subtab=prediccion")).toBe(true);
    expect(searchNavigation("comparativo fcr").some((entry) => entry.href === "/dashboard/produccion?tab=alimentacion&subtab=comparativo")).toBe(true);
    expect(searchNavigation("contabilidad analitica").some((entry) => entry.href === "/dashboard/analisis/reportes?tab=analitica")).toBe(true);
    expect(searchNavigation("biometria").some((entry) => entry.href === "/dashboard/produccion/peso")).toBe(true);
    expect(searchNavigation("asistente inicial").some((entry) => entry.href === "/dashboard?wizard=1")).toBe(true);
    expect(searchNavigation("desgaste equipos").some((entry) => entry.href === "/dashboard/operaciones/activos")).toBe(true);
    expect(searchNavigation("valor de animales").some((entry) => entry.href === "/dashboard/inventarios/balance")).toBe(true);
    expect(searchNavigation("reportar error").some((entry) => entry.href === "/dashboard/configuracion/fallas")).toBe(true);
  });
});
