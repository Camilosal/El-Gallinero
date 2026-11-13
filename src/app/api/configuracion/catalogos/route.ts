import { db } from "@/db";
import { catalogos, sanitaryCalendar, feedMovements } from "@/db/schema";
import { eq, asc, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac-server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { syncCatalogEntryToContact } from "@/lib/contacts";

export const dynamic = "force-dynamic";

/** Entero opcional: "" -> null, 0 es un valor válido (no se convierte en null). */
function intOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const tipo = searchParams.get("tipo");

  const conditions = [eq(catalogos.isActive, true)];
  if (category) conditions.push(eq(catalogos.category, category));
  if (tipo) conditions.push(eq(catalogos.tipo, tipo));

  const data = category || tipo
    ? await db.select().from(catalogos).where(and(...conditions)).orderBy(asc(catalogos.sortOrder), asc(catalogos.value))
    : await db.select().from(catalogos).orderBy(asc(catalogos.category), asc(catalogos.sortOrder));

  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  const category = (body.category || "").toString().trim();
  const value = (body.value || "").toString().trim();
  if (!category || !value) return NextResponse.json({ error: "Categoría y valor son requeridos" }, { status: 400 });

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(catalogos).where(and(eq(catalogos.category, category), eq(catalogos.value, value)));
    if (existing) return { conflict: true as const };

    const [maxOrder] = await tx.select({ max: sql<number>`max(${catalogos.sortOrder})` }).from(catalogos).where(eq(catalogos.category, category));
    const [row] = await tx.insert(catalogos).values({
      category,
      value,
      price: body.price !== undefined && body.price !== "" ? body.price.toString() : null,
      units: body.units !== undefined && body.units !== "" ? parseInt(body.units) : null,
      tipo: body.tipo !== undefined && body.tipo !== "" ? body.tipo : null,
      minWeeks: body.minWeeks !== undefined && body.minWeeks !== "" ? parseInt(body.minWeeks) : null,
      maxWeeks: body.maxWeeks !== undefined && body.maxWeeks !== "" ? parseInt(body.maxWeeks) : null,
      expectedEggsPerHen: body.expectedEggsPerHen !== undefined && body.expectedEggsPerHen !== "" ? body.expectedEggsPerHen.toString() : null,
      dailyFeedG: body.dailyFeedG !== undefined && body.dailyFeedG !== "" ? parseInt(body.dailyFeedG) : null,
      targetWeightKg: body.targetWeightKg !== undefined && body.targetWeightKg !== "" ? body.targetWeightKg.toString() : null,
      feedCostPerKg: body.feedCostPerKg !== undefined && body.feedCostPerKg !== "" ? body.feedCostPerKg.toString() : null,
      feedConversionRatio: body.feedConversionRatio !== undefined && body.feedConversionRatio !== "" ? body.feedConversionRatio.toString() : null,
      systemType: body.systemType !== undefined && body.systemType !== "" ? body.systemType : null,
      description: body.description !== undefined && body.description !== "" ? body.description : null,
      eggPrice: body.eggPrice !== undefined && body.eggPrice !== "" ? body.eggPrice.toString() : null,
      sortOrder: (maxOrder?.max ?? -1) + 1,
    }).returning();

    await syncCatalogEntryToContact(tx, {
      action: "upsert",
      category,
      value: row.value,
      isActive: row.isActive,
      description: row.description,
    });

    return { conflict: false as const, row };
  });

  if (result.conflict) {
    return NextResponse.json({ error: "Ese valor ya existe en el catálogo" }, { status: 409 });
  }

  return NextResponse.json(result.row, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  const value = (body.value || "").toString().trim();
  if (!value) return NextResponse.json({ error: "El valor no puede estar vacío" }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(catalogos).where(eq(catalogos.id, body.id));
    if (!existing) return null;

    const [row] = await tx.update(catalogos).set({
      value,
      price: body.price !== undefined ? (body.price === "" ? null : body.price.toString()) : undefined,
      units: body.units !== undefined ? intOrNull(body.units) : undefined,
      tipo: body.tipo !== undefined ? (body.tipo === "" ? null : body.tipo) : undefined,
      minWeeks: body.minWeeks !== undefined ? intOrNull(body.minWeeks) : undefined,
      maxWeeks: body.maxWeeks !== undefined ? intOrNull(body.maxWeeks) : undefined,
      expectedEggsPerHen: body.expectedEggsPerHen !== undefined ? (body.expectedEggsPerHen === "" ? null : body.expectedEggsPerHen.toString()) : undefined,
      dailyFeedG: body.dailyFeedG !== undefined ? intOrNull(body.dailyFeedG) : undefined,
      targetWeightKg: body.targetWeightKg !== undefined ? (body.targetWeightKg === "" ? null : body.targetWeightKg.toString()) : undefined,
      feedCostPerKg: body.feedCostPerKg !== undefined ? (body.feedCostPerKg === "" ? null : body.feedCostPerKg.toString()) : undefined,
      feedConversionRatio: body.feedConversionRatio !== undefined ? (body.feedConversionRatio === "" ? null : body.feedConversionRatio.toString()) : undefined,
      systemType: body.systemType !== undefined ? (body.systemType === "" ? null : body.systemType) : undefined,
      description: body.description !== undefined ? (body.description === "" ? null : body.description) : undefined,
      eggPrice: body.eggPrice !== undefined ? (body.eggPrice === "" ? null : body.eggPrice.toString()) : undefined,
      isActive: body.isActive !== undefined ? body.isActive : undefined,
    }).where(eq(catalogos.id, body.id)).returning();

    if (row) {
      await syncCatalogEntryToContact(tx, {
        action: "upsert",
        category: row.category,
        value: row.value,
        previousValue: existing.value,
        isActive: row.isActive,
        description: row.description,
      });
    }
    return row;
  });

  if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const deactivated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(catalogos).where(eq(catalogos.id, id));
    const [{ total }] = await tx.select({ total: sql<number>`count(*)::int` }).from(feedMovements)
      .where(eq(feedMovements.stageCatalogoId, id));
    if (total > 0) {
      // Una etapa con consumos registrados se desactiva: borrarla eliminaría el historial de costos.
      await tx.update(catalogos).set({ isActive: false }).where(eq(catalogos.id, id));
      return true;
    }
    await tx.delete(sanitaryCalendar).where(eq(sanitaryCalendar.targetStageId, id));
    await tx.delete(catalogos).where(eq(catalogos.id, id));
    if (existing) {
      await syncCatalogEntryToContact(tx, {
        action: "delete",
        category: existing.category,
        value: existing.value,
      });
    }
    return false;
  });
  return NextResponse.json({ ok: true, deactivated });
});
