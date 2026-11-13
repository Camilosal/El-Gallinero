import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import {
  biosecurityLogs,
  dailyClosures,
  farmLocations,
  healthControl,
  offlineMutationReceipts,
  reproductionEvents,
  weightLogs,
} from "@/db/schema";
import { GET as getBootstrap } from "@/app/api/sync/bootstrap/route";
import { POST as postBatch } from "@/app/api/sync/batch/route";
import { partitionPendingMutations } from "@/lib/offline/syncManager";

describe("Extended Offline Sync Engine (Bootstrap + Batch 8 Entities + SW v8)", () => {
  const createdIds = {
    locations: [] as string[],
    weights: [] as string[],
    health: [] as string[],
    repro: [] as string[],
    bio: [] as string[],
    closureDates: [] as string[],
    receipts: [] as string[],
  };

  afterEach(async () => {
    if (createdIds.receipts.length) {
      await db
        .delete(offlineMutationReceipts)
        .where(inArray(offlineMutationReceipts.mutationId, createdIds.receipts));
      createdIds.receipts = [];
    }
    if (createdIds.weights.length) {
      await db.delete(weightLogs).where(inArray(weightLogs.id, createdIds.weights));
      createdIds.weights = [];
    }
    if (createdIds.health.length) {
      await db.delete(healthControl).where(inArray(healthControl.id, createdIds.health));
      createdIds.health = [];
    }
    if (createdIds.repro.length) {
      await db.delete(reproductionEvents).where(inArray(reproductionEvents.id, createdIds.repro));
      createdIds.repro = [];
    }
    if (createdIds.bio.length) {
      await db.delete(biosecurityLogs).where(inArray(biosecurityLogs.id, createdIds.bio));
      createdIds.bio = [];
    }
    for (const d of createdIds.closureDates) {
      await db.delete(dailyClosures).where(eq(dailyClosures.closureDate, d));
    }
    createdIds.closureDates = [];
    if (createdIds.locations.length) {
      await db.delete(farmLocations).where(inArray(farmLocations.id, createdIds.locations));
      createdIds.locations = [];
    }
  });

  it("partitionPendingMutations incluye pesaje, sanidad, reproduccion, bioseguridad y cierre_diario en batchable", () => {
    const sample = (["huevos", "pesaje", "sanidad", "reproduccion", "bioseguridad", "cierre_diario"] as const).map(
      (entity, idx) => ({
        id: `m-${idx}`,
        endpoint: `/api/${entity}`,
        method: "POST" as const,
        entity,
        description: entity,
        payload: {},
        clientTimestamp: new Date().toISOString(),
        status: "pending" as const,
        retries: 0,
        createdAt: Date.now(),
      }),
    );
    const { batchable, individual } = partitionPendingMutations(sample);
    expect(batchable).toHaveLength(6);
    expect(individual).toHaveLength(0);
  });

  it("GET /api/sync/bootstrap retorna paquete consolidado operativo con curvas y especies", async () => {
    const req = new NextRequest("http://localhost:3000/api/sync/bootstrap");
    const res = await getBootstrap(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.locations)).toBe(true);
    expect(Array.isArray(body.activeBatches)).toBe(true);
    expect(Array.isArray(body.feedInventory)).toBe(true);
    expect(Array.isArray(body.speciesParams)).toBe(true);
    expect(body.standardCurves).toHaveProperty("gallina");
    expect(body.standardCurves).toHaveProperty("cuy");
    expect(body.onboardingState).toBeTruthy();
  });

  it("POST /api/sync/batch sincroniza lote offline mixto y deduplica reintentos con offlineMutationReceipts", async () => {
    const locId = crypto.randomUUID();
    createdIds.locations.push(locId);
    await db.insert(farmLocations).values({
      id: locId,
      code: `GAL-EXT-${locId.slice(0, 6)}`,
      name: `Galpon Sync Ext ${locId.slice(0, 6)}`,
      type: "galpon",
      status: "activa",
    });

    const pesajeId = crypto.randomUUID();
    const sanidadId = crypto.randomUUID();
    const reproId = crypto.randomUUID();
    const bioId = crypto.randomUUID();
    const cierreId = crypto.randomUUID();
    const cierreDate = "2099-07-15";

    createdIds.weights.push(pesajeId);
    createdIds.health.push(sanidadId);
    createdIds.repro.push(reproId);
    createdIds.bio.push(bioId);
    createdIds.closureDates.push(cierreDate);
    createdIds.receipts.push(pesajeId, sanidadId, reproId, bioId, cierreId);

    const payloadBatch = {
      mutations: [
        {
          id: pesajeId,
          endpoint: "/api/produccion/peso",
          method: "POST",
          entity: "pesaje",
          clientTimestamp: new Date().toISOString(),
          payload: {
            date: cierreDate,
            species: "gallina",
            locationId: locId,
            avgWeightKg: "1.82",
            sampleSize: 10,
          },
        },
        {
          id: sanidadId,
          endpoint: "/api/sanidad/control",
          method: "POST",
          entity: "sanidad",
          clientTimestamp: new Date().toISOString(),
          payload: {
            date: cierreDate,
            species: "gallina",
            locationId: locId,
            type: "tratamiento",
            description: "Vitaminas complejo B",
            product: "Complejo B",
            withdrawalDays: 5,
          },
        },
        {
          id: reproId,
          endpoint: "/api/produccion/reproduccion",
          method: "POST",
          entity: "reproduccion",
          clientTimestamp: new Date().toISOString(),
          payload: {
            species: "cuy",
            eventType: "empadre",
            eventDate: cierreDate,
            damCode: "CUY-H10",
            sireCode: "CUY-M20",
            locationId: locId,
          },
        },
        {
          id: bioId,
          endpoint: "/api/sanidad/bioseguridad",
          method: "POST",
          entity: "bioseguridad",
          clientTimestamp: new Date().toISOString(),
          payload: {
            date: cierreDate,
            logType: "poe_gab",
            locationId: locId,
            checklistItems: { pediluvioActivo: true, mallaSinRoturas: true },
          },
        },
        {
          id: cierreId,
          endpoint: "/api/operaciones/cierre-diario",
          method: "POST",
          entity: "cierre_diario",
          clientTimestamp: new Date().toISOString(),
          payload: {
            closureDate: cierreDate,
            notes: "Cierre offline de galpón",
          },
        },
      ],
    };

    const req1 = new NextRequest("http://localhost:3000/api/sync/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBatch),
    });
    const res1 = await postBatch(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.results.every((r: any) => r.status === "synced")).toBe(true);

    const [healthRow] = await db.select().from(healthControl).where(eq(healthControl.id, sanidadId));
    expect(healthRow?.withdrawalUntilDate).toBe("2099-07-20");

    // Reintento idempotente
    const req2 = new NextRequest("http://localhost:3000/api/sync/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBatch),
    });
    const res2 = await postBatch(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.results.every((r: any) => r.status === "synced" && r.deduplicated === true)).toBe(true);
  });
});
