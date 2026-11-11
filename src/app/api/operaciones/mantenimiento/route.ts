import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import { maintenance, transactions, farmLocations, farmAssets } from "@/db/schema";
import { eq, desc, and, getTableColumns, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { deleteTransactionsAndUnpaidAccounts, upsertExpenseTransaction } from "@/lib/financial-records";
import { nextMaintenanceDate } from "@/lib/maintenance-schedule";

export const dynamic = "force-dynamic";

const MAINTENANCE_STATUSES = new Set(["pendiente", "en_progreso", "completado"]);


function validateMaintenanceInput(input: { title?: unknown; scheduledDate?: unknown; completedDate?: unknown; status?: unknown; cost?: unknown; recurrenceIntervalDays?: unknown }) {
  if (typeof input.title !== "string" || !input.title.trim()) return "Título requerido";
  if (input.title.trim().length > 300) return "El título supera 300 caracteres";
  if (!isDateOnly(input.scheduledDate)) return "Fecha programada inválida";
  if (input.completedDate !== undefined && input.completedDate !== null && input.completedDate !== "" && !isDateOnly(input.completedDate)) {
    return "Fecha completada inválida";
  }
  if (!MAINTENANCE_STATUSES.has(String(input.status))) return "Estado de mantenimiento inválido";
  const cost = Number(input.cost ?? 0);
  if (!Number.isFinite(cost) || cost < 0) return "Costo inválido";
  if (input.recurrenceIntervalDays != null && input.recurrenceIntervalDays !== "") {
    const interval = Number(input.recurrenceIntervalDays);
    if (!Number.isSafeInteger(interval) || interval < 1 || interval > 3650) return "La repetición debe estar entre 1 y 3650 días";
  }
  return null;
}

function recurrenceInterval(value: unknown): number | null {
  return value == null || value === "" ? null : Number(value);
}

async function resolveAssetLocation(assetId: string | null, locationId: string | null) {
  if (!assetId) return locationId;
  const [asset] = await db.select({ id: farmAssets.id, locationId: farmAssets.locationId, status: farmAssets.status })
    .from(farmAssets).where(eq(farmAssets.id, assetId));
  if (!asset || asset.status === "retirado") throw new Error("Selecciona un equipo activo registrado");
  return locationId || asset.locationId;
}

async function createNextOccurrence(tx: any, task: typeof maintenance.$inferSelect) {
  if (task.status !== "completado" || !task.recurrenceIntervalDays) return null;
  const baseDate = task.completedDate || task.scheduledDate;
  const nextDate = nextMaintenanceDate(baseDate, task.recurrenceIntervalDays);
  const [existing] = await tx.select({ id: maintenance.id }).from(maintenance)
    .where(eq(maintenance.recurrenceParentId, task.id)).limit(1);
  if (existing) return null;

  const [next] = await tx.insert(maintenance).values({
    title: task.title,
    description: task.description,
    scheduledDate: nextDate,
    status: "pendiente",
    cost: "0",
    locationId: task.locationId,
    assetId: task.assetId,
    recurrenceSeriesId: task.recurrenceSeriesId,
    recurrenceParentId: task.id,
    recurrenceIntervalDays: task.recurrenceIntervalDays,
  }).returning();
  await upsertExpenseTransaction(tx, {
    condition: and(eq(transactions.sourceType, "mantenimiento"), eq(transactions.sourceId, next.id)),
    date: nextDate,
    category: "Mantenimiento",
    description: `Mantenimiento: ${task.title}`,
    amount: "0",
    sourceType: "mantenimiento",
    sourceId: next.id,
  });
  return next;
}

export const GET = withApiHandler(async () => {
  const data = await db.select({
    ...getTableColumns(maintenance),
    locationName: farmLocations.name,
    assetCode: farmAssets.code,
    assetName: farmAssets.name,
    assetCategory: farmAssets.category,
    assetStatus: farmAssets.status,
  })
    .from(maintenance)
    .leftJoin(farmLocations, eq(maintenance.locationId, farmLocations.id))
    .leftJoin(farmAssets, eq(maintenance.assetId, farmAssets.id))
    .orderBy(desc(maintenance.scheduledDate));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  const values = {
    title: typeof body.title === "string" ? body.title.trim() : body.title,
    description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
    scheduledDate: body.scheduledDate,
    completedDate: body.completedDate || null,
    status: body.status || "pendiente",
    cost: Number(body.cost ?? 0).toFixed(2),
    locationId: body.locationId ? String(body.locationId) : null,
    assetId: body.assetId ? String(body.assetId) : null,
    recurrenceIntervalDays: recurrenceInterval(body.recurrenceIntervalDays),
  };
  const error = validateMaintenanceInput(values);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    values.locationId = await resolveAssetLocation(values.assetId, values.locationId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Equipo inválido" }, { status: 400 });
  }
  if (values.locationId) {
    const [location] = await db.select({ id: farmLocations.id, status: farmLocations.status })
      .from(farmLocations).where(eq(farmLocations.id, values.locationId));
    if (!location || location.status !== "activa") return NextResponse.json({ error: "Selecciona un lugar activo" }, { status: 400 });
  }

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(maintenance).values(values).returning();
    await upsertExpenseTransaction(tx, {
      condition: and(eq(transactions.sourceType, "mantenimiento"), eq(transactions.sourceId, row.id)),
      date: values.completedDate || values.scheduledDate,
      category: "Mantenimiento",
      description: `Mantenimiento: ${values.title}`,
      amount: values.status === "completado" ? values.cost : "0",
      sourceType: "mantenimiento",
      sourceId: row.id,
    });
    await createNextOccurrence(tx, row);
    return row;
  });
  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const inputError = validateMaintenanceInput(body);
  if (inputError) return NextResponse.json({ error: inputError }, { status: 400 });
  const assetId = body.assetId ? String(body.assetId) : null;
  let locationId = body.locationId ? String(body.locationId) : null;
  try {
    locationId = await resolveAssetLocation(assetId, locationId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Equipo inválido" }, { status: 400 });
  }
  if (locationId) {
    const [location] = await db.select({ id: farmLocations.id })
      .from(farmLocations).where(eq(farmLocations.id, locationId));
    if (!location) return NextResponse.json({ error: "El lugar seleccionado no existe" }, { status: 400 });
  }

  let result;
  try {
    result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(maintenance).where(eq(maintenance.id, body.id)).for("update");
    if (!existing) throw new Error("No encontrado");
    const [updated] = await tx.update(maintenance).set({
      title: body.title.trim(),
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      scheduledDate: body.scheduledDate,
      completedDate: body.completedDate || null,
      status: body.status,
      cost: Number(body.cost ?? 0).toFixed(2),
      locationId,
      assetId,
      recurrenceIntervalDays: recurrenceInterval(body.recurrenceIntervalDays),
    }).where(eq(maintenance.id, body.id)).returning();

    if (!updated) throw new Error("No encontrado");

    // Sync one source expense in place; avoid duplicate rows and preserve credit links.
    await upsertExpenseTransaction(tx, {
      condition: and(eq(transactions.sourceType, "mantenimiento"), eq(transactions.sourceId, body.id)),
      date: body.completedDate || body.scheduledDate,
      category: "Mantenimiento",
      description: `Mantenimiento: ${body.title}`,
      amount: body.status === "completado" ? Number(body.cost ?? 0).toFixed(2) : "0",
      sourceType: "mantenimiento",
      sourceId: body.id,
    });

    await createNextOccurrence(tx, updated);

    return updated;
    });
  } catch (e: any) {
    if (e.message === "No encontrado") {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    throw e;
  }

  return NextResponse.json(result);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    await tx.delete(maintenance).where(eq(maintenance.id, id));
    await deleteTransactionsAndUnpaidAccounts(
      tx,
      and(eq(transactions.sourceType, "mantenimiento"), eq(transactions.sourceId, id)),
    );
  });
  return NextResponse.json({ ok: true });
});
