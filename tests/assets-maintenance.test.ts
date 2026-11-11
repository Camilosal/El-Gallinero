import { afterAll, afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { GET as assetsGET, POST as assetsPOST, DELETE as assetsDELETE } from "@/app/api/operaciones/activos/route";
import { GET as maintenanceGET, POST as maintenancePOST, PUT as maintenancePUT } from "@/app/api/operaciones/mantenimiento/route";
import { GET as dailyTasksGET } from "@/app/api/dashboard/tareas-pendientes/route";
import { farmAssets, farmLocations, maintenance, transactions } from "@/db/schema";
import { createTestFarmLocation, db, mockRequest, parseJson, pool } from "./helpers";

let assetId: string | null = null;
let locationId: string | null = null;
let seriesId: string | null = null;

afterEach(async () => {
  if (seriesId) {
    const rows = await db.select({ id: maintenance.id }).from(maintenance).where(eq(maintenance.recurrenceSeriesId, seriesId));
    const ids = rows.map((row) => row.id);
    if (ids.length) {
      await db.delete(transactions).where(and(
        eq(transactions.sourceType, "mantenimiento"),
        inArray(transactions.sourceId, ids),
      ));
      await db.delete(maintenance).where(inArray(maintenance.id, ids));
    }
  }
  if (assetId) await db.delete(farmAssets).where(eq(farmAssets.id, assetId));
  if (locationId) await db.delete(farmLocations).where(eq(farmLocations.id, locationId));
  assetId = null;
  locationId = null;
  seriesId = null;
});

afterAll(async () => { await pool.end(); });

describe("activos y mantenimiento", () => {
  it("enlaza la ficha, crea una siguiente revisión al completar y evita duplicarla", async () => {
    const invalidAsset = await assetsPOST(mockRequest("http://localhost/api/operaciones/activos", {
      method: "POST", body: { name: "Bomba inválida", acquisitionCost: -1 },
    }));
    expect(invalidAsset.status).toBe(400);

    const location = await createTestFarmLocation();
    locationId = location.id;
    const assetResponse = await assetsPOST(mockRequest("http://localhost/api/operaciones/activos", {
      method: "POST",
      body: {
        name: "Bomba de agua de prueba", category: "equipo", brand: "Prueba", serialNumber: "SERIE-TEST-001",
        acquisitionCost: "180000", locationId, warrantyUntil: "2027-01-15",
      },
    }));
    expect(assetResponse.status).toBe(201);
    const asset = await parseJson(assetResponse);
    assetId = asset.id;
    expect(asset.code).toMatch(/^ACT-\d{4}$/);

    const today = new Date().toISOString().slice(0, 10);
    const taskResponse = await maintenancePOST(mockRequest("http://localhost/api/operaciones/mantenimiento", {
      method: "POST",
      body: {
        title: "Revisión de bomba", scheduledDate: today, status: "pendiente", cost: "95000",
        assetId, recurrenceIntervalDays: 5,
      },
    }));
    expect(taskResponse.status).toBe(201);
    const task = await parseJson(taskResponse);
    const activeSeriesId: string = task.recurrenceSeriesId;
    seriesId = activeSeriesId;
    expect(task.locationId).toBe(locationId);
    expect(task.assetId).toBe(assetId);

    const completed = await maintenancePUT(mockRequest("http://localhost/api/operaciones/mantenimiento", {
      method: "PUT",
      body: {
        id: task.id, title: task.title, scheduledDate: task.scheduledDate, completedDate: today,
        status: "completado", cost: "95000", locationId, assetId, recurrenceIntervalDays: 5,
      },
    }));
    expect(completed.status).toBe(200);

    const nextDate = new Date(`${today}T12:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 5);
    const expectedDate = nextDate.toISOString().slice(0, 10);
    const rows = await db.select().from(maintenance).where(eq(maintenance.recurrenceSeriesId, activeSeriesId));
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.status === "pendiente")?.scheduledDate).toBe(expectedDate);

    const repeatedCompletion = await maintenancePUT(mockRequest("http://localhost/api/operaciones/mantenimiento", {
      method: "PUT",
      body: {
        id: task.id, title: task.title, scheduledDate: task.scheduledDate, completedDate: today,
        status: "completado", cost: "95000", locationId, assetId, recurrenceIntervalDays: 5,
      },
    }));
    expect(repeatedCompletion.status).toBe(200);
    const rowsAfterRepeat = await db.select().from(maintenance).where(eq(maintenance.recurrenceSeriesId, activeSeriesId));
    expect(rowsAfterRepeat).toHaveLength(2);

    const expenses = await db.select().from(transactions).where(and(
      eq(transactions.sourceType, "mantenimiento"),
      inArray(transactions.sourceId, rowsAfterRepeat.map((row) => row.id)),
    ));
    expect(expenses).toHaveLength(1);
    expect(expenses.find((entry) => entry.sourceId === task.id)?.amount).toBe("95000.00");
    expect(expenses.some((entry) => entry.sourceId === rowsAfterRepeat.find((row) => row.id !== task.id)?.id)).toBe(false);

    const linkedTasks = await parseJson(await maintenanceGET(mockRequest("http://localhost/api/operaciones/mantenimiento")));
    expect(linkedTasks.find((row: { id: string }) => row.id === task.id)).toMatchObject({ assetName: asset.name, assetCode: asset.code });
    const assetRows = await parseJson(await assetsGET(mockRequest("http://localhost/api/operaciones/activos?active=true")));
    expect(assetRows.find((row: { id: string }) => row.id === assetId)?.locationName).toBe(location.name);
    const dailyTasks = await parseJson(await dailyTasksGET(mockRequest("http://localhost/api/dashboard/tareas-pendientes")));
    expect(dailyTasks.maintenanceDue.some((row: { title: string; assetName: string }) => row.title === task.title && row.assetName === asset.name)).toBe(true);

    const retired = await assetsDELETE(mockRequest(`http://localhost/api/operaciones/activos?id=${assetId}`, { method: "DELETE" }));
    expect(retired.status).toBe(200);
    const allAssets = await parseJson(await assetsGET(mockRequest("http://localhost/api/operaciones/activos")));
    expect(allAssets.find((row: { id: string }) => row.id === assetId)?.status).toBe("retirado");
  });
});
