import { describe, it, expect, afterEach } from "vitest";
import { GET as soberaniaGET, POST as soberaniaPOST, DELETE as soberaniaDELETE } from "@/app/api/soberania/route";
import { POST as adquisicionesPOST } from "@/app/api/produccion/adquisiciones/route";
import { POST as sacrificioPOST, DELETE as sacrificioDELETE } from "@/app/api/produccion/sacrificio/route";
import { mockRequest, parseJson, db, createTestFarmLocation } from "./helpers";
import { autoconsumoLogs, birdAcquisitions, broilerBatches, slaughter, animalLocationMovements, farmLocations } from "@/db/schema";
import { eq, inArray, or } from "drizzle-orm";

describe("Soberanía Alimentaria API & Flujos Multiespecie", () => {
  const cleanupBatchIds: string[] = [];
  const cleanupAcquisitionIds: string[] = [];
  const cleanupSlaughterIds: string[] = [];
  const cleanupLogIds: string[] = [];
  const cleanupLocationIds: string[] = [];

  afterEach(async () => {
    if (cleanupLocationIds.length) await db.delete(animalLocationMovements).where(or(
      inArray(animalLocationMovements.fromLocationId, cleanupLocationIds),
      inArray(animalLocationMovements.toLocationId, cleanupLocationIds),
    ));
    for (const id of cleanupLogIds) {
      await db.delete(autoconsumoLogs).where(eq(autoconsumoLogs.id, id));
    }
    for (const id of cleanupSlaughterIds) {
      await db.delete(slaughter).where(eq(slaughter.id, id));
    }
    for (const id of cleanupBatchIds) {
      await db.delete(broilerBatches).where(eq(broilerBatches.id, id));
    }
    for (const id of cleanupAcquisitionIds) {
      await db.delete(birdAcquisitions).where(eq(birdAcquisitions.id, id));
    }
    if (cleanupLocationIds.length) await db.delete(farmLocations).where(inArray(farmLocations.id, cleanupLocationIds));
    cleanupLogIds.length = 0;
    cleanupLocationIds.length = 0;
    cleanupSlaughterIds.length = 0;
    cleanupBatchIds.length = 0;
    cleanupAcquisitionIds.length = 0;
  });

  it("POST /api/soberania crea un registro manual de autoconsumo y calcula ahorro", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await soberaniaPOST(mockRequest("http://localhost/api/soberania", {
      method: "POST",
      body: {
        date: today,
        species: "conejo",
        productType: "carne_canal",
        quantity: 2.5,
        unit: "kg",
        marketReferencePrice: 28000,
        destinationHousehold: "Familia Granja",
        notes: "Test conejo para almuerzo familiar",
      },
    }));

    expect(res.status).toBe(201);
    const created = await parseJson(res);
    expect(created.id).toBeDefined();
    expect(created.species).toBe("conejo");
    expect(Number(created.quantity)).toBe(2.5);
    expect(Number(created.savingsAmount)).toBe(70000); // 2.5 * 28000
    cleanupLogIds.push(created.id);

    // Verificar en GET /api/soberania
    const getRes = await soberaniaGET(mockRequest("http://localhost/api/soberania", { method: "GET" }));
    expect(getRes.status).toBe(200);
    const data = await parseJson(getRes);
    expect(data.metrics.totalSavings).toBeGreaterThanOrEqual(70000);
    expect(data.bySpecies.conejo.meatKg).toBeGreaterThanOrEqual(2.5);
  });

  it("POST /api/produccion/sacrificio con destino consumo_propio auto-registra en autoconsumo_logs", async () => {
    const today = new Date().toISOString().split("T")[0];
    const location = await createTestFarmLocation();
    cleanupLocationIds.push(location.id);

    // 1. Crear lote de patos
    const loteRes = await adquisicionesPOST(mockRequest("http://localhost/api/produccion/adquisiciones", {
      method: "POST",
      body: {
        date: today,
        acquisitionType: "donacion",
        birdType: "pato",
        quantity: 10,
        breed: "Pato Pekín",
        birthDate: today,
        purpose: "engorde_carne",
        destinationLocationId: location.id,
      },
    }));
    expect(loteRes.status).toBe(201);
    const acquisition = await parseJson(loteRes);
    cleanupAcquisitionIds.push(acquisition.id);
    const loteId = acquisition.createdBirdIds[0] as string;
    cleanupBatchIds.push(loteId);
    const [lote] = await db.select().from(broilerBatches).where(eq(broilerBatches.id, loteId));
    expect(lote.code).toMatch(/^L-PAT-\d+$/);

    // 2. Registrar faena para consumo propio
    const sacRes = await sacrificioPOST(mockRequest("http://localhost/api/produccion/sacrificio", {
      method: "POST",
      body: {
        date: today,
        birdType: "pato",
        species: "pato",
        quantity: 2,
        weightKg: "4.5", // 2 patos = 4.5 kg canal limpia
        destination: "consumo_propio",
        headsAutoconsumo: 2,
        weightKgAutoconsumo: "4.5",
        marketReferencePricePerKg: "24000",
        batchId: loteId,
        locationId: location.id,
        notes: "2 patos para la cena de fin de mes",
      },
    }));
    expect(sacRes.status).toBe(201);
    const sac = await parseJson(sacRes);
    cleanupSlaughterIds.push(sac.id);

    // 3. Verificar que se auto-generó el registro en Soberanía
    const getRes = await soberaniaGET(mockRequest("http://localhost/api/soberania?species=pato", { method: "GET" }));
    expect(getRes.status).toBe(200);
    const sobData = await parseJson(getRes);
    expect(sobData.metrics.totalMeatKg).toBeGreaterThanOrEqual(4.5);
    expect(sobData.metrics.totalSavings).toBeGreaterThanOrEqual(108000); // 4.5 * 24000
    expect(sobData.bySpecies.pato.meatKg).toBeGreaterThanOrEqual(4.5);

    // 4. Limpieza con DELETE
    const delRes = await sacrificioDELETE(mockRequest(`http://localhost/api/produccion/sacrificio?id=${sac.id}`, { method: "DELETE" }));
    expect(delRes.status).toBe(200);
  });

  it("POST/GET /api/soberania registra consumo familiar de cuy y reporta bySpecies.cuy", async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await soberaniaPOST(mockRequest("http://localhost/api/soberania", {
      method: "POST",
      body: {
        date: today,
        species: "cuy",
        productType: "carne_canal",
        quantity: 1.5,
        unit: "kg",
        marketReferencePrice: 36000,
        destinationHousehold: "Familia Granja",
        notes: "Test cuy para consumo familiar",
      },
    }));

    expect(res.status).toBe(201);
    const created = await parseJson(res);
    expect(created.species).toBe("cuy");
    expect(Number(created.savingsAmount)).toBe(54000);
    cleanupLogIds.push(created.id);

    const getRes = await soberaniaGET(mockRequest("http://localhost/api/soberania", { method: "GET" }));
    expect(getRes.status).toBe(200);
    const data = await parseJson(getRes);
    expect(data.bySpecies.cuy).toBeDefined();
    expect(data.bySpecies.cuy.meatKg).toBeGreaterThanOrEqual(1.5);
    expect(data.bySpecies.cuy.savings).toBeGreaterThanOrEqual(54000);
  });
});

