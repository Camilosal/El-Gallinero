import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/species-db", () => ({
  normalizeSpecies: (value: string) => {
    const species = String(value || "").trim().toLowerCase();
    return ["gallina", "gallo", "pollo", "codorniz", "pato", "conejo"].includes(species) ? species : null;
  },
  speciesLabel: (species: string) => species,
}));

import { AGENT_TOOLS } from "@/lib/agent/tools";
import { searchNavigation } from "@/lib/navigation";

function findTool(name: string) {
  const tool = AGENT_TOOLS.find((item) => item.name === name);
  if (!tool) throw new Error(`No existe la herramienta ${name}`);
  return tool;
}

function context(get: (path: string) => Promise<unknown>) {
  return {
    api: { get: vi.fn(get), post: vi.fn() },
    userId: "test-user",
    userName: "Test User",
  } as any;
}

describe("nuevas funciones de búsqueda y del agente", () => {
  it("encuentra la guía genética, los lugares y los equipos con términos de uso cotidiano", () => {
    expect(searchNavigation("linaje").some((entry) => entry.href === "/dashboard/guia/trazabilidad-genetica")).toBe(true);
    expect(searchNavigation("potrero").some((entry) => entry.href === "/dashboard/ubicaciones")).toBe(true);
    expect(searchNavigation("equipos").some((entry) => entry.href === "/dashboard/guia/infraestructura-equipos")).toBe(true);
    expect(searchNavigation("equipos").some((entry) => entry.href === "/dashboard/operaciones/activos")).toBe(true);
  });

  it("consulta una ficha con datos desglosados por lugar", async () => {
    const tool = findTool("consultar_ubicaciones");
    const ctx = context(async () => [{
      id: "location-1",
      code: "LOC-001",
      name: "Galpón Norte",
      type: "galpon",
      status: "activa",
      operationalStatus: "operativa",
      sanitaryStatus: "cumple",
      animals: 24,
      eggsPeriod: 18,
      meatProducedKgPeriod: 3.5,
      deathsPeriod: 1,
      pendingMaintenance: 2,
      maintenanceNeeds: "Revisar malla",
    }]);

    const result = await tool.execute({ lugar: "galpon norte" }, ctx) as any;
    expect(result.lugares).toHaveLength(1);
    expect(result.lugares[0]).toMatchObject({ nombre: "Galpón Norte", huevos: 18, bajas: 1, tareasMantenimientoPendientes: 2 });
    expect(result.nota).toContain("no constituye una certificación");
  });

  it("consulta activos por número de serie y lugar sin inventar su valor", async () => {
    const tool = findTool("consultar_activos");
    const ctx = context(async (path) => {
      expect(path).toBe("/api/operaciones/activos");
      return [
        { id: "asset-1", code: "ACT-0001", name: "Bomba principal", serialNumber: "SER-001", locationName: "Galpón Norte", status: "operativo", acquisitionCost: "180000", category: "equipo" },
        { id: "asset-2", code: "ACT-0002", name: "Incubadora", serialNumber: "SER-002", locationName: "Sala", status: "retirado", acquisitionCost: "90000", category: "equipo" },
      ];
    });

    const result = await tool.execute({ buscar: "SER-001", lugar: "Galpón Norte" }, ctx) as any;
    expect(result.total).toBe(1);
    expect(result.activos[0]).toMatchObject({ codigo: "ACT-0001", lugar: "Galpón Norte", costoRegistradoCOP: 180000 });
    expect(result.nota).toContain("no representa depreciación");
  });

  it("busca el linaje registrado por código de progenitor o animal", async () => {
    const tool = findTool("consultar_trazabilidad_genetica");
    const ctx = context(async () => [{
      date: "2026-11-01",
      acquisitionType: "cria_propia",
      species: "gallina",
      birdType: "gallina",
      quantity: 2,
      registeredCodes: ["G-020", "G-021"],
      geneticLine: "Cruce: Criolla × Rhode Island Red",
      motherIdentifier: "G-001",
      fatherIdentifier: "GA-001",
      destinationLocationName: "Corral Este",
      geneticEvidenceReference: null,
    }]);

    const result = await tool.execute({ codigo: "ga-001" }, ctx) as any;
    expect(result.total).toBe(1);
    expect(result.registros[0]).toMatchObject({ padre: "GA-001", lugarDeDestino: "Corral Este", parentescoConCodigo: "descendencia registrada por línea paterna" });
  });

  it("registra huevos de pato con lote y lugar actuales", async () => {
    const tool = findTool("registrar_produccion_huevos");
    const ctx = context(async (path) => {
      if (path === "/api/produccion/pollos") return [{
        id: "batch-1",
        code: "L-PAT-001",
        species: "pato",
        purpose: "postura_huevo",
        currentQuantity: 8,
        status: "activo",
        locationId: "location-1",
      }];
      if (path === "/api/ubicaciones?active=true") return [{
        id: "location-1",
        name: "Patio Norte",
        status: "activa",
        operationalStatus: "operativa",
      }];
      throw new Error(`Ruta inesperada: ${path}`);
    });

    const prepared = await tool.prepare!({ especie: "pato", lote: "L-PAT-001", total_recolectado: 12 }, ctx);
    expect(prepared.args).toMatchObject({ species: "pato", batchId: "batch-1", locationId: "location-1", totalCollected: 12 });
    expect(prepared.summary).toContain("Patio Norte");
  });

  it("envía especie y lugar correctos al registrar el peso de un lote", async () => {
    const tool = findTool("registrar_peso");
    const ctx = context(async (path) => {
      if (path === "/api/produccion/pollos") return [{
        id: "batch-2",
        code: "L-CON-001",
        species: "conejo",
        purpose: "engorde_carne",
        currentQuantity: 5,
        status: "activo",
        locationId: "location-2",
      }];
      if (path === "/api/ubicaciones?active=true") return [{
        id: "location-2",
        name: "Potrero Bajo",
        status: "activa",
        operationalStatus: "operativa",
      }];
      throw new Error(`Ruta inesperada: ${path}`);
    });

    const prepared = await tool.prepare!({ lote: "L-CON-001", peso_promedio_kg: 1.4 }, ctx);
    expect(prepared.args).toMatchObject({ species: "conejo", batchId: "batch-2", locationId: "location-2", avgWeightKg: 1.4 });
    expect(prepared.summary).toContain("Potrero Bajo");
  });

  it("no elige una gallina al azar para registrar mortalidad cuando faltan datos", async () => {
    const tool = findTool("registrar_mortalidad");
    const ctx = context(async (path) => {
      if (path === "/api/produccion/gallinas") return [
        { id: "hen-1", code: "G-001", status: "activa", locationId: "location-1" },
        { id: "hen-2", code: "G-002", status: "activa", locationId: "location-1" },
      ];
      throw new Error(`Ruta inesperada: ${path}`);
    });

    await expect(tool.prepare!({ especie: "gallina", causa: "accidente" }, ctx)).rejects.toThrow("Indica el código del animal");
  });
});
