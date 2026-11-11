import { db } from "@/db";
import {
  animalLocationMovements, broilerBatches, eggProduction, farmLocations, feedMovements, feedInventory,
  hens, healthControl, maintenance, mortalityRecords, roosters, slaughter, weightLogs,
} from "@/db/schema";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";
import { isDateOnly } from "@/lib/date-validation";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LOCATION_TYPES = new Set(["corral", "jaula", "galpon", "potrero", "jardin", "patio", "otro"]);
const LOCATION_STATUSES = new Set(["activa", "inactiva"]);
const OPERATIONAL_STATUSES = new Set(["operativa", "mantenimiento", "restringida", "fuera_servicio"]);
const SANITARY_STATUSES = new Set(["pendiente_revision", "cumple", "requiere_atencion", "no_cumple"]);

function cleanText(value: unknown, max: number, field: string): string | null {
  if (value == null) return null;
  const result = String(value).trim();
  if (result.length > max) throw new Error(`${field} supera ${max} caracteres`);
  return result || null;
}

function optionalNumber(value: unknown, field: string, min: number, max: number): string | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${field} debe estar entre ${min} y ${max}`);
  return String(number);
}

function validateLocation(body: Record<string, unknown>) {
  if (typeof body.name !== "string" || !body.name.trim()) throw new Error("El nombre del lugar es requerido");
  if (body.name.trim().length > 150) throw new Error("El nombre supera 150 caracteres");
  if (typeof body.type !== "string" || !LOCATION_TYPES.has(body.type)) throw new Error("Tipo de lugar inválido");
  if (body.status !== undefined && !LOCATION_STATUSES.has(String(body.status))) throw new Error("Estado del lugar inválido");
  if (body.operationalStatus !== undefined && !OPERATIONAL_STATUSES.has(String(body.operationalStatus))) throw new Error("Estado operativo inválido");
  if (body.sanitaryStatus !== undefined && !SANITARY_STATUSES.has(String(body.sanitaryStatus))) throw new Error("Estado sanitario inválido");
  if (body.sanitaryReviewedAt && !isDateOnly(body.sanitaryReviewedAt)) throw new Error("Fecha de revisión sanitaria inválida");
  if (body.operationalReviewedAt && !isDateOnly(body.operationalReviewedAt)) throw new Error("Fecha de revisión operativa inválida");
  const latitude = optionalNumber(body.latitude, "Latitud", -90, 90);
  const longitude = optionalNumber(body.longitude, "Longitud", -180, 180);
  const areaM2 = optionalNumber(body.areaM2, "Área", 0, 1_000_000_000);
  const capacityValue = body.capacity == null || body.capacity === "" ? null : Number(body.capacity);
  if (capacityValue != null && (!Number.isSafeInteger(capacityValue) || capacityValue < 0)) throw new Error("Capacidad debe ser un entero no negativo");
  const parentLocationId = body.parentLocationId ? String(body.parentLocationId) : null;
  if (body.id && parentLocationId === String(body.id)) throw new Error("Un lugar no puede depender de sí mismo");
  return {
    name: body.name.trim(),
    type: body.type,
    parentLocationId,
    description: cleanText(body.description, 4000, "Descripción"),
    localReference: cleanText(body.localReference, 2000, "Referencia para encontrarlo"),
    latitude,
    longitude,
    areaM2,
    capacity: capacityValue,
    status: String(body.status || "activa"),
    operationalStatus: String(body.operationalStatus || "operativa"),
    sanitaryStatus: String(body.sanitaryStatus || "pendiente_revision"),
    sanitaryRequirements: cleanText(body.sanitaryRequirements, 4000, "Especificaciones sanitarias"),
    sanitaryReviewedAt: body.sanitaryReviewedAt ? String(body.sanitaryReviewedAt) : null,
    operationalReviewedAt: body.operationalReviewedAt ? String(body.operationalReviewedAt) : null,
    maintenanceNeeds: cleanText(body.maintenanceNeeds, 4000, "Necesidades de mantenimiento"),
    notes: cleanText(body.notes, 4000, "Notas"),
  };
}

async function nextLocationCode(tx: any) {
  await tx.execute(sql`LOCK TABLE ${farmLocations} IN EXCLUSIVE MODE`);
  const rows = await tx.select({ code: farmLocations.code }).from(farmLocations);
  const max = rows.reduce((current: number, row: { code: string }) => {
    const match = /^LOC-(\d+)$/.exec(row.code);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `LOC-${String(max + 1).padStart(3, "0")}`;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const period = Math.min(365, Math.max(1, Number(searchParams.get("period")) || 30));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const activeOnly = searchParams.get("active") === "true";
  const locations = await db.select().from(farmLocations)
    .where(activeOnly ? eq(farmLocations.status, "activa") : undefined)
    .orderBy(farmLocations.name);
  if (locations.length === 0) return NextResponse.json([]);
  const ids = locations.map((place) => place.id);
  const [parents, henCounts, roosterCounts, batchCounts, batchSpeciesCounts, eggs, eggSpeciesRows, feed, deaths, controls, tasks, movementRows, weightRows, meatRows] = await Promise.all([
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
    db.select({ locationId: hens.locationId, total: sql<number>`count(*)::int` }).from(hens)
      .where(and(inArray(hens.locationId, ids), inArray(hens.status, HEN_PRESENT_STATUSES as (typeof hens.status.enumValues)[number][]))).groupBy(hens.locationId),
    db.select({ locationId: roosters.locationId, total: sql<number>`count(*)::int` }).from(roosters)
      .where(and(inArray(roosters.locationId, ids), inArray(roosters.status, ["activo", "enfermo"]))).groupBy(roosters.locationId),
    db.select({ locationId: broilerBatches.locationId, total: sql<number>`coalesce(sum(${broilerBatches.currentQuantity}), 0)::int` }).from(broilerBatches)
      .where(and(inArray(broilerBatches.locationId, ids), inArray(broilerBatches.status, ["activo", "listo_sacrificio"]))).groupBy(broilerBatches.locationId),
    db.select({ locationId: broilerBatches.locationId, species: broilerBatches.species, total: sql<number>`coalesce(sum(${broilerBatches.currentQuantity}), 0)::int` }).from(broilerBatches)
      .where(and(inArray(broilerBatches.locationId, ids), inArray(broilerBatches.status, ["activo", "listo_sacrificio"]))).groupBy(broilerBatches.locationId, broilerBatches.species),
    db.select({ locationId: eggProduction.locationId, total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int` }).from(eggProduction)
      .where(and(inArray(eggProduction.locationId, ids), gte(eggProduction.date, cutoffDate))).groupBy(eggProduction.locationId),
    db.select({ locationId: eggProduction.locationId, species: eggProduction.species, total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int` }).from(eggProduction)
      .where(and(inArray(eggProduction.locationId, ids), gte(eggProduction.date, cutoffDate))).groupBy(eggProduction.locationId, eggProduction.species),
    db.select({ locationId: feedMovements.locationId, unit: feedInventory.unit, total: sql<string>`coalesce(sum(${feedMovements.quantity}::numeric), 0)::text` }).from(feedMovements)
      .leftJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
      .where(and(inArray(feedMovements.locationId, ids), eq(feedMovements.isEntry, false), gte(feedMovements.date, cutoffDate)))
      .groupBy(feedMovements.locationId, feedInventory.unit),
    db.select({ locationId: mortalityRecords.locationId, total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int` }).from(mortalityRecords)
      .where(and(inArray(mortalityRecords.locationId, ids), gte(mortalityRecords.date, cutoffDate))).groupBy(mortalityRecords.locationId),
    db.select({ locationId: healthControl.locationId, total: sql<number>`count(*)::int` }).from(healthControl)
      .where(and(inArray(healthControl.locationId, ids), gte(healthControl.date, cutoffDate))).groupBy(healthControl.locationId),
    db.select({ locationId: maintenance.locationId, pending: sql<number>`count(*) FILTER (WHERE ${maintenance.status} <> 'completado')::int`, cost: sql<string>`coalesce(sum(${maintenance.cost}::numeric) FILTER (WHERE ${maintenance.status} = 'completado'), 0)::text` }).from(maintenance)
      .where(inArray(maintenance.locationId, ids)).groupBy(maintenance.locationId),
    db.select({ locationId: animalLocationMovements.toLocationId, total: sql<number>`count(*)::int` }).from(animalLocationMovements)
      .where(inArray(animalLocationMovements.toLocationId, ids)).groupBy(animalLocationMovements.toLocationId),
    db.select({
      locationId: weightLogs.locationId,
      species: sql<string>`coalesce(${broilerBatches.species}::text, 'gallina')`,
      count: sql<number>`count(CASE WHEN ${weightLogs.avgWeightKg} ~ '^[0-9]+([.][0-9]+)?$' THEN 1 END)::int`,
      averageKg: sql<string>`avg(CASE WHEN ${weightLogs.avgWeightKg} ~ '^[0-9]+([.][0-9]+)?$' THEN ${weightLogs.avgWeightKg}::numeric END)::text`,
    }).from(weightLogs).leftJoin(broilerBatches, eq(weightLogs.batchId, broilerBatches.id))
      .where(and(inArray(weightLogs.locationId, ids), gte(weightLogs.date, cutoffDate))).groupBy(weightLogs.locationId, broilerBatches.species),
    db.select({ locationId: slaughter.locationId, species: slaughter.species, totalKg: sql<string>`coalesce(sum(${slaughter.weightKg}::numeric), 0)::text` }).from(slaughter)
      .where(and(inArray(slaughter.locationId, ids), gte(slaughter.date, cutoffDate))).groupBy(slaughter.locationId, slaughter.species),
  ]);
  const index = <T extends { locationId: string | null }>(rows: T[]) => new Map(rows.filter((row) => row.locationId).map((row) => [row.locationId!, row]));
  const parentsById = new Map(parents.map((row) => [row.id, row.name]));
  const hensById = index(henCounts);
  const roostersById = index(roosterCounts);
  const batchesById = index(batchCounts);
  const speciesByLocation = new Map<string, { species: string; total: number }[]>();
  for (const row of batchSpeciesCounts) {
    if (!row.locationId) continue;
    const current = speciesByLocation.get(row.locationId) || [];
    current.push({ species: row.species, total: Number(row.total) });
    speciesByLocation.set(row.locationId, current);
  }
  const eggsById = index(eggs);
  const eggsBySpecies = new Map<string, { species: string; total: number }[]>();
  for (const row of eggSpeciesRows) {
    if (!row.locationId) continue;
    const current = eggsBySpecies.get(row.locationId) || [];
    current.push({ species: row.species, total: Number(row.total) });
    eggsBySpecies.set(row.locationId, current);
  }
  const feedById = new Map<string, { unit: string | null; total: string }[]>();
  for (const row of feed) {
    if (!row.locationId) continue;
    const current = feedById.get(row.locationId) || [];
    current.push({ unit: row.unit, total: row.total });
    feedById.set(row.locationId, current);
  }
  const deathsById = index(deaths);
  const controlsById = index(controls);
  const tasksById = index(tasks);
  const movementsById = index(movementRows);
  const weightsById = new Map<string, { species: string; count: number; averageKg: string | null }[]>();
  for (const row of weightRows) {
    if (!row.locationId) continue;
    const current = weightsById.get(row.locationId) || [];
    current.push({ species: row.species, count: Number(row.count), averageKg: row.averageKg });
    weightsById.set(row.locationId, current);
  }
  const meatById = new Map<string, { species: string; totalKg: number }[]>();
  for (const row of meatRows) {
    if (!row.locationId) continue;
    const current = meatById.get(row.locationId) || [];
    current.push({ species: row.species, totalKg: Number(row.totalKg) });
    meatById.set(row.locationId, current);
  }
  return NextResponse.json(locations.map((place) => ({
    ...place,
    parentName: place.parentLocationId ? parentsById.get(place.parentLocationId) || null : null,
    animals: Number(hensById.get(place.id)?.total || 0) + Number(roostersById.get(place.id)?.total || 0) + Number(batchesById.get(place.id)?.total || 0),
    hens: Number(hensById.get(place.id)?.total || 0),
    roosters: Number(roostersById.get(place.id)?.total || 0),
    batchAnimals: Number(batchesById.get(place.id)?.total || 0),
    speciesCounts: [
      { species: "gallina", total: Number(hensById.get(place.id)?.total || 0) },
      { species: "gallo", total: Number(roostersById.get(place.id)?.total || 0) },
      ...(speciesByLocation.get(place.id) || []),
    ].filter((item) => item.total > 0),
    eggsPeriod: Number(eggsById.get(place.id)?.total || 0),
    eggsBySpeciesPeriod: eggsBySpecies.get(place.id) || [],
    feedConsumedPeriod: feedById.get(place.id) || [],
    feedConsumptionLabel: (feedById.get(place.id) || []).map((item) => `${Number(item.total).toLocaleString()} ${item.unit || "unidades"}`).join(" · ") || "Sin consumo con lugar registrado",
    deathsPeriod: Number(deathsById.get(place.id)?.total || 0),
    healthControlsPeriod: Number(controlsById.get(place.id)?.total || 0),
    weightSamplesPeriod: (weightsById.get(place.id) || []).reduce((total, item) => total + item.count, 0),
    averageWeightBySpeciesPeriod: weightsById.get(place.id) || [],
    meatProducedKgPeriod: (meatById.get(place.id) || []).reduce((total, item) => total + item.totalKg, 0),
    meatBySpeciesPeriod: meatById.get(place.id) || [],
    pendingMaintenance: Number(tasksById.get(place.id)?.pending || 0),
    maintenanceCost: Number(tasksById.get(place.id)?.cost || 0),
    transfersIn: Number(movementsById.get(place.id)?.total || 0),
    periodDays: period,
    capacityUsedPercent: place.capacity && place.capacity > 0
      ? Math.round((Number(hensById.get(place.id)?.total || 0) + Number(roostersById.get(place.id)?.total || 0) + Number(batchesById.get(place.id)?.total || 0)) / place.capacity * 100)
      : null,
  })));
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  try {
    const values = validateLocation(body);
    if (values.parentLocationId) {
      const [parent] = await db.select({ id: farmLocations.id }).from(farmLocations).where(eq(farmLocations.id, values.parentLocationId));
      if (!parent) return NextResponse.json({ error: "El lugar superior no existe" }, { status: 400 });
    }
    const [created] = await db.transaction(async (tx) => {
      const code = await nextLocationCode(tx);
      return tx.insert(farmLocations).values({ ...values, code }).returning();
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar el lugar" }, { status: 400 });
  }
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object" || !body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  try {
    const values = validateLocation(body);
    if (values.parentLocationId) {
      const [parent] = await db.select({ id: farmLocations.id }).from(farmLocations).where(eq(farmLocations.id, values.parentLocationId));
      if (!parent) return NextResponse.json({ error: "El lugar superior no existe" }, { status: 400 });
      const childCheck = (await db.execute(sql`WITH RECURSIVE descendants AS (
        SELECT id FROM farm_locations WHERE parent_location_id = ${body.id}
        UNION ALL SELECT child.id FROM farm_locations child JOIN descendants d ON child.parent_location_id = d.id
      ) SELECT EXISTS(SELECT 1 FROM descendants WHERE id = ${values.parentLocationId}) AS invalid`)).rows[0];
      if (childCheck?.invalid) return NextResponse.json({ error: "La jerarquía produciría una relación circular" }, { status: 400 });
    }
    const [updated] = await db.update(farmLocations).set({ ...values, updatedAt: new Date() })
      .where(eq(farmLocations.id, String(body.id))).returning();
    if (!updated) return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el lugar" }, { status: 400 });
  }
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const [updated] = await db.update(farmLocations).set({ status: "inactiva", updatedAt: new Date() })
    .where(eq(farmLocations.id, id)).returning({ id: farmLocations.id });
  if (!updated) return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, status: "inactiva" });
});
