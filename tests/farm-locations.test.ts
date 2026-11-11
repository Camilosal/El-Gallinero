import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { GET as locationsGET, POST as locationsPOST } from "@/app/api/ubicaciones/route";
import { GET as movementsGET, POST as movementsPOST } from "@/app/api/ubicaciones/movimientos/route";
import { POST as acquisitionsPOST } from "@/app/api/produccion/adquisiciones/route";
import { hens } from "@/db/schema";
import { countHensByStageAndLocationForDate } from "@/lib/feeding/runProgram";
import { cleanup, createCleanup, db, mockRequest, parseJson, type TestCleanup } from "./helpers";

let cleanupData: TestCleanup & { productionDetailIds?: string[] };

afterEach(async () => {
  if (cleanupData) await cleanup(cleanupData);
});

describe("Lugares de manejo", () => {
  it("crea fichas, conserva el alojamiento y evita superar capacidad en traslados", async () => {
    cleanupData = createCleanup();
    const sourceResponse = await locationsPOST(mockRequest("http://localhost/api/ubicaciones", {
      method: "POST",
      body: { name: "Corral de prueba origen", type: "corral", capacity: 3, latitude: "4.1234567", longitude: "-74.1234567" },
    }));
    expect(sourceResponse.status).toBe(201);
    const source = await parseJson(sourceResponse);
    cleanupData.locationIds.push(source.id);

    const destinationResponse = await locationsPOST(mockRequest("http://localhost/api/ubicaciones", {
      method: "POST",
      body: { name: "Galpón de prueba destino", type: "galpon", capacity: 1, operationalStatus: "operativa" },
    }));
    expect(destinationResponse.status).toBe(201);
    const destination = await parseJson(destinationResponse);
    cleanupData.locationIds.push(destination.id);

    const acquisitionResponse = await acquisitionsPOST(mockRequest("http://localhost/api/produccion/adquisiciones", {
      method: "POST",
      body: {
        date: new Date().toISOString().slice(0, 10), acquisitionType: "donacion", birdType: "gallina",
        quantity: 2, breed: "Criolla", destinationLocationId: source.id,
      },
    }));
    expect(acquisitionResponse.status).toBe(201);
    const acquisition = await parseJson(acquisitionResponse);
    cleanupData.acquisitionIds.push(acquisition.id);
    cleanupData.henIds.push(...acquisition.createdBirdIds);

    const today = new Date().toISOString().slice(0, 10);
    const moveOne = await movementsPOST(mockRequest("http://localhost/api/ubicaciones/movimientos", {
      method: "POST",
      body: { animalType: "gallina", animalId: acquisition.createdBirdIds[0], toLocationId: destination.id, date: today, reason: "Prueba de capacidad" },
    }));
    expect(moveOne.status).toBe(201);

    const moveTwo = await movementsPOST(mockRequest("http://localhost/api/ubicaciones/movimientos", {
      method: "POST",
      body: { animalType: "gallina", animalId: acquisition.createdBirdIds[1], toLocationId: destination.id, date: today, reason: "Prueba de capacidad" },
    }));
    expect(moveTwo.status).toBe(400);
    expect((await parseJson(moveTwo)).error).toContain("capacidad");

    const [movedHen] = await db.select().from(hens).where(eq(hens.id, acquisition.createdBirdIds[0]));
    expect(movedHen.locationId).toBe(destination.id);

    const stageCounts = await countHensByStageAndLocationForDate(new Date(`${today}T12:00:00`), db);
    const countsAt = (locationId: string) => Object.values(stageCounts).flat()
      .filter((item) => item.locationId === locationId)
      .reduce((total, item) => total + item.count, 0);
    expect(countsAt(source.id)).toBe(1);
    expect(countsAt(destination.id)).toBe(1);

    const movementList = await parseJson(await movementsGET(mockRequest(`http://localhost/api/ubicaciones/movimientos?locationId=${destination.id}`)));
    expect(movementList).toHaveLength(1);
    expect(movementList[0].fromLocationName).toBe(source.name);
    expect(movementList[0].toLocationName).toBe(destination.name);

    const locationList = await parseJson(await locationsGET(mockRequest("http://localhost/api/ubicaciones?period=30")));
    const destinationReport = locationList.find((item: { id: string }) => item.id === destination.id);
    expect(destinationReport.animals).toBe(1);
    expect(destinationReport.capacityUsedPercent).toBe(100);
    expect(destinationReport.speciesCounts).toContainEqual({ species: "gallina", total: 1 });
  });
});
