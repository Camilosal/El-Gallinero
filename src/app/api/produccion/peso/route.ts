import { db } from "@/db";
import { breedWeightStandards, broilerBatches, weightLogs, farmLocations } from "@/db/schema";
import { eq, and, desc, gt, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { isDateOnly } from "@/lib/date-validation";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const breed = searchParams.get("breed");
  let standards: typeof breedWeightStandards.$inferSelect[] = [];
  if (breed) {
    const rows = await db
      .select()
      .from(breedWeightStandards)
      .where(eq(breedWeightStandards.breed, breed))
      .orderBy(breedWeightStandards.weekNumber);
    const neutralRows = rows.filter((row) => row.gender === "mixto");
    const sourceRows = neutralRows.length > 0 ? neutralRows : rows;
    const byWeek = new Map<number, typeof sourceRows>();
    for (const row of sourceRows) {
      const current = byWeek.get(row.weekNumber) || [];
      current.push(row);
      byWeek.set(row.weekNumber, current);
    }
    standards = [...byWeek.entries()].map(([weekNumber, group]) => ({
      ...group[0],
      gender: "mixto",
      targetWeightG: String(group.reduce((sum, row) => sum + Number(row.targetWeightG), 0) / group.length),
      minWeightG: group.some((row) => row.minWeightG != null)
        ? String(Math.min(...group.map((row) => Number(row.minWeightG ?? row.targetWeightG))))
        : null,
      maxWeightG: group.some((row) => row.maxWeightG != null)
        ? String(Math.max(...group.map((row) => Number(row.maxWeightG ?? row.targetWeightG))))
        : null,
      weekNumber,
    }));
  }

  const [rawLogs, batches] = await Promise.all([
    db.select({
      id: weightLogs.id,
      date: weightLogs.date,
      batchId: weightLogs.batchId,
      henGroup: weightLogs.henGroup,
      breed: weightLogs.breed,
      weekNumber: weightLogs.weekNumber,
      avgWeightKg: weightLogs.avgWeightKg,
      sampleSize: weightLogs.sampleSize,
      notes: weightLogs.notes,
      locationId: weightLogs.locationId,
      locationName: farmLocations.name,
      batchSpecies: broilerBatches.species,
      batchBreed: broilerBatches.breed,
      batchCode: broilerBatches.code,
      batchStartDate: broilerBatches.startDate,
    })
      .from(weightLogs)
      .leftJoin(broilerBatches, eq(weightLogs.batchId, broilerBatches.id))
      .leftJoin(farmLocations, eq(weightLogs.locationId, farmLocations.id))
      .orderBy(desc(weightLogs.date))
      .limit(200),
    db.select({ id: broilerBatches.id, code: broilerBatches.code, species: broilerBatches.species, breed: broilerBatches.breed, startDate: broilerBatches.startDate, currentQuantity: broilerBatches.currentQuantity, locationId: broilerBatches.locationId })
      .from(broilerBatches)
      .where(and(inArray(broilerBatches.status, ["activo", "listo_sacrificio"]), gt(broilerBatches.currentQuantity, 0)))
      .orderBy(desc(broilerBatches.startDate)),
  ]);
  const logs = rawLogs.map((log) => ({
    id: log.id,
    date: log.date,
    batchId: log.batchId,
    henGroup: log.henGroup,
    breed: log.breed || log.batchBreed,
    species: log.batchSpecies || "gallina",
    batchCode: log.batchCode,
    weekNumber: log.weekNumber ?? (log.batchStartDate
      ? Math.max(0, Math.floor((new Date(`${log.date}T12:00:00`).getTime() - new Date(`${log.batchStartDate}T12:00:00`).getTime()) / (7 * 86400000)))
      : null),
    avgWeightKg: log.avgWeightKg,
    sampleSize: log.sampleSize,
    notes: log.notes,
    locationId: log.locationId,
    locationName: log.locationName,
  }));
  return NextResponse.json({ standards, logs, batches });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { date, batchId, henGroup, breed, weekNumber, avgWeightKg, sampleSize, notes } = body;

  if (!isDateOnly(date) || avgWeightKg == null || avgWeightKg === "") {
    return NextResponse.json({ error: "La fecha y el peso son requeridos" }, { status: 400 });
  }
  if (typeof body.locationId !== "string" || !body.locationId) return NextResponse.json({ error: "Selecciona el lugar del pesaje" }, { status: 400 });
  const [location] = await db.select().from(farmLocations).where(eq(farmLocations.id, body.locationId));
  if (!location || location.status !== "activa") return NextResponse.json({ error: "El lugar del pesaje debe estar activo" }, { status: 400 });
  const weightNum = Number(avgWeightKg);
  if (isNaN(weightNum) || weightNum <= 0) {
    return NextResponse.json({ error: "El peso debe ser mayor a cero" }, { status: 400 });
  }

  const supportedSpecies = new Set(["gallina", "pollo", "codorniz", "pato", "conejo"]);
  const requestedSpecies = body.species || "gallina";
  if (!supportedSpecies.has(requestedSpecies)) return NextResponse.json({ error: "Especie inválida" }, { status: 400 });
  let resolvedBreed = typeof breed === "string" ? breed.trim() : "";
  let resolvedWeek = weekNumber === "" || weekNumber == null ? null : Number(weekNumber);
  if (resolvedWeek != null && (!Number.isSafeInteger(resolvedWeek) || resolvedWeek < 0)) {
    return NextResponse.json({ error: "La edad en semanas debe ser un entero no negativo" }, { status: 400 });
  }
  const sample = Number(sampleSize || 1);
  if (!Number.isSafeInteger(sample) || sample < 1) return NextResponse.json({ error: "El tamaño de muestra debe ser al menos 1" }, { status: 400 });

  if (batchId) {
    const [batch] = await db.select().from(broilerBatches).where(eq(broilerBatches.id, batchId)).limit(1);
    if (!batch) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    if (!supportedSpecies.has(batch.species) || batch.currentQuantity < 1 || !["activo", "listo_sacrificio"].includes(batch.status)) {
      return NextResponse.json({ error: "Solo puedes registrar el pesaje de un lote activo" }, { status: 400 });
    }
    if (requestedSpecies !== batch.species) return NextResponse.json({ error: "La especie no coincide con el lote seleccionado" }, { status: 400 });
    if (batch.locationId && batch.locationId !== body.locationId) return NextResponse.json({ error: "El lugar debe coincidir con el alojamiento actual del lote" }, { status: 400 });
    resolvedBreed ||= batch.breed;
    if (resolvedWeek == null) {
      resolvedWeek = Math.max(0, Math.floor((new Date(`${date}T12:00:00`).getTime() - new Date(`${batch.startDate}T12:00:00`).getTime()) / (7 * 86400000)));
    }
  } else if (body.species && body.species !== "gallina") {
    return NextResponse.json({ error: "Selecciona el lote para registrar el pesaje de esta especie" }, { status: 400 });
  }

  const [row] = await db
    .insert(weightLogs)
    .values({
      date,
      batchId: batchId || null,
      locationId: body.locationId,
      henGroup: henGroup || null,
      breed: resolvedBreed || null,
      weekNumber: resolvedWeek,
      avgWeightKg: String(avgWeightKg),
      sampleSize: sample,
      notes: notes || null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await db.delete(weightLogs).where(eq(weightLogs.id, id));
  return NextResponse.json({ ok: true });
});
