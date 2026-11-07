import { describe, it, expect, afterEach } from "vitest";
import { GET as soberaniaGET, POST as soberaniaPOST, DELETE as soberaniaDELETE } from "@/app/api/soberania/route";
import { POST as lotesPOST, DELETE as lotesDELETE } from "@/app/api/produccion/pollos/route";
import { POST as sacrificioPOST, DELETE as sacrificioDELETE } from "@/app/api/produccion/sacrificio/route";
import { mockRequest, parseJson, db } from "./helpers";
import { autoconsumoLogs, broilerBatches, slaughter } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Soberanía Alimentaria API & Flujos Multiespecie", () => {
  const cleanupBatchIds: string[] = [];
  const cleanupSlaughterIds: string[] = [];
  const cleanupLogIds: string[] = [];

  afterEach(async () => {
    for (const id of cleanupLogIds) {
      await db.delete(autoconsumoLogs).where(eq(autoconsumoLogs.id, id));
    }
    for (const id of cleanupSlaughterIds) {
      await db.delete(slaughter).where(eq(slaughter.id, id));
    }
    for (const id of cleanupBatchIds) {
      await db.delete(broilerBatches).where(eq(broilerBatches.id, id));
    }
    cleanupLogIds.length = 0;
    cleanupSlaughterIds.length = 0;
    cleanupBatchIds.length = 0;
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

    // 1. Crear lote de patos
    const loteRes = await lotesPOST(mockRequest("http://localhost/api/produccion/pollos", {
      method: "POST",
      body: {
        breed: "Pato Pekín Americano",
        species: "pato",
        initialQuantity: 10,
        targetWeeks: 9,
        targetWeightKg: "3.2",
      },
    }));
    expect(loteRes.status).toBe(201);
    const lote = await parseJson(loteRes);
    cleanupBatchIds.push(lote.id);
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
        batchId: lote.id,
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
});

