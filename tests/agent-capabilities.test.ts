import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/species-db", () => ({
  normalizeSpecies: (value: string) => {
    const species = String(value || "").trim().toLowerCase();
    if (species === "cuy" || species === "cuyes") return "cuy";
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

function context(
  get: (path: string) => Promise<unknown>,
  post: (path: string, body: unknown) => Promise<unknown> = async () => ({ ok: true }),
  put: (path: string, body: unknown) => Promise<unknown> = async () => ({ ok: true }),
) {
  return {
    api: { get: vi.fn(get), post: vi.fn(post), put: vi.fn(put) },
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

  it("prepara ventas de carne y gallinaza multiespecie con soporte de crédito", async () => {
    const carneTool = findTool("registrar_venta_carne");
    const preparedMeat = await carneTool.prepare!(
      {
        fecha: "2026-11-13",
        especie: "cuyes",
        cantidad_kg: 3.5,
        precio_kg: 28000,
        presentacion: "canal limpio",
        comprador: "Asadero El Valle",
        credito: true,
        fecha_vencimiento: "2026-11-28",
      },
      context(async () => []),
    );
    expect(preparedMeat.args).toMatchObject({
      date: "2026-11-13",
      species: "cuy",
      quantityKg: 3.5,
      pricePerKg: 28000,
      isCredit: true,
      dueDate: "2026-11-28",
    });
    expect(preparedMeat.summary).toContain("carne de cuy");

    const gallinazaTool = findTool("registrar_venta_gallinaza");
    const preparedManure = await gallinazaTool.prepare!(
      {
        fecha: "2026-11-13",
        cantidad_kg: 40,
        precio_kg: 500,
        presentacion: "bulto 40kg",
        comprador: "Vivero Sur",
        credito: true,
        fecha_vencimiento: "2026-11-30",
      },
      context(async () => []),
    );
    expect(preparedManure.args).toMatchObject({
      date: "2026-11-13",
      quantityKg: 40,
      pricePerKg: 500,
      isCredit: true,
      dueDate: "2026-11-30",
    });
    expect(preparedManure.summary).toContain("gallinaza/abono");
  });

  it("incluye crédito al preparar venta de animales en pie", async () => {
    const animalTool = findTool("registrar_venta_animales");
    const ctx = context(async (path) => {
      if (path === "/api/produccion/pollos") return [{
        id: "batch-cuy",
        code: "L-CUY-01",
        species: "cuy",
        purpose: "engorde_carne",
        currentQuantity: 10,
        status: "activo",
        locationId: "location-1",
      }];
      throw new Error(`Ruta inesperada: ${path}`);
    });

    const prepared = await animalTool.prepare!(
      {
        fecha: "2026-11-13",
        tipo: "lote",
        especie: "cuy",
        cantidad: 2,
        precio_unitario: 35000,
        credito: true,
        fecha_vencimiento: "2026-12-01",
      },
      ctx,
    );
    expect(prepared.args).toMatchObject({
      birdType: "cuy",
      batchId: "batch-cuy",
      quantity: 2,
      isCredit: true,
      dueDate: "2026-12-01",
    });
  });

  it("consulta reproducción (respuesta arreglo), compostaje y sensores con sus campos reales", async () => {
    const reproTool = findTool("consultar_reproduccion");
    const reproRes = await reproTool.execute(
      { especie: "cuy" },
      context(async (path) => {
        expect(path).toBe("/api/produccion/reproduccion?species=cuy");
        return [
          {
            id: "rep-1",
            species: "cuy",
            eventType: "empadre",
            eventDate: "2026-11-01",
            damCode: "CUY-H01",
            sireCode: "CUY-M02",
            locationName: "Jaula Cuyes A",
            parityNumber: 2,
            expectedPalpationDate: "2026-11-16",
            expectedBirthDate: "2027-01-08",
            status: "activo",
            isEliteDam: true,
            cullRecommended: false,
            litterDailyGainG: "35.20",
          },
        ];
      }),
    ) as any;
    expect(reproRes.resumen.gestacionesActivas).toBe(1);
    expect(reproRes.resumen.madresElite[0]).toContain("CUY-H01");
    expect(reproRes.eventosRecientes[0]).toMatchObject({ madre: "CUY-H01", padre: "CUY-M02", lugar: "Jaula Cuyes A" });

    const compTool = findTool("consultar_compostaje");
    const compRes = await compTool.execute(
      {},
      context(async () => ({
        summary: { total: 1, active: 1, harvested: 0, harvestedTotalKg: 0, alertsCount: 1 },
        piles: [{
          code: "COMP-01",
          name: "Pila Norte",
          formulaRatio: "3:1:1",
          status: "activa",
          startDate: "2026-11-01",
          expectedHarvestDate: "2026-12-27",
          turnCount: 2,
          currentTempC: "72.0",
          moisturePct: "52.0",
          alerts: ["Sobrecalentamiento"],
        }],
      })),
    ) as any;
    expect(compRes.pilas[0]).toMatchObject({ codigo: "COMP-01", nombre: "Pila Norte", volteos: 2, temperaturaC: "72.0" });

    const sensorTool = findTool("consultar_cierre_y_sensores");
    const sensorRes = await sensorTool.execute(
      {},
      context(async (path) => {
        if (path.startsWith("/api/operaciones/cierre-diario")) return { targetDate: "2026-11-12", preview: { eggsCollected: 80 }, closures: [] };
        return {
          summary: { totalReadings: 1, alertCount: 1, maxIth: 79, maxNh3Ppm: null, latestScaleKg: null },
          readings: [{
            deviceId: "s-01",
            locationName: "Galpón 1",
            metricType: "ith",
            value: "79.000",
            unit: "ITH",
            ithIndex: "79.00",
            alertTriggered: true,
            recordedAt: "2026-11-12T15:00:00Z",
          }],
        };
      }),
    ) as any;
    expect(sensorRes.sensores.alertasActivas[0].motivo).toContain("Estrés calórico severo");
    expect(sensorRes.sensores.lecturasRecientes).toHaveLength(1);
  });

  it("prepara herramientas nuevas (contabilidad analítica, rutinas, compostaje PUT, reproducción, prorrateo y cierre diario)", async () => {
    const analiticaTool = findTool("consultar_contabilidad_analitica");
    const analiticaRes = await analiticaTool.execute(
      { especie: "cuy", lugar: "Jaula A", dias: 15 },
      context(async (path) => {
        if (path === "/api/ubicaciones") return [{ id: "loc-cuy", name: "Jaula A" }];
        expect(path).toContain("/api/analisis/contabilidad-analitica?");
        expect(path).toContain("species=cuy");
        expect(path).toContain("locationId=loc-cuy");
        return {
          from: "2026-10-28",
          to: "2026-11-12",
          includeProrated: true,
          totals: { netProfit: 450000 },
          bySpecies: [],
          byLocation: [],
          unitEconomics: null,
          capexRoi: null,
          proratedRulesCount: 1,
        };
      }),
    ) as any;
    expect(analiticaRes.totales.netProfit).toBe(450000);

    const eggsTool = findTool("registrar_produccion_huevos");
    const eggsPrepared = await eggsTool.prepare!(
      {
        fecha: "2026-11-12",
        lugar: "Galpón 1",
        tamanos: [{ tamano: "AA", cantidad: 60 }],
        descartados: 2,
        codigo_lote: "HUE-20261112",
        temperatura_almacen_c: 14.5,
        humedad_almacen_pct: 75,
      },
      context(async (path) => {
        if (path === "/api/ubicaciones?active=true") return [{ id: "loc-1", name: "Galpón 1", status: "activa", operationalStatus: "operativa" }];
        return [];
      }),
    );
    expect(eggsPrepared.args).toMatchObject({
      discarded: 2,
      lotCode: "HUE-20261112",
      storageTempC: 14.5,
      storageHumidityPct: 75,
    });

    const compostTool = findTool("registrar_compostaje");
    const compostTurn = await compostTool.prepare!(
      { accion: "volteo", pila: "COMP-01", temperatura_c: 58 },
      context(async () => ({ piles: [{ id: "pile-1", code: "COMP-01", name: "Pila Norte" }] })),
    );
    expect(compostTurn.args).toMatchObject({ method: "PUT", payload: { id: "pile-1", action: "turn", currentTempC: 58 } });

    const prorrateoTool = findTool("registrar_prorrateo");
    expect(prorrateoTool.requiresConfirmation).toBe(true);
    const prPrepared = await prorrateoTool.prepare!({ titulo: "Energía eléctrica", monto_total: 240000, criterio: "biomass" }, context(async () => []));
    expect(prPrepared.args).toMatchObject({ title: "Energía eléctrica", totalAmount: 240000, basis: "biomass" });

    const cierreTool = findTool("registrar_cierre_diario");
    expect(cierreTool.requiresConfirmation).toBe(true);
    await expect(
      cierreTool.prepare!({ fecha: "2026-11-12" }, context(async () => ({
        closures: [{ closureDate: "2026-11-12", status: "cerrado" }],
        preview: {},
      }))),
    ).rejects.toThrow("ya se encuentra cerrado");
  });
});
