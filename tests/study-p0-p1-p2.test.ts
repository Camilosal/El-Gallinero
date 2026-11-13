import { afterAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  animalLocationMovements,
  biosecurityLogs,
  birdAcquisitions,
  broilerBatches,
  compostingPiles,
  costAllocations,
  dailyClosures,
  eggProduction,
  eggProductionDetails,
  eggSales,
  eggSalesItems,
  farmLocations,
  healthControl,
  hens,
  incubation,
  reproductionEvents,
  sensorReadings,
  transactions,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { mockRequest, parseJson } from "./helpers";

import { GET as prorrateoGET, POST as prorrateoPOST, DELETE as prorrateoDELETE } from "@/app/api/finanzas/prorrateo/route";
import { GET as contabilidadGET } from "@/app/api/analisis/contabilidad-analitica/route";
import { GET as especiesParamsGET } from "@/app/api/especies/params/route";
import { GET as curvasGET } from "@/app/api/analisis/curvas/route";
import { GET as reproGET, POST as reproPOST, DELETE as reproDELETE } from "@/app/api/produccion/reproduccion/route";
import { GET as incubacionGET, POST as incubacionPOST, PUT as incubacionPUT, DELETE as incubacionDELETE } from "@/app/api/produccion/incubacion/route";
import { GET as huevosGET, POST as huevosPOST } from "@/app/api/produccion/huevos/route";
import { GET as feedComparativoGET } from "@/app/api/produccion/alimentacion/comparativo/route";
import { POST as movimientosPOST } from "@/app/api/ubicaciones/movimientos/route";
import { POST as healthPOST, DELETE as healthDELETE } from "@/app/api/sanidad/control/route";
import { POST as eggSalesPOST } from "@/app/api/finanzas/finanzas/ventas/route";
import { PUT as paramsPUT } from "@/app/api/configuracion/parametros/route";
import { POST as financePOST } from "@/app/api/finanzas/finanzas/route";
import { GET as bioGET, POST as bioPOST } from "@/app/api/sanidad/bioseguridad/route";
import { GET as compostGET, POST as compostPOST, PUT as compostPUT, DELETE as compostDELETE } from "@/app/api/operaciones/compostaje/route";
import { GET as closureGET, POST as closurePOST, PUT as closurePUT } from "@/app/api/operaciones/cierre-diario/route";
import { GET as sensorGET, POST as sensorPOST } from "@/app/api/operaciones/sensores/route";

import { getAllSpeciesParams, getSpeciesParams } from "@/lib/species-params";
import { getStandardCurves } from "@/lib/standard-curves";
import { calibrateTargetForEnvironment, computeDailyGainG, computeEpef, computeUniformityStats } from "@/lib/zootechnics";
import { checkEggStorageTelemetry, classifyWeightNtc1240, generateEggLotCode } from "@/lib/ntc1240";

const callGET = (handler: any, url = "http://localhost/test"): Promise<Response> =>
  handler(mockRequest(url));
const callWithBody = (handler: any, url: string, method: string, body: unknown): Promise<Response> =>
  handler(mockRequest(url, { method, body }));

const DEFAULT_ADMIN_USER = {
  id: "test-user",
  username: "test",
  name: "Test User",
  role: "admin",
};

async function withRole<T>(
  user: { id: string; username: string; name: string; role: string },
  fn: () => Promise<T>,
): Promise<T> {
  vi.mocked(getSessionUser).mockResolvedValue(user as any);
  try {
    return await fn();
  } finally {
    vi.mocked(getSessionUser).mockResolvedValue(DEFAULT_ADMIN_USER as any);
  }
}

describe("Integración integral P0 / P1 / P2 del estudio técnico", () => {
  const createdIds = {
    allocationIds: [] as string[],
    locationIds: [] as string[],
    batchIds: [] as string[],
    acquisitionIds: [] as string[],
    reproIds: [] as string[],
    incubationIds: [] as string[],
    eggProdIds: [] as string[],
    henIds: [] as string[],
    healthIds: [] as string[],
    bioIds: [] as string[],
    compostIds: [] as string[],
    sensorIds: [] as string[],
    closureDates: [] as string[],
  };

  afterAll(async () => {
    if (createdIds.sensorIds.length) {
      await db.delete(sensorReadings).where(inArray(sensorReadings.id, createdIds.sensorIds));
    }
    if (createdIds.closureDates.length) {
      await db.delete(dailyClosures).where(inArray(dailyClosures.closureDate, createdIds.closureDates));
    }
    if (createdIds.compostIds.length) {
      await db.delete(compostingPiles).where(inArray(compostingPiles.id, createdIds.compostIds));
    }
    if (createdIds.bioIds.length) {
      await db.delete(biosecurityLogs).where(inArray(biosecurityLogs.id, createdIds.bioIds));
    }
    if (createdIds.reproIds.length) {
      await db.delete(reproductionEvents).where(inArray(reproductionEvents.parentEventId, createdIds.reproIds));
      await db.delete(reproductionEvents).where(inArray(reproductionEvents.id, createdIds.reproIds));
    }
    if (createdIds.allocationIds.length) {
      await db.delete(costAllocations).where(inArray(costAllocations.id, createdIds.allocationIds));
    }
    if (createdIds.batchIds.length) {
      await db.delete(animalLocationMovements).where(inArray(animalLocationMovements.batchId, createdIds.batchIds));
    }
    if (createdIds.locationIds.length) {
      await db.delete(animalLocationMovements).where(or(
        inArray(animalLocationMovements.fromLocationId, createdIds.locationIds),
        inArray(animalLocationMovements.toLocationId, createdIds.locationIds),
      ));
    }
    if (createdIds.incubationIds.length) {
      await db.delete(incubation).where(inArray(incubation.id, createdIds.incubationIds));
    }
    if (createdIds.locationIds.length) {
      const straySales = await db.select({ id: eggSales.id }).from(eggSales).where(inArray(eggSales.locationId, createdIds.locationIds));
      if (straySales.length) {
        const sIds = straySales.map((s) => s.id);
        await db.delete(eggSalesItems).where(inArray(eggSalesItems.saleId, sIds));
        await db.delete(transactions).where(and(eq(transactions.sourceType, "venta"), inArray(transactions.sourceId, sIds)));
        await db.delete(eggSales).where(inArray(eggSales.id, sIds));
      }
    }
    if (createdIds.eggProdIds.length) {
      await db.delete(eggProductionDetails).where(inArray(eggProductionDetails.productionId, createdIds.eggProdIds));
      await db.delete(eggProduction).where(inArray(eggProduction.id, createdIds.eggProdIds));
    }
    if (createdIds.healthIds.length) {
      await db.delete(transactions).where(and(eq(transactions.sourceType, "sanidad"), inArray(transactions.sourceId, createdIds.healthIds)));
      await db.delete(healthControl).where(inArray(healthControl.id, createdIds.healthIds));
    }
    if (createdIds.batchIds.length) {
      await db.delete(broilerBatches).where(inArray(broilerBatches.id, createdIds.batchIds));
    }
    if (createdIds.acquisitionIds.length) {
      await db.delete(birdAcquisitions).where(inArray(birdAcquisitions.id, createdIds.acquisitionIds));
    }
    if (createdIds.henIds.length) {
      await db.delete(hens).where(inArray(hens.id, createdIds.henIds));
    }
    if (createdIds.locationIds.length) {
      await db.delete(farmLocations).where(inArray(farmLocations.id, createdIds.locationIds));
    }
  });

  // ─────────────────────────────────────────────────────────────
  // P0: Prorrateo y Contabilidad Analítica
  // ─────────────────────────────────────────────────────────────
  it("P0: Prorrateo de costos indirectos (manual + head_count) y eliminación", async () => {
    const manualRes = await callWithBody(prorrateoPOST, "http://localhost/api/finanzas/prorrateo", "POST", {
      title: "Energía y agua prueba",
      date: "2026-11-12",
      basis: "manual",
      totalAmount: 100000,
      allocations: [
        { species: "gallina", percentage: 60, label: "Gallinas" },
        { species: "cuy", percentage: 40, label: "Cuyes" },
      ],
    });
    expect(manualRes.status).toBe(201);
    const created = await parseJson(manualRes);
    createdIds.allocationIds.push(created.id);
    expect(created.allocations).toHaveLength(2);
    expect(created.allocations[0].amount).toBeCloseTo(60000, 1);
    expect(created.allocations[1].amount).toBeCloseTo(40000, 1);

    const listRes = await callGET(prorrateoGET, "http://localhost/api/finanzas/prorrateo");
    expect(listRes.status).toBe(200);
    const listData = await parseJson(listRes);
    expect(Array.isArray(listData.allocations)).toBe(true);
    expect(listData.suggestedWeights).toHaveProperty("head_count");
    expect(listData.suggestedWeights).toHaveProperty("biomass");

    const delRes = await callGET(prorrateoDELETE, `http://localhost/api/finanzas/prorrateo?id=${created.id}`);
    expect(delRes.status).toBe(200);
    createdIds.allocationIds.pop();
  });

  it("P0: Contabilidad analítica retorna JSON, CSV y XLSX real", async () => {
    const jsonRes = await callGET(contabilidadGET, "http://localhost/api/analisis/contabilidad-analitica?from=2026-01-01&to=2026-12-31");
    expect(jsonRes.status).toBe(200);
    const body = await parseJson(jsonRes);
    expect(body).toHaveProperty("totals");
    expect(Array.isArray(body.bySpecies)).toBe(true);
    expect(Array.isArray(body.byLocation)).toBe(true);
    expect(body.unitEconomics).toHaveProperty("eggs");
    expect(body.unitEconomics).toHaveProperty("meat");
    expect(body).toHaveProperty("capexRoi");

    const csvRes = await callGET(contabilidadGET, "http://localhost/api/analisis/contabilidad-analitica?from=2026-01-01&to=2026-12-31&format=csv");
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get("Content-Type")).toContain("text/csv");
    const csvText = await csvRes.text();
    expect(csvText).toContain("Especie");

    const xlsxRes = await callGET(contabilidadGET, "http://localhost/api/analisis/contabilidad-analitica?from=2026-01-01&to=2026-12-31&format=xlsx");
    expect(xlsxRes.status).toBe(200);
    expect(xlsxRes.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    const buf = new Uint8Array(await xlsxRes.arrayBuffer());
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  // ─────────────────────────────────────────────────────────────
  // P1: Zootecnia 6 especies, Ross 308, Cuy, CV%, EPEF y Altitud
  // ─────────────────────────────────────────────────────────────
  it("P1: Zootecnia cubre 6 especies (incl. cuy y Ross 308), CV%, GDP, EPEF y ajuste por altitud/piso", async () => {
    const cuy = getSpeciesParams("cuy");
    expect(cuy).toBeDefined();
    expect(cuy?.targetWeightKg).toBeGreaterThan(0.8);
    expect(getAllSpeciesParams("pollo").some((p) => p.breed.includes("Ross 308"))).toBe(true);
    expect(getSpeciesParams("pollo", "Ross 308")).toBeDefined();

    const uni = computeUniformityStats([1500, 1520, 1480, 1510, 1490], 10);
    expect(uni).not.toBeNull();
    expect(uni!.uniformityPct).toBe(100);
    expect(uni!.cvStatus).toBe("excelente");

    expect(computeDailyGainG(100, 460, 10)).toBe(36);
    const epef = computeEpef({ livabilityPct: 96, bodyWeightKg: 2.5, ageDays: 42, fcr: 1.65 });
    expect(epef).not.toBeNull();
    expect(epef!).toBeGreaterThan(340);

    const cal = calibrateTargetForEnvironment("pollo", 2600, "pastoreo");
    expect(cal.factor).toBeCloseTo(0.893, 3);
    expect(cal.notes.length).toBe(2);

    const spApi = await callGET(especiesParamsGET, "http://localhost/api/especies/params");
    const spList = await parseJson(spApi);
    expect(spList.some((r: any) => r.species === "cuy")).toBe(true);

    const cuyCurve = getStandardCurves("cuy")[0];
    expect(cuyCurve).toBeDefined();
    const curveRes = await callGET(curvasGET, `http://localhost/api/analisis/curvas?species=cuy&breed=${encodeURIComponent(cuyCurve.breed)}`);
    expect(curveRes.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────
  // P1: Clasificación NTC 1240, Lote PEPS y Bodega de Huevos
  // ─────────────────────────────────────────────────────────────
  it("P1: NTC 1240, generación PEPS, descarte y alertas de temperatura/humedad en /api/produccion/huevos", async () => {
    expect(classifyWeightNtc1240(79).code).toBe("Jumbo");
    expect(classifyWeightNtc1240(68).code).toBe("AAA");
    expect(classifyWeightNtc1240(62).code).toBe("AA");
    expect(classifyWeightNtc1240(55).code).toBe("A");
    expect(classifyWeightNtc1240(49).code).toBe("B");
    expect(classifyWeightNtc1240(43).code).toBe("C");
    expect(generateEggLotCode("2026-11-12", "gallina", "TEST")).toBe("H-20261112-GAL-TEST");
    expect(checkEggStorageTelemetry(18, 60)).toHaveLength(2);

    const [loc] = await db.insert(farmLocations).values({
      code: `TEST-GAL-${Date.now()}`,
      name: "Galpón Prueba NTC",
      type: "galpon",
      zoneType: "produccion",
      allowedSpecies: ["gallina"],
      altitudeMeters: 1850,
      floorType: "cama_profunda",
    }).returning();
    createdIds.locationIds.push(loc.id);

    const henBirthDate = new Date(Date.now() - 245 * 86400000).toISOString().split("T")[0];
    const [testHen] = await db.insert(hens).values({
      code: `G-TEST-${Date.now()}`,
      breed: "ISA Brown",
      birthDate: henBirthDate,
      status: "activa",
      locationId: loc.id,
    }).returning();
    createdIds.henIds.push(testHen.id);

    const postRes = await callWithBody(huevosPOST, "http://localhost/api/produccion/huevos", "POST", {
      date: "2026-11-12",
      species: "gallina",
      locationId: loc.id,
      totalCollected: 30,
      broken: 1,
      discarded: 2,
      forIncubation: 2,
      storageTempC: 18,
      storageHumidityPct: 60,
      overrideValidation: true,
      sizes: [{ size: "AA", quantity: 25 }],
    });
    expect(postRes.status).toBe(201);
    const prod = await parseJson(postRes);
    createdIds.eggProdIds.push(prod.id);
    expect(prod.discarded).toBe(2);
    expect(prod.lotCode).toMatch(/^H-20261112-GAL-/);

    const getRes = await callGET(huevosGET, "http://localhost/api/produccion/huevos?species=gallina");
    const list = await parseJson(getRes);
    const saved = list.find((r: any) => r.id === prod.id);
    expect(saved).toBeDefined();
    expect(saved.storageWarnings).toHaveLength(2);
  });

  // ─────────────────────────────────────────────────────────────
  // P1: Reproducción mamíferos (conejos y cuyes) + Consanguinidad + Élite
  // ─────────────────────────────────────────────────────────────
  it("P1: Reproducción mamíferos bloquea consanguinidad (409), detecta madre élite y crea lote destetado sexado", async () => {
    const [loc] = await db.insert(farmLocations).values({
      code: `TEST-CUY-${Date.now()}`,
      name: "Galpón Cuyes Test",
      type: "galpon",
      zoneType: "produccion",
      allowedSpecies: ["cuy", "conejo"],
    }).returning();
    createdIds.locationIds.push(loc.id);

    // 1. Bloqueo por consanguinidad (mismo padre del padre y madre)
    const inbRes = await callWithBody(reproPOST, "http://localhost/api/produccion/reproduccion", "POST", {
      species: "conejo",
      eventType: "empadre",
      eventDate: "2026-11-01",
      damCode: "CON-H99",
      sireCode: "CON-M99",
      damFatherCode: "ABUELO-COMUN",
      sireFatherCode: "ABUELO-COMUN",
      locationId: loc.id,
    });
    expect(inbRes.status).toBe(409);

    // 2. Empadre limpio conejo calcula palpación (+14d), nidal (+26d), parto (+31d)
    const matRes = await callWithBody(reproPOST, "http://localhost/api/produccion/reproduccion", "POST", {
      species: "conejo",
      eventType: "empadre",
      eventDate: "2026-11-01",
      damCode: "CON-H01",
      sireCode: "CON-M01",
      damFatherCode: "LINEA-A",
      sireFatherCode: "LINEA-B",
      locationId: loc.id,
    });
    expect(matRes.status).toBe(201);
    const mat = await parseJson(matRes);
    createdIds.reproIds.push(mat.id);
    expect(mat.expectedPalpationDate).toBe("2026-11-15");
    expect(mat.expectedNestboxDate).toBe("2026-11-27");
    expect(mat.expectedBirthDate).toBe("2026-12-02");

    // 3. Parto + Destete de cuy con madre élite (>=32 g/día) creando lote destetado sexado
    const partoRes = await callWithBody(reproPOST, "http://localhost/api/produccion/reproduccion", "POST", {
      species: "cuy",
      eventType: "parto",
      eventDate: "2026-10-20",
      damCode: "CUY-H01",
      sireCode: "CUY-M01",
      bornAlive: 4,
      litterBirthWeightG: 360,
      locationId: loc.id,
    });
    expect(partoRes.status).toBe(201);
    const parto = await parseJson(partoRes);
    createdIds.reproIds.push(parto.id);

    const desteteRes = await callWithBody(reproPOST, "http://localhost/api/produccion/reproduccion", "POST", {
      species: "cuy",
      eventType: "destete",
      eventDate: "2026-11-07", // 18 días
      parentEventId: parto.id,
      damCode: "CUY-H01",
      weanedMales: 2,
      weanedFemales: 2,
      litterWeanWeightG: 1080, // ganancia 720 / 18 = 40 g/día (>= 32 élite)
      createWeanedBatch: true,
      locationId: loc.id,
    });
    expect(desteteRes.status).toBe(201);
    const destete = await parseJson(desteteRes);
    createdIds.reproIds.push(destete.id);
    expect(destete.isEliteDam).toBe(true);
    expect(Number(destete.litterDailyGainG)).toBeCloseTo(40, 1);
    expect(destete.weanedBatchId).toBeTruthy();
    expect(destete.weanedBatchCode).toMatch(/^L-CUY-D/);
    createdIds.batchIds.push(destete.weanedBatchId);

    // 4. Comparativo de alimentación detecta cuy & vitaminas
    const compRes = await callGET(feedComparativoGET, "http://localhost/api/produccion/alimentacion/comparativo?days=30");
    expect(compRes.status).toBe(200);
    const comp = await parseJson(compRes);
    expect(comp.nutritionAlerts.vitaminCForCuyRecommended).toBe(true);
    expect(comp.nutritionAlerts.forageWiltingRecommended).toBe(true);

    const listRepro = await parseJson(await callGET(reproGET, "http://localhost/api/produccion/reproduccion?species=cuy"));
    expect(listRepro.some((r: any) => r.id === destete.id && r.isEliteDam)).toBe(true);

    // Probar DELETE de evento sin batch
    const delMat = await callGET(reproDELETE, `http://localhost/api/produccion/reproduccion?id=${mat.id}`);
    expect(delMat.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────
  // P1: Incubación multiespecie + Ovoscopía + Candling %
  // ─────────────────────────────────────────────────────────────
  it("P1: Incubación multiespecie (codorniz 17d / pato 28d), ovoscopía y eclosión con lote automático", async () => {
    const [loc] = await db.insert(farmLocations).values({
      code: `TEST-INC-${Date.now()}`,
      name: "Nacedora Test",
      type: "galpon",
      zoneType: "produccion",
      allowedSpecies: ["codorniz", "pato"],
    }).returning();
    createdIds.locationIds.push(loc.id);

    const codPost = await callWithBody(incubacionPOST, "http://localhost/api/produccion/incubacion", "POST", {
      species: "codorniz",
      startDate: "2026-11-01",
      eggsSet: 40,
      fertileEggs: 36,
      discardedEggs: 4,
      incubatorName: "Brinsea Ovation",
      trayCode: "B-01",
      locationId: loc.id,
    });
    expect(codPost.status).toBe(201);
    const cod = await parseJson(codPost);
    createdIds.incubationIds.push(cod.id);
    expect(cod.expectedHatchDate).toBe("2026-11-18"); // +17 días
    expect(cod.turnStopDate).toBe("2026-11-15");      // +14 días

    const patoPost = await callWithBody(incubacionPOST, "http://localhost/api/produccion/incubacion", "POST", {
      species: "pato",
      startDate: "2026-11-01",
      eggsSet: 20,
    });
    expect(patoPost.status).toBe(201);
    const pato = await parseJson(patoPost);
    createdIds.incubationIds.push(pato.id);
    expect(pato.expectedHatchDate).toBe("2026-11-29"); // +28 días
    expect(pato.turnStopDate).toBe("2026-11-26");      // +25 días

    // Completar incubación de codorniz
    const hatchRes = await callWithBody(incubacionPUT, "http://localhost/api/produccion/incubacion", "PUT", {
      id: cod.id,
      isComplete: true,
      eggsHatched: 32,
    });
    expect(hatchRes.status).toBe(200);
    const hatchBody = await parseJson(hatchRes);
    expect(hatchBody.assignment.batchCode).toMatch(/^L-COD-/);

    // Rastrear lote & adquisición recién creados para limpieza
    const [createdBatch] = await db.select().from(broilerBatches).where(eq(broilerBatches.code, hatchBody.assignment.batchCode));
    if (createdBatch) {
      createdIds.batchIds.push(createdBatch.id);
      if (createdBatch.acquisitionId) createdIds.acquisitionIds.push(createdBatch.acquisitionId);
    }

    const getInc = await parseJson(await callGET(incubacionGET, "http://localhost/api/produccion/incubacion"));
    const codRow = getInc.find((r: any) => r.id === cod.id);
    expect(codRow.fertilityPct).toBe(90);
    expect(codRow.hatchOfFertilePct).toBe(88.9);

    const delPato = await callGET(incubacionDELETE, `http://localhost/api/produccion/incubacion?id=${pato.id}`);
    expect(delPato.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────
  // P1: Candados sanitarios (aislamiento especie, vacío 21d y retiro)
  // ─────────────────────────────────────────────────────────────
  it("P1: Candados sanitarios bloquean mezcla de especies, vacío sanitario 21d y venta durante período de retiro (409)", async () => {
    const todayIso = new Date().toISOString().split("T")[0];
    const futureEmpty = new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0];

    const [locOrigin] = await db.insert(farmLocations).values({
      code: `TEST-ORI-${Date.now()}`,
      name: "Origen Test",
      type: "galpon",
      allowedSpecies: ["pollo", "gallina"],
    }).returning();
    const [locGallinaOnly] = await db.insert(farmLocations).values({
      code: `TEST-ISO-${Date.now()}`,
      name: "Solo Gallinas",
      type: "galpon",
      allowedSpecies: ["gallina"],
    }).returning();
    const [locEmpty] = await db.insert(farmLocations).values({
      code: `TEST-EMP-${Date.now()}`,
      name: "Vacío Sanitario",
      type: "galpon",
      sanitaryEmptyUntil: futureEmpty,
    }).returning();
    createdIds.locationIds.push(locOrigin.id, locGallinaOnly.id, locEmpty.id);

    const [polloBatch] = await db.insert(broilerBatches).values({
      code: `L-TEST-${Date.now()}`,
      species: "pollo",
      purpose: "engorde_carne",
      breed: "Ross 308",
      startDate: todayIso,
      initialQuantity: 25,
      currentQuantity: 25,
      locationId: locOrigin.id,
    }).returning();
    createdIds.batchIds.push(polloBatch.id);

    // 1. Aislamiento por especie -> 409
    const isoRes = await callWithBody(movimientosPOST, "http://localhost/api/ubicaciones/movimientos", "POST", {
      animalType: "lote",
      animalId: polloBatch.id,
      toLocationId: locGallinaOnly.id,
      date: todayIso,
      reason: "Prueba aislamiento",
    });
    expect(isoRes.status).toBe(409);

    // 2. Vacío sanitario 21d -> 409
    const empRes = await callWithBody(movimientosPOST, "http://localhost/api/ubicaciones/movimientos", "POST", {
      animalType: "lote",
      animalId: polloBatch.id,
      toLocationId: locEmpty.id,
      date: todayIso,
      reason: "Prueba vacío",
    });
    expect(empRes.status).toBe(409);

    // 3. Período de retiro activo en control sanitario bloquea venta de huevos en esa ubicación/especie -> 409
    const hcRes = await callWithBody(healthPOST, "http://localhost/api/sanidad/control", "POST", {
      date: todayIso,
      type: "tratamiento",
      species: "gallina",
      locationId: locOrigin.id,
      description: "Antibiótico con retiro",
      product: "Enrofloxacina Test",
      withdrawalDays: 14,
      vaccineLot: "LOT-99",
      coldChainTempC: 4.5,
    });
    expect(hcRes.status).toBe(201);
    const hc = await parseJson(hcRes);
    createdIds.healthIds.push(hc.id);
    expect(hc.withdrawalUntilDate).toBeTruthy();

    const blockedSale = await callWithBody(eggSalesPOST, "http://localhost/api/finanzas/finanzas/ventas", "POST", {
      date: todayIso,
      species: "gallina",
      locationId: locOrigin.id,
      items: [{ size: "AA", quantity: 1, pricePerUnit: 600 }],
    });
    expect(blockedSale.status).toBe(409);

    // Limpiar control con handler DELETE
    const delHc = await callGET(healthDELETE, `http://localhost/api/sanidad/control?id=${hc.id}`);
    expect(delHc.status).toBe(200);
    createdIds.healthIds.pop();
  });

  // ─────────────────────────────────────────────────────────────
  // P2: Bioseguridad ICA/INVIMA, Compostaje, Cierre Diario, Sensores y RBAC
  // ─────────────────────────────────────────────────────────────
  it("P2: Bioseguridad Res. 8452 (0/20/55/100), capacitación 5 años y exportación XLSX/CSV/JSON", async () => {
    const badWelfare = await callWithBody(bioPOST, "http://localhost/api/sanidad/bioseguridad", "POST", {
      date: "2026-11-12",
      logType: "bienestar_animal",
      welfareScore: 77,
    });
    expect(badWelfare.status).toBe(400);

    const goodWelfare = await callWithBody(bioPOST, "http://localhost/api/sanidad/bioseguridad", "POST", {
      date: "2026-11-12",
      logType: "bienestar_animal",
      welfareScore: 100,
      inspectorName: "Dra. ICA",
    });
    expect(goodWelfare.status).toBe(201);
    const bioW = await parseJson(goodWelfare);
    createdIds.bioIds.push(bioW.id);

    const capRes = await callWithBody(bioPOST, "http://localhost/api/sanidad/bioseguridad", "POST", {
      date: "2026-11-12",
      logType: "capacitacion",
      staffName: "Operario Bio",
      trainingTopic: "POE Bioseguridad Avícola",
    });
    expect(capRes.status).toBe(201);
    const cap = await parseJson(capRes);
    createdIds.bioIds.push(cap.id);
    expect(cap.trainingCertificateUntil).toBe("2031-11-12");

    // Exportaciones ICA / INVIMA / GSMI
    const jsonExp = await callGET(bioGET, "http://localhost/api/sanidad/bioseguridad?export=json");
    expect(jsonExp.status).toBe(200);
    const jsonBody = await parseJson(jsonExp);
    expect(jsonBody.authorityStandard).toContain("8452");

    const csvExp = await callGET(bioGET, "http://localhost/api/sanidad/bioseguridad?export=csv");
    expect(csvExp.status).toBe(200);
    expect(csvExp.headers.get("Content-Type")).toContain("text/csv");

    const xlsxExp = await callGET(bioGET, "http://localhost/api/sanidad/bioseguridad?export=xlsx");
    expect(xlsxExp.status).toBe(200);
    const xlsxBytes = new Uint8Array(await xlsxExp.arrayBuffer());
    expect(xlsxBytes[0]).toBe(0x50);
    expect(xlsxBytes[1]).toBe(0x4b);
  });

  it("P2: Compostaje 3:1:1 / 7:2:2, alertas >70°C y humedad >20%", async () => {
    const createRes = await callWithBody(compostPOST, "http://localhost/api/operaciones/compostaje", "POST", {
      name: "Pila Compost Prueba",
      startDate: "2026-10-01",
      formulaRatio: "3:1:1",
      manureKg: 300,
      mortalityKg: 100,
      currentTempC: 55,
      moisturePct: 50,
    });
    expect(createRes.status).toBe(201);
    const pile = await parseJson(createRes);
    createdIds.compostIds.push(pile.id);
    expect(Number(pile.carbonMaterialKg)).toBeCloseTo(100, 1);

    // Volteo con sobrecalentamiento > 70°C
    const hotRes = await callWithBody(compostPUT, "http://localhost/api/operaciones/compostaje", "PUT", {
      id: pile.id,
      action: "turn",
      currentTempC: 74,
      moisturePct: 48,
    });
    expect(hotRes.status).toBe(200);
    const hot = await parseJson(hotRes);
    expect(hot.status).toBe("alerta");
    expect(hot.alerts.some((a: string) => a.includes("70°C"))).toBe(true);

    // Cosecha con humedad > 20%
    const harvRes = await callWithBody(compostPUT, "http://localhost/api/operaciones/compostaje", "PUT", {
      id: pile.id,
      action: "harvest",
      harvestedKg: 380,
      moisturePct: 24,
    });
    expect(harvRes.status).toBe(200);
    const harv = await parseJson(harvRes);
    expect(harv.status).toBe("cosechada");
    expect(harv.alerts.some((a: string) => a.includes("20%"))).toBe(true);

    const listRes = await parseJson(await callGET(compostGET, "http://localhost/api/operaciones/compostaje"));
    expect(listRes.summary.total).toBeGreaterThanOrEqual(1);

    const delRes = await callGET(compostDELETE, `http://localhost/api/operaciones/compostaje?id=${pile.id}`);
    expect(delRes.status).toBe(200);
    createdIds.compostIds.pop();
  });

  it("P2: Cierre diario auditable (RBAC gerente/propietario), bloqueo de escritura en fechas cerradas y sensores IoT ITH/NH3", async () => {
    const testClosedDate = "2025-01-15";
    createdIds.closureDates.push(testClosedDate);

    // 1. Operario NO puede cerrar ni acceder a endpoints restringidos (RBAC 403)
    const opUser = { id: "op-1", username: "op", name: "Op", role: "operario" };
    const deniedClose = await withRole(opUser, () =>
      callWithBody(closurePOST, "http://localhost/api/operaciones/cierre-diario", "POST", { closureDate: testClosedDate }),
    );
    expect(deniedClose.status).toBe(403);

    const deniedParams = await withRole(opUser, () =>
      callWithBody(paramsPUT, "http://localhost/api/configuracion/parametros", "PUT", { key: "k", value: "v" }),
    );
    expect(deniedParams.status).toBe(403);

    const deniedHealth = await withRole(opUser, () =>
      callWithBody(healthPOST, "http://localhost/api/sanidad/control", "POST", { date: testClosedDate }),
    );
    expect(deniedHealth.status).toBe(403);

    const deniedFinance = await withRole(opUser, () =>
      callWithBody(financePOST, "http://localhost/api/finanzas/finanzas", "POST", { type: "egreso", amount: 1000 }),
    );
    expect(deniedFinance.status).toBe(403);

    // 2. Gerente puede cerrar día -> status cerrado
    const gerenteUser = { id: "test-user", username: "ger", name: "Gerente", role: "gerente" };
    const closeRes = await withRole(gerenteUser, () =>
      callWithBody(closurePOST, "http://localhost/api/operaciones/cierre-diario", "POST", { closureDate: testClosedDate }),
    );
    expect(closeRes.status).toBe(201);
    const closed = await parseJson(closeRes);
    expect(closed.status).toBe("cerrado");

    // 3. Escritura en fecha cerrada bloqueada (409)
    const blockedBio = await callWithBody(bioPOST, "http://localhost/api/sanidad/bioseguridad", "POST", {
      date: testClosedDate,
      logType: "desinfeccion",
    });
    expect(blockedBio.status).toBe(409);

    // 4. Gerente NO puede reabrir (403); propietario SÍ con motivo >= 5 chars
    const gerenteReopen = await withRole(gerenteUser, () =>
      callWithBody(closurePUT, "http://localhost/api/operaciones/cierre-diario", "PUT", {
        action: "reopen",
        closureDate: testClosedDate,
        reopenReason: "Intento no autorizado",
      }),
    );
    expect(gerenteReopen.status).toBe(403);

    const propUser = { id: "test-user", username: "prop", name: "Propietario", role: "propietario" };
    const propReopen = await withRole(propUser, () =>
      callWithBody(closurePUT, "http://localhost/api/operaciones/cierre-diario", "PUT", {
        action: "reopen",
        closureDate: testClosedDate,
        reopenReason: "Ajuste verificado por auditoría",
      }),
    );
    expect(propReopen.status).toBe(200);
    const reopened = await parseJson(propReopen);
    expect(reopened.status).toBe("reabierto");

    // 5. Sensores IoT: estrés calórico ITH >= 72 y NH3 >= 20 ppm
    const ithRes = await callWithBody(sensorPOST, "http://localhost/api/operaciones/sensores", "POST", {
      temperatureC: 31,
      humidityPct: 80,
      deviceId: "DHT22-TEST",
    });
    expect(ithRes.status).toBe(201);
    const ithRow = await parseJson(ithRes);
    createdIds.sensorIds.push(ithRow.id);
    expect(Number(ithRow.ithIndex)).toBeGreaterThanOrEqual(72);
    expect(ithRow.alertTriggered).toBe(true);

    const nh3Res = await callWithBody(sensorPOST, "http://localhost/api/operaciones/sensores", "POST", {
      metricType: "amoniaco_ppm",
      value: 25,
      deviceId: "MQ137-TEST",
    });
    expect(nh3Res.status).toBe(201);
    const nh3Row = await parseJson(nh3Res);
    createdIds.sensorIds.push(nh3Row.id);
    expect(nh3Row.alertTriggered).toBe(true);

    const getClosures = await parseJson(await callGET(closureGET, "http://localhost/api/operaciones/cierre-diario"));
    expect(getClosures.closures.some((c: any) => c.closureDate === testClosedDate)).toBe(true);

    const getSensors = await parseJson(await callGET(sensorGET, "http://localhost/api/operaciones/sensores"));
    expect(getSensors.summary.alertCount).toBeGreaterThanOrEqual(2);
  });
});
