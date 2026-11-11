import { db } from "@/db";
import { animalLocationMovements, broilerBatches, farmLocations, hens, roosters } from "@/db/schema";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";
import { isDateOnly } from "@/lib/date-validation";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ENTITY_TYPES = new Set(["gallina", "gallo", "lote"]);

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  const conditions = locationId
    ? or(eq(animalLocationMovements.fromLocationId, locationId), eq(animalLocationMovements.toLocationId, locationId))
    : undefined;
  const [rows, locations] = await Promise.all([
    db.select({
      id: animalLocationMovements.id,
      henId: animalLocationMovements.henId,
      roosterId: animalLocationMovements.roosterId,
      batchId: animalLocationMovements.batchId,
      fromLocationId: animalLocationMovements.fromLocationId,
      toLocationId: animalLocationMovements.toLocationId,
      quantity: animalLocationMovements.quantity,
      date: animalLocationMovements.date,
      reason: animalLocationMovements.reason,
      notes: animalLocationMovements.notes,
      createdAt: animalLocationMovements.createdAt,
      henCode: hens.code,
      roosterCode: roosters.code,
      batchCode: broilerBatches.code,
      species: broilerBatches.species,
    }).from(animalLocationMovements)
      .leftJoin(hens, eq(animalLocationMovements.henId, hens.id))
      .leftJoin(roosters, eq(animalLocationMovements.roosterId, roosters.id))
      .leftJoin(broilerBatches, eq(animalLocationMovements.batchId, broilerBatches.id))
      .where(conditions).orderBy(desc(animalLocationMovements.date), desc(animalLocationMovements.createdAt)).limit(300),
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
  ]);
  const names = new Map(locations.map((location) => [location.id, location.name]));
  return NextResponse.json(rows.map((row) => ({
    ...row,
    animalCode: row.henCode || row.roosterCode || row.batchCode || "Registro eliminado",
    animalType: row.henId ? "gallina" : row.roosterId ? "gallo" : row.species || "lote",
    fromLocationName: row.fromLocationId ? names.get(row.fromLocationId) || "Ubicación anterior" : "Sin asignar",
    toLocationName: names.get(row.toLocationId) || "Ubicación no disponible",
  })));
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!ENTITY_TYPES.has(String(body.animalType))) return NextResponse.json({ error: "Tipo de animal inválido" }, { status: 400 });
  if (!body.animalId || !body.toLocationId || !isDateOnly(body.date)) return NextResponse.json({ error: "Animal, destino y fecha son requeridos" }, { status: 400 });
  const reason = String(body.reason || "").trim();
  if (!reason || reason.length > 100) return NextResponse.json({ error: "Indica un motivo de traslado (máximo 100 caracteres)" }, { status: 400 });
  const notes = body.notes == null ? null : String(body.notes).trim() || null;
  if (notes && notes.length > 2000) return NextResponse.json({ error: "Las notas superan 2000 caracteres" }, { status: 400 });

  try {
    const created = await db.transaction(async (tx) => {
      const [destination] = await tx.select().from(farmLocations).where(eq(farmLocations.id, body.toLocationId)).for("update");
      if (!destination || destination.status !== "activa") throw new Error("Selecciona un lugar activo");
      if (["fuera_servicio", "restringida"].includes(destination.operationalStatus)) {
        throw new Error("El destino está fuera de servicio o restringido y no admite traslados");
      }

      let fromLocationId: string | null = null;
      let quantity = 1;
      let target: { henId?: string; roosterId?: string; batchId?: string } = {};
      if (body.animalType === "gallina") {
        const [animal] = await tx.select().from(hens).where(eq(hens.id, String(body.animalId))).for("update");
        if (!animal || !HEN_PRESENT_STATUSES.includes(animal.status)) throw new Error("La gallina no está disponible para traslado");
        fromLocationId = animal.locationId;
        target = { henId: animal.id };
      } else if (body.animalType === "gallo") {
        const [animal] = await tx.select().from(roosters).where(eq(roosters.id, String(body.animalId))).for("update");
        if (!animal || !["activo", "enfermo"].includes(animal.status)) throw new Error("El gallo no está disponible para traslado");
        fromLocationId = animal.locationId;
        target = { roosterId: animal.id };
      } else {
        const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, String(body.animalId))).for("update");
        if (!batch || !["activo", "listo_sacrificio"].includes(batch.status) || batch.currentQuantity < 1) {
          throw new Error("El lote no está disponible para traslado");
        }
        fromLocationId = batch.locationId;
        quantity = batch.currentQuantity;
        target = { batchId: batch.id };
      }

      if (fromLocationId === destination.id) throw new Error("El animal ya está en este lugar");
      if (destination.capacity != null) {
        const [[henCount], [roosterCount], [batchCount]] = await Promise.all([
          tx.select({ total: sql<number>`count(*)::int` }).from(hens)
            .where(and(eq(hens.locationId, destination.id), inArray(hens.status, HEN_PRESENT_STATUSES as (typeof hens.status.enumValues)[number][]))),
          tx.select({ total: sql<number>`count(*)::int` }).from(roosters)
            .where(and(eq(roosters.locationId, destination.id), inArray(roosters.status, ["activo", "enfermo"]))),
          tx.select({ total: sql<number>`coalesce(sum(${broilerBatches.currentQuantity}), 0)::int` }).from(broilerBatches)
            .where(and(eq(broilerBatches.locationId, destination.id), inArray(broilerBatches.status, ["activo", "listo_sacrificio"]))),
        ]);
        const occupied = Number(henCount?.total || 0) + Number(roosterCount?.total || 0) + Number(batchCount?.total || 0);
        if (occupied + quantity > destination.capacity) {
          throw new Error(`El traslado supera la capacidad del lugar (${destination.capacity} animales)`);
        }
      }

      if (body.animalType === "gallina") {
        await tx.update(hens).set({ locationId: destination.id, updatedAt: new Date() }).where(eq(hens.id, target.henId!));
      } else if (body.animalType === "gallo") {
        await tx.update(roosters).set({ locationId: destination.id, updatedAt: new Date() }).where(eq(roosters.id, target.roosterId!));
      } else {
        await tx.update(broilerBatches).set({ locationId: destination.id, updatedAt: new Date() }).where(eq(broilerBatches.id, target.batchId!));
      }

      const [movement] = await tx.insert(animalLocationMovements).values({
        ...target,
        fromLocationId,
        toLocationId: destination.id,
        quantity,
        date: body.date,
        reason,
        notes,
      }).returning();
      return movement;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar el traslado" }, { status: 400 });
  }
});
