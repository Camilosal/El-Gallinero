import { describe, it, expect, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db, mockRequest, parseJson, createTestFarmLocation } from "./helpers";
import {
  accountsReceivable,
  broilerBatches,
  chickenSales,
  farmLocations,
  manureProduction,
  manureSales,
  meatSales,
  slaughter,
  transactions,
} from "@/db/schema";
import { todayColombiaIso } from "@/lib/date-validation";
import { POST as ventasAvesPOST, PUT as ventasAvesPUT } from "@/app/api/finanzas/finanzas/ventas-aves/route";
import { POST as carneVentasPOST, GET as carneVentasGET } from "@/app/api/produccion/carne/ventas/route";
import { POST as gallinazaVentasPOST, GET as gallinazaVentasGET } from "@/app/api/produccion/gallinaza/ventas/route";
import { GET as finanzasGET, POST as finanzasPOST, PUT as finanzasPUT } from "@/app/api/finanzas/finanzas/route";
import { GET as calendarioGET } from "@/app/api/planeacion/calendario/route";

describe("multi-product sales schemas, credit receivables, and calendar sync", () => {
  const createdLocationIds: string[] = [];
  const createdBatchIds: string[] = [];
  const createdChickenSaleIds: string[] = [];
  const createdSlaughterIds: string[] = [];
  const createdMeatSaleIds: string[] = [];
  const createdManureProdIds: string[] = [];
  const createdManureSaleIds: string[] = [];
  const createdTxIds: string[] = [];

  afterAll(async () => {
    if (createdTxIds.length > 0) {
      await db.delete(accountsReceivable).where(inArray(accountsReceivable.transactionId, createdTxIds));
      await db.delete(transactions).where(inArray(transactions.id, createdTxIds));
    }
    if (createdChickenSaleIds.length > 0) {
      await db.delete(transactions).where(
        and(eq(transactions.sourceType, "venta_ave"), inArray(transactions.sourceId, createdChickenSaleIds)),
      );
      await db.delete(chickenSales).where(inArray(chickenSales.id, createdChickenSaleIds));
    }
    if (createdMeatSaleIds.length > 0) {
      await db.delete(transactions).where(
        and(eq(transactions.sourceType, "venta_carne"), inArray(transactions.sourceId, createdMeatSaleIds)),
      );
      await db.delete(meatSales).where(inArray(meatSales.id, createdMeatSaleIds));
    }
    if (createdManureSaleIds.length > 0) {
      await db.delete(transactions).where(
        and(eq(transactions.sourceType, "gallinaza"), inArray(transactions.sourceId, createdManureSaleIds)),
      );
      await db.delete(manureSales).where(inArray(manureSales.id, createdManureSaleIds));
    }
    if (createdManureProdIds.length > 0) {
      await db.delete(manureProduction).where(inArray(manureProduction.id, createdManureProdIds));
    }
    if (createdSlaughterIds.length > 0) {
      await db.delete(slaughter).where(inArray(slaughter.id, createdSlaughterIds));
    }
    if (createdBatchIds.length > 0) {
      await db.delete(broilerBatches).where(inArray(broilerBatches.id, createdBatchIds));
    }
    if (createdLocationIds.length > 0) {
      await db.delete(farmLocations).where(inArray(farmLocations.id, createdLocationIds));
    }
  });

  it("persists species and locationId on multi-species live animal sales (cuyes) and syncs credit", async () => {
    const today = todayColombiaIso();
    const location = await createTestFarmLocation();
    createdLocationIds.push(location.id);

    const [batch] = await db.insert(broilerBatches).values({
      code: `L-CUY-T-${Date.now()}`,
      species: "cuy",
      purpose: "engorde_carne",
      breed: "Perú",
      locationId: location.id,
      initialQuantity: 8,
      currentQuantity: 8,
      startDate: today,
      status: "activo",
    }).returning();
    createdBatchIds.push(batch.id);

    const postRes = await ventasAvesPOST(mockRequest("http://localhost/api/finanzas/finanzas/ventas-aves", {
      method: "POST",
      body: {
        date: today,
        birdType: "lote_cuyes",
        batchId: batch.id,
        quantity: 2,
        priceMode: "por_ave",
        pricePerUnit: 35000,
        buyer: "Criadero Test",
        isCredit: true,
        dueDate: "2026-12-10",
      },
    }));
    expect(postRes.status).toBe(201);
    const created = await parseJson(postRes);
    createdChickenSaleIds.push(created.id);
    if (created.transactionId) createdTxIds.push(created.transactionId);

    expect(created.species).toBe("cuy");
    expect(created.locationId).toBe(location.id);
    expect(created.transactionId).toBeTruthy();

    const [tx] = await db.select().from(transactions).where(eq(transactions.id, created.transactionId));
    expect(tx.category).toBe("Venta de animales");
    expect(tx.species).toBe("cuy");
    expect(tx.locationId).toBe(location.id);
    expect(tx.isCredit).toBe(true);

    const [ar] = await db.select().from(accountsReceivable).where(eq(accountsReceivable.transactionId, tx.id));
    expect(ar).toBeTruthy();
    expect(Number(ar.totalAmount)).toBe(70000);
    expect(ar.dueDate).toBe("2026-12-10");

    // PUT update should keep species & locationId and update receivable amount
    const putRes = await ventasAvesPUT(mockRequest("http://localhost/api/finanzas/finanzas/ventas-aves", {
      method: "PUT",
      body: {
        id: created.id,
        date: today,
        birdType: "lote_cuyes",
        batchId: batch.id,
        quantity: 3,
        priceMode: "por_ave",
        pricePerUnit: 35000,
        buyer: "Criadero Test",
        isCredit: true,
        dueDate: "2026-12-12",
      },
    }));
    expect(putRes.status).toBe(200);
    const updated = await parseJson(putRes);
    expect(updated.species).toBe("cuy");
    expect(updated.locationId).toBe(location.id);

    const [arUpdated] = await db.select().from(accountsReceivable).where(eq(accountsReceivable.transactionId, tx.id));
    expect(Number(arUpdated.totalAmount)).toBe(105000);
    expect(arUpdated.dueDate).toBe("2026-12-12");
  });

  it("supports credit receivables on meat sales and marks calendar sales_or_expenses done", async () => {
    const today = todayColombiaIso();
    const location = await createTestFarmLocation();
    createdLocationIds.push(location.id);

    const [slRow] = await db.insert(slaughter).values({
      date: today,
      locationId: location.id,
      species: "cuy",
      birdType: "cuy",
      quantity: 3,
      weightKg: "4.50",
      destination: "venta",
      headsExcedente: 3,
      weightKgExcedente: "4.50",
    }).returning();
    createdSlaughterIds.push(slRow.id);

    const postRes = await carneVentasPOST(mockRequest("http://localhost/api/produccion/carne/ventas", {
      method: "POST",
      body: {
        date: today,
        species: "cuy",
        locationId: location.id,
        quantityKg: 2,
        pricePerKg: 28000,
        buyer: "Restaurante Andino",
        isCredit: true,
        dueDate: "2026-12-15",
      },
    }));
    expect(postRes.status).toBe(201);
    const created = await parseJson(postRes);
    createdMeatSaleIds.push(created.id);
    if (created.transactionId) createdTxIds.push(created.transactionId);

    expect(created.transactionId).toBeTruthy();

    const listRes = await carneVentasGET(mockRequest("http://localhost/api/produccion/carne/ventas"));
    expect(listRes.status).toBe(200);
    const meatList = await parseJson(listRes);
    const found = meatList.find((row: { id: string }) => row.id === created.id);
    expect(found?.isCredit).toBe(true);
    expect(found?.dueDate).toBe("2026-12-15");

    const calRes = await calendarioGET(mockRequest("http://localhost/api/planeacion/calendario"));
    expect(calRes.status).toBe(200);
    const calData = await parseJson(calRes);
    const salesTask = calData.todayRoutineTasks?.find((t: { taskId: string }) => t.taskId === "sales_or_expenses");
    if (salesTask) {
      expect(salesTask.status).toBe("completed");
    }
  });

  it("supports credit receivables on manure sales and returns transactionId", async () => {
    const today = todayColombiaIso();
    const [prod] = await db.insert(manureProduction).values({
      date: today,
      kgProduced: "60.00",
      source: "manual",
      notes: "Test multi-sales manure",
    }).returning();
    createdManureProdIds.push(prod.id);

    const postRes = await gallinazaVentasPOST(mockRequest("http://localhost/api/produccion/gallinaza/ventas", {
      method: "POST",
      body: {
        date: today,
        quantityKg: 40,
        pricePerKg: 500,
        presentation: "bulto 40kg",
        buyer: "Vivero La Colina",
        isCredit: true,
        dueDate: "2026-12-18",
      },
    }));
    expect(postRes.status).toBe(201);
    const created = await parseJson(postRes);
    createdManureSaleIds.push(created.id);
    if (created.transactionId) createdTxIds.push(created.transactionId);

    expect(created.transactionId).toBeTruthy();

    const listRes = await gallinazaVentasGET(mockRequest("http://localhost/api/produccion/gallinaza/ventas"));
    expect(listRes.status).toBe(200);
    const list = await parseJson(listRes);
    const found = list.find((row: { id: string }) => row.id === created.id);
    expect(found?.isCredit).toBe(true);
    expect(found?.dueDate).toBe("2026-12-18");
  });

  it("creates, reads dueDate, and clears accountsReceivable on general income sales", async () => {
    const today = todayColombiaIso();
    const postRes = await finanzasPOST(mockRequest("http://localhost/api/finanzas/finanzas", {
      method: "POST",
      body: {
        date: today,
        type: "ingreso",
        category: "Venta de subproductos",
        description: "Plumas seleccionadas test",
        quantity: 5,
        unit: "kg",
        unitPrice: 8000,
        amount: 40000,
        counterparty: "Atelier Sur",
        isCredit: true,
        dueDate: "2026-12-22",
      },
    }));
    expect(postRes.status).toBe(201);
    const created = await parseJson(postRes);
    createdTxIds.push(created.id);

    const [ar] = await db.select().from(accountsReceivable).where(eq(accountsReceivable.transactionId, created.id));
    expect(ar).toBeTruthy();
    expect(Number(ar.totalAmount)).toBe(40000);
    expect(ar.dueDate).toBe("2026-12-22");

    const getRes = await finanzasGET(mockRequest("http://localhost/api/finanzas/finanzas?period=30"));
    expect(getRes.status).toBe(200);
    const finData = await parseJson(getRes);
    const txFound = finData.transactions?.find((t: { id: string }) => t.id === created.id);
    expect(txFound?.isCredit).toBe(true);
    expect(txFound?.dueDate).toBe("2026-12-22");

    // Switching to cash clears unpaid accountsReceivable
    const putRes = await finanzasPUT(mockRequest("http://localhost/api/finanzas/finanzas", {
      method: "PUT",
      body: {
        id: created.id,
        date: today,
        type: "ingreso",
        category: "Venta de subproductos",
        description: "Plumas seleccionadas test",
        amount: 40000,
        counterparty: "Atelier Sur",
        isCredit: false,
      },
    }));
    expect(putRes.status).toBe(200);
    const remainingAr = await db.select().from(accountsReceivable).where(eq(accountsReceivable.transactionId, created.id));
    expect(remainingAr).toHaveLength(0);
  });
});
