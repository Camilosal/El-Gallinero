import { db } from "@/db";
import { farmAssets, farmLocations } from "@/db/schema";
import { isDateOnly } from "@/lib/date-validation";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["equipo", "herramienta", "estructura", "vehiculo", "otro"]);
const STATUSES = new Set(["operativo", "requiere_mantenimiento", "fuera_servicio", "retirado"]);

function cleanText(value: unknown, max: number, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} inválido`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} supera ${max} caracteres`);
  return text || null;
}

function validateAsset(body: Record<string, unknown>) {
  if (typeof body.name !== "string" || !body.name.trim()) throw new Error("El nombre del activo es requerido");
  if (body.name.trim().length > 200) throw new Error("El nombre supera 200 caracteres");
  const category = String(body.category || "equipo");
  const status = String(body.status || "operativo");
  if (!CATEGORIES.has(category)) throw new Error("Tipo de activo inválido");
  if (!STATUSES.has(status)) throw new Error("Estado del activo inválido");
  if (body.acquisitionDate && !isDateOnly(body.acquisitionDate)) throw new Error("Fecha de adquisición inválida");
  if (body.warrantyUntil && !isDateOnly(body.warrantyUntil)) throw new Error("Fecha de garantía inválida");
  const cost = Number(body.acquisitionCost ?? 0);
  if (!Number.isFinite(cost) || cost < 0) throw new Error("El costo de adquisición no puede ser negativo");

  return {
    name: body.name.trim(),
    category,
    brand: cleanText(body.brand, 120, "Marca"),
    model: cleanText(body.model, 120, "Modelo"),
    serialNumber: cleanText(body.serialNumber, 150, "Número de serie"),
    acquisitionDate: body.acquisitionDate ? String(body.acquisitionDate) : null,
    acquisitionCost: cost.toFixed(2),
    warrantyUntil: body.warrantyUntil ? String(body.warrantyUntil) : null,
    locationId: body.locationId ? String(body.locationId) : null,
    status,
    description: cleanText(body.description, 4000, "Descripción"),
    notes: cleanText(body.notes, 4000, "Notas"),
  };
}

async function nextAssetCode(tx: any) {
  await tx.execute(sql`LOCK TABLE ${farmAssets} IN EXCLUSIVE MODE`);
  const rows = await tx.select({ code: farmAssets.code }).from(farmAssets);
  const max = rows.reduce((current: number, row: { code: string }) => {
    const match = /^ACT-(\d+)$/.exec(row.code);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `ACT-${String(max + 1).padStart(4, "0")}`;
}

async function validateLocation(locationId: string | null) {
  if (!locationId) return null;
  const [location] = await db.select({ id: farmLocations.id, status: farmLocations.status })
    .from(farmLocations).where(eq(farmLocations.id, locationId));
  if (!location || location.status !== "activa") throw new Error("Selecciona un lugar de manejo activo");
  return location;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const activeOnly = new URL(req.url).searchParams.get("active") === "true";
  const rows = await db.select({ ...getTableColumns(farmAssets), locationName: farmLocations.name })
    .from(farmAssets)
    .leftJoin(farmLocations, eq(farmAssets.locationId, farmLocations.id))
    .where(activeOnly ? sql`${farmAssets.status} <> 'retirado'` : undefined)
    .orderBy(asc(farmAssets.name));
  return NextResponse.json(rows);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  let values: ReturnType<typeof validateAsset>;
  try {
    values = validateAsset(body);
    await validateLocation(values.locationId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos del activo inválidos" }, { status: 400 });
  }
  const [created] = await db.transaction(async (tx) => {
    const code = await nextAssetCode(tx);
    return tx.insert(farmAssets).values({ ...values, code }).returning();
  });
  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  let values: ReturnType<typeof validateAsset>;
  try {
    values = validateAsset(body);
    await validateLocation(values.locationId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos del activo inválidos" }, { status: 400 });
  }
  const [updated] = await db.update(farmAssets).set({ ...values, updatedAt: new Date() })
    .where(eq(farmAssets.id, body.id)).returning();
  if (!updated) return NextResponse.json({ error: "Activo no encontrado" }, { status: 404 });
  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const [updated] = await db.update(farmAssets)
    .set({ status: "retirado", updatedAt: new Date() })
    .where(eq(farmAssets.id, id)).returning({ id: farmAssets.id });
  if (!updated) return NextResponse.json({ error: "Activo no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, status: "retirado" });
});
