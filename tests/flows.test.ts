import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq, and } from "drizzle-orm";
import {
  db, pool, mockRequest, parseJson, createCleanup, cleanup,
  createTestFeed, getSeedFeed, getSeedStage,
  type TestCleanup,
} from "./helpers";
import { transactions, eggSales, eggSalesItems, feedInventory, feedMovements, eggProduction, eggProductionDetails, hens, roosters, broilerBatches } from "@/db/schema";

// Import route handlers
import { POST as ventasPOST, PUT as ventasPUT, DELETE as ventasDELETE } from "@/app/api/ventas/route";
import { POST as movimientosPOST, DELETE as movimientosDELETE } from "@/app/api/alimentacion/movimientos/route";
import { POST as huevosPOST, PUT as huevosPUT, DELETE as huevosDELETE, GET as huevosGET } from "@/app/api/huevos/route";
import { GET as dashboardGET } from "@/app/api/dashboard/route";
import { GET as resumenGET } from "@/app/api/etapas/resumen/route";
import { POST as finanzasPOST, DELETE as finanzasDELETE } from "@/app/api/finanzas/route";
import { GET as gallinasGET, POST as gallinasPOST, PUT as gallinasPUT } from "@/app/api/gallinas/route";
import { requiredRoosters, assignMales, batchReadiness, flockBalance } from "@/lib/flock";
import { POST as incubacionPOST, PUT as incubacionPUT, DELETE as incubacionDELETE } from "@/app/api/incubacion/route";
import { GET as gallosGET } from "@/app/api/gallos/route";
import { GET as lotesGET, POST as lotesPOST } from "@/app/api/lotes-pollos/route";
import { POST as sacrificioPOST, DELETE as sacrificioDELETE } from "@/app/api/sacrificio/route";
import { GET as gallinazaGET, POST as gallinazaPOST, DELETE as gallinazaDELETE } from "@/app/api/gallinaza/route";

let cleanupData: TestCleanup & { productionDetailIds?: string[] };

beforeAll(async () => {
  // Ensure DB connection is alive
  await db.select().from(eggProduction).limit(1);
});

afterAll(async () => {
  await pool.end();
});

afterEach(async () => {
  if (cleanupData) await cleanup(cleanupData);
});

// ═══════════════════════════════════════════════════════════════
// INCOME FLOW: Ventas → Transactions
// ═══════════════════════════════════════════════════════════════
describe("Income Flow (Ventas → Transactions)", () => {
  it("POST /api/ventas creates a sale AND auto-registers an income transaction", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    const res = await ventasPOST(mockRequest("http://localhost/api/ventas", {
      method: "POST",
      body: {
        date: today,
        buyer: "Test Buyer",
        notes: "Integration test sale",
        items: [
          { size: "Grande", quantity: 12, presentations: 1, pricePerUnit: 7200, presentation: "Docena" },
        ],
      },
    }));

    expect(res.status).toBe(201);
    const sale = await parseJson(res);
    cleanupData.saleIds.push(sale.id);

    // Verify sale was created correctly
    expect(sale.quantity).toBe(12);
    expect(sale.size).toBe("Grande");
    expect(sale.totalAmount).toBe("7200.00"); // 1 presentation × 7200

    // Verify items were created
    expect(sale.items).toBeDefined();
    expect(sale.items.length).toBe(1);
    expect(sale.items[0].size).toBe("Grande");
    expect(sale.items[0].quantity).toBe(12);

    // Verify linked income transaction was auto-created
    const [linkedTx] = await db.select().from(transactions)
      .where(and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, sale.id)));
    expect(linkedTx).toBeDefined();
    expect(linkedTx.type).toBe("ingreso");
    expect(linkedTx.category).toBe("Venta de huevos");
    expect(Number(linkedTx.amount)).toBe(7200);
    expect(Number(linkedTx.quantity)).toBe(12);
    expect(linkedTx.counterparty).toBe("Test Buyer");
    cleanupData.transactionIds.push(linkedTx.id);
  });

  it("POST /api/ventas rejects sale when not enough eggs available", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    // Try to sell more eggs than produced (no production records for a fictional size)
    const res = await ventasPOST(mockRequest("http://localhost/api/ventas", {
      method: "POST",
      body: {
        date: today,
        items: [
          { size: "Jumbo", quantity: 999999, pricePerUnit: 800 },
        ],
      },
    }));

    expect(res.status).toBe(400);
    const data = await parseJson(res);
    expect(data.error).toContain("No hay suficientes huevos");
  });

  it("PUT /api/ventas updates sale AND syncs the linked transaction", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    // Garantizar stock de "Mediano" independiente del seed (que es aleatorio):
    // registrar producción propia de 50 huevos para que la actualización a
    // 24 siempre tenga disponibilidad suficiente.
    const [testProduction] = await db.insert(eggProduction).values({
      date: today,
      totalCollected: 50,
      broken: 0,
      forIncubation: 0,
      notes: "Producción de prueba para PUT /api/ventas",
    }).returning();
    cleanupData.productionIds.push(testProduction.id);
    await db.insert(eggProductionDetails).values({
      productionId: testProduction.id,
      size: "Mediano",
      quantity: 50,
    });

    // Create initial sale: 1 docena (12 eggs) at $7,200/docena
    const createRes = await ventasPOST(mockRequest("http://localhost/api/ventas", {
      method: "POST",
      body: { date: today, items: [{ size: "Mediano", quantity: 12, presentations: 1, pricePerUnit: 7200, presentation: "Docena" }] },
    }));
    const sale = await parseJson(createRes);
    cleanupData.saleIds.push(sale.id);

    // Update the sale: 2 docenas (24 eggs) at $7,200/docena
    const updateRes = await ventasPUT(mockRequest("http://localhost/api/ventas", {
      method: "PUT",
      body: { id: sale.id, date: today, items: [{ size: "Mediano", quantity: 24, presentations: 2, pricePerUnit: 7200, presentation: "Docena" }] },
    }));
    expect(updateRes.status).toBe(200);

    // Verify transaction was synced
    const [linkedTx] = await db.select().from(transactions)
      .where(and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, sale.id)));
    expect(linkedTx).toBeDefined();
    expect(Number(linkedTx.amount)).toBe(14400); // 2 presentations × 7200
    expect(Number(linkedTx.quantity)).toBe(24);
    cleanupData.transactionIds.push(linkedTx.id);
  });

  it("DELETE /api/ventas removes sale AND its linked transaction", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    // Create a sale
    const createRes = await ventasPOST(mockRequest("http://localhost/api/ventas", {
      method: "POST",
      body: { date: today, items: [{ size: "Pequeño", quantity: 10, pricePerUnit: 400 }] },
    }));
    const sale = await parseJson(createRes);

    // Delete it
    const deleteRes = await ventasDELETE(mockRequest(`http://localhost/api/ventas?id=${sale.id}`, {
      method: "DELETE",
    }));
    expect(deleteRes.status).toBe(200);

    // Verify sale is gone
    const [deletedSale] = await db.select().from(eggSales).where(eq(eggSales.id, sale.id));
    expect(deletedSale).toBeUndefined();

    // Verify linked transaction is also gone
    const [deletedTx] = await db.select().from(transactions)
      .where(and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, sale.id)));
    expect(deletedTx).toBeUndefined();
  });

  it("POST /api/ventas supports multi-size sales in a single transaction", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    const res = await ventasPOST(mockRequest("http://localhost/api/ventas", {
      method: "POST",
      body: {
        date: today,
        buyer: "Multi Buyer",
        items: [
          { size: "Grande", quantity: 10, presentations: 10, pricePerUnit: 600, presentation: "Unidad" },
          { size: "Mediano", quantity: 12, presentations: 1, pricePerUnit: 7200, presentation: "Docena" },
        ],
      },
    }));

    expect(res.status).toBe(201);
    const sale = await parseJson(res);
    cleanupData.saleIds.push(sale.id);

    // Verify parent sale has total quantity and amount
    expect(sale.quantity).toBe(22); // 10 + 12
    expect(sale.totalAmount).toBe("13200.00"); // (10×600) + (1×7200)
    expect(sale.size).toBeNull(); // null for multi-size

    // Verify items were created
    expect(sale.items.length).toBe(2);
    const grande = sale.items.find((i: any) => i.size === "Grande");
    const mediano = sale.items.find((i: any) => i.size === "Mediano");
    expect(grande.quantity).toBe(10);
    expect(Number(grande.totalAmount)).toBe(6000);
    expect(mediano.quantity).toBe(12);
    expect(Number(mediano.totalAmount)).toBe(7200);

    // Verify linked transaction
    const [linkedTx] = await db.select().from(transactions)
      .where(and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, sale.id)));
    expect(Number(linkedTx.amount)).toBe(13200);
    expect(Number(linkedTx.quantity)).toBe(22);
    cleanupData.transactionIds.push(linkedTx.id);
  });
});

