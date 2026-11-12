import { afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import {
  cleanup,
  createCleanup,
  createTestFarmLocation,
  createTestFeed,
  db,
  mockRequest,
  parseJson,
  type TestCleanup,
} from "./helpers";
import {
  eggProduction,
  eggProductionDetails,
  feedInventory,
  healthControl,
  offlineMutationReceipts,
  transactions,
} from "@/db/schema";
import { todayColombiaIso } from "@/lib/date-validation";
import { POST as syncBatchPOST } from "@/app/api/sync/batch/route";
import { POST as finanzasPOST } from "@/app/api/finanzas/finanzas/route";
import { POST as sanidadPOST } from "@/app/api/sanidad/control/route";
import { DELETE as movimientosDELETE } from "@/app/api/produccion/alimentacion/movimientos/route";

let cleanupData: TestCleanup;
let extraHealthIds: string[] = [];
let extraMutationIds: string[] = [];

afterEach(async () => {
  if (extraHealthIds.length) {
    await db.delete(healthControl).where(inArray(healthControl.id, extraHealthIds));
    extraHealthIds = [];
  }
  if (extraMutationIds.length) {
    await db.delete(offlineMutationReceipts).where(inArray(offlineMutationReceipts.mutationId, extraMutationIds));
    extraMutationIds = [];
  }
  if (cleanupData) {
    await cleanup(cleanupData);
  }
});

describe("Offline Idempotency, Batch Sync & Quick Capture Parity", () => {
  it("X-Client-Mutation-Id deduplica mutaciones en POST /api/finanzas/finanzas", async () => {
    cleanupData = createCleanup();
    const mutId = crypto.randomUUID();
    extraMutationIds.push(mutId);
    const today = todayColombiaIso();

    const makeReq = () =>
      new Request("http://localhost/api/finanzas/finanzas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Mutation-Id": mutId,
        },
        body: JSON.stringify({
          date: today,
          type: "egreso",
          category: "Otro egreso",
          description: `Idempotencia test ${mutId}`,
          amount: "12500",
        }),
      }) as any;

    const first = await finanzasPOST(makeReq());
    expect(first.status).toBe(201);
    const firstBody = await parseJson(first);
    cleanupData.transactionIds.push(firstBody.id);

    const second = await finanzasPOST(makeReq());
    expect(second.status).toBe(201);
    expect(second.headers.get("X-Idempotent-Replay")).toBe("1");
    const secondBody = await parseJson(second);
    expect(secondBody.id).toBe(firstBody.id);

    const matchingTxs = await db
      .select()
      .from(transactions)
      .where(eq(transactions.description, `Idempotencia test ${mutId}`));
    expect(matchingTxs).toHaveLength(1);

    const [receipt] = await db
      .select()
      .from(offlineMutationReceipts)
      .where(eq(offlineMutationReceipts.mutationId, mutId));
    expect(receipt).toBeDefined();
    expect(receipt.statusCode).toBe(201);
  });

  it("QuickCapture acepta categorías rápidas de egreso y rechaza Compra de alimento sin feedId", async () => {
    cleanupData = createCleanup();
    const today = todayColombiaIso();
    const validCategories = [
      "Otro egreso",
      "Compra de insumos",
      "Control sanitario",
      "Mantenimiento",
      "Mano de obra",
      "Servicios (agua/luz)",
      "Transporte",
      "Compra de gallinas",
      "Equipamiento",
    ];

    for (const category of validCategories) {
      const res = await finanzasPOST(
        mockRequest("http://localhost/api/finanzas/finanzas", {
          method: "POST",
          body: {
            date: today,
            type: "egreso",
            category,
            description: `Gasto rápido ${category}`,
            amount: "5000",
          },
        }),
      );
      expect(res.status, `Categoría '${category}' falló con ${res.status}`).toBe(201);
      const tx = await parseJson(res);
      cleanupData.transactionIds.push(tx.id);
    }

    const rejected = await finanzasPOST(
      mockRequest("http://localhost/api/finanzas/finanzas", {
        method: "POST",
        body: {
          date: today,
          type: "egreso",
          category: "Compra de alimento",
          description: "Bulto sin feedId",
          amount: "50000",
        },
      }),
    );
    expect(rejected.status).toBe(400);
  });

  it("POST /api/sanidad/control exige locationId y registra check-in/tratamiento cuando se envía", async () => {
    cleanupData = createCleanup();
    const loc = await createTestFarmLocation();
    cleanupData.locationIds.push(loc.id);
    const today = todayColombiaIso();

    const missingLoc = await sanidadPOST(
      mockRequest("http://localhost/api/sanidad/control", {
        method: "POST",
        body: {
          date: today,
          type: "vacuna",
          description: "Sin ubicación",
          affectedHens: "todas",
          product: "Newcastle",
          cost: "0",
        },
      }),
    );
    expect(missingLoc.status).toBe(400);

    const okRes = await sanidadPOST(
      mockRequest("http://localhost/api/sanidad/control", {
        method: "POST",
        body: {
          date: today,
          locationId: loc.id,
          type: "vacuna",
          description: "Newcastle preventiva",
          affectedHens: "todas",
          product: "Newcastle",
          cost: "0",
          notes: "Marcado como aplicado desde inicio",
        },
      }),
    );
    expect(okRes.status).toBe(201);
    const created = await parseJson(okRes);
    extraHealthIds.push(created.id);
    expect(created.locationId).toBe(loc.id);
  });

  it("POST /api/sync/batch procesa sizes, valida locationId y vincula sourceId/sourceType en compras de alimento", async () => {
    cleanupData = createCleanup();
    const loc = await createTestFarmLocation();
    cleanupData.locationIds.push(loc.id);
    const feed = await createTestFeed({ category: "suplementario", currentStock: "10", costPerUnit: "2000" });
    cleanupData.feedIds.push(feed.id);

    const today = todayColombiaIso();
    const eggId = crypto.randomUUID();
    const missingLocEggId = crypto.randomUUID();
    const feedMovId = crypto.randomUUID();

    const batchRes = await syncBatchPOST(
      mockRequest("http://localhost/api/sync/batch", {
        method: "POST",
        body: {
          mutations: [
            {
              id: eggId,
              entity: "huevos",
              endpoint: "/api/produccion/huevos",
              method: "POST",
              payload: {
                date: today,
                species: "gallina",
                locationId: loc.id,
                totalCollected: 12,
                broken: 1,
                forIncubation: 0,
                sizes: [
                  { size: "Grande", quantity: 8 },
                  { size: "Mediano", quantity: 3 },
                ],
              },
            },
            {
              id: missingLocEggId,
              entity: "huevos",
              endpoint: "/api/produccion/huevos",
              method: "POST",
              payload: {
                date: today,
                species: "gallina",
                totalCollected: 5,
              },
            },
            {
              id: feedMovId,
              entity: "alimentacion",
              endpoint: "/api/produccion/alimentacion/movimientos",
              method: "POST",
              payload: {
                feedId: feed.id,
                quantity: "5",
                isEntry: true,
                movementType: "compra",
                date: today,
                locationId: loc.id,
              },
            },
          ],
        },
      }),
    );

    expect(batchRes.status).toBe(200);
    const batchData = await parseJson(batchRes);
    const rEgg = batchData.results.find((r: any) => r.id === eggId);
    const rMissing = batchData.results.find((r: any) => r.id === missingLocEggId);
    const rFeed = batchData.results.find((r: any) => r.id === feedMovId);

    expect(rEgg?.status).toBe("synced");
    expect(rMissing?.status).toBe("error");
    expect(rFeed?.status).toBe("synced");

    cleanupData.productionIds.push(eggId);
    cleanupData.movementIds.push(feedMovId);

    const details = await db
      .select()
      .from(eggProductionDetails)
      .where(eq(eggProductionDetails.productionId, eggId));
    expect(details).toHaveLength(2);

    const [linkedTx] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.sourceType, "alimento"), eq(transactions.sourceId, feedMovId)));
    expect(linkedTx).toBeDefined();
    expect(Number(linkedTx.amount)).toBe(10000);
    cleanupData.transactionIds.push(linkedTx.id);

    // Verificar que eliminar el movimiento revierte stock Y elimina la transacción vinculada
    const delMovRes = await movimientosDELETE(
      mockRequest(`http://localhost/api/produccion/alimentacion/movimientos?id=${feedMovId}`, { method: "DELETE" }),
    );
    expect(delMovRes.status).toBe(200);
    cleanupData.movementIds = [];

    const [txAfter] = await db.select().from(transactions).where(eq(transactions.id, linkedTx.id));
    expect(txAfter).toBeUndefined();
    cleanupData.transactionIds = [];

    const [feedAfter] = await db.select().from(feedInventory).where(eq(feedInventory.id, feed.id));
    expect(Number(feedAfter.currentStock)).toBe(10);

    // Reintento idempotente de eggId no debe duplicar ni fallar
    const retryRes = await syncBatchPOST(
      mockRequest("http://localhost/api/sync/batch", {
        method: "POST",
        body: {
          mutations: [
            {
              id: eggId,
              entity: "huevos",
              endpoint: "/api/produccion/huevos",
              method: "POST",
              payload: { date: today, locationId: loc.id, totalCollected: 12 },
            },
          ],
        },
      }),
    );
    expect(retryRes.status).toBe(200);
    const retryData = await parseJson(retryRes);
    expect(retryData.results[0].status).toBe("synced");
    const eggsRows = await db.select().from(eggProduction).where(eq(eggProduction.id, eggId));
    expect(eggsRows).toHaveLength(1);
  });
});