// ═══════════════════════════════════════════════════════════════
// EXPENSE FLOW: Alimentación → Stock + Transactions
// ═══════════════════════════════════════════════════════════════
describe("Expense Flow (Alimentación → Stock + Transactions)", () => {
  it("POST entry for suplementario feed auto-creates an expense transaction", async () => {
    cleanupData = createCleanup();
    const feed = await createTestFeed({
      category: "suplementario",
      costPerUnit: "9500",
      currentStock: "50",
      supplier: "Test Supplier",
    });
    cleanupData.feedIds.push(feed.id);
    const today = new Date().toISOString().split("T")[0];

    // Register a feed entry (purchase)
    const res = await movimientosPOST(mockRequest("http://localhost/api/alimentacion/movimientos", {
      method: "POST",
      body: {
        feedId: feed.id,
        quantity: "25",
        isEntry: true,
        date: today,
        notes: "Compra de prueba",
      },
    }));

    expect(res.status).toBe(201);
    const mov = await parseJson(res);
    cleanupData.movementIds.push(mov.id);

    // Verify stock was increased
    const [updatedFeed] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(updatedFeed.currentStock)).toBe(75); // 50 + 25

    // Verify expense transaction was auto-created
    const [linkedTx] = await db.select().from(transactions)
      .where(and(eq(transactions.sourceType, "alimento"), eq(transactions.sourceId, mov.id)));
    expect(linkedTx).toBeDefined();
    expect(linkedTx.type).toBe("egreso");
    expect(linkedTx.category).toBe("Compra de alimento");
    expect(Number(linkedTx.amount)).toBe(237500); // 25 × 9500
    expect(linkedTx.counterparty).toBe("Test Supplier");
    cleanupData.transactionIds.push(linkedTx.id);
  });

  it("POST consumption reduces stock correctly", async () => {
    cleanupData = createCleanup();
    const feed = await createTestFeed({ currentStock: "80" });
    cleanupData.feedIds.push(feed.id);
    const today = new Date().toISOString().split("T")[0];

    const res = await movimientosPOST(mockRequest("http://localhost/api/alimentacion/movimientos", {
      method: "POST",
      body: { feedId: feed.id, quantity: "30", isEntry: false, date: today },
    }));

    expect(res.status).toBe(201);
    const mov = await parseJson(res);
    cleanupData.movementIds.push(mov.id);

    // Verify stock was decreased
    const [updatedFeed] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(updatedFeed.currentStock)).toBe(50); // 80 - 30
  });

  it("POST consumption rejects if stock is insufficient", async () => {
    cleanupData = createCleanup();
    const feed = await createTestFeed({ currentStock: "10" });
    cleanupData.feedIds.push(feed.id);
    const today = new Date().toISOString().split("T")[0];

    const res = await movimientosPOST(mockRequest("http://localhost/api/alimentacion/movimientos", {
      method: "POST",
      body: { feedId: feed.id, quantity: "50", isEntry: false, date: today },
    }));

    expect(res.status).toBe(400);
    const data = await parseJson(res);
    expect(data.error).toContain("Stock insuficiente");
  });

  it("DELETE movement reverses stock change correctly", async () => {
    cleanupData = createCleanup();
    const feed = await createTestFeed({ currentStock: "100" });
    cleanupData.feedIds.push(feed.id);
    const today = new Date().toISOString().split("T")[0];

    // Create a consumption movement
    const createRes = await movimientosPOST(mockRequest("http://localhost/api/alimentacion/movimientos", {
      method: "POST",
      body: { feedId: feed.id, quantity: "40", isEntry: false, date: today },
    }));
    const mov = await parseJson(createRes);
    cleanupData.movementIds.push(mov.id);

    // Stock should be 60 now
    let [f] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(f.currentStock)).toBe(60);

    // Delete the movement → stock should revert to 100
    const deleteRes = await movimientosDELETE(mockRequest(`http://localhost/api/alimentacion/movimientos?id=${mov.id}`, {
      method: "DELETE",
    }));
    expect(deleteRes.status).toBe(200);

    [f] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(f.currentStock)).toBe(100);
  });

  it("POST entry for granja_fresco feed does NOT create expense (cost is 0)", async () => {
    cleanupData = createCleanup();
    const feed = await createTestFeed({
      category: "granja_fresco",
      costPerUnit: "0",
      currentStock: "50",
    });
    cleanupData.feedIds.push(feed.id);
    const today = new Date().toISOString().split("T")[0];

    const res = await movimientosPOST(mockRequest("http://localhost/api/alimentacion/movimientos", {
      method: "POST",
      body: { feedId: feed.id, quantity: "20", isEntry: true, date: today },
    }));

    expect(res.status).toBe(201);
    const mov = await parseJson(res);
    cleanupData.movementIds.push(mov.id);

    // Verify NO transaction was created (cost is 0)
    const linkedTx = await db.select().from(transactions)
      .where(and(eq(transactions.sourceType, "alimento"), eq(transactions.sourceId, mov.id)));
    expect(linkedTx.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// PRODUCTION FLOW: Huevos
// ═══════════════════════════════════════════════════════════════
describe("Production Flow (Huevos)", () => {
  it("POST /api/huevos creates production record with size details", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    const res = await huevosPOST(mockRequest("http://localhost/api/huevos", {
      method: "POST",
      body: {
        date: today,
        sizes: [
          { size: "Grande", quantity: 45 },
          { size: "Mediano", quantity: 20 },
          { size: "Jumbo", quantity: 8 },
        ],
        broken: 3,
        forIncubation: 2,
        notes: "Test production",
        overrideValidation: true,
      },
    }));

    expect(res.status).toBe(201);
    const created = await parseJson(res);
    cleanupData.productionIds.push(created.id);

    // Verify totalCollected = 45 + 20 + 8 + 3 + 2 = 78
    expect(created.totalCollected).toBe(78);
    expect(created.broken).toBe(3);
    expect(created.forIncubation).toBe(2);

    // Verify details were created
    const details = await db.select().from(eggProductionDetails)
      .where(eq(eggProductionDetails.productionId, created.id));
    expect(details.length).toBe(3);
    expect(details.find((d) => d.size === "Grande")?.quantity).toBe(45);
    expect(details.find((d) => d.size === "Mediano")?.quantity).toBe(20);
    expect(details.find((d) => d.size === "Jumbo")?.quantity).toBe(8);
  });

  it("PUT /api/huevos updates record and replaces size details", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    // Create initial record
    const createRes = await huevosPOST(mockRequest("http://localhost/api/huevos", {
      method: "POST",
      body: {
        date: today,
        sizes: [{ size: "Grande", quantity: 30 }],
        broken: 2,
        forIncubation: 1,
        overrideValidation: true,
      },
    }));
    const created = await parseJson(createRes);
    cleanupData.productionIds.push(created.id);

    // Update with different sizes
    const updateRes = await huevosPUT(mockRequest("http://localhost/api/huevos", {
      method: "PUT",
      body: {
        id: created.id,
        date: today,
        sizes: [
          { size: "Extra", quantity: 50 },
          { size: "Pequeño", quantity: 15 },
        ],
        broken: 5,
        forIncubation: 0,
        notes: "Updated",
        overrideValidation: true,
      },
    }));
    expect(updateRes.status).toBe(200);

    // Verify old details were replaced
    const details = await db.select().from(eggProductionDetails)
      .where(eq(eggProductionDetails.productionId, created.id));
    expect(details.length).toBe(2);
    expect(details.find((d) => d.size === "Extra")?.quantity).toBe(50);
    expect(details.find((d) => d.size === "Pequeño")?.quantity).toBe(15);
    // Old "Grande" should be gone
    expect(details.find((d) => d.size === "Grande")).toBeUndefined();

    // Verify totalCollected = 50 + 15 + 5 + 0 = 70
    const [updated] = await db.select().from(eggProduction).where(eq(eggProduction.id, created.id));
    expect(updated.totalCollected).toBe(70);
  });

  it("DELETE /api/huevos removes record and cascades details", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    const createRes = await huevosPOST(mockRequest("http://localhost/api/huevos", {
      method: "POST",
      body: {
        date: today,
        sizes: [{ size: "Grande", quantity: 25 }],
        broken: 1,
        forIncubation: 0,
        overrideValidation: true,
      },
    }));
    const created = await parseJson(createRes);

    // Delete it
    const deleteRes = await huevosDELETE(mockRequest(`http://localhost/api/huevos?id=${created.id}`, {
      method: "DELETE",
    }));
    expect(deleteRes.status).toBe(200);

    // Verify record is gone
    const [deleted] = await db.select().from(eggProduction).where(eq(eggProduction.id, created.id));
    expect(deleted).toBeUndefined();

    // Verify details are gone (cascade)
    const details = await db.select().from(eggProductionDetails)
      .where(eq(eggProductionDetails.productionId, created.id));
    expect(details.length).toBe(0);
  });

  it("GET /api/huevos returns records with nested details", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    // Create a production record
    await huevosPOST(mockRequest("http://localhost/api/huevos", {
      method: "POST",
      body: {
        date: today,
        sizes: [{ size: "Grande", quantity: 40 }, { size: "Mediano", quantity: 10 }],
        broken: 2,
        forIncubation: 1,
        overrideValidation: true,
      },
    }));

    const res = await huevosGET();
    const records = await parseJson(res);

    // The record we just created should be in the list
    const found = records.find((r: any) => r.date === today && r.totalCollected === 53);
    expect(found).toBeDefined();
    expect(found.details.length).toBe(2);
    cleanupData.productionIds.push(found.id);
  });

  it("POST /api/huevos returns 409 when production greatly exceeds expected", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    // Try to register an absurdly high production (no override)
    const res = await huevosPOST(mockRequest("http://localhost/api/huevos", {
      method: "POST",
      body: {
        date: today,
        sizes: [{ size: "Grande", quantity: 99999 }],
        broken: 0,
        forIncubation: 0,
      },
    }));

    // If there are active hens with expected production, should get 409
    // If no expected production configured, it will succeed (201)
    const data = await parseJson(res);
    if (res.status === 409) {
      expect(data.warning).toBe(true);
      expect(data.actual).toBe(99999);
      expect(data.expected).toBeGreaterThan(0);
    } else {
      // No expected production configured — cleanup the record
      expect(res.status).toBe(201);
      cleanupData.productionIds.push(data.id);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// CROSS-MODULE CORRELATIONS
// ═══════════════════════════════════════════════════════════════
describe("Cross-Module Correlations", () => {
  it("Dashboard includes stage distribution and stock projection", async () => {
    cleanupData = createCleanup();

    const res = await dashboardGET();
    expect(res.status).toBe(200);
    const data = await parseJson(res);

    // Verify structure
    expect(data.hens).toBeDefined();
    expect(data.stages).toBeDefined();
    expect(Array.isArray(data.stages)).toBe(true);
    expect(data.stockProjection).toBeDefined();
    expect(Array.isArray(data.stockProjection)).toBe(true);
    expect(typeof data.totalExpectedEggsPerDay).toBe("number");

    // Stages should have name, count, expectedEggsPerDay
    for (const stage of data.stages) {
      expect(stage).toHaveProperty("name");
      expect(stage).toHaveProperty("count");
      expect(stage).toHaveProperty("expectedEggsPerDay");
      expect(typeof stage.count).toBe("number");
    }

    // Stock projection should have feedId, feedName, dailyNeedKg, daysRemaining
    for (const item of data.stockProjection) {
      expect(item).toHaveProperty("feedId");
      expect(item).toHaveProperty("feedName");
      expect(item).toHaveProperty("dailyNeedKg");
      expect(item).toHaveProperty("currentStockKg");
      expect(item).toHaveProperty("daysRemaining");
    }
  });

  it("Etapas resumen computes stock projection and consumption correlation", async () => {
    cleanupData = createCleanup();

    const res = await resumenGET();
    expect(res.status).toBe(200);
    const data = await parseJson(res);

    // Verify structure
    expect(typeof data.totalHens).toBe("number");
    expect(typeof data.totalExpectedEggsPerDay).toBe("number");
    expect(Array.isArray(data.stages)).toBe(true);
    expect(Array.isArray(data.stockProjection)).toBe(true);
    expect(Array.isArray(data.consumptionVsExpected)).toBe(true);

    // Each stage should have henCount, expectedEggs, feedBreakdown
    for (const stage of data.stages) {
      expect(stage).toHaveProperty("stageId");
      expect(stage).toHaveProperty("henCount");
      expect(stage).toHaveProperty("expectedEggs");
      expect(stage).toHaveProperty("totalDailyFeedGrams");
      expect(stage).toHaveProperty("feedBreakdown");
      expect(typeof stage.henCount).toBe("number");
    }

    // Stock projection should include daysRemaining
    for (const item of data.stockProjection) {
      expect(item).toHaveProperty("feedId");
      expect(item).toHaveProperty("daysRemaining");
      expect(item).toHaveProperty("dailyNeedKg");
    }
  });

  it("Income + expense flow: finances reflect both sales and feed purchases", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    // 1. Create a feed purchase (expense)
    const feed = await createTestFeed({
      category: "suplementario",
      costPerUnit: "10000",
      currentStock: "0",
      supplier: "Test Farm",
    });
    cleanupData.feedIds.push(feed.id);

    const movRes = await movimientosPOST(mockRequest("http://localhost/api/alimentacion/movimientos", {
      method: "POST",
      body: { feedId: feed.id, quantity: "50", isEntry: true, date: today },
    }));
    const mov = await parseJson(movRes);
    cleanupData.movementIds.push(mov.id);

    // Verify expense transaction
    const [expenseTx] = await db.select().from(transactions)
      .where(and(eq(transactions.sourceType, "alimento"), eq(transactions.sourceId, mov.id)));
    expect(Number(expenseTx.amount)).toBe(500000); // 50 × 10000
    cleanupData.transactionIds.push(expenseTx.id);

    // 2. Create a sale (income) - 1 docena (12 eggs) at $7,200
    const saleRes = await ventasPOST(mockRequest("http://localhost/api/ventas", {
      method: "POST",
      body: { date: today, buyer: "Test Client", items: [{ size: "Grande", quantity: 12, presentations: 1, pricePerUnit: 7200, presentation: "Docena" }] },
    }));
    const sale = await parseJson(saleRes);
    cleanupData.saleIds.push(sale.id);

    // Verify income transaction
    const [incomeTx] = await db.select().from(transactions)
      .where(and(eq(transactions.sourceType, "venta"), eq(transactions.sourceId, sale.id)));
    expect(Number(incomeTx.amount)).toBe(7200); // 1 presentation × 7200
    cleanupData.transactionIds.push(incomeTx.id);

    // 3. Verify both transactions exist with correct types
    const allTxs = await db.select().from(transactions)
      .where(eq(transactions.sourceType, "alimento"));
    const myExpense = allTxs.find((t) => t.id === expenseTx.id);
    expect(myExpense).toBeDefined();
    expect(myExpense!.type).toBe("egreso");

    const incomeTxs = await db.select().from(transactions)
      .where(eq(transactions.sourceType, "venta"));
    const myIncome = incomeTxs.find((t) => t.id === incomeTx.id);
    expect(myIncome).toBeDefined();
    expect(myIncome!.type).toBe("ingreso");
  });
});

// ═══════════════════════════════════════════════════════════════
// EXPENSE PRESENTATIONS: Purchase presentations + stock update
// ═══════════════════════════════════════════════════════════════
describe("Expense Presentations (Finanzas)", () => {
  it("POST /api/finanzas creates a feed purchase with presentation and updates stock", async () => {
    cleanupData = createCleanup();
    const feed = await createTestFeed({
      category: "suplementario",
      costPerUnit: "9500",
      currentStock: "15",
      supplier: "Test Supplier",
    });
    cleanupData.feedIds.push(feed.id);
    const today = new Date().toISOString().split("T")[0];

    // Buy 2 bultos de 25kg at $95,000/bulto = $190,000 total, 50 kg
    const res = await finanzasPOST(mockRequest("http://localhost/api/finanzas", {
      method: "POST",
      body: {
        type: "egreso",
        category: "Compra de alimento",
        description: "Concentrado comercial",
        counterparty: "Test Supplier",
        feedId: feed.id,
        presentation: "Bulto 25kg",
        presentations: 2,
        pricePerPresentation: 95000,
        factor: 25,
        date: today,
      },
    }));

    expect(res.status).toBe(201);
    const tx = await parseJson(res);
    cleanupData.transactionIds.push(tx.id);

    // Verify transaction fields
    expect(Number(tx.amount)).toBe(190000); // 2 × 95000
    expect(Number(tx.quantity)).toBe(50); // 2 × 25 kg
    expect(tx.presentation).toBe("Bulto 25kg");
    expect(tx.unit).toBe("kg");
    expect(Number(tx.unitPrice)).toBeCloseTo(3800, 0); // 95000 / 25

    // Verify stock was updated: 15 + 50 = 65
    const [updatedFeed] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(updatedFeed.currentStock)).toBe(65);

    // Verify average cost was recalculated
    // Old: 15 kg × $9,500 = $142,500
    // New: 50 kg × $3,800 = $190,000
    // Avg: ($142,500 + $190,000) / (15 + 50) = $332,500 / 65 ≈ $5,115.38
    expect(Number(updatedFeed.costPerUnit)).toBeCloseTo(5115.38, 0);

    // Verify a feed movement was created
    const [movement] = await db.select().from(feedMovements)
      .where(and(eq(feedMovements.feedId, feed.id), eq(feedMovements.isEntry, true)));
    expect(movement).toBeDefined();
    expect(Number(movement.quantity)).toBe(50);
    cleanupData.movementIds.push(movement.id);
  });

  it("POST /api/finanzas creates a non-feed purchase with presentation (no stock update)", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    // Buy 1 unidad at $80,000 for "Control sanitario"
    const res = await finanzasPOST(mockRequest("http://localhost/api/finanzas", {
      method: "POST",
      body: {
        type: "egreso",
        category: "Control sanitario",
        description: "Vacuna Newcastle",
        counterparty: "Tienda veterinaria",
        presentation: "Unidad",
        presentations: 1,
        pricePerPresentation: 80000,
        factor: 1,
        date: today,
      },
    }));

    expect(res.status).toBe(201);
    const tx = await parseJson(res);
    cleanupData.transactionIds.push(tx.id);

    expect(Number(tx.amount)).toBe(80000);
    expect(Number(tx.quantity)).toBe(1);
    expect(tx.presentation).toBe("Unidad");
    expect(tx.sourceType).toBeNull(); // No feed movement linked
  });

  it("POST /api/finanzas legacy path still works without presentation data", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    const res = await finanzasPOST(mockRequest("http://localhost/api/finanzas", {
      method: "POST",
      body: {
        type: "egreso",
        category: "Mantenimiento",
        description: "Reparación de cerca",
        amount: "120000",
        date: today,
      },
    }));

    expect(res.status).toBe(201);
    const tx = await parseJson(res);
    cleanupData.transactionIds.push(tx.id);

    expect(Number(tx.amount)).toBe(120000);
    expect(tx.presentation).toBeNull();
  });

  it("DELETE /api/finanzas reverses stock when deleting a feed purchase with presentation", async () => {
    cleanupData = createCleanup();
    const feed = await createTestFeed({
      category: "suplementario",
      costPerUnit: "5000",
      currentStock: "100",
      supplier: "Test Farm",
    });
    cleanupData.feedIds.push(feed.id);
    const today = new Date().toISOString().split("T")[0];

    // Create a feed purchase: 1 bulto 50kg at $100,000 = 50 kg
    const createRes = await finanzasPOST(mockRequest("http://localhost/api/finanzas", {
      method: "POST",
      body: {
        type: "egreso",
        category: "Compra de alimento",
        description: "Maíz",
        feedId: feed.id,
        presentation: "Bulto 50kg",
        presentations: 1,
        pricePerPresentation: 100000,
        factor: 50,
        date: today,
      },
    }));
    expect(createRes.status).toBe(201);
    const tx = await parseJson(createRes);

    // Stock should be 100 + 50 = 150
    let [f] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(f.currentStock)).toBe(150);

    // Delete the transaction
    const deleteRes = await finanzasDELETE(mockRequest(`http://localhost/api/finanzas?id=${tx.id}`, {
      method: "DELETE",
    }));
    expect(deleteRes.status).toBe(200);

    // Stock should revert to 100
    [f] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(f.currentStock)).toBe(100);

    // Verify transaction is gone
    const [deletedTx] = await db.select().from(transactions).where(eq(transactions.id, tx.id));
    expect(deletedTx).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// HEN LIFECYCLE: transiciones automáticas de estado por edad/peso
// ═══════════════════════════════════════════════════════════════
describe("Hen Lifecycle (Estados automáticos)", () => {
  it("POST /api/gallinas resuelve automáticamente recomendada_sacrificio por edad (fin de postura)", async () => {
    cleanupData = createCleanup();
    const oldDate = new Date(Date.now() - 85 * 7 * 86400000).toISOString().split("T")[0];
    const res = await gallinasPOST(mockRequest("http://localhost/api/gallinas", {
      method: "POST",
      body: { code: "TEST-LC-OLD", breed: "Criolla", birthDate: oldDate, status: "activa", weight: "1.8" },
    }));
    expect(res.status).toBe(201);
    const hen = await parseJson(res);
    cleanupData.henIds.push(hen.id);

    expect(hen.status).toBe("recomendada_sacrificio");
    expect(hen.stage).toBe("Postura");
    expect(hen.lifecycleReasons.some((r: string) => r.includes("postura"))).toBe(true);
  });

  it("POST /api/gallinas recomienda sacrificio cuando el peso es adecuado para venta", async () => {
    cleanupData = createCleanup();
    const youngDate = new Date(Date.now() - 25 * 7 * 86400000).toISOString().split("T")[0];
    const res = await gallinasPOST(mockRequest("http://localhost/api/gallinas", {
      method: "POST",
      body: { code: "TEST-LC-WEIGHT", breed: "Criolla", birthDate: youngDate, status: "activa", weight: "2.9" },
    }));
    expect(res.status).toBe(201);
    const hen = await parseJson(res);
    cleanupData.henIds.push(hen.id);

    expect(hen.status).toBe("recomendada_sacrificio");
    expect(hen.lifecycleReasons.some((r: string) => r.includes("Peso"))).toBe(true);
  });

  it("Gallina joven y liviana permanece activa y los estados terminales nunca se revierten", async () => {
    cleanupData = createCleanup();
    const youngDate = new Date(Date.now() - 10 * 7 * 86400000).toISOString().split("T")[0];
    const res = await gallinasPOST(mockRequest("http://localhost/api/gallinas", {
      method: "POST",
      body: { code: "TEST-LC-YOUNG", breed: "Leghorn", birthDate: youngDate, status: "activa", weight: "1.0" },
    }));
    expect(res.status).toBe(201);
    const hen = await parseJson(res);
    cleanupData.henIds.push(hen.id);
    expect(hen.status).toBe("activa");
    expect(hen.lifecycleReasons).toHaveLength(0);

    // Marcar como vendida (estado terminal de salida del sistema)
    const updRes = await gallinasPUT(mockRequest("http://localhost/api/gallinas", {
      method: "PUT",
      body: { id: hen.id, code: hen.code, breed: hen.breed, birthDate: hen.birthDate, status: "vendida", weight: hen.weight, notes: hen.notes, isBroody: hen.isBroody, clutchSize: hen.clutchSize },
    }));
    const updated = await parseJson(updRes);
    expect(updated.status).toBe("vendida");

    // El GET (sincronización automática) no debe revertir el estado terminal
    const list = await parseJson(await gallinasGET());
    const found = list.find((h: { id: string }) => h.id === hen.id);
    expect(found.status).toBe("vendida");
  });
});

// ═══════════════════════════════════════════════════════════════
// FLOCK RULES: regla de parvada (gallos y lotes)
// ═══════════════════════════════════════════════════════════════
describe("Flock Rules (Regla de parvada)", () => {
  it("requiredRoosters calcula 1 gallo por cada 10 gallinas", () => {
    expect(requiredRoosters(0)).toBe(0);
    expect(requiredRoosters(1)).toBe(1);
    expect(requiredRoosters(10)).toBe(1);
    expect(requiredRoosters(30)).toBe(3);
    expect(requiredRoosters(31)).toBe(4);
  });

  it("assignMales cubre el déficit de gallos y destina el resto a sacrificio", () => {
    expect(assignMales(5, 1, 3)).toEqual({ toRoosters: 2, toSlaughter: 3 });
    expect(assignMales(1, 0, 3)).toEqual({ toRoosters: 1, toSlaughter: 0 });
    expect(assignMales(2, 3, 3)).toEqual({ toRoosters: 0, toSlaughter: 2 });
    expect(assignMales(0, 0, 3)).toEqual({ toRoosters: 0, toSlaughter: 0 });
  });

  it("batchReadiness marca listo por edad objetivo", () => {
    const fiftyDaysAgo = new Date(Date.now() - 50 * 86400000).toISOString().split("T")[0];
    const r = batchReadiness({ startDate: fiftyDaysAgo, targetWeeks: 7, targetWeightKg: "2.5", avgWeightKg: "1.0" });
    expect(r.ready).toBe(true);
    expect(r.ageWeeks).toBeGreaterThanOrEqual(7);
    expect(r.reasons.some((x) => x.includes("Edad"))).toBe(true);
  });

  it("batchReadiness marca listo por peso objetivo", () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 86400000).toISOString().split("T")[0];
    const r = batchReadiness({ startDate: twentyDaysAgo, targetWeeks: 7, targetWeightKg: "2.5", avgWeightKg: "2.6" });
    expect(r.ready).toBe(true);
    expect(r.reasons.some((x) => x.includes("Peso"))).toBe(true);
  });

  it("batchReadiness no marca listo un lote joven y liviano", () => {
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 86400000).toISOString().split("T")[0];
    const r = batchReadiness({ startDate: twentyOneDaysAgo, targetWeeks: 7, targetWeightKg: "2.5", avgWeightKg: "1.5" });
    expect(r.ready).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });

  it("flockBalance calcula déficit y superávit", () => {
    expect(flockBalance(30, 2)).toEqual({ required: 3, active: 2, deficit: 1, surplus: 0 });
    expect(flockBalance(30, 5)).toEqual({ required: 3, active: 5, deficit: 0, surplus: 2 });
    expect(flockBalance(0, 0)).toEqual({ required: 0, active: 0, deficit: 0, surplus: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════
// INCUBACIÓN → ASIGNACIÓN AUTOMÁTICA DE MACHOS
// ═══════════════════════════════════════════════════════════════
describe("Incubación (asignación automática de machos)", () => {
  it("Al completar eclosión crea gallinas, gallos según regla y lote con el resto", async () => {
    cleanupData = createCleanup();
    const today = new Date().toISOString().split("T")[0];

    // Estado previo de la parvada
    const balanceBefore = (await parseJson(await gallosGET())).balance;
    const expected = assignMales(4, balanceBefore.active, balanceBefore.required);

    // Iniciar incubación sin gallina asignada
    const incRes = await incubacionPOST(mockRequest("http://localhost/api/incubacion", {
      method: "POST",
      body: { startDate: new Date(Date.now() - 21 * 86400000).toISOString().split("T")[0], eggsSet: 10 },
    }));
    expect(incRes.status).toBe(201);
    const inc = await parseJson(incRes);
    cleanupData.incubationIds.push(inc.id);

    // Completar con 2 hembras y 4 machos
    const putRes = await incubacionPUT(mockRequest("http://localhost/api/incubacion", {
      method: "PUT",
      body: { id: inc.id, eggsHatched: 6, femalesHatched: 2, malesHatched: 4, isComplete: true, notes: inc.notes },
    }));
    const result = await parseJson(putRes);

    expect(result.assignment.hensCreated).toBe(2);
    expect(result.assignment.roostersCreated).toBe(expected.toRoosters);
    if (expected.toSlaughter > 0) {
      expect(result.assignment.batchCode).toMatch(/^L-\d{3}$/);
    } else {
      expect(result.assignment.batchCode).toBeNull();
    }

    // Rastrear registros creados para limpieza (nacidos hoy, sin madre = raza Criolla)
    const newHens = await db.select({ id: hens.id }).from(hens)
      .where(and(eq(hens.birthDate, today), eq(hens.breed, "Criolla")));
    cleanupData.henIds.push(...newHens.map((h) => h.id));
    const newRoosters = await db.select({ id: roosters.id }).from(roosters).where(eq(roosters.birthDate, today));
    cleanupData.roosterIds.push(...newRoosters.map((r) => r.id));
    const newBatches = await db.select({ id: broilerBatches.id }).from(broilerBatches)
      .where(and(eq(broilerBatches.startDate, today), eq(broilerBatches.breed, "Pollo de engorde")));
    cleanupData.batchIds.push(...newBatches.map((b) => b.id));

    expect(newHens.length).toBeGreaterThanOrEqual(2);
    expect(newRoosters.length).toBeGreaterThanOrEqual(expected.toRoosters);
    if (expected.toSlaughter > 0) {
      expect(newBatches.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// LOTES: readiness automático y descuento en sacrificio
// ═══════════════════════════════════════════════════════════════
describe("Lotes de engorde (readiness y sacrificio)", () => {
  it("Lote con edad objetivo se marca listo, sacrificio descuenta y DELETE revierte", async () => {
    cleanupData = createCleanup();
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0];

    // Crear lote ya pasado de edad objetivo
    const createRes = await lotesPOST(mockRequest("http://localhost/api/lotes-pollos", {
      method: "POST",
      body: { breed: "Cobb 500", startDate: sixtyDaysAgo, initialQuantity: 5, targetWeeks: 7, targetWeightKg: "2.5" },
    }));
    expect(createRes.status).toBe(201);
    const batch = await parseJson(createRes);
    cleanupData.batchIds.push(batch.id);

    // GET debe persistir el estado listo_sacrificio (lazy-sync)
    const list = await parseJson(await lotesGET());
    const found = list.find((b: { id: string }) => b.id === batch.id);
    expect(found.status).toBe("listo_sacrificio");
    expect(found.readinessReasons.some((r: string) => r.includes("Edad"))).toBe(true);

    // Sacrificio total del lote
    const sacRes = await sacrificioPOST(mockRequest("http://localhost/api/sacrificio", {
      method: "POST",
      body: { date: new Date().toISOString().split("T")[0], birdType: "pollo", quantity: 5, weightKg: 10, destination: "consumo_propio", batchId: batch.id },
    }));
    expect(sacRes.status).toBe(201);
    const sac = await parseJson(sacRes);

    const afterSac = (await parseJson(await lotesGET())).find((b: { id: string }) => b.id === batch.id);
    expect(afterSac.currentQuantity).toBe(0);
    expect(afterSac.status).toBe("faena");

    // DELETE del sacrificio revierte el lote
    await sacrificioDELETE(mockRequest(`http://localhost/api/sacrificio?id=${sac.id}`, { method: "DELETE" }));
    const afterDel = (await parseJson(await lotesGET())).find((b: { id: string }) => b.id === batch.id);
    expect(afterDel.currentQuantity).toBe(5);
    expect(afterDel.status).not.toBe("faena");
  });

  it("Sacrificio con cantidad mayor al stock del lote es rechazado", async () => {
    cleanupData = createCleanup();
    const createRes = await lotesPOST(mockRequest("http://localhost/api/lotes-pollos", {
      method: "POST",
      body: { breed: "Cobb 500", startDate: new Date().toISOString().split("T")[0], initialQuantity: 3 },
    }));
    const batch = await parseJson(createRes);
    cleanupData.batchIds.push(batch.id);

    const sacRes = await sacrificioPOST(mockRequest("http://localhost/api/sacrificio", {
      method: "POST",
      body: { date: new Date().toISOString().split("T")[0], birdType: "pollo", quantity: 5, weightKg: 10, destination: "consumo_propio", batchId: batch.id },
    }));
    expect(sacRes.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════
// MANURE FLOW: Gallinaza → Inventario + Transactions
// ═══════════════════════════════════════════════════════════
describe("MANURE FLOW: Gallinaza", () => {
  const today = () => new Date().toISOString().split("T")[0];

  it("GET /api/gallinaza devuelve estimación e inventario", async () => {
    const res = await gallinazaGET();
    expect(res.status).toBe(200);
    const data = await parseJson(res);
    expect(Array.isArray(data.estimation.groups)).toBe(true);
    expect(data.estimation.groups.length).toBeGreaterThanOrEqual(6); // 4 etapas + gallos + lotes
    expect(data.estimation.totalKgPerDay).toBeGreaterThanOrEqual(0);
    expect(data.inventory.currentStockKg).toBeGreaterThanOrEqual(0);
    // Cada grupo incluye factorId editable
    for (const g of data.estimation.groups) {
      expect(typeof g.kgPerDay).toBe("number");
    }
  });

  it("Ajuste manual suma al stock y su DELETE lo revierte", async () => {
    const before = (await parseJson(await gallinazaGET())).inventory.currentStockKg;

    const adjRes = await gallinazaPOST(mockRequest("http://localhost/api/gallinaza", {
      method: "POST",
      body: { action: "adjust", date: today(), deltaKg: 10, reason: "Test ajuste positivo" },
    }));
    expect(adjRes.status).toBe(201);
    const adj = await parseJson(adjRes);

    const afterAdd = (await parseJson(await gallinazaGET())).inventory.currentStockKg;
    expect(Math.round((afterAdd - before) * 100) / 100).toBe(10);

    const delRes = await gallinazaDELETE(mockRequest(`http://localhost/api/gallinaza?adjustId=${adj.id}`, { method: "DELETE" }));
    expect(delRes.status).toBe(200);
    const afterDel = (await parseJson(await gallinazaGET())).inventory.currentStockKg;
    expect(Math.round((afterDel - before) * 100) / 100).toBe(0);
  });

  it("Venta descuenta stock y crea transacción; DELETE revierte ambos", async () => {
    cleanupData = createCleanup();

    // Garantizar stock disponible sin depender del seed
    const seedAdj = await parseJson(await gallinazaPOST(mockRequest("http://localhost/api/gallinaza", {
      method: "POST",
      body: { action: "adjust", date: today(), deltaKg: 2, reason: "Test stock inicial" },
    })));

    const before = (await parseJson(await gallinazaGET())).inventory.currentStockKg;

    const saleRes = await gallinazaPOST(mockRequest("http://localhost/api/gallinaza", {
      method: "POST",
      body: { action: "sale", date: today(), quantityKg: 1, pricePerKg: 800, presentation: "Granel", buyer: "Test Buyer" },
    }));
    expect(saleRes.status).toBe(201);
    const sale = await parseJson(saleRes);
    expect(Number(sale.totalAmount)).toBe(800);

    const afterSale = (await parseJson(await gallinazaGET())).inventory.currentStockKg;
    expect(Math.round((before - afterSale) * 100) / 100).toBe(1);

    // La transacción de ingreso quedó vinculada
    const [linkedTx] = await db.select().from(transactions)
      .where(and(eq(transactions.sourceType, "gallinaza"), eq(transactions.sourceId, sale.id)));
    expect(linkedTx).toBeDefined();
    expect(linkedTx.category).toBe("Venta de abono/gallinaza");
    expect(linkedTx.type).toBe("ingreso");
    cleanupData.transactionIds.push(linkedTx.id);

    // DELETE revierte stock y elimina la transacción
    const delRes = await gallinazaDELETE(mockRequest(`http://localhost/api/gallinaza?saleId=${sale.id}`, { method: "DELETE" }));
    expect(delRes.status).toBe(200);
    const afterDel = (await parseJson(await gallinazaGET())).inventory.currentStockKg;
    expect(Math.round((afterDel - before) * 100) / 100).toBe(0);
    const [goneTx] = await db.select().from(transactions).where(eq(transactions.id, linkedTx.id));
    expect(goneTx).toBeUndefined();
    cleanupData.transactionIds = [];

    // Limpiar el ajuste de garantía
    await gallinazaDELETE(mockRequest(`http://localhost/api/gallinaza?adjustId=${seedAdj.id}`, { method: "DELETE" }));
  });

  it("Venta con cantidad mayor al stock es rechazada", async () => {
    const stock = (await parseJson(await gallinazaGET())).inventory.currentStockKg;
    const res = await gallinazaPOST(mockRequest("http://localhost/api/gallinaza", {
      method: "POST",
      body: { action: "sale", date: today(), quantityKg: stock + 1000, pricePerKg: 800 },
    }));
    expect(res.status).toBe(400);
    const err = await parseJson(res);
    expect(err.error).toContain("Stock insuficiente");
  });

  it("Factor de producción editable cambia la estimación", async () => {
    const data = await parseJson(await gallinazaGET());
    const group = data.estimation.groups.find((g: { factorId: string | null; count: number }) => g.factorId && g.count > 0);
    expect(group).toBeDefined();
    const original = group.kgPerBirdPerDay;

    const updRes = await gallinazaPOST(mockRequest("http://localhost/api/gallinaza", {
      method: "POST",
      body: { action: "factor", id: group.factorId, kgPerBirdPerDay: 0.2 },
    }));
    expect(updRes.status).toBe(200);

    const afterData = await parseJson(await gallinazaGET());
    const afterGroup = afterData.estimation.groups.find((g: { factorId: string }) => g.factorId === group.factorId);
    expect(afterGroup.kgPerBirdPerDay).toBe(0.2);
    expect(afterGroup.kgPerDay).toBe(Math.round(group.count * 0.2 * 100) / 100);

    // Restaurar el valor original
    await gallinazaPOST(mockRequest("http://localhost/api/gallinaza", {
      method: "POST",
      body: { action: "factor", id: group.factorId, kgPerBirdPerDay: original },
    }));
  });
});
